import { describe, it, expect } from 'vitest';
import { computeEffectiveWalls } from './effectiveWalls.js';

describe('computeEffectiveWalls', () => {
  it('returns base walls unchanged when there are no secret doors', () => {
    const result = computeEffectiveWalls(['1,1', '2,2'], []);
    expect(result).toBeInstanceOf(Set);
    expect(result.has('1,1')).toBe(true);
    expect(result.has('2,2')).toBe(true);
    expect(result.size).toBe(2);
  });

  it('accepts walls as an array or a Set', () => {
    const fromArray = computeEffectiveWalls(['1,1'], []);
    const fromSet = computeEffectiveWalls(new Set(['1,1']), []);
    expect(fromArray).toEqual(fromSet);
  });

  it('adds a hidden secret door cell as a wall', () => {
    const items = [{ type: 'secretDoor', gridX: 3, gridY: 4, visible: false }];
    const result = computeEffectiveWalls([], items);
    expect(result.has('3,4')).toBe(true);
  });

  it('treats a discovered (visible) secret door as an empty cell', () => {
    const items = [{ type: 'secretDoor', gridX: 3, gridY: 4, visible: true }];
    const result = computeEffectiveWalls([], items);
    expect(result.has('3,4')).toBe(false);
  });

  it('removes a discovered secret door cell that is also in the base walls', () => {
    const items = [{ type: 'secretDoor', gridX: 3, gridY: 4, visible: true }];
    const result = computeEffectiveWalls(['1,1', '3,4'], items);
    expect(result.has('3,4')).toBe(false);
    expect(result.has('1,1')).toBe(true);
  });

  it('keeps a hidden secret door cell that is already in the base walls', () => {
    const items = [{ type: 'secretDoor', gridX: 3, gridY: 4, visible: false }];
    const result = computeEffectiveWalls(['3,4'], items);
    expect(result.has('3,4')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('ignores non-secret-door items', () => {
    const items = [
      { type: 'door', gridX: 5, gridY: 5, visible: false, open: false },
      { type: 'chair', gridX: 6, gridY: 6, visible: true },
    ];
    const result = computeEffectiveWalls(['1,1'], items);
    expect(result.has('5,5')).toBe(false);
    expect(result.has('6,6')).toBe(false);
    expect(result.size).toBe(1);
  });

  it('handles multiple secret doors independently', () => {
    const items = [
      { type: 'secretDoor', gridX: 1, gridY: 1, visible: false },
      { type: 'secretDoor', gridX: 2, gridY: 2, visible: true },
      { type: 'secretDoor', gridX: 3, gridY: 3, visible: false },
    ];
    const result = computeEffectiveWalls(['2,2'], items);
    expect(result.has('1,1')).toBe(true);
    expect(result.has('2,2')).toBe(false);
    expect(result.has('3,3')).toBe(true);
  });

  it('does not mutate the input Set', () => {
    const input = new Set(['1,1']);
    const items = [{ type: 'secretDoor', gridX: 3, gridY: 4, visible: false }];
    computeEffectiveWalls(input, items);
    expect(input.size).toBe(1);
    expect(input.has('3,4')).toBe(false);
  });
});
