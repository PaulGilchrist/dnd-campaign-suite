// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharConditions from './CharConditions.jsx';

let runtimeValues = {};
const mockSetPopupHtml = vi.fn();

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_name, key) => runtimeValues[key] ?? null),
  setRuntimeValue: vi.fn((_name, _key, _value, _campaignName) => {}),
  addStorageChangeListener: vi.fn(() => () => {}),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilityLabel: vi.fn((abbr) => abbr || 'None'),
  getAbilitySaveBonus: vi.fn(() => 2),
}));

vi.mock('../../../services/combat/conditions/exhaustionRules.js', () => ({
  EXHAUSTION_LEVELS: 6,
  isDeadFromExhaustion: vi.fn((level) => level >= 6),
  getExhaustionSaveDC: vi.fn((level) => 10 + level),
}));

vi.mock('../../../hooks/combat/usePopup.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: mockSetPopupHtml,
  })),
}));

vi.mock('../../common/Popup.jsx', () => ({
  default: vi.fn(({ children }) => <div data-testid="popup">{children}</div>),
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

describe('CharConditions logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeValues = {};
    rollD20.mockReturnValue(15);
    mockSetPopupHtml.mockClear();
  });

  const mockPlayerStats = {
    name: 'Test Character',
    abilities: [
      { name: 'Constitution', bonus: 2, save: 3 },
      { name: 'Wisdom', bonus: 1, save: 2 },
    ],
  };

  const defaultProps = {
    playerStats: mockPlayerStats,
    campaignName: 'test-campaign',
    activeMapName: 'test-map',
    characters: [],
    exhaustionLevel: 0,
    onConditionsChange: vi.fn(),
    conditionEffects: {},
  };

  describe('condition save logging', () => {
    it('logs roll entry and condition save on successful save, then removes condition', async () => {
      runtimeValues['activeConditions'] = ['charmed'];
      runtimeValues['activeConditionMeta'] = { charmed: { dc: 14, ability: 'wis' } };
      render(<CharConditions {...defaultProps} />);

      const charmedBtn = screen.getByText('Charmed DC 14');
      await fireEvent.click(charmedBtn);

      expect(addEntry).toHaveBeenCalledWith(
        'test-campaign',
        expect.objectContaining({
          type: 'roll',
          characterName: 'Test Character',
          rollType: 'save',
          dc: 14,
          success: true,
          condition: 'Charmed',
        })
      );

      expect(logConditionSave).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignName: 'test-campaign',
          creatureName: 'Test Character',
          roll: 15,
          bonus: 2,
          bonusDetail: undefined,
          conditionLabel: 'Charmed',
          abilityLabel: 'wis',
          dc: 14,
          success: true,
        })
      );

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Test Character',
          'activeConditions',
          [],
          'test-campaign'
        );
      });

      expect(defaultProps.onConditionsChange).toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.queryByText('Charmed DC 14')).not.toBeInTheDocument();
      });
    });

    it('logs save bonus including aura bonus with bonusDetail', async () => {
      vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 3, sourceName: 'Paladin' });

      runtimeValues['activeConditions'] = ['charmed'];
      runtimeValues['activeConditionMeta'] = { charmed: { dc: 14, ability: 'wis' } };
      render(<CharConditions {...defaultProps} />);

      const charmedBtn = screen.getByText('Charmed DC 14');
      await fireEvent.click(charmedBtn);

      expect(addEntry).toHaveBeenCalledWith(
        'test-campaign',
        expect.objectContaining({
          bonus: 5,
          bonusDetail: '(+3 aura from Paladin)',
        })
      );

      expect(logConditionSave).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignName: 'test-campaign',
          creatureName: 'Test Character',
          roll: 15,
          bonus: 5,
          bonusDetail: '(+3 aura from Paladin)',
          conditionLabel: 'Charmed',
          abilityLabel: 'wis',
          dc: 14,
          success: true,
        })
      );
    });

    // CLA-209 regression: a Powerful Build grapple-escape roll must log BOTH dice
    // with mode 'advantage' — on the primary roll entry AND the condition-save entry.
    it('logs both dice with mode advantage for Powerful Build grapple escape (CLA-209)', async () => {
      rollD20.mockReturnValueOnce(8).mockReturnValueOnce(14);
      const ps = {
        ...mockPlayerStats,
        saveModifiers: [{ source: 'Powerful Build', target: 'ability_check', condition: 'powerful_build_grapple_escape', effect: 'advantage', abilities: ['STR'] }],
      };
      runtimeValues['activeConditions'] = ['grappled'];
      runtimeValues['activeConditionMeta'] = { grappled: { dc: 13, ability: 'str' } };
      render(<CharConditions {...defaultProps} playerStats={ps} />);

      const grappledBtn = screen.getByText('Grappled DC 13');
      await fireEvent.click(grappledBtn);

      await waitFor(() => {
        expect(rollD20).toHaveBeenCalledTimes(2);
      });

      expect(addEntry).toHaveBeenCalledWith(
        'test-campaign',
        expect.objectContaining({
          rollType: 'save',
          rolls: [8, 14],
          mode: 'advantage',
          dc: 13,
          condition: 'Grappled',
        })
      );

      expect(logConditionSave).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignName: 'test-campaign',
          creatureName: 'Test Character',
          roll: [8, 14],
          bonus: expect.any(Number),
          bonusDetail: expect.anything(),
          conditionLabel: 'Grappled',
          abilityLabel: 'str',
          dc: 13,
          success: true,
        })
      );
    });
  });

  describe('popup display', () => {
    it('sets popupHtml with roll data after clicking a savable condition', async () => {
      runtimeValues['activeConditions'] = ['charmed'];
      runtimeValues['activeConditionMeta'] = { charmed: { dc: 18, ability: 'wis' } };
      render(<CharConditions {...defaultProps} />);

      const charmedBtn = screen.getByText('Charmed DC 18');
      await fireEvent.click(charmedBtn);

      expect(mockSetPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          rollType: 'condition-save',
          dc: 18,
          success: true,
        })
      );
    });

    it('sets popupHtml with correct DC for exhaustion minus save', async () => {
      render(<CharConditions {...defaultProps} exhaustionLevel={3} />);
      const minusBtn = screen.getByRole('button', { name: '\u2212' });
      await fireEvent.click(minusBtn);

      expect(mockSetPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          dc: 13,
        })
      );
    });
  });

  describe('failed save behavior', () => {
    it('does not call onConditionsChange or remove condition when save fails', async () => {
      rollD20.mockReturnValue(1);
      runtimeValues['activeConditions'] = ['charmed'];
      runtimeValues['activeConditionMeta'] = { charmed: { dc: 14, ability: 'wis' } };
      render(<CharConditions {...defaultProps} />);

      const charmedBtn = screen.getByText('Charmed DC 14');
      await fireEvent.click(charmedBtn);

      expect(defaultProps.onConditionsChange).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Character',
        'activeConditions',
        [],
        'test-campaign'
      );
    });
  });

  describe('no conditions or exhaustion', () => {
    it('renders nothing when there are no conditions and no exhaustion', () => {
      const { container } = render(<CharConditions {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });
  });
});
