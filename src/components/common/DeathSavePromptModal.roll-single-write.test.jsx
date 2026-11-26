// @maintained-by-ai 2026-11-19
// Regression (fix-run 2026-11-19, sibling of the sheet-lane pin
// DeathSavingThrows.roll-single-write.test.jsx — bug-death-save-prompt-modal-
// roll-lane-sequential-bucket-posts): handleRoll used to fire up to FOUR
// sequential setRuntimeValue calls (both tracks, isDead when fatal,
// currentHitPoints on a NAT 20 AFTER the prompt clear), each POSTing a whole-
// bucket snapshot of the character store. HTTP/1.1 socket fan-out gives same-
// origin POSTs no arrival-order guarantee, so a stale intermediate — isDead:0
// beside third-failure tracks, or restored HP wearing pre-roll tracks — could
// land LAST and leave the server bucket divergent via the SSE echo (both
// shapes live-witnessed on the wire pre-fix). The NAT 20 leg additionally had
// a SECOND HP producer: the death-save-result window listeners in
// CharHitPoints.jsx and Initiative.jsx each POSTing their own independently-
// ordered snapshot. The fix mirrors the sheet lane: ONE setRuntimeBatch per
// roll (modal = sole char-bucket writer) and an hpWritten flag on the event
// detail so the listeners skip their own currentHitPoints POST. These pins run
// the REAL useRuntimeState + REAL savePromptService modules against a fetch
// spy — a terminal roll is exactly ONE char-bucket POST whose single body
// carries EVERY mutated field, and with the CharHitPoints listener mounted
// live the NAT 20 still lands exactly ONE char-bucket POST (HP written once).
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DeathSavePromptModal from './DeathSavePromptModal.jsx';
import CharHitPoints from '../char-sheet/char-summary/CharHitPoints.jsx';
import * as deathSaveRules from '../../services/combat/conditions/deathSaveRules.js';
import {
  getAllStoreKeys,
  getStore,
  setRuntimeObject,
  clearRuntimeState,
} from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../services/ui/gmHost.js', () => ({ isGmHost: vi.fn(() => false) }));

// Rules boundary — outcomes are forced so each leg is deterministic. The
// real DeathSavingThrows (mounted inside CharHitPoints while HP <= 0) also
// consults the track predicates, same mock shape as the sheet-lane pin.
vi.mock('../../services/combat/conditions/deathSaveRules.js', () => ({
  rollDeathSave: vi.fn(),
  rollDeathSaveWithAdvantage: vi.fn(),
  isStable: vi.fn(() => false),
  isDead: vi.fn(() => false),
}));

// Log lane captured, not fetched (row-shape pins live in
// DeathSavePromptModal.finality-rows.test.jsx).
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// DeathSavingThrows imports (mounted inside CharHitPoints while HP <= 0) —
// isolated exactly like the sheet-lane wire pin.
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  hasSaveModifier: vi.fn(() => false),
}));
vi.mock('../../services/combat/conditions/targetEffectDefinitions.js', () => ({
  getActiveTargetEffect: vi.fn(() => null),
}));

// Capture the modal's SSE handler so tests arm prompts exactly as the real
// Subscriber delivers them (sibling-modal-test seam).
let emitEvent = null;
vi.mock('./Subscriber.jsx', () => ({
  default: function MockSubscriber({ handleEvent }) {
    emitEvent = handleEvent;
    return null;
  },
}));

// The REAL runtime store + REAL savePromptService ride the fetch spy below.

const CAMPAIGN = 'test-campaign';
const TARGET = 'DoomedFighter';
const BUCKET_URL = `/api/campaigns/${CAMPAIGN}/${TARGET}`;
const PROMPT_KEY = `deathSavePrompt-${TARGET}`;
const RESULT_KEY = `deathSaveResult-${TARGET}`;
const PROMPT_ID = 'prompt-single-write';
const EMPTY_TRACK = [false, false, false];

let fetchCalls;
let dispatchedResults;
const collectResults = (e) => dispatchedResults.push(e.detail);

function charBucketPosts() {
  return fetchCalls.filter((c) => c.url === BUCKET_URL && c.method === 'POST');
}

function setupEventSource() {
  const MockEventSource = vi.fn();
  MockEventSource.prototype.close = vi.fn();
  Object.defineProperty(globalThis, 'EventSource', {
    value: MockEventSource,
    writable: true,
    configurable: true,
  });
}

// Memory-only materialization (skipSync) of what the live SSE/seed lanes put
// in the mirrors — keeps the wire census to the roll's own traffic.
function seedBucket(fields) {
  setRuntimeObject(TARGET, fields, CAMPAIGN, true);
}

async function openPrompt() {
  render(<DeathSavePromptModal campaignName={CAMPAIGN} />);
  act(() => {
    emitEvent({
      key: `change-${CAMPAIGN}-${PROMPT_KEY}`,
      data: { promptId: PROMPT_ID, targetName: TARGET },
    });
  });
  // Mirror of the armed key — clearDeathSavePrompt's mirror gate.
  setRuntimeObject(PROMPT_KEY, { promptId: PROMPT_ID, targetName: TARGET }, CAMPAIGN, true);
  await screen.findByText(/must make a/i);
}

function clickRoll() {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
}

const okResponse = { ok: true, status: 200, json: () => Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  setupEventSource();
  fetchCalls = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    fetchCalls.push({ url: String(url), method: init?.method, body: init?.body });
    return okResponse;
  });
  dispatchedResults = [];
  window.addEventListener('death-save-result', collectResults);
});

afterEach(() => {
  window.removeEventListener('death-save-result', collectResults);
  getStore('campaign').delete(PROMPT_KEY);
  getStore('campaign').delete(RESULT_KEY);
  clearRuntimeState(TARGET);
  clearRuntimeState(PROMPT_KEY);
  clearRuntimeState(RESULT_KEY);
  globalThis.fetch.mockRestore();
  delete globalThis.EventSource;
});

describe('DeathSavePromptModal roll lane — one merged batch per roll', () => {
  it('a fatal roll lands isDead + both tracks in exactly ONE whole-bucket POST (no isDead:0 intermediate)', async () => {
    seedBucket({ currentHitPoints: 0, deathSaves: EMPTY_TRACK, deathFailures: [true, true, false], isDead: 0 });
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 5, result: 'dead', isNat20: false, isNat1: false,
      newSaves: EMPTY_TRACK, newFailures: [true, true, true], restoredToHp: null,
    });
    await openPrompt();
    clickRoll();
    await screen.findByText('DEAD');

    // THE pin: pre-fix this leg shipped TWO bucket snapshots (failures-first
    // with isDead still 0, then isDead:1) — reordered, a 3/3-failure corpse
    // stayed alive on the server. Now one body carries the whole outcome.
    const rollPosts = charBucketPosts();
    expect(rollPosts).toHaveLength(1);
    const value = JSON.parse(rollPosts[0].body).value;
    expect(value.isDead).toBe(1);
    expect(value.deathSaves).toEqual(EMPTY_TRACK);
    expect(value.deathFailures).toEqual([true, true, true]);
    // Other bucket fields ride through byte-untouched (RAW: death never heals).
    expect(value.currentHitPoints).toBe(0);

    // Roll row (page-singleton listener, outside this file) aside, the modal's
    // own lanes keep their shape: result POST then the mirror-gated prompt
    // DELETE — and a NON-restoring roll's event detail stays byte-identical to
    // the pre-fix payload (no hpWritten stamp) so other consumers are blind to
    // the change.
    expect(fetchCalls.some((c) => c.url === `/api/campaigns/${CAMPAIGN}/${RESULT_KEY}` && c.method === 'POST')).toBe(true);
    await vi.waitFor(() => expect(getAllStoreKeys()).not.toContain(PROMPT_KEY));
    expect(dispatchedResults).toHaveLength(1);
    expect(dispatchedResults[0]).not.toHaveProperty('hpWritten');
    expect(dispatchedResults[0]).toMatchObject({ targetName: TARGET, roll: 5, result: 'dead', restoredToHp: null });
  });

  it('a NAT 20 lands currentHitPoints + both reset tracks in ONE POST, and the CharHitPoints listener does NOT write HP a second time', async () => {
    seedBucket({ currentHitPoints: 0, deathSaves: [true, false, false], deathFailures: [true, false, false], isDead: 0 });
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 20, result: 'nat20', isNat20: true, isNat1: false,
      newSaves: EMPTY_TRACK, newFailures: EMPTY_TRACK, restoredToHp: 1,
    });

    // CharHitPoints mounts its death-save-result listener next to the modal —
    // pre-fix that listener fired its OWN whole-bucket POST (restored HP
    // beside the pre-roll tracks) on top of the modal's separate HP write.
    render(
      <CharHitPoints playerStats={{ name: TARGET, hitPoints: 112 }} campaignName={CAMPAIGN} />
    );
    await openPrompt();
    clickRoll();
    await screen.findByText('NATURAL 20 — STABILIZED!');

    const rollPosts = charBucketPosts();
    // HP written EXACTLY ONCE — the modal's merged batch is the sole writer
    // (listener skipped via the hpWritten declaration).
    expect(rollPosts).toHaveLength(1);
    const value = JSON.parse(rollPosts[0].body).value;
    expect(value.currentHitPoints).toBe(1);
    expect(value.deathSaves).toEqual(EMPTY_TRACK);
    expect(value.deathFailures).toEqual(EMPTY_TRACK);
    expect(value.isDead).toBe(0);

    // The event still carries the restore fields for every other consumer,
    // and declares hpWritten so the listeners stay out of the char bucket.
    expect(dispatchedResults).toHaveLength(1);
    expect(dispatchedResults[0]).toMatchObject({
      targetName: TARGET, roll: 20, isNat20: true, restoredToHp: 1, hpWritten: true,
    });

    // The chip face still paints from the same event (display lane intact).
    const chip = document.querySelector('.death-saves-result');
    expect(chip).not.toBeNull();
    expect(chip).toHaveTextContent('(20)');
  });

  it('a non-terminal roll is exactly ONE char-bucket POST carrying the mutated tracks only', async () => {
    seedBucket({ currentHitPoints: 0, deathSaves: EMPTY_TRACK, deathFailures: [true, false, false], isDead: 0 });
    deathSaveRules.rollDeathSave.mockReturnValue({
      roll: 14, result: 'success', isNat20: false, isNat1: false,
      newSaves: [true, false, false], newFailures: [true, false, false], restoredToHp: null,
    });
    await openPrompt();
    clickRoll();
    await screen.findByText('DEATH SAVE SUCCESS');

    const rollPosts = charBucketPosts();
    expect(rollPosts).toHaveLength(1);
    const value = JSON.parse(rollPosts[0].body).value;
    expect(value.deathSaves).toEqual([true, false, false]);
    expect(value.deathFailures).toEqual([true, false, false]);
    expect(value.isDead).toBe(0);
    expect(value.currentHitPoints).toBe(0);
  });
});
