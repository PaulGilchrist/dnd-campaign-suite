// @maintained-by-ai
// seedPrefillName (backlog 2026-11-22 improve seed-prefill-lock-aware): under
// a CAMPAIGN_LOCK set that refuses the dated quick-create default, the modal
// prefill must land on the FIRST FREE ALLOWLISTED NAME (server lockNames
// order, folder-absent), so the default face always commits. Every other face
// keeps the dated default (unlocked / default itself allowlisted / no free
// member left — the last face is the one SeedLockNote must keep warning about).
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

  it('locked, dated default refused: first free allowlisted name in server order', () => {
    // test-campaign's folder exists → qa-arena is the first member without one.
    expect(seedPrefillName('Arena', true, SET_LOCK, BASELINE_FOLDERS)).toBe('qa-arena');
    expect(seedPrefillName('Starter', true, SET_LOCK, BASELINE_FOLDERS)).toBe('qa-arena');
  });

  it('advances past taken members: after qa-arena exists, the next prefill is qa-starter', () => {
    const folders = [...BASELINE_FOLDERS, 'qa-arena'];
    expect(seedPrefillName('Starter', true, SET_LOCK, folders)).toBe('qa-starter');
  });

  it('locked with NO free allowlisted name: keeps the dated default (the honest refused-note face)', () => {
    const folders = [...BASELINE_FOLDERS, 'qa-arena', 'qa-starter'];
    expect(seedPrefillName('Arena', true, SET_LOCK, folders)).toBe(seededDefaultName('Arena'));
  });

  it('locked with an empty allowlist (malformed config): dated default, no crash', () => {
    expect(seedPrefillName('Arena', true, [], BASELINE_FOLDERS)).toBe(seededDefaultName('Arena'));
  });
});
