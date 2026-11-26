// @maintained-by-ai 2026-11-14
// DeathSavePromptModal — GM-only pre-roll Cancel (improve 2026-11-14
// death-save-dismiss-for-accidental-arms)
//
// Locks the dismiss face against a GM card mistype to 0 HP (pre-roll census
// was [Roll Death Save] only — the sole exits were spending a real save or
// the restore-then-Roll void-guard dance):
// 1. Cancel renders ONLY to GM/localhost clients (isGmHost, the established
//    client-side mirror of the server's refuseUnlessGm law) and ONLY in the
//    pre-roll census; non-GM census stays byte-identical ([Roll Death Save]).
// 2. Cancel rides the EXISTING zero-write void lane: the real
//    savePromptService.clearDeathSavePrompt DELETEs deathSavePrompt-<Target>
//    (mirror-gated) and a server-confirmed answer (2xx/404) evicts BOTH
//    mirror lanes (ghost-key-404-sweep law) — with ZERO death_save log rows,
//    no deathSaveResult POST, no counter/HP/isDead writes.
// 3. A refused clear (403) keeps the mirror — a real evict is never silently
//    skipped (existing law, mirrored here at the button seam).
// 4. Result stage: Cancel is absent — it can never undo a rolled save; the
//    roll → Done lifecycle (the POST→DELETE→DELETE trio) is byte-identical.
//
// This file runs the REAL savePromptService + REAL runtime store against a
// mocked fetch (the sibling savePromptService.death-save-evict-mirror.test.js
// shape) so "routes to the clear lane with zero writes" is proven on the
// actual wire bytes, not a vi.fn() proxy. Queue/roll mechanics stay owned by
// DeathSavePromptModal.test.jsx; cross-tab null-echo retirement by
// DeathSavePromptModal.cross-tab.test.jsx — not repeated here.
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

// Controllable GM gate — render-face tests flip this (same seam as
// useLoggedDiceRollEventHandlers.drain-gm-ownership.test.js).
const mocks = vi.hoisted(() => ({ isGmHost: vi.fn(() => true) }));
vi.mock('../../services/ui/gmHost.js', () => ({ isGmHost: mocks.isGmHost }));

vi.mock('../../services/combat/conditions/deathSaveRules.js', () => ({
  rollDeathSave: vi.fn(),
}));

// Zero-write assertion for the log lane: Cancel must never arm the logger.
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
const TARGET = 'MistypedPaladin';
const OTHER = 'SecondSoul';
const KEY = `deathSavePrompt-${TARGET}`;
const OTHER_KEY = `deathSavePrompt-${OTHER}`;

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
function seedPromptMirror(targetName, promptId) {
  const key = `deathSavePrompt-${targetName}`;
  setRuntimeObject(key, { promptId, targetName }, CAMPAIGN, true);
}

async function openPrompt(targetName = TARGET) {
  render(<DeathSavePromptModal campaignName={CAMPAIGN} />);
  emitPrompt(targetName);
  seedPromptMirror(targetName);
  await screen.findByText(/must make a/i);
}

const actionButtons = () =>
  Array.from(document.querySelectorAll('.dsp-actions button')).map(
    (b) => b.textContent.trim()
  );

const fetchCalls = (method) =>
  globalThis.fetch.mock.calls.filter(([, init]) => init?.method === method);

const okResponse = { ok: true, status: 200, json: () => Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  setupEventSource();
  mocks.isGmHost.mockReturnValue(true);
  deathSaveRules.rollDeathSave.mockReturnValue({
    roll: 15,
    isNat20: false,
    isNat1: false,
    result: 'success',
    newSaves: [true, false, false],
    newFailures: [false, false, false],
    restoredToHp: null,
  });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse);
});

afterEach(() => {
  getStore('campaign').delete(KEY);
  getStore('campaign').delete(OTHER_KEY);
  clearRuntimeState(KEY);
  clearRuntimeState(OTHER_KEY);
  clearRuntimeState(TARGET);
  globalThis.fetch.mockRestore();
});

describe('DeathSavePromptModal GM-only Cancel', () => {
  describe('render face', () => {
    it('GM pre-roll census is [Roll Death Save, Cancel] — Cancel beside Roll', async () => {
      await openPrompt();
      expect(actionButtons()).toEqual(['Roll Death Save', 'Cancel']);
    });

    it('non-GM pre-roll census is byte-identical to the shipped face: [Roll Death Save] only', async () => {
      mocks.isGmHost.mockReturnValue(false);
      await openPrompt();
      expect(actionButtons()).toEqual(['Roll Death Save']);
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });

    it('Cancel vanishes the moment a rolled result is shown — it can never undo a save', async () => {
      await openPrompt();
      fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
      await screen.findByText(/^Roll:/i);

      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      expect(actionButtons()).toEqual(['Done']);
      expect(screen.getByText('DEATH SAVE SUCCESS')).toBeInTheDocument();
    });
  });

  describe('Cancel rides the zero-write void lane', () => {
    it('sends exactly one DELETE for the prompt key and zero POSTs — no result key, no log row, no roll', async () => {
      await openPrompt();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      // Wire truth: the ONLY request is the clear-lane DELETE on the exact
      // armed key. No deathSaveResult POST, no change-data POST, no log POST.
      await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
      const [url, init] = globalThis.fetch.mock.calls[0];
      expect(url).toBe(`/api/campaigns/${CAMPAIGN}/${KEY}`);
      expect(init.method).toBe('DELETE');
      expect(fetchCalls('POST')).toHaveLength(0);
      expect(addEntry).not.toHaveBeenCalled();
      expect(deathSaveRules.rollDeathSave).not.toHaveBeenCalled();
    });

    it('unmounts the modal for a single-target arm and evicts BOTH mirror lanes on the confirmed DELETE', async () => {
      getStore('campaign').set(KEY, { promptId: `prompt-${TARGET}`, targetName: TARGET });
      await openPrompt();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
      // ghost-key-404-sweep law: any server-confirmed answer (ok here) drops
      // the seed lane AND the key-named echo bucket so no clear-leg re-probes.
      await vi.waitFor(() => expect(getAllStoreKeys()).not.toContain(KEY));
      expect(getStore('campaign').has(KEY)).toBe(false);
    });

    it('advances the queue on a multi-target arm, clearing only the head target key', async () => {
      await openPrompt();
      emitPrompt(OTHER);
      seedPromptMirror(OTHER);
      await screen.findByText('(1 of 2)');

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      // The head (mistyped) prompt retires; the other live prompt keeps its
      // Roll + Cancel face untouched — nothing was cleared for it.
      expect(await screen.findByText(OTHER)).toBeInTheDocument();
      expect(screen.queryByText(TARGET)).not.toBeInTheDocument();
      expect(actionButtons()).toEqual(['Roll Death Save', 'Cancel']);
      await vi.waitFor(() => expect(fetchCalls('DELETE')).toHaveLength(1));
      expect(fetchCalls('DELETE')[0][0]).toBe(`/api/campaigns/${CAMPAIGN}/${KEY}`);
      expect(fetchCalls('POST')).toHaveLength(0);
    });

    it('a refused clear (403) keeps the mirror — a real evict is never silently skipped', async () => {
      globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 403 });
      await openPrompt();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(fetchCalls('DELETE')).toHaveLength(1);
      await Promise.resolve();
      await Promise.resolve(); // let the (non-evicting) response leg settle
      expect(getAllStoreKeys()).toContain(KEY);
    });

    it('a network-failed clear keeps the mirror and writes nothing else', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      globalThis.fetch.mockRejectedValueOnce(new Error('offline'));
      await openPrompt();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await vi.waitFor(() => expect(errSpy).toHaveBeenCalled());
      expect(getAllStoreKeys()).toContain(KEY);
      expect(fetchCalls('POST')).toHaveLength(0);
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('non-GM clients keep exactly the old exits — Roll commits the normal trio (lifecycle unchanged)', async () => {
      mocks.isGmHost.mockReturnValue(false);
      await openPrompt();

      fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
      await screen.findByText('DEATH SAVE SUCCESS');

      // The pre-existing roll trio lands unchanged: result POST → prompt
      // DELETE (both mirror lanes evicted) → hygiene result DELETE.
      await vi.waitFor(() =>
        expect(fetchCalls('POST').some(
          ([url]) => url === `/api/campaigns/${CAMPAIGN}/deathSaveResult-${TARGET}`
        )).toBe(true));
      await vi.waitFor(() =>
        expect(fetchCalls('DELETE').some(
          ([url]) => url === `/api/campaigns/${CAMPAIGN}/deathSaveResult-${TARGET}`
        )).toBe(true));
      await vi.waitFor(() => expect(getAllStoreKeys()).not.toContain(KEY));
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });
});
