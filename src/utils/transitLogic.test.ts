import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addHistoryEntry,
  calculateVehicleSpeed,
  classifyFleetCategory,
  decodeGtfsStopId,
  estimateFareInr,
  filterBusesByMapBounds,
  filterLiveBuses,
  findDirectJourneys,
  findRoutesNearRoadPoint,
  formatGpsAge,
  formatTime12Hour,
  formatTitleCase,
  getInitialDataset,
  getStopRoutesAndBuses,
  isBusSleeping,
  parseGtfsRealtimePayload,
  parseLiveTripDetail,
  replaceCuttackWithKataka,
  searchStops
} from './transitLogic';
import { CUSTOM_BUS_STOPS, mergeCustomBusStops } from './customStops';

test('classifyFleetCategory identifies all 6 Odisha bus fleets and Standby accurately', () => {
  assert.equal(classifyFleetCategory('Shree Jagannath Express', 'JE_0012U', 'OD02CE7701'), 'Shree Jagannath Express');
  assert.equal(classifyFleetCategory('OSRTC Express', 'CTC0005D', 'OD03V0607'), 'OSRTC');
  assert.equal(classifyFleetCategory('Mukhyamantri Bus Seva', 'KAM0004D', 'OD06M9130'), 'Mukhyamantri Bus Seva');
  assert.equal(classifyFleetCategory('Ama Bus', '200S', 'OD15X3905'), 'Ama Bus');
  assert.equal(classifyFleetCategory('Ama Bus AC', '18A-AC', 'OD02BV1108'), 'Ama Bus AC');
  assert.equal(classifyFleetCategory('Mo Bus', '13E', 'OD02AY1013'), 'Mo Bus');
  assert.equal(classifyFleetCategory('', '', 'OD02AK8119'), 'Standby');
});

test('calculateVehicleSpeed matches OD06M9130 real calculated speed (~33 km/h) and GPS age', () => {
  const speed = calculateVehicleSpeed({
    rawSpeedKmh: 0,
    lat: 20.89294,
    lon: 85.55042,
    t: 1795688879,
    plat: 20.88561,
    plon: 85.61913,
    pt: 1795688099
  });
  assert.equal(speed.speedSource, 'calculated');
  assert.equal(speed.speedKmh, 33);

  assert.equal(formatGpsAge(1795688879, 1795689779), 'GPS 15 min ago');
  assert.equal(formatGpsAge(1795689750, 1795689779), 'GPS just now');
});

test('parseGtfsRealtimePayload with live/vehicles.json and parseLiveTripDetail for OD06M9130', () => {
  const mockLiveVehicles = {
    t: 1795689779,
    cols: ['id', 'veh', 'lat', 'lon', 'brg', 'spd', 't', 'type', 'depot', 'oprs', 'plat', 'plon', 'pt'],
    buses: [
      [1142, 'OD06M9130', 20.89294, 85.55042, 247, 0, 1795688879, 'Mukhyamantri Bus Seva', '', '', 20.88561, 85.61913, 1795688099],
      [699, 'OD02AK8119', 21.47423, 83.96821, 217, 0, 1795685498, '', '', '', 21.47423, 83.96821, 1795685498]
    ]
  };
  const { buses } = parseGtfsRealtimePayload(null, null, null, mockLiveVehicles, {});
  assert.equal(buses.length, 2, 'must return strictly real live feed buses without injecting fake seed buses');
  const bus9130 = buses.find((b) => b.registrationNumber === 'OD06M9130');
  const standbyBus = buses.find((b) => b.registrationNumber === 'OD02AK8119');

  assert.ok(bus9130);
  assert.equal(bus9130.fleet, 'Mukhyamantri Bus Seva');
  assert.equal(bus9130.speedKmh, 33);
  assert.equal(bus9130.speedSource, 'calculated');
  assert.equal(bus9130.gpsAgeLabel, 'GPS 15 min ago');
  assert.equal(standbyBus?.fleet, 'Standby');
  assert.equal(isBusSleeping(standbyBus!), true);

  const roadPath: [number, number][] = [
    [20.78054, 85.55019],
    [20.80984, 85.58448],
    [20.89518, 85.5414],
    [20.93227, 85.54403]
  ];
  const enriched = parseLiveTripDetail(
    bus9130,
    {
      rid: '5944',
      no: 'KAM0004D',
      from: 'Kotagara',
      to: 'Kamakhyanagar Dkl',
      last: 'Saruali',
      cols: ['name', 'lat', 'lon', 'time', 'state'],
      stops: [
        ['Kotagara', 20.78054, 85.55019, '15:06', 0],
        ['Pandua Chhaka', 20.78589, 85.54882, '15:08', 0],
        ['Bauran(K)', 20.80984, 85.58448, '15:18', 0],
        ['Kangeilo', 20.88717, 85.60984, '15:46', 0],
        ['Saruali', 20.89145, 85.56021, '15:55', 0],
        ['Mahulapal Chhaka', 20.89518, 85.5414, '16:01', 1],
        ['Kamakhyanagar Dkl', 20.93227, 85.54403, '16:16', -1]
      ]
    },
    roadPath
  );

  assert.equal(enriched.tripStops.length, 7);
  assert.equal(enriched.tripStops.filter((s) => s.status === 'passed').length, 5);
  assert.equal(enriched.nextStopName, 'Mahulapal Chhaka');
  assert.equal(enriched.nextStopEta, '16:01');
  assert.equal(enriched.path?.length, 4);
});

test('filterLiveBuses, findDirectJourneys, searchStops, and decodeGtfsStopId work cleanly', () => {
  const { buses, routes, stops } = getInitialDataset();

  const byReg = filterLiveBuses(buses, { fleet: 'ALL', query: 'OD06M9141', onTripOnly: true });
  assert.equal(byReg.length, 1);

  const kamMatches = findDirectJourneys(routes, buses, 'Kamakhyanagar', 'Gangijodi', 'ALL');
  assert.equal(kamMatches.length, 1);

  const bsabt = searchStops(stops, 'BSABT');
  assert.equal(bsabt.length, 1);

  const decoded = decodeGtfsStopId('nbahanaga2134086760', 20, 85);
  assert.equal(decoded.name, 'Bahanaga');
  assert.equal(decoded.lat, 21.34);
  assert.equal(decoded.lon, 86.76);

  assert.equal(estimateFareInr('Shree Jagannath Express', 100) > estimateFareInr('Mukhyamantri Bus Seva', 100), true);
});

test('formatTime12Hour, findRoutesNearRoadPoint, and addHistoryEntry work cleanly', () => {
  assert.equal(formatTime12Hour('15:06'), '3:06 PM');
  assert.equal(formatTime12Hour('07:30'), '7:30 AM');
  assert.equal(formatTime12Hour('00:15'), '12:15 AM');
  assert.equal(formatTime12Hour('12:00'), '12:00 PM');
  assert.equal(formatTime12Hour('13:30:45'), '1:30 PM');
  assert.equal(formatTime12Hour('--:--'), '--:--');

  const { routes } = getInitialDataset();
  // Point right on Kamakhyanagar -> Gangijodi road corridor
  const nearby = findRoutesNearRoadPoint(routes, 20.91, 85.545, 5);
  assert.ok(nearby.some((r) => r.routeNumber === 'KAM0002U'));

  let hist = addHistoryEntry([], { id: 'OD06M9130', kind: 'bus', label: 'OD06M9130' }, 3);
  hist = addHistoryEntry(hist, { id: '13E', kind: 'route', label: 'Route 13E' }, 3);
  hist = addHistoryEntry(hist, { id: 'OD06M9130', kind: 'bus', label: 'OD06M9130' }, 3);
  assert.equal(hist.length, 2);
  assert.equal(hist[0].id, 'OD06M9130');
});

test('isBusSleeping and filterBusesByMapBounds accurately detect arrived buses and map viewport bounds', () => {
  const { buses } = getInitialDataset();
  const activeMoving = buses[0];
  assert.equal(isBusSleeping(activeMoving), false);

  const arrivedAtEnd = {
    ...activeMoving,
    speedKmh: 0,
    tripStops: activeMoving.tripStops.map((s) => ({ ...s, status: 'passed' as const }))
  };
  assert.equal(isBusSleeping(arrivedAtEnd), true);

  const bbsrBounds = { north: 20.4, south: 20.15, east: 85.95, west: 85.7, zoom: 12 };
  const visible = filterBusesByMapBounds(buses, bbsrBounds);
  assert.ok(visible.length > 0);
  assert.ok(visible.every((b) => b.lat >= 20.15 && b.lat <= 20.4 && b.lon >= 85.7 && b.lon <= 85.95));
});

test('mergeCustomBusStops includes Mahuli (20.833643, 85.530248) matching Kusumajodi style and bus/route data', () => {
  const { stops, routes, buses } = getInitialDataset();
  const kusumajodiStop = {
    id: 'nkusumajodi2085',
    name: 'Kusumajodi',
    district: 'Odisha Bus Network',
    lat: 20.85,
    lon: 85.53,
    degree: 9
  };
  const merged = mergeCustomBusStops([...stops, kusumajodiStop]);
  const mahuli = merged.find((s) => s.id === 'custom-mahuli');
  assert.ok(mahuli);
  assert.equal(mahuli.name, 'Mahuli');
  assert.equal(mahuli.lat, 20.833643);
  assert.equal(mahuli.lon, 85.530248);
  assert.equal(mahuli.isCustom, undefined);
  assert.equal(mahuli.degree, kusumajodiStop.degree);
  assert.equal(mahuli.district, kusumajodiStop.district);

  // Deduplicates if already present
  const mergedAgain = mergeCustomBusStops(merged);
  assert.equal(mergedAgain.filter((s) => s.id === 'custom-mahuli').length, 1);

  // Searchable by name
  const matches = searchStops(merged, 'Mahuli');
  assert.ok(matches.some((s) => s.id === 'custom-mahuli'));
  assert.ok(CUSTOM_BUS_STOPS.some((s) => s.name === 'Mahuli'));

  // Mahuli returns the EXACT same routes and live buses as Kusumajodi
  const mockRoute = {
    ...routes[0],
    id: 'route-kusumajodi-1',
    stops: [
      ...routes[0].stops,
      {
        stopId: kusumajodiStop.id,
        stopName: 'Kusumajodi',
        lat: kusumajodiStop.lat,
        lon: kusumajodiStop.lon,
        scheduledTime: '09:15',
        status: 'upcoming' as const,
        sequence: 99
      }
    ]
  };
  const mockBus = {
    ...buses[0],
    registrationNumber: 'OD06TEST1',
    tripStops: mockRoute.stops
  };
  const mahuliData = getStopRoutesAndBuses(mahuli, merged, [mockRoute], [mockBus]);
  const kusumajodiData = getStopRoutesAndBuses(kusumajodiStop, merged, [mockRoute], [mockBus]);
  assert.deepEqual(
    mahuliData.routesServingStop.map((r) => r.id),
    kusumajodiData.routesServingStop.map((r) => r.id)
  );
  assert.deepEqual(
    mahuliData.busesServingStop.map((b) => b.registrationNumber),
    kusumajodiData.busesServingStop.map((b) => b.registrationNumber)
  );
  assert.equal(mahuliData.routesServingStop.length, 1);
  assert.equal(mahuliData.busesServingStop.length, 1);
});

test('replaceCuttackWithKataka replaces Cuttack everywhere while allowing users to search either Cuttack or Kataka', () => {
  assert.equal(replaceCuttackWithKataka('Cuttack Badambadi'), 'Kataka Badambadi');
  assert.equal(replaceCuttackWithKataka('CUTTACK CNBT'), 'KATAKA CNBT');
  assert.equal(replaceCuttackWithKataka('Bhubaneswar → Cuttack'), 'Bhubaneswar → Kataka');
  assert.equal(formatTitleCase('CUTTACK BADAMBADI'), 'Kataka Badambadi');

  const { stops, routes, buses } = getInitialDataset();
  // Seed UI items contain zero visible "Cuttack"
  assert.equal(stops.some((s) => /cuttack/i.test(s.name) || /cuttack/i.test(s.district)), false);
  assert.equal(routes.some((r) => /cuttack/i.test(r.name) || /cuttack/i.test(r.origin) || /cuttack/i.test(r.destination)), false);

  // Searching "Cuttack" still finds "Kataka" stops, trips, and buses
  const foundStopsByCuttack = searchStops(stops, 'Cuttack');
  const foundStopsByKataka = searchStops(stops, 'Kataka');
  assert.ok(foundStopsByCuttack.length > 0);
  assert.deepEqual(
    foundStopsByCuttack.map((s) => s.id),
    foundStopsByKataka.map((s) => s.id)
  );

  const foundBusesByCuttack = filterLiveBuses(buses, { fleet: 'ALL', query: 'Cuttack', onTripOnly: false });
  assert.ok(foundBusesByCuttack.length > 0);

  const foundJourneys = findDirectJourneys(routes, buses, 'Brahmapur', 'Cuttack', 'ALL');
  assert.ok(foundJourneys.length > 0);
});


