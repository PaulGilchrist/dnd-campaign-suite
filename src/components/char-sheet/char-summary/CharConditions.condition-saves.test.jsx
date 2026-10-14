import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharConditions from './CharConditions.jsx';

let runtimeValues = {};

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key, _campaignName) => {
    const storageKey = `${name}::${key}`;
    if (key === 'activeConditionMeta') {
      return runtimeValues[storageKey] ?? runtimeValues[key] ?? null;
    }
    return runtimeValues[storageKey] ?? runtimeValues[key] ?? null;
  }),
  setRuntimeValue: vi.fn((name, key, value, _campaignName) => {
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

const mockSetPopupHtml = vi.fn();

vi.mock('../../../hooks/combat/usePopup.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: mockSetPopupHtml,
  })),
}));

vi.mock('../../common/Popup.jsx', () => ({
  default: vi.fn(({ children }) => (
    <div data-testid="popup">{children}</div>
  )),
}));

vi.mock('../DiceRollResult.jsx', () => ({
  default: vi.fn(({ type: _type, rollType, name, rolls, bonus, bonusDetail: _bonusDetail, total, dc, success, forcedMode: _forcedMode }) => (
    <div data-testid="dice-roll-result">
      <span data-testid="roll-type">{rollType}</span>
      <span data-testid="roll-name">{name}</span>
      <span data-testid="roll-value">{rolls?.join(', ')}</span>
      <span data-testid="roll-bonus">{bonus}</span>
      <span data-testid="roll-total">{total}</span>
      <span data-testid="roll-dc">{dc}</span>
      <span data-testid="roll-success">{String(success)}</span>
    </div>
  )),
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

let mockCombatSummary = null;

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => mockCombatSummary),
}));

vi.mock('../../../services/automation/handlers/buffs/auraOfPurityHandler.js', () => ({
  isAuraOfPurityActive: vi.fn(() => false),
  getAuraOfPuritySaveAdvantageConditions: vi.fn(() => []),
}));

import { computeAuraBonus } from '../../../services/combat/auras/auraOfProtection.js';
import { rollD20 } from '../../../services/dice/diceRoller.js';
import { isAuraOfPurityActive, getAuraOfPuritySaveAdvantageConditions } from '../../../services/automation/handlers/buffs/auraOfPurityHandler.js';

describe('CharConditions condition saves', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    runtimeValues = {};
    mockCombatSummary = null;
    rollD20.mockReturnValue(15);
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: vi.fn() }));
    vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 0, sourceName: null });
    vi.mocked(isAuraOfPurityActive).mockReturnValue(false);
    vi.mocked(getAuraOfPuritySaveAdvantageConditions).mockReturnValue([]);
  });

  const mockPlayerStats = {
    name: 'Test Character',
    abilities: [
      { name: 'Constitution', bonus: 2, save: 3 },
      { name: 'Wisdom', bonus: 1, save: 2 },
    ],
  };

  const defaultProps = {
    campaignName: 'test-campaign',
    activeMapName: 'test-map',
    characters: [],
    exhaustionLevel: 0,
    onConditionsChange: vi.fn(),
  };

  describe('advantage triggers', () => {
    it.each`
      description                                      | auraOfPurityActive | auraConditions        | conditionKey | metaAbility | conditionEffects | usePowerfulBuild
      ${'aura of purity matching condition'}           | ${true}            | ${['charmed']}        | ${'charmed'} | ${'wis'}    | ${{}}            | ${false}
      ${'saveAdvantage array matching condition'}      | ${false}           | ${[]}                 | ${'charmed'} | ${'wis'}    | ${{ saveAdvantage: ['charmed'] }} | ${false}
      ${'saveAdvantageCount > 0'}                      | ${false}           | ${[]}                 | ${'charmed'} | ${'wis'}    | ${{ saveAdvantageCount: 2 }} | ${false}
      ${'saveAdvantageCount > restoreBalance reduction'}| ${false}          | ${[]}                 | ${'charmed'} | ${'wis'}    | ${{ saveAdvantageCount: 3, restoreBalance: true }} | ${false}
      ${'grappled with strCheckAdvantage'}             | ${false}           | ${[]}                 | ${'grappled'}| ${'str'}    | ${{ strCheckAdvantage: true }} | ${false}
      ${'grappled with abilityCheckAdvantageAbilities including STR'} | ${false} | ${[]}           | ${'grappled'}| ${'str'}    | ${{ abilityCheckAdvantageAbilities: ['STR'] }} | ${false}
      ${'grappled with Powerful Build saveModifier'}   | ${false}           | ${[]}                 | ${'grappled'}| ${'str'}    | ${{}}            | ${true}
    `('rolls two d20s when $description', async ({ conditionKey, metaAbility, auraOfPurityActive, auraConditions, conditionEffects, usePowerfulBuild }) => {
      vi.mocked(isAuraOfPurityActive).mockReturnValue(auraOfPurityActive);
      vi.mocked(getAuraOfPuritySaveAdvantageConditions).mockReturnValue(auraConditions);

      const ps = usePowerfulBuild
        ? { ...mockPlayerStats, saveModifiers: [{ target: 'ability_check', effect: 'advantage', abilities: ['STR'], condition: 'powerful_build_grapple_escape' }] }
        : mockPlayerStats;

      runtimeValues['Test Character::activeConditions'] = [conditionKey];
      runtimeValues['Test Character::activeConditionMeta'] = { [conditionKey]: { dc: 12, ability: metaAbility } };
      render(<CharConditions {...defaultProps} playerStats={ps} conditionEffects={conditionEffects} />);

      const label = conditionKey.charAt(0).toUpperCase() + conditionKey.slice(1);
      const btn = screen.getByText(`${label} DC 12`);
      fireEvent.click(btn);

      await waitFor(() => {
        expect(rollD20).toHaveBeenCalledTimes(2);
      });
    });

    it.each`
      description                                              | conditionKey | metaAbility | conditionEffects
      ${'no advantage sources active'}                        | ${'charmed'} | ${'wis'}    | ${{}}
      ${'saveAdvantage array non-matching condition'}         | ${'blinded'} | ${'con'}    | ${{ saveAdvantage: ['charmed'] }}
      ${'saveAdvantageCount is 0'}                            | ${'charmed'} | ${'wis'}    | ${{ saveAdvantageCount: 0 }}
      ${'saveAdvantageCount equals restoreBalance reduction'} | ${'charmed'} | ${'wis'}    | ${{ saveAdvantageCount: 1, restoreBalance: true }}
      ${'against_spell with restoreBalance true'}             | ${'charmed'} | ${'wis'}    | ${{ saveAdvantage: ['against_spell'], restoreBalance: true }}
      ${'grappled but no STR advantage'}                      | ${'grappled'}| ${'str'}    | ${{ abilityCheckAdvantageAbilities: ['DEX'] }}
    `('rolls one d20 when $description', async ({ conditionKey, metaAbility, conditionEffects }) => {
      runtimeValues[`Test Character::activeConditions`] = [conditionKey];
      runtimeValues[`Test Character::activeConditionMeta`] = { [conditionKey]: { dc: 12, ability: metaAbility } };
      render(<CharConditions {...defaultProps} playerStats={mockPlayerStats} conditionEffects={conditionEffects} />);

      const label = conditionKey.charAt(0).toUpperCase() + conditionKey.slice(1);
      const btn = screen.getByText(`${label} DC 12`);
      fireEvent.click(btn);

      await waitFor(() => {
        expect(rollD20).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('save result calculation', () => {
    it('calculates total as roll + saveBonus + auraBonus', async () => {
      vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 3, sourceName: null });
      const { getAbilitySaveBonus } = await import('../../../services/combat/conditions/conditionUtils.js');
      getAbilitySaveBonus.mockReturnValue(5);

      runtimeValues['Test Character::activeConditions'] = ['charmed'];
      runtimeValues['Test Character::activeConditionMeta'] = { charmed: { dc: 14, ability: 'wis' } };
      render(<CharConditions {...defaultProps} playerStats={mockPlayerStats} />);

      const charmedBtn = screen.getByText('Charmed DC 14');
      fireEvent.click(charmedBtn);

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.objectContaining({
            total: 23, // roll(15) + saveBonus(5) + auraBonus(3)
          })
        );
      });
    });

    it('marks save as successful when total >= dc', async () => {
      const { getAbilitySaveBonus } = await import('../../../services/combat/conditions/conditionUtils.js');
      getAbilitySaveBonus.mockReturnValue(5);

      runtimeValues['Test Character::activeConditions'] = ['charmed'];
      runtimeValues['Test Character::activeConditionMeta'] = { charmed: { dc: 14, ability: 'wis' } };
      render(<CharConditions {...defaultProps} playerStats={mockPlayerStats} />);

      const charmedBtn = screen.getByText('Charmed DC 14');
      fireEvent.click(charmedBtn);

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            dc: 14,
          })
        );
      });
    });

    it('marks save as failed when total < dc', async () => {
      rollD20.mockReturnValueOnce(1);
      const { getAbilitySaveBonus } = await import('../../../services/combat/conditions/conditionUtils.js');
      getAbilitySaveBonus.mockReturnValue(2);

      runtimeValues['Test Character::activeConditions'] = ['charmed'];
      runtimeValues['Test Character::activeConditionMeta'] = { charmed: { dc: 14, ability: 'wis' } };
      render(<CharConditions {...defaultProps} playerStats={mockPlayerStats} />);

      const charmedBtn = screen.getByText('Charmed DC 14');
      fireEvent.click(charmedBtn);

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            total: 3, // roll(1) + saveBonus(2) + auraBonus(0)
          })
        );
      });
    });

    it('uses max of two rolls for advantage saves', async () => {
      rollD20.mockReturnValueOnce(8).mockReturnValueOnce(14);
      const { getAbilitySaveBonus } = await import('../../../services/combat/conditions/conditionUtils.js');
      getAbilitySaveBonus.mockReturnValue(3);

      runtimeValues['Test Character::activeConditions'] = ['charmed'];
      runtimeValues['Test Character::activeConditionMeta'] = { charmed: { dc: 14, ability: 'wis' } };
      render(<CharConditions {...defaultProps} playerStats={mockPlayerStats} conditionEffects={{ saveAdvantage: ['charmed'] }} />);

      const charmedBtn = screen.getByText('Charmed DC 14');
      fireEvent.click(charmedBtn);

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.objectContaining({
            total: 17, // max(8,14) + saveBonus(3) + auraBonus(0)
            rolls: expect.arrayContaining([8, 14]),
          })
        );
      });
    });

    it('calculates total with both advantage rolls and aura bonus', async () => {
      vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 4, sourceName: 'Paladin' });
      const { getAbilitySaveBonus } = await import('../../../services/combat/conditions/conditionUtils.js');
      getAbilitySaveBonus.mockReturnValue(3);
      rollD20.mockReturnValueOnce(7).mockReturnValueOnce(12);

      runtimeValues['Test Character::activeConditions'] = ['charmed'];
      runtimeValues['Test Character::activeConditionMeta'] = { charmed: { dc: 14, ability: 'wis' } };
      render(<CharConditions {...defaultProps} playerStats={mockPlayerStats} conditionEffects={{ saveAdvantage: ['charmed'] }} />);

      const charmedBtn = screen.getByText('Charmed DC 14');
      fireEvent.click(charmedBtn);

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.objectContaining({
            total: 19, // max(7,12) + saveBonus(3) + auraBonus(4)
            rolls: expect.arrayContaining([7, 12]),
          })
        );
      });
    });
  });

// Consolidated: Removed 3 redundant describe blocks (save bonus/label, aura bonus display,
// condition without meta dc) — all assertions duplicated in CharConditions.logging.test.jsx.
// Retained: advantage trigger tests (most comprehensive parametrization across suite) and
// save result calculation tests (detailed roll math not covered elsewhere).
});
