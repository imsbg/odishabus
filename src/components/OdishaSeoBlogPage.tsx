import React, { useState } from 'react';
import {
  ArrowRight,
  Bus,
  ChevronDown,
  ExternalLink,
  MapPin,
  Navigation,
  Route as RouteIcon,
  Search
} from 'lucide-react';
import { CoachLiverySvg } from './CoachLiverySvg';
import { FleetCategory } from '../utils/transitTypes';
import { LIVE_APP_URL } from '../utils/siteMode';
import heroHighwayImg from '../assets/images/odisha_bus_hero_highway_1795707339732.jpg';
import terminalImg from '../assets/images/odisha_transit_terminal_1795707339728.jpg';

interface OdishaSeoBlogPageProps {
  onOpenLocalApp?: () => void;
  isLocalPreview?: boolean;
}

interface FleetGuideItem {
  fleet: FleetCategory;
  shortTag: string;
  coverage: string;
  description: string;
}

const FLEET_GUIDE: FleetGuideItem[] = [
  {
    fleet: 'Shree Jagannath Express',
    shortTag: 'Flagship AC Express · Inter-District',
    coverage: 'Puri · Bhubaneswar · Sambalpur · Berhampur · Rourkela · Balasore',
    description:
      'State-operated air-conditioned express coaches connecting Puri and Bhubaneswar with major district headquarters across Odisha on scheduled long-distance highway corridors.'
  },
  {
    fleet: 'OSRTC',
    shortTag: 'State Intercity Network · 30 Districts',
    coverage: 'BSABT Baramunda · Badambadi · Angul · Dhenkanal · Koraput · Baripada',
    description:
      'Odisha State Road Transport Corporation intercity buses serving regional highways, overnight routes, and daily commuter links between towns and state terminals.'
  },
  {
    fleet: 'Mukhyamantri Bus Seva',
    shortTag: 'Gram Panchayat & Block Connectivity',
    coverage: 'Kamakhyanagar · Mahuli · Parjang · Dhenkanal · Rural Block Hubs',
    description:
      'Affordable district and rural connectivity fleet (formerly LAccMI) bridging Gram Panchayats, block headquarters, colleges, and district hospitals with live GPS visibility.'
  },
  {
    fleet: 'Ama Bus',
    shortTag: 'CRUT Urban City Service',
    coverage: 'Bhubaneswar · Kataka · Puri · Rourkela · Sambalpur · Berhampur',
    description:
      'High-frequency urban city buses operated by CRUT across Odisha’s metropolitan regions, linking railway stations, airports, universities, and market hubs.'
  },
  {
    fleet: 'Ama Bus AC',
    shortTag: 'Air-Conditioned Electric & City Coaches',
    coverage: 'Bhubaneswar Airport · Nandankanan · KIIT · Master Canteen · Puri',
    description:
      'Cool, quiet air-conditioned city coaches and electric buses serving busy urban corridors and tourist links between Bhubaneswar, Kataka, and Puri.'
  },
  {
    fleet: 'Mo Bus',
    shortTag: 'Capital Region Urban Heritage Fleet',
    coverage: 'Capital Region · Khordha · Pipili · Konark · Kataka Ring',
    description:
      'Everyday commuter routes across the Bhubaneswar–Kataka–Puri urban belt with transparent stop lists and real-time route maps.'
  }
];

const POPULAR_CORRIDORS = [
  {
    corridor: 'Bhubaneswar (BSABT) → Puri',
    fleets: 'Shree Jagannath Express · Ama Bus AC · OSRTC',
    keyStops: 'Master Canteen, Kalpana Square, Pipili, Malatipatpur, Puri Stand',
    frequency: 'Every 15–20 min'
  },
  {
    corridor: 'Bhubaneswar → Kataka (Badambadi)',
    fleets: 'Ama Bus · Ama Bus AC · Mo Bus · OSRTC',
    keyStops: 'Vani Vihar, Rasulgarh, Pahala, Phulnakhara, Link Road, Badambadi',
    frequency: 'Every 10–15 min'
  },
  {
    corridor: 'Kamakhyanagar → Mahuli → Dhenkanal → Bhubaneswar',
    fleets: 'Mukhyamantri Bus Seva · OSRTC',
    keyStops: 'Kamakhyanagar Dkl, Aluajharana, Mahuli, Kusumajodi, Dhenkanal, Kataka',
    frequency: 'Regular daily services'
  },
  {
    corridor: 'Bhubaneswar → Sambalpur',
    fleets: 'Shree Jagannath Express · OSRTC',
    keyStops: 'Kataka, Dhenkanal, Angul, Boinda, Rairakhol, Ainthapali',
    frequency: 'Hourly express & AC'
  },
  {
    corridor: 'Bhubaneswar → Berhampur (Brahmapur)',
    fleets: 'Shree Jagannath Express · OSRTC',
    keyStops: 'Khordha, Balugaon, Rambha, Chhatrapur, Berhampur Stand',
    frequency: 'Every 30–45 min'
  },
  {
    corridor: 'Bhubaneswar → Rourkela',
    fleets: 'Shree Jagannath Express · OSRTC',
    keyStops: 'Angul, Talcher, Pallahara, Barkote, Rajgangpur, Rourkela',
    frequency: 'Day & overnight AC'
  }
];

const FAQ_ITEMS = [
  {
    question: 'Is Odisha Bus live tracking completely free to use?',
    answer:
      'Yes. Odisha Bus is 100% free with no account registration, login, or subscription needed. Open the live map directly at odishabus.netlify.app on any phone or desktop browser.'
  },
  {
    question: 'Which Odisha bus fleets can I track in real time?',
    answer:
      'You can filter and track Shree Jagannath Express, OSRTC Express, Mukhyamantri Bus Seva, Ama Bus, Ama Bus AC, and Mo Bus — plus view resting or parked vehicles between duties.'
  },
  {
    question: 'How do I check which bus routes pass along my road?',
    answer:
      'On the interactive Odisha Bus map, simply click or tap directly on any road or highway. The "Routes on this road" panel lists all matching bus routes running along that exact stretch.'
  },
  {
    question: 'How do I see only the buses near my current location?',
    answer:
      'Tap the "Center on my location" GPS button on the map to zoom to your real coordinates with a blue location dot. With "In map view" enabled in the bus list, the sidebar automatically filters to show only live buses inside the zoomed map area.'
  },
  {
    question: 'Why does a bus occasionally show delayed or resting status?',
    answer:
      'Live bus positions and timings come directly from public Odisha transit GPS feeds. Because cellular coverage or onboard GPS units can occasionally lag or pause at depots, buses that have reached their final stop or are off duty display a resting Zzz animation, and schedules should be treated as live guidance.'
  }
];

export const OdishaSeoBlogPage: React.FC<OdishaSeoBlogPageProps> = ({
  onOpenLocalApp,
  isLocalPreview = false
}) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      {/* TOP BAR CONTRACT: 3 clean zones — [Wordmark] — [5 single-line nav links] — [1 primary CTA] */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/85">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-950 font-display whitespace-nowrap shrink-0"
          >
            <span className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center shadow-xs">
              <Bus className="w-4 h-4" />
            </span>
            <span>Odisha Bus</span>
          </a>

          <nav
            aria-label="Guide sections"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a
              href="#live-map"
              className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Live Map
            </a>
            <a
              href="#features"
              className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Features
            </a>
            <a
              href="#fleets"
              className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Bus Fleets
            </a>
            <a
              href="#routes"
              className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Popular Routes
            </a>
            <a
              href="#faq"
              className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href={LIVE_APP_URL}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0"
            >
              <span>Open Live Map</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* EDITORIAL HERO SECTION */}
        <section className="bg-white border-b border-slate-200/80">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-12 lg:pt-14 lg:pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                    <span>Odisha Public Transit Guide</span>
                    <span aria-hidden="true">·</span>
                    <span>Free Live GPS Bus Map</span>
                    <span aria-hidden="true">·</span>
                    <span>Updated 2026</span>
                  </div>

                  <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-slate-950 leading-[1.12] font-display text-balance">
                    Track Every Odisha Bus Live — OSRTC, Shree Jagannath Express &amp; Ama Bus
                  </h1>

                  <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                    Odisha Bus is a fast, free real-time transit tracker built exclusively for Odisha
                    commuters. Watch live GPS bus locations move on an interactive map, tap any road
                    to see passing routes, and check AM/PM station timings across all 30 districts —
                    without apps, sign-ups, or paywalls.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <a
                    href={LIVE_APP_URL}
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-xl shadow-sm transition-colors whitespace-nowrap"
                  >
                    <span>Launch Live Odisha Bus Map</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                  {isLocalPreview && onOpenLocalApp ? (
                    <button
                      type="button"
                      onClick={onOpenLocalApp}
                      className="text-sm font-semibold text-slate-700 hover:text-orange-600 underline underline-offset-4 transition-colors whitespace-nowrap"
                    >
                      Switch to Local Map View
                    </button>
                  ) : (
                    <a
                      href="#features"
                      className="text-sm font-semibold text-slate-700 hover:text-orange-600 underline underline-offset-4 transition-colors whitespace-nowrap"
                    >
                      Read Full Feature Guide
                    </a>
                  )}
                </div>
              </div>

              <div className="lg:col-span-6">
                <figure className="relative h-full min-h-[260px] sm:min-h-[320px] rounded-2xl overflow-hidden border border-slate-200 bg-gradient-to-br from-orange-50 to-slate-100">
                  <img
                    src={heroHighwayImg}
                    alt="Modern white and saffron express bus traveling along a sunlit Odisha coastal highway"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <figcaption className="absolute inset-x-0 bottom-0 px-5 py-4 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-transparent text-white text-xs sm:text-sm font-medium">
                    Real-time GPS tracking across Odisha’s intercity highways, district hubs, and
                    urban city corridors.
                  </figcaption>
                </figure>
              </div>
            </div>

            {/* 4-COLUMN COVERAGE STRIP (Full-width row below hero split) */}
            <div className="mt-10 pt-8 border-t border-slate-200/80 grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-950">
                  1,700+
                </div>
                <div className="text-xs sm:text-sm text-slate-600 mt-1">
                  Live Odisha buses tracked via GPS feeds
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-950">
                  30 Districts
                </div>
                <div className="text-xs sm:text-sm text-slate-600 mt-1">
                  Coastal, western, northern &amp; southern Odisha
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-950">
                  6 Fleets
                </div>
                <div className="text-xs sm:text-sm text-slate-600 mt-1">
                  SJE, OSRTC, MBS, Ama Bus, Ama Bus AC &amp; Mo Bus
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-orange-600">
                  100% Free
                </div>
                <div className="text-xs sm:text-sm text-slate-600 mt-1">
                  No sign-up, instant mobile &amp; desktop access
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE LIVE MAP IFRAME EMBED */}
        <section id="live-map" className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 lg:pt-16 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div className="max-w-2xl space-y-2">
              <div className="text-xs font-semibold text-orange-600">
                Interactive Live Map Preview
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 font-display text-balance">
                Track Live Odisha Buses Right Here
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Explore real-time GPS positions, search Odisha stations, or click any road right
                inside this preview — or open full screen for the fastest mobile view.
              </p>
            </div>
            <a
              href={LIVE_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-500 whitespace-nowrap shrink-0"
            >
              <span>Open Full Screen</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="rounded-2xl overflow-hidden border border-slate-300/80 bg-white shadow-lg shadow-slate-900/5">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs">
              <span className="inline-flex items-center gap-2 font-semibold text-slate-800">
                <span className="w-2 h-2 rounded-full bg-emerald-600" aria-hidden="true" />
                <span>Odisha Bus Live Map · odishabus.netlify.app</span>
              </span>
              <a
                href={LIVE_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-orange-600 hover:underline underline-offset-4 whitespace-nowrap"
              >
                Full Screen ↗
              </a>
            </div>
            <iframe
              src={LIVE_APP_URL}
              title="Odisha Bus Live Interactive GPS Map"
              loading="lazy"
              allow="geolocation"
              allowFullScreen
              className="block w-full h-[520px] sm:h-[640px] lg:h-[680px] border-0 bg-slate-100"
            />
          </div>
        </section>

        {/* ASYMMETRIC FEATURE BENTO (Editorial Numbered Capabilities) */}
        <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-20">
          <div className="max-w-2xl space-y-2.5 mb-10">
            <div className="text-xs font-semibold text-orange-600">Core Capabilities</div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 font-display text-balance">
              Everything You Need to Catch Your Odisha Bus on Time
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Designed for daily office commuters, college students, and inter-district travelers
              who want clear, accurate bus status in seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <article className="lg:col-span-2 p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-slate-950 font-display">
                  01. Live GPS Positions, Directional Arrows &amp; Realistic Coach View
                </h3>
                <Bus className="w-5 h-5 text-orange-600 shrink-0" />
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Every active vehicle appears on a smooth custom-colored MapLibre vector map with a
                large directional marker showing exact travel heading. Zoom in closely or tap{' '}
                <strong className="font-semibold text-slate-900">Follow this bus</strong> to watch
                realistic top-down fleet coaches move along the road with live speed, GPS sync age,
                and immediate AM/PM next-station arrival times — with zero awkward zoom-outs when
                you tap a bus.
              </p>
            </article>

            <article className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-slate-950 font-display">
                  02. Tap Any Road for Passing Routes
                </h3>
                <RouteIcon className="w-5 h-5 text-orange-600 shrink-0" />
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Standing beside a highway or local chhaka and unsure which bus passes there? Click
                directly on the road on the map to open{' '}
                <strong className="font-semibold text-slate-900">Routes on this road</strong> and
                inspect every bus service running along that corridor.
              </p>
            </article>

            <article className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-slate-950 font-display">
                  03. Full Odisha Station &amp; Stop Search
                </h3>
                <Search className="w-5 h-5 text-orange-600 shrink-0" />
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Search thousands of major terminals and village stops — from Bhubaneswar BSABT,
                Kataka Badambadi, and Puri Stand to Dhenkanal, Kamakhyanagar, and local stops like{' '}
                <strong className="font-semibold text-slate-900">Mahuli</strong> — to view passing
                routes and nearby live coaches.
              </p>
            </article>

            <article className="lg:col-span-2 p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-slate-950 font-display">
                  04. Real GPS My Location, Viewport-Synced Bus List &amp; Resting Indicators
                </h3>
                <Navigation className="w-5 h-5 text-orange-600 shrink-0" />
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Tap <strong className="font-semibold text-slate-900">Center on my location</strong>{' '}
                to jump straight to your real GPS coordinates with a pulsing blue location dot. Keep{' '}
                <strong className="font-semibold text-slate-900">In map view</strong> enabled in the
                left explorer so zooming into any town immediately filters the list to buses moving
                in that exact area. Buses parked at depots or arrived at their final stop show a
                gentle floating <strong className="font-semibold text-slate-900">Zzz</strong>{' '}
                indicator so you know at a glance which coaches are resting versus on trip.
              </p>
            </article>
          </div>
        </section>

        {/* EDITORIAL BLOG ARTICLE: COMPLETE GUIDE TO ODISHA BUS FLEETS */}
        <section id="fleets" className="bg-white border-y border-slate-200/80 py-14 lg:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center mb-12">
              <div className="lg:col-span-7 space-y-3">
                <div className="text-xs font-semibold text-orange-600">
                  Odisha Transit Network Directory
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 font-display text-balance">
                  Six Odisha Bus Services Unified on One Live Map
                </h2>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Instead of jumping between scattered timetables and separate portals, Odisha Bus
                  color-codes every major public bus service across the state. Toggle any fleet from
                  the filter bar, turn road-snapped{' '}
                  <strong className="font-semibold text-slate-900">Route Marks</strong> on or off,
                  and save your recently checked bus numbers automatically in your quick history.
                </p>
              </div>
              <div className="lg:col-span-5">
                <figure className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-[4/3]">
                  <img
                    src={terminalImg}
                    alt="Sunlit modern bus terminal in Odisha with blue urban city buses and saffron intercity coaches"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </figure>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FLEET_GUIDE.map((item) => (
                <article
                  key={item.fleet}
                  className="p-5 sm:p-6 rounded-2xl bg-[#f8fafc] border border-slate-200/90 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="h-24 rounded-xl bg-white border border-slate-200/70 flex items-center justify-center p-2">
                      <CoachLiverySvg fleet={item.fleet} className="w-40 h-20" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">{item.shortTag}</div>
                      <h3 className="text-base font-bold text-slate-950 font-display mt-0.5">
                        {item.fleet}
                      </h3>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-200/80 text-xs text-slate-500 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                    <span>{item.coverage}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* STEP-BY-STEP HOW TO TRACK + POPULAR CORRIDORS TABLE */}
        <section id="how-it-works" className="max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-20 space-y-16">
          <div>
            <div className="max-w-2xl space-y-2 mb-8">
              <div className="text-xs font-semibold text-orange-600">Commuter Walkthrough</div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 font-display text-balance">
                How to Check Live Odisha Bus Status in Four Simple Steps
              </h2>
            </div>

            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <li className="p-5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
                <div className="text-sm font-bold font-mono text-orange-600">Step 01</div>
                <h3 className="text-base font-bold text-slate-950 font-display">
                  Open the Live Map
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Visit <span className="font-mono text-xs text-slate-800">odishabus.netlify.app</span>{' '}
                  for instant access to live OSRTC, Shree Jagannath Express, MBS, and Ama Bus GPS
                  positions.
                </p>
              </li>
              <li className="p-5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
                <div className="text-sm font-bold font-mono text-orange-600">Step 02</div>
                <h3 className="text-base font-bold text-slate-950 font-display">
                  Search or Zoom In
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Type a vehicle number (such as <span className="font-mono text-xs">OD06M9141</span>
                  ), station name, or zoom into your town to filter buses visible inside the map
                  area.
                </p>
              </li>
              <li className="p-5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
                <div className="text-sm font-bold font-mono text-orange-600">Step 03</div>
                <h3 className="text-base font-bold text-slate-950 font-display">
                  Inspect Next Stop ETA
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Tap any bus to view its next station and arrival time in clear 12-hour AM/PM
                  format right at the top — without scrolling.
                </p>
              </li>
              <li className="p-5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
                <div className="text-sm font-bold font-mono text-orange-600">Step 04</div>
                <h3 className="text-base font-bold text-slate-950 font-display">
                  Follow Coach Live
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Click <strong className="font-semibold text-slate-900">Follow this bus</strong> to
                  zoom to street level and track the realistic coach icon as it approaches your stop.
                </p>
              </li>
            </ol>
          </div>

          {/* POPULAR ODISHA CORRIDORS TABLE */}
          <div id="routes" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-orange-600">Route Reference</div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 font-display">
                  Popular Odisha Bus Corridors &amp; Daily Connections
                </h2>
              </div>
              <a
                href={LIVE_APP_URL}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-500 whitespace-nowrap"
              >
                <span>Explore all routes on live map</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200/90 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-200/90 text-xs font-semibold text-slate-500 bg-slate-50/70">
                    <th className="py-3.5 px-5">Corridor</th>
                    <th className="py-3.5 px-5">Bus Services</th>
                    <th className="py-3.5 px-5">Major Stops</th>
                    <th className="py-3.5 px-5">Frequency</th>
                    <th className="py-3.5 px-5 text-right">Live Map</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 text-sm">
                  {POPULAR_CORRIDORS.map((row) => (
                    <tr key={row.corridor} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-5 font-semibold text-slate-950 whitespace-nowrap">
                        {row.corridor}
                      </td>
                      <td className="py-4 px-5 text-slate-700">{row.fleets}</td>
                      <td className="py-4 px-5 text-slate-600 text-xs leading-relaxed">
                        {row.keyStops}
                      </td>
                      <td className="py-4 px-5 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                        {row.frequency}
                      </td>
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <a
                          href={LIVE_APP_URL}
                          className="text-xs font-semibold text-orange-600 hover:text-orange-500 hover:underline underline-offset-4"
                        >
                          Track Live
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* INTERACTIVE FAQ ACCORDION */}
        <section id="faq" className="bg-white border-t border-slate-200/80 py-14 lg:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="space-y-2 mb-8">
              <div className="text-xs font-semibold text-orange-600">
                Frequently Asked Questions
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 font-display">
                Common Questions About Odisha Bus Live Tracking
              </h2>
            </div>

            <div className="divide-y divide-slate-200/90 border-y border-slate-200/90">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div key={item.question} className="py-4">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between gap-4 text-left py-1 group"
                    >
                      <span className="text-sm sm:text-base font-semibold text-slate-950 group-hover:text-orange-600 transition-colors">
                        {item.question}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-orange-600' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <p className="mt-2.5 text-sm text-slate-600 leading-relaxed pr-8">
                        {item.answer}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* FINAL CONVERSION CALLOUT */}
            <div className="mt-12 p-6 sm:p-8 rounded-2xl bg-slate-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-1.5 max-w-xl">
                <h3 className="text-xl font-bold font-display text-balance">
                  Ready to check where your bus is right now?
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Open the live interactive Odisha Bus map to track vehicles, inspect road routes,
                  and view real-time station timings across Odisha.
                </p>
              </div>
              <a
                href={LIVE_APP_URL}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0"
              >
                <span>Open Live Map</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* QUIET EDITORIAL FOOTER */}
      <footer className="bg-[#f8fafc] border-t border-slate-200/85 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-md">
            <div className="inline-flex items-center gap-2 text-base font-bold text-slate-950 font-display">
              <span className="w-7 h-7 rounded-lg bg-orange-600 text-white flex items-center justify-center">
                <Bus className="w-3.5 h-3.5" />
              </span>
              <span>Odisha Bus</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Live bus positions and route schedules are sourced from public Odisha transit GPS
              feeds. Because GPS signals and timetables can occasionally lag, live locations may
              sometimes show delayed or inaccurate information.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <a
              href="https://play.google.com/store/apps/details?id=in.sandeep.odiabhasa"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-orange-300 transition-colors"
            >
              <img
                src="https://imsbg.github.io/odiabhasa/images/app.png"
                alt="Odia Bhasa App"
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
              />
              <span className="text-xs font-semibold text-slate-900 whitespace-nowrap">
                Download Odia Bhasa App
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </a>

            <a
              href={LIVE_APP_URL}
              className="text-xs font-semibold text-orange-600 hover:underline underline-offset-4 whitespace-nowrap"
            >
              odishabus.netlify.app
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
