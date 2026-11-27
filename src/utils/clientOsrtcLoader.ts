import {
  calculateDistanceKm,
  classifyFleetCategory,
  formatTitleCase,
  replaceCuttackWithKataka,
  toDisplayRouteCode
} from './transitLogic';
import {
  BusRoute,
  BusStop,
  StopScheduleDeparture,
  StopScheduleResponse
} from './transitTypes';
import { CUSTOM_BUS_STOPS, mergeCustomBusStops } from './customStops';

interface ClientRoadSegment {
  serviceKeys: string[];
  pts: [number, number][];
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

interface ClientNetworkIndex {
  stops: Record<string, [string, number, number]>;
  types: string[];
  services: Record<string, any[]>;
  segMap: Map<string, any[]>;
  stopDegree: Map<string, number>;
  roadSegments: ClientRoadSegment[];
  expiresAt: number;
}

let cachedClientNetPromise: Promise<ClientNetworkIndex> | null = null;
let cachedClientNet: ClientNetworkIndex | null = null;

async function fetchJsonStrict(url: string, timeoutMs = 12_000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: url.includes('live/') || url.includes('rt/') || url.includes('/api/osrtc/live') ? 'no-store' : 'default',
      signal: controller.signal
    });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    // Critical on Netlify: SPA fallback returns 200 text/html for missing /api/* paths
    if (!ct.includes('json') && !ct.includes('javascript')) {
      return null;
    }
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchProxyJsonWithRetry(relativePath: string): Promise<any | null> {
  const cleanPath = relativePath.replace(/^\/+/, '');
  const proxyUrl = `/osrtc-proxy/${cleanPath}`;
  const first = await fetchJsonStrict(proxyUrl, 12_000);
  if (first !== null) return first;
  // Retry once on transient edge network hiccup
  await new Promise((r) => setTimeout(r, 450));
  return await fetchJsonStrict(proxyUrl, 14_000);
}

function decodeDeltaPolylineToLatLon(flat: number[]): [number, number][] {
  const out: [number, number][] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    x += flat[i];
    y += flat[i + 1];
    out.push([y / 1e5, x / 1e5]);
  }
  return out;
}

function approxKm(a: [number, number], b: [number, number]): number {
  return Math.hypot((a[1] - b[1]) * 106, (a[0] - b[0]) * 111);
}

function pointToSegmentKm(
  pLat: number,
  pLon: number,
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): number {
  const kx = 104.5;
  const ky = 111.0;
  const px = (pLon - aLon) * kx;
  const py = (pLat - aLat) * ky;
  const vx = (bLon - aLon) * kx;
  const vy = (bLat - aLat) * ky;
  const lenSq = vx * vx + vy * vy;
  if (lenSq < 1e-9) return Math.hypot(px, py);
  const t = Math.max(0, Math.min(1, (px * vx + py * vy) / lenSq));
  return Math.hypot(px - t * vx, py - t * vy);
}

function minDistanceToPolylineKm(lat: number, lon: number, pts: [number, number][]): number {
  let minD = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const d = pointToSegmentKm(lat, lon, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (d < minD) minD = d;
    if (minD < 0.05) return minD;
  }
  return minD;
}

function stitchRoadPathForStopIds(
  stopIds: string[],
  stopsDict: Record<string, [string, number, number]>,
  segMap: Map<string, any[]>
): [number, number][] {
  const fullPath: [number, number][] = [];
  for (let i = 0; i + 1 < stopIds.length; i++) {
    const aId = stopIds[i];
    const bId = stopIds[i + 1];
    const g = segMap.get(`${aId}>${bId}`);
    if (g && Array.isArray(g[3]) && g[3].length >= 2) {
      const pts = decodeDeltaPolylineToLatLon(g[3]);
      for (const p of pts) {
        if (
          fullPath.length === 0 ||
          Math.abs(fullPath[fullPath.length - 1][0] - p[0]) > 1e-5 ||
          Math.abs(fullPath[fullPath.length - 1][1] - p[1]) > 1e-5
        ) {
          fullPath.push(p);
        }
      }
      continue;
    }
    const A = stopsDict[aId];
    const B = stopsDict[bId];
    if (A && B) {
      if (fullPath.length === 0) fullPath.push([A[1], A[2]]);
      fullPath.push([B[1], B[2]]);
    }
  }
  return fullPath;
}

async function getClientNetworkIndex(): Promise<ClientNetworkIndex> {
  const now = Date.now();
  if (cachedClientNet && cachedClientNet.expiresAt > now) {
    return cachedClientNet;
  }
  if (cachedClientNetPromise) {
    return cachedClientNetPromise;
  }

  cachedClientNetPromise = (async () => {
    const [stops, svc, segs, cstops, csvc, csegs] = await Promise.all([
      fetchProxyJsonWithRetry('live/net/stops.json'),
      fetchProxyJsonWithRetry('live/net/services.json'),
      fetchProxyJsonWithRetry('live/net/segs.json'),
      fetchProxyJsonWithRetry('city/data/stops.json'),
      fetchProxyJsonWithRetry('city/data/services.json'),
      fetchProxyJsonWithRetry('city/data/segs.json')
    ]);

    const stopsDict: Record<string, [string, number, number]> = {
      ...(stops || {}),
      ...(cstops || {})
    };

    const types: string[] = [];
    const services: Record<string, any[]> = {};

    if (svc) {
      types.push(...(svc.types || []));
      Object.assign(services, svc.services || {});
    }
    const cityOffset = types.length;
    if (csvc) {
      types.push(...(csvc.types || []));
      for (const [k, v] of Object.entries(csvc.services || {})) {
        if (Array.isArray(v)) {
          const copy = v.slice();
          copy[1] = Number(copy[1] || 0) + cityOffset;
          services[k] = copy;
        }
      }
    }

    const segMap = new Map<string, any[]>();
    const allSegs = [
      ...(Array.isArray(segs?.segs) ? segs.segs : []),
      ...(Array.isArray(csegs?.segs) ? csegs.segs : [])
    ];
    for (const g of allSegs) {
      if (Array.isArray(g) && g.length >= 4) {
        segMap.set(`${g[0]}>${g[1]}`, g);
      }
    }

    const stopDegree = new Map<string, number>();
    const segToServices = new Map<string, string[]>();

    for (const [serviceKey, v] of Object.entries(services)) {
      if (!Array.isArray(v) || !Array.isArray(v[6]) || v[6].length < 2) continue;
      const stopIds: string[] = v[6];
      for (let i = 0; i < stopIds.length; i++) {
        const sid = stopIds[i];
        stopDegree.set(sid, (stopDegree.get(sid) || 0) + 1);
        if (i + 1 < stopIds.length) {
          const segKey = `${sid}>${stopIds[i + 1]}`;
          let list = segToServices.get(segKey);
          if (!list) {
            list = [];
            segToServices.set(segKey, list);
          }
          list.push(serviceKey);
        }
      }
    }

    const roadSegments: ClientRoadSegment[] = [];
    for (const [segKey, serviceKeys] of segToServices.entries()) {
      const [aId, bId] = segKey.split('>');
      const A = stopsDict[aId];
      const B = stopsDict[bId];
      if (!A || !B) continue;

      const g = segMap.get(segKey);
      let pts: [number, number][] = [
        [A[1], A[2]],
        [B[1], B[2]]
      ];
      if (g && Array.isArray(g[3])) {
        const decoded = decodeDeltaPolylineToLatLon(g[3]);
        if (decoded.length > 1) {
          if (decoded.length > 40) {
            const step = Math.max(1, Math.floor(decoded.length / 40));
            const sampled: [number, number][] = [];
            for (let i = 0; i < decoded.length; i += step) sampled.push(decoded[i]);
            if (sampled[sampled.length - 1] !== decoded[decoded.length - 1]) {
              sampled.push(decoded[decoded.length - 1]);
            }
            pts = sampled;
          } else {
            pts = decoded;
          }
        }
      }

      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLon = Infinity;
      let maxLon = -Infinity;
      for (const [la, lo] of pts) {
        if (la < minLat) minLat = la;
        if (la > maxLat) maxLat = la;
        if (lo < minLon) minLon = lo;
        if (lo > maxLon) maxLon = lo;
      }
      roadSegments.push({ serviceKeys, pts, minLat, maxLat, minLon, maxLon });
    }

    const built: ClientNetworkIndex = {
      stops: stopsDict,
      types,
      services,
      segMap,
      stopDegree,
      roadSegments,
      expiresAt: Date.now() + 15 * 60_000
    };
    if (Object.keys(stopsDict).length > 0) {
      cachedClientNet = built;
    }
    return built;
  })();

  try {
    return await cachedClientNetPromise;
  } finally {
    cachedClientNetPromise = null;
  }
}

export async function fetchLiveFeedsData(): Promise<{
  status: any;
  vehiclePositions: any;
  tripUpdates: any;
  liveVehicles: any;
  routeLink: any;
}> {
  const apiData = await fetchJsonStrict(`/api/osrtc/live?t=${Date.now()}`, 12_000);
  if (apiData && (apiData.liveVehicles || apiData.vehiclePositions)) {
    return {
      status: apiData.status || null,
      vehiclePositions: apiData.vehiclePositions || null,
      tripUpdates: apiData.tripUpdates || null,
      liveVehicles: apiData.liveVehicles || null,
      routeLink: apiData.routeLink || null
    };
  }

  // Static Netlify fallback via /osrtc-proxy/* (200 edge reverse proxy)
  const ts = Date.now();
  const [liveVehicles, routeLink, status, vehiclePositions, tripUpdates] = await Promise.all([
    fetchProxyJsonWithRetry(`live/vehicles.json?t=${ts}`),
    fetchProxyJsonWithRetry(`live/routelink.json?t=${ts}`),
    fetchProxyJsonWithRetry(`rt/status.json?t=${ts}`),
    fetchProxyJsonWithRetry(`rt/vehicle_positions.json?t=${ts}`),
    fetchProxyJsonWithRetry(`rt/trip_updates.json?t=${ts}`)
  ]);

  return {
    status,
    vehiclePositions,
    tripUpdates,
    liveVehicles,
    routeLink
  };
}

function mapRawStopsToBusStops(rawStops: any[]): BusStop[] {
  const customById = new Map(CUSTOM_BUS_STOPS.map((cs) => [cs.id, cs]));
  const mapped: BusStop[] = rawStops.map((st: any) => {
    const customMeta = customById.get(st.id);
    if (customMeta) {
      return { ...customMeta };
    }
    const degree = Number(st.degree || 1);
    return {
      id: st.id,
      name: formatTitleCase(st.name),
      district: st.isCity ? 'CRUT Urban Network' : 'Odisha Bus Network',
      lat: st.lat,
      lon: st.lon,
      degree,
      isTerminal: degree >= 25
    };
  });
  return mergeCustomBusStops(mapped);
}

function mapRawRoutesToBusRoutes(rawRoutes: any[]): BusRoute[] {
  const realRoutes: BusRoute[] = [];
  for (const r of rawRoutes) {
    const fleet = classifyFleetCategory(r.typeName, r.routeNumber, r.serviceKey);
    const stList = r.stops || [];
    if (stList.length < 2) continue;
    const first = stList[0];
    const last = stList[stList.length - 1];
    const distKm = calculateDistanceKm(first.lat, first.lon, last.lat, last.lon);
    realRoutes.push({
      id: r.serviceKey || r.routeNumber,
      serviceKey: r.serviceKey,
      routeNumber: r.routeNumber,
      name: `${formatTitleCase(r.origin || first.stopName)} → ${formatTitleCase(r.destination || last.stopName)}`,
      origin: formatTitleCase(r.origin || first.stopName),
      destination: formatTitleCase(r.destination || last.stopName),
      fleet,
      corridor: r.cityName
        ? `${replaceCuttackWithKataka(String(r.cityName))} City Transit`
        : 'Odisha Intercity Network',
      distanceKm: distKm,
      durationLabel: `${Math.max(20, Math.round(distKm * 1.4))}m`,
      departures: r.departure ? [r.departure] : [],
      stops: stList.map((s: any, idx: number) => ({
        stopId: s.stopId,
        stopName: formatTitleCase(s.stopName),
        lat: s.lat,
        lon: s.lon,
        scheduledTime: s.scheduledTime || '--:--',
        status: idx === 0 ? 'passed' : 'upcoming',
        sequence: s.sequence || idx + 1
      })),
      path: stList.map((s: any) => [s.lat, s.lon] as [number, number])
    });
  }
  return realRoutes;
}

export async function fetchNetworkDirectoryData(): Promise<{
  stops: BusStop[];
  routes: BusRoute[];
}> {
  const apiData = await fetchJsonStrict('/api/osrtc/network', 15_000);
  if (apiData && Array.isArray(apiData.stops) && apiData.stops.length > 0) {
    return {
      stops: mapRawStopsToBusStops(apiData.stops),
      routes: Array.isArray(apiData.routes) ? mapRawRoutesToBusRoutes(apiData.routes) : []
    };
  }

  // Static Netlify fallback via /osrtc-proxy/*
  const net = await getClientNetworkIndex();
  const rawStops: any[] = [];
  for (const [id, tuple] of Object.entries(net.stops)) {
    if (!Array.isArray(tuple) || tuple.length < 3) continue;
    const [name, lat, lon] = tuple;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < 17.4 || lat > 22.9 || lon < 81.1 || lon > 87.7) continue;
    rawStops.push({
      id,
      name,
      lat,
      lon,
      isCity: id.startsWith('k'),
      degree: net.stopDegree.get(id) || 1
    });
  }
  rawStops.sort((a, b) => b.degree - a.degree);

  const seenRoutes = new Set<string>();
  const intercityRoutes: any[] = [];
  const cityRoutes: any[] = [];
  for (const [serviceKey, v] of Object.entries(net.services)) {
    if (!Array.isArray(v) || !Array.isArray(v[6]) || v[6].length < 2) continue;
    const routeNumber = String(v[0] || '').trim();
    const typeName = net.types[Number(v[1])] || 'OSRTC';
    const isCity = serviceKey.startsWith('k');
    const cityName = isCity ? String(v[2] || '') : '';
    const dep = String(v[3] || '');
    const from = String(v[4] || '');
    const to = String(v[5] || '');
    const dedupeKey = `${cityName}|${routeNumber}|${from}|${to}`;
    if (seenRoutes.has(dedupeKey)) continue;
    seenRoutes.add(dedupeKey);

    const stopIds: string[] = v[6];
    const times: string[] = Array.isArray(v[7]) ? v[7] : [];
    const stopPoints = stopIds
      .map((sid, idx) => {
        const st = net.stops[sid];
        if (!st) return null;
        return {
          stopId: sid,
          stopName: st[0],
          lat: st[1],
          lon: st[2],
          scheduledTime: times[idx] || '--:--',
          sequence: idx + 1
        };
      })
      .filter(Boolean);
    if (stopPoints.length < 2) continue;

    const routeObj = {
      serviceKey,
      routeNumber,
      typeName,
      cityName,
      departure: dep,
      origin: from,
      destination: to,
      stops: stopPoints
    };
    if (isCity) cityRoutes.push(routeObj);
    else intercityRoutes.push(routeObj);
  }

  return {
    stops: mapRawStopsToBusStops(rawStops),
    routes: mapRawRoutesToBusRoutes([...cityRoutes.slice(0, 260), ...intercityRoutes.slice(0, 650)])
  };
}

export async function fetchBusTripDetailData(
  busId: string
): Promise<{ trip: any; roadPath: [number, number][] } | null> {
  const apiData = await fetchJsonStrict(
    `/api/osrtc/trip/${encodeURIComponent(busId)}?t=${Date.now()}`,
    10_000
  );
  if (apiData) {
    if (apiData.trip && Array.isArray(apiData.trip.stops)) {
      return { trip: apiData.trip, roadPath: Array.isArray(apiData.roadPath) ? apiData.roadPath : [] };
    }
    return null;
  }

  // Static Netlify fallback via /osrtc-proxy/live/trip/:id.json
  const tripJson = await fetchProxyJsonWithRetry(`live/trip/${encodeURIComponent(busId)}.json?t=${Date.now()}`);
  if (!tripJson || !Array.isArray(tripJson.stops)) return null;

  let roadPath: [number, number][] = [];
  try {
    const net = await getClientNetworkIndex();
    const rid = String(tripJson.rid || '');
    const svc = rid ? net.services[rid] : null;
    if (svc && Array.isArray(svc[6]) && svc[6].length >= 2) {
      roadPath = stitchRoadPathForStopIds(svc[6], net.stops, net.segMap);
    }
  } catch {
    // Fallback to stop coordinates
  }

  return { trip: tripJson, roadPath };
}

export async function fetchRouteRoadPathData(routeKey: string): Promise<[number, number][] | null> {
  const apiData = await fetchJsonStrict(`/api/osrtc/route-path/${encodeURIComponent(routeKey)}`, 10_000);
  if (apiData && Array.isArray(apiData.roadPath) && apiData.roadPath.length >= 2) {
    return apiData.roadPath;
  }

  // Static Netlify fallback via cached client segs.json
  try {
    const net = await getClientNetworkIndex();
    let svc = net.services[routeKey];
    if (!svc) {
      for (const v of Object.values(net.services)) {
        if (Array.isArray(v) && String(v[0] || '').toUpperCase() === routeKey.toUpperCase()) {
          svc = v;
          break;
        }
      }
    }
    if (!svc || !Array.isArray(svc[6])) return null;
    const roadPath = stitchRoadPathForStopIds(svc[6], net.stops, net.segMap);
    return roadPath.length >= 2 ? roadPath : null;
  } catch {
    return null;
  }
}

export async function fetchRoutesOnRoadData(
  lat: number,
  lon: number
): Promise<{ routes: BusRoute[]; nearestStopName?: string } | null> {
  const apiData = await fetchJsonStrict(
    `/api/osrtc/routes-on-road?lat=${encodeURIComponent(lat.toFixed(5))}&lon=${encodeURIComponent(lon.toFixed(5))}`,
    12_000
  );
  if (apiData && Array.isArray(apiData.routes)) {
    return {
      routes: mapRawRoutesToBusRoutes(apiData.routes),
      nearestStopName: apiData.nearestStopName ? formatTitleCase(apiData.nearestStopName) : undefined
    };
  }

  // Static Netlify fallback via cached client roadSegments
  try {
    const net = await getClientNetworkIndex();
    const searchRadiiKm = [0.18, 0.45];
    const matchedServiceDist = new Map<string, number>();

    for (const radiusKm of searchRadiiKm) {
      const padLat = radiusKm / 111.0;
      const padLon = radiusKm / 104.5;
      for (const seg of net.roadSegments) {
        if (
          lat < seg.minLat - padLat ||
          lat > seg.maxLat + padLat ||
          lon < seg.minLon - padLon ||
          lon > seg.maxLon + padLon
        ) {
          continue;
        }
        const d = minDistanceToPolylineKm(lat, lon, seg.pts);
        if (d <= radiusKm) {
          for (const sk of seg.serviceKeys) {
            const prev = matchedServiceDist.get(sk);
            if (prev === undefined || d < prev) matchedServiceDist.set(sk, d);
          }
        }
      }
      if (matchedServiceDist.size >= 1) break;
    }

    const ranked = Array.from(matchedServiceDist.entries()).sort((a, b) => a[1] - b[1]);
    const seen = new Set<string>();
    const rawRoutes: any[] = [];
    for (const [serviceKey] of ranked) {
      const v = net.services[serviceKey];
      if (!Array.isArray(v) || !Array.isArray(v[6]) || v[6].length < 2) continue;
      const routeNumber = String(v[0] || '').trim();
      const typeName = net.types[Number(v[1])] || 'OSRTC';
      const cityName = serviceKey.startsWith('k') ? String(v[2] || '') : '';
      const dep = String(v[3] || '');
      const origin = String(v[4] || '');
      const destination = String(v[5] || '');
      const dedupeKey = `${cityName}|${routeNumber}|${origin}|${destination}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const stopIds: string[] = v[6];
      const times: string[] = Array.isArray(v[7]) ? v[7] : [];
      const stopPoints = stopIds
        .map((sid, idx) => {
          const st = net.stops[sid];
          if (!st) return null;
          return {
            stopId: sid,
            stopName: st[0],
            lat: st[1],
            lon: st[2],
            scheduledTime: times[idx] || '--:--',
            sequence: idx + 1
          };
        })
        .filter(Boolean);
      if (stopPoints.length < 2) continue;

      rawRoutes.push({
        serviceKey,
        routeNumber,
        typeName,
        cityName,
        departure: dep,
        origin,
        destination,
        stops: stopPoints
      });
      if (rawRoutes.length >= 150) break;
    }

    let nearestStopName = '';
    let nearestDist = Infinity;
    for (const tuple of Object.values(net.stops)) {
      if (!Array.isArray(tuple) || tuple.length < 3) continue;
      const d = approxKm([lat, lon], [tuple[1], tuple[2]]);
      if (d < nearestDist) {
        nearestDist = d;
        nearestStopName = tuple[0];
      }
    }

    return {
      routes: mapRawRoutesToBusRoutes(rawRoutes),
      nearestStopName: nearestDist < 15 ? formatTitleCase(nearestStopName) : undefined
    };
  } catch {
    return null;
  }
}

function mapRawStopDepartures(rawDepartures: any[]): StopScheduleDeparture[] {
  return rawDepartures
    .map((d: any) => {
      const routeNumber = String(d.routeNumber || '').trim();
      const fleet = classifyFleetCategory(d.typeName, routeNumber, d.serviceKey);
      const stops = Array.isArray(d.stops)
        ? d.stops.map((s: any, idx: number) => ({
            stopId: String(s.stopId || ''),
            stopName: formatTitleCase(String(s.stopName || '')),
            lat: Number(s.lat),
            lon: Number(s.lon),
            scheduledTime: String(s.scheduledTime || '--:--'),
            status: (idx === 0 ? 'passed' : 'upcoming') as 'passed' | 'upcoming',
            sequence: Number(s.sequence || idx + 1)
          }))
        : [];
      if (stops.length < 2) return null;
      return {
        serviceKey: String(d.serviceKey || ''),
        routeNumber,
        displayRouteCode: toDisplayRouteCode(routeNumber) || routeNumber,
        fleet,
        cityName: d.cityName ? replaceCuttackWithKataka(String(d.cityName)) : undefined,
        origin: formatTitleCase(String(d.origin || stops[0]?.stopName || '')),
        destination: formatTitleCase(String(d.destination || stops[stops.length - 1]?.stopName || '')),
        departureTime: String(d.departureTime || '--:--'),
        originDepartureTime: String(d.originDepartureTime || d.departureTime || '--:--'),
        stopIndex: Number.isFinite(Number(d.stopIndex)) ? Number(d.stopIndex) : 0,
        stops
      } as StopScheduleDeparture;
    })
    .filter((item): item is StopScheduleDeparture => Boolean(item));
}

export async function fetchStopScheduleData(stop: BusStop): Promise<StopScheduleResponse | null> {
  const params = new URLSearchParams();
  if (stop.name) params.set('name', stop.name);
  if (stop.mirrorStopName) params.set('mirror', stop.mirrorStopName);

  const apiData = await fetchJsonStrict(
    `/api/osrtc/stop-schedule/${encodeURIComponent(stop.id)}?${params.toString()}`,
    12_000
  );
  if (apiData && Array.isArray(apiData.departures)) {
    return {
      stopId: String(apiData.stopId || stop.id),
      stopName: formatTitleCase(String(apiData.stopName || stop.name)),
      resolvedStopIds: Array.isArray(apiData.resolvedStopIds) ? apiData.resolvedStopIds : [stop.id],
      departures: mapRawStopDepartures(apiData.departures)
    };
  }

  // Static Netlify fallback via full cached client network index (no route cap!)
  try {
    const net = await getClientNetworkIndex();
    const targetStopIds = new Set<string>();
    const mirrorName = stop.mirrorStopName || (stop.id === 'custom-mahuli' ? 'Kusumajodi' : '');

    if (mirrorName) {
      const needle = mirrorName.toLowerCase();
      for (const [sid, tuple] of Object.entries(net.stops)) {
        if (!Array.isArray(tuple) || !tuple[0]) continue;
        if (String(tuple[0]).toLowerCase() === needle) targetStopIds.add(sid);
      }
      if (targetStopIds.size === 0) {
        for (const [sid, tuple] of Object.entries(net.stops)) {
          if (!Array.isArray(tuple) || !tuple[0]) continue;
          if (String(tuple[0]).toLowerCase().includes(needle)) targetStopIds.add(sid);
        }
      }
    } else if (net.stops[stop.id]) {
      targetStopIds.add(stop.id);
    } else if (stop.name) {
      const needle = stop.name.toLowerCase();
      for (const [sid, tuple] of Object.entries(net.stops)) {
        if (!Array.isArray(tuple) || !tuple[0]) continue;
        if (replaceCuttackWithKataka(String(tuple[0])).toLowerCase() === needle) {
          targetStopIds.add(sid);
        }
      }
    }

    const outgoing: any[] = [];
    const terminatingFallback: any[] = [];
    const seenKeys = new Set<string>();

    for (const [serviceKey, v] of Object.entries(net.services)) {
      if (!Array.isArray(v) || !Array.isArray(v[6]) || v[6].length < 2) continue;
      const stopIds: string[] = v[6];
      const stopIdx = stopIds.findIndex((sid) => targetStopIds.has(String(sid)));
      if (stopIdx < 0) continue;

      const routeNumber = String(v[0] || '').trim();
      const typeName = net.types[Number(v[1])] || 'OSRTC';
      const isCity = serviceKey.startsWith('k');
      const cityName = isCity ? replaceCuttackWithKataka(String(v[2] || '')) : '';
      const originDep = String(v[3] || '');
      const origin = replaceCuttackWithKataka(String(v[4] || ''));
      const destination = replaceCuttackWithKataka(String(v[5] || ''));
      const times: string[] = Array.isArray(v[7]) ? v[7] : [];
      const departureTime = String(times[stopIdx] || (stopIdx === 0 ? originDep : '') || '--:--').trim();

      const stopPoints = stopIds
        .map((sid, idx) => {
          const st = net.stops[sid];
          if (!st) return null;
          return {
            stopId: sid,
            stopName: replaceCuttackWithKataka(st[0]),
            lat: st[1],
            lon: st[2],
            scheduledTime: String(times[idx] || '--:--'),
            sequence: idx + 1
          };
        })
        .filter(Boolean);

      if (stopPoints.length < 2) continue;

      const entry = {
        serviceKey,
        routeNumber,
        typeName,
        cityName,
        origin,
        destination,
        departureTime,
        originDepartureTime: originDep || departureTime,
        stopIndex: stopIdx,
        stops: stopPoints
      };

      const dedupeKey = `${routeNumber}|${destination}|${departureTime}`;
      if (stopIdx < stopIds.length - 1) {
        if (seenKeys.has(dedupeKey)) continue;
        seenKeys.add(dedupeKey);
        outgoing.push(entry);
      } else {
        terminatingFallback.push(entry);
      }
    }

    const finalDepartures = outgoing.length > 0 ? outgoing : terminatingFallback;
    return {
      stopId: stop.id,
      stopName: stop.name,
      resolvedStopIds: Array.from(targetStopIds),
      departures: mapRawStopDepartures(finalDepartures)
    };
  } catch {
    return null;
  }
}
