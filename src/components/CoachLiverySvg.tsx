import React from 'react';
import { FleetCategory } from '../utils/transitTypes';

interface CoachLiverySvgProps {
  fleet: FleetCategory;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

interface LiverySpec {
  keyColor: string;
  body: string;
  roof: string;
  glass: string;
  skirt: string;
  frame: string;
  stripeColor?: string;
  stripeY?: number;
  swoosh?: string[];
  folkMotif?: boolean;
  acPod?: boolean;
  roofCarrier?: boolean;
  axles: 2 | 3;
  panoramicGlass?: boolean;
  tagText: string;
}

export const FLEET_LIVERY_SPECS: Record<FleetCategory, LiverySpec> = {
  'Shree Jagannath Express': {
    keyColor: '#e8641b',
    body: '#fbfbf9',
    roof: '#f0f0ec',
    glass: '#14181d',
    skirt: '#e8641b',
    frame: '#d45511',
    swoosh: ['#e8641b', '#f39a4a'],
    acPod: true,
    axles: 3,
    panoramicGlass: true,
    tagText: 'VOLVO 9600 AC'
  },
  OSRTC: {
    keyColor: '#d42a2f',
    body: '#d62b30',
    roof: '#b91f24',
    glass: '#1c2127',
    skirt: '#991b1f',
    frame: '#8f171b',
    stripeColor: '#f5c542',
    stripeY: 24,
    folkMotif: true,
    roofCarrier: true,
    axles: 2,
    panoramicGlass: false,
    tagText: 'OSRTC EXPRESS'
  },
  'Mukhyamantri Bus Seva': {
    keyColor: '#f08c1c',
    body: '#fbfbf8',
    roof: '#ecece6',
    glass: '#222c35',
    skirt: '#ee7b16',
    frame: '#cbd2d9',
    swoosh: ['#ee7b16', '#f6a531'],
    axles: 2,
    panoramicGlass: false,
    tagText: 'MBS RURAL'
  },
  'Ama Bus': {
    keyColor: '#1f6fb8',
    body: '#fbfbf9',
    roof: '#e9eef4',
    glass: '#1b2530',
    skirt: '#1f6fb8',
    frame: '#1f6fb8',
    stripeColor: '#f08a1c',
    stripeY: 26,
    axles: 2,
    panoramicGlass: false,
    tagText: 'CRUT AMA BUS'
  },
  'Ama Bus AC': {
    keyColor: '#1556a8',
    body: '#1a5fb4',
    roof: '#dbe4f0',
    glass: '#121820',
    skirt: '#103f80',
    frame: '#0e376e',
    stripeColor: '#ffffff',
    stripeY: 26,
    acPod: true,
    axles: 2,
    panoramicGlass: true,
    tagText: 'AMA BUS AC'
  },
  'Mo Bus': {
    keyColor: '#0d9488',
    body: '#0f766e',
    roof: '#ccfbf1',
    glass: '#111c24',
    skirt: '#115e59',
    frame: '#0d9488',
    stripeColor: '#fbbf24',
    stripeY: 25,
    acPod: true,
    axles: 2,
    panoramicGlass: true,
    tagText: 'CRUT MO BUS'
  },
  Standby: {
    keyColor: '#64748b',
    body: '#e2e8f0',
    roof: '#cbd5e1',
    glass: '#1e293b',
    skirt: '#64748b',
    frame: '#64748b',
    stripeColor: '#94a3b8',
    stripeY: 25,
    axles: 2,
    panoramicGlass: false,
    tagText: 'OFF DUTY / STANDBY'
  }
};

export const CoachLiverySvg: React.FC<CoachLiverySvgProps> = ({
  fleet,
  className = '',
  size = 'md'
}) => {
  const spec = FLEET_LIVERY_SPECS[fleet] || FLEET_LIVERY_SPECS.OSRTC;
  const dims =
    size === 'sm'
      ? { width: 84, height: 34 }
      : size === 'lg'
      ? { width: 176, height: 72 }
      : { width: 120, height: 48 };

  const clipId = `coach-clip-${fleet.replace(/\s+/g, '-').toLowerCase()}-${size}`;

  return (
    <svg
      viewBox="0 0 120 48"
      width={dims.width}
      height={dims.height}
      className={`select-none shrink-0 ${className}`}
      role="img"
      aria-label={`${fleet} coach illustration`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="8" y="9" width="102" height="29" rx="5" ry="5" />
        </clipPath>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="59" cy="43" rx="52" ry="2.6" fill="rgba(0,0,0,0.28)" />

      {/* Roof AC Pod or Luggage Carrier */}
      {spec.acPod && (
        <g>
          <rect x="44" y="5" width="26" height="4.5" rx="2" fill={spec.roof} stroke="rgba(0,0,0,0.2)" strokeWidth="0.6" />
          <line x1="48" y1="7" x2="66" y2="7" stroke="rgba(0,0,0,0.22)" strokeWidth="0.8" />
        </g>
      )}
      {spec.roofCarrier && (
        <g stroke="#64748b" strokeWidth="0.9" fill="none">
          <line x1="16" y1="6" x2="68" y2="6" />
          <line x1="20" y1="6" x2="20" y2="9" />
          <line x1="32" y1="6" x2="32" y2="9" />
          <line x1="44" y1="6" x2="44" y2="9" />
          <line x1="56" y1="6" x2="56" y2="9" />
          <line x1="66" y1="6" x2="66" y2="9" />
        </g>
      )}

      {/* Main Coach Body */}
      <g clipPath={`url(#${clipId})`}>
        <rect x="8" y="9" width="102" height="29" fill={spec.body} />
        {/* Roof cap */}
        <rect x="8" y="9" width="102" height="3.2" fill={spec.roof} />
        {/* Lower skirt */}
        <rect x="8" y="30.5" width="102" height="7.5" fill={spec.skirt} />

        {/* Saffron / Amber Swoosh bands for Shree Jagannath Express & Mukhyamantri Bus Seva */}
        {spec.swoosh && (
          <g>
            <path d="M 8 33 Q 36 31 54 13 L 28 13 Q 18 24 8 27 Z" fill={spec.swoosh[0]} />
            {spec.swoosh[1] && (
              <path d="M 8 27 Q 22 23 34 13 L 22 13 Q 14 20 8 23 Z" fill={spec.swoosh[1]} opacity="0.9" />
            )}
          </g>
        )}

        {/* Waist Stripe */}
        {spec.stripeColor && (
          <rect x="8" y={spec.stripeY || 25} width="102" height="1.8" fill={spec.stripeColor} />
        )}

        {/* OSRTC White Folk-Art Triangle Motif Border */}
        {spec.folkMotif && (
          <path
            d="M10 30 L12 27.6 L14 30 L16 27.6 L18 30 L20 27.6 L22 30 L24 27.6 L26 30 L28 27.6 L30 30 L32 27.6 L34 30 L36 27.6 L38 30 L40 27.6 L42 30 L44 27.6 L46 30 L48 27.6 L50 30 L52 27.6 L54 30 L56 27.6 L58 30 L60 27.6 L62 30 L64 27.6 L66 30 L68 27.6 L70 30 L72 27.6 L74 30 L76 27.6 L78 30 L80 27.6 L82 30 L84 27.6 L86 30 L88 27.6 L90 30 L92 27.6 L94 30 L96 27.6 L98 30"
            fill="#ffffff"
            opacity="0.92"
          />
        )}

        {/* Windows */}
        {spec.panoramicGlass ? (
          <g>
            <rect x="11" y="13" width="97" height="10.5" rx="2" fill={spec.glass} />
            {/* Subtle pillar reflections */}
            <line x1="28" y1="13" x2="28" y2="23.5" stroke="rgba(255,255,255,0.12)" strokeWidth="0.9" />
            <line x1="46" y1="13" x2="46" y2="23.5" stroke="rgba(255,255,255,0.12)" strokeWidth="0.9" />
            <line x1="64" y1="13" x2="64" y2="23.5" stroke="rgba(255,255,255,0.12)" strokeWidth="0.9" />
            <line x1="82" y1="13" x2="82" y2="23.5" stroke="rgba(255,255,255,0.12)" strokeWidth="0.9" />
            {/* Entry Door */}
            <rect x="88" y="13.5" width="10" height="21" rx="1.2" fill={spec.glass} stroke="rgba(255,255,255,0.22)" strokeWidth="0.7" />
          </g>
        ) : (
          <g>
            {[12, 25, 38, 51, 64, 77].map((wx) => (
              <rect key={wx} x={wx} y="13.5" width="10.5" height="9.2" rx="1.4" fill={spec.glass} />
            ))}
            {/* Entry Door */}
            <rect x="90" y="13.5" width="9.5" height="20.5" rx="1.3" fill={spec.glass} stroke={spec.frame} strokeWidth="0.8" />
            {/* Front windshield edge */}
            <rect x="102" y="13" width="8" height="11" rx="1" fill={spec.glass} />
          </g>
        )}

        {/* Headlight & Taillight accents */}
        <rect x="107.2" y="31" width="2.8" height="3.2" rx="0.8" fill="#fef08a" />
        <rect x="8" y="29.5" width="2" height="4" rx="0.5" fill="#ef4444" />
      </g>

      {/* Outer Coach Outline */}
      <rect
        x="8"
        y="9"
        width="102"
        height="29"
        rx="5"
        ry="5"
        fill="none"
        stroke="rgba(15, 23, 42, 0.35)"
        strokeWidth="1"
      />

      {/* Side Mirror */}
      <path d="M109 14 L113 14 L113 19" stroke={spec.glass} strokeWidth="1.2" fill="none" strokeLinecap="round" />

      {/* Wheels (2 or 3 axles) */}
      {spec.axles === 3 ? (
        <g>
          {/* Rear Twin Axles */}
          <circle cx="24" cy="38.5" r="5.2" fill="#1e293b" />
          <circle cx="24" cy="38.5" r="2.4" fill="#cbd5e1" />
          <circle cx="36.5" cy="38.5" r="5.2" fill="#1e293b" />
          <circle cx="36.5" cy="38.5" r="2.4" fill="#cbd5e1" />
          {/* Front Steering Axle */}
          <circle cx="83" cy="38.5" r="5.2" fill="#1e293b" />
          <circle cx="83" cy="38.5" r="2.4" fill="#cbd5e1" />
        </g>
      ) : (
        <g>
          <circle cx="29" cy="38.5" r="5.2" fill="#1e293b" />
          <circle cx="29" cy="38.5" r="2.4" fill="#cbd5e1" />
          <circle cx="82" cy="38.5" r="5.2" fill="#1e293b" />
          <circle cx="82" cy="38.5" r="2.4" fill="#cbd5e1" />
        </g>
      )}
    </svg>
  );
};
