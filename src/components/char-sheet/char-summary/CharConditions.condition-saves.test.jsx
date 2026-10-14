// @improved-by-ai
/**
 * CharConditions — condition save MECHANICS: which effects grant advantage,
 * how dice + bonuses combine, and how the result popup reports the outcome.
 *
 * Covered by sibling suites (intentionally NOT re-tested here):
 * - CharConditions.logging.test.jsx      — addEntry/logConditionSave payloads, removal on success
 * - CharConditions.rendering.test.jsx    — badge text/tooltips, dedup, re-mount, empty state
 * - CharConditions.exhaustion.test.jsx   — exhaustion +/- buttons and DC formula
 * - CharConditions.slow.test.jsx         — SP-109 mount-wipe guard, Slow ending on repeat save
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharConditions from './CharConditions.jsx';

let runtimeValues = {};
let mockCombatSummary = null;
const mockSetPopupHtml = vi.fn();

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => runtimeValues[`${name}::${key}`] ?? null),
  setRuntimeValue: vi.fn((name, key, value) => {
    runtimeValues[`${name}::${key}`] = value;
  }),
  addStorageChangeListener: vi.fn(() => () => {}),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 15),
}));

vi.mock('../../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilityLabel: vi.fn((abbr) => {
    const labels = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
    return labels[abbr] || abbr || 'None';
  }),
  getAbilitySaveBonus: vi.fn(() => 2),
}));

vi.mock('../../../services/combat/conditions/exhaustionRules.js', () => ({
  EXHAUSTION_LEVELS: 6,
  isDeadFromExhaustion: vi.fn((level) => level >= 6),
  getExhaustionSaveDC: vi.fn((level) => 10 + level),
}));

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
  getCombatSummary: vi.fn(() => mockCombatSummary),
}));

vi.mock('../../../services/automation/handlers/buffs/auraOfPurityHandler.js', () => ({
  isAuraOfPurityActive: vi.fn(() => false),
  getAuraOfPuritySaveAdvantageConditions: vi.fn(() => []),
}));

import { rollD20 } from '../../../services/dice/diceRoller.js';
import { getAbilitySaveBonus } from '../../../services/combat/conditions/conditionUtils.js';
import { computeAuraBonus } from '../../../services/combat/auras/auraOfProtection.js';
import { isAuraOfPurityActive, getAuraOfPuritySaveAdvantageConditions } from '../../../services/automation/handlers/buffs/auraOfPurityHandler.js';

const POWERFUL_BUILD_GRAPPLE_MOD = {
  target: 'ability_check',
  effect: 'advantage',
  abilities: ['STR'],
  condition: 'powerful_build_grapple_escape',
};

describe('CharConditions condition saves', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // mockReset (not just clear) so unconsumed mockReturnValueOnce queues
    // from a failed test can never leak into the next one.
    vi.mocked(rollD20).mockReset().mockReturnValue(15);
    vi.mocked(getAbilitySaveBonus).mockReset().mockReturnValue(2);
    vi.mocked(computeAuraBonus).mockReset().mockResolvedValue({ bonus: 0, sourceName: null });
    vi.mocked(isAuraOfPurityActive).mockReset().mockReturnValue(false);
    vi.mocked(getAuraOfPuritySaveAdvantageConditions).mockReset().mockReturnValue([]);
    runtimeValues = {};
    mockCombatSummary = null;
  });

  const playerStats = {
    name: 'Test Character',
    abilities: [
      { name: 'Constitution', bonus: 2, save: 3 },
      { name: 'Wisdom', bonus: 1, save: 2 },
    ],
  };

  const defaultProps = {
    playerStats,
    campaignName: 'test-campaign',
    activeMapName: 'test-map',
    characters: [],
    exhaustionLevel: 0,
    onConditionsChange: vi.fn(),
    conditionEffects: {},
  };

  function seedCondition(conditionKey, meta) {
    runtimeValues['Test Character::activeConditions'] = [conditionKey];
    runtimeValues['Test Character::activeConditionMeta'] = { [conditionKey]: meta };
  }

  // Queue exact dice values so each roll is distinguishable in assertions.
  function mockRolls(values) {
    const mock = vi.mocked(rollD20);
    values.forEach((value) => mock.mockReturnValueOnce(value));
  }

  function lastPopup() {
    const calls = mockSetPopupHtml.mock.calls;
    return calls[calls.length - 1][0];
  }

  describe('advantage triggers', () => {
    it.each`
      description                                                  | badgeText        | conditionKey | ability  | conditionEffects                                          | auraActive | auraConditions   | saveModifiers              | viaComputedStats
      ${'Aura of Purity covers the condition'}                   | ${'Charmed DC 12'} | ${'charmed'} | ${'wis'} | ${{}}                                                     | ${true}    | ${['charmed']}   | ${null}                    | ${false}
      ${'saveAdvantage list names the condition'}                | ${'Charmed DC 12'} | ${'charmed'} | ${'wis'} | ${{ saveAdvantage: ['charmed'] }}                       | ${false}   | ${[]}            | ${null}                    | ${false}
      ${'saveAdvantageCount is positive'}                        | ${'Charmed DC 12'} | ${'charmed'} | ${'wis'} | ${{ saveAdvantageCount: 2 }}                          | ${false}   | ${[]}            | ${null}                    | ${false}
      ${'saveAdvantageCount beats Restore Balance reduction'}   | ${'Charmed DC 12'} | ${'charmed'} | ${'wis'} | ${{ saveAdvantageCount: 3, restoreBalance: true }}    | ${false}   | ${[]}            | ${null}                    | ${false}
      ${'grappled with strCheckAdvantage'}                       | ${'Grappled DC 12'} | ${'grappled'} | ${'str'} | ${{ strCheckAdvantage: true }}                        | ${false}   | ${[]}            | ${null}                    | ${false}
      ${'grappled with STR in abilityCheckAdvantageAbilities'}  | ${'Grappled DC 12'} | ${'grappled'} | ${'str'} | ${{ abilityCheckAdvantageAbilities: ['STR'] }}        | ${false}   | ${[]}            | ${null}                    | ${false}
      ${'grappled with a Powerful Build save modifier'}          | ${'Grappled DC 12'} | ${'grappled'} | ${'str'} | ${{}}                                                     | ${false}   | ${[]}            | ${[POWERFUL_BUILD_GRAPPLE_MOD]} | ${false}
      ${'Powerful Build modifier nested on computedStats'}       | ${'Grappled DC 12'} | ${'grappled'} | ${'str'} | ${{}}                                                     | ${false}   | ${[]}            | ${[POWERFUL_BUILD_GRAPPLE_MOD]} | ${true}
    `('rolls two distinguishable d20s and keeps the higher when $description', async ({ badgeText, conditionKey, ability, conditionEffects, auraActive, auraConditions, saveModifiers, viaComputedStats }) => {
      vi.mocked(isAuraOfPurityActive).mockReturnValue(auraActive);
      vi.mocked(getAuraOfPuritySaveAdvantageConditions).mockReturnValue(auraConditions);
      const stats = saveModifiers
        ? (viaComputedStats
          ? { ...playerStats, computedStats: { saveModifiers } }
          : { ...playerStats, saveModifiers })
        : playerStats;

      mockRolls([6, 17]);
      seedCondition(conditionKey, { dc: 12, ability });
      render(<CharConditions {...defaultProps} playerStats={stats} conditionEffects={conditionEffects} />);

      fireEvent.click(screen.getByRole('button', { name: badgeText }));

      await waitFor(() => expect(rollD20).toHaveBeenCalledTimes(2));
      // Advantage must be visible in the result too: both dice shown, higher
      // one used in the total (min, roll1, or roll2 would give a different total).
      expect(lastPopup()).toEqual(expect.objectContaining({
        rolls: [6, 17],
        total: 19, // max(6, 17) + saveBonus(2) + auraBonus(0)
        forcedMode: 'advantage',
      }));
    });

    it.each`
      description                                                       | badgeText        | conditionKey  | ability  | conditionEffects                                          | auraActive | auraConditions     | saveModifiers
      ${'no advantage sources are active'}                             | ${'Charmed DC 18'} | ${'charmed'}  | ${'wis'} | ${{}}                                                     | ${false}   | ${[]}              | ${null}
      ${'saveAdvantage names a different condition'}                   | ${'Blinded DC 18'} | ${'blinded'}  | ${'con'} | ${{ saveAdvantage: ['charmed'] }}                       | ${false}   | ${[]}              | ${null}
      ${'saveAdvantageCount is zero'}                                  | ${'Charmed DC 18'} | ${'charmed'}  | ${'wis'} | ${{ saveAdvantageCount: 0 }}                          | ${false}   | ${[]}              | ${null}
      ${'Restore Balance cancels the only advantage'}                  | ${'Charmed DC 18'} | ${'charmed'}  | ${'wis'} | ${{ saveAdvantageCount: 1, restoreBalance: true }}    | ${false}   | ${[]}              | ${null}
      ${'Restore Balance cancels against_spell advantage'}             | ${'Charmed DC 18'} | ${'charmed'}  | ${'wis'} | ${{ saveAdvantage: ['against_spell'], restoreBalance: true }} | ${false} | ${[]}          | ${null}
      ${'grappled but only DEX check advantage'}                       | ${'Grappled DC 18'} | ${'grappled'} | ${'str'} | ${{ abilityCheckAdvantageAbilities: ['DEX'] }}        | ${false}   | ${[]}              | ${null}
      ${'Aura of Purity active but does not cover the condition'}    | ${'Charmed DC 18'} | ${'charmed'}  | ${'wis'} | ${{}}                                                     | ${true}    | ${['frightened']}  | ${null}
      ${'strCheckAdvantage scoped to a non-grappled condition'}      | ${'Charmed DC 18'} | ${'charmed'}  | ${'wis'} | ${{ strCheckAdvantage: true }}                        | ${false}   | ${[]}              | ${null}
      ${'Powerful Build scoped to a non-grappled condition'}           | ${'Charmed DC 18'} | ${'charmed'}  | ${'wis'} | ${{}}                                                     | ${false}   | ${[]}              | ${[POWERFUL_BUILD_GRAPPLE_MOD]}
    `('rolls a single d20 when $description', async ({ badgeText, conditionKey, ability, conditionEffects, auraActive, auraConditions, saveModifiers }) => {
      vi.mocked(isAuraOfPurityActive).mockReturnValue(auraActive);
      vi.mocked(getAuraOfPuritySaveAdvantageConditions).mockReturnValue(auraConditions);
      const stats = saveModifiers ? { ...playerStats, saveModifiers } : playerStats;

      seedCondition(conditionKey, { dc: 18, ability });
      render(<CharConditions {...defaultProps} playerStats={stats} conditionEffects={conditionEffects} />);

      fireEvent.click(screen.getByRole('button', { name: badgeText }));

      await waitFor(() => expect(rollD20).toHaveBeenCalledTimes(1));
      // The popup must not claim advantage it did not roll (15 + 2 < DC 18).
      const popup = lastPopup();
      expect(popup).toEqual(expect.objectContaining({
        rolls: [15],
        total: 17,
        dc: 18,
        success: false,
      }));
      expect(popup.forcedMode).toBeUndefined();
    });
  });

  describe('save result calculation', () => {
    it.each`
      description                                        | conditionEffects                            | rolls       | saveBonus | auraBonus | dc | total | success | forcedMode
      ${'normal roll above the DC'}                    | ${{}}                                     | ${[15]}     | ${5}      | ${3}      | ${14} | ${23} | ${true}  | ${undefined}
      ${'normal roll exactly tying the DC'}           | ${{}}                                     | ${[9]}      | ${5}      | ${0}      | ${14} | ${14} | ${true}  | ${undefined}
      ${'normal roll one short of the DC'}            | ${{}}                                     | ${[11]}     | ${2}      | ${0}      | ${14} | ${13} | ${false} | ${undefined}
      ${'advantage keeps the higher roll'}            | ${{ saveAdvantage: ['charmed'] }}         | ${[8, 14]}  | ${3}      | ${0}      | ${14} | ${17} | ${true}  | ${'advantage'}
      ${'advantage stacks with an aura bonus'}        | ${{ saveAdvantage: ['charmed'] }}         | ${[7, 12]}  | ${3}      | ${4}      | ${14} | ${19} | ${true}  | ${'advantage'}
      ${'advantage still fails when both rolls low'}  | ${{ saveAdvantage: ['charmed'] }}         | ${[4, 9]}   | ${2}      | ${0}      | ${14} | ${11} | ${false} | ${'advantage'}
    `('popup reports rolls+saveBonus+auraBonus=$total vs DC $dc when $description', async ({ conditionEffects, rolls, saveBonus, auraBonus, dc, total, success, forcedMode }) => {
      vi.mocked(getAbilitySaveBonus).mockReturnValue(saveBonus);
      vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: auraBonus, sourceName: null });
      mockRolls(rolls);

      seedCondition('charmed', { dc, ability: 'wis' });
      render(<CharConditions {...defaultProps} conditionEffects={conditionEffects} />);

      fireEvent.click(screen.getByRole('button', { name: `Charmed DC ${dc}` }));

      await waitFor(() => expect(mockSetPopupHtml).toHaveBeenCalled());
      expect(rollD20).toHaveBeenCalledTimes(rolls.length);
      expect(lastPopup()).toEqual(expect.objectContaining({
        rollType: 'condition-save',
        name: `Wisdom (DC ${dc})`,
        rolls,
        bonus: saveBonus + auraBonus,
        total,
        dc,
        success,
        forcedMode,
      }));
    });

    it('asks Aura of Protection about this character, campaign, map, and combat', async () => {
      mockCombatSummary = { creatures: [{ name: 'Goblin' }] };
      seedCondition('charmed', { dc: 14, ability: 'wis' });
      render(<CharConditions {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Charmed DC 14' }));

      await waitFor(() => expect(computeAuraBonus).toHaveBeenCalled());
      expect(computeAuraBonus).toHaveBeenCalledWith(expect.objectContaining({
        targetName: 'Test Character',
        campaignName: 'test-campaign',
        activeMapName: 'test-map',
        allCreatures: [{ name: 'Goblin' }],
      }));
    });
  });

  describe('unsavable conditions', () => {
    it.each`
      description                    | meta                    | badgeText
      ${'no meta at all'}          | ${{}}                   | ${'Blinded'}
      ${'a DC but no ability'}     | ${{ dc: 10 }}         | ${'Blinded DC 10'}
      ${'an ability but no DC'}    | ${{ ability: 'con' }} | ${'Blinded'}
    `('renders $badgeText as a static badge that never rolls ($description)', async ({ meta, badgeText }) => {
      seedCondition('blinded', meta);
      render(<CharConditions {...defaultProps} />);

      expect(screen.queryByRole('button', { name: badgeText })).not.toBeInTheDocument();
      fireEvent.click(screen.getByText(badgeText));

      expect(rollD20).not.toHaveBeenCalled();
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
    });
  });

  describe('save scoping', () => {
    it('rolls and clears only the condition that was clicked', async () => {
      runtimeValues['Test Character::activeConditions'] = ['charmed', 'frightened'];
      runtimeValues['Test Character::activeConditionMeta'] = {
        charmed: { dc: 14, ability: 'wis' },
        frightened: { dc: 18, ability: 'wis' },
      };
      render(<CharConditions {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Charmed DC 14' }));

      await waitFor(() => expect(screen.queryByText('Charmed DC 14')).not.toBeInTheDocument());
      expect(screen.getByText('Frightened DC 18')).toBeInTheDocument();
      expect(rollD20).toHaveBeenCalledTimes(1);
      expect(lastPopup()).toEqual(expect.objectContaining({
        name: 'Wisdom (DC 14)',
        dc: 14,
        total: 17, // 15 + 2
        success: true,
      }));
    });
  });
});
