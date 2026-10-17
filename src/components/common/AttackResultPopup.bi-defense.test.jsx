// @maintained-by-ai
// @improved-by-ai
// BI-defense seam: AttackResultPopup owns the bookkeeping that runs when a defender
// accepts the "Bardic Inspiration - Defense" offer in the roll popup — before/after
// callbacks, inspiration-pool accounting, popup rewrite to auto-miss, the campaign
// log entry, and granted-state reset. The die roll itself belongs to DiceRollResult
// (covered by DiceRollResult.interactive.test.jsx); here Math.random is seeded so
// every assertion can pin the exact roll value, AC, and narrative.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AttackResultPopup from './AttackResultPopup.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../services/ui/logService.js';

// ── Mock dependencies ──
// Network/SSE boundaries: the store becomes a scripted read-map plus recorded
// writes; the log is a recorded call list. The popup's behavior is the subject.

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Deterministic dice and popup fixtures ──

const RANDOM = 0.5;
const rollFor = (dieSize) => Math.floor(RANDOM * dieSize) + 1;
const D6 = 6;
const DIE = rollFor(D6); // 4

const ATTACK_TOTAL = 21; // 18 + 3
const MISS_AC = 25; // 25 + 4 = 29 > 21 → boosted AC wins, attack becomes a miss
const HIT_AC = 0; // 0 + 4 = 4 ≤ 21 → attack still hits

function biDefensePopup(overrides = {}) {
  return {
    name: 'Test Attack',
    type: 'd20',
    rolls: [18],
    bonus: 3,
    hit: true,
    bardicInspirationDefense: true,
    bardicInspirationDefenseDieSize: D6,
    bardicInspirationDefenseTargetName: 'Bard',
    targetAc: MISS_AC,
    ...overrides,
  };
}

function renderPopup(props = {}) {
  return render(
    <AttackResultPopup
      popupHtml={biDefensePopup()}
      onClose={vi.fn()}
      campaignName="test-campaign"
      attackerName="Goblin"
      setPopupHtml={vi.fn()}
      {...props}
    />
  );
}

// Script what getRuntimeValue(characterKey, propertyName, campaignName) reads back.
function mockBardReads(reads = {}) {
  getRuntimeValue.mockImplementation((_characterKey, propertyName) => reads[propertyName] ?? null);
}

function clickBiDefense() {
  fireEvent.click(screen.getByRole('button', { name: /Bardic Inspiration - Defense/i }));
}

// Last write of the happy path — waitFor on this to know the async handler settled.
const defenseResolved = () =>
  expect(setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationGrantedBy', null, 'test-campaign');

const usesWrites = () => setRuntimeValue.mock.calls.filter(([, prop]) => prop === 'bardicInspirationUses');

let consoleSpies = [];
function silenceConsole() {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  consoleSpies.push(spy);
  return spy;
}

// ── Tests ──

describe('AttackResultPopup — Bardic Inspiration (Defense)', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(RANDOM);
    mockBardReads();
  });

  afterEach(() => {
    consoleSpies.forEach((spy) => spy.mockRestore());
    consoleSpies = [];
    Math.random.mockRestore();
    vi.clearAllMocks();
  });

  describe('button visibility', () => {
    it('offers the defense button labelled with the granted die size when the attack carries the defense flag', () => {
      renderPopup({ popupHtml: biDefensePopup({ bardicInspirationDefenseDieSize: 8 }) });

      expect(screen.getByRole('button', { name: /Bardic Inspiration - Defense \(d8\)/i })).toBeInTheDocument();
    });

    it('offers no defense button when the attack lacks the defense flag', () => {
      renderPopup({ popupHtml: biDefensePopup({ bardicInspirationDefense: false }) });

      expect(screen.queryByRole('button', { name: /Bardic Inspiration - Defense/i })).not.toBeInTheDocument();
    });
  });

  describe('accepting the defense offer', () => {
    it('notifies before/after callbacks exactly once, threading the adjudication payload through unchanged', async () => {
      const onBeforeBiDefense = vi.fn().mockResolvedValue(undefined);
      const onAfterBiDefense = vi.fn().mockResolvedValue(undefined);
      mockBardReads({ bardicInspirationUses: { current: 1 } });

      renderPopup({ onBeforeBiDefense, onAfterBiDefense });
      clickBiDefense();

      await waitFor(() => expect(onAfterBiDefense).toHaveBeenCalledTimes(1));

      const expectedPayload = {
        dieValue: DIE,
        dieSize: D6,
        newAc: MISS_AC + DIE,
        willMiss: true,
        targetName: 'Bard',
      };
      expect(onBeforeBiDefense).toHaveBeenCalledTimes(1);
      expect(onBeforeBiDefense.mock.calls[0][0]).toEqual(expectedPayload);
      expect(onAfterBiDefense.mock.calls[0][0]).toEqual(expectedPayload);
    });

    it('runs the bookkeeping to completion even when the optional callbacks are omitted', async () => {
      mockBardReads({ bardicInspirationUses: { current: 1 } });

      renderPopup();
      clickBiDefense();

      await waitFor(defenseResolved);
    });
  });

  describe('inspiration pool accounting', () => {
    it.each([
      { label: 'a number', stored: 3, remaining: 2 },
      { label: 'an object { current }', stored: { current: 2 }, remaining: 1 },
      { label: 'a string', stored: '5', remaining: 4 },
    ])('decrements the pool once when stored as $label', async ({ stored, remaining }) => {
      mockBardReads({ bardicInspirationUses: stored });

      renderPopup();
      clickBiDefense();

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationUses', remaining, 'test-campaign');
      });
    });

    it.each([
      { label: 'number 0', stored: 0 },
      { label: 'object { current: 0 }', stored: { current: 0 } },
      { label: 'string "0"', stored: '0' },
      { label: 'a negative number', stored: -1 },
      { label: 'never-stored null', stored: null },
    ])('leaves the pool untouched when it is exhausted or missing ($label)', async ({ stored }) => {
      mockBardReads({ bardicInspirationUses: stored });

      renderPopup();
      clickBiDefense();

      await waitFor(defenseResolved);
      expect(usesWrites()).toHaveLength(0);
    });

    it('never touches the pool when the bard granted the die to themselves (the grant already paid)', async () => {
      mockBardReads({ bardicInspirationUses: 3, bardicInspirationGrantedBy: 'Bard' });

      renderPopup();
      clickBiDefense();

      await waitFor(defenseResolved);
      expect(usesWrites()).toHaveLength(0);
    });
  });

  describe('popup result rewrite', () => {
    it('rewrites the popup as a guaranteed auto-miss when the boosted AC beats the attack', async () => {
      const popupHtml = biDefensePopup(); // 21 < 25 + 4
      const setPopupHtml = vi.fn();
      mockBardReads({ bardicInspirationUses: { current: 1 } });

      renderPopup({ popupHtml, setPopupHtml });
      clickBiDefense();

      await waitFor(() => expect(setPopupHtml).toHaveBeenCalledTimes(1));
      expect(setPopupHtml).toHaveBeenCalledWith({ ...popupHtml, hit: false, isAutoMiss: true });
    });

    it('leaves the popup as a hit when the boosted AC still falls short', async () => {
      const setPopupHtml = vi.fn();
      mockBardReads({ bardicInspirationUses: { current: 1 } });

      renderPopup({ popupHtml: biDefensePopup({ targetAc: HIT_AC }), setPopupHtml });
      clickBiDefense();

      await waitFor(defenseResolved);
      expect(setPopupHtml).not.toHaveBeenCalled();
    });
  });

  describe('campaign log entry', () => {
    it('logs an ability_use entry with an attacker-aware miss narrative', async () => {
      mockBardReads({ bardicInspirationUses: { current: 1 } });

      renderPopup({ attackerName: 'Goblin' });
      clickBiDefense();

      await waitFor(() => expect(logService.addEntry).toHaveBeenCalledTimes(1));

      const [campaign, entry] = logService.addEntry.mock.calls[0];
      expect(campaign).toBe('test-campaign');
      expect(entry).toMatchObject({
        type: 'ability_use',
        characterName: 'Bard',
        abilityName: 'Combat Inspiration - Defense',
        biDieRoll: DIE,
      });
      expect(typeof entry.timestamp).toBe('number');
      expect(entry.description).toContain("Goblin's attack missed!");
      expect(entry.description).toContain(`rolling ${DIE} to boost AC to ${MISS_AC + DIE}`);
      expect(entry.description).toContain(`Attack total (${ATTACK_TOTAL}) < new AC (${MISS_AC + DIE})`);
    });

    it('logs a "still hits" narrative when the AC boost is not enough', async () => {
      mockBardReads({ bardicInspirationUses: { current: 1 } });

      renderPopup({ popupHtml: biDefensePopup({ targetAc: HIT_AC }) });
      clickBiDefense();

      await waitFor(() => expect(logService.addEntry).toHaveBeenCalledTimes(1));

      const [, entry] = logService.addEntry.mock.calls[0];
      expect(entry.description).toContain('still hits');
      expect(entry.description).toContain(`${ATTACK_TOTAL} >= ${HIT_AC + DIE}`);
      expect(entry.description).not.toContain('missed');
    });
  });

  describe('granted-state reset', () => {
    it('clears the granted die, combat options, and grantor after the defense resolves', async () => {
      mockBardReads({ bardicInspirationUses: { current: 1 } });

      renderPopup();
      clickBiDefense();

      await waitFor(defenseResolved);
      expect(setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationDie', null, 'test-campaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationCombatOptions', null, 'test-campaign');
    });
  });

  describe('failure handling', () => {
    it('still resets granted state when the campaign log write fails', async () => {
      const consoleError = silenceConsole();
      logService.addEntry.mockRejectedValueOnce(new Error('log write failed'));
      mockBardReads({ bardicInspirationUses: { current: 1 } });

      renderPopup();
      clickBiDefense();

      await waitFor(defenseResolved);
      expect(consoleError).toHaveBeenCalled();
    });

    it('refuses to act when the defense popup names no defender', async () => {
      const consoleError = silenceConsole();

      renderPopup({ popupHtml: biDefensePopup({ bardicInspirationDefenseTargetName: undefined }) });
      clickBiDefense();

      await waitFor(() => expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('No targetName')));
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });
});
