// @maintained-by-ai 2026-11-19
// Regression (fix-run 2026-11-19, same family as the resolved
// bug-clear-latch-eviction-resurrects-stamps and the clear-lane pin in
// DeathSavingThrows.clear-single-write.test.jsx): rollDeathSave used to fire
// up to FOUR sequential setRuntimeValue calls (currentHitPoints on a NAT 20,
// isDead on the fatal roll, then both tracks), each POSTing a whole-bucket
// snapshot of the character store. HTTP/1.1 socket fan-out gives same-origin
// POSTs no arrival-order guarantee, so a stale intermediate — e.g. `isDead:1`
// still paired with a 2/3 failures track, or restored HP with pre-roll
// tracks — could land LAST and leave the server bucket divergent via the SSE
// echo (live-witnessed on the wire pre-fix: the fatal roll shipped an
// intermediate body carrying exactly that stale pairing). These pins run the
// REAL useRuntimeState module against a fetch spy and lock the fix: a
// terminal roll (fatal AND NAT-20 restore) is exactly ONE whole-bucket POST
// whose single body carries EVERY mutated field — no intermediate body exists
// that could interleave — while the bucket's other fields ride through
// untouched.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
  clearDeathSavePrompt: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/deathSaveRules.js', () => ({
  isStable: vi.fn(() => false),
  isDead: vi.fn(() => false),
  rollDeathSave: vi.fn(),
  rollDeathSaveWithAdvantage: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/conditionEffects.js', () => ({
  hasSaveModifier: vi.fn(() => false),
}));

vi.mock('../../../services/combat/conditions/targetEffectDefinitions.js', () => ({
  getActiveTargetEffect: vi.fn(() => null),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async () => ({})),
}));

// The real runtime-store module — this test pins the WIRE shape, so no fake.
import { setRuntimeValue, clearRuntimeState } from '../../../hooks/runtime/useRuntimeState.js';
import DeathSavingThrows from './DeathSavingThrows.jsx';
import * as deathSaveRules from '../../../services/combat/conditions/deathSaveRules.js';
import { addEntry } from '../../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign';
const CHARACTER = 'DoomedCleric';
const EMPTY_TRACK = [false, false, false];
const BUCKET_URL = `/api/campaigns/${CAMPAIGN}/${CHARACTER}`;

let fetchCalls;

function postsToBucket() {
  return fetchCalls.filter((c) => c.url === BUCKET_URL && c.method === 'POST');
}

function loggedEntries() {
  return vi.mocked(addEntry).mock.calls.map(([, entry]) => entry);
}

function clickRollButton() {
  fireEvent.click(screen.getByRole('button', { name: /roll/i }));
}

function renderSheet() {
  render(
    <DeathSavingThrows
      playerStats={{ name: CHARACTER }}
      campaignName={CAMPAIGN}
      isLocalhost
      onRollResult={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchCalls = [];
  vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
    fetchCalls.push({ url, method: opts?.method, body: opts?.body });
    return { ok: true, json: async () => ({}) };
  }));
  clearRuntimeState(CHARACTER);
  deathSaveRules.isStable.mockReturnValue(false);
  deathSaveRules.isDead.mockReturnValue(false);
});

describe('DeathSavingThrows — roll lane is one write per outcome (no bucket divergence)', () => {
  it('a fatal roll (third failure) lands isDead + both tracks in exactly ONE whole-bucket POST', () => {
    // Replay the traffic that arms the third failure — each legitimate write
    // rides its own POST — including the 0-HP bucket field the roll must not
    // touch (RAW: a fatal roll never restores HP).
    setRuntimeValue(CHARACTER, 'currentHitPoints', 0, CAMPAIGN);
    setRuntimeValue(CHARACTER, 'deathSaves', EMPTY_TRACK, CAMPAIGN);
    setRuntimeValue(CHARACTER, 'deathFailures', [true, true, false], CAMPAIGN);
    fetchCalls = [];

    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 5, result: 'dead', isNat20: false, isNat1: false,
      newSaves: EMPTY_TRACK, newFailures: [true, true, true], restoredToHp: null,
    });
    renderSheet();
    clickRollButton();

    const rollPosts = postsToBucket();
    // THE pin: one body ⇒ nothing to interleave. The pre-fix lane shipped an
    // intermediate snapshot pairing `isDead:1` with the stale 2/3 failures
    // track — reordered, the server kept DEAD beside wrong tracks.
    expect(rollPosts.length).toBe(1);
    const value = JSON.parse(rollPosts[0].body).value;
    expect(value.isDead).toBe(1);
    expect(value.deathSaves).toEqual(EMPTY_TRACK);
    expect(value.deathFailures).toEqual([true, true, true]);
    // Other bucket fields ride through byte-untouched (never restored here).
    expect(value.currentHitPoints).toBe(0);

    // Log rows keep their current order/shape: roll row, then the dead
    // summary row — exactly one roll and one finality row per click.
    const rows = loggedEntries().filter((entry) => entry.type === 'death_save');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(expect.objectContaining({
      type: 'death_save', characterName: CHARACTER, roll: 5, success: false,
      totalSuccesses: 0, totalFailures: 3,
    }));
    expect(rows[1]).toEqual(expect.objectContaining({
      type: 'death_save', characterName: CHARACTER, result: 'dead',
      totalSuccesses: 0, totalFailures: 3,
    }));
  });

  it('a NAT 20 restore lands currentHitPoints + both reset tracks in exactly ONE whole-bucket POST', () => {
    setRuntimeValue(CHARACTER, 'currentHitPoints', 0, CAMPAIGN);
    setRuntimeValue(CHARACTER, 'deathSaves', EMPTY_TRACK, CAMPAIGN);
    setRuntimeValue(CHARACTER, 'deathFailures', [false, false, true], CAMPAIGN);
    fetchCalls = [];

    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 20, result: 'nat20', isNat20: true, isNat1: false,
      newSaves: EMPTY_TRACK, newFailures: EMPTY_TRACK, restoredToHp: 1,
    });
    renderSheet();
    clickRollButton();

    const rollPosts = postsToBucket();
    // One body carries the restore AND the cleared tracks: no intermediate
    // can leave a standing creature still wearing pre-roll failures.
    expect(rollPosts.length).toBe(1);
    const value = JSON.parse(rollPosts[0].body).value;
    expect(value.currentHitPoints).toBe(1);
    expect(value.deathSaves).toEqual(EMPTY_TRACK);
    expect(value.deathFailures).toEqual(EMPTY_TRACK);
  });

  it('a non-terminal roll is still exactly ONE bucket POST carrying the mutated track only', () => {
    setRuntimeValue(CHARACTER, 'currentHitPoints', 0, CAMPAIGN);
    setRuntimeValue(CHARACTER, 'deathSaves', EMPTY_TRACK, CAMPAIGN);
    setRuntimeValue(CHARACTER, 'deathFailures', [true, false, false], CAMPAIGN);
    fetchCalls = [];

    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 14, result: 'success', isNat20: false, isNat1: false,
      newSaves: [true, false, false], newFailures: [true, false, false], restoredToHp: null,
    });
    renderSheet();
    clickRollButton();

    const rollPosts = postsToBucket();
    expect(rollPosts.length).toBe(1);
    const value = JSON.parse(rollPosts[0].body).value;
    expect(value.deathSaves).toEqual([true, false, false]);
    expect(value.deathFailures).toEqual([true, false, false]);
    expect(value.currentHitPoints).toBe(0);
    expect(value.isDead).toBeUndefined();
  });
});
