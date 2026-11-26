// @maintained-by-ai 2026-11-19
// Regression (improve-run 2026-11-19, same family as the resolved
// bug-clear-latch-eviction-resurrects-stamps): handleRemoveDead used to fire
// THREE sequential setRuntimeValue calls (isDead/deathSaves/deathFailures),
// each POSTing a whole-bucket snapshot of the character store. HTTP/1.1 socket
// fan-out gives same-origin POSTs no arrival-order guarantee, so an earlier
// body still carrying `isDead:1` could land LAST and RESURRECT the DEAD badge
// via the SSE echo while the panel already showed the cleared face (live-
// witnessed UI/server divergence). These pins run the REAL useRuntimeState
// module against a fetch spy and lock the fix: one "Clear death state" click
// is exactly ONE whole-bucket POST whose single body carries EVERY cleared
// key — no intermediate body exists that could interleave — and the bucket's
// other fields (e.g. currentHitPoints:0) ride through untouched.
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

function clickClearButton() {
  fireEvent.click(screen.getByRole('button', { name: 'Clear death state', exact: true }));
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchCalls = [];
  vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
    fetchCalls.push({ url, method: opts?.method, body: opts?.body });
    return { ok: true, json: async () => ({}) };
  }));
  clearRuntimeState(CHARACTER);
});

describe('DeathSavingThrows — clear death state is one write (no badge resurrection)', () => {
  it('clears isDead + both tracks in exactly ONE whole-bucket POST whose single body nulls out the dying track', () => {
    // Replay the traffic that kills the character (each legitimate roll write
    // rides its own POST) — including a 0-HP bucket field the clear must not
    // touch.
    setRuntimeValue(CHARACTER, 'currentHitPoints', 0, CAMPAIGN);
    setRuntimeValue(CHARACTER, 'deathSaves', EMPTY_TRACK, CAMPAIGN);
    setRuntimeValue(CHARACTER, 'deathFailures', [true, true, true], CAMPAIGN);
    setRuntimeValue(CHARACTER, 'isDead', 1, CAMPAIGN);
    fetchCalls = [];

    render(
      <DeathSavingThrows
        playerStats={{ name: CHARACTER }}
        campaignName={CAMPAIGN}
        isLocalhost
        onRollResult={vi.fn()}
      />
    );
    expect(screen.getByText(/DEAD/)).toBeInTheDocument();
    clickClearButton();

    const clearPosts = postsToBucket();
    // THE pin: one body ⇒ nothing to interleave. The pre-fix lane shipped
    // THREE whole-bucket snapshots (clearing keys one at a time) whose arrival
    // order could leave a stale body carrying `isDead:1` as the final server
    // state — the SSE echo then re-armed the DEAD badge the UI had removed.
    expect(clearPosts.length).toBe(1);
    const value = JSON.parse(clearPosts[0].body).value;
    expect(value.isDead).toBe(0);
    expect(value.deathSaves).toEqual(EMPTY_TRACK);
    expect(value.deathFailures).toEqual(EMPTY_TRACK);
    // Other bucket fields ride through byte-untouched (never restored, never
    // stripped by the clear).
    expect(value.currentHitPoints).toBe(0);

    // The mirrored local store matches the POST body (setRuntimeBatch is
    // synchronous), so any LATER write from this tab's whole-bucket snapshot
    // already carries the clear — resurrection becomes impossible there too.
    setRuntimeValue(CHARACTER, 'lastAttack', { name: 'Glaive' }, CAMPAIGN);
    const later = JSON.parse(postsToBucket().at(-1).body).value;
    expect(later.isDead).toBe(0);
    expect(later.deathSaves).toEqual(EMPTY_TRACK);
    expect(later.deathFailures).toEqual(EMPTY_TRACK);

    // Exactly one removal row per click.
    const removedRows = loggedEntries().filter((entry) => entry.result === 'removed');
    expect(removedRows).toHaveLength(1);
    expect(removedRows[0]).toEqual(expect.objectContaining({
      type: 'death_save',
      characterName: CHARACTER,
      result: 'removed',
      totalSuccesses: 0,
      totalFailures: 0,
    }));
  });

  it('re-arms the Roll area at 0 HP without restoring HP', () => {
    setRuntimeValue(CHARACTER, 'currentHitPoints', 0, CAMPAIGN);
    setRuntimeValue(CHARACTER, 'deathFailures', [true, true, true], CAMPAIGN);
    setRuntimeValue(CHARACTER, 'isDead', 1, CAMPAIGN);
    fetchCalls = [];

    render(
      <DeathSavingThrows
        playerStats={{ name: CHARACTER }}
        campaignName={CAMPAIGN}
        isLocalhost
        onRollResult={vi.fn()}
      />
    );
    clickClearButton();

    expect(screen.queryByText(/DEAD/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /roll/i })).toBeInTheDocument();
    // HP untouched: the only POST is the dying-track clear and the body still
    // says 0 — the character stays unconscious.
    const clearPosts = postsToBucket();
    expect(clearPosts.length).toBe(1);
    expect(JSON.parse(clearPosts[0].body).value.currentHitPoints).toBe(0);
  });
});
