// @maintained-by-ai
//
// KB 2026-11-14 improve — HoH result-stage display ignores cs-row condition
// edits. PhysiciansTouchSection previously subscribed the target's
// activeConditions BUCKET only, so conditions contributed by the combat-
// summary creature row (the getTargetConditions merge) never woke a
// re-render: a cs-side cure left a stale `Remove X` button until some other
// render (the commit guard kept the ledger honest, but the display lied).
// The fix adds useRuntimeValue('combatSummary', 'creatures', campaign) — the
// same key the SSE adoption replaces (App.jsx handleChangeKeyEvent runs
// syncCombatSummaryCache BEFORE applyStoreUpdate notifies the store, so the
// wake always lands after the merge's getCombatSummary source is fresh).
//
// Echo mechanics mirror HandOfHealingModal.live-conditions-echo.test.jsx:
// real useRuntimeState module, echoes driven through
// setRuntimeObject(..., skipSync=true) — the exact replace + notify path a
// `change-<campaign>-combatSummary` SSE adoption uses. The combatData mock
// plays the module-cache side of that lane: externalCsWrite() updates the
// board getCombatSummary serves and THEN notifies the store, byte-for-byte
// the App.jsx order. Display echoes must never POST (fetch stub counts the
// bucket writes the cure commits themselves make).

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HandOfHealingModal from './HandOfHealingModal.jsx';

// ── Mocked modules (everything except the runtime store itself) ──

vi.mock('../../../../services/ui/utils.js', () => ({
  default: { getName: (n) => (n || '').trim() },
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

// ── Re-imports ──

import * as combatData from '../../../../services/encounters/combatData.js';
import * as logService from '../../../../services/ui/logService.js';
import { setRuntimeObject, clearRuntimeState, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Fixtures ──

const CAMPAIGN = 'test-campaign';
const MONK = 'Disciplined_Monk';
const VICTIM = 'EvasiveFighter';

const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

// Live-bucket echo (skipSync replace + notify): display-only, never POSTs.
function echoBucket(values) {
  act(() => {
    setRuntimeObject(VICTIM, values, CAMPAIGN, true);
  });
}

// Whole-store combatSummary write as the sheet tab adopts it: the module
// cache (getCombatSummary — the merge's data source) refreshes first, then
// the 'combatSummary' store replace + notify wakes the subscription.
// Memory-only: this is the SSE-adoption lane, it must never POST.
function externalCsWrite(board) {
  combatData.getCombatSummary.mockReturnValue(board);
  act(() => {
    setRuntimeObject('combatSummary', { creatures: board.creatures }, CAMPAIGN, true);
  });
}

// The pre-echo half of a write race ONLY: the board the commit-time re-read
// sees has changed, but the store echo that would retire the button has not
// landed yet — this is how a genuinely stale button is held across a click.
function csBoardChangeWithoutEcho(board) {
  combatData.getCombatSummary.mockReturnValue(board);
}

const victimWrites = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith(`/${encodeURIComponent(VICTIM)}`));

function makeProps(overrides = {}) {
  return {
    healName: 'Hand of Healing',
    formula: '1d12 + 7',
    rolls: [10],
    bonus: 7,
    actualHeal: 17,
    monkName: MONK,
    targetName: VICTIM,
    targetCurrentHp: 96,
    targetMaxHp: 112,
    hasPhysiciansTouch: true,
    campaignName: CAMPAIGN,
    onClose: vi.fn(),
    ...overrides,
  };
}

function renderModal(overrides = {}) {
  return render(<HandOfHealingModal {...makeProps(overrides)} />);
}

const removeBtn = (name) => screen.getByRole('button', { name: new RegExp(`Remove ${name}`) });
const hasRemoveBtn = (name) => !!screen.queryByRole('button', { name: new RegExp(`Remove ${name}$`) });

const csBoard = (conditionKeys) => ({
  creatures: [
    { name: MONK },
    { name: VICTIM, conditions: conditionKeys.map(key => ({ key })) },
  ],
});

// ── Tests ──

describe('HandOfHealingModal - Physician\'s Touch combatSummary-row echo (+ latch/guard on the cs lane)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
    logService.addEntry.mockClear();
    clearRuntimeState(VICTIM);
    clearRuntimeState('combatSummary');
    combatData.getCombatSummary.mockReturnValue({ creatures: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearRuntimeState(VICTIM);
    clearRuntimeState('combatSummary');
  });

  describe('cs-row display echo (mid-dwell adoption, no reopen)', () => {
    it('cs-row CURE retires the cs-sourced button within one echo, bucket-sourced option untouched', async () => {
      // Blinded lives in the bucket; Stunned + Poisoned only on the cs row —
      // the exact merge face the KB rode. ≥2 curables at all times (the
      // shrink-to-one leg is pinned separately below, post 2026-11-14
      // mount-only-auto-cure decision).
      echoBucket({ currentHitPoints: 96, activeConditions: ['blinded'] });
      externalCsWrite(csBoard(['stunned', 'poisoned']));
      renderModal();

      expect(hasRemoveBtn('Blinded')).toBe(true);
      expect(hasRemoveBtn('Stunned')).toBe(true);
      expect(hasRemoveBtn('Poisoned')).toBe(true);

      // External whole-store POST clears Stunned from the cs row mid-dwell.
      externalCsWrite(csBoard(['poisoned']));

      await waitFor(() => {
        expect(hasRemoveBtn('Stunned')).toBe(false);
      });
      expect(hasRemoveBtn('Blinded')).toBe(true);
      expect(hasRemoveBtn('Poisoned')).toBe(true);
      // Display-only: the echo itself must write nothing and log nothing.
      expect(victimWrites()).toHaveLength(0);
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('cs-row ADD of a curable condition surfaces a new Remove button within one echo', async () => {
      echoBucket({ currentHitPoints: 96, activeConditions: ['blinded'] });
      externalCsWrite(csBoard(['stunned']));
      renderModal();

      expect(hasRemoveBtn('Blinded')).toBe(true);
      expect(hasRemoveBtn('Stunned')).toBe(true);
      expect(hasRemoveBtn('Paralyzed')).toBe(false);

      externalCsWrite(csBoard(['stunned', 'paralyzed']));

      await waitFor(() => {
        expect(hasRemoveBtn('Paralyzed')).toBe(true);
      });
      expect(hasRemoveBtn('Blinded')).toBe(true);
      expect(hasRemoveBtn('Stunned')).toBe(true);
      expect(victimWrites()).toHaveLength(0);
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('cs-row conditions cleared entirely retires every cs-sourced button, leaving bucket options', async () => {
      // The KB-ridden face: bucket conditions + cs row `conditions:[stunned]`
      // merged into buttons, then the whole-store POST clears the cs row —
      // `Remove Stunned` now disappears WITHOUT needing a press to reveal
      // staleness.
      echoBucket({ currentHitPoints: 96, activeConditions: ['blinded', 'poisoned'] });
      externalCsWrite(csBoard(['stunned']));
      renderModal();

      expect(hasRemoveBtn('Blinded')).toBe(true);
      expect(hasRemoveBtn('Poisoned')).toBe(true);
      expect(hasRemoveBtn('Stunned')).toBe(true);

      externalCsWrite({ creatures: [{ name: MONK }, { name: VICTIM, conditions: [] }] });

      await waitFor(() => {
        expect(hasRemoveBtn('Stunned')).toBe(false);
      });
      expect(hasRemoveBtn('Blinded')).toBe(true);
      expect(hasRemoveBtn('Poisoned')).toBe(true);
      expect(victimWrites()).toHaveLength(0);
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    // CS-ROW twin of the flipped bucket-lane pin in
    // HandOfHealingModal.live-conditions-echo.test.jsx (owner decision
    // 2026-11-14: auto-cure is the MOUNT law only). This file previously
    // steered its pins around the shrink-to-one leg as "a separate backlog
    // item" — that item is now decided: the echo shows the picker instead of
    // spending the free touch.
    it('cs-row shrink to exactly one curable mid-dwell does NOT auto-cure: single button remains, press cures honestly', async () => {
      // Two curables at mount: Blinded in the bucket, Stunned only on the cs row.
      echoBucket({ currentHitPoints: 96, activeConditions: ['blinded'] });
      externalCsWrite(csBoard(['stunned']));
      renderModal();

      expect(hasRemoveBtn('Blinded')).toBe(true);
      expect(hasRemoveBtn('Stunned')).toBe(true);

      // Foreign cs write clears the cs row — the merge shrinks to exactly one.
      externalCsWrite({ creatures: [{ name: MONK }, { name: VICTIM, conditions: [] }] });

      await waitFor(() => {
        expect(hasRemoveBtn('Stunned')).toBe(false);
      });
      // The survivor stays a choice: one button, no auto-cure, no spend.
      expect(hasRemoveBtn('Blinded')).toBe(true);
      expect(screen.queryByText(/Condition Cleared/)).not.toBeInTheDocument();
      expect(getRuntimeValue(VICTIM, 'activeConditions')).toEqual(['blinded']);
      expect(victimWrites()).toHaveLength(0);
      expect(logService.addEntry).not.toHaveBeenCalled();

      // The surfaced button is still pressable and cures honestly.
      fireEvent.click(removeBtn('Blinded'));
      await waitFor(() => {
        expect(screen.getByText(/Blinded removed from EvasiveFighter \(Physician/)).toBeInTheDocument();
      });
      expect(victimWrites()).toHaveLength(1);
      expect(getRuntimeValue(VICTIM, 'activeConditions')).toEqual([]);
      expect(logService.addEntry).toHaveBeenCalledTimes(1);
      expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        type: 'condition',
        characterName: VICTIM,
        condition: 'Blinded',
        action: 'broken',
        sourceName: `${MONK} (Hand of Healing)`,
      }));
    });
  });

  describe('one-touch latch + commit guard on the cs lane', () => {
    it('clicked cure on a cs-sourced option latches: later cs echo brings no second cure, panel stays', async () => {
      echoBucket({ currentHitPoints: 96, activeConditions: ['blinded'] });
      externalCsWrite(csBoard(['stunned', 'poisoned']));
      renderModal();

      fireEvent.click(removeBtn('Stunned'));

      await waitFor(() => {
        expect(screen.getByText(/Stunned removed from EvasiveFighter \(Physician/)).toBeInTheDocument();
      });
      // Merged minus the cured condition lands in the bucket: one honest write.
      expect(victimWrites()).toHaveLength(1);
      expect(getRuntimeValue(VICTIM, 'activeConditions')).toEqual(['blinded', 'poisoned']);
      expect(logService.addEntry).toHaveBeenCalledTimes(1);
      expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        type: 'condition',
        characterName: VICTIM,
        condition: 'Stunned',
        action: 'broken',
        sourceName: `${MONK} (Hand of Healing)`,
      }));

      // cs echo afterwards (the row still listed Stunned pre-cure): the
      // spent-touch latch holds — panel stays, no second cure, no new row,
      // no extra write.
      externalCsWrite(csBoard(['deafened']));

      await waitFor(() => {
        expect(getRuntimeValue(VICTIM, 'activeConditions')).toEqual(['blinded', 'poisoned']);
      });
      expect(screen.getByText(/Stunned removed/)).toBeInTheDocument();
      expect(logService.addEntry).toHaveBeenCalledTimes(1);
      expect(victimWrites()).toHaveLength(1);
    });

    it('guard face survives the subscription: pre-echo stale press still refuses, zero write, zero row', async () => {
      // cs-sourced options with an empty bucket — the board mutates under the
      // commit-time re-read but the store echo never lands, so the rendered
      // buttons stay stale through the click (the race window the guard owns).
      echoBucket({ currentHitPoints: 96, activeConditions: [] });
      externalCsWrite(csBoard(['blinded', 'stunned']));
      renderModal();

      expect(hasRemoveBtn('Blinded')).toBe(true);
      expect(hasRemoveBtn('Stunned')).toBe(true);

      csBoardChangeWithoutEcho({ creatures: [{ name: MONK }, { name: VICTIM, conditions: [] }] });
      fireEvent.click(removeBtn('Stunned'));

      // Honest refusal in the `<Target> is not affected by <Label>.` family…
      const note = screen.getByText('EvasiveFighter is not affected by Stunned.');
      expect(note).toHaveClass('healing-restriction-note');
      // …zero state delta, zero bucket write, zero audit row.
      expect(getRuntimeValue(VICTIM, 'activeConditions')).toEqual([]);
      expect(victimWrites()).toHaveLength(0);
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(screen.queryByText(/Condition Cleared/)).not.toBeInTheDocument();
      // The refusal re-render filters the surviving stale option too.
      expect(hasRemoveBtn('Blinded')).toBe(false);
    });
  });
});
