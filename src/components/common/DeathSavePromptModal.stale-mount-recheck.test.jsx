// @maintained-by-ai
// DeathSavePromptModal — mount-side stale re-verdict (improve 2026-11-15 QY
// death-save-prompt-stale-selfheal)
//
// An undrained deathSavePrompt-<Target> key (e.g. a Cancel whose
// evaluate-dispatched click silently no-oped the DELETE) replays on every
// SSE-connect snapshot seed / reload + re-select as an actionable Roll
// prompt over a target whose runtime bucket has since revived — the
// .dsp-overlay then intercepts clicks until dismissed. Locks the mount-side
// bucket-canonical re-verdict (auto-evict face):
// 1. PLAYER head prompt + bucket currentHitPoints > 0 ⇒ self-evict riding
//    the mirror-gated clearDeathSavePrompt DELETE lane EXACTLY — that one
//    DELETE is the sole write (no result POST, no log row, no roll, no
//    counter/HP/isDead writes) — and BOTH mirror lanes evict on the
//    confirmed answer (ghost-key-404-sweep law).
// 2. Genuine arm (bucket HP <= 0) is byte-identical to the shipped face:
//    zero requests on the verdict path, Roll + trio unchanged.
// 3. Absent HP key (fresh bucket, not yet seeded) NEVER auto-evicts — the
//    prompt keeps the normal face.
// 4. Non-roster (monster/NPC) targets keep the existing face (scope is the
//    player lane), even with a >0 HP bucket.
// 5. A stale head self-heals without wedging the queue: the genuinely armed
//    prompt behind it surfaces with its untouched Roll face.
// 6. Late-seed re-verdict: the prompt echo landing BEFORE the char bucket
//    (reload + re-select order) starts on the normal face and evicts the
//    moment the HP value lands (useRuntimeValue subscription).
// 7. Result-stage head is exempt — a nat20 stamping HP=1 can never evict
//    the rolled-save panel before Done.
//
// Same seam as DeathSavePromptModal.gm-cancel.test.jsx: REAL savePromptService
// + REAL runtime store against a mocked fetch, so "routes to the clear lane
// with exactly one DELETE" is proven on the wire bytes. Queue/roll mechanics
// stay owned by DeathSavePromptModal.test.jsx; cross-tab null-echo retirement
// by DeathSavePromptModal.cross-tab.test.jsx — not repeated here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DeathSavePromptModal from './DeathSavePromptModal.jsx';
import * as deathSaveRules from '../../services/combat/conditions/deathSaveRules.js';
import { addEntry } from '../../services/ui/logService.js';
import {
  getAllStoreKeys,
  getStore,
  setRuntimeObject,
  clearRuntimeState,
} from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../services/ui/gmHost.js', () => ({ isGmHost: vi.fn(() => false) }));

vi.mock('../../services/combat/conditions/deathSaveRules.js', () => ({
  rollDeathSave: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// Capture the modal's SSE handler so tests arm prompts exactly as the real
// Subscriber delivers them (same seam as the sibling modal tests).
let emitEvent = null;
vi.mock('./Subscriber.jsx', () => ({
  default: function MockSubscriber({ handleEvent }) {
    emitEvent = handleEvent;
    return null;
  },
}));

const CAMPAIGN = 'test-campaign';
const ALIVE = 'AliveAlly';   // player, bucket currentHitPoints 18 — stale target
const DYING = 'DyingHero';   // player, bucket currentHitPoints 0 — genuine arm
const NO_KEY = 'UnseededSoul'; // player, bucket carries NO HP key — conservative keep
const MONSTER = 'Goblin 1';  // not in the roster — monster lane, face unchanged
// The live modal receives App's computedCharacters roster (bucket-canonical
// verdicts apply to the PLAYER lane only — criterion 4 scoping).
const ROSTER = [{ name: ALIVE }, { name: DYING }, { name: NO_KEY }];

const promptKey = (targetName) => `deathSavePrompt-${targetName}`;

function setupEventSource() {
  const MockEventSource = vi.fn();
  MockEventSource.prototype.close = vi.fn();
  Object.defineProperty(globalThis, 'EventSource', {
    value: MockEventSource,
    writable: true,
    configurable: true,
  });
}

function emitPrompt(targetName, promptId = `prompt-${targetName}`) {
  act(() => {
    emitEvent({
      key: `change-${CAMPAIGN}-deathSavePrompt-${targetName}`,
      data: { promptId, targetName },
    });
  });
}

// The runtime-store mirror of the armed key — what App.jsx's echo/seed lanes
// materialize in a live tab and what clearDeathSavePrompt's mirror gate reads.
function seedPromptMirror(targetName, promptId = `prompt-${targetName}`) {
  setRuntimeObject(promptKey(targetName), { promptId, targetName }, CAMPAIGN, true);
}

// Character bucket seed — exactly what the campaign-select char seed /
// full-store echo lane materializes (skipSync ⇒ memory-only, no POST noise
// in the wire census).
function seedBucketHp(targetName, hp) {
  setRuntimeObject(targetName, { currentHitPoints: hp }, CAMPAIGN, true);
}

function renderModal() {
  return render(<DeathSavePromptModal campaignName={CAMPAIGN} characters={ROSTER} />);
}

const fetchCalls = (method) =>
  globalThis.fetch.mock.calls.filter(([, init]) => init?.method === method);

const okResponse = { ok: true, status: 200, json: () => Promise.resolve({}) };

const overlayGone = () => expect(document.querySelector('.dsp-overlay')).toBeNull();

beforeEach(() => {
  vi.clearAllMocks();
  setupEventSource();
  deathSaveRules.rollDeathSave.mockReturnValue({
    roll: 20,
    isNat20: true,
    isNat1: false,
    result: 'nat20',
    newSaves: [true, false, false],
    newFailures: [false, false, false],
    restoredToHp: 1,
  });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse);
});

afterEach(() => {
  [ALIVE, DYING, NO_KEY, MONSTER].forEach((name) => {
    getStore('campaign').delete(promptKey(name));
    clearRuntimeState(promptKey(name));
    clearRuntimeState(name);
  });
  globalThis.fetch.mockRestore();
});

describe('DeathSavePromptModal mount-side stale re-verdict', () => {
  describe('stale face: player head prompt with bucket HP > 0 auto-evicts', () => {
    it('rides clearDeathSavePrompt exactly — one DELETE, zero other writes, overlay self-gone, both mirrors evicted', async () => {
      seedBucketHp(ALIVE, 18);
      renderModal();
      seedPromptMirror(ALIVE);
      emitPrompt(ALIVE);

      // Auto-evict face: the overlay self-clears (a brief flash is the
      // accepted face) — no actionable Roll ever survives on a live ally.
      await vi.waitFor(overlayGone);
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();

      // Wire truth: the ONLY request is the mirror-gated clear-lane DELETE
      // on the exact armed key. No result POST, no change-data POST, no log
      // row, no roll, no counter/HP/isDead writes.
      await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
      const [url, init] = globalThis.fetch.mock.calls[0];
      expect(url).toBe(`/api/campaigns/${CAMPAIGN}/${promptKey(ALIVE)}`);
      expect(init.method).toBe('DELETE');
      expect(fetchCalls('POST')).toHaveLength(0);
      expect(addEntry).not.toHaveBeenCalled();
      expect(deathSaveRules.rollDeathSave).not.toHaveBeenCalled();

      // ghost-key-404-sweep law: the confirmed answer evicts BOTH mirror
      // lanes so the key never replays the double-sweep 404.
      await vi.waitFor(() => expect(getAllStoreKeys()).not.toContain(promptKey(ALIVE)));
      expect(getStore('campaign').has(promptKey(ALIVE))).toBe(false);
    });

    it('no prompt mirror ⇒ local self-heal with ZERO requests (mirror gate refuses the blind DELETE)', async () => {
      seedBucketHp(ALIVE, 18);
      renderModal();
      emitPrompt(ALIVE); // queue entry without the echo/seed mirror lane

      await vi.waitFor(overlayGone);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('re-verdicts when the bucket lands AFTER the prompt echo (reload + re-select order)', async () => {
      renderModal();
      seedPromptMirror(ALIVE);
      emitPrompt(ALIVE);

      // Absent HP key at arrival ⇒ conservative normal face (never evicts blind).
      await screen.findByText(/must make a/i);
      expect(globalThis.fetch).not.toHaveBeenCalled();

      // The char seed lands with the revived HP — the subscription
      // re-verdicts and the stale entry self-heals.
      act(() => seedBucketHp(ALIVE, 18));
      await vi.waitFor(overlayGone);
      await vi.waitFor(() => expect(fetchCalls('DELETE')).toHaveLength(1));
      expect(fetchCalls('DELETE')[0][0]).toBe(`/api/campaigns/${CAMPAIGN}/${promptKey(ALIVE)}`);
      expect(fetchCalls('POST')).toHaveLength(0);
    });

    it('a stale head self-heals without wedging the genuinely armed prompt behind it', async () => {
      // Queue both while the stale verdict is still blind (ALIVE's bucket not
      // yet seeded) — then the seed lands and the head must retire on its
      // own, handing the untouched Roll face to the real arm behind it.
      seedBucketHp(DYING, 0);
      renderModal();
      seedPromptMirror(ALIVE);
      emitPrompt(ALIVE);
      seedPromptMirror(DYING);
      emitPrompt(DYING);
      await screen.findByText('(1 of 2)');

      act(() => seedBucketHp(ALIVE, 18));

      // The stale head retires (one DELETE for ITS key only); the real arm
      // surfaces untouched with its Roll face — the queue was never blocked.
      expect(await screen.findByText(DYING)).toBeInTheDocument();
      expect(screen.queryByText(ALIVE)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Roll Death Save' })).toBeInTheDocument();
      await vi.waitFor(() => expect(fetchCalls('DELETE')).toHaveLength(1));
      expect(fetchCalls('DELETE')[0][0]).toBe(`/api/campaigns/${CAMPAIGN}/${promptKey(ALIVE)}`);
      expect(fetchCalls('POST')).toHaveLength(0);
    });
  });

  describe('genuine arms keep the shipped face byte-identically', () => {
    it('bucket HP <= 0: mount issues ZERO requests, Roll + trio unchanged', async () => {
      seedBucketHp(DYING, 0);
      renderModal();
      seedPromptMirror(DYING);
      emitPrompt(DYING);

      await screen.findByText(/must make a/i);
      expect(globalThis.fetch).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
      await screen.findByText('NATURAL 20 — STABILIZED!');
      await vi.waitFor(() =>
        expect(fetchCalls('POST').some(
          ([url]) => url === `/api/campaigns/${CAMPAIGN}/deathSaveResult-${DYING}`
        )).toBe(true));
      await vi.waitFor(() =>
        expect(fetchCalls('DELETE').some(
          ([url]) => url === `/api/campaigns/${CAMPAIGN}/${promptKey(DYING)}`
        )).toBe(true));
      await vi.waitFor(() =>
        expect(fetchCalls('DELETE').some(
          ([url]) => url === `/api/campaigns/${CAMPAIGN}/deathSaveResult-${DYING}`
        )).toBe(true));
    });

    it('bucket with NO HP key: conservative keep — normal face, zero requests', async () => {
      renderModal();
      emitPrompt(NO_KEY);
      seedPromptMirror(NO_KEY);

      await screen.findByText(/must make a/i);
      expect(screen.getByRole('button', { name: 'Roll Death Save' })).toBeInTheDocument();
      // Flush microtasks so any (incorrectly) scheduled evict would land
      // before certifying zero writes.
      await act(async () => {});
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    it('monster/NPC target (absent roster) keeps the existing face even with a >0 HP bucket', async () => {
      seedBucketHp(MONSTER, 12);
      renderModal();
      emitPrompt(MONSTER);
      seedPromptMirror(MONSTER);

      await screen.findByText(/must make a/i);
      expect(screen.getByRole('button', { name: 'Roll Death Save' })).toBeInTheDocument();
      // Flush microtasks so any (incorrectly) scheduled evict would land
      // before certifying zero writes (player roster excludes this target).
      await act(async () => {});
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(screen.getByText(MONSTER)).toBeInTheDocument();
    });

    it('result-stage head is exempt: a nat20 HP=1 stamp never evicts the rolled-save panel', async () => {
      seedBucketHp(DYING, 0);
      renderModal();
      emitPrompt(DYING);
      seedPromptMirror(DYING);

      fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
      await screen.findByText('NATURAL 20 — STABILIZED!');

      // The roll's restoredToHp=1 write lands in the bucket (HP > 0 now) —
      // the result panel must still survive until Done.
      await vi.waitFor(() =>
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument());
      expect(screen.getByText('Restored to 1 HP')).toBeInTheDocument();
      expect(document.querySelector('.dsp-overlay')).not.toBeNull();
    });
  });
});
