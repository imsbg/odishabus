import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Crosshair, Info, Layers, Maximize2, Minus, Plus, X } from 'lucide-react';

maplibregl.setWorkerUrl(maplibreWorkerUrl);
import {
  BusRoute,
  BusStop,
  FleetCategory,
  LiveBus,
  MapViewportBounds,
  RoadRoutesSelection,
  UserGpsLocation
} from '../utils/transitTypes';
import {
  createTopDownBusSvg,
  FOLLOW_BUS_TARGET_ZOOM,
  SVG_BUS_MIN_ZOOM
} from '../utils/busMapSprites';
import { isBusSleeping } from '../utils/transitLogic';

interface OdishaTransitMapProps {
  buses: LiveBus[];
  routes: BusRoute[];
  stops: BusStop[];
  selectedBus: LiveBus | null;
  selectedRoute: BusRoute | null;
  selectedStop: BusStop | null;
  selectedRoad: RoadRoutesSelection | null;
  followBus: boolean;
  showRouteMark: boolean;
  onToggleRouteMark: (enabled: boolean) => void;
  onSelectBus: (bus: LiveBus) => void;
  onSelectStop: (stop: BusStop) => void;
  onRoadClick: (lat: number, lon: number, roadName: string) => void;
  onBoundsChange?: (bounds: MapViewportBounds) => void;
  isDark: boolean;
  focusCoords: { lat: number; lon: number; zoom?: number } | null;
}

interface LayerVisibility {
  liveBuses: boolean;
  stops: boolean;
}

function isDrivableRoadLayer(layerId: string, layerType?: string): boolean {
  if (layerType && layerType !== 'line') return false;
  if (!layerId) return false;
  if (
    layerId.includes('label') ||
    layerId.includes('shield') ||
    layerId.includes('rail') ||
    layerId.includes('ferry') ||
    layerId.includes('path') ||
    layerId.includes('footway') ||
    layerId.includes('cycleway') ||
    layerId.includes('aeroway')
  ) {
    return false;
  }
  return (
    layerId.startsWith('road_') ||
    layerId.startsWith('bridge_') ||
    layerId.startsWith('tunnel_') ||
    layerId.startsWith('highway-')
  );
}

function createSleepZzzElement(): HTMLDivElement {
  const root = document.createElement('div');
  root.style.pointerEvents = 'none';
  root.setAttribute('data-testid', 'map-sleep-zzz');
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML =
    '<div class="bus-zzz-wrap">' +
    '<span class="bus-zzz-letter bus-zzz-1">z</span>' +
    '<span class="bus-zzz-letter bus-zzz-2">z</span>' +
    '<span class="bus-zzz-letter bus-zzz-3">Z</span>' +
    '</div>';
  return root;
}

function createUserGpsElement(): HTMLDivElement {
  const root = document.createElement('div');
  root.style.pointerEvents = 'none';
  root.setAttribute('data-testid', 'user-gps-blue-dot');
  root.setAttribute('aria-label', 'Your current GPS location');
  root.innerHTML =
    '<div class="user-gps-marker">' +
    '<span class="user-gps-pulse"></span>' +
    '<span class="user-gps-dot"></span>' +
    '</div>';
  return root;
}

const FLEET_COLOR: Record<FleetCategory, string> = {
  'Shree Jagannath Express': '#e8641b',
  OSRTC: '#d42a2f',
  'Mukhyamantri Bus Seva': '#f08c1c',
  'Ama Bus': '#1f6fb8',
  'Ama Bus AC': '#0284c7',
  'Mo Bus': '#0d9488',
  Standby: '#64748b'
};

const FLEET_ICON_IDS: Record<FleetCategory, string> = {
  'Shree Jagannath Express': 'bus-sje',
  OSRTC: 'bus-osrtc',
  'Mukhyamantri Bus Seva': 'bus-mbs',
  'Ama Bus': 'bus-ama',
  'Ama Bus AC': 'bus-ama-ac',
  'Mo Bus': 'bus-mo',
  Standby: 'bus-standby'
};

const OPENFREEMAP_LIBERTY_URL = 'https://tiles.openfreemap.org/styles/liberty';
let cachedBaseStylePromise: Promise<any> | null = null;

function fetchBaseVectorStyle(): Promise<any> {
  if (!cachedBaseStylePromise) {
    cachedBaseStylePromise = fetch(OPENFREEMAP_LIBERTY_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .catch(() => null);
  }
  return cachedBaseStylePromise;
}

/**
 * Customizes OpenFreeMap vector layers with signature Odisha Bus colors
 * (Warm Ivory + Coastal Blue + Saffron Highways in Light Mode; Deep Midnight Navy + Amber Highways in Dark Mode).
 */
function buildCustomOdishaStyle(baseStyle: any, isDark: boolean): maplibregl.StyleSpecification {
  if (!baseStyle || !Array.isArray(baseStyle.layers)) {
    return {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors'
        }
      },
      layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm' }]
    };
  }

  const style = structuredClone(baseStyle);

  style.layers = style.layers.map((layer: any) => {
    const id: string = layer.id || '';
    const type: string = layer.type || '';
    const paint = { ...(layer.paint || {}) };
    const layout = { ...(layer.layout || {}) };

    if (!isDark) {
      // LIGHT MODE: Warm Odisha Ivory, Coastal Bay Blue, Botanical Forest Sage, Saffron-Amber Highways
      if (type === 'background') {
        paint['background-color'] = '#f7f4ee';
      } else if (type === 'raster' && id === 'natural_earth') {
        paint['raster-opacity'] = 0.25;
      } else if (type === 'fill') {
        if (id === 'water') {
          paint['fill-color'] = '#bae6fd';
        } else if (id === 'park' || id === 'landcover_wood') {
          paint['fill-color'] = '#d7edd9';
        } else if (id === 'landcover_grass' || id === 'landcover_wetland') {
          paint['fill-color'] = '#e4f3e2';
        } else if (id === 'landuse_residential') {
          paint['fill-color'] = '#f0ebe2';
        } else if (id === 'building') {
          paint['fill-color'] = '#e7e0d5';
        }
      } else if (type === 'fill-extrusion' && id === 'building-3d') {
        paint['fill-extrusion-color'] = '#e7e0d5';
      } else if (type === 'line') {
        if (id.startsWith('waterway_')) {
          paint['line-color'] = '#7dd3fc';
        } else if (id.includes('motorway') && id.includes('casing')) {
          paint['line-color'] = '#ea580c';
        } else if (id.includes('motorway')) {
          paint['line-color'] = '#fdba74';
        } else if (id.includes('trunk_primary') && id.includes('casing')) {
          paint['line-color'] = '#f59e0b';
        } else if (id.includes('trunk_primary')) {
          paint['line-color'] = '#fde68a';
        } else if (id.includes('secondary_tertiary') && id.includes('casing')) {
          paint['line-color'] = '#cbd5e1';
        } else if (id.includes('secondary_tertiary')) {
          paint['line-color'] = '#ffffff';
        } else if (id.startsWith('boundary_')) {
          paint['line-color'] = '#cbd5e1';
        }
      } else if (type === 'symbol') {
        if (id.startsWith('label_city') || id === 'label_town' || id === 'label_village') {
          paint['text-color'] = '#0f172a';
          paint['text-halo-color'] = '#ffffff';
          paint['text-halo-width'] = 1.6;
        } else if (id === 'label_state') {
          paint['text-color'] = '#9a3412';
          paint['text-halo-color'] = '#fff7ed';
        }
      }
    } else {
      // DARK MODE: Deep Midnight Slate, Dark Bay Navy, Emerald Forests, Warm Amber Highways
      if (type === 'background') {
        paint['background-color'] = '#0b1220';
      } else if (type === 'raster' && id === 'natural_earth') {
        layout['visibility'] = 'none';
      } else if (type === 'fill') {
        if (id === 'water') {
          paint['fill-color'] = '#082038';
        } else if (id === 'park' || id === 'landcover_wood') {
          paint['fill-color'] = '#0e241f';
        } else if (id === 'landcover_grass' || id === 'landcover_wetland' || id === 'landuse_pitch') {
          paint['fill-color'] = '#112a24';
        } else if (
          id === 'landuse_residential' ||
          id === 'landuse_cemetery' ||
          id === 'landuse_hospital' ||
          id === 'landuse_school'
        ) {
          paint['fill-color'] = '#101a2d';
        } else if (id === 'landcover_sand') {
          paint['fill-color'] = '#1e2430';
        } else if (id === 'building') {
          paint['fill-color'] = '#162238';
        }
      } else if (type === 'fill-extrusion' && id === 'building-3d') {
        paint['fill-extrusion-color'] = '#162238';
      } else if (type === 'line') {
        if (id.startsWith('waterway_')) {
          paint['line-color'] = '#0e3257';
        } else if (id.includes('motorway') && id.includes('casing')) {
          paint['line-color'] = '#451a03';
        } else if (id.includes('motorway')) {
          paint['line-color'] = '#c2410c';
        } else if (id.includes('trunk_primary') && id.includes('casing')) {
          paint['line-color'] = '#451a03';
        } else if (id.includes('trunk_primary')) {
          paint['line-color'] = '#b45309';
        } else if (id.includes('secondary_tertiary') && id.includes('casing')) {
          paint['line-color'] = '#0f172a';
        } else if (id.includes('secondary_tertiary')) {
          paint['line-color'] = '#23324a';
        } else if (id.startsWith('road_') || id.startsWith('bridge_') || id.startsWith('tunnel_')) {
          paint['line-color'] = id.includes('casing') ? '#0b1220' : '#182438';
        } else if (id.startsWith('boundary_')) {
          paint['line-color'] = '#334155';
        }
      } else if (type === 'symbol') {
        if (paint['text-color']) paint['text-color'] = '#cbd5e1';
        paint['text-halo-color'] = '#0b1220';
        paint['text-halo-width'] = 1.6;
      }
    }

    // Render "Kataka" instead of "Cuttack" on MapLibre base map place/city labels too
    if (
      type === 'symbol' &&
      layout['text-field'] &&
      (id.startsWith('label_city') || id === 'label_town' || id === 'label_village' || id === 'label_other')
    ) {
      const fallbackField = Array.isArray(layout['text-field'])
        ? layout['text-field']
        : ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']];
      layout['text-field'] = [
        'case',
        [
          '==',
          ['downcase', ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name'], '']],
          'cuttack'
        ],
        'Kataka',
        fallbackField
      ];
    }

    return {
      ...layer,
      paint,
      ...(Object.keys(layout).length > 0 ? { layout } : {})
    };
  });

  return style;
}

/**
 * Generates crisp, enlarged circular directional bus marker icons (circle + directional bearing pointer + bus silhouette)
 * rendered smoothly at 60 FPS on the MapLibre WebGL canvas.
 */
function createDirectionalBusIcon(color: string, isSelected: boolean): ImageData {
  const size = isSelected ? 92 : 68;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2 + (isSelected ? 5 : 4);
  const r = isSelected ? 25 : 18.5;

  // Soft outer halo for selected bus
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(cx, cy, r + 11, 0, Math.PI * 2);
    ctx.fillStyle = `${color}3d`;
    ctx.fill();
  }

  // Directional pointer triangle pointing NORTH (MapLibre icon-rotate rotates clockwise by bearing)
  const tipY = cy - r - (isSelected ? 15 : 12);
  const baseY = cy - r + 2.5;
  const halfW = isSelected ? 10.5 : 8;
  ctx.beginPath();
  ctx.moveTo(cx, tipY);
  ctx.lineTo(cx + halfW, baseY);
  ctx.lineTo(cx - halfW, baseY);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = isSelected ? 2.6 : 2.2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Main circular badge
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = isSelected ? 4 : 3;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Crisp bus front silhouette inside circle
  const bw = isSelected ? 19 : 14;
  const bh = isSelected ? 21 : 15;
  const bx = cx - bw / 2;
  const by = cy - bh / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, isSelected ? 3.5 : 2.5);
  ctx.fill();

  // Windshield cutout
  ctx.fillStyle = color;
  ctx.fillRect(bx + 2.4, by + 3, bw - 4.8, bh * 0.43);

  // Headlights
  ctx.beginPath();
  ctx.arc(bx + 3.8, by + bh - 3.6, isSelected ? 1.8 : 1.4, 0, Math.PI * 2);
  ctx.arc(bx + bw - 3.8, by + bh - 3.6, isSelected ? 1.8 : 1.4, 0, Math.PI * 2);
  ctx.fill();

  return ctx.getImageData(0, 0, size, size);
}

/**
 * Generates bold white chevron arrow sprite used along active road-snapped routes
 */
function createRouteChevronIcon(): ImageData {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(9, 6);
  ctx.lineTo(22, 16);
  ctx.lineTo(9, 26);
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

let cachedSvgSpritesPromise: Promise<Map<string, HTMLImageElement>> | null = null;

/**
 * Preloads realistic top-down SVG coach sprites for every Odisha fleet (normal & selected)
 * so MapLibre GL registers them synchronously with zero "image not found" flashes.
 */
function preloadTopDownSvgBusSprites(): Promise<Map<string, HTMLImageElement>> {
  if (!cachedSvgSpritesPromise) {
    const entries: Array<{ id: string; svg: string }> = [];
    (Object.keys(FLEET_COLOR) as FleetCategory[]).forEach((fleet) => {
      const baseId = FLEET_ICON_IDS[fleet];
      entries.push({ id: `${baseId}-svg`, svg: createTopDownBusSvg(fleet, false) });
      entries.push({ id: `${baseId}-svg-sel`, svg: createTopDownBusSvg(fleet, true) });
    });

    cachedSvgSpritesPromise = Promise.all(
      entries.map(
        ({ id, svg }) =>
          new Promise<[string, HTMLImageElement | null]>((resolve) => {
            const img = new Image();
            img.onload = () => resolve([id, img]);
            img.onerror = () => resolve([id, null]);
            img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
          })
      )
    ).then((pairs) => {
      const map = new Map<string, HTMLImageElement>();
      for (const [id, img] of pairs) {
        if (img) map.set(id, img);
      }
      return map;
    });
  }
  return cachedSvgSpritesPromise;
}

type GeoJsonCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: {
      type: 'Point' | 'LineString';
      coordinates: any;
    };
    properties: Record<string, any>;
  }[];
};

function buildBusGeoJson(
  buses: LiveBus[],
  selectedReg: string | null,
  followBus: boolean
): GeoJsonCollection {
  return {
    type: 'FeatureCollection',
    features: buses.map((bus) => {
      const isSelected = selectedReg === bus.registrationNumber;
      const isFollowed = isSelected && followBus;
      const baseIcon = FLEET_ICON_IDS[bus.fleet] || 'bus-standby';
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [bus.lon, bus.lat]
        },
        properties: {
          reg: bus.registrationNumber,
          fleet: bus.fleet,
          bearing: Number.isFinite(bus.bearing) ? bus.bearing : 0,
          icon: isSelected ? `${baseIcon}-sel` : baseIcon,
          svgIcon: isSelected ? `${baseIcon}-svg-sel` : `${baseIcon}-svg`,
          isSelected: isSelected ? 1 : 0,
          isFollowed: isFollowed ? 1 : 0,
          sortKey: isFollowed ? 1200 : isSelected ? 1000 : bus.isOnTrip ? 500 : 100
        }
      };
    })
  };
}

function buildStopsGeoJson(stops: BusStop[], selectedStopId: string | null): GeoJsonCollection {
  return {
    type: 'FeatureCollection',
    features: stops.map((stop) => {
      const isSelected = selectedStopId === stop.id;
      const tier = isSelected
        ? 1
        : stop.isTerminal || (stop.degree || 0) >= 14
        ? 1
        : (stop.degree || 0) >= 4
        ? 2
        : 3;
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [stop.lon, stop.lat]
        },
        properties: {
          id: stop.id,
          name: stop.name,
          district: stop.district,
          tier,
          isTerminal: stop.isTerminal ? 1 : 0,
          isSelected: isSelected ? 1 : 0
        }
      };
    })
  };
}

function buildActiveTrackGeoJson(
  selectedBus: LiveBus | null,
  selectedRoute: BusRoute | null
): {
  line: GeoJsonCollection;
  stops: GeoJsonCollection;
} {
  const lineFeatures: GeoJsonCollection['features'] = [];
  const stopFeatures: GeoJsonCollection['features'] = [];

  if (selectedBus) {
    const tripStops = selectedBus.tripStops || [];
    const pathCoords =
      selectedBus.path && selectedBus.path.length >= 2
        ? selectedBus.path
        : tripStops.map((s) => [s.lat, s.lon] as [number, number]);

    if (pathCoords.length >= 2) {
      lineFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: pathCoords.map(([lat, lon]) => [lon, lat])
        },
        properties: { color: '#d946ef' }
      });
    }

    tripStops.forEach((st, idx) => {
      const isEndpoint = idx === 0 || idx === tripStops.length - 1;
      stopFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [st.lon, st.lat]
        },
        properties: {
          stopName: st.stopName,
          status: st.status,
          isEndpoint: isEndpoint ? 1 : 0
        }
      });
    });
  } else if (selectedRoute) {
    const pathCoords =
      selectedRoute.path && selectedRoute.path.length >= 2
        ? selectedRoute.path
        : selectedRoute.stops.map((s) => [s.lat, s.lon] as [number, number]);

    if (pathCoords.length >= 2) {
      lineFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: pathCoords.map(([lat, lon]) => [lon, lat])
        },
        properties: { color: '#d946ef' }
      });
    }

    selectedRoute.stops.forEach((st, idx) => {
      const isEndpoint = idx === 0 || idx === selectedRoute.stops.length - 1;
      stopFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [st.lon, st.lat]
        },
        properties: {
          stopName: st.stopName,
          status: 'upcoming',
          isEndpoint: isEndpoint ? 1 : 0
        }
      });
    });
  }

  return {
    line: { type: 'FeatureCollection', features: lineFeatures },
    stops: { type: 'FeatureCollection', features: stopFeatures }
  };
}

function buildRoadPinGeoJson(selectedRoad: RoadRoutesSelection | null): GeoJsonCollection {
  if (!selectedRoad) {
    return { type: 'FeatureCollection', features: [] };
  }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [selectedRoad.lon, selectedRoad.lat]
        },
        properties: {
          roadName: selectedRoad.roadName
        }
      }
    ]
  };
}

export const OdishaTransitMap: React.FC<OdishaTransitMapProps> = ({
  buses,
  stops,
  selectedBus,
  selectedRoute,
  selectedStop,
  selectedRoad,
  followBus,
  showRouteMark,
  onToggleRouteMark,
  onSelectBus,
  onSelectStop,
  onRoadClick,
  onBoundsChange,
  isDark,
  focusCoords
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const styleReadyRef = useRef<boolean>(false);
  const lastFittedKeyRef = useRef<string>('');
  const currentThemeRef = useRef<boolean>(isDark);
  const sleepMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const userGpsMarkerRef = useRef<maplibregl.Marker | null>(null);

  const busesRef = useRef<LiveBus[]>(buses);
  const stopsRef = useRef<BusStop[]>(stops);
  const selectedBusRef = useRef<LiveBus | null>(selectedBus);
  const selectedRouteRef = useRef<BusRoute | null>(selectedRoute);
  const selectedStopRef = useRef<BusStop | null>(selectedStop);
  const selectedRoadRef = useRef<RoadRoutesSelection | null>(selectedRoad);
  const followBusRef = useRef<boolean>(followBus);
  const showRouteMarkRef = useRef<boolean>(showRouteMark);

  const onSelectBusRef = useRef(onSelectBus);
  const onSelectStopRef = useRef(onSelectStop);
  const onRoadClickRef = useRef(onRoadClick);
  const onBoundsChangeRef = useRef(onBoundsChange);

  busesRef.current = buses;
  stopsRef.current = stops;
  selectedBusRef.current = selectedBus;
  selectedRouteRef.current = selectedRoute;
  selectedStopRef.current = selectedStop;
  selectedRoadRef.current = selectedRoad;
  followBusRef.current = followBus;
  showRouteMarkRef.current = showRouteMark;
  onSelectBusRef.current = onSelectBus;
  onSelectStopRef.current = onSelectStop;
  onRoadClickRef.current = onRoadClick;
  onBoundsChangeRef.current = onBoundsChange;

  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserGpsLocation | null>(null);
  const [layers, setLayers] = useState<LayerVisibility>({
    liveBuses: true,
    stops: true
  });
  const layersRef = useRef(layers);
  layersRef.current = layers;

  // Sync floating animated "z z Z" markers over arrived / resting / parked buses
  const syncSleepingMarkers = (map: maplibregl.Map) => {
    const activeMarkers = sleepMarkersRef.current;
    if (!layersRef.current.liveBuses) {
      activeMarkers.forEach((m) => m.remove());
      activeMarkers.clear();
      return;
    }

    const zoom = map.getZoom();
    const bounds = map.getBounds();
    const desired = new Map<string, LiveBus>();

    const placedPixels: Array<{ x: number; y: number }> = [];
    const sel = selectedBusRef.current;
    if (sel && isBusSleeping(sel)) {
      desired.set(sel.registrationNumber, sel);
      const pt = map.project([sel.lon, sel.lat]);
      placedPixels.push({ x: pt.x, y: pt.y });
    }

    if (zoom >= 13) {
      for (const bus of busesRef.current) {
        if (desired.size >= 16) break;
        if (desired.has(bus.registrationNumber)) continue;
        if (!isBusSleeping(bus)) continue;
        if (
          bus.lat >= bounds.getSouth() &&
          bus.lat <= bounds.getNorth() &&
          bus.lon >= bounds.getWest() &&
          bus.lon <= bounds.getEast()
        ) {
          const pt = map.project([bus.lon, bus.lat]);
          const tooClose = placedPixels.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < 34);
          if (tooClose) continue;
          desired.set(bus.registrationNumber, bus);
          placedPixels.push({ x: pt.x, y: pt.y });
        }
      }
    }

    for (const [reg, marker] of activeMarkers.entries()) {
      if (!desired.has(reg)) {
        marker.remove();
        activeMarkers.delete(reg);
      }
    }

    for (const [reg, bus] of desired.entries()) {
      const existing = activeMarkers.get(reg);
      if (existing) {
        existing.setLngLat([bus.lon, bus.lat]);
      } else {
        const marker = new maplibregl.Marker({
          element: createSleepZzzElement(),
          anchor: 'bottom-left',
          offset: [10, -10]
        })
          .setLngLat([bus.lon, bus.lat])
          .addTo(map);
        activeMarkers.set(reg, marker);
      }
    }
  };

  // Register custom circular & realistic SVG bus sprites + GeoJSON sources & layers whenever style loads
  const attachTransitLayers = async (map: maplibregl.Map, dark: boolean) => {
    const svgSprites = await preloadTopDownSvgBusSprites();
    if (mapRef.current !== map) return;

    // 1. Register enlarged circular directional icons + top-down SVG coaches for every Odisha fleet
    (Object.keys(FLEET_COLOR) as FleetCategory[]).forEach((fleet) => {
      const color = FLEET_COLOR[fleet];
      const baseId = FLEET_ICON_IDS[fleet];
      if (!map.hasImage(baseId)) {
        map.addImage(baseId, createDirectionalBusIcon(color, false), { pixelRatio: 2 });
      }
      if (!map.hasImage(`${baseId}-sel`)) {
        map.addImage(`${baseId}-sel`, createDirectionalBusIcon(color, true), { pixelRatio: 2 });
      }
      const normalSvg = svgSprites.get(`${baseId}-svg`);
      if (normalSvg && !map.hasImage(`${baseId}-svg`)) {
        map.addImage(`${baseId}-svg`, normalSvg, { pixelRatio: 2 });
      }
      const selectedSvg = svgSprites.get(`${baseId}-svg-sel`);
      if (selectedSvg && !map.hasImage(`${baseId}-svg-sel`)) {
        map.addImage(`${baseId}-svg-sel`, selectedSvg, { pixelRatio: 2 });
      }
    });
    if (!map.hasImage('route-chevron')) {
      map.addImage('route-chevron', createRouteChevronIcon(), { pixelRatio: 2 });
    }

    // 2. All Odisha Stations source & tiered WebGL layers
    const stopsData = buildStopsGeoJson(stopsRef.current, selectedStopRef.current?.id || null);
    if (!map.getSource('odisha-stops')) {
      map.addSource('odisha-stops', { type: 'geojson', data: stopsData });
    }

    if (!map.getLayer('odisha-stops-circles')) {
      map.addLayer({
        id: 'odisha-stops-circles',
        type: 'circle',
        source: 'odisha-stops',
        layout: {
          visibility: layersRef.current.stops ? 'visible' : 'none'
        },
        filter: [
          'any',
          ['==', ['get', 'isSelected'], 1],
          ['==', ['get', 'tier'], 1],
          ['all', ['==', ['get', 'tier'], 2], ['>=', ['zoom'], 8]],
          ['all', ['==', ['get', 'tier'], 3], ['>=', ['zoom'], 10.5]]
        ],
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'isSelected'], 1],
            7.5,
            ['==', ['get', 'isTerminal'], 1],
            5.5,
            ['==', ['get', 'tier'], 1],
            4.8,
            3.6
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'isSelected'], 1],
            '#ea580c',
            ['==', ['get', 'isTerminal'], 1],
            '#f97316',
            dark ? '#38bdf8' : '#0f766e'
          ],
          'circle-stroke-color': dark ? '#0f172a' : '#ffffff',
          'circle-stroke-width': ['case', ['==', ['get', 'isSelected'], 1], 2.5, 1.6]
        }
      });
    }

    if (!map.getLayer('odisha-stops-labels')) {
      map.addLayer({
        id: 'odisha-stops-labels',
        type: 'symbol',
        source: 'odisha-stops',
        minzoom: 7.5,
        layout: {
          visibility: layersRef.current.stops ? 'visible' : 'none',
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 13, 12],
          'text-offset': [0, 1.15],
          'text-anchor': 'top',
          'text-optional': true
        },
        filter: [
          'any',
          ['==', ['get', 'isSelected'], 1],
          ['==', ['get', 'tier'], 1],
          ['all', ['==', ['get', 'tier'], 2], ['>=', ['zoom'], 9.5]],
          ['all', ['==', ['get', 'tier'], 3], ['>=', ['zoom'], 11.5]]
        ],
        paint: {
          'text-color': dark ? '#e2e8f0' : '#1e293b',
          'text-halo-color': dark ? '#0b1220' : '#ffffff',
          'text-halo-width': 1.5
        }
      });
    }

    // 3. Active Bus Route Mark (bold route line + chevrons + stop dots, controlled by showRouteMark filter)
    const activeTrack = buildActiveTrackGeoJson(selectedBusRef.current, selectedRouteRef.current);
    const routeMarkVisibility = showRouteMarkRef.current ? 'visible' : 'none';
    if (!map.getSource('odisha-active-line')) {
      map.addSource('odisha-active-line', { type: 'geojson', data: activeTrack.line });
    }
    if (!map.getSource('odisha-active-stops')) {
      map.addSource('odisha-active-stops', { type: 'geojson', data: activeTrack.stops });
    }

    if (!map.getLayer('odisha-active-line-casing')) {
      map.addLayer({
        id: 'odisha-active-line-casing',
        type: 'line',
        source: 'odisha-active-line',
        layout: {
          visibility: routeMarkVisibility,
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': dark ? '#1e1b4b' : '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 10.5, 11, 12.5, 15, 15.5],
          'line-opacity': 0.94
        }
      });
    }
    if (!map.getLayer('odisha-active-line-main')) {
      map.addLayer({
        id: 'odisha-active-line-main',
        type: 'line',
        source: 'odisha-active-line',
        layout: {
          visibility: routeMarkVisibility,
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': '#d946ef',
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 6.5, 11, 8, 15, 10.5],
          'line-opacity': 0.98
        }
      });
    }
    if (!map.getLayer('odisha-active-line-arrows')) {
      map.addLayer({
        id: 'odisha-active-line-arrows',
        type: 'symbol',
        source: 'odisha-active-line',
        layout: {
          visibility: routeMarkVisibility,
          'symbol-placement': 'line',
          'symbol-spacing': 62,
          'icon-image': 'route-chevron',
          'icon-size': 0.86,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });
    }
    if (!map.getLayer('odisha-active-stops-dots')) {
      map.addLayer({
        id: 'odisha-active-stops-dots',
        type: 'circle',
        source: 'odisha-active-stops',
        layout: {
          visibility: routeMarkVisibility
        },
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'status'], 'current'],
            8.5,
            ['==', ['get', 'isEndpoint'], 1],
            7.5,
            5.5
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'status'], 'current'],
            '#e11d48',
            ['==', ['get', 'status'], 'passed'],
            '#d946ef',
            ['==', ['get', 'isEndpoint'], 1],
            '#0f4c5c',
            '#ffffff'
          ],
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'status'], 'upcoming'],
            '#d946ef',
            '#ffffff'
          ],
          'circle-stroke-width': 2.6
        }
      });
    }
    if (!map.getLayer('odisha-active-stops-labels')) {
      map.addLayer({
        id: 'odisha-active-stops-labels',
        type: 'symbol',
        source: 'odisha-active-stops',
        layout: {
          visibility: routeMarkVisibility,
          'text-field': ['get', 'stopName'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-optional': true
        },
        paint: {
          'text-color': [
            'case',
            ['==', ['get', 'status'], 'current'],
            '#e11d48',
            dark ? '#f8fafc' : '#0f172a'
          ],
          'text-halo-color': dark ? '#0b1220' : '#ffffff',
          'text-halo-width': 2
        }
      });
    }

    // 4. Clicked Road Pin Layer ("Routes on this road")
    if (!map.getSource('odisha-road-pin')) {
      map.addSource('odisha-road-pin', {
        type: 'geojson',
        data: buildRoadPinGeoJson(selectedRoadRef.current)
      });
    }
    if (!map.getLayer('odisha-road-pin-halo')) {
      map.addLayer({
        id: 'odisha-road-pin-halo',
        type: 'circle',
        source: 'odisha-road-pin',
        paint: {
          'circle-radius': 14,
          'circle-color': '#ea580c',
          'circle-opacity': 0.22
        }
      });
    }
    if (!map.getLayer('odisha-road-pin-dot')) {
      map.addLayer({
        id: 'odisha-road-pin-dot',
        type: 'circle',
        source: 'odisha-road-pin',
        paint: {
          'circle-radius': 6.5,
          'circle-color': '#ea580c',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5
        }
      });
    }

    // 5. Live Buses GPU Symbol Layers:
    //    - Regional/State zoom (< 13.5): Enlarged circular directional arrow markers
    //    - Close street zoom (>= 13.5) OR actively followed bus: Realistic top-down SVG Odisha coaches
    const busData = buildBusGeoJson(
      busesRef.current,
      selectedBusRef.current?.registrationNumber || null,
      followBusRef.current
    );
    const busesVisibility = layersRef.current.liveBuses ? 'visible' : 'none';
    if (!map.getSource('odisha-buses')) {
      map.addSource('odisha-buses', { type: 'geojson', data: busData });
    }
    if (!map.getLayer('odisha-buses-layer')) {
      map.addLayer({
        id: 'odisha-buses-layer',
        type: 'symbol',
        source: 'odisha-buses',
        maxzoom: SVG_BUS_MIN_ZOOM,
        filter: ['!=', ['get', 'isFollowed'], 1],
        layout: {
          visibility: busesVisibility,
          'icon-image': ['get', 'icon'],
          'icon-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6,
            ['case', ['==', ['get', 'isSelected'], 1], 1.0, 0.68],
            9.5,
            ['case', ['==', ['get', 'isSelected'], 1], 1.14, 0.86],
            12.5,
            ['case', ['==', ['get', 'isSelected'], 1], 1.24, 1.02]
          ],
          'icon-rotate': ['get', 'bearing'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'symbol-sort-key': ['get', 'sortKey']
        }
      });
    }
    if (!map.getLayer('odisha-buses-svg-layer')) {
      map.addLayer({
        id: 'odisha-buses-svg-layer',
        type: 'symbol',
        source: 'odisha-buses',
        minzoom: SVG_BUS_MIN_ZOOM,
        layout: {
          visibility: busesVisibility,
          'icon-image': ['get', 'svgIcon'],
          'icon-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            SVG_BUS_MIN_ZOOM,
            ['case', ['==', ['get', 'isSelected'], 1], 0.72, 0.56],
            15.2,
            ['case', ['==', ['get', 'isSelected'], 1], 0.92, 0.76],
            17.5,
            ['case', ['==', ['get', 'isSelected'], 1], 1.12, 0.96]
          ],
          'icon-rotate': ['get', 'bearing'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'symbol-sort-key': ['get', 'sortKey']
        }
      });
    }
    if (!map.getLayer('odisha-followed-bus-svg-layer')) {
      map.addLayer({
        id: 'odisha-followed-bus-svg-layer',
        type: 'symbol',
        source: 'odisha-buses',
        maxzoom: SVG_BUS_MIN_ZOOM,
        filter: ['==', ['get', 'isFollowed'], 1],
        layout: {
          visibility: busesVisibility,
          'icon-image': ['get', 'svgIcon'],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.62, 11, 0.76, SVG_BUS_MIN_ZOOM, 0.85],
          'icon-rotate': ['get', 'bearing'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'symbol-sort-key': 1500
        }
      });
    }

    styleReadyRef.current = true;
  };

  // Initialize MapLibre GL map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      const baseStyle = await fetchBaseVectorStyle();
      if (cancelled || !containerRef.current) return;

      const customStyle = buildCustomOdishaStyle(baseStyle, currentThemeRef.current);

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: customStyle,
        center: [84.78, 20.42], // Odisha state center [lon, lat]
        zoom: 6.8,
        minZoom: 4.5,
        maxZoom: 18,
        attributionControl: { compact: true }
      });

      mapRef.current = map;

      const emitBounds = () => {
        const b = map.getBounds();
        onBoundsChangeRef.current?.({
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
          zoom: map.getZoom()
        });
      };

      map.on('style.load', () => {
        void attachTransitLayers(map, currentThemeRef.current).then(() => {
          syncSleepingMarkers(map);
          emitBounds();
        });
      });

      map.on('moveend', () => {
        emitBounds();
        syncSleepingMarkers(map);
      });

      // Pointer cursor on interactive features (buses, SVG buses, stations, drivable roads ONLY)
      map.on('mousemove', (e: maplibregl.MapMouseEvent) => {
        if (!styleReadyRef.current) return;
        const interactiveLayers = [
          'odisha-buses-layer',
          'odisha-buses-svg-layer',
          'odisha-followed-bus-svg-layer',
          'odisha-stops-circles',
          'odisha-stops-labels'
        ].filter((id) => Boolean(map.getLayer(id)));
        const hits = interactiveLayers.length > 0 ? map.queryRenderedFeatures(e.point, { layers: interactiveLayers }) : [];
        if (hits.length > 0) {
          map.getCanvas().style.cursor = 'pointer';
          return;
        }
        // Check strictly if hovering a drivable road
        const allAtPoint = map.queryRenderedFeatures(e.point);
        const isRoad = allAtPoint.some((f: maplibregl.MapGeoJSONFeature) =>
          isDrivableRoadLayer(f.layer?.id || '', f.layer?.type)
        );
        map.getCanvas().style.cursor = isRoad ? 'pointer' : '';
      });

      // Unified Click Handler: 1) Bus (Circle or SVG) -> 2) Station -> 3) Strict Road ONLY ("Routes on this road")
      map.on('click', (e: maplibregl.MapMouseEvent) => {
        if (!styleReadyRef.current) return;

        // 1. Check live bus hit across circular & SVG coach layers
        const busLayers = [
          'odisha-followed-bus-svg-layer',
          'odisha-buses-svg-layer',
          'odisha-buses-layer'
        ].filter((id) => Boolean(map.getLayer(id)));
        if (busLayers.length > 0) {
          const busHits = map.queryRenderedFeatures(e.point, { layers: busLayers });
          if (busHits.length > 0) {
            const reg = busHits[0].properties?.reg;
            const found = busesRef.current.find((b) => b.registrationNumber === reg);
            if (found) {
              onSelectBusRef.current(found);
              return;
            }
          }
        }

        // 2. Check station hit (with small touch-friendly bbox)
        const stopLayers = ['odisha-stops-circles', 'odisha-stops-labels'].filter((id) => Boolean(map.getLayer(id)));
        if (stopLayers.length > 0) {
          const stopBox: [maplibregl.PointLike, maplibregl.PointLike] = [
            [e.point.x - 6, e.point.y - 6],
            [e.point.x + 6, e.point.y + 6]
          ];
          const stopHits = map.queryRenderedFeatures(stopBox, { layers: stopLayers });
          if (stopHits.length > 0) {
            const stopId = stopHits[0].properties?.id;
            const found = stopsRef.current.find((s) => s.id === stopId);
            if (found) {
              onSelectStopRef.current(found);
              return;
            }
          }
        }

        // 3. Click strictly on a road -> show ALL "Routes on this road" (clicking outside roads does nothing!)
        const roadBox: [maplibregl.PointLike, maplibregl.PointLike] = [
          [e.point.x - 6, e.point.y - 6],
          [e.point.x + 6, e.point.y + 6]
        ];
        const features = map.queryRenderedFeatures(roadBox);
        const roadFeature = features.find((f: maplibregl.MapGeoJSONFeature) =>
          isDrivableRoadLayer(f.layer?.id || '', f.layer?.type)
        );

        if (roadFeature) {
          const props = roadFeature.properties || {};
          const rawName = String(props['name:en'] || props.name || '').trim();
          const rawRef = String(props.ref || '').trim();
          const roadName =
            rawName && rawRef && !rawName.includes(rawRef)
              ? `${rawRef} · ${rawName}`
              : rawName || rawRef || 'Odisha Road';
          onRoadClickRef.current(e.lngLat.lat, e.lngLat.lng, roadName);
        }
      });

      resizeObserver = new ResizeObserver(() => {
        map.resize();
      });
      resizeObserver.observe(containerRef.current);
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      sleepMarkersRef.current.forEach((m) => m.remove());
      sleepMarkersRef.current.clear();
      userGpsMarkerRef.current?.remove();
      userGpsMarkerRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      styleReadyRef.current = false;
    };
  }, []);

  // Theme switch: rebuild custom MapLibre vector style cleanly
  useEffect(() => {
    currentThemeRef.current = isDark;
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;
    (async () => {
      const baseStyle = await fetchBaseVectorStyle();
      if (cancelled || !mapRef.current) return;
      styleReadyRef.current = false;
      mapRef.current.setStyle(buildCustomOdishaStyle(baseStyle, isDark));
    })();

    return () => {
      cancelled = true;
    };
  }, [isDark]);

  // Sync live buses data into GeoJSON source & animated sleep zzz markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const src = map.getSource('odisha-buses') as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData(buildBusGeoJson(buses, selectedBus?.registrationNumber || null, followBus));
    }
    syncSleepingMarkers(map);
  }, [buses, selectedBus, followBus]);

  // Sync ALL stations data into GeoJSON source
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const src = map.getSource('odisha-stops') as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData(buildStopsGeoJson(stops, selectedStop?.id || null));
    }
  }, [stops, selectedStop]);

  // Sync active selected bus / selected route track (NEVER zooms out when clicking a bus!)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;

    const activeTrack = buildActiveTrackGeoJson(selectedBus, selectedRoute);
    const lineSrc = map.getSource('odisha-active-line') as maplibregl.GeoJSONSource | undefined;
    const stopsSrc = map.getSource('odisha-active-stops') as maplibregl.GeoJSONSource | undefined;
    if (lineSrc) lineSrc.setData(activeTrack.line);
    if (stopsSrc) stopsSrc.setData(activeTrack.stops);

    if (selectedBus) {
      const busKey = `bus-${selectedBus.registrationNumber}`;
      if (lastFittedKeyRef.current !== busKey) {
        lastFittedKeyRef.current = busKey;
        if (!followBusRef.current) {
          // Never zoom out on bus click: preserve user's current zoom if zoomed in, or gently zoom in if at state overview
          const currentZoom = map.getZoom();
          map.easeTo({
            center: [selectedBus.lon, selectedBus.lat],
            zoom: Math.max(currentZoom, 10.5),
            duration: 500
          });
        }
      }
    } else if (selectedRoute) {
      const pathCoords =
        selectedRoute.path && selectedRoute.path.length >= 2
          ? selectedRoute.path
          : selectedRoute.stops.map((s) => [s.lat, s.lon] as [number, number]);
      const fitKey = `route-${selectedRoute.id}-${pathCoords.length}`;
      if (lastFittedKeyRef.current !== fitKey && pathCoords.length >= 2) {
        lastFittedKeyRef.current = fitKey;
        const bounds = new maplibregl.LngLatBounds();
        pathCoords.forEach(([lat, lon]) => bounds.extend([lon, lat]));
        map.fitBounds(bounds, { padding: 56, maxZoom: 13, duration: 750 });
      }
    } else {
      lastFittedKeyRef.current = '';
    }
  }, [selectedBus, selectedRoute]);

  // Sync clicked road pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const pinSrc = map.getSource('odisha-road-pin') as maplibregl.GeoJSONSource | undefined;
    if (pinSrc) {
      pinSrc.setData(buildRoadPinGeoJson(selectedRoad));
    }
  }, [selectedRoad]);

  // Follow bus smoothly — zooms cleanly into street/highway level so the realistic SVG coach leads the view
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !followBus || !selectedBus) return;
    map.easeTo({
      center: [selectedBus.lon, selectedBus.lat],
      zoom: Math.max(map.getZoom(), FOLLOW_BUS_TARGET_ZOOM),
      duration: 750
    });
  }, [followBus, selectedBus?.lat, selectedBus?.lon, selectedBus?.registrationNumber]);

  // Explicit focus coordinates (e.g. clicking a stop or station)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusCoords) return;
    map.flyTo({
      center: [focusCoords.lon, focusCoords.lat],
      zoom: focusCoords.zoom ?? 13,
      duration: 700
    });
  }, [focusCoords]);

  // Sync layer visibility toggles (including Bus Route Mark toggle from filter bar & layer menu)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;

    const busVis = layers.liveBuses ? 'visible' : 'none';
    for (const lid of ['odisha-buses-layer', 'odisha-buses-svg-layer', 'odisha-followed-bus-svg-layer']) {
      if (map.getLayer(lid)) {
        map.setLayoutProperty(lid, 'visibility', busVis);
      }
    }

    const stopVis = layers.stops ? 'visible' : 'none';
    for (const lid of ['odisha-stops-circles', 'odisha-stops-labels']) {
      if (map.getLayer(lid)) {
        map.setLayoutProperty(lid, 'visibility', stopVis);
      }
    }

    const routeMarkVis = showRouteMark ? 'visible' : 'none';
    for (const lid of [
      'odisha-active-line-casing',
      'odisha-active-line-main',
      'odisha-active-line-arrows',
      'odisha-active-stops-dots',
      'odisha-active-stops-labels'
    ]) {
      if (map.getLayer(lid)) {
        map.setLayoutProperty(lid, 'visibility', routeMarkVis);
      }
    }

    syncSleepingMarkers(map);
  }, [layers, showRouteMark]);

  // Render pulsing blue GPS dot at the user's REAL location whenever available
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;

    if (!userGpsMarkerRef.current) {
      userGpsMarkerRef.current = new maplibregl.Marker({
        element: createUserGpsElement(),
        anchor: 'center'
      })
        .setLngLat([userLocation.lon, userLocation.lat])
        .addTo(map);
    } else {
      userGpsMarkerRef.current.setLngLat([userLocation.lon, userLocation.lat]);
    }
  }, [userLocation]);

  const handleZoomIn = () => mapRef.current?.zoomIn({ duration: 250 });
  const handleZoomOut = () => mapRef.current?.zoomOut({ duration: 250 });
  const handleResetOdishaView = () => {
    lastFittedKeyRef.current = '';
    mapRef.current?.flyTo({ center: [84.78, 20.42], zoom: 6.8, duration: 650 });
  };

  // Real browser GPS location ONLY — never falls back to Bhubaneswar; plots a pulsing blue dot
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      setLocationMessage('GPS location is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setUserLocation({
          lat,
          lon,
          accuracyMeters: pos.coords.accuracy
        });
        mapRef.current?.flyTo({
          center: [lon, lat],
          zoom: Math.max(mapRef.current?.getZoom() || 0, 15),
          duration: 750
        });
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationMessage('Location access was denied. Enable GPS permission in your browser to center on your real location.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setLocationMessage('Your GPS location is currently unavailable. Please check device location settings.');
        } else {
          setLocationMessage('Timed out waiting for your GPS location. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-[#f7f4ee] dark:bg-[#0b1220]"
      data-testid="odisha-map-canvas"
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* GPS Status Banner when location access fails (never silently jumps to Bhubaneswar) */}
      {locationMessage && (
        <div
          role="status"
          className="absolute top-3 left-3 right-16 md:right-auto md:max-w-sm z-20 flex items-start justify-between gap-2.5 px-3 py-2 rounded-xl bg-white/96 dark:bg-slate-900/96 backdrop-blur-md border border-blue-200 dark:border-blue-800/80 text-xs text-slate-700 dark:text-slate-200 shadow-lg"
        >
          <span className="leading-snug">{locationMessage}</span>
          <button
            type="button"
            onClick={() => setLocationMessage(null)}
            aria-label="Dismiss location notice"
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Subtle Road-Click Hint on Desktop when nothing selected */}
      {!locationMessage && !selectedBus && !selectedRoute && !selectedStop && !selectedRoad && (
        <div className="absolute top-3 left-3 z-10 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/92 dark:bg-slate-900/92 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 shadow-sm pointer-events-none">
          <span>Tap any bus, station, or road to inspect live routes</span>
        </div>
      )}

      {/* Bottom-Left Fleet Livery Legend Strip (desktop) */}
      <div className="absolute bottom-4 left-4 z-10 hidden xl:flex flex-wrap items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/92 dark:bg-slate-900/92 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 shadow-md max-w-[calc(100%-5rem)]">
        <span className="font-semibold text-slate-900 dark:text-white">Fleets:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#e8641b]" />
          <span>Shree Jagannath Express</span>
        </span>
        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#d42a2f]" />
          <span>OSRTC</span>
        </span>
        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f08c1c]" />
          <span>Mukhyamantri Bus Seva</span>
        </span>
        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1f6fb8]" />
          <span>Ama Bus / AC</span>
        </span>
        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#0d9488]" />
          <span>Mo Bus</span>
        </span>
        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#64748b]" />
          <span>Off Duty</span>
        </span>
      </div>

      {/* Right Map Action Controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setLayerMenuOpen((prev) => !prev)}
          aria-label="Toggle map layers"
          aria-expanded={layerMenuOpen}
          className={`w-11 h-11 md:w-10 md:h-10 flex items-center justify-center rounded-xl border shadow-md backdrop-blur-md transition-all ${
            layerMenuOpen
              ? 'bg-orange-600 text-white border-orange-500'
              : 'bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleResetOdishaView}
          aria-label="Fit entire Odisha network"
          title="Fit entire Odisha network"
          className="w-11 h-11 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-800 shadow-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleLocateUser}
          disabled={isLocating}
          aria-label="Center on my location"
          title="Center on my real GPS location"
          className={`w-11 h-11 md:w-10 md:h-10 flex items-center justify-center rounded-xl backdrop-blur-md border shadow-md transition-colors ${
            userLocation
              ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500'
              : 'bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Crosshair className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
        </button>

        <div className="flex flex-col rounded-xl overflow-hidden border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-md">
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="Zoom in map"
            className="w-11 h-11 md:w-10 md:h-10 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-200/80 dark:border-slate-800"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label="Zoom out map"
            className="w-11 h-11 md:w-10 md:h-10 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setInfoOpen((prev) => !prev);
            setLayerMenuOpen(false);
          }}
          aria-label="Live data information and accuracy notice"
          aria-expanded={infoOpen}
          title="Live data accuracy notice"
          className={`w-11 h-11 md:w-10 md:h-10 flex items-center justify-center rounded-xl border shadow-md backdrop-blur-md transition-all ${
            infoOpen
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
              : 'bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* Info (i) Live Data Accuracy Notice Popover */}
      {infoOpen && (
        <div
          role="dialog"
          aria-label="Live data accuracy notice"
          className="absolute top-3 right-16 z-20 w-72 rounded-xl bg-white/96 dark:bg-slate-900/96 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-xl p-3.5 text-xs space-y-2"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-1.5">
            <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              <span>Live Data Notice</span>
            </span>
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              aria-label="Close live data notice"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Live bus positions, routes, and arrival times are fetched directly from public Odisha transit GPS feeds. Because GPS signals and schedules can occasionally lag or drop, this map may sometimes display delayed or inaccurate information.
          </p>
        </div>
      )}

      {/* Layers Popover Menu */}
      {layerMenuOpen && (
        <div
          role="dialog"
          aria-label="Map layer visibility controls"
          className="absolute top-3 right-16 z-20 w-56 rounded-xl bg-white/96 dark:bg-slate-900/96 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-xl p-3 text-xs space-y-2.5"
        >
          <div className="font-semibold text-slate-900 dark:text-white border-b border-slate-200/80 dark:border-slate-800 pb-1.5">
            Map Layers
          </div>
          <label className="flex items-center justify-between gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
            <span>Live Odisha Buses</span>
            <input
              type="checkbox"
              checked={layers.liveBuses}
              onChange={(e) => setLayers((prev) => ({ ...prev, liveBuses: e.target.checked }))}
              className="rounded accent-orange-600"
            />
          </label>
          <label className="flex items-center justify-between gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
            <span>Bus Route Mark</span>
            <input
              type="checkbox"
              checked={showRouteMark}
              onChange={(e) => onToggleRouteMark(e.target.checked)}
              className="rounded accent-fuchsia-600"
            />
          </label>
          <label className="flex items-center justify-between gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
            <span>All Bus Stations</span>
            <input
              type="checkbox"
              checked={layers.stops}
              onChange={(e) => setLayers((prev) => ({ ...prev, stops: e.target.checked }))}
              className="rounded accent-orange-600"
            />
          </label>
        </div>
      )}
    </div>
  );
};
