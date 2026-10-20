// @maintained-by-ai
// Lane: secret-door wall-derivation (SOLE OWNER — verified by consumer census).
// Consumers of computeEffectiveWalls: coverService.js, maps/reachability.js,
// spellOverlayService.js, components/map/Map.jsx, useFogOfWar.js, Map3D.
// Consumer lanes verify their own behavior THROUGH the wrapper, never the
// derivation itself, and cite here for internals:
//   reachability.test.js:57,64 ....... movement obstacles (blocked/passable)
//   spellOverlayService.test.js:190,204 overlay line-of-sight
//   useFogOfWar.test.js:14 ............ "secret-door wall derivation internals ...
//                                        services/maps/effectiveWalls.test.js"
// Pinned here: base passthrough, hidden add / discovered remove, visibility
// coercion (strict === false), input coercion (Set/array/null), key building
// (x,y order, 0-is-data), non-secretDoor noise ignored, input immutability.
// Old->new map: base-unchanged+hidden-add+hidden-in-base+multi+noise -> T1;
// discovered-open+discovered-remove -> T2 (it.each); array-or-Set -> T3
// (pinned to literals, self-compare purged); no-mutate -> T5.
import { describe, it, expect } from 'vitest';
import { computeEffectiveWalls } from './effectiveWalls.js';

describe('computeEffectiveWalls', () => {
  it('derives the full wall set: base passthrough, hidden doors added (incl. 0-coords), noise ignored', () => {
    // Coordinates all distinguishable so an x/y swap in the key recipe fails.
    const result = computeEffectiveWalls(['1,1', '5,6'], [
      { type: 'secretDoor', gridX: 3, gridY: 4, visible: false }, // hidden, not in base -> added
      { type: 'secretDoor', gridX: 5, gridY: 6, visible: false }, // hidden, already a base wall -> stays
      { type: 'secretDoor', gridX: 0, gridY: 7, visible: false }, // hidden at 0-coords -> '0,7'
      { type: 'door', gridX: 8, gridY: 8, visible: false, open: true }, // ignored
      { type: 'chair', gridX: 9, gridY: 2, visible: true }, // ignored
    ]);
    expect(result).toEqual(new Set(['1,1', '3,4', '5,6', '0,7']));
  });

  it.each([
    ['visible: true', { visible: true }],
    ['visible missing (undefined !== false)', {}],
    ['visible: 0 (falsy but not === false)', { visible: 0 }],
  ])('treats a discovered secret door as open (%s): removed from base, never added', (_label, visible) => {
    const result = computeEffectiveWalls(['1,1', '7,3'], [
      { type: 'secretDoor', gridX: 7, gridY: 3, ...visible }, // in base -> removed
      { type: 'secretDoor', gridX: 8, gridY: 4, ...visible }, // not in base -> stays absent
    ]);
    expect(result).toEqual(new Set(['1,1']));
  });

  it('accepts walls as array, Set, or nullish, and returns empty on degenerate inputs', () => {
    const hidden = [{ type: 'secretDoor', gridX: 3, gridY: 4, visible: false }];
    const expected = new Set(['1,1', '3,4']);
    expect(computeEffectiveWalls(['1,1'], hidden)).toEqual(expected);
    expect(computeEffectiveWalls(new Set(['1,1']), hidden)).toEqual(expected);
    expect(computeEffectiveWalls(undefined, undefined)).toEqual(new Set());
    expect(computeEffectiveWalls(null, null)).toEqual(new Set());
  });

  it('does not mutate the input walls', () => {
    const walls = new Set(['1,1', '5,6']);
    computeEffectiveWalls(walls, [
      { type: 'secretDoor', gridX: 3, gridY: 4, visible: false }, // must not add to input
      { type: 'secretDoor', gridX: 5, gridY: 6, visible: true }, // must not delete from input
    ]);
    expect(walls).toEqual(new Set(['1,1', '5,6']));
  });
});
