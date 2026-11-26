import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTopDownBusSvg,
  shouldRenderSvgBus,
  SVG_BUS_MIN_ZOOM,
  TOP_DOWN_BUS_PALETTES
} from './busMapSprites';
import { FleetCategory } from './transitTypes';

test('shouldRenderSvgBus switches to SVG coach on close zoom or while following bus', () => {
  assert.equal(shouldRenderSvgBus(6.8, false), false);
  assert.equal(shouldRenderSvgBus(12.9, false), false);
  assert.equal(shouldRenderSvgBus(SVG_BUS_MIN_ZOOM, false), true);
  assert.equal(shouldRenderSvgBus(15.5, false), true);
  assert.equal(shouldRenderSvgBus(8.0, true), true);
});

test('createTopDownBusSvg renders valid livery SVG for every Odisha fleet', () => {
  const fleets = Object.keys(TOP_DOWN_BUS_PALETTES) as FleetCategory[];
  assert.equal(fleets.length, 7);

  for (const fleet of fleets) {
    const normalSvg = createTopDownBusSvg(fleet, false);
    const selectedSvg = createTopDownBusSvg(fleet, true);

    assert.ok(normalSvg.startsWith('<svg '), `${fleet} normal SVG starts with <svg`);
    assert.ok(normalSvg.endsWith('</svg>'), `${fleet} normal SVG closes </svg>`);
    assert.ok(selectedSvg.includes('fill-opacity="0.45"'), `${fleet} selected SVG includes headlight glow`);
    assert.ok(!normalSvg.includes('fill-opacity="0.45"'), `${fleet} normal SVG omits selected headlight beams`);
    assert.ok(normalSvg.includes('#fef08a'), `${fleet} SVG has front headlights`);
    assert.ok(normalSvg.includes('#ef4444'), `${fleet} SVG has rear tail lamps`);
  }
});
