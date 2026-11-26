import { FleetCategory } from './transitTypes';

export const SVG_BUS_MIN_ZOOM = 13.5;
export const FOLLOW_BUS_TARGET_ZOOM = 15.2;

export interface TopDownBusPalette {
  body: string;
  roof: string;
  accent: string;
  stripe: string;
  trim: string;
  hasAcPod: boolean;
  hasRoofCarrier: boolean;
  isLongCoach: boolean;
}

export const TOP_DOWN_BUS_PALETTES: Record<FleetCategory, TopDownBusPalette> = {
  'Shree Jagannath Express': {
    body: '#ffffff',
    roof: '#f8fafc',
    accent: '#e8641b',
    stripe: '#f97316',
    trim: '#9a3412',
    hasAcPod: true,
    hasRoofCarrier: false,
    isLongCoach: true
  },
  OSRTC: {
    body: '#d42a2f',
    roof: '#dc2626',
    accent: '#facc15',
    stripe: '#fef08a',
    trim: '#7f1d1d',
    hasAcPod: false,
    hasRoofCarrier: true,
    isLongCoach: false
  },
  'Mukhyamantri Bus Seva': {
    body: '#fffbeb',
    roof: '#ffffff',
    accent: '#f08c1c',
    stripe: '#ea580c',
    trim: '#b45309',
    hasAcPod: false,
    hasRoofCarrier: false,
    isLongCoach: false
  },
  'Ama Bus': {
    body: '#ffffff',
    roof: '#f1f5f9',
    accent: '#1f6fb8',
    stripe: '#f08a1c',
    trim: '#1e40af',
    hasAcPod: true,
    hasRoofCarrier: false,
    isLongCoach: false
  },
  'Ama Bus AC': {
    body: '#1d4ed8',
    roof: '#2563eb',
    accent: '#ffffff',
    stripe: '#93c5fd',
    trim: '#1e3a8a',
    hasAcPod: true,
    hasRoofCarrier: false,
    isLongCoach: false
  },
  'Mo Bus': {
    body: '#0d9488',
    roof: '#14b8a6',
    accent: '#fbbf24',
    stripe: '#ccfbf1',
    trim: '#115e59',
    hasAcPod: true,
    hasRoofCarrier: false,
    isLongCoach: false
  },
  Standby: {
    body: '#94a3b8',
    roof: '#cbd5e1',
    accent: '#475569',
    stripe: '#e2e8f0',
    trim: '#334155',
    hasAcPod: false,
    hasRoofCarrier: false,
    isLongCoach: false
  }
};

/**
 * Pure helper determining whether a bus should render as the realistic top-down SVG coach
 * instead of the regional circular directional icon.
 */
export function shouldRenderSvgBus(zoom: number, isFollowed: boolean): boolean {
  return isFollowed || zoom >= SVG_BUS_MIN_ZOOM;
}

/**
 * Generates a realistic top-down SVG Odisha bus coach pointing NORTH (0° bearing)
 * so MapLibre GL `icon-rotate` aligns the nose of the coach smoothly along the road.
 */
export function createTopDownBusSvg(fleet: FleetCategory, isSelected: boolean): string {
  const p = TOP_DOWN_BUS_PALETTES[fleet] || TOP_DOWN_BUS_PALETTES.OSRTC;
  const width = isSelected ? 120 : 96;
  const height = isSelected ? 204 : 168;
  const cx = width / 2;

  const busW = p.isLongCoach ? 44 : 40;
  const busH = p.isLongCoach ? 128 : 114;
  const bx = cx - busW / 2;
  const by = (height - busH) / 2 + 4;

  const haloMarkup = isSelected
    ? `
      <ellipse cx="${cx}" cy="${by + busH / 2}" rx="${busW * 0.96}" ry="${busH * 0.64}" fill="${p.accent}" fill-opacity="0.18" />
      <ellipse cx="${cx}" cy="${by + busH / 2}" rx="${busW * 0.78}" ry="${busH * 0.56}" fill="none" stroke="${p.accent}" stroke-width="2.5" stroke-opacity="0.72" />
      <path d="M ${bx + 7} ${by + 3} L ${bx - 2} ${by - 26} L ${bx + 18} ${by - 26} L ${bx + 14} ${by + 3} Z" fill="#fef08a" fill-opacity="0.45" />
      <path d="M ${bx + busW - 7} ${by + 3} L ${bx + busW + 2} ${by - 26} L ${bx + busW - 18} ${by - 26} L ${bx + busW - 14} ${by + 3} Z" fill="#fef08a" fill-opacity="0.45" />
    `
    : '';

  const acPodMarkup = p.hasAcPod
    ? `
      <rect x="${cx - 12}" y="${by + 36}" width="24" height="32" rx="6" fill="#e2e8f0" stroke="${p.trim}" stroke-width="1.3" />
      <rect x="${cx - 8.5}" y="${by + 41}" width="17" height="9" rx="2.5" fill="#94a3b8" />
      <rect x="${cx - 8.5}" y="${by + 54}" width="17" height="9" rx="2.5" fill="#94a3b8" />
      <circle cx="${cx - 4}" cy="${by + 45.5}" r="2.6" fill="#475569" />
      <circle cx="${cx + 4}" cy="${by + 45.5}" r="2.6" fill="#475569" />
      <circle cx="${cx - 4}" cy="${by + 58.5}" r="2.6" fill="#475569" />
      <circle cx="${cx + 4}" cy="${by + 58.5}" r="2.6" fill="#475569" />
    `
    : p.hasRoofCarrier
    ? `
      <rect x="${cx - 13}" y="${by + 34}" width="26" height="44" rx="4" fill="none" stroke="#e2e8f0" stroke-width="2" />
      <line x1="${cx - 12}" y1="${by + 43}" x2="${cx + 12}" y2="${by + 43}" stroke="#cbd5e1" stroke-width="1.4" />
      <line x1="${cx - 12}" y1="${by + 52}" x2="${cx + 12}" y2="${by + 52}" stroke="#cbd5e1" stroke-width="1.4" />
      <line x1="${cx - 12}" y1="${by + 61}" x2="${cx + 12}" y2="${by + 61}" stroke="#cbd5e1" stroke-width="1.4" />
      <line x1="${cx - 12}" y1="${by + 70}" x2="${cx + 12}" y2="${by + 70}" stroke="#cbd5e1" stroke-width="1.4" />
    `
    : `
      <rect x="${cx - 10}" y="${by + 38}" width="20" height="14" rx="3" fill="${p.stripe}" fill-opacity="0.22" stroke="${p.trim}" stroke-width="1" />
      <rect x="${cx - 10}" y="${by + 64}" width="20" height="14" rx="3" fill="${p.stripe}" fill-opacity="0.22" stroke="${p.trim}" stroke-width="1" />
    `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${haloMarkup}
  <!-- Realistic soft ground shadow -->
  <rect x="${bx + 4}" y="${by + 6}" width="${busW}" height="${busH}" rx="12" fill="#0f172a" fill-opacity="0.34" />

  <!-- Side rearview mirrors -->
  <path d="M ${bx + 2} ${by + 16} L ${bx - 6} ${by + 12} L ${bx - 6} ${by + 18} L ${bx + 1} ${by + 20} Z" fill="#1e293b" stroke="#ffffff" stroke-width="0.9" />
  <path d="M ${bx + busW - 2} ${by + 16} L ${bx + busW + 6} ${by + 12} L ${bx + busW + 6} ${by + 18} L ${bx + busW - 1} ${by + 20} Z" fill="#1e293b" stroke="#ffffff" stroke-width="0.9" />

  <!-- Main coach chassis -->
  <rect x="${bx}" y="${by}" width="${busW}" height="${busH}" rx="11" fill="${p.body}" stroke="#ffffff" stroke-width="2.4" />
  <rect x="${bx + 1.2}" y="${by + 1.2}" width="${busW - 2.4}" height="${busH - 2.4}" rx="10" fill="${p.body}" stroke="${p.trim}" stroke-width="1.4" />

  <!-- Side accent livery stripes -->
  <rect x="${bx + 2.5}" y="${by + 18}" width="3.5" height="${busH - 34}" rx="1.5" fill="${p.accent}" />
  <rect x="${bx + busW - 6}" y="${by + 18}" width="3.5" height="${busH - 34}" rx="1.5" fill="${p.accent}" />

  <!-- Inner roof crown -->
  <rect x="${bx + 6.5}" y="${by + 21}" width="${busW - 13}" height="${busH - 34}" rx="7" fill="${p.roof}" stroke="${p.stripe}" stroke-width="1.2" />

  <!-- Curved dark panoramic front windshield -->
  <path d="M ${bx + 5} ${by + 18} Q ${cx} ${by + 6} ${bx + busW - 5} ${by + 18} L ${bx + busW - 7} ${by + 26} Q ${cx} ${by + 21} ${bx + 7} ${by + 26} Z" fill="#0f172a" />
  <!-- Windshield sky reflection streak -->
  <path d="M ${bx + 9} ${by + 16.5} Q ${cx} ${by + 10.5} ${bx + busW - 11} ${by + 16}" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-opacity="0.7" />

  <!-- Roof AC unit / luggage carrier / ventilation hatches -->
  ${acPodMarkup}

  <!-- Rear window -->
  <rect x="${bx + 8}" y="${by + busH - 13}" width="${busW - 16}" height="6" rx="2.5" fill="#1e293b" />

  <!-- Front nose bumper accent & bright headlights -->
  <rect x="${cx - 10}" y="${by + 2.5}" width="20" height="3.2" rx="1.5" fill="${p.accent}" />
  <rect x="${bx + 5.5}" y="${by + 2.2}" width="6.5" height="3.5" rx="1.5" fill="#fef08a" stroke="#ca8a04" stroke-width="0.6" />
  <rect x="${bx + busW - 12}" y="${by + 2.2}" width="6.5" height="3.5" rx="1.5" fill="#fef08a" stroke="#ca8a04" stroke-width="0.6" />

  <!-- Rear brake / tail lamps -->
  <rect x="${bx + 5.5}" y="${by + busH - 5.2}" width="6.5" height="3" rx="1.2" fill="#ef4444" />
  <rect x="${bx + busW - 12}" y="${by + busH - 5.2}" width="6.5" height="3" rx="1.2" fill="#ef4444" />
</svg>`;
}
