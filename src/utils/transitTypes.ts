export type FleetCategory =
  | 'Shree Jagannath Express'
  | 'OSRTC'
  | 'Mukhyamantri Bus Seva'
  | 'Ama Bus'
  | 'Ama Bus AC'
  | 'Mo Bus'
  | 'Standby';

export type FleetFilter = 'ALL' | FleetCategory;

export type StopPassState = 'passed' | 'current' | 'upcoming' | 'skipped';

export interface RouteStopTiming {
  stopId: string;
  stopName: string;
  lat: number;
  lon: number;
  scheduledTime: string;
  estimatedTime?: string;
  status: StopPassState;
  sequence: number;
}

export interface BusStop {
  id: string;
  name: string;
  district: string;
  lat: number;
  lon: number;
  isTerminal?: boolean;
  isCustom?: boolean;
  code?: string;
  degree?: number;
}

export interface BusRoute {
  id: string;
  serviceKey?: string;
  routeNumber: string;
  name: string;
  origin: string;
  destination: string;
  fleet: FleetCategory;
  corridor: string;
  distanceKm: number;
  durationLabel: string;
  departures: string[];
  stops: RouteStopTiming[];
  path: [number, number][]; // [lat, lon]
}

export interface LiveBus {
  id: string;
  registrationNumber: string; // e.g., "OD06M9130"
  fleet: FleetCategory;
  routeId: string;
  serviceKey?: string;
  routeNumber: string;
  routeName: string;
  origin: string;
  destination: string;
  lat: number;
  lon: number;
  bearing: number;
  speedKmh: number;
  speedSource?: 'gps' | 'calculated' | 'idle';
  gpsAgeLabel?: string;
  timestamp: number;
  depot: string;
  isOnTrip: boolean;
  nextStopName: string;
  nextStopEta: string;
  lastStopName: string;
  tripStops: RouteStopTiming[];
  path?: [number, number][];
}

export interface FeedStatus {
  network: string;
  feedTime: number;
  written: number;
  vehicles: number;
  onTrip: number;
  onRoute: number;
  tripUpdates: number;
  lastSyncedIso: string;
  sourceMode: 'live-gtfs' | 'hybrid-fallback';
}

export interface DirectJourneyMatch {
  route: BusRoute;
  fromStop: RouteStopTiming;
  toStop: RouteStopTiming;
  stopsCount: number;
  estimatedMinutes: number;
  estimatedFareInr: number;
  activeBusesOnRoute: LiveBus[];
}

export interface RoadRoutesSelection {
  lat: number;
  lon: number;
  roadName: string;
  nearestStopName?: string;
  routes: BusRoute[];
  isLoading: boolean;
}

export interface HistoryEntry {
  id: string;
  kind: 'bus' | 'route' | 'stop';
  label: string;
  sublabel?: string;
  timestamp: number;
}

export interface MapViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
}

export interface UserGpsLocation {
  lat: number;
  lon: number;
  accuracyMeters?: number;
}

