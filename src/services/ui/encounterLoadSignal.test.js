// @maintained-by-ai
/* Lane: encounter-load signal (backlog 2026-11-11 KW) — single-shot pending
 * flag + synchronous window event, the two seams the builder consumes. */
import { describe, it, expect, vi } from 'vitest';
import {
  requestEncounterLoad,
  consumePendingEncounterLoad,
  subscribeToEncounterLoad,
} from './encounterLoadSignal.js';

describe('encounterLoadSignal', () => {
  it('a request is pending until consumed exactly once', () => {
    expect(consumePendingEncounterLoad()).toBe(false);
    requestEncounterLoad();
    expect(consumePendingEncounterLoad()).toBe(true);
    expect(consumePendingEncounterLoad()).toBe(false);
  });

  it('subscribers fire synchronously and unsubscribe cleanly', () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToEncounterLoad(handler);
    requestEncounterLoad();
    expect(handler).toHaveBeenCalledTimes(1);
    unsubscribe();
    requestEncounterLoad();
    expect(handler).toHaveBeenCalledTimes(1);
    consumePendingEncounterLoad(); // drain the request the last click armed
  });
});
