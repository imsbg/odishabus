import { BusStop } from './transitTypes';

export const CUSTOM_BUS_STOPS: BusStop[] = [
  {
    id: 'custom-mahuli',
    name: 'Mahuli',
    district: 'Dhenkanal District',
    lat: 20.833643,
    lon: 85.530248,
    isCustom: true,
    degree: 16
  }
];

/**
 * Ensures custom user-defined Odisha bus stops (such as Mahuli) are always
 * present in the active station directory without duplicating IDs.
 */
export function mergeCustomBusStops(networkStops: BusStop[]): BusStop[] {
  const existingIds = new Set(networkStops.map((s) => s.id));
  const missingCustom = CUSTOM_BUS_STOPS.filter((cs) => !existingIds.has(cs.id));
  return [...missingCustom, ...networkStops];
}
