// @maintained-by-ai 2026-11-22
// Canonical home for the evictCharacterStores contract (useRuntimeState.js) —
// the campaign-CHANGE character-scope rescope (bug-character-store-ghost-keys-
// survive-campaign-switch, sibling of the 'campaign'-store fix d25431cab).
// `stores` keys character buckets by BARE characterKey, so a no-reload campaign
// switch left campaign A's per-character buckets readable under campaign B's
// same-named creatures (fresh NPC 1 pre-checking A's allies, spurious
// friendly-fire confirm). The App.jsx enter seam evicts every character-keyed
// store on a real campaign change. These tests lock the eviction, the
// 'campaign'-bucket exemption, the notify wake, and the memory-only
// (never-POSTs) law — a POST here would ship the previous scope's stale whole
// mirror into the NEW campaign's change-data (the pollution twin of the bug).
// The enter-seam gate itself is pinned by App.character-store-rescope.test.jsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getStore,
  getRuntimeValue,
  hasRuntimeValue,
  clearRuntimeState,
  evictCharacterStores,
  addStorageChangeListener,
  getAllStoreKeys,
  listeners,
} from './useRuntimeState.js';

function clearAll() {
  const keys = getAllStoreKeys();
  for (const key of keys) {
    clearRuntimeState(key);
  }
  listeners.clear();
}

describe('useRuntimeState — evictCharacterStores (campaign-change scope rescope)', () => {
  beforeEach(() => {
    clearAll();
    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    global.fetch.mockClear();
  });

  it('removes every character-keyed bucket and keeps the shared campaign bucket', () => {
    getStore('NPC 1').set('selectedAllies', ['AasimarTest', 'NPC 1']);
    getStore('combatSummary').set('round', 3);
    getStore('campaign').set('aiConfig', { mode: 'suggest' });

    evictCharacterStores();

    // getStore lazily recreates the Map, so removal is proven by the bucket
    // reading empty (reads answer null — getAllyList's self-only fallback).
    expect(hasRuntimeValue('NPC 1', 'selectedAllies')).toBe(false);
    expect(getRuntimeValue('NPC 1', 'selectedAllies')).toBeNull();
    expect(hasRuntimeValue('combatSummary', 'round')).toBe(false);
    // hydrateCampaignRuntimeData re-scopes 'campaign' separately — untouched here.
    expect(getRuntimeValue('campaign', 'aiConfig')).toEqual({ mode: 'suggest' });
  });

  it('wakes consumers registered on an evicted character key (notify)', () => {
    getStore('NPC 1').set('selectedAllies', ['AasimarTest']);
    const woke = vi.fn();
    addStorageChangeListener('NPC 1', woke);

    evictCharacterStores();

    expect(woke).toHaveBeenCalled();
    expect(getRuntimeValue('NPC 1', 'selectedAllies')).toBeNull();
  });

  it('is memory-only — never POSTs an evicted mirror to any campaign', () => {
    getStore('NPC 1').set('selectedAllies', ['AasimarTest']);
    addStorageChangeListener('NPC 1', () => {});

    evictCharacterStores();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('is idempotent — a second sweep on an empty scope changes nothing', () => {
    evictCharacterStores();
    evictCharacterStores();
    expect(getAllStoreKeys().filter((k) => k !== 'campaign')).toEqual([]);
  });
});
