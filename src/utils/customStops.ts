import { BusStop } from './transitTypes';

export const CUSTOM_BUS_STOPS: BusStop[] = [
  {
    id: 'custom-mahuli',
    name: 'Mahuli',
    district: 'Odisha Bus Network',
    lat: 20.833643,
    lon: 85.530248,
    mirrorStopName: 'Kusumajodi',
    degree: 6
  }
];

/**
 * Ensures custom Odisha bus stops (such as Mahuli) are merged seamlessly into
 * the station directory, inheriting degree/district from any mirrored sibling
 * stop (like Kusumajodi) so they render identically to standard bus stops.
 */
export function mergeCustomBusStops(networkStops: BusStop[]): BusStop[] {
  const byId = new Map<string, BusStop>();
  for (const stop of networkStops) {
    byId.set(stop.id, stop);
  }

  for (const custom of CUSTOM_BUS_STOPS) {
    let enriched: BusStop = { ...custom };
    if (custom.mirrorStopName) {
      const mirrorQuery = custom.mirrorStopName.toLowerCase();
      const mirrorStop = networkStops.find((s) =>
        s.name.toLowerCase().includes(mirrorQuery)
      );
      if (mirrorStop) {
        enriched = {
          ...enriched,
          district: mirrorStop.district,
          degree: mirrorStop.degree ?? enriched.degree,
          isTerminal: mirrorStop.isTerminal
        };
      }
    }
    byId.set(custom.id, enriched);
  }

  return Array.from(byId.values());
}
