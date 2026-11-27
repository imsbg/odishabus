import { SEED_LIVE_BUSES, SEED_ROUTES, SEED_STATUS, SEED_STOPS } from './odishaSeedData';
import {
  BusEstimatedPosition,
  BusRoute,
  BusStop,
  DirectJourneyMatch,
  FeedStatus,
  FleetCategory,
  FleetFilter,
  HistoryEntry,
  LiveBus,
  MapViewportBounds,
  RouteStopTiming,
  StopPassState
} from './transitTypes';

/**
 * Classifies a bus or route into one of the 6 Odisha transit fleets or Standby:
 * Shree Jagannath Express, OSRTC, Mukhyamantri Bus Seva, Ama Bus, Ama Bus AC, Mo Bus, Standby.
 */
export function classifyFleetCategory(
  rawType?: string | null,
  routeNumber?: string | null,
  vehicleIdOrReg?: string | null
): FleetCategory {
  const t = String(rawType || '').toUpperCase().trim();
  const r = String(routeNumber || '').toUpperCase().trim();
  const v = String(vehicleIdOrReg || '').toUpperCase().trim();

  if (t.includes('MO BUS') || r.startsWith('MOBUS_') || r === '13E' || r === '10' || r === '20') {
    return 'Mo Bus';
  }
  if (t.includes('AMA BUS AC') || r.includes('-AC')) {
    return 'Ama Bus AC';
  }
  if (t.includes('AMA BUS') || v.startsWith('C')) {
    return 'Ama Bus';
  }
  if (t.includes('JAGANNATH') || r.startsWith('JE_') || r.startsWith('SJE')) {
    return 'Shree Jagannath Express';
  }
  if (t.includes('MUKHYAMANTRI') || t.includes('BUS SEVA') || t.includes('LACCMI')) {
    return 'Mukhyamantri Bus Seva';
  }
  if (t.includes('EXPRESS') || t.includes('OSRTC')) {
    return 'OSRTC';
  }
  if (t.includes('STANDBY') || t.includes('NOT YET SEEN')) {
    return 'Standby';
  }

  // Fallback heuristics by route prefix only when a route number actually exists
  if (r && r !== 'STANDBY') {
    if (/^(BSR|CTC|BRP|ROU|SBP|JYP|KPT|BLS|BHC|PBN|ANG|KOJ|VIZ|BPD)\d{4}/i.test(r)) {
      return 'OSRTC';
    }
    if (/^[A-Z]{3}\d{4}/i.test(r)) {
      return 'Mukhyamantri Bus Seva';
    }
    if (/^\d{1,3}[A-Z]?$/.test(r)) {
      return 'Ama Bus';
    }
  }

  // Vehicles with no assigned service type and no route are not yet seen on a trip
  return 'Standby';
}

/**
 * Replaces any occurrence of "Cuttack" with "Kataka" while preserving casing
 * (CUTTACK -> KATAKA, cuttack -> kataka, Cuttack -> Kataka).
 */
export function replaceCuttackWithKataka(text: string): string {
  if (!text) return '';
  return text.replace(/cuttack/gi, (match) => {
    if (match === match.toUpperCase()) return 'KATAKA';
    if (match === match.toLowerCase()) return 'kataka';
    return 'Kataka';
  });
}

export function formatTitleCase(str: string): string {
  if (!str) return '';
  const formatted = str
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (/^(\[BSABT\]|BSABT|CNBT|OSRTC|CRUT|AIIMS|KIIT|SCB|VIMSAR|VSSUT|KM|DKL|\(AP\)|\(K\))$/i.test(word)) {
        return word.toUpperCase();
      }
      // Preserve parenthetical suffixes like Bauran(K)
      const parenMatch = /^([a-zA-Z]+)\(([a-zA-Z]+)\)$/.exec(word);
      if (parenMatch) {
        const base = parenMatch[1].charAt(0).toUpperCase() + parenMatch[1].slice(1).toLowerCase();
        return `${base}(${parenMatch[2].toUpperCase()})`;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
  return replaceCuttackWithKataka(formatted);
}

export function calculateExactDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return Math.max(1, Math.round(calculateExactDistanceKm(lat1, lon1, lat2, lon2)));
}

/**
 * Computes real vehicle speed (km/h) from either GPS speed or delta between
 * current fix (lat, lon, t) and previous fix (plat, plon, pt) in live/vehicles.json.
 */
export function calculateVehicleSpeed(params: {
  rawSpeedKmh?: number;
  lat: number;
  lon: number;
  t: number;
  plat?: number;
  plon?: number;
  pt?: number;
}): { speedKmh: number; speedSource: 'gps' | 'calculated' | 'idle' } {
  const { rawSpeedKmh = 0, lat, lon, t, plat, plon, pt } = params;
  if (Number.isFinite(rawSpeedKmh) && rawSpeedKmh > 0.5) {
    return { speedKmh: Math.min(115, Math.round(rawSpeedKmh)), speedSource: 'gps' };
  }
  if (
    Number.isFinite(plat) &&
    Number.isFinite(plon) &&
    Number.isFinite(pt) &&
    plat !== undefined &&
    plon !== undefined &&
    pt !== undefined
  ) {
    const dtSec = t - pt;
    if (dtSec >= 10 && dtSec <= 3600) {
      const distKm = calculateExactDistanceKm(plat, plon, lat, lon);
      const kmh = (distKm / dtSec) * 3600;
      if (kmh >= 1 && kmh <= 115) {
        return { speedKmh: Math.round(kmh), speedSource: 'calculated' };
      }
    }
  }
  return { speedKmh: 0, speedSource: 'idle' };
}

export function formatGpsAge(timestampSec: number, referenceSec: number): string {
  if (!Number.isFinite(timestampSec) || timestampSec <= 0) return 'Live GPS';
  const ref = Number.isFinite(referenceSec) && referenceSec > 0 ? referenceSec : Math.floor(Date.now() / 1000);
  const diffSec = Math.max(0, Math.round(ref - timestampSec));
  if (diffSec < 60) return 'GPS just now';
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `GPS ${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `GPS ${hrs}h ${remMins}m ago` : `GPS ${hrs}h ago`;
}

export function estimateFareInr(fleet: FleetCategory, distanceKm: number): number {
  const d = Math.max(2, distanceKm);
  switch (fleet) {
    case 'Shree Jagannath Express':
      return Math.round(25 + d * 1.85);
    case 'OSRTC':
      return Math.round(15 + d * 1.15);
    case 'Mukhyamantri Bus Seva':
      return Math.round(10 + d * 0.85);
    case 'Ama Bus AC':
      return Math.min(70, Math.max(10, Math.round(10 + d * 1.4)));
    case 'Ama Bus':
    case 'Mo Bus':
      return Math.min(50, Math.max(5, Math.round(5 + d * 1.0)));
    default:
      return Math.round(12 + d * 1.1);
  }
}

export function filterLiveBuses(
  buses: LiveBus[],
  options: {
    fleet: FleetFilter;
    query: string;
    onTripOnly: boolean;
  }
): LiveBus[] {
  const q = options.query.trim().toLowerCase().replace(/cuttack/g, 'kataka');
  const qNorm = q.replace(/[^a-z0-9]/g, '');

  return buses.filter((bus) => {
    if (options.fleet !== 'ALL' && bus.fleet !== options.fleet) {
      return false;
    }
    // If user actively searches a specific bus number (like "9130"), show it even if off-route/between trips!
    if (options.onTripOnly && !q && !bus.isOnTrip && options.fleet !== 'Standby') {
      return false;
    }
    if (!q) return true;

    const regNorm = bus.registrationNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
    const routeNorm = bus.routeNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
    const hay = `${bus.registrationNumber} ${bus.routeNumber} ${bus.routeName} ${bus.origin} ${bus.destination} ${bus.fleet} ${bus.nextStopName} ${bus.lastStopName} ${bus.depot}`.toLowerCase();
    const stopsMatch = bus.tripStops?.some((s) => s.stopName.toLowerCase().includes(q));

    return (
      (qNorm.length > 0 && (regNorm.includes(qNorm) || routeNorm.includes(qNorm))) ||
      hay.includes(q) ||
      Boolean(stopsMatch)
    );
  });
}

/**
 * Filters buses to those currently inside the visible map viewport bounds.
 */
export function filterBusesByMapBounds(
  buses: LiveBus[],
  bounds: MapViewportBounds | null
): LiveBus[] {
  if (!bounds) return buses;
  return buses.filter(
    (b) =>
      b.lat >= bounds.south &&
      b.lat <= bounds.north &&
      b.lon >= bounds.west &&
      b.lon <= bounds.east
  );
}

/**
 * Returns true when a bus has arrived at the end of its trip, or is parked/resting between duties.
 */
export function isBusSleeping(bus: LiveBus): boolean {
  if (!bus.isOnTrip || bus.fleet === 'Standby' || bus.routeNumber === 'OFF DUTY') {
    return true;
  }
  const stops = bus.tripStops || [];
  if (stops.length > 0) {
    const allFinished = stops.every((s) => s.status === 'passed' || s.status === 'skipped');
    if (allFinished) return true;

    const lastStop = stops[stops.length - 1];
    if (
      bus.speedKmh === 0 &&
      lastStop &&
      Number.isFinite(lastStop.lat) &&
      Number.isFinite(lastStop.lon)
    ) {
      const distToEndKm = calculateExactDistanceKm(bus.lat, bus.lon, lastStop.lat, lastStop.lon);
      if (distToEndKm <= 0.35) {
        return true;
      }
    }
  }
  return false;
}

export function filterRoutes(
  routes: BusRoute[],
  options: {
    fleet: FleetFilter;
    query: string;
  }
): BusRoute[] {
  const q = options.query.trim().toLowerCase().replace(/cuttack/g, 'kataka');
  return routes.filter((route) => {
    if (options.fleet !== 'ALL' && route.fleet !== options.fleet) {
      return false;
    }
    if (!q) return true;
    const hay = `${route.routeNumber} ${route.name} ${route.origin} ${route.destination} ${route.corridor} ${route.fleet}`.toLowerCase();
    const stopMatch = route.stops.some((s) => s.stopName.toLowerCase().includes(q));
    return hay.includes(q) || stopMatch;
  });
}

export function searchStops(stops: BusStop[], query: string): BusStop[] {
  const q = query.trim().toLowerCase().replace(/cuttack/g, 'kataka');
  if (!q) return stops;
  const matched = stops.filter((stop) => {
    const hay = `${stop.name} ${stop.district} ${stop.code || ''}`.toLowerCase();
    return hay.includes(q);
  });
  return matched.sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const aExact = aName === q ? 0 : aName.startsWith(q) ? 1 : 2;
    const bExact = bName === q ? 0 : bName.startsWith(q) ? 1 : 2;
    if (aExact !== bExact) return aExact - bExact;
    return aName.length - bName.length;
  });
}

function normalizeTripPlannerStopQuery(raw: string): string {
  const q = raw.trim().toLowerCase().replace(/cuttack/g, 'kataka');
  if (q === 'mahuli') return 'kusumajodi';
  return q;
}

export function findDirectJourneys(
  routes: BusRoute[],
  buses: LiveBus[],
  fromQuery: string,
  toQuery: string,
  fleetFilter: FleetFilter = 'ALL'
): DirectJourneyMatch[] {
  const f = normalizeTripPlannerStopQuery(fromQuery);
  const t = normalizeTripPlannerStopQuery(toQuery);
  if (!f || !t || f === t) return [];

  const matches: DirectJourneyMatch[] = [];

  for (const route of routes) {
    if (fleetFilter !== 'ALL' && route.fleet !== fleetFilter) continue;

    let fromIndex = -1;
    let toIndex = -1;

    for (let i = 0; i < route.stops.length; i++) {
      const sName = route.stops[i].stopName.toLowerCase();
      if (fromIndex === -1 && sName.includes(f)) {
        fromIndex = i;
      }
      if (fromIndex !== -1 && i > fromIndex && sName.includes(t)) {
        toIndex = i;
        break;
      }
    }

    if (fromIndex !== -1 && toIndex !== -1 && toIndex > fromIndex) {
      const fromStop = route.stops[fromIndex];
      const toStop = route.stops[toIndex];
      const stopsCount = toIndex - fromIndex;
      const distKm = calculateDistanceKm(fromStop.lat, fromStop.lon, toStop.lat, toStop.lon);
      const estimatedMinutes = Math.max(12, Math.round(distKm * 1.45));
      const estimatedFareInr = estimateFareInr(route.fleet, distKm);
      const activeBusesOnRoute = buses.filter(
        (b) => b.routeNumber === route.routeNumber || b.routeId === route.id
      );

      matches.push({
        route,
        fromStop,
        toStop,
        stopsCount,
        estimatedMinutes,
        estimatedFareInr,
        activeBusesOnRoute
      });
    }
  }

  return matches;
}

/**
 * Converts 24-hour clock strings like "15:06", "07:30", "00:15", or "13:30:34"
 * into clean 12-hour AM/PM strings ("3:06 PM", "7:30 AM", "12:15 AM", "1:30 PM").
 */
export function formatTime12Hour(raw?: string | null): string {
  if (!raw) return '--:--';
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === '--:--') return '--:--';
  // Already formatted with AM/PM
  if (/\b(am|pm)\b/i.test(trimmed)) {
    return trimmed.replace(/\b(am|pm)\b/i, (m) => m.toUpperCase());
  }
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return trimmed;
  let hours = Number(match[1]);
  const minutes = match[2];
  if (!Number.isFinite(hours) || hours < 0 || hours > 23) return trimmed;
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${meridiem}`;
}

export function pointToSegmentDistanceKm(
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
  if (lenSq < 1e-9) {
    return Math.hypot(px, py);
  }
  const t = Math.max(0, Math.min(1, (px * vx + py * vy) / lenSq));
  return Math.hypot(px - t * vx, py - t * vy);
}

export function findRoutesNearRoadPoint(
  routes: BusRoute[],
  lat: number,
  lon: number,
  maxDistanceKm = 2.5
): BusRoute[] {
  const scored: { route: BusRoute; dist: number }[] = [];
  for (const route of routes) {
    const pts =
      route.path && route.path.length >= 2
        ? route.path
        : route.stops.map((s) => [s.lat, s.lon] as [number, number]);
    if (pts.length < 2) continue;

    let minD = Infinity;
    for (let i = 0; i + 1 < pts.length; i++) {
      const d = pointToSegmentDistanceKm(lat, lon, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      if (d < minD) minD = d;
    }
    if (minD <= maxDistanceKm) {
      scored.push({ route, dist: minD });
    }
  }
  scored.sort((a, b) => a.dist - b.dist);
  return scored.map((s) => s.route);
}

export function addHistoryEntry(
  entries: HistoryEntry[],
  next: Omit<HistoryEntry, 'timestamp'>,
  maxItems = 8
): HistoryEntry[] {
  const filtered = entries.filter((e) => !(e.kind === next.kind && e.id === next.id));
  return [{ ...next, timestamp: Date.now() }, ...filtered].slice(0, maxItems);
}

export function formatUnixClock(tsSec: number | string | undefined): string {
  if (!tsSec) return '';
  const n = Number(tsSec);
  if (!Number.isFinite(n) || n <= 0) return '';
  const d = new Date(n * 1000);
  return d
    .toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    })
    .toUpperCase();
}

/**
 * Decodes OSRTC GTFS-RT stopId format `n<name><5-digit-lat><5-digit-lon>`
 * e.g. "nbahanaga2134086760" -> { name: "Bahanaga", lat: 21.34, lon: 86.76 }
 */
export function decodeGtfsStopId(
  stopId: string,
  fallbackLat: number,
  fallbackLon: number
): { name: string; lat: number; lon: number } {
  const match = /^n([a-z0-9]+?)(\d{5})(\d{5})$/i.exec(stopId.trim());
  if (match) {
    const rawSlug = match[1]
      .replace(/(bypass|chhaka|chhak|osrtc|bsabt|block|stand|square|temple|junction|road|dkl)$/i, ' $1')
      .trim();
    const lat = Number(match[2]) / 1000;
    const lon = Number(match[3]) / 1000;
    if (lat >= 17.0 && lat <= 23.5 && lon >= 81.0 && lon <= 88.0) {
      return {
        name: formatTitleCase(rawSlug),
        lat,
        lon
      };
    }
  }
  const cleanName = stopId.replace(/^n/, '').replace(/\d+$/, '') || stopId;
  return {
    name: formatTitleCase(cleanName),
    lat: fallbackLat,
    lon: fallbackLon
  };
}

/**
 * Parses and merges the real-time Odisha feeds:
 * - live/vehicles.json (with real fleet type + plat/plon/pt for calculated speed)
 * - live/routelink.json (real route assignment + origin/destination + fleet type)
 * - rt/vehicle_positions.json, rt/trip_updates.json, rt/status.json
 */
export function parseGtfsRealtimePayload(
  vehiclePositionsJson: any,
  tripUpdatesJson: any,
  statusJson: any,
  liveVehiclesJson?: any,
  routeLinkJson?: Record<string, any[]>,
  stopsDict?: Record<string, [string, number, number]>
): { buses: LiveBus[]; status: FeedStatus } {
  const feedTime = Number(
    liveVehiclesJson?.t ||
      statusJson?.feed_time ||
      vehiclePositionsJson?.header?.timestamp ||
      SEED_STATUS.feedTime
  );

  const status: FeedStatus = {
    network: statusJson?.network || SEED_STATUS.network,
    feedTime,
    written: Number(statusJson?.written || feedTime),
    vehicles: Number(
      liveVehiclesJson?.buses?.length ||
        statusJson?.vehicles ||
        vehiclePositionsJson?.entity?.length ||
        SEED_STATUS.vehicles
    ),
    onTrip: Number(statusJson?.on_trip || SEED_STATUS.onTrip),
    onRoute: Number(statusJson?.on_route || SEED_STATUS.onRoute),
    tripUpdates: Number(statusJson?.trip_updates || SEED_STATUS.tripUpdates),
    lastSyncedIso: new Date()
      .toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
      .toUpperCase(),
    sourceMode: liveVehiclesJson?.buses || vehiclePositionsJson?.entity ? 'live-gtfs' : 'hybrid-fallback'
  };

  // Index trip_updates.json by vehicle id
  const tripUpdatesByVeh = new Map<string, any>();
  if (Array.isArray(tripUpdatesJson?.entity)) {
    for (const ent of tripUpdatesJson.entity) {
      const tu = ent?.tripUpdate;
      if (!tu) continue;
      const vid = String(tu?.vehicle?.id || '');
      if (vid) tripUpdatesByVeh.set(vid, tu);
    }
  }

  // Index live/vehicles.json by vehicle id (gives exact fleet type, depot, oprs, plat, plon, pt!)
  interface EnrichedRow {
    id: string;
    veh: string;
    lat: number;
    lon: number;
    brg: number;
    spd: number;
    t: number;
    type: string;
    depot: string;
    oprs: string;
    plat: number;
    plon: number;
    pt: number;
  }

  const liveRowsById = new Map<string, EnrichedRow>();
  if (Array.isArray(liveVehiclesJson?.buses) && Array.isArray(liveVehiclesJson?.cols)) {
    const cols: string[] = liveVehiclesJson.cols;
    const iId = cols.indexOf('id');
    const iVeh = cols.indexOf('veh');
    const iLat = cols.indexOf('lat');
    const iLon = cols.indexOf('lon');
    const iBrg = cols.indexOf('brg');
    const iSpd = cols.indexOf('spd');
    const iT = cols.indexOf('t');
    const iType = cols.indexOf('type');
    const iDepot = cols.indexOf('depot');
    const iOprs = cols.indexOf('oprs');
    const iPlat = cols.indexOf('plat');
    const iPlon = cols.indexOf('plon');
    const iPt = cols.indexOf('pt');

    for (const row of liveVehiclesJson.buses) {
      const id = String(row[iId]);
      liveRowsById.set(id, {
        id,
        veh: String(row[iVeh] || id).toUpperCase(),
        lat: Number(row[iLat]),
        lon: Number(row[iLon]),
        brg: Number(row[iBrg] || 0),
        spd: Number(row[iSpd] || 0),
        t: Number(row[iT] || feedTime),
        type: String(row[iType] || ''),
        depot: String(row[iDepot] || ''),
        oprs: String(row[iOprs] || ''),
        plat: Number(row[iPlat]),
        plon: Number(row[iPlon]),
        pt: Number(row[iPt])
      });
    }
  }

  // Also index GTFS-RT vehicle_positions.json by id
  const vpById = new Map<string, any>();
  if (Array.isArray(vehiclePositionsJson?.entity)) {
    for (const ent of vehiclePositionsJson.entity) {
      const v = ent?.vehicle;
      if (!v?.position) continue;
      const id = String(v?.vehicle?.id || ent.id || '');
      if (id) vpById.set(id, v);
    }
  }

  const allVehicleIds = new Set<string>([...liveRowsById.keys(), ...vpById.keys()]);
  const parsedBuses = new Map<string, LiveBus>();
  let activeTripCount = 0;

  for (const id of allVehicleIds) {
    const lv = liveRowsById.get(id);
    const vp = vpById.get(id);
    const lat = lv ? lv.lat : Number(vp?.position?.latitude);
    const lon = lv ? lv.lon : Number(vp?.position?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    // Filter strictly to Odisha bounding region
    if (lat < 17.4 || lat > 22.9 || lon < 81.1 || lon > 87.7) continue;

    const reg = (lv?.veh || String(vp?.vehicle?.label || vp?.vehicle?.licensePlate || id)).toUpperCase();
    const bearing = lv ? lv.brg : Number(vp?.position?.bearing || 0);
    const timestamp = lv ? lv.t : Number(vp?.timestamp || feedTime);

    const rlink = routeLinkJson?.[id]; // [routeNum, serviceKey, depot, fromName, toName, fleetType]
    const tu = tripUpdatesByVeh.get(id);

    const routeNumber = String(
      rlink?.[0] || lv?.oprs || vp?.trip?.routeId || tu?.trip?.routeId || ''
    ).trim();
    const serviceKey = rlink?.[1] ? String(rlink[1]) : undefined;
    const rawFleetType = rlink?.[5] || lv?.type || '';
    const fleet = classifyFleetCategory(rawFleetType, routeNumber, id.startsWith('c') ? id : reg);

    // Build stop timings from real trip_updates.json if available
    let tripStops: RouteStopTiming[] = [];
    if (Array.isArray(tu?.stopTimeUpdate) && tu.stopTimeUpdate.length > 0) {
      tripStops = tu.stopTimeUpdate.map((stu: any, idx: number) => {
        const stopId = String(stu.stopId || `stop-${idx}`);
        const stopTuple = stopsDict?.[stopId];
        const decoded = decodeGtfsStopId(stopId, lat, lon);
        const stopName = stopTuple?.[0] ? formatTitleCase(stopTuple[0]) : decoded.name;
        const sLat = stopTuple?.[1] || decoded.lat;
        const sLon = stopTuple?.[2] || decoded.lon;
        const arrTime = formatUnixClock(stu?.arrival?.time || stu?.departure?.time);
        return {
          stopId,
          stopName,
          lat: sLat,
          lon: sLon,
          scheduledTime: arrTime || '--:--',
          estimatedTime: arrTime || '--:--',
          status: (idx === 0 ? 'current' : 'upcoming') as StopPassState,
          sequence: Number(stu.stopSequence || idx + 1)
        };
      });
    }

    const firstStopName = tripStops[0]?.stopName;
    const lastStopNameInTrip = tripStops[tripStops.length - 1]?.stopName;

    const origin = rlink?.[3] ? formatTitleCase(rlink[3]) : firstStopName || '';
    const destination = rlink?.[4] ? formatTitleCase(rlink[4]) : lastStopNameInTrip || '';

    const routeName =
      origin && destination && origin !== destination
        ? `${origin} → ${destination}`
        : routeNumber
        ? `Route ${routeNumber}${destination ? ` · ${destination}` : ''}`
        : `${fleet === 'Standby' ? 'Not currently on a trip' : `${fleet} (between trips)`}`;

    const isOnTrip = Boolean(routeNumber || tu || rlink);
    if (isOnTrip) activeTripCount++;

    const nextStop =
      tripStops.find((s) => s.status === 'current' || s.status === 'upcoming') ||
      tripStops[tripStops.length - 1];
    const passedStops = tripStops.filter((s) => s.status === 'passed');
    const lastStop = passedStops[passedStops.length - 1];

    const rawSpeedKmh =
      lv && lv.spd > 0
        ? lv.spd
        : vp?.position?.speed && Number(vp.position.speed) > 0
        ? Number(vp.position.speed) * 3.6
        : 0;

    const { speedKmh, speedSource } = calculateVehicleSpeed({
      rawSpeedKmh,
      lat,
      lon,
      t: timestamp,
      plat: lv?.plat,
      plon: lv?.plon,
      pt: lv?.pt
    });

    const gpsAgeLabel = formatGpsAge(timestamp, feedTime);

    parsedBuses.set(reg, {
      id,
      registrationNumber: reg,
      fleet,
      routeId: routeNumber || id,
      serviceKey,
      routeNumber: routeNumber || 'OFF DUTY',
      routeName,
      origin: origin || 'Odisha Depot',
      destination: destination || 'District Terminal',
      lat,
      lon,
      bearing,
      speedKmh,
      speedSource,
      gpsAgeLabel,
      timestamp,
      depot: replaceCuttackWithKataka(rlink?.[2] || lv?.depot || 'Odisha Transit'),
      isOnTrip,
      lastStopName: lastStop?.stopName || origin || 'Depot',
      nextStopName: nextStop?.stopName || destination || 'Standby',
      nextStopEta: nextStop?.estimatedTime || nextStop?.scheduledTime || '--:--',
      tripStops,
      path:
        tripStops.length > 1
          ? [[lat, lon] as [number, number], ...tripStops.map((s) => [s.lat, s.lon] as [number, number])]
          : undefined
    });
  }

  // Update accurate live counts strictly from real feed data
  status.vehicles = parsedBuses.size;
  status.onTrip = activeTripCount || Number(statusJson?.on_trip || 0);

  const allBuses = Array.from(parsedBuses.values()).sort((a, b) => {
    if (a.isOnTrip !== b.isOnTrip) return a.isOnTrip ? -1 : 1;
    if (a.tripStops.length !== b.tripStops.length) return b.tripStops.length - a.tripStops.length;
    if (a.speedKmh !== b.speedKmh) return b.speedKmh - a.speedKmh;
    return a.registrationNumber.localeCompare(b.registrationNumber);
  });

  return {
    buses: allBuses,
    status
  };
}

/**
 * Enriches a single LiveBus with the per-vehicle live trip detail JSON from:
 * /api/osrtc/trip/:id (which proxies live/trip/:id.json + stitches exact roadPath from segs.json)
 */
export function parseLiveTripDetail(
  bus: LiveBus,
  tripDetailJson: any,
  roadPath?: [number, number][]
): LiveBus {
  if (!tripDetailJson || !Array.isArray(tripDetailJson.stops) || !Array.isArray(tripDetailJson.cols)) {
    return bus;
  }

  const cols: string[] = tripDetailJson.cols;
  const idxName = cols.indexOf('name');
  const idxLat = cols.indexOf('lat');
  const idxLon = cols.indexOf('lon');
  const idxTime = cols.indexOf('time');
  const idxState = cols.indexOf('state');

  const validRows = tripDetailJson.stops.filter(
    (r: any[]) => Number.isFinite(Number(r[idxLat])) && Number.isFinite(Number(r[idxLon]))
  );
  if (validRows.length === 0) return bus;

  // State in OSRTC stopstatus: 0 = passed (actual time), 2 = skipped, 1 = next approaching, -1 = upcoming
  let lastPassedIdx = -1;
  if (idxState >= 0) {
    validRows.forEach((row: any[], i: number) => {
      const s = Number(row[idxState]);
      if (s === 0 || s === 2) lastPassedIdx = i;
    });
  }

  const stops: RouteStopTiming[] = validRows.map((row: any[], i: number) => {
    const rawState = idxState >= 0 ? Number(row[idxState]) : -1;
    let status: StopPassState = 'upcoming';
    if (rawState === 0) status = 'passed';
    else if (rawState === 1) status = 'current';
    else if (rawState === 2) status = 'skipped';
    else if (i <= lastPassedIdx) status = 'passed';
    else if (i === lastPassedIdx + 1) status = 'current';

    const timeStr = String(row[idxTime] || '--:--').trim() || '--:--';
    return {
      stopId: `trip-${bus.id}-${i}`,
      stopName: formatTitleCase(String(row[idxName] || `Stop ${i + 1}`)),
      lat: Number(row[idxLat]),
      lon: Number(row[idxLon]),
      scheduledTime: timeStr,
      estimatedTime: timeStr,
      status,
      sequence: i + 1
    };
  });

  const currentOrNext =
    stops.find((s) => s.status === 'current' || s.status === 'upcoming') || stops[stops.length - 1];
  const passed = stops.filter((s) => s.status === 'passed');
  const lastPassed = passed[passed.length - 1];

  const origin = tripDetailJson.from ? formatTitleCase(tripDetailJson.from) : stops[0].stopName;
  const destination = tripDetailJson.to
    ? formatTitleCase(tripDetailJson.to)
    : stops[stops.length - 1].stopName;
  const routeNumber = tripDetailJson.no || bus.routeNumber;
  const fleet =
    bus.fleet === 'Standby' ? classifyFleetCategory('', routeNumber, bus.registrationNumber) : bus.fleet;

  const finalPath =
    Array.isArray(roadPath) && roadPath.length >= 2
      ? roadPath
      : stops.map((s) => [s.lat, s.lon] as [number, number]);

  return {
    ...bus,
    fleet,
    routeId: routeNumber,
    serviceKey: tripDetailJson.rid ? String(tripDetailJson.rid) : bus.serviceKey,
    routeNumber,
    origin,
    destination,
    routeName: `${origin} → ${destination}`,
    isOnTrip: true,
    lastStopName: tripDetailJson.last
      ? formatTitleCase(tripDetailJson.last)
      : lastPassed?.stopName || origin,
    nextStopName: currentOrNext?.stopName || destination,
    nextStopEta: currentOrNext?.estimatedTime || '--:--',
    tripStops: stops,
    path: finalPath
  };
}

/**
 * Returns the routes and live buses serving a selected station.
 * If a stop specifies `mirrorStopName` (e.g., Mahuli -> Kusumajodi), it resolves
 * the exact same routes and live buses as that sibling stop.
 */
export function getStopRoutesAndBuses(
  stop: BusStop,
  allStops: BusStop[],
  allRoutes: BusRoute[],
  allBuses: LiveBus[]
): { routesServingStop: BusRoute[]; busesServingStop: LiveBus[] } {
  const referenceStop = stop.mirrorStopName
    ? allStops.find((s) =>
        s.name.toLowerCase().includes(stop.mirrorStopName!.toLowerCase())
      ) || {
        ...stop,
        id: `mirror-${stop.mirrorStopName.toLowerCase()}`,
        name: stop.mirrorStopName
      }
    : stop;

  const firstToken = referenceStop.name.toLowerCase().split(' ')[0];

  const routesServingStop = allRoutes.filter((r) =>
    r.stops.some(
      (s) =>
        s.stopId === referenceStop.id ||
        (firstToken.length >= 3 && s.stopName.toLowerCase().includes(firstToken))
    )
  );

  const routeNumbersServingStop = new Set(
    routesServingStop.map((r) => r.routeNumber.trim().toUpperCase()).filter(Boolean)
  );

  const busesServingStop = allBuses.filter(
    (b) =>
      (b.routeNumber && routeNumbersServingStop.has(b.routeNumber.trim().toUpperCase())) ||
      (firstToken.length >= 3 &&
        (b.origin.toLowerCase().includes(firstToken) ||
          b.destination.toLowerCase().includes(firstToken))) ||
      b.tripStops.some(
        (s) =>
          s.stopId === referenceStop.id ||
          (firstToken.length >= 3 && s.stopName.toLowerCase().includes(firstToken))
      )
  );

  return { routesServingStop, busesServingStop };
}

function parseClockToMinutesOfDay(raw?: string | null): number | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM))?$/i.exec(trimmed);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === 'AM') hours = hours === 12 ? 0 : hours;
    else hours = hours === 12 ? 12 : hours + 12;
  } else if (hours < 0 || hours > 23) {
    return null;
  }
  return hours * 60 + minutes;
}

function unixSecToIstMinutesOfDay(unixSec: number): number {
  const istSec = ((unixSec + 19800) % 86400 + 86400) % 86400;
  return istSec / 60;
}

function cyclicForwardMinutes(fromMin: number, toMin: number): number {
  let diff = toMin - fromMin;
  if (diff < -720) diff += 1440;
  if (diff > 720) diff -= 1440;
  return diff;
}

function computeBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLon = (lon2 - lon1) * rad;
  const y = Math.sin(dLon) * Math.cos(lat2 * rad);
  const x =
    Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
    Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

interface PolylineProjection {
  alongKm: number;
  distKm: number;
}

function projectPointOntoPolyline(
  lat: number,
  lon: number,
  pts: [number, number][],
  cumKm: number[]
): PolylineProjection {
  const kx = 104.5;
  const ky = 111.0;
  let bestDist = Infinity;
  let bestAlong = 0;

  for (let i = 0; i + 1 < pts.length; i++) {
    const [aLat, aLon] = pts[i];
    const [bLat, bLon] = pts[i + 1];
    const px = (lon - aLon) * kx;
    const py = (lat - aLat) * ky;
    const vx = (bLon - aLon) * kx;
    const vy = (bLat - aLat) * ky;
    const lenSq = vx * vx + vy * vy;
    const t = lenSq < 1e-9 ? 0 : Math.max(0, Math.min(1, (px * vx + py * vy) / lenSq));
    const d = Math.hypot(px - t * vx, py - t * vy);
    if (d < bestDist) {
      bestDist = d;
      const segLen = cumKm[i + 1] - cumKm[i];
      bestAlong = cumKm[i] + t * segLen;
    }
  }

  return { alongKm: bestAlong, distKm: bestDist };
}

function samplePointAtKm(
  pts: [number, number][],
  cumKm: number[],
  targetKm: number,
  fallbackBearing: number
): { lat: number; lon: number; bearing: number } {
  const total = cumKm[cumKm.length - 1] || 0;
  const clamped = Math.max(0, Math.min(total, targetKm));

  for (let i = 0; i + 1 < pts.length; i++) {
    const segStart = cumKm[i];
    const segEnd = cumKm[i + 1];
    if (clamped <= segEnd || i === pts.length - 2) {
      const segLen = segEnd - segStart;
      const t = segLen > 1e-6 ? Math.max(0, Math.min(1, (clamped - segStart) / segLen)) : 0;
      const lat = pts[i][0] + t * (pts[i + 1][0] - pts[i][0]);
      const lon = pts[i][1] + t * (pts[i + 1][1] - pts[i][1]);
      const bearing =
        segLen > 1e-4
          ? computeBearingDeg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])
          : fallbackBearing;
      return { lat, lon, bearing };
    }
  }

  const last = pts[pts.length - 1];
  return { lat: last[0], lon: last[1], bearing: fallbackBearing };
}

function slicePolylineBetweenKm(
  pts: [number, number][],
  cumKm: number[],
  fromKm: number,
  toKm: number,
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): [number, number][] {
  const out: [number, number][] = [[startLat, startLon]];
  for (let i = 0; i < pts.length; i++) {
    if (cumKm[i] > fromKm + 0.02 && cumKm[i] < toKm - 0.02) {
      out.push(pts[i]);
    }
  }
  out.push([endLat, endLon]);
  return out;
}

function formatGpsOldMinutesText(gpsAgeMinutes: number): string {
  if (gpsAgeMinutes >= 60) {
    const hrs = Math.floor(gpsAgeMinutes / 60);
    const rem = gpsAgeMinutes % 60;
    const ageStr = rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
    return `GPS ${ageStr} old — may have moved on`;
  }
  return `GPS ${gpsAgeMinutes} min old — may have moved on`;
}

/**
 * Estimates where an active on-trip bus may currently be along its route
 * according to elapsed time since its last GPS fix and upcoming stop schedule.
 * Returns null if the bus is parked/arrived, off-duty, or GPS is fresh (< 1 min old).
 */
export function estimateBusCurrentPosition(
  bus: LiveBus | null | undefined,
  nowSec: number = Math.floor(Date.now() / 1000),
  fallbackRoutePath?: [number, number][]
): BusEstimatedPosition | null {
  if (!bus || !bus.isOnTrip || isBusSleeping(bus)) return null;
  if (!Number.isFinite(bus.timestamp) || bus.timestamp <= 0) return null;

  const gpsAgeSec = Math.max(0, nowSec - bus.timestamp);
  if (gpsAgeSec < 60) return null; // Fresh GPS (< 1 min old) — no ghost bus needed

  const gpsAgeMinutes = Math.max(1, Math.round(gpsAgeSec / 60));
  // Ignore severely stale feeds (> 3 hours old) to avoid misleading projections
  if (gpsAgeMinutes > 180) return null;

  const routePts: [number, number][] =
    bus.path && bus.path.length >= 2
      ? bus.path
      : bus.tripStops && bus.tripStops.length >= 2
      ? bus.tripStops.map((s) => [s.lat, s.lon] as [number, number])
      : fallbackRoutePath && fallbackRoutePath.length >= 2
      ? fallbackRoutePath
      : [];

  const cappedAgeMin = Math.min(gpsAgeSec / 60, 45);
  const isHighwayFleet = bus.fleet === 'Shree Jagannath Express' || bus.fleet === 'OSRTC';
  const defaultFleetSpeed = isHighwayFleet ? 38 : 26;
  const maxPhysicalSpeedKmh = isHighwayFleet ? 58 : 38;
  const maxPhysicalAdvanceKm = Math.min(24, maxPhysicalSpeedKmh * (cappedAgeMin / 60));

  // Fallback when route geometry isn't loaded yet: dead-reckon gently along live bearing only if moving
  if (routePts.length < 2) {
    if (bus.speedKmh < 6) return null;
    const speedKmh = Math.max(14, Math.min(maxPhysicalSpeedKmh, bus.speedKmh));
    const distKm = Math.min(maxPhysicalAdvanceKm, speedKmh * (cappedAgeMin / 60));
    if (distKm < 0.08) return null;
    const rad = (bus.bearing * Math.PI) / 180;
    const estLat = bus.lat + (Math.cos(rad) * distKm) / 111.0;
    const estLon = bus.lon + (Math.sin(rad) * distKm) / 104.5;
    return {
      lat: estLat,
      lon: estLon,
      bearing: bus.bearing,
      gpsAgeMinutes,
      distanceMovedKm: Number(distKm.toFixed(1)),
      connectorPath: [
        [bus.lat, bus.lon],
        [estLat, estLon]
      ],
      estimatedNextStopName: bus.nextStopName || bus.destination || 'Next Stop',
      method: 'speed',
      statusText: formatGpsOldMinutesText(gpsAgeMinutes)
    };
  }

  // Cumulative road distance along route polyline
  const cumKm: number[] = [0];
  for (let i = 1; i < routePts.length; i++) {
    cumKm.push(
      cumKm[i - 1] +
        calculateExactDistanceKm(
          routePts[i - 1][0],
          routePts[i - 1][1],
          routePts[i][0],
          routePts[i][1]
        )
    );
  }
  const totalKm = cumKm[cumKm.length - 1];
  if (totalKm < 0.25) return null;

  const gpsProj = projectPointOntoPolyline(bus.lat, bus.lon, routePts, cumKm);
  if (gpsProj.alongKm >= totalKm - 0.12) {
    return null; // Already at route terminus
  }

  const stops = bus.tripStops || [];
  const upcomingWithAlong = stops
    .filter((s) => s.status === 'current' || s.status === 'upcoming')
    .map((s) => ({
      stop: s,
      alongKm: projectPointOntoPolyline(s.lat, s.lon, routePts, cumKm).alongKm,
      timeMin: parseClockToMinutesOfDay(s.estimatedTime || s.scheduledTime)
    }))
    .filter((item) => item.alongKm > gpsProj.alongKm + 0.05)
    .sort((a, b) => a.alongKm - b.alongKm);

  const gpsIstMin = unixSecToIstMinutesOfDay(bus.timestamp);
  const nowIstMin = unixSecToIstMinutesOfDay(nowSec);

  let targetAlongKm: number | null = null;
  let method: 'schedule' | 'speed' = 'speed';
  let estimatedNextStopName =
    upcomingWithAlong[0]?.stop.stopName || bus.nextStopName || bus.destination || 'Next Stop';

  // Method A: Schedule / Next-Stop Time Interpolation
  const firstAhead = upcomingWithAlong[0];
  if (firstAhead && firstAhead.timeMin !== null) {
    const minsGpsToFirst = cyclicForwardMinutes(gpsIstMin, firstAhead.timeMin);
    if (minsGpsToFirst >= 1 && minsGpsToFirst <= 180) {
      const elapsedMin = gpsAgeSec / 60;
      if (elapsedMin <= minsGpsToFirst) {
        // Still between last GPS position and the next scheduled stop
        const frac = Math.min(0.96, elapsedMin / minsGpsToFirst);
        targetAlongKm = gpsProj.alongKm + (firstAhead.alongKm - gpsProj.alongKm) * frac;
        estimatedNextStopName = firstAhead.stop.stopName;
        method = 'schedule';
      } else {
        // Current time has passed the first upcoming stop's ETA — walk subsequent legs!
        let prevKm = firstAhead.alongKm;
        let prevTimeMin = firstAhead.timeMin;
        let placed = false;

        for (let i = 1; i < upcomingWithAlong.length; i++) {
          const cur = upcomingWithAlong[i];
          if (cur.timeMin === null) continue;
          const legDurMin = cyclicForwardMinutes(prevTimeMin, cur.timeMin);
          if (legDurMin < 1 || legDurMin > 180) continue;

          const pastPrevMin = cyclicForwardMinutes(prevTimeMin, nowIstMin);
          if (pastPrevMin >= 0 && pastPrevMin <= legDurMin) {
            const frac = Math.min(0.96, pastPrevMin / legDurMin);
            targetAlongKm = prevKm + (cur.alongKm - prevKm) * frac;
            estimatedNextStopName = cur.stop.stopName;
            method = 'schedule';
            placed = true;
            break;
          }
          prevKm = cur.alongKm;
          prevTimeMin = cur.timeMin;
        }

        if (!placed) {
          // Past last scheduled stop time in window -> place near remaining route capped by reasonable speed
          const maxReasonableKm = gpsProj.alongKm + defaultFleetSpeed * (cappedAgeMin / 60);
          targetAlongKm = Math.min(prevKm, maxReasonableKm);
          estimatedNextStopName =
            upcomingWithAlong[upcomingWithAlong.length - 1]?.stop.stopName || estimatedNextStopName;
          method = 'schedule';
        }
      }
    }
  }

  // Method B: Speed-based projection along the road polyline (when schedule is absent or bus is behind schedule)
  if (targetAlongKm === null) {
    const speedKmh =
      bus.speedKmh >= 10 ? Math.max(14, Math.min(maxPhysicalSpeedKmh, bus.speedKmh)) : defaultFleetSpeed;
    const advanceKm = speedKmh * (cappedAgeMin / 60);
    targetAlongKm = Math.min(totalKm - 0.05, gpsProj.alongKm + advanceKm);
    method = 'speed';
  }

  // Enforce physical road-speed cap so noisy timetables never teleport the faded bus 40+ km away
  const maxAllowedAlongKm = Math.min(totalKm - 0.04, gpsProj.alongKm + maxPhysicalAdvanceKm);
  targetAlongKm = Math.max(gpsProj.alongKm, Math.min(maxAllowedAlongKm, targetAlongKm));

  // Always pick the first upcoming stop strictly ahead of the final estimated position
  const nextAfterEst = upcomingWithAlong.find((u) => u.alongKm > targetAlongKm! + 0.05);
  if (nextAfterEst) {
    estimatedNextStopName = nextAfterEst.stop.stopName;
  }

  const movedKm = targetAlongKm - gpsProj.alongKm;
  if (movedKm < 0.06) return null;

  const sampled = samplePointAtKm(routePts, cumKm, targetAlongKm, bus.bearing);
  const connectorPath = slicePolylineBetweenKm(
    routePts,
    cumKm,
    gpsProj.alongKm,
    targetAlongKm,
    bus.lat,
    bus.lon,
    sampled.lat,
    sampled.lon
  );

  return {
    lat: sampled.lat,
    lon: sampled.lon,
    bearing: sampled.bearing,
    gpsAgeMinutes,
    distanceMovedKm: Number(movedKm.toFixed(1)),
    connectorPath,
    estimatedNextStopName,
    method,
    statusText: formatGpsOldMinutesText(gpsAgeMinutes)
  };
}

/**
 * Resolves a corridor deep-link (?route=BSR0038U&from=Bhubaneswar&to=Kamakhyanagar)
 * to the best currently active live bus on that route/corridor, plus the matching BusRoute fallback.
 */
export function findBestLiveBusOrRouteForDeepLink(
  buses: LiveBus[],
  routes: BusRoute[],
  options: { routeCode?: string; from?: string; to?: string }
): { bus: LiveBus | null; route: BusRoute | null } {
  const rawRoute = (options.routeCode || '').trim().toUpperCase();
  const baseRoute = rawRoute.replace(/[UD]$/i, '');
  const fromNorm = normalizeTripPlannerStopQuery(options.from || '');
  const toNorm = normalizeTripPlannerStopQuery(options.to || '');

  // 1. Find best matching BusRoute (exact code -> paired U/D code -> stops matching from & to)
  const exactRoute = rawRoute
    ? routes.find((r) => r.routeNumber.trim().toUpperCase() === rawRoute)
    : undefined;
  const pairedRoute =
    !exactRoute && baseRoute.length >= 4
      ? routes.find((r) => r.routeNumber.trim().toUpperCase().replace(/[UD]$/i, '') === baseRoute)
      : undefined;

  const corridorRoutes =
    fromNorm && toNorm
      ? routes.filter((r) => {
          const hay = `${r.origin} ${r.destination} ${r.name} ${r.stops.map((s) => s.stopName).join(' ')}`.toLowerCase();
          return hay.includes(fromNorm) && hay.includes(toNorm);
        })
      : [];

  const matchedRoute = exactRoute || pairedRoute || corridorRoutes[0] || null;

  // Build set of route numbers serving this corridor for matching live buses
  const corridorRouteNumbers = new Set<string>();
  if (rawRoute) corridorRouteNumbers.add(rawRoute);
  for (const r of corridorRoutes) {
    if (r.routeNumber) corridorRouteNumbers.add(r.routeNumber.trim().toUpperCase());
  }

  // Score live buses so an active on-trip moving bus on the exact route always wins
  const scoreBus = (b: LiveBus): number => {
    const bRoute = (b.routeNumber || '').trim().toUpperCase();
    const bBase = bRoute.replace(/[UD]$/i, '');
    let matchTier = 0;

    if (rawRoute && bRoute === rawRoute) {
      matchTier = 4000;
    } else if (baseRoute.length >= 4 && bBase === baseRoute) {
      matchTier = 3000;
    } else if (bRoute && corridorRouteNumbers.has(bRoute)) {
      matchTier = 2000;
    } else if (fromNorm && toNorm) {
      const hay = `${b.origin} ${b.destination} ${b.routeName} ${(b.tripStops || []).map((s) => s.stopName).join(' ')}`.toLowerCase();
      if (hay.includes(fromNorm) && hay.includes(toNorm)) {
        matchTier = 1500;
      }
    }

    if (matchTier === 0) return 0;

    let bonus = 0;
    if (b.isOnTrip && !isBusSleeping(b)) bonus += 500;
    else if (b.isOnTrip) bonus += 200;
    if (b.speedKmh > 0) bonus += 120;
    if (b.tripStops && b.tripStops.length > 0) bonus += 80;
    return matchTier + bonus;
  };

  let bestBus: LiveBus | null = null;
  let bestScore = 0;
  for (const b of buses) {
    const s = scoreBus(b);
    if (s > bestScore) {
      bestScore = s;
      bestBus = b;
    }
  }

  return { bus: bestBus, route: matchedRoute };
}

export function getInitialDataset() {
  return {
    buses: SEED_LIVE_BUSES,
    routes: SEED_ROUTES,
    stops: SEED_STOPS,
    status: SEED_STATUS
  };
}
