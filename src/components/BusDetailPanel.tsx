import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  LocateFixed,
  Map as MapIcon,
  Route as RouteIcon,
  Share2,
  X
} from 'lucide-react';
import {
  BusRoute,
  BusStop,
  FleetCategory,
  LiveBus,
  RoadRoutesSelection,
  RouteStopTiming,
  StopScheduleResponse
} from '../utils/transitTypes';
import { CoachLiverySvg } from './CoachLiverySvg';
import {
  buildStopPanelData,
  estimateBusCurrentPosition,
  estimateFareInr,
  formatTime12Hour,
  isBusSleeping
} from '../utils/transitLogic';
import { fetchStopScheduleData } from '../utils/clientOsrtcLoader';

const FLEET_BADGE_CLASS: Record<FleetCategory, string> = {
  'Mukhyamantri Bus Seva': 'bg-orange-600 text-white hover:bg-orange-700',
  'Shree Jagannath Express': 'bg-red-600 text-white hover:bg-red-700',
  OSRTC: 'bg-sky-600 text-white hover:bg-sky-700',
  'Ama Bus': 'bg-teal-600 text-white hover:bg-teal-700',
  'Ama Bus AC': 'bg-indigo-600 text-white hover:bg-indigo-700',
  'Mo Bus': 'bg-emerald-600 text-white hover:bg-emerald-700',
  Standby: 'bg-slate-600 text-white hover:bg-slate-700'
};

interface BusDetailPanelProps {
  selectedBus: LiveBus | null;
  selectedRoute: BusRoute | null;
  selectedStop: BusStop | null;
  selectedRoad: RoadRoutesSelection | null;
  allBuses: LiveBus[];
  allRoutes: BusRoute[];
  allStops: BusStop[];
  isLoadingTrip: boolean;
  followBus: boolean;
  mobileVisible: boolean;
  onShowMapMobile: () => void;
  onToggleFollowBus: () => void;
  onClose: () => void;
  onFocusCoords: (lat: number, lon: number, zoom?: number) => void;
  onSelectBus: (bus: LiveBus) => void;
  onSelectRoute: (route: BusRoute) => void;
  feedTime?: number;
}

export const BusDetailPanel: React.FC<BusDetailPanelProps> = ({
  selectedBus,
  selectedRoute,
  selectedStop,
  selectedRoad,
  allBuses,
  allRoutes,
  allStops,
  isLoadingTrip,
  followBus,
  mobileVisible,
  onShowMapMobile,
  onToggleFollowBus,
  onClose,
  onFocusCoords,
  onSelectBus,
  onSelectRoute,
  feedTime = 0
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [stopSchedule, setStopSchedule] = useState<StopScheduleResponse | null>(null);
  const [isLoadingStopSchedule, setIsLoadingStopSchedule] = useState(false);
  const [expandedDepartureId, setExpandedDepartureId] = useState<string | null>(null);
  const [departureQuery, setDepartureQuery] = useState('');
  const [clockSec, setClockSec] = useState<number>(() =>
    feedTime > 0 ? feedTime : Math.floor(Date.now() / 1000)
  );
  const feedAnchorRef = useRef<{ feedTime: number; localMs: number }>({
    feedTime,
    localMs: Date.now()
  });
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const nextStopItemRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    feedAnchorRef.current = { feedTime, localMs: Date.now() };
    setClockSec(feedTime > 0 ? feedTime : Math.floor(Date.now() / 1000));
  }, [feedTime]);

  useEffect(() => {
    if (!selectedBus && !selectedStop) return;
    const computeRefNow = () => {
      const anchor = feedAnchorRef.current;
      if (anchor.feedTime > 0) {
        return anchor.feedTime + Math.max(0, Math.floor((Date.now() - anchor.localMs) / 1000));
      }
      return Math.floor(Date.now() / 1000);
    };
    setClockSec(computeRefNow());
    const timer = window.setInterval(() => {
      setClockSec(computeRefNow());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [selectedBus?.registrationNumber, selectedStop?.id, feedTime]);

  // Fetch full un-capped per-stop schedule whenever a bus stop is selected
  useEffect(() => {
    if (!selectedStop) {
      setStopSchedule(null);
      setIsLoadingStopSchedule(false);
      setExpandedDepartureId(null);
      setDepartureQuery('');
      return;
    }

    let cancelled = false;
    setStopSchedule(null);
    setExpandedDepartureId(null);
    setDepartureQuery('');
    setIsLoadingStopSchedule(true);

    fetchStopScheduleData(selectedStop)
      .then((res) => {
        if (!cancelled) {
          setStopSchedule(res);
        }
      })
      .catch(() => {
        if (!cancelled) setStopSchedule(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingStopSchedule(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStop?.id, selectedStop?.name, selectedStop?.mirrorStopName]);

  const stopPanelData = useMemo(() => {
    if (!selectedStop) return null;
    return buildStopPanelData(
      selectedStop,
      stopSchedule ? stopSchedule.departures : null,
      stopSchedule ? stopSchedule.resolvedStopIds : null,
      allStops,
      allRoutes,
      allBuses,
      clockSec
    );
  }, [selectedStop, stopSchedule, allStops, allRoutes, allBuses, clockSec]);

  // Auto-scroll timeline directly to the next station so the user sees it immediately without scrolling
  useEffect(() => {
    if (!selectedBus || !nextStopItemRef.current || !timelineContainerRef.current) return;
    const timer = window.setTimeout(() => {
      const container = timelineContainerRef.current;
      const target = nextStopItemRef.current;
      if (!container || !target) return;
      const offsetTop = target.offsetTop - Math.max(24, container.clientHeight * 0.25);
      container.scrollTo({
        top: Math.max(0, offsetTop),
        behavior: 'smooth'
      });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [selectedBus?.registrationNumber, selectedBus?.tripStops?.length, selectedBus?.nextStopName]);

  if (!selectedBus && !selectedRoute && !selectedStop && !selectedRoad) {
    return null;
  }

  const handleCopyDeepLink = (paramKey: string, paramValue: string) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('bus');
    url.searchParams.delete('route');
    url.searchParams.delete('stop');
    url.searchParams.set(paramKey, paramValue);
    window.history.replaceState({}, '', url.toString());
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url.toString()).catch(() => {});
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Anchors cleanly inside <main> directly above the sticky mobile footer
  const containerClass = `${
    mobileVisible ? 'flex' : 'hidden md:flex'
  } absolute inset-x-0 bottom-0 z-[600] max-h-[82%] rounded-t-3xl shadow-2xl border-t border-slate-200/90 dark:border-slate-800 bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl flex-col overflow-hidden md:inset-x-auto md:top-3 md:right-16 md:bottom-3 md:w-[344px] md:max-h-none md:rounded-2xl md:border md:shadow-2xl md:z-[500] xl:static xl:w-[396px] xl:h-full xl:rounded-none xl:border-0 xl:border-l xl:shadow-none xl:bg-white xl:dark:bg-slate-900 xl:z-20 shrink-0`;

  const MobileSheetHandle = () => (
    <div className="md:hidden flex flex-col items-center pt-2.5 pb-1 shrink-0 bg-white dark:bg-slate-900">
      <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" aria-hidden="true" />
    </div>
  );

  // 1. LIVE BUS VIEW
  if (selectedBus) {
    const stops: RouteStopTiming[] = selectedBus.tripStops || [];
    const passedCount = stops.filter((s) => s.status === 'passed').length;
    const nextStopIdx = stops.findIndex((s) => s.status === 'current' || s.status === 'upcoming');
    const sleeping = isBusSleeping(selectedBus);
    const arrivedAtEnd =
      stops.length > 0 && stops.every((s) => s.status === 'passed' || s.status === 'skipped');
    const matchedRoute =
      (!selectedBus.path || selectedBus.path.length < 2) && stops.length < 2
        ? allRoutes.find(
            (r) =>
              (selectedBus.serviceKey && r.serviceKey === selectedBus.serviceKey) ||
              (selectedBus.routeNumber &&
                selectedBus.routeNumber !== 'OFF DUTY' &&
                r.routeNumber.toUpperCase() === selectedBus.routeNumber.toUpperCase())
          )
        : undefined;
    const fallbackRoutePath =
      matchedRoute?.path && matchedRoute.path.length >= 2
        ? matchedRoute.path
        : matchedRoute && matchedRoute.stops.length >= 2
        ? matchedRoute.stops.map((s) => [s.lat, s.lon] as [number, number])
        : undefined;
    const estimatedPos = estimateBusCurrentPosition(selectedBus, clockSec, fallbackRoutePath);
    const gpsAgeMin =
      Number.isFinite(selectedBus.timestamp) && selectedBus.timestamp > 0
        ? Math.max(0, Math.round((clockSec - selectedBus.timestamp) / 60))
        : 0;
    const staleGpsNotice =
      !sleeping && selectedBus.isOnTrip && gpsAgeMin >= 1
        ? estimatedPos?.statusText ||
          (gpsAgeMin >= 60
            ? `GPS ${Math.floor(gpsAgeMin / 60)}h ${gpsAgeMin % 60}m old — may have moved on`
            : `GPS ${gpsAgeMin} min old — may have moved on`)
        : null;

    const speedLabel =
      selectedBus.speedKmh > 0
        ? `${selectedBus.speedKmh} km/h${selectedBus.speedSource === 'calculated' ? ' (calculated)' : ''}`
        : arrivedAtEnd
        ? 'Arrived at destination'
        : 'Stationary (0 km/h)';

    return (
      <aside
        aria-label={`Live bus details for ${selectedBus.registrationNumber}`}
        className={containerClass}
      >
        <MobileSheetHandle />

        {/* Header with Route Direction, Registration & GPS Age */}
        <div className="px-4 pt-3 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-gradient-to-b from-orange-50/50 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 shrink-0">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                  {selectedBus.routeNumber}
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate font-medium">
                  {selectedBus.fleet === 'Standby' ? 'Not yet seen on a trip' : selectedBus.fleet}
                </span>
              </div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white mt-0.5 leading-snug font-display">
                {selectedBus.routeName}
              </h2>
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1.5 font-mono tabular-nums">
                <span className="font-semibold text-slate-900 dark:text-white">
                  Bus {selectedBus.registrationNumber}
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {selectedBus.gpsAgeLabel || 'GPS live'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onShowMapMobile}
                aria-label="View bus on map"
                className="md:hidden inline-flex items-center gap-1 px-2.5 min-h-[40px] rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Map</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close bus details"
                className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Vector Livery + Clean Speed & Service Info (with animated Zzz when arrived/resting) */}
          <div className="mt-3 py-2.5 px-3 rounded-xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3">
            <div className="relative flex items-center">
              <CoachLiverySvg fleet={selectedBus.fleet} size="md" />
              {sleeping && (
                <div
                  aria-label="Bus resting"
                  data-testid="bus-sleep-zzz"
                  className="bus-zzz-wrap -ml-4 -mt-6"
                >
                  <span className="bus-zzz-letter bus-zzz-1">z</span>
                  <span className="bus-zzz-letter bus-zzz-2">z</span>
                  <span className="bus-zzz-letter bus-zzz-3">Z</span>
                </div>
              )}
            </div>
            <div className="text-right text-xs space-y-0.5">
              <div className="font-mono tabular-nums text-slate-900 dark:text-slate-100 font-semibold">
                {speedLabel}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {arrivedAtEnd
                  ? 'Trip completed · Resting'
                  : selectedBus.fleet === 'Standby' || !selectedBus.isOnTrip
                  ? 'Off duty / between trips'
                  : selectedBus.fleet}
              </div>
              {selectedBus.lastStopName && selectedBus.isOnTrip && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[165px]">
                  Last: {selectedBus.lastStopName}
                </div>
              )}
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onToggleFollowBus();
                onShowMapMobile();
              }}
              aria-pressed={followBus}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] md:min-h-[34px] text-xs font-semibold rounded-xl transition-all shadow-xs whitespace-nowrap shrink-0 ${
                followBus
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-orange-600 hover:bg-orange-500 text-white'
              }`}
            >
              <LocateFixed className="w-3.5 h-3.5" />
              <span>{followBus ? 'Following Bus' : 'Follow this bus'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleCopyDeepLink('bus', selectedBus.registrationNumber)}
              className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] md:min-h-[34px] text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copied' : 'Share ?bus='}</span>
            </button>
          </div>
        </div>

        {/* Stale GPS Notice + Faded Estimated Bus Position Callout */}
        {staleGpsNotice && (
          <div
            role="status"
            data-testid="gps-estimated-notice"
            className="px-4 py-2.5 border-b border-amber-200/90 dark:border-amber-900/60 bg-amber-50/90 dark:bg-amber-950/35 flex items-start justify-between gap-2.5 shrink-0"
          >
            <div className="flex items-start gap-2 min-w-0">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-amber-900 dark:text-amber-200 leading-snug">
                  {staleGpsNotice}
                </div>
                {estimatedPos && (
                  <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 mt-0.5 leading-snug">
                    Faded bus on map shows where it may be now (~{estimatedPos.distanceMovedKm} km
                    ahead toward <span className="font-semibold">{estimatedPos.estimatedNextStopName}</span>).
                  </p>
                )}
              </div>
            </div>
            {estimatedPos && (
              <button
                type="button"
                onClick={() => {
                  onFocusCoords(estimatedPos.lat, estimatedPos.lon, 13.5);
                  onShowMapMobile();
                }}
                className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white whitespace-nowrap shrink-0 transition-colors"
              >
                Show Est.
              </button>
            )}
          </div>
        )}

        {/* Immediate Next Station / Arrived End Summary Banner (Visible without scrolling) */}
        {stops.length > 0 && (
          <div
            className={`px-4 py-2.5 border-b text-xs flex items-center justify-between gap-2 shrink-0 ${
              arrivedAtEnd
                ? 'bg-indigo-50/90 dark:bg-indigo-950/35 border-indigo-200/70 dark:border-indigo-900/50'
                : 'bg-rose-50/85 dark:bg-rose-950/30 border-rose-200/70 dark:border-rose-900/50'
            }`}
          >
            <div className="text-slate-700 dark:text-slate-200 truncate">
              {arrivedAtEnd ? (
                <>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Arrived at end: </span>
                  <strong className="font-bold text-slate-900 dark:text-white">
                    {selectedBus.destination}
                  </strong>
                </>
              ) : (
                <>
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">Next station: </span>
                  <strong className="font-bold text-slate-900 dark:text-white">
                    {selectedBus.nextStopName || selectedBus.destination}
                  </strong>
                </>
              )}
            </div>
            <div
              className={`font-mono tabular-nums font-bold shrink-0 ${
                arrivedAtEnd
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {arrivedAtEnd ? 'Resting (Zzz)' : `due ${formatTime12Hour(selectedBus.nextStopEta)}`}
            </div>
          </div>
        )}

        {/* Stop-by-Stop Live Route Timeline (Auto-scrolled to Next Station) */}
        <div ref={timelineContainerRef} className="flex-1 overflow-y-auto p-4 relative">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-200">
              Live Route Timeline ({stops.length} stations)
            </h3>
            {stops.length > 0 && (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {passedCount}/{stops.length} passed
              </span>
            )}
          </div>

          {isLoadingTrip && (
            <div className="text-xs text-slate-500 dark:text-slate-400 py-2">
              Loading full stop timeline and road route from OSRTC tracker…
            </div>
          )}

          {!isLoadingTrip && stops.length === 0 ? (
            <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
              <p>
                Odisha’s tracker shows <strong className="font-mono text-slate-900 dark:text-slate-200">{selectedBus.registrationNumber}</strong> between assigned trips or parked at depot right now.
              </p>
            </div>
          ) : (
            <ol className="relative space-y-0">
              {stops.map((st, idx) => {
                const isPassed = st.status === 'passed';
                const isCurrent = st.status === 'current';
                const isSkipped = st.status === 'skipped';
                const isLast = idx === stops.length - 1;
                const isNextFocus = idx === nextStopIdx;
                const timeText = formatTime12Hour(st.estimatedTime || st.scheduledTime);

                return (
                  <li
                    key={`${st.stopId}-${idx}`}
                    ref={isNextFocus ? nextStopItemRef : undefined}
                    className="relative pl-6 pb-3.5 last:pb-0"
                  >
                    {/* Vertical timeline connector line */}
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        className={`absolute left-[6px] top-3 bottom-0 w-0.5 ${
                          isPassed
                            ? 'bg-rose-500/80 dark:bg-rose-500/70'
                            : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      />
                    )}

                    {/* Timeline Node */}
                    <span
                      aria-hidden="true"
                      className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 ${
                        isCurrent
                          ? 'bg-rose-600 border-white dark:border-slate-900 ring-2 ring-rose-500/60'
                          : isPassed
                          ? 'bg-rose-500 border-white dark:border-slate-900'
                          : 'bg-white dark:bg-slate-900 border-rose-400'
                      }`}
                    />

                    <button
                      type="button"
                      onClick={() => {
                        onFocusCoords(st.lat, st.lon, 14);
                        onShowMapMobile();
                      }}
                      className={`w-full text-left group flex items-baseline justify-between gap-2 rounded-lg px-2 py-1 -mx-2 transition-colors ${
                        isCurrent
                          ? 'bg-rose-50/80 dark:bg-rose-950/35'
                          : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      <div className="min-w-0">
                        <div
                          className={`text-xs truncate ${
                            isCurrent
                              ? 'text-rose-700 dark:text-rose-300 font-bold'
                              : isPassed
                              ? 'text-slate-500 dark:text-slate-400 font-medium'
                              : 'text-slate-900 dark:text-slate-100 font-semibold'
                          }`}
                        >
                          {st.stopName}
                        </div>
                        <div
                          className={`text-[11px] font-mono tabular-nums ${
                            isCurrent
                              ? 'text-rose-600 dark:text-rose-400 font-semibold'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {isSkipped
                            ? 'skipped'
                            : isPassed
                            ? `at ${timeText}`
                            : `due ${timeText}`}
                        </div>
                      </div>

                      <div
                        className={`text-[11px] shrink-0 ${
                          isCurrent
                            ? 'text-rose-600 dark:text-rose-400 font-semibold'
                            : isPassed
                            ? 'text-slate-400 dark:text-slate-500'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {isCurrent ? 'Next station' : isPassed ? 'Passed' : 'Upcoming'}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          {stops.length > 0 && (
            <p className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              This bus’s live trip from Odisha’s transit tracker: stops it has passed show when it reached them, and upcoming stops show expected arrival times.
            </p>
          )}
        </div>
      </aside>
    );
  }

  // 2. ROUTES ON THIS ROAD VIEW (Triggered by clicking on any road on MapLibre)
  if (selectedRoad) {
    return (
      <aside
        aria-label={`Routes on ${selectedRoad.roadName}`}
        className={containerClass}
      >
        <MobileSheetHandle />

        <div className="px-4 pt-3 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-gradient-to-b from-orange-50/50 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 shrink-0">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400">
                <RouteIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Routes on this road</span>
              </div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white mt-0.5 font-display truncate">
                {selectedRoad.roadName}
              </h2>
              {selectedRoad.nearestStopName && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Near {selectedRoad.nearestStopName}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onShowMapMobile}
                aria-label="Back to map"
                className="md:hidden inline-flex items-center gap-1 px-2.5 min-h-[40px] rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Map</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close routes on this road"
                className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {selectedRoad.isLoading ? (
            <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Finding Odisha bus routes on this road…
            </div>
          ) : selectedRoad.routes.length === 0 ? (
            <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              No scheduled Odisha bus routes pass directly on this road segment. Try tapping a nearby state highway, national highway, or city main road.
            </div>
          ) : (
            <>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {selectedRoad.routes.length} bus route{selectedRoad.routes.length === 1 ? '' : 's'} running here
              </div>
              {selectedRoad.routes.map((route) => {
                const liveOnRoute = allBuses.filter(
                  (b) => b.routeNumber === route.routeNumber || b.routeId === route.id
                ).length;
                return (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => onSelectRoute(route)}
                    className="w-full p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 hover:border-orange-500/60 hover:bg-orange-50/40 dark:hover:bg-slate-800/60 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-bold font-mono tabular-nums text-orange-600 dark:text-orange-400">
                          Route {route.routeNumber}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="text-slate-500 dark:text-slate-400 truncate">
                          {route.fleet}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                        {route.name}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                        {route.stops.length} stops
                        {route.departures[0] ? ` · Dep ${formatTime12Hour(route.departures[0])}` : ''}
                        {liveOnRoute > 0 ? ` · ${liveOnRoute} live` : ''}
                      </div>
                    </div>
                    <CoachLiverySvg fleet={route.fleet} size="sm" />
                  </button>
                );
              })}
            </>
          )}
        </div>
      </aside>
    );
  }

  // 3. SELECTED ROUTE VIEW
  if (selectedRoute) {
    const activeBuses = allBuses.filter(
      (b) => b.routeNumber === selectedRoute.routeNumber || b.routeId === selectedRoute.id
    );
    const estFare = estimateFareInr(selectedRoute.fleet, selectedRoute.distanceKm);

    return (
      <aside
        aria-label={`Route details for ${selectedRoute.routeNumber}`}
        className={containerClass}
      >
        <MobileSheetHandle />

        <div className="px-4 pt-3 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-gradient-to-b from-orange-50/40 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 shrink-0">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-orange-600 dark:text-orange-400">
                  {selectedRoute.fleet}
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{selectedRoute.corridor}</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                Route {selectedRoute.routeNumber}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {selectedRoute.name}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onShowMapMobile}
                aria-label="View route on map"
                className="md:hidden inline-flex items-center gap-1 px-2.5 min-h-[40px] rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Map</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close route details"
                className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 py-2.5 px-3 rounded-xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3">
            <CoachLiverySvg fleet={selectedRoute.fleet} size="md" />
            <div className="text-right text-xs space-y-0.5 font-mono tabular-nums">
              <div className="font-semibold text-slate-900 dark:text-white">
                {selectedRoute.distanceKm} km · {selectedRoute.durationLabel}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                Est. Fare ₹{estFare}
              </div>
              <div className="text-orange-600 dark:text-orange-400 font-semibold">
                {activeBuses.length} live bus{activeBuses.length === 1 ? '' : 'es'}
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-800 dark:text-slate-200">Daily Departures: </span>
            <span className="font-mono tabular-nums">
              {selectedRoute.departures.map((d) => formatTime12Hour(d)).join(' · ')}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeBuses.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-200 mb-2">
                Live Buses Running This Route
              </h3>
              <div className="space-y-1.5">
                {activeBuses.map((b) => (
                  <button
                    key={b.registrationNumber}
                    type="button"
                    onClick={() => onSelectBus(b)}
                    className="w-full p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 hover:border-orange-500/60 hover:bg-orange-50/40 dark:hover:bg-slate-800/60 flex items-center justify-between text-left transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {b.registrationNumber}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Next: {b.nextStopName} · due {formatTime12Hour(b.nextStopEta)}
                      </div>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-orange-600 dark:text-orange-400 font-semibold">
                      {b.speedKmh} km/h →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-200 mb-2">
              Station Stops & Timings ({selectedRoute.stops.length})
            </h3>
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70 border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden">
              {selectedRoute.stops.map((st, idx) => (
                <button
                  key={`${st.stopId}-${idx}`}
                  type="button"
                  onClick={() => {
                    onFocusCoords(st.lat, st.lon, 13);
                    onShowMapMobile();
                  }}
                  className="w-full px-3 py-2.5 flex items-center justify-between text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <span className="text-slate-800 dark:text-slate-200 font-medium truncate">
                    {idx + 1}. {st.stopName}
                  </span>
                  <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0 ml-2">
                    {formatTime12Hour(st.scheduledTime)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // 4. SELECTED STATION / STOP VIEW
  if (selectedStop && stopPanelData) {
    const { routeCount, liveArrivals, routesPassingHere, departures } = stopPanelData;
    const normalizedFilter = departureQuery.trim().toLowerCase();
    const visibleDepartures = normalizedFilter
      ? departures.filter((dep) => {
          const busNums = [...dep.exactServiceLiveBuses, ...dep.relatedRouteLiveBuses]
            .map((b) => b.registrationNumber)
            .join(' ');
          const hay = `${dep.displayRouteCode} ${dep.routeNumber} ${dep.destination} ${dep.origin} ${dep.fleet} ${busNums}`.toLowerCase();
          return hay.includes(normalizedFilter);
        })
      : departures;

    const refStopNameLower = (selectedStop.mirrorStopName || selectedStop.name).toLowerCase();

    return (
      <aside
        aria-label={`Bus stop details for ${selectedStop.name}`}
        className={containerClass}
      >
        <MobileSheetHandle />

        {/* Clean stop header: Name, "Bus stop · X route(s)", Share + Close ONLY (no edit button) */}
        <div className="px-4 pt-3.5 pb-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display leading-snug truncate">
                {selectedStop.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>
                  Bus stop · {routeCount} {routeCount === 1 ? 'route' : 'routes'}
                </span>
                {selectedStop.isTerminal && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-orange-600 dark:text-orange-400 font-semibold">
                      Major terminal
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onShowMapMobile}
                aria-label="View stop on map"
                className="md:hidden inline-flex items-center gap-1 px-2.5 min-h-[38px] rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Map</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopyDeepLink('stop', selectedStop.name)}
                aria-label={`Share ${selectedStop.name} bus stop link`}
                title={copiedLink ? 'Stop link copied' : 'Share stop link'}
                className="w-9 h-9 md:w-8 md:h-8 flex items-center justify-center rounded-full border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {copiedLink ? (
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close bus stop details"
                className="w-9 h-9 md:w-8 md:h-8 flex items-center justify-center rounded-full border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* 1. LIVE ARRIVALS · NEXT 90 MIN */}
          <section aria-label="Live arrivals in next 90 minutes">
            <h3 className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-2">
              LIVE ARRIVALS · NEXT 90 MIN
            </h3>
            {liveArrivals.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                No tracked bus is due here in the next 90 minutes. Not every bus reports its position.
              </p>
            ) : (
              <div className="divide-y divide-slate-200/80 dark:divide-slate-800/80 border-y border-slate-200/80 dark:border-slate-800/80">
                {liveArrivals.slice(0, 12).map((item) => (
                  <button
                    key={item.registrationNumber}
                    type="button"
                    onClick={() => onSelectBus(item.bus)}
                    className="w-full py-2.5 flex items-center justify-between gap-2.5 text-left hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-bold font-mono tracking-tight shrink-0 mt-0.5 ${
                          FLEET_BADGE_CLASS[item.fleet]
                        }`}
                      >
                        {item.displayRouteCode}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">
                          → {item.destination}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          <span>{item.fleet}</span>
                          <span aria-hidden="true" className="mx-1">·</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                            {item.registrationNumber}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {item.etaMinutes <= 1 ? 'Due' : `${item.etaMinutes} min`}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {formatTime12Hour(item.etaTime)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* 2. ROUTES PASSING HERE */}
          <section aria-label="Routes passing this stop">
            <h3 className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-2">
              ROUTES PASSING HERE
            </h3>
            {isLoadingStopSchedule && routesPassingHere.length === 0 ? (
              <div className="flex items-center gap-2">
                <div className="h-7 w-20 rounded-md bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
                <div className="h-7 w-16 rounded-md bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
              </div>
            ) : routesPassingHere.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No scheduled routes indexed for this stop yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {routesPassingHere.map((badge) => (
                  <button
                    key={`${badge.displayRouteCode}-${badge.fleet}`}
                    type="button"
                    onClick={() => onSelectRoute(badge.representativeRoute)}
                    title={`${badge.fleet} · Route ${badge.displayRouteCode} (${badge.departuresCount} ${
                      badge.departuresCount === 1 ? 'departure' : 'departures'
                    })`}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono tracking-tight shadow-2xs transition-colors ${
                      FLEET_BADGE_CLASS[badge.fleet]
                    }`}
                  >
                    <span>{badge.displayRouteCode}</span>
                    {badge.liveBusCount > 0 && (
                      <span
                        aria-label={`${badge.liveBusCount} live`}
                        className="w-1.5 h-1.5 rounded-full bg-white/95"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* 3. DEPARTURES */}
          <section aria-label="Scheduled departures from this stop">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                DEPARTURES{departures.length > 0 ? ` · ${departures.length}` : ''}
              </h3>
              {isLoadingStopSchedule && (
                <span className="text-[11px] text-orange-600 dark:text-orange-400 font-medium">
                  Loading timetable…
                </span>
              )}
            </div>

            {departures.length > 10 && (
              <div className="mb-2.5">
                <input
                  type="search"
                  value={departureQuery}
                  onChange={(e) => setDepartureQuery(e.target.value)}
                  placeholder="Filter by route, destination, bus number…"
                  aria-label="Filter departures at this stop"
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-100/90 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-orange-500"
                />
              </div>
            )}

            {isLoadingStopSchedule && departures.length === 0 ? (
              <div className="space-y-2.5 py-1">
                {[1, 2, 3].map((k) => (
                  <div
                    key={k}
                    className="h-11 rounded-lg bg-slate-100 dark:bg-slate-800/70 animate-pulse"
                  />
                ))}
              </div>
            ) : visibleDepartures.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-1">
                {normalizedFilter
                  ? 'No departures match your filter.'
                  : 'No timetabled departures found for this stop.'}
              </p>
            ) : (
              <div className="divide-y divide-slate-200/80 dark:divide-slate-800/80 border-b border-slate-200/80 dark:border-slate-800/80">
                {visibleDepartures.map((dep) => {
                  const isExpanded = expandedDepartureId === dep.id;
                  const primaryBusNumbers = dep.exactServiceLiveBuses.map(
                    (b) => b.registrationNumber
                  );
                  const fallbackBusNumbers =
                    primaryBusNumbers.length === 0
                      ? dep.relatedRouteLiveBuses.map((b) => b.registrationNumber)
                      : [];
                  const shownBusNumbers =
                    primaryBusNumbers.length > 0 ? primaryBusNumbers : fallbackBusNumbers;

                  return (
                    <div key={dep.id} className="py-2.5">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() =>
                          setExpandedDepartureId((prev) => (prev === dep.id ? null : dep.id))
                        }
                        className="w-full flex items-center justify-between gap-2.5 text-left group"
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span
                            className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-bold font-mono tracking-tight shrink-0 mt-0.5 ${
                              FLEET_BADGE_CLASS[dep.fleet]
                            }`}
                          >
                            {dep.displayRouteCode}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[13px] font-semibold text-slate-900 dark:text-white truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                                → {dep.destination}
                              </span>
                              {dep.isLiveNow && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/70 shrink-0">
                                  LIVE
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              <span>{dep.fleet}</span>
                              {shownBusNumbers.length > 0 && (
                                <>
                                  <span aria-hidden="true" className="mx-1">·</span>
                                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                                    {shownBusNumbers.slice(0, 2).join(', ')}
                                    {shownBusNumbers.length > 2
                                      ? ` +${shownBusNumbers.length - 2}`
                                      : ''}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {dep.departureTime && dep.departureTime !== '--:--' ? (
                            <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                              {formatTime12Hour(dep.departureTime)}
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                              Frequent
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                        </div>
                      </button>

                      {/* EXPANDED DEPARTURE DETAILS */}
                      {isExpanded && (
                        <div className="mt-2.5 p-3 rounded-xl bg-slate-50/95 dark:bg-slate-950/80 border border-slate-200/85 dark:border-slate-800 space-y-3">
                          {/* Service & Fleet Summary */}
                          <div className="flex items-center justify-between gap-2.5">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {dep.fleet}
                              </div>
                              <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                                Route {dep.routeNumber} · {dep.stops.length} stops
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {dep.origin} → {dep.destination}
                                {dep.originDepartureTime && dep.originDepartureTime !== '--:--'
                                  ? ` · Starts ${formatTime12Hour(dep.originDepartureTime)}`
                                  : ''}
                              </div>
                            </div>
                            <CoachLiverySvg fleet={dep.fleet} size="sm" />
                          </div>

                          {/* Live Bus Numbers on This Service */}
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              {dep.exactServiceLiveBuses.length > 0
                                ? `Active Bus Numbers (${dep.exactServiceLiveBuses.length})`
                                : dep.relatedRouteLiveBuses.length > 0
                                ? `Live Buses on Route ${dep.displayRouteCode} (${dep.relatedRouteLiveBuses.length})`
                                : 'Live GPS Bus Numbers'}
                            </div>
                            {dep.exactServiceLiveBuses.length > 0 ||
                            dep.relatedRouteLiveBuses.length > 0 ? (
                              <div className="space-y-1.5">
                                {(dep.exactServiceLiveBuses.length > 0
                                  ? dep.exactServiceLiveBuses
                                  : dep.relatedRouteLiveBuses
                                ).map((b) => (
                                  <button
                                    key={b.registrationNumber}
                                    type="button"
                                    onClick={() => onSelectBus(b)}
                                    className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 hover:border-orange-500/70 flex items-center justify-between gap-2 text-left transition-colors"
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                                          {b.registrationNumber}
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                          ({b.routeNumber})
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                        {b.fleet} · Next: {b.nextStopName}
                                      </div>
                                    </div>
                                    <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 shrink-0">
                                      Track Live →
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                No live GPS bus is reporting on {dep.routeNumber} right now. Bus numbers appear automatically when a coach starts its trip.
                              </p>
                            )}
                          </div>

                          {/* Full Stop-by-Stop Timetable */}
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                              Full Stop Timetable ({dep.stops.length} stops)
                            </div>
                            <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/80">
                              {dep.stops.map((st, sIdx) => {
                                const isThisStop =
                                  sIdx === dep.stopIndex ||
                                  st.stopId === selectedStop.id ||
                                  st.stopName.toLowerCase() === refStopNameLower;
                                return (
                                  <button
                                    key={`${dep.id}-${st.stopId}-${sIdx}`}
                                    type="button"
                                    onClick={() => {
                                      onFocusCoords(st.lat, st.lon, 13);
                                      onShowMapMobile();
                                    }}
                                    className={`w-full px-2.5 py-1.5 flex items-center justify-between gap-2 text-left text-[11px] transition-colors ${
                                      isThisStop
                                        ? 'bg-orange-50/90 dark:bg-orange-950/40 text-orange-900 dark:text-orange-100 font-semibold'
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                    }`}
                                  >
                                    <span className="flex items-center gap-1.5 min-w-0">
                                      <span
                                        aria-hidden="true"
                                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                          isThisStop
                                            ? 'bg-orange-600'
                                            : sIdx < dep.stopIndex
                                            ? 'bg-slate-300 dark:bg-slate-600'
                                            : 'bg-slate-500 dark:bg-slate-400'
                                        }`}
                                      />
                                      <span className="truncate">{st.stopName}</span>
                                      {isThisStop && (
                                        <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 shrink-0">
                                          (This stop)
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                                      {st.scheduledTime && st.scheduledTime !== '--:--'
                                        ? formatTime12Hour(st.scheduledTime)
                                        : `Stop ${sIdx + 1}`}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* View Route on Map Action */}
                          <button
                            type="button"
                            onClick={() => onSelectRoute(dep.routeObj)}
                            className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-orange-600 dark:hover:bg-orange-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <RouteIcon className="w-3.5 h-3.5" />
                            <span>View Route {dep.routeNumber} on Map</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <p className="mt-3 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
              Timetabled times. LIVE: that service has a bus on the road now — tap any departure for full stops &amp; bus details.
            </p>
          </section>
        </div>
      </aside>
    );
  }

  return null;
};
