import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// @maintained-by-ai
// Regression lock for bug-spell-overlay-placement-broken-non-secure-origin:
// crypto.randomUUID only exists in secure contexts (HTTPS/localhost). LAN
// players on http://<ip> had it undefined and EVERY overlay placement died
// with "TypeError: crypto.randomUUID is not a function" before any fetch.
// With randomUUID removed, createOverlay() must still return an overlay with
// a non-empty, collision-unlikely id (utils.safeUuid() guid() fallback).
import { createOverlay } from './SpellOverlay.js';

const originalRandomUUID = crypto.randomUUID;

const simulateNonSecureOrigin = () => {
  Object.defineProperty(crypto, 'randomUUID', {
    value: undefined,
    configurable: true,
    writable: true,
  });
};

const restoreSecureContext = () => {
  Object.defineProperty(crypto, 'randomUUID', {
    value: originalRandomUUID,
    configurable: true,
    writable: true,
  });
};

describe('createOverlay on a non-secure origin (crypto.randomUUID undefined)', () => {
  beforeAll(simulateNonSecureOrigin);
  afterAll(restoreSecureContext);

  it('does not throw and returns a full overlay with a non-empty id', () => {
    expect(crypto.randomUUID).toBeUndefined();
    let overlay;
    expect(() => {
      overlay = createOverlay('sphere', 7, 9);
    }).not.toThrow();
    expect(typeof overlay.id).toBe('string');
    expect(overlay.id.length).toBeGreaterThan(0);
    expect(overlay.shape).toBe('sphere');
    expect(overlay.startGridX).toBe(7);
    expect(overlay.startGridY).toBe(9);
    expect(overlay.angle).toBe(0);
    expect(overlay.radiusFt).toBe(20);
  });

  it('assigns distinct ids across placements (no session collisions)', () => {
    const ids = new Set();
    for (let i = 0; i < 50; i++) {
      ids.add(createOverlay('cylinder', i, 0).id);
    }
    expect(ids.size).toBe(50);
  });

  it('fallback id keeps a UUID-shaped string for server round-tripping', () => {
    const { id } = createOverlay('cone', 1, 1);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
