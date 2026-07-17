// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharConditions, { loadActiveConditions } from './CharConditions.jsx';

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
  default: vi.fn(() => <div data-testid="dice-roll-result">DiceRollResult</div>),
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

import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { rollD20 } from '../../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../../services/combat/auras/auraOfProtection.js';

describe('CharConditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeValues = {};
    mockCombatSummary = null;
    rollD20.mockReturnValue(15);
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: vi.fn() }));
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

  describe('empty state', () => {
    it('returns null when nothing is active', () => {
      const { container } = render(<CharConditions {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('exhaustion badge', () => {
    it('renders nothing when exhaustion level is 0', () => {
      const { container } = render(<CharConditions {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders exhaustion badge when level > 0', () => {
      render(<CharConditions {...defaultProps} exhaustionLevel={2} />);
      expect(screen.getByText('Exhaustion (2)')).toBeInTheDocument();
    });

    it('disables the plus button when exhaustion is at maximum (dead)', () => {
      render(<CharConditions {...defaultProps} exhaustionLevel={6} />);
      const plusBtn = screen.getByRole('button', { name: '+' });
      expect(plusBtn).toBeDisabled();
    });

    it('increments exhaustion level on plus button click', () => {
      render(<CharConditions {...defaultProps} exhaustionLevel={2} />);
      const plusBtn = screen.getByRole('button', { name: '+' });
      fireEvent.click(plusBtn);
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'exhaustionLevel', 3, 'test-campaign');
    });

    it('caps exhaustion level at maximum when incrementing', () => {
      render(<CharConditions {...defaultProps} exhaustionLevel={5} />);
      const plusBtn = screen.getByRole('button', { name: '+' });
      fireEvent.click(plusBtn);
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'exhaustionLevel', 6, 'test-campaign');
    });

    it('decreases exhaustion level on minus button click with successful con save', () => {
      render(<CharConditions {...defaultProps} exhaustionLevel={3} />);
      const minusBtn = screen.getByRole('button', { name: '−' });
      fireEvent.click(minusBtn);
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'exhaustionLevel', 2, 'test-campaign');
    });

    it('does not decrease exhaustion when con save fails', () => {
      rollD20.mockReturnValueOnce(1);
      render(<CharConditions {...defaultProps} exhaustionLevel={1} />);
      const minusBtn = screen.getByRole('button', { name: '−' });
      fireEvent.click(minusBtn);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Character',
        expect.any(String),
        expect.any(Number),
        'test-campaign'
      );
    });
  });

  describe('condition badges', () => {
    it('renders nothing when no conditions are active', () => {
      runtimeValues['Test Character::activeConditions'] = [];
      runtimeValues['Test Character::activeConditionMeta'] = {};
      const { container } = render(<CharConditions {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders only active conditions', () => {
      runtimeValues['Test Character::activeConditions'] = ['charmed', 'blinded'];
      runtimeValues['Test Character::activeConditionMeta'] = {
        charmed: { dc: 12, ability: 'wis' },
        blinded: { dc: 10, ability: 'con' },
      };
      render(<CharConditions {...defaultProps} />);
      expect(screen.getByText('Charmed DC 12')).toBeInTheDocument();
      expect(screen.getByText('Blinded DC 10')).toBeInTheDocument();
      expect(screen.queryByText('Stunned')).not.toBeInTheDocument();
      expect(screen.queryByText('Incapacitated')).not.toBeInTheDocument();
    });

    it('shows condition without DC when no meta available', () => {
      runtimeValues['Test Character::activeConditions'] = ['blinded'];
      runtimeValues['Test Character::activeConditionMeta'] = {};
      render(<CharConditions {...defaultProps} />);
      expect(screen.getByText('Blinded')).toBeInTheDocument();
    });

    it('condition with save ability rolls save on click', async () => {
      runtimeValues['Test Character::activeConditions'] = ['charmed'];
      runtimeValues['Test Character::activeConditionMeta'] = { charmed: { dc: 14, ability: 'wis' } };
      render(<CharConditions {...defaultProps} />);
      const charmedBtn = screen.getByText('Charmed DC 14');
      fireEvent.click(charmedBtn);
      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'activeConditions', [], 'test-campaign');
      });
      expect(defaultProps.onConditionsChange).toHaveBeenCalled();
    });

    it('condition without save ability does nothing on click', () => {
      runtimeValues['Test Character::activeConditions'] = ['blinded'];
      runtimeValues['Test Character::activeConditionMeta'] = { blinded: { dc: 10, ability: null } };
      render(<CharConditions {...defaultProps} />);
      const callCountBefore = setRuntimeValue.mock.calls.filter(
        c => c[1] === 'activeConditions'
      ).length;
      const blindedBtn = screen.getByText('Blinded DC 10');
      fireEvent.click(blindedBtn);
      const callCountAfter = setRuntimeValue.mock.calls.filter(
        c => c[1] === 'activeConditions'
      ).length;
      expect(callCountAfter).toBe(callCountBefore);
    });

    it('condition without ability is not savable', () => {
      runtimeValues['Test Character::activeConditions'] = ['blinded'];
      runtimeValues['Test Character::activeConditionMeta'] = { blinded: { dc: 10, ability: null } };
      render(<CharConditions {...defaultProps} />);
      const blindedBtn = screen.getByText('Blinded DC 10');
      expect(blindedBtn).toHaveClass('condition-badge--display-only');
    });

    it('condition with ability is savable', () => {
      runtimeValues['Test Character::activeConditions'] = ['charmed'];
      runtimeValues['Test Character::activeConditionMeta'] = { charmed: { dc: 12, ability: 'wis' } };
      render(<CharConditions {...defaultProps} />);
      const charmedBtn = screen.getByText('Charmed DC 12');
      expect(charmedBtn).toHaveClass('condition-badge--savable');
    });

    it('removes condition from active list on successful save', async () => {
      runtimeValues['Test Character::activeConditions'] = ['charmed'];
      runtimeValues['Test Character::activeConditionMeta'] = { charmed: { dc: 14, ability: 'wis' } };
      render(<CharConditions {...defaultProps} />);
      const charmedBtn = screen.getByText('Charmed DC 14');
      fireEvent.click(charmedBtn);
      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'activeConditions', [], 'test-campaign');
      });
    });

    it('keeps condition in active list on failed save', async () => {
      rollD20.mockReturnValueOnce(1);
      runtimeValues['Test Character::activeConditions'] = ['charmed'];
      runtimeValues['Test Character::activeConditionMeta'] = { charmed: { dc: 14, ability: 'wis' } };
      render(<CharConditions {...defaultProps} />);
      const charmedBtn = screen.getByText('Charmed DC 14');
      fireEvent.click(charmedBtn);
      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Test Character',
          'activeConditions',
          ['charmed'],
          'test-campaign'
        );
      });
      expect(defaultProps.onConditionsChange).not.toHaveBeenCalled();
    });

    it('applies aura bonus to save roll total', async () => {
      computeAuraBonus.mockResolvedValueOnce({
        bonus: 3,
        sourceName: 'Paladin',
      });
      runtimeValues['Test Character::activeConditions'] = ['charmed'];
      runtimeValues['Test Character::activeConditionMeta'] = { charmed: { dc: 14, ability: 'wis' } };
      render(<CharConditions {...defaultProps} />);
      const charmedBtn = screen.getByText('Charmed DC 14');
      fireEvent.click(charmedBtn);
      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'activeConditions', [], 'test-campaign');
      });
    });

    it('applies save advantage and rolls two d20s', async () => {
      runtimeValues['Test Character::activeConditions'] = ['charmed'];
      runtimeValues['Test Character::activeConditionMeta'] = { charmed: { dc: 12, ability: 'wis' } };
      render(<CharConditions {...defaultProps} conditionEffects={{ saveAdvantage: ['charmed'] }} />);
      const charmedBtn = screen.getByText('Charmed DC 12');
      fireEvent.click(charmedBtn);
      await waitFor(() => {
        expect(rollD20).toHaveBeenCalledTimes(2);
        expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'activeConditions', [], 'test-campaign');
      });
    });

    it('uses tracked DC from meta instead of hardcoded value', async () => {
      runtimeValues['Test Character::activeConditions'] = ['charmed'];
      runtimeValues['Test Character::activeConditionMeta'] = { charmed: { dc: 18, ability: 'wis' } };
      render(<CharConditions {...defaultProps} />);
      const charmedBtn = screen.getByText('Charmed DC 18');
      fireEvent.click(charmedBtn);
      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          dc: 18,
        }));
      });
    });

    it('does not remove condition on failed save', async () => {
      rollD20.mockReturnValueOnce(1);
      runtimeValues['Test Character::activeConditions'] = ['charmed'];
      runtimeValues['Test Character::activeConditionMeta'] = { charmed: { dc: 14, ability: 'wis' } };
      render(<CharConditions {...defaultProps} />);
      const charmedBtn = screen.getByText('Charmed DC 14');
      fireEvent.click(charmedBtn);
      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Test Character',
          'activeConditions',
          ['charmed'],
          'test-campaign'
        );
      });
    });
  });

  describe('concentration badge', () => {
    it('renders concentration badge when active', () => {
      runtimeValues['Test Character::activeConditions'] = [];
      runtimeValues['Test Character::activeConditionMeta'] = {};
      mockCombatSummary = {
        creatures: [
          { name: 'Test Character', concentration: { spell: 'Bless', dc: 10 } },
        ],
      };

      render(<CharConditions {...defaultProps} />);
      expect(screen.getByText('Bless DC 10')).toBeInTheDocument();
    });

    it('does not render concentration badge when no concentration', () => {
      runtimeValues['Test Character::activeConditions'] = [];
      runtimeValues['Test Character::activeConditionMeta'] = {};
      mockCombatSummary = {
        creatures: [
          { name: 'Test Character', concentration: null },
        ],
      };

      const { container } = render(<CharConditions {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });

    it('concentration badge is displayed with spinner icon', () => {
      runtimeValues['Test Character::activeConditions'] = [];
      runtimeValues['Test Character::activeConditionMeta'] = {};
      mockCombatSummary = {
        creatures: [
          { name: 'Test Character', concentration: { spell: 'Haste', dc: 13 } },
        ],
      };

      render(<CharConditions {...defaultProps} />);
      const badge = screen.getByText('Haste DC 13');
      expect(badge.closest('.concentration-badge')).toBeInTheDocument();
    });
  });

  describe('combined display', () => {
    it('renders conditions, exhaustion, and concentration together', () => {
      runtimeValues['Test Character::activeConditions'] = ['charmed'];
      runtimeValues['Test Character::activeConditionMeta'] = { charmed: { dc: 12, ability: 'wis' } };
      mockCombatSummary = {
        creatures: [
          { name: 'Test Character', concentration: { spell: 'Bless', dc: 10 } },
        ],
      };

      render(<CharConditions {...defaultProps} exhaustionLevel={2} />);
      expect(screen.getByText('Charmed DC 12')).toBeInTheDocument();
      expect(screen.getByText('Exhaustion (2)')).toBeInTheDocument();
      expect(screen.getByText('Bless DC 10')).toBeInTheDocument();
    });
  });

  describe('state persistence', () => {
    it('loads conditions from runtime storage on mount', () => {
      runtimeValues['Test Character::activeConditions'] = ['blinded', 'stunned'];
      runtimeValues['Test Character::activeConditionMeta'] = {
        blinded: { dc: 10, ability: null },
        stunned: { dc: 10, ability: 'con' },
      };
      render(<CharConditions {...defaultProps} />);
      expect(screen.getByText('Blinded DC 10')).toBeInTheDocument();
      expect(screen.getByText('Stunned DC 10')).toBeInTheDocument();
    });

    it('saves conditions to runtime storage on change', () => {
      runtimeValues['Test Character::activeConditions'] = [];
      runtimeValues['Test Character::activeConditionMeta'] = {};
      render(<CharConditions {...defaultProps} />);
    });
  });

  describe('loadActiveConditions', () => {
    it('returns stored conditions array', () => {
      runtimeValues['Test Character::activeConditions'] = ['blinded', 'grappled'];
      const result = loadActiveConditions('Test Character', 'test-campaign');
      expect(result).toEqual(['blinded', 'grappled']);
    });

    it('returns empty array when stored value is not an array', () => {
      for (const badValue of [null, undefined, 'not-an-array', { key: 'blinded' }, 42]) {
        runtimeValues['Test Character::activeConditions'] = badValue;
        const result = loadActiveConditions('Test Character', 'test-campaign');
        expect(result).toEqual([]);
      }
    });
  });
});
