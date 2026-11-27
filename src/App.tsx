import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Bus,
  ChevronUp,
  Clock,
  Compass,
  ExternalLink,
  Map as MapIcon,
  MapPin,
  Moon,
  RefreshCw,
  Route as RouteIcon,
  Search,
  Sun,
  X
} from 'lucide-react';
import { FLEET_CATEGORIES } from './utils/odishaSeedData';
import { CUSTOM_BUS_STOPS } from './utils/customStops';
import {
  fetchBusTripDetailData,
  fetchLiveFeedsData,
  fetchNetworkDirectoryData,
  fetchRouteRoadPathData,
  fetchRoutesOnRoadData
} from './utils/clientOsrtcLoader';
import {
  addHistoryEntry,
  estimateBusCurrentPosition,
  filterBusesByMapBounds,
  filterLiveBuses,
  filterRoutes,
  findBestLiveBusOrRouteForDeepLink,
  findDirectJourneys,
  findRoutesNearRoadPoint,
  formatTime12Hour,
  isBusSleeping,
  parseGtfsRealtimePayload,
  parseLiveTripDetail,
  replaceCuttackWithKataka,
  searchStops
} from './utils/transitLogic';
import {
  BusRoute,
  BusStop,
  FeedStatus,
  FleetFilter,
  HistoryEntry,
  LiveBus,
  MapViewportBounds,
  RoadRoutesSelection
} from './utils/transitTypes';
import { CoachLiverySvg } from './components/CoachLiverySvg';
import { OdishaTransitMap } from './components/OdishaTransitMap';
import { BusDetailPanel } from './components/BusDetailPanel';

type ActiveWorkspaceTab = 'buses' | 'routes' | 'stations' | 'planner' | 'fleets';
type MobileSheetMode = 'map' | 'explore' | 'details';

const HISTORY_STORAGE_KEY = 'odisha_bus_history_v1';

const FLEET_SWATCH_COLORS: Record<string, string> = {
  'Shree Jagannath Express': '#e8641b',
  OSRTC: '#d42a2f',
  'Mukhyamantri Bus Seva': '#f08c1c',
  'Ama Bus': '#1f6fb8',
  'Ama Bus AC': '#0284c7',
  'Mo Bus': '#0d9488',
  Standby: '#64748b'
};

const MOBILE_TAB_LABELS: Record<ActiveWorkspaceTab, string> = {
  buses: 'Live Odisha Buses',
  routes: 'Odisha Routes',
  stations: 'Bus Stations',
  planner: 'Trip Planner',
  fleets: 'Odisha Bus Fleets'
};

function readInitialHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is HistoryEntry =>
          item &&
          typeof item.id === 'string' &&
          typeof item.label === 'string' &&
          (item.kind === 'bus' || item.kind === 'route' || item.kind === 'stop')
      )
      .map((item) => ({
        ...item,
        label: replaceCuttackWithKataka(item.label),
        sublabel: item.sublabel ? replaceCuttackWithKataka(item.sublabel) : undefined
      }));
  } catch {
    return [];
  }
}

export default function App() {
  // Default Light Mode
  const [isDark, setIsDark] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('buses');
  const [mobilePanel, setMobilePanel] = useState<MobileSheetMode>('map');
  const [fleetFilter, setFleetFilter] = useState<FleetFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onTripOnly, setOnTripOnly] = useState<boolean>(false);
  const [syncWithMap, setSyncWithMap] = useState<boolean>(true);
  const [mapBounds, setMapBounds] = useState<MapViewportBounds | null>(null);
  const [showRouteMark, setShowRouteMark] = useState<boolean>(true);
  const [followBus, setFollowBus] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryEntry[]>(() => readInitialHistory());

  // 100% REAL Odisha data populated live from /api/osrtc/live & /api/osrtc/network
  const [buses, setBuses] = useState<LiveBus[]>([]);
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [stops, setStops] = useState<BusStop[]>(() => [...CUSTOM_BUS_STOPS]);
  const [feedStatus, setFeedStatus] = useState<FeedStatus>({
    network: 'osrtc',
    feedTime: 0,
    written: 0,
    vehicles: 0,
    onTrip: 0,
    onRoute: 0,
    tripUpdates: 0,
    lastSyncedIso: '--:--',
    sourceMode: 'live-gtfs'
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isLoadingTrip, setIsLoadingTrip] = useState<boolean>(false);

  const initialUrlParams = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      bus: (params.get('bus') || '').toUpperCase().trim(),
      route: (params.get('route') || '').toUpperCase().trim(),
      stop: (params.get('stop') || '').trim(),
      from: (params.get('from') || '').trim(),
      to: (params.get('to') || '').trim()
    };
  }, []);

  // On normal load (no URL deep link), show NO active track — only map + left bus details
  const [selectedBus, setSelectedBus] = useState<LiveBus | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<BusRoute | null>(null);
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [selectedRoad, setSelectedRoad] = useState<RoadRoutesSelection | null>(null);
  const [focusCoords, setFocusCoords] = useState<{ lat: number; lon: number; zoom?: number } | null>(null);

  // Trip planner state (pre-populated if ?from=&to= deep link was clicked)
  const [plannerFrom, setPlannerFrom] = useState<string>(() => initialUrlParams.from || 'Kamakhyanagar');
  const [plannerTo, setPlannerTo] = useState<string>(() => initialUrlParams.to || 'Gangijodi');

  // Track which vehicle IDs have already been enriched with full live trip + roadPath
  const enrichedTripsRef = useRef<Map<string, LiveBus>>(new Map());
  const requestedBusParamDoneRef = useRef<boolean>(!initialUrlParams.bus);
  const requestedCorridorParamDoneRef = useRef<boolean>(
    !(initialUrlParams.route || (initialUrlParams.from && initialUrlParams.to))
  );
  const requestedStopParamDoneRef = useRef<boolean>(!initialUrlParams.stop);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Persist user history cleanly
  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Ignore storage quota errors
    }
  }, [history]);

  const recordHistory = useCallback((entry: Omit<HistoryEntry, 'timestamp'>) => {
    setHistory((prev) => addHistoryEntry(prev, entry, 8));
  }, []);

  // Fetch full live trip stops (passed + upcoming) and road-snapped route path (Express or Netlify proxy)
  const loadBusFullTrip = useCallback(async (bus: LiveBus) => {
    if (!bus.id) return;
    setIsLoadingTrip(true);
    try {
      const payload = await fetchBusTripDetailData(bus.id);
      if (payload?.trip && Array.isArray(payload.trip.stops)) {
        const enriched = parseLiveTripDetail(bus, payload.trip, payload.roadPath);
        enrichedTripsRef.current.set(bus.registrationNumber, enriched);
        setSelectedBus((curr) =>
          curr && curr.registrationNumber === bus.registrationNumber ? enriched : curr
        );
        setBuses((prev) =>
          prev.map((item) =>
            item.registrationNumber === bus.registrationNumber ? enriched : item
          )
        );
      }
    } catch {
      // Retain existing bus data if trip endpoint is unavailable
    } finally {
      setIsLoadingTrip(false);
    }
  }, []);

  // Load ALL real Odisha stations & routes (Express /api/osrtc/network or Netlify /osrtc-proxy/*)
  useEffect(() => {
    let active = true;
    const loadNetwork = async (attempt = 1) => {
      try {
        const { stops: realStops, routes: realRoutes } = await fetchNetworkDirectoryData();
        if (!active) return;
        if (realStops.length > 0) {
          setStops(realStops);
        }
        if (realRoutes.length > 0) {
          setRoutes(realRoutes);
        }
        // Retry once after 2.5s if network stops failed to load on initial static boot
        if (realStops.length <= CUSTOM_BUS_STOPS.length && attempt < 2) {
          setTimeout(() => {
            if (active) loadNetwork(attempt + 1);
          }, 2500);
        }
      } catch {
        if (attempt < 2 && active) {
          setTimeout(() => {
            if (active) loadNetwork(attempt + 1);
          }, 2500);
        }
      }
    };
    loadNetwork(1);
    return () => {
      active = false;
    };
  }, []);

  // Live Odisha sync: uses /api/osrtc/live on Express or /osrtc-proxy/* on Netlify static hosting
  const syncLiveGtfsFeeds = useCallback(async () => {
    setIsSyncing(true);
    try {
      const {
        status: statusJson,
        vehiclePositions: vpJson,
        tripUpdates: tuJson,
        liveVehicles: lvJson,
        routeLink: rlJson
      } = await fetchLiveFeedsData();

      if (lvJson || vpJson || statusJson) {
        const { buses: mergedBuses, status: mergedStatus } = parseGtfsRealtimePayload(
          vpJson,
          tuJson,
          statusJson,
          lvJson,
          rlJson
        );

        const hydratedBuses = mergedBuses.map((b) => {
          const cachedTrip = enrichedTripsRef.current.get(b.registrationNumber);
          if (!cachedTrip) return b;
          return {
            ...cachedTrip,
            lat: b.lat,
            lon: b.lon,
            bearing: b.bearing,
            speedKmh: b.speedKmh,
            speedSource: b.speedSource,
            gpsAgeLabel: b.gpsAgeLabel,
            timestamp: b.timestamp
          };
        });

        setBuses(hydratedBuses);
        setFeedStatus(mergedStatus);

        const params = new URLSearchParams(window.location.search);
        const busParam = params.get('bus')?.toUpperCase().trim();

        setSelectedBus((curr) => {
          const targetReg = (!requestedBusParamDoneRef.current && busParam) || curr?.registrationNumber;
          if (!targetReg) return curr;
          const found = hydratedBuses.find((b) => b.registrationNumber.toUpperCase() === targetReg);
          if (found && !requestedBusParamDoneRef.current) {
            requestedBusParamDoneRef.current = true;
            loadBusFullTrip(found);
          }
          return found || curr;
        });
      }
    } catch {
      // Retain existing state cleanly
    } finally {
      setIsSyncing(false);
      setIsInitialLoading(false);
    }
  }, [loadBusFullTrip]);

  useEffect(() => {
    syncLiveGtfsFeeds();
    const timer = setInterval(syncLiveGtfsFeeds, 30000);
    return () => clearInterval(timer);
  }, [syncLiveGtfsFeeds]);

  const handleSelectBus = useCallback(
    (bus: LiveBus, openMobileDetails = true) => {
      setSelectedRoute(null);
      setSelectedStop(null);
      setSelectedRoad(null);
      setSelectedBus(bus);
      if (openMobileDetails) {
        setMobilePanel('details');
      }
      recordHistory({
        id: bus.registrationNumber,
        kind: 'bus',
        label: bus.registrationNumber,
        sublabel: bus.routeNumber !== 'OFF DUTY' ? bus.routeNumber : bus.fleet
      });
      const url = new URL(window.location.href);
      url.searchParams.set('bus', bus.registrationNumber);
      window.history.replaceState({}, '', url.toString());
      loadBusFullTrip(bus);
    },
    [loadBusFullTrip, recordHistory]
  );

  const handleSelectRoute = useCallback(
    async (route: BusRoute) => {
      setSelectedBus(null);
      setSelectedStop(null);
      setSelectedRoad(null);
      setFollowBus(false);
      setSelectedRoute(route);
      setMobilePanel('details');
      recordHistory({
        id: route.id,
        kind: 'route',
        label: `Route ${route.routeNumber}`,
        sublabel: route.origin
      });
      const url = new URL(window.location.href);
      url.searchParams.delete('bus');
      url.searchParams.delete('stop');
      url.searchParams.set('route', route.routeNumber);
      window.history.replaceState({}, '', url.toString());

      // Fetch exact road-snapped polyline for this route (Express or Netlify proxy)
      const lookupKey = route.serviceKey || route.routeNumber;
      if (lookupKey) {
        try {
          const roadPath = await fetchRouteRoadPathData(lookupKey);
          if (roadPath && roadPath.length >= 2) {
            const enrichedRoute = { ...route, path: roadPath };
            setSelectedRoute((curr) => (curr && curr.id === route.id ? enrichedRoute : curr));
          }
        } catch {
          // Keep stop-to-stop polyline fallback
        }
      }
    },
    [recordHistory]
  );

  const handleSelectStop = useCallback(
    (stop: BusStop) => {
      setSelectedBus(null);
      setSelectedRoute(null);
      setSelectedRoad(null);
      setFollowBus(false);
      setSelectedStop(stop);
      setMobilePanel('details');
      recordHistory({
        id: stop.id,
        kind: 'stop',
        label: stop.name,
        sublabel: stop.district
      });
    },
    [recordHistory]
  );

  // Auto-resolve ?route=&from=&to= deep links (e.g. "Track Live →" from GitHub Pages corridors table)
  // Selects a live running bus on that route/corridor immediately if active, otherwise opens the full route track!
  useEffect(() => {
    if (requestedCorridorParamDoneRef.current) return;
    if (buses.length === 0 && routes.length === 0) return;

    const { bus: matchedBus, route: matchedRoute } = findBestLiveBusOrRouteForDeepLink(
      buses,
      routes,
      {
        routeCode: initialUrlParams.route,
        from: initialUrlParams.from,
        to: initialUrlParams.to
      }
    );

    if (matchedBus) {
      requestedCorridorParamDoneRef.current = true;
      setSyncWithMap(false);
      handleSelectBus(matchedBus, true);
      return;
    }

    // Wait until both live buses and routes have finished loading before settling on route-only fallback
    if (matchedRoute && !isInitialLoading) {
      requestedCorridorParamDoneRef.current = true;
      void handleSelectRoute(matchedRoute);
    }
  }, [buses, routes, isInitialLoading, initialUrlParams, handleSelectBus, handleSelectRoute]);

  // Auto-resolve ?stop= deep link when stations finish loading
  useEffect(() => {
    if (requestedStopParamDoneRef.current || stops.length === 0) return;
    const q = initialUrlParams.stop.toLowerCase();
    const found =
      stops.find((s) => s.id.toLowerCase() === q) ||
      stops.find((s) => s.name.toLowerCase() === q) ||
      stops.find((s) => s.name.toLowerCase().includes(q));
    if (found) {
      requestedStopParamDoneRef.current = true;
      handleSelectStop(found);
      setFocusCoords({ lat: found.lat, lon: found.lon, zoom: 13 });
    }
  }, [stops, initialUrlParams.stop, handleSelectStop]);

  // Clicking any road on MapLibre -> show "Routes on this road"
  const handleRoadClick = useCallback(
    async (lat: number, lon: number, roadName: string) => {
      setSelectedBus(null);
      setSelectedRoute(null);
      setSelectedStop(null);
      setFollowBus(false);

      const url = new URL(window.location.href);
      url.searchParams.delete('bus');
      window.history.replaceState({}, '', url.toString());

      const localMatches = findRoutesNearRoadPoint(routes, lat, lon, 0.45);
      setSelectedRoad({
        lat,
        lon,
        roadName,
        routes: localMatches,
        isLoading: true
      });
      setMobilePanel('details');

      try {
        const roadData = await fetchRoutesOnRoadData(lat, lon);
        if (roadData) {
          const seenKeys = new Set<string>();
          const combined: BusRoute[] = [];
          for (const r of [...roadData.routes, ...localMatches]) {
            const key = `${r.routeNumber}|${r.origin}|${r.destination}`;
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);
            combined.push(r);
          }

          setSelectedRoad((curr) =>
            curr && curr.lat === lat && curr.lon === lon
              ? {
                  ...curr,
                  nearestStopName: roadData.nearestStopName,
                  routes: combined,
                  isLoading: false
                }
              : curr
          );
          return;
        }
      } catch {
        // Fallback to local route matches
      }

      setSelectedRoad((curr) =>
        curr && curr.lat === lat && curr.lon === lon ? { ...curr, isLoading: false } : curr
      );
    },
    [routes]
  );

  const handleOpenHistoryItem = useCallback(
    (entry: HistoryEntry) => {
      if (entry.kind === 'bus') {
        const match = buses.find((b) => b.registrationNumber === entry.id);
        if (match) {
          handleSelectBus(match, true);
        } else {
          setSearchQuery(entry.id);
        }
      } else if (entry.kind === 'route') {
        const match = routes.find((r) => r.id === entry.id || `Route ${r.routeNumber}` === entry.label);
        if (match) {
          handleSelectRoute(match);
        } else {
          setSearchQuery(entry.label.replace(/^Route\s+/i, ''));
        }
      } else if (entry.kind === 'stop') {
        const match = stops.find((s) => s.id === entry.id);
        if (match) {
          handleSelectStop(match);
          setFocusCoords({ lat: match.lat, lon: match.lon, zoom: 13 });
        } else {
          setSearchQuery(entry.label);
        }
      }
    },
    [buses, routes, stops, handleSelectBus, handleSelectRoute, handleSelectStop]
  );

  const handleFocusCoords = useCallback((lat: number, lon: number, zoom = 13) => {
    setFocusCoords({ lat, lon, zoom });
  }, []);

  const filteredBuses = useMemo(
    () =>
      filterLiveBuses(buses, {
        fleet: fleetFilter,
        query: searchQuery,
        onTripOnly
      }),
    [buses, fleetFilter, searchQuery, onTripOnly]
  );

  // Left-side list: when 'In map view' is enabled (and no explicit text search), show buses inside visible map area
  const sidebarBuses = useMemo(() => {
    if (!syncWithMap || !mapBounds || searchQuery.trim().length > 0) {
      return filteredBuses;
    }
    return filterBusesByMapBounds(filteredBuses, mapBounds);
  }, [filteredBuses, syncWithMap, mapBounds, searchQuery]);

  const filteredRoutes = useMemo(
    () =>
      filterRoutes(routes, {
        fleet: fleetFilter,
        query: searchQuery
      }),
    [routes, fleetFilter, searchQuery]
  );

  const filteredStops = useMemo(() => searchStops(stops, searchQuery), [stops, searchQuery]);

  const directJourneys = useMemo(
    () => findDirectJourneys(routes, buses, plannerFrom, plannerTo, fleetFilter),
    [routes, buses, plannerFrom, plannerTo, fleetFilter]
  );

  const fleetCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: buses.length, Standby: 0 };
    for (const f of FLEET_CATEGORIES) {
      counts[f.id] = 0;
    }
    for (const b of buses) {
      counts[b.fleet] = (counts[b.fleet] || 0) + 1;
    }
    return counts;
  }, [buses]);

  const openMobileExploreTab = (tab: ActiveWorkspaceTab) => {
    setActiveTab(tab);
    setMobilePanel('explore');
  };

  const renderFleetFilterGroup = (compact = false) => (
    <div
      role="group"
      aria-label="Filter by Odisha bus fleet"
      className={`flex items-center gap-0.5 p-1 rounded-xl overflow-x-auto min-w-0 ${
        compact
          ? 'bg-slate-100 dark:bg-slate-950 max-w-full'
          : 'bg-slate-100/90 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800/80'
      }`}
    >
      <button
        type="button"
        onClick={() => setFleetFilter('ALL')}
        className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg transition-all whitespace-nowrap shrink-0 ${
          fleetFilter === 'ALL'
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold ring-1 ring-slate-200/80 dark:ring-slate-700'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <span>All ({fleetCounts.ALL})</span>
      </button>
      {FLEET_CATEGORIES.map((fleet) => (
        <button
          key={fleet.id}
          type="button"
          onClick={() => setFleetFilter(fleet.id)}
          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg transition-all whitespace-nowrap shrink-0 ${
            fleetFilter === fleet.id
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold ring-1 ring-slate-200/80 dark:ring-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span
            aria-hidden="true"
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: FLEET_SWATCH_COLORS[fleet.id] }}
          />
          <span>
            {fleet.shortLabel} ({fleetCounts[fleet.id] || 0})
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => setFleetFilter('Standby')}
        className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg transition-all whitespace-nowrap shrink-0 ${
          fleetFilter === 'Standby'
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold ring-1 ring-slate-200/80 dark:ring-slate-700'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <span
          aria-hidden="true"
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: FLEET_SWATCH_COLORS.Standby }}
        />
        <span>Off Duty ({fleetCounts.Standby || 0})</span>
      </button>

      <span
        aria-hidden="true"
        className="h-4 w-px bg-slate-300/80 dark:bg-slate-700 mx-1 shrink-0"
      />

      <button
        type="button"
        aria-pressed={showRouteMark}
        onClick={() => setShowRouteMark((prev) => !prev)}
        title="Enable or disable bus route line and stop marks on the map"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all whitespace-nowrap shrink-0 ${
          showRouteMark
            ? 'bg-fuchsia-600 text-white shadow-xs font-semibold'
            : 'bg-white/80 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white ring-1 ring-slate-200/80 dark:ring-slate-700'
        }`}
      >
        <RouteIcon className="w-3 h-3 shrink-0" />
        <span>Route Mark: {showRouteMark ? 'On' : 'Off'}</span>
      </button>
    </div>
  );

  const hasAnySelection = Boolean(selectedBus || selectedRoute || selectedStop || selectedRoad);
  const syncedTime12h = formatTime12Hour(feedStatus.lastSyncedIso);

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="h-[50px] md:h-auto flex items-center justify-between gap-4 md:gap-8 px-3.5 md:px-5 md:py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 shrink-0 z-30">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('buses');
            setMobilePanel('map');
          }}
          className="text-base md:text-lg font-bold tracking-tight text-slate-900 dark:text-white font-display whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <span
            aria-hidden="true"
            className="w-2.5 h-2.5 rounded-full bg-orange-600 shrink-0"
          />
          <span>Odisha Bus</span>
        </a>

        {/* Desktop & Tablet Primary Navigation */}
        <nav
          aria-label="Primary transit views"
          className="hidden md:flex items-center gap-5 lg:gap-7 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          {(
            [
              ['buses', 'Live Buses'],
              ['routes', 'Routes'],
              ['stations', 'Stations'],
              ['planner', 'Trip Planner'],
              ['fleets', 'Fleets']
            ] as [ActiveWorkspaceTab, string][]
          ).map(([tabKey, label]) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveTab(tabKey)}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tabKey
                  ? 'border-orange-600 text-slate-900 dark:text-white font-semibold'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Right Primary Action Zone */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsDark((d) => !d)}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shrink-0"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          <button
            type="button"
            onClick={syncLiveGtfsFeeds}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 md:px-3.5 h-9 md:h-auto md:py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60 rounded-xl md:rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncing ? 'Syncing Live…' : 'Sync Live Feed'}</span>
            <span className="sm:hidden">{isSyncing ? 'Sync…' : 'Sync'}</span>
          </button>
        </div>
      </header>

      {/* DESKTOP & TABLET WORKSPACE TOOLBAR: Single-Row Fleet Filter Bar & Live Telemetry */}
      <div className="hidden md:flex flex-nowrap items-center justify-between gap-3 px-4 py-1.5 bg-white/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 shrink-0 z-20">
        {renderFleetFilterGroup(false)}

        <div className="flex items-center gap-2.5 text-[11px] text-slate-600 dark:text-slate-400 font-mono tabular-nums shrink-0">
          <span className="hidden xl:inline whitespace-nowrap">
            {feedStatus.vehicles.toLocaleString()} Live · Synced {syncedTime12h}
          </span>
          <button
            type="button"
            onClick={() => setIsDark((d) => !d)}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-sans text-xs font-medium shadow-2xs transition-colors whitespace-nowrap shrink-0"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
            <span>{isDark ? 'Light Map' : 'Dark Map'}</span>
          </button>
        </div>
      </div>

      {/* MAIN RESPONSIVE WORKSPACE (Sits cleanly ABOVE sticky mobile footer) */}
      <main className="flex-1 flex flex-col md:flex-row min-h-0 relative overflow-hidden">
        {/* LEFT EXPLORER SIDEBAR (Desktop/Tablet docked | Mobile slide-up bottom sheet inside <main>) */}
        <section
          aria-label="Odisha Transit Explorer"
          className={`${
            mobilePanel === 'explore' ? 'flex' : 'hidden md:flex'
          } absolute inset-x-0 bottom-0 z-[600] max-h-[82%] rounded-t-3xl shadow-2xl border-t border-slate-200/90 dark:border-slate-800 bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl flex-col overflow-hidden md:static md:w-[320px] lg:w-[368px] md:h-full md:max-h-none md:rounded-none md:shadow-none md:border-t-0 md:border-r md:bg-white md:dark:bg-slate-900 shrink-0 md:z-10`}
        >
          {/* Mobile Bottom Sheet Handle & Header */}
          <div className="md:hidden shrink-0 px-4 pt-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-800 space-y-2.5 bg-white dark:bg-slate-900">
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto" aria-hidden="true" />
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                  {MOBILE_TAB_LABELS[activeTab]}
                </h2>
                <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {feedStatus.vehicles.toLocaleString()} live vehicles · Synced {syncedTime12h}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {activeTab !== 'fleets' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('fleets')}
                    className="px-2.5 min-h-[38px] rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Fleets
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMobilePanel('map')}
                  aria-label="Close panel and return to map"
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {activeTab !== 'fleets' && renderFleetFilterGroup(true)}
          </div>

          {activeTab !== 'planner' && activeTab !== 'fleets' && (
            <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800 space-y-2.5 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  aria-label="Search bus number, route, station or town"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Bus (e.g. OD06M9130), route, town or stop…"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100/90 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-orange-500 transition-colors"
                />
              </div>

              {/* HISTORY BAR (Replaced Quick presets; includes Clear option) */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 overflow-x-auto min-w-0">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {history.length === 0 ? (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      History: recent views appear here
                    </span>
                  ) : (
                    <>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                        History:
                      </span>
                      {history.map((item) => (
                        <button
                          key={`${item.kind}-${item.id}`}
                          type="button"
                          onClick={() => handleOpenHistoryItem(item)}
                          className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-orange-500/15 hover:text-orange-600 dark:hover:text-orange-400 text-slate-700 dark:text-slate-300 font-mono text-[11px] transition-colors whitespace-nowrap shrink-0"
                        >
                          {item.label}
                        </button>
                      ))}
                    </>
                  )}
                </div>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setHistory([])}
                    className="px-1.5 py-0.5 rounded text-orange-600 dark:text-orange-400 hover:underline text-[11px] font-medium whitespace-nowrap shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>

              {activeTab === 'buses' && (
                <div className="flex items-center justify-between gap-3 pt-0.5 text-xs">
                  <label
                    title="Show live buses visible in the current map area"
                    className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-medium"
                  >
                    <input
                      type="checkbox"
                      checked={syncWithMap}
                      onChange={(e) => setSyncWithMap(e.target.checked)}
                      className="rounded accent-orange-600"
                    />
                    <span className="whitespace-nowrap text-[11px]">In map view</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={onTripOnly}
                      onChange={(e) => setOnTripOnly(e.target.checked)}
                      className="rounded accent-orange-600"
                    />
                    <span className="whitespace-nowrap text-[11px]">On trip only</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: LIVE BUSES LIST */}
          {activeTab === 'buses' && (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
              {syncWithMap && mapBounds && !searchQuery.trim() && !isInitialLoading && (
                <div className="px-3.5 py-1.5 bg-slate-50/90 dark:bg-slate-950/50 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2">
                  <span className="font-mono tabular-nums">
                    {sidebarBuses.length.toLocaleString()} bus{sidebarBuses.length === 1 ? '' : 'es'} in map area
                  </span>
                  {sidebarBuses.length < filteredBuses.length && (
                    <button
                      type="button"
                      onClick={() => setSyncWithMap(false)}
                      className="text-orange-600 dark:text-orange-400 hover:underline font-medium shrink-0"
                    >
                      Show all ({filteredBuses.length.toLocaleString()})
                    </button>
                  )}
                </div>
              )}

              {isInitialLoading && buses.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Loading real-time Odisha GPS bus feed…
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Fetching live OSRTC, Shree Jagannath Express & Mukhyamantri Bus Seva vehicles
                  </p>
                </div>
              ) : sidebarBuses.length === 0 ? (
                <div className="p-6 text-center space-y-2.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {searchQuery
                      ? `No live buses match "${searchQuery}" under ${fleetFilter === 'ALL' ? 'all fleets' : fleetFilter}.`
                      : syncWithMap
                      ? 'No live buses are currently in this zoomed map area. Zoom out or disable "In map view" to see all Odisha buses.'
                      : `No live buses currently active under ${fleetFilter === 'ALL' ? 'all fleets' : fleetFilter}.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setFleetFilter('ALL');
                      setOnTripOnly(false);
                      setSyncWithMap(false);
                    }}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-orange-600 text-white hover:bg-orange-500 transition-colors"
                  >
                    Show All Odisha Buses
                  </button>
                </div>
              ) : (
                sidebarBuses.slice(0, 120).map((bus) => {
                  const isSelected = selectedBus?.registrationNumber === bus.registrationNumber;
                  const sleeping = isBusSleeping(bus);
                  return (
                    <button
                      key={bus.registrationNumber}
                      type="button"
                      onClick={() => handleSelectBus(bus)}
                      className={`w-full px-3.5 py-3 text-left flex items-center justify-between gap-3 transition-colors ${
                        isSelected
                          ? 'bg-orange-50/90 dark:bg-orange-500/15'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span
                            aria-hidden="true"
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: FLEET_SWATCH_COLORS[bus.fleet] || '#64748b' }}
                          />
                          <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                            {bus.registrationNumber}
                          </span>
                          {bus.routeNumber !== 'OFF DUTY' && (
                            <>
                              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                              <span className="font-mono tabular-nums text-orange-600 dark:text-orange-400 font-semibold">
                                {bus.routeNumber}
                              </span>
                            </>
                          )}
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                          <span className="text-slate-500 dark:text-slate-400 truncate">
                            {bus.fleet === 'Standby' ? 'Off Duty' : bus.fleet}
                          </span>
                        </div>
                        <div className="text-xs text-slate-800 dark:text-slate-200 font-medium truncate mt-0.5">
                          {bus.routeName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono tabular-nums">
                          {bus.speedKmh > 0 ? `${bus.speedKmh} km/h` : sleeping ? 'Resting (Zzz)' : '0 km/h'} · {(bus.gpsAgeLabel || 'Live').replace(/^GPS\s+/i, '')}
                          {bus.nextStopEta !== '--:--' ? ` · ${formatTime12Hour(bus.nextStopEta)}` : ''}
                        </div>
                      </div>
                      <CoachLiverySvg fleet={bus.fleet} size="sm" />
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: ROUTES EXPLORER */}
          {activeTab === 'routes' && (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredRoutes.length === 0 ? (
                <div className="p-6 text-center space-y-2.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No Odisha routes match your current filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setFleetFilter('ALL');
                    }}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-orange-600 text-white hover:bg-orange-500 transition-colors"
                  >
                    Show All Routes
                  </button>
                </div>
              ) : (
                filteredRoutes.slice(0, 150).map((route) => {
                  const isSelected = selectedRoute?.id === route.id;
                  return (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => handleSelectRoute(route)}
                      className={`w-full px-3.5 py-3 text-left flex items-center justify-between gap-3 transition-colors ${
                        isSelected
                          ? 'bg-orange-50/90 dark:bg-orange-500/15'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span
                            aria-hidden="true"
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: FLEET_SWATCH_COLORS[route.fleet] || '#64748b' }}
                          />
                          <span className="font-bold font-mono tabular-nums text-orange-600 dark:text-orange-400">
                            Route {route.routeNumber}
                          </span>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                          <span className="text-slate-600 dark:text-slate-400 truncate">
                            {route.fleet}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                          {route.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                          {route.stops.length} stops · {route.distanceKm} km · {route.durationLabel}
                        </div>
                      </div>
                      <CoachLiverySvg fleet={route.fleet} size="sm" />
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: STATION SEARCH (ALL Odisha Stations) */}
          {activeTab === 'stations' && (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
              <div className="px-3.5 py-2 bg-slate-50/80 dark:bg-slate-950/40 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Showing {Math.min(filteredStops.length, 200).toLocaleString()} of {filteredStops.length.toLocaleString()} Odisha stations
              </div>
              {filteredStops.length === 0 ? (
                <div className="p-6 text-center space-y-2.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No Odisha bus stations match "{searchQuery}".
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-orange-600 text-white hover:bg-orange-500 transition-colors"
                  >
                    Show All Stations
                  </button>
                </div>
              ) : (
                filteredStops.slice(0, 200).map((stop) => {
                  const isSelected = selectedStop?.id === stop.id;
                  return (
                    <button
                      key={stop.id}
                      type="button"
                      onClick={() => {
                        handleSelectStop(stop);
                        handleFocusCoords(stop.lat, stop.lon, 13);
                      }}
                      className={`w-full px-3.5 py-3 text-left flex items-center justify-between gap-3 transition-colors ${
                        isSelected
                          ? 'bg-orange-50/90 dark:bg-orange-500/15'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {stop.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>{stop.district}</span>
                          {stop.code && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono tabular-nums">{stop.code}</span>
                            </>
                          )}
                          {stop.isTerminal && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span className="text-orange-600 dark:text-orange-400 font-medium">Terminal Hub</span>
                            </>
                          )}
                        </div>
                      </div>
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 4: POINT-TO-POINT TRIP PLANNER */}
          {activeTab === 'planner' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800 space-y-2.5 shrink-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  Odisha Station-to-Station Route & Timing Finder
                </div>
                <div className="space-y-2">
                  <div>
                    <label
                      htmlFor="planner-origin"
                      className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5"
                    >
                      Origin Station or Town
                    </label>
                    <input
                      id="planner-origin"
                      type="text"
                      value={plannerFrom}
                      onChange={(e) => setPlannerFrom(e.target.value)}
                      placeholder="e.g. Kamakhyanagar, Puri, Bhubaneswar…"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/90 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-orange-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Direct route search</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPlannerFrom(plannerTo);
                        setPlannerTo(plannerFrom);
                      }}
                      aria-label="Swap origin and destination stations"
                      className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      <span>Swap Stations</span>
                    </button>
                  </div>
                  <div>
                    <label
                      htmlFor="planner-dest"
                      className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5"
                    >
                      Destination Station or Town
                    </label>
                    <input
                      id="planner-dest"
                      type="text"
                      value={plannerTo}
                      onChange={(e) => setPlannerTo(e.target.value)}
                      placeholder="e.g. Gangijodi, Kendujhar, Kataka…"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100/90 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="pt-1 flex flex-wrap gap-1.5">
                  {[
                    { label: 'Kamakhyanagar → Gangijodi', from: 'Kamakhyanagar', to: 'Gangijodi' },
                    { label: 'Puri → Kendujhar', from: 'Puri', to: 'Kendujhar' },
                    { label: 'Nandankanan → Puri', from: 'Nandankanan', to: 'Puri' },
                    { label: 'Brahmapur → Kataka', from: 'Brahmapur', to: 'Kataka' },
                    { label: 'Bhubaneswar → Raurkela', from: 'Bhubaneswar', to: 'Raurkela' }
                  ].map((corridor) => (
                    <button
                      key={corridor.label}
                      type="button"
                      onClick={() => {
                        setPlannerFrom(corridor.from);
                        setPlannerTo(corridor.to);
                        setFleetFilter('ALL');
                      }}
                      className="px-2 py-1 text-[11px] rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-orange-500/15 hover:text-orange-600 dark:hover:text-orange-400 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      {corridor.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
                {directJourneys.length === 0 ? (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-2">
                    <p>
                      No direct routes found between "{plannerFrom}" and "{plannerTo}" under the selected fleet filter. Try selecting one of the presets above.
                    </p>
                  </div>
                ) : (
                  directJourneys.map((match) => (
                    <div
                      key={match.route.id}
                      className="p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold font-mono tabular-nums text-orange-600 dark:text-orange-400">
                            Route {match.route.routeNumber} · {match.route.fleet}
                          </div>
                          <div className="text-xs font-semibold text-slate-900 dark:text-white">
                            {match.fromStop.stopName} → {match.toStop.stopName}
                          </div>
                        </div>
                        <CoachLiverySvg fleet={match.route.fleet} size="sm" />
                      </div>

                      <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        Dep {formatTime12Hour(match.fromStop.scheduledTime)} · Arr {formatTime12Hour(match.toStop.scheduledTime)} · {match.stopsCount} stops · ₹{match.estimatedFareInr}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSelectRoute(match.route)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500 transition-colors"
                        >
                          Trace Route on Map
                        </button>
                        {match.activeBusesOnRoute[0] && (
                          <button
                            type="button"
                            onClick={() => handleSelectBus(match.activeBusesOnRoute[0])}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono tabular-nums transition-colors"
                          >
                            Track {match.activeBusesOnRoute[0].registrationNumber}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: ODISHA FLEET DIRECTORY */}
          {activeTab === 'fleets' && (
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Select any Odisha public transport fleet below to filter live GPS vehicles and trace its routes on the map.
              </div>
              {FLEET_CATEGORIES.map((fleet) => {
                const count = fleetCounts[fleet.id] || 0;
                return (
                  <button
                    key={fleet.id}
                    type="button"
                    onClick={() => {
                      setFleetFilter(fleet.id);
                      setActiveTab('buses');
                    }}
                    className="w-full p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 hover:border-orange-500/60 bg-white dark:bg-slate-950/50 shadow-2xs text-left transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: FLEET_SWATCH_COLORS[fleet.id] }}
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            {fleet.shortLabel}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {fleet.operator}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-mono tabular-nums font-semibold text-orange-600 dark:text-orange-400">
                        {count} live →
                      </span>
                    </div>
                    <div className="py-1.5 flex justify-center bg-slate-50/90 dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                      <CoachLiverySvg fleet={fleet.id} size="md" />
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {fleet.description}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* CENTER INTERACTIVE MAPLIBRE ODISHA MAP */}
        <section
          aria-label="Interactive Odisha Live Bus Map"
          className="flex-1 h-full relative min-w-0 isolate z-0"
        >
          <OdishaTransitMap
            buses={filteredBuses}
            routes={filteredRoutes}
            stops={stops}
            selectedBus={selectedBus}
            selectedRoute={selectedRoute}
            selectedStop={selectedStop}
            selectedRoad={selectedRoad}
            followBus={followBus}
            showRouteMark={showRouteMark}
            onToggleRouteMark={setShowRouteMark}
            onSelectBus={(bus) => handleSelectBus(bus, false)}
            onSelectStop={handleSelectStop}
            onRoadClick={handleRoadClick}
            onBoundsChange={setMapBounds}
            isDark={isDark}
            focusCoords={focusCoords}
            feedTime={feedStatus.feedTime}
          />
        </section>

        {/* MOBILE FLOATING SUMMARY BAR (Positioned inside <main>, strictly ABOVE the sticky footer) */}
        {mobilePanel === 'map' && hasAnySelection && (
          <div className="md:hidden absolute inset-x-3 bottom-3 z-[550]">
            <button
              type="button"
              onClick={() => setMobilePanel('details')}
              className="w-full p-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 shadow-xl flex items-center justify-between gap-3 text-left transition-transform active:scale-[0.99]"
            >
              {selectedBus && (() => {
                const mobileEst = estimateBusCurrentPosition(
                  selectedBus,
                  feedStatus.feedTime > 0 ? feedStatus.feedTime : Math.floor(Date.now() / 1000)
                );
                return (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span
                          aria-hidden="true"
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: FLEET_SWATCH_COLORS[selectedBus.fleet] || '#64748b' }}
                        />
                        <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                          {selectedBus.registrationNumber}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="font-mono tabular-nums font-semibold text-orange-600 dark:text-orange-400">
                          {selectedBus.routeNumber}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                        {selectedBus.routeName}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {selectedBus.speedKmh > 0 ? `${selectedBus.speedKmh} km/h` : 'Stationary'}
                        {selectedBus.nextStopName ? ` · Next: ${selectedBus.nextStopName}` : ''}
                        {selectedBus.nextStopEta !== '--:--' ? ` (${formatTime12Hour(selectedBus.nextStopEta)})` : ''}
                      </div>
                      {mobileEst && (
                        <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 truncate mt-0.5">
                          {mobileEst.statusText}
                        </div>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-xl bg-orange-600 text-white text-xs font-semibold shrink-0">
                      <span>Timeline</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </span>
                  </>
                );
              })()}

              {!selectedBus && selectedRoad && (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                      Routes on this road
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                      {selectedRoad.roadName}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-xl bg-orange-600 text-white text-xs font-semibold shrink-0">
                    <span>{selectedRoad.routes.length} Routes</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </span>
                </>
              )}

              {!selectedBus && !selectedRoad && selectedRoute && (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold font-mono tabular-nums text-orange-600 dark:text-orange-400">
                      Route {selectedRoute.routeNumber} · {selectedRoute.fleet}
                    </div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                      {selectedRoute.name}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-xl bg-orange-600 text-white text-xs font-semibold shrink-0">
                    <span>Stops</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </span>
                </>
              )}

              {!selectedBus && !selectedRoad && !selectedRoute && selectedStop && (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {selectedStop.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {selectedStop.district}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-xl bg-orange-600 text-white text-xs font-semibold shrink-0">
                    <span>Buses</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </span>
                </>
              )}
            </button>
          </div>
        )}

        {/* RIGHT BUS / ROUTE / STATION / ROAD ROUTES TIMELINE DRAWER */}
        <BusDetailPanel
          selectedBus={selectedBus}
          selectedRoute={selectedRoute}
          selectedStop={selectedStop}
          selectedRoad={selectedRoad}
          allBuses={buses}
          allRoutes={routes}
          allStops={stops}
          isLoadingTrip={isLoadingTrip}
          followBus={followBus}
          mobileVisible={mobilePanel === 'details'}
          onShowMapMobile={() => setMobilePanel('map')}
          onToggleFollowBus={() => setFollowBus((f) => !f)}
          onClose={() => {
            setFollowBus(false);
            setSelectedBus(null);
            setSelectedRoute(null);
            setSelectedStop(null);
            setSelectedRoad(null);
            setMobilePanel('map');
            const url = new URL(window.location.href);
            url.searchParams.delete('bus');
            window.history.replaceState({}, '', url.toString());
          }}
          onFocusCoords={handleFocusCoords}
          onSelectBus={(bus) => handleSelectBus(bus, true)}
          onSelectRoute={handleSelectRoute}
          feedTime={feedStatus.feedTime}
        />
      </main>

      {/* MOBILE STICKY FOOTER: Bottom Navigation Menu + Odia Bhasa App Link cleanly BELOW it */}
      <footer className="md:hidden shrink-0 sticky bottom-0 z-[700] bg-white dark:bg-slate-900 border-t border-slate-200/90 dark:border-slate-800 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]">
        <nav
          aria-label="Mobile transit navigation"
          className="h-12 grid grid-cols-5"
        >
          <button
            type="button"
            onClick={() => setMobilePanel('map')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
              mobilePanel === 'map'
                ? 'text-orange-600 dark:text-orange-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            <span>Map</span>
          </button>

          <button
            type="button"
            onClick={() => openMobileExploreTab('buses')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
              mobilePanel === 'explore' && activeTab === 'buses'
                ? 'text-orange-600 dark:text-orange-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Bus className="w-4 h-4" />
            <span>Buses</span>
          </button>

          <button
            type="button"
            onClick={() => openMobileExploreTab('routes')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
              mobilePanel === 'explore' && activeTab === 'routes'
                ? 'text-orange-600 dark:text-orange-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <RouteIcon className="w-4 h-4" />
            <span>Routes</span>
          </button>

          <button
            type="button"
            onClick={() => openMobileExploreTab('stations')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
              mobilePanel === 'explore' && activeTab === 'stations'
                ? 'text-orange-600 dark:text-orange-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Stations</span>
          </button>

          <button
            type="button"
            onClick={() => openMobileExploreTab('planner')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
              mobilePanel === 'explore' && activeTab === 'planner'
                ? 'text-orange-600 dark:text-orange-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Plan</span>
          </button>
        </nav>

        {/* Below Bottom Menu: Odia Bhasa App Banner (cleanly underneath nav, never behind content) */}
        <a
          href="https://play.google.com/store/apps/details?id=in.sandeep.odiabhasa"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-2.5 px-3.5 py-2 border-t border-slate-100 dark:border-slate-800/90 bg-orange-50/70 dark:bg-slate-950/90 hover:bg-orange-50 dark:hover:bg-slate-800/80 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="https://imsbg.github.io/odiabhasa/images/app.png"
              alt="Odia Bhasa App"
              className="w-7 h-7 rounded-lg object-cover shrink-0 shadow-2xs"
            />
            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
              Download Odia Bhasa App
            </span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
        </a>
      </footer>
    </div>
  );
}
