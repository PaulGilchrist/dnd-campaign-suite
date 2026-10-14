// @maintained-by-ai
/**
 * CharConditions — CAMPAIGN LOG payloads (every automation must log).
 *
 * Scope (owned by this suite):
 * - addEntry roll entries and logConditionSave payloads: exact shape, both
 *   channels agreeing, and bonusDetail formatting for Aura of Protection
 *   (including the omitted-detail case for a zero aura, pinned by the
 *   exact-object assertion in the first test)
 * - Persistence of a successful escape (condition cleared in the runtime
 *   store) and preservation of everything on a failed save (save-meta
 *   cleanup is component-local state, observed via badge removal)
 * - The condition-save popup payload produced alongside the log entries
 *
 * Covered by sibling suites (intentionally NOT re-tested here):
 * - CharConditions.condition-saves.test.jsx — advantage triggers (including
 *   Powerful Build dice mechanics: two distinguishable dice, keep the higher),
 *   dice/bonus math, popup totals, unsavable badges, per-condition save scoping
 * - CharConditions.rendering.test.jsx       — badge text/tooltips, dedup,
 *   empty state, re-mount
 * - CharConditions.exhaustion.test.jsx      — exhaustion +/- buttons, the
 *   exhaustion addEntry payload, and exhaustion popup DC wiring
 * - CharConditions.slow.test.jsx            — SP-109 mount-wipe guard, Slow
 *   repeat-save effect stripping and its log entry
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharConditions from './CharConditions.jsx';

const CHAR = 'Test Character';
const CAMPAIGN = 'test-campaign';

// Runtime store fake: setRuntimeValue WRITES through to the same table the
// component reads, so "persisted" assertions observe real end state instead
// of trusting that a setter was called with particular arguments.
let runtimeValues = {};

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_name, key) => runtimeValues[key] ?? null),
  setRuntimeValue: vi.fn((_name, key, value) => {
    runtimeValues[key] = value;
  }),
  addStorageChangeListener: vi.fn(() => () => {}),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/conditionUtils.js', () => ({
  // Realistic label mapping so assertions can catch a wrong label being
  // threaded into the log (an identity mock would echo any garbage).
  getAbilityLabel: vi.fn((abbr) => {
    const labels = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
    return labels[abbr] || abbr || 'None';
  }),
  // Save bonus is always +2 in this suite — the arithmetic comments rely on it.
  getAbilitySaveBonus: vi.fn(() => 2),
}));

vi.mock('../../../services/combat/conditions/exhaustionRules.js', () => ({
  EXHAUSTION_LEVELS: 6,
  isDeadFromExhaustion: vi.fn((level) => level >= 6),
  getExhaustionSaveDC: vi.fn((level) => 10 + level),
}));

const mockSetPopupHtml = vi.fn();

vi.mock('../../../hooks/combat/usePopup.js', () => ({
  default: vi.fn(() => ({ popupHtml: null, setPopupHtml: mockSetPopupHtml })),
}));

vi.mock('../../common/Popup.jsx', () => ({
  default: vi.fn(({ children }) => <div data-testid="popup">{children}</div>),
}));

vi.mock('../DiceRollResult.jsx', () => ({
  default: vi.fn(() => <div data-testid="dice-roll-result" />),
}));

vi.mock('../../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/encounters/combatLoggingService.js', () => ({
  logConditionSave: vi.fn(() => Promise.resolve()),
  logConcentrationSave: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../services/automation/handlers/buffs/auraOfPurityHandler.js', () => ({
  isAuraOfPurityActive: vi.fn(() => false),
  getAuraOfPuritySaveAdvantageConditions: vi.fn(() => []),
}));

import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';
import { logConditionSave } from '../../../services/encounters/combatLoggingService.js';
import { rollD20 } from '../../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../../services/combat/auras/auraOfProtection.js';

const POWERFUL_BUILD_GRAPPLE_MOD = {
  source: 'Powerful Build',
  target: 'ability_check',
  effect: 'advantage',
  condition: 'powerful_build_grapple_escape',
  abilities: ['STR'],
};

describe('CharConditions logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // mockReset (not just clear) so unconsumed mockReturnValueOnce queues
    // from a previous test can never leak into the next one.
    vi.mocked(rollD20).mockReset().mockReturnValue(15);
    vi.mocked(computeAuraBonus).mockReset().mockResolvedValue({ bonus: 0, sourceName: null });
    runtimeValues = {};
  });

  // Per-test fixtures: fresh objects and mocks for every render.
  function playerStatsWith(extra = {}) {
    return {
      name: CHAR,
      abilities: [
        { name: 'Constitution', bonus: 2, save: 3 },
        { name: 'Wisdom', bonus: 1, save: 2 },
      ],
      ...extra,
    };
  }

  function renderWith(props = {}) {
    return render(
      <CharConditions
        playerStats={playerStatsWith()}
        campaignName={CAMPAIGN}
        activeMapName="test-map"
        characters={[]}
        exhaustionLevel={0}
        onConditionsChange={vi.fn()}
        conditionEffects={{}}
        {...props}
      />
    );
  }

  function seedCondition(conditionKey, meta) {
    runtimeValues['activeConditions'] = [conditionKey];
    runtimeValues['activeConditionMeta'] = { [conditionKey]: meta };
  }

  function rollEntries() {
    return addEntry.mock.calls.filter(([, entry]) => entry.type === 'roll');
  }

  function lastPopup() {
    const calls = mockSetPopupHtml.mock.calls;
    return calls[calls.length - 1][0];
  }

  describe('condition-save logging', () => {
    // Full happy-path contract: one roll entry, one condition-save entry,
    // both channels agreeing, popup shown, caller notified, state persisted.
    it('logs a successful Charmed save to both channels and persists the escape', async () => {
      seedCondition('charmed', { dc: 14, ability: 'wis' });
      const onConditionsChange = vi.fn();
      renderWith({ onConditionsChange });

      fireEvent.click(screen.getByRole('button', { name: 'Charmed DC 14' }));

      // Positive evidence that the whole async save flow ran to completion
      // before asserting shapes and absence of extra entries.
      await vi.waitFor(() => expect(addEntry).toHaveBeenCalled());
      await vi.waitFor(() => expect(logConditionSave).toHaveBeenCalled());

      // The component's exact logEntry contract — not objectContaining, so a
      // missing or extra field in the campaign log is caught. This also pins
      // the zero-aura case: bonusDetail is omitted (undefined) when no aura applies.
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
        type: 'roll',
        characterName: CHAR,
        rollType: 'save',
        name: 'Wisdom (Charmed)',
        rolls: [15],
        mode: 'normal',
        total: 17, // 15 + save bonus 2 + aura 0
        bonus: 2,
        bonusDetail: undefined,
        dc: 14,
        success: true,
        condition: 'Charmed',
      });
      expect(logConditionSave).toHaveBeenCalledWith({
        campaignName: CAMPAIGN,
        creatureName: CHAR,
        roll: 15,
        bonus: 2,
        bonusDetail: undefined,
        conditionLabel: 'Charmed',
        abilityLabel: 'Wisdom',
        dc: 14,
        success: true,
      });

      // Exactly one entry per channel — no duplicate logging.
      expect(rollEntries()).toHaveLength(1);
      expect(logConditionSave).toHaveBeenCalledTimes(1);

      // Popup shown alongside the log entries.
      expect(lastPopup()).toEqual(expect.objectContaining({
        rollType: 'condition-save',
        name: 'Wisdom (DC 14)',
        rolls: [15],
        total: 17,
        dc: 14,
        success: true,
      }));

      expect(onConditionsChange).toHaveBeenCalledTimes(1);

      // Escape persisted: the condition list is cleared in the runtime store
      // (save-meta cleanup is local state, verified by the badge removal).
      expect(runtimeValues['activeConditions']).toEqual([]);
      expect(setRuntimeValue).toHaveBeenCalledWith(CHAR, 'activeConditions', [], CAMPAIGN);
      await vi.waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Charmed DC 14' })).not.toBeInTheDocument()
      );
    });

    it('logs success:false and keeps the condition when the save fails', async () => {
      rollD20.mockReturnValue(1); // 1 + 2 < DC 14
      seedCondition('charmed', { dc: 14, ability: 'wis' });
      const onConditionsChange = vi.fn();
      renderWith({ onConditionsChange });

      fireEvent.click(screen.getByRole('button', { name: 'Charmed DC 14' }));

      // Positive evidence the flow completed, THEN assert the negatives.
      await vi.waitFor(() => expect(addEntry).toHaveBeenCalled());
      await vi.waitFor(() => expect(logConditionSave).toHaveBeenCalled());

      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        type: 'roll',
        rollType: 'save',
        rolls: [1],
        total: 3, // 1 + 2
        dc: 14,
        success: false,
        condition: 'Charmed',
      }));
      expect(logConditionSave).toHaveBeenCalledWith(expect.objectContaining({
        campaignName: CAMPAIGN,
        roll: 1, // scalar, not an array — single-die failure shape
        dc: 14,
        success: false,
      }));

      expect(onConditionsChange).not.toHaveBeenCalled();

      // Condition still persisted and clickable — nothing was removed.
      expect(runtimeValues['activeConditions']).toEqual(['charmed']);
      expect(screen.getByRole('button', { name: 'Charmed DC 14' })).toBeInTheDocument();
    });

    // CLA-209 regression: an advantage save must log BOTH dice on BOTH
    // channels — addEntry carries rolls+mode, logConditionSave carries the
    // roll array. Advantage dice mechanics themselves (2 rolls, keep-high)
    // are owned by condition-saves.test.jsx, so no total/roll-count asserts.
    // Dice 8/14 vs DC 13: success:true itself pins keep-high without
    // re-asserting the math (min would give 10 < 13 → failure).
    it('logs both dice with mode advantage for a Powerful Build grapple escape (CLA-209)', async () => {
      vi.mocked(rollD20).mockReturnValueOnce(8).mockReturnValueOnce(14);
      seedCondition('grappled', { dc: 13, ability: 'str' });
      renderWith({
        playerStats: playerStatsWith({ saveModifiers: [POWERFUL_BUILD_GRAPPLE_MOD] }),
      });

      fireEvent.click(screen.getByRole('button', { name: 'Grappled DC 13' }));

      await vi.waitFor(() => expect(addEntry).toHaveBeenCalled());
      await vi.waitFor(() => expect(logConditionSave).toHaveBeenCalled());

      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        rollType: 'save',
        rolls: [8, 14],
        mode: 'advantage',
        dc: 13,
        success: true,
        condition: 'Grappled',
      }));
      expect(logConditionSave).toHaveBeenCalledWith(expect.objectContaining({
        campaignName: CAMPAIGN,
        creatureName: CHAR,
        roll: [8, 14],
        conditionLabel: 'Grappled',
        abilityLabel: 'Strength',
        dc: 13,
        success: true,
      }));
    });
  });

  describe('aura bonusDetail logging', () => {
    // Only the two bonusDetail string formats are unique here; the zero-bonus
    // (detail omitted) case is pinned by the exact addEntry payload in the
    // first test. Totals/success are literals, not recomputed business math.
    it.each`
      description                      | aura                                    | bonus | bonusDetail                | total
      ${'named aura source'}         | ${{ bonus: 3, sourceName: 'Paladin' }} | ${5} | ${'(+3 aura from Paladin)'} | ${20}
      ${'aura with no known source'} | ${{ bonus: 3, sourceName: null }}      | ${5} | ${'(+3 aura)'}              | ${20}
    `('logs bonus $bonus with bonusDetail $bonusDetail when $description', async ({ aura, bonus, bonusDetail, total }) => {
      vi.mocked(computeAuraBonus).mockResolvedValue(aura);
      seedCondition('charmed', { dc: 14, ability: 'wis' });
      renderWith();

      fireEvent.click(screen.getByRole('button', { name: 'Charmed DC 14' }));

      await vi.waitFor(() => expect(addEntry).toHaveBeenCalled());

      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        bonus,
        bonusDetail,
        total,
        success: true, // total 20 >= DC 14
      }));
      expect(logConditionSave).toHaveBeenCalledWith(expect.objectContaining({
        bonus,
        bonusDetail,
        success: true,
      }));
      expect(lastPopup()).toEqual(expect.objectContaining({ bonus, bonusDetail }));
    });
  });
});
