import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharConditions from './CharConditions.jsx';

let runtimeValues = {};

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_name, key, _campaignName) => {
    if (key === 'activeConditionMeta') {
      return runtimeValues[key] ?? null;
    }
    return runtimeValues[key] ?? null;
  }),
  setRuntimeValue: vi.fn((_name, key, value, _campaignName) => {
    runtimeValues[key] = value;
  }),
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
  default: vi.fn((props) => (
    <div data-testid="dice-roll-result">
      <span data-testid="roll-type">{props.rollType}</span>
      <span data-testid="roll-name">{props.name}</span>
      <span data-testid="roll-value">{props.rolls?.join(', ')}</span>
      <span data-testid="roll-bonus">{props.bonus}</span>
      <span data-testid="roll-total">{props.total}</span>
      <span data-testid="roll-dc">{props.dc}</span>
      <span data-testid="roll-success">{String(props.success)}</span>
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

import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { rollD20 } from '../../../services/dice/diceRoller.js';
import { addEntry } from '../../../services/ui/logService.js';
import { getExhaustionSaveDC } from '../../../services/combat/conditions/exhaustionRules.js';

describe('CharConditions exhaustion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeValues = {};
    mockCombatSummary = null;
    rollD20.mockReturnValue(15);
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

  describe('exhaustion decrement (minus button)', () => {
    it('renders nothing when exhaustion is at 0', () => {
      render(<CharConditions {...defaultProps} exhaustionLevel={0} />);
      expect(screen.queryByText('Exhaustion (0)')).not.toBeInTheDocument();
      expect(rollD20).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('logs a save entry when minus is clicked', async () => {
      render(<CharConditions {...defaultProps} exhaustionLevel={3} />);
      const minusBtn = screen.getByRole('button', { name: '−' });
      fireEvent.click(minusBtn);

      expect(addEntry).toHaveBeenCalledWith(
        'test-campaign',
        expect.objectContaining({
          type: 'roll',
          characterName: 'Test Character',
          rollType: 'save',
          name: 'Constitution Save (Exhaustion)',
          condition: 'Exhaustion',
        })
      );
    });

    it('decreases exhaustion on successful con save', async () => {
      // con save bonus is 2, DC for level 3 is 13, roll 12 + 2 = 14 >= 13 => success
      rollD20.mockReturnValueOnce(12);
      render(<CharConditions {...defaultProps} exhaustionLevel={3} />);
      const minusBtn = screen.getByRole('button', { name: '−' });
      fireEvent.click(minusBtn);

      await vi.waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Test Character',
          'exhaustionLevel',
          2,
          'test-campaign'
        );
      });
    });

    it('does not decrease exhaustion when con save fails', async () => {
      // con save bonus is 2, DC for level 3 is 13, roll 10 + 2 = 12 < 13 => fail
      rollD20.mockReturnValueOnce(10);
      render(<CharConditions {...defaultProps} exhaustionLevel={3} />);
      const minusBtn = screen.getByRole('button', { name: '−' });
      fireEvent.click(minusBtn);

      await vi.waitFor(() => {
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
          'Test Character',
          'exhaustionLevel',
          2,
          'test-campaign'
        );
      });
    });
  });

  describe('exhaustion increment (plus button)', () => {
    it('increments exhaustion level by 1', () => {
      render(<CharConditions {...defaultProps} exhaustionLevel={1} />);
      const plusBtn = screen.getByRole('button', { name: '+' });
      fireEvent.click(plusBtn);
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'exhaustionLevel', 2, 'test-campaign');
    });

    it('does not trigger a save roll when plus is clicked', () => {
      render(<CharConditions {...defaultProps} exhaustionLevel={2} />);
      const plusBtn = screen.getByRole('button', { name: '+' });
      fireEvent.click(plusBtn);

      expect(rollD20).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('caps at EXHAUSTION_LEVELS (6) and disables the plus button', () => {
      render(<CharConditions {...defaultProps} exhaustionLevel={6} />);
      const plusBtn = screen.getByRole('button', { name: '+' });
      expect(plusBtn).toBeDisabled();
      fireEvent.click(plusBtn);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Character',
        'exhaustionLevel',
        expect.any(Number),
        'test-campaign'
      );
    });
  });

  describe('exhaustion save DC calculation', () => {
    it('uses DC formula (10 + exhaustionLevel) for multiple levels', async () => {
      const levels = [
        { level: 1, expectedDc: 11 },
        { level: 3, expectedDc: 13 },
        { level: 5, expectedDc: 15 },
      ];

      for (const { level, expectedDc } of levels) {
        vi.clearAllMocks();
        cleanup();
        render(<CharConditions {...defaultProps} exhaustionLevel={level} />);
        const minusBtn = screen.getByRole('button', { name: '−' });
        fireEvent.click(minusBtn);

        await vi.waitFor(() => {
          expect(mockSetPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({ dc: expectedDc })
          );
        });
      }
    });

    it('passes the correct DC to the log entry', async () => {
      render(<CharConditions {...defaultProps} exhaustionLevel={4} />);
      const minusBtn = screen.getByRole('button', { name: '−' });
      fireEvent.click(minusBtn);

      await vi.waitFor(() => {
        expect(addEntry).toHaveBeenCalledWith(
          'test-campaign',
          expect.objectContaining({
            dc: 14,
          })
        );
      });
    });

    it('computes DC from the exhaustionRules module', () => {
      expect(getExhaustionSaveDC(1)).toBe(11);
      expect(getExhaustionSaveDC(6)).toBe(16);
    });
  });
});
