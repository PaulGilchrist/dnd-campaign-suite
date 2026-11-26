// @maintained-by-ai 2026-11-22
// seedPrefillName (backlog 2026-11-22 improve seed-prefill-lock-aware): under
// a CAMPAIGN_LOCK set that refuses the dated quick-create default, the modal
// prefill must land on a FREE ALLOWLISTED NAME (folder-absent), preferring
// PRESET AFFINITY (backlog 2026-11-22 RT): the first free name whose
// lowercased form contains the lowercased preset prefix (qa-arena→Arena,
// qa-starter→Starter), so a zero-edit Starter commit never names an arena
// folder. With no free affinity match it falls back to the generic law — the
// first free member in server lockNames order. Every other face keeps the
// dated default (unlocked / default itself allowlisted / no free member left —
// the last face is the one SeedLockNote must keep warning about).
import { describe, it, expect } from 'vitest';
import { seededDefaultName, seedPrefillName } from './seededCampaign.js';

// Live harness shape: CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' over
// the 5-folder public/campaigns/ baseline (test-campaign taken, qa-* free).
const SET_LOCK = ['test-campaign', 'qa-arena', 'qa-starter'];
const BASELINE_FOLDERS = ['Frostfall', 'test-campaign', 'Testing G1', 'Testing G2', 'Testing G3'];

describe('seedPrefillName', () => {
  it('unlocked: prefills the dated default (behavior unchanged)', () => {
    expect(seedPrefillName('Arena', false, SET_LOCK, BASELINE_FOLDERS))
      .toBe(seededDefaultName('Arena'));
    expect(seedPrefillName('Starter', false, [], BASELINE_FOLDERS))
      .toBe(seededDefaultName('Starter'));
  });

  it('locked but the dated default is itself allowlisted: keeps the dated default', () => {
    const lock = [seededDefaultName('Arena'), 'test-campaign'];
    expect(seedPrefillName('Arena', true, lock, BASELINE_FOLDERS))
      .toBe(seededDefaultName('Arena'));
  });

  it('locked, dated default refused, affinity free: each preset prefills its OWN name', () => {
    // Both qa-arena and qa-starter are free; the Starter modal must NOT
    // prefill qa-arena just because it comes first in server order (the
    // 2026-11-22 RT face: a starter roll would have been named qa-arena).
    expect(seedPrefillName('Arena', true, SET_LOCK, BASELINE_FOLDERS)).toBe('qa-arena');
    expect(seedPrefillName('Starter', true, SET_LOCK, BASELINE_FOLDERS)).toBe('qa-starter');
  });

  it('affinity skip when the matching name is taken: falls to the first free member', () => {
    // qa-arena exists → the Arena preset's affinity name is taken, so it
    // advances to the next free member…
    const arenaTaken = [...BASELINE_FOLDERS, 'qa-arena'];
    expect(seedPrefillName('Arena', true, SET_LOCK, arenaTaken)).toBe('qa-starter');
    // …and symmetrically, with qa-starter taken the Starter preset lands on
    // qa-arena (server order among the remaining free members).
    const starterTaken = [...BASELINE_FOLDERS, 'qa-starter'];
    expect(seedPrefillName('Starter', true, SET_LOCK, starterTaken)).toBe('qa-arena');
  });

  it('no free affinity match: generic first-free fallback (existing law, unchanged)', () => {
    // Lock names carry no preset prefix — both presets share the fallback.
    const lock = ['test-campaign', 'qa-foo'];
    expect(seedPrefillName('Arena', true, lock, BASELINE_FOLDERS)).toBe('qa-foo');
    expect(seedPrefillName('Starter', true, lock, BASELINE_FOLDERS)).toBe('qa-foo');
  });

  it('locked with NO free allowlisted name: keeps the dated default (the honest refused-note face)', () => {
    const folders = [...BASELINE_FOLDERS, 'qa-arena', 'qa-starter'];
    expect(seedPrefillName('Arena', true, SET_LOCK, folders)).toBe(seededDefaultName('Arena'));
    expect(seedPrefillName('Starter', true, SET_LOCK, folders)).toBe(seededDefaultName('Starter'));
  });

  it('locked with an empty allowlist (malformed config): dated default, no crash', () => {
    expect(seedPrefillName('Arena', true, [], BASELINE_FOLDERS)).toBe(seededDefaultName('Arena'));
  });
});
