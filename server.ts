import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPSTREAM_BASE = 'https://maps.reclaim.city/osrtc/';
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

// Strictly allowlisted upstream relative paths (prevents arbitrary URL fetching / SSRF)
const STATIC_UPSTREAM_ALLOWLIST: Record<string, { ttlMs: number }> = {
  'rt/status.json': { ttlMs: 12_000 },
  'rt/vehicle_positions.json': { ttlMs: 12_000 },
  'rt/trip_updates.json': { ttlMs: 12_000 },
  'live/vehicles.json': { ttlMs: 12_000 },
  'live/routelink.json': { ttlMs: 25_000 },
  'live/net/stops.json': { ttlMs: 600_000 },
  'live/net/services.json': { ttlMs: 600_000 },
  'live/net/segs.json': { ttlMs: 600_000 },
  'city/data/stops.json': { ttlMs: 600_000 },
  'city/data/services.json': { ttlMs: 600_000 },
  'city/data/segs.json': { ttlMs: 600_000 }
};

interface CacheEntry {
  data: any;
  expiresAt: number;
}

interface IndexedSegment {
  key: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  pts: [number, number][];
  serviceKeys: string[];
}

const cache = new Map<string, CacheEntry>();
let segIndexCache: {
  expiresAt: number;
  stops: Record<string, [string, number, number]>;
  stopDegree: Map<string, number>;
  services: Record<string, any[]>;
  types: string[];
  segMap: Map<string, any[]>;
  roadSegments: IndexedSegment[];
} | null = null;

async function fetchAllowlistedJson(relativePath: string): Promise<any> {
  const rule = STATIC_UPSTREAM_ALLOWLIST[relativePath];
  if (!rule) {
    throw new Error('Disallowed upstream path');
  }

  const now = Date.now();
  const hit = cache.get(relativePath);
  if (hit && hit.expiresAt > now) {
    return hit.data;
  }

  const url = new URL(relativePath, UPSTREAM_BASE);
  if (url.origin !== 'https://maps.reclaim.city' || !url.pathname.startsWith('/osrtc/')) {
    throw new Error('Upstream origin mismatch');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    if (!res.ok) {
      throw new Error(`Upstream HTTP ${res.status}`);
    }
    const data = await res.json();
    cache.set(relativePath, { data, expiresAt: now + rule.ttlMs });
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function decodeDeltaPolylineToLatLon(flat: number[]): [number, number][] {
  const out: [number, number][] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    x += flat[i];
    y += flat[i + 1];
    // Upstream stores [lon*1e5, lat*1e5]; internal format uses [lat, lon]
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
  const kx = 104.5; // km per degree lon around 20°N Odisha
  const ky = 111.0; // km per degree lat
  const px = (pLon - aLon) * kx;
  const py = (pLat - aLat) * ky;
  const vx = (bLon - aLon) * kx;
  const vy = (bLat - aLat) * ky;
  const lenSq = vx * vx + vy * vy;
  if (lenSq < 1e-9) {
    return Math.hypot(px, py);
  }
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

async function getNetworkGeometryIndex() {
  const now = Date.now();
  if (segIndexCache && segIndexCache.expiresAt > now) {
    return segIndexCache;
  }

  const [stops, svc, segs, cstops, csvc, csegs] = await Promise.allSettled([
    fetchAllowlistedJson('live/net/stops.json'),
    fetchAllowlistedJson('live/net/services.json'),
    fetchAllowlistedJson('live/net/segs.json'),
    fetchAllowlistedJson('city/data/stops.json'),
    fetchAllowlistedJson('city/data/services.json'),
    fetchAllowlistedJson('city/data/segs.json')
  ]);

  const stopsDict: Record<string, [string, number, number]> = {
    ...(stops.status === 'fulfilled' && stops.value ? stops.value : {}),
    ...(cstops.status === 'fulfilled' && cstops.value ? cstops.value : {})
  };

  const types: string[] = [];
  const services: Record<string, any[]> = {};

  if (svc.status === 'fulfilled' && svc.value) {
    types.push(...(svc.value.types || []));
    Object.assign(services, svc.value.services || {});
  }
  const cityOffset = types.length;
  if (csvc.status === 'fulfilled' && csvc.value) {
    types.push(...(csvc.value.types || []));
    for (const [k, v] of Object.entries(csvc.value.services || {})) {
      if (Array.isArray(v)) {
        const copy = v.slice();
        copy[1] = Number(copy[1] || 0) + cityOffset;
        services[k] = copy;
      }
    }
  }

  const segMap = new Map<string, any[]>();
  const allSegs = [
    ...(segs.status === 'fulfilled' && Array.isArray(segs.value?.segs) ? segs.value.segs : []),
    ...(csegs.status === 'fulfilled' && Array.isArray(csegs.value?.segs) ? csegs.value.segs : [])
  ];
  for (const g of allSegs) {
    if (Array.isArray(g) && g.length >= 4) {
      segMap.set(`${g[0]}>${g[1]}`, g);
    }
  }

  // Count stop connectivity (degree) and map each road segment key -> list of serviceKeys using it
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

  // Build spatial index of road segments for fast "Routes on this road" click lookups
  const roadSegments: IndexedSegment[] = [];
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
        // Subsample dense polylines slightly for ultra-fast click queries while preserving road shape
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

    roadSegments.push({
      key: segKey,
      minLat,
      maxLat,
      minLon,
      maxLon,
      pts,
      serviceKeys
    });
  }

  segIndexCache = {
    expiresAt: now + 600_000,
    stops: stopsDict,
    stopDegree,
    services,
    types,
    segMap,
    roadSegments
  };
  return segIndexCache;
}

function stitchRoadPathForStopIds(
  stopIds: string[],
  stopsDict: Record<string, [string, number, number]>,
  segMap: Map<string, any[]>
): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < stopIds.length; i++) {
    const aId = stopIds[i];
    const bId = stopIds[i + 1];
    const A = stopsDict[aId];
    const B = stopsDict[bId];
    if (!A || !B) continue;
    const pa: [number, number] = [A[1], A[2]];
    const pb: [number, number] = [B[1], B[2]];
    const g = segMap.get(`${aId}>${bId}`);
    let coords: [number, number][] = [pa, pb];
    if (g && Array.isArray(g[3])) {
      const decoded = decodeDeltaPolylineToLatLon(g[3]);
      if (decoded.length > 1 && approxKm(decoded[0], pa) < 3 && approxKm(decoded[decoded.length - 1], pb) < 3) {
        coords = decoded;
      }
    }
    if (out.length > 0) {
      out.push(...coords.slice(1));
    } else {
      out.push(...coords);
    }
  }
  return out;
}

async function createServer() {
  const app = express();
  app.disable('x-powered-by');

  // 0. Allowlisted static-hosting-compatible proxy (/osrtc-proxy/* matches Netlify _redirects)
  app.get('/osrtc-proxy/*', async (req, res) => {
    const rawSplat = String((req.params as any)[0] || '').replace(/^\/+/, '');
    const isAllowedStatic = Boolean(STATIC_UPSTREAM_ALLOWLIST[rawSplat]);
    const isAllowedTrip = /^live\/trip\/[a-zA-Z0-9_-]{1,32}\.json$/.test(rawSplat);
    if (!isAllowedStatic && !isAllowedTrip) {
      res.status(400).json({ error: 'Disallowed proxy path' });
      return;
    }
    try {
      if (isAllowedStatic) {
        const data = await fetchAllowlistedJson(rawSplat);
        res.setHeader(
          'Cache-Control',
          rawSplat.startsWith('live/net/') || rawSplat.startsWith('city/data/')
            ? 'public, max-age=600'
            : 'no-store'
        );
        res.json(data);
        return;
      }
      const tripUrl = new URL(rawSplat, UPSTREAM_BASE);
      if (
        tripUrl.origin !== 'https://maps.reclaim.city' ||
        !tripUrl.pathname.startsWith('/osrtc/live/trip/')
      ) {
        res.status(400).json({ error: 'Invalid proxy path' });
        return;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const upstreamRes = await fetch(tripUrl.toString(), {
          headers: { Accept: 'application/json' },
          signal: controller.signal
        });
        if (!upstreamRes.ok) {
          res.status(upstreamRes.status).json({ error: 'Upstream trip not found' });
          return;
        }
        const data = await upstreamRes.json();
        res.setHeader('Cache-Control', 'no-store');
        res.json(data);
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      res.status(502).json({ error: 'Upstream proxy failed' });
    }
  });

  // 1. Live combined Odisha bus snapshot (vehicles + routelink + GTFS-RT status + trip_updates)
  app.get('/api/osrtc/live', async (_req, res) => {
    try {
      const [status, vehiclePositions, tripUpdates, liveVehicles, routeLink] = await Promise.allSettled([
        fetchAllowlistedJson('rt/status.json'),
        fetchAllowlistedJson('rt/vehicle_positions.json'),
        fetchAllowlistedJson('rt/trip_updates.json'),
        fetchAllowlistedJson('live/vehicles.json'),
        fetchAllowlistedJson('live/routelink.json')
      ]);

      res.setHeader('Cache-Control', 'no-store');
      res.json({
        status: status.status === 'fulfilled' ? status.value : null,
        vehiclePositions: vehiclePositions.status === 'fulfilled' ? vehiclePositions.value : null,
        tripUpdates: tripUpdates.status === 'fulfilled' ? tripUpdates.value : null,
        liveVehicles: liveVehicles.status === 'fulfilled' ? liveVehicles.value : null,
        routeLink: routeLink.status === 'fulfilled' ? routeLink.value : null
      });
    } catch {
      res.status(502).json({ error: 'Unable to sync live Odisha bus feeds' });
    }
  });

  // 2. Per-vehicle live trip stops + exact road-snapped polyline
  app.get('/api/osrtc/trip/:id', async (req, res) => {
    const rawId = String(req.params.id || '').trim();
    if (!/^[a-zA-Z0-9_-]{1,24}$/.test(rawId)) {
      res.status(400).json({ error: 'Invalid vehicle id' });
      return;
    }

    try {
      const tripUrl = new URL(`live/trip/${encodeURIComponent(rawId)}.json`, UPSTREAM_BASE);
      if (tripUrl.origin !== 'https://maps.reclaim.city' || !tripUrl.pathname.startsWith('/osrtc/live/trip/')) {
        res.status(400).json({ error: 'Invalid upstream path' });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      let tripJson: any = null;
      try {
        const upstreamRes = await fetch(tripUrl.toString(), {
          headers: { Accept: 'application/json' },
          signal: controller.signal
        });
        if (upstreamRes.ok) {
          tripJson = await upstreamRes.json();
        }
      } finally {
        clearTimeout(timeout);
      }

      if (!tripJson || !Array.isArray(tripJson.stops)) {
        res.setHeader('Cache-Control', 'no-store');
        res.json({ trip: null, roadPath: [], available: false });
        return;
      }

      // Stitch exact road-snapped geometry from segs.json if service rid is available
      let roadPath: [number, number][] = [];
      try {
        const net = await getNetworkGeometryIndex();
        const rid = String(tripJson.rid || '');
        const svc = rid ? net.services[rid] : null;
        if (svc && Array.isArray(svc[6]) && svc[6].length >= 2) {
          roadPath = stitchRoadPathForStopIds(svc[6], net.stops, net.segMap);
        }
      } catch {
        // Fallback to stop coordinates if geometry index fails
      }

      res.setHeader('Cache-Control', 'no-store');
      res.json({
        trip: tripJson,
        roadPath
      });
    } catch {
      res.status(502).json({ error: 'Failed to load live bus trip' });
    }
  });

  // 3. Road-snapped route path lookup by serviceKey or routeNumber
  app.get('/api/osrtc/route-path/:key', async (req, res) => {
    const rawKey = String(req.params.key || '').trim();
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(rawKey)) {
      res.status(400).json({ error: 'Invalid route key' });
      return;
    }
    try {
      const net = await getNetworkGeometryIndex();
      let svc = net.services[rawKey];
      if (!svc) {
        for (const v of Object.values(net.services)) {
          if (Array.isArray(v) && String(v[0] || '').toUpperCase() === rawKey.toUpperCase()) {
            svc = v;
            break;
          }
        }
      }
      if (!svc || !Array.isArray(svc[6])) {
        res.status(404).json({ error: 'Route geometry not found' });
        return;
      }
      const roadPath = stitchRoadPathForStopIds(svc[6], net.stops, net.segMap);
      res.json({
        routeNumber: svc[0],
        from: svc[4],
        to: svc[5],
        roadPath
      });
    } catch {
      res.status(502).json({ error: 'Failed to decode route geometry' });
    }
  });

  // 4. Click-on-road lookup: returns real Odisha bus routes passing along the clicked road
  app.get('/api/osrtc/routes-on-road', async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 17 || lat > 23.5 || lon < 81 || lon > 88) {
      res.status(400).json({ error: 'Valid Odisha coordinates required' });
      return;
    }

    try {
      const net = await getNetworkGeometryIndex();
      // Tight road-hugging radii so clicking a road returns ALL routes running on THAT road
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
              if (prev === undefined || d < prev) {
                matchedServiceDist.set(sk, d);
              }
            }
          }
        }
        if (matchedServiceDist.size >= 1) break;
      }

      const ranked = Array.from(matchedServiceDist.entries()).sort((a, b) => a[1] - b[1]);
      const seen = new Set<string>();
      const routes: any[] = [];

      for (const [serviceKey, distKm] of ranked) {
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

        routes.push({
          serviceKey,
          routeNumber,
          typeName,
          cityName,
          departure: dep,
          origin,
          destination,
          distanceFromRoadKm: Number(distKm.toFixed(2)),
          stops: stopPoints
        });

        if (routes.length >= 150) break;
      }

      // Find nearest station name as fallback road context
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

      res.json({
        lat,
        lon,
        nearestStopName: nearestDist < 15 ? nearestStopName : '',
        routes
      });
    } catch {
      res.status(502).json({ error: 'Unable to find routes on this road' });
    }
  });

  // 5. Real Odisha network directory (ALL stations + intercity & city Ama Bus/OSRTC/SJE/MBS routes)
  app.get('/api/osrtc/network', async (_req, res) => {
    try {
      const net = await getNetworkGeometryIndex();
      const stopsList: {
        id: string;
        name: string;
        lat: number;
        lon: number;
        isCity: boolean;
        degree: number;
      }[] = [];

      for (const [id, tuple] of Object.entries(net.stops)) {
        if (!Array.isArray(tuple) || tuple.length < 3) continue;
        const [name, lat, lon] = tuple;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        // Strictly keep Odisha bounds
        if (lat < 17.4 || lat > 22.9 || lon < 81.1 || lon > 87.7) continue;
        stopsList.push({
          id,
          name,
          lat,
          lon,
          isCity: id.startsWith('k'),
          degree: net.stopDegree.get(id) || 1
        });
      }

      // Include Mahuli bus stop matching Kusumajodi's degree so it renders identically to other stops
      if (!stopsList.some((s) => s.id === 'custom-mahuli')) {
        const kusumajodi = stopsList.find((s) => s.name.toLowerCase().includes('kusumajodi'));
        stopsList.push({
          id: 'custom-mahuli',
          name: 'Mahuli',
          lat: 20.833643,
          lon: 85.530248,
          isCity: false,
          degree: kusumajodi ? kusumajodi.degree : 6
        });
      }

      // Sort major high-degree hubs first so terminal stations always prioritize cleanly
      stopsList.sort((a, b) => b.degree - a.degree);

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

        if (isCity) {
          if (cityRoutes.length < 400) cityRoutes.push(routeObj);
        } else {
          if (intercityRoutes.length < 800) intercityRoutes.push(routeObj);
        }
      }

      const routesList = [...cityRoutes, ...intercityRoutes];

      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json({
        stops: stopsList,
        routes: routesList
      });
    } catch {
      res.status(502).json({ error: 'Unable to load Odisha network index' });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.resolve(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Odisha Bus server listening on http://localhost:${PORT}`);
  });
}

createServer();
