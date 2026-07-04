// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharConditions, { loadActiveConditions } from './CharConditions.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  addStorageChangeListener: vi.fn(),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 15),
}));

vi.mock('../../../services/combat/conditions/conditionUtils.js', () => ({
  CONDITIONS: [
    { key: 'blinded', label: 'Blinded' },
    { key: 'charmed', label: 'Charmed' },
    { key: 'incapacitated', label: 'Incapacitated' },
    { key: 'stunned', label: 'Stunned' },
  ],
  CONDITION_SAVE_DC: 10,
  CONDITION_SAVE_MAP: {
    blinded: null,
    charmed: 'wis',
    incapacitated: null,
    stunned: 'con',
  },
  getAbilityLabel: vi.fn((abbr) => abbr || 'None'),
  getAbilitySaveBonus: vi.fn(() => 2),
}));

vi.mock('../../../services/combat/conditions/exhaustionRules.js', () => ({
  EXHAUSTION_LEVELS: 6,
  isDeadFromExhaustion: vi.fn((level) => level >= 6),
  getExhaustionSaveDC: vi.fn((level) => 10 + level),
}));

const mockSetPopupHtml = vi.fn();
const mockShowPopup = vi.fn();

vi.mock('../../../hooks/combat/usePopup.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: mockSetPopupHtml,
    showPopup: mockShowPopup,
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

vi.mock('../../../services/combat/auras/unbreakableMajesty.js', () => ({
  clearUnbreakableMajesty: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { rollD20 } from '../../../services/dice/diceRoller.js';
import { clearUnbreakableMajesty } from '../../../services/combat/auras/unbreakableMajesty.js';
import { computeAuraBonus } from '../../../services/combat/auras/auraOfProtection.js';

describe('CharConditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
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

  describe('exhaustion badge', () => {
    it('renders exhaustion label with current level', () => {
      render(<CharConditions {...defaultProps} />);
      expect(screen.getByText('Exhaustion (0)')).toBeInTheDocument();
    });

    it('renders exhaustion label with non-zero level', () => {
      render(<CharConditions {...defaultProps} exhaustionLevel={3} />);
      expect(screen.getByText('Exhaustion (3)')).toBeInTheDocument();
    });

    it('disables the minus button when exhaustion is at 0', () => {
      render(<CharConditions {...defaultProps} />);
      const minusBtn = screen.getByRole('button', { name: '−' });
      expect(minusBtn).toBeDisabled();
    });

    it('enables the minus button when exhaustion is above 0', () => {
      render(<CharConditions {...defaultProps} exhaustionLevel={2} />);
      const minusBtn = screen.getByRole('button', { name: '−' });
      expect(minusBtn).toBeEnabled();
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

    it('decreases exhaustion level on minus button click', () => {
      render(<CharConditions {...defaultProps} exhaustionLevel={3} />);
      const minusBtn = screen.getByRole('button', { name: '−' });
      fireEvent.click(minusBtn);
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'exhaustionLevel', 2, 'test-campaign');
    });

    it('does not decrease exhaustion below 0 when con save fails', () => {
      rollD20.mockReturnValueOnce(1);
      render(<CharConditions {...defaultProps} exhaustionLevel={1} />);
      const minusBtn = screen.getByRole('button', { name: '−' });
      fireEvent.click(minusBtn);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Character',
        'exhaustionLevel',
        expect.any(Number),
        'test-campaign'
      );
    });

    it('decreases exhaustion when con save succeeds', () => {
      // rollD20 returns 15, con save bonus is 2, total 17 >= dc 13
      render(<CharConditions {...defaultProps} exhaustionLevel={3} />);
      const minusBtn = screen.getByRole('button', { name: '−' });
      fireEvent.click(minusBtn);
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'exhaustionLevel', 2, 'test-campaign');
    });
  });

  describe('condition badges', () => {
    it('renders all condition badges from CONDITIONS list', () => {
      render(<CharConditions {...defaultProps} />);
      expect(screen.getByText('Blinded')).toBeInTheDocument();
      expect(screen.getByText('Charmed')).toBeInTheDocument();
      expect(screen.getByText('Incapacitated')).toBeInTheDocument();
      expect(screen.getByText('Stunned')).toBeInTheDocument();
    });

    it('marks a condition badge as active when present in stored conditions', () => {
      getRuntimeValue.mockReturnValue(['blinded']);
      render(<CharConditions {...defaultProps} />);
      const blindedBtn = screen.getByText('Blinded');
      expect(blindedBtn).toHaveClass('condition-badge--active');
    });

    it('activates a condition badge on click when inactive', () => {
      getRuntimeValue.mockReturnValue([]);
      render(<CharConditions {...defaultProps} />);
      const charmedBtn = screen.getByText('Charmed');
      fireEvent.click(charmedBtn);
      expect(charmedBtn).toHaveClass('condition-badge--active');
    });

    it('deactivates a condition badge on click when active', () => {
      getRuntimeValue.mockReturnValue(['blinded']);
      render(<CharConditions {...defaultProps} />);
      const blindedBtn = screen.getByText('Blinded');
      fireEvent.click(blindedBtn);
      expect(blindedBtn).not.toHaveClass('condition-badge--active');
    });

    it('calls onConditionsChange when activating a condition', () => {
      getRuntimeValue.mockReturnValue([]);
      render(<CharConditions {...defaultProps} />);
      const charmedBtn = screen.getByText('Charmed');
      fireEvent.click(charmedBtn);
      expect(defaultProps.onConditionsChange).toHaveBeenCalled();
    });

    it('calls onConditionsChange when deactivating a condition', () => {
      getRuntimeValue.mockReturnValue(['blinded']);
      render(<CharConditions {...defaultProps} />);
      const blindedBtn = screen.getByText('Blinded');
      fireEvent.click(blindedBtn);
      expect(defaultProps.onConditionsChange).toHaveBeenCalled();
    });

    it('does not call onConditionsChange when condition save fails', () => {
      rollD20.mockReturnValueOnce(1);
      getRuntimeValue.mockReturnValue(['charmed']);
      render(<CharConditions {...defaultProps} />);
      const charmedBtn = screen.getByText('Charmed');
      fireEvent.click(charmedBtn);
      expect(defaultProps.onConditionsChange).not.toHaveBeenCalled();
    });

    it('calls clearUnbreakableMajesty when incapacitated is toggled', () => {
      getRuntimeValue.mockReturnValue(['incapacitated']);
      render(<CharConditions {...defaultProps} />);
      const incapacitatedBtn = screen.getByText('Incapacitated');
      fireEvent.click(incapacitatedBtn);
      expect(clearUnbreakableMajesty).toHaveBeenCalledWith(
        'Test Character',
        'test-campaign'
      );
    });

    it('does not call clearUnbreakableMajesty for other conditions', () => {
      getRuntimeValue.mockReturnValue(['blinded']);
      render(<CharConditions {...defaultProps} />);
      const blindedBtn = screen.getByText('Blinded');
      fireEvent.click(blindedBtn);
      expect(clearUnbreakableMajesty).not.toHaveBeenCalled();
    });

    it('performs a save check when toggling a condition that has a save ability', async () => {
      getRuntimeValue.mockReturnValue(['charmed']);
      render(<CharConditions {...defaultProps} />);
      const charmedBtn = screen.getByText('Charmed');
      fireEvent.click(charmedBtn);
      await waitFor(() => {
        expect(rollD20).toHaveBeenCalled();
      });
    });

    it('removes condition from active list on successful save', async () => {
      getRuntimeValue.mockReturnValue(['charmed']);
      render(<CharConditions {...defaultProps} />);
      const charmedBtn = screen.getByText('Charmed');
      fireEvent.click(charmedBtn);
      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'activeConditions', [], 'test-campaign');
      });
    });

    it('keeps condition in active list on failed save', async () => {
      rollD20.mockReturnValueOnce(1);
      getRuntimeValue.mockReturnValue(['charmed']);
      render(<CharConditions {...defaultProps} />);
      const charmedBtn = screen.getByText('Charmed');
      fireEvent.click(charmedBtn);
      await waitFor(() => {
        // rollD20 returns 1, bonus is 2, total 3 < DC 10, condition stays
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Test Character',
          'activeConditions',
          ['charmed'],
          'test-campaign'
        );
      });
    });

    it('applies aura bonus to save roll total', async () => {
      computeAuraBonus.mockResolvedValueOnce({
        bonus: 3,
        sourceName: 'Paladin',
      });
      getRuntimeValue.mockReturnValue(['charmed']);
      render(<CharConditions {...defaultProps} />);
      const charmedBtn = screen.getByText('Charmed');
      fireEvent.click(charmedBtn);
      await waitFor(() => {
        // rollD20=15, bonus=2, aura=3, total=20 >= DC 10, condition removed
        expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'activeConditions', [], 'test-campaign');
      });
    });

    it('applies save advantage and rolls two d20s', async () => {
      getRuntimeValue.mockReturnValue(['charmed']);
      render(<CharConditions {...defaultProps} conditionEffects={{ saveAdvantage: ['charmed'] }} />);
      const charmedBtn = screen.getByText('Charmed');
      fireEvent.click(charmedBtn);
      await waitFor(() => {
        expect(rollD20).toHaveBeenCalledTimes(2);
        expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'activeConditions', [], 'test-campaign');
      });
    });
  });

  describe('state persistence', () => {
    it('loads conditions from runtime storage on mount', () => {
      getRuntimeValue.mockReturnValue(['blinded', 'stunned']);
      render(<CharConditions {...defaultProps} />);
      expect(screen.getByText('Blinded')).toHaveClass('condition-badge--active');
      expect(screen.getByText('Stunned')).toHaveClass('condition-badge--active');
    });

    it('saves conditions to runtime storage on change', () => {
      getRuntimeValue.mockReturnValue([]);
      render(<CharConditions {...defaultProps} />);
      const charmedBtn = screen.getByText('Charmed');
      fireEvent.click(charmedBtn);
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'activeConditions', ['charmed'], 'test-campaign');
    });

    it('resets conditions when playerStats.name changes', () => {
      getRuntimeValue.mockReturnValue(['blinded']);
      const { rerender } = render(<CharConditions {...defaultProps} />);
      expect(screen.getByText('Blinded')).toHaveClass('condition-badge--active');

      getRuntimeValue.mockReturnValue([]);
      rerender(<CharConditions {...defaultProps} playerStats={{ ...mockPlayerStats, name: 'Other Character' }} />);
      expect(screen.getByText('Blinded')).not.toHaveClass('condition-badge--active');
    });

    it('resets conditions when campaignName changes', () => {
      getRuntimeValue.mockReturnValue(['blinded']);
      const { rerender } = render(<CharConditions {...defaultProps} />);
      expect(screen.getByText('Blinded')).toHaveClass('condition-badge--active');

      getRuntimeValue.mockReturnValue([]);
      rerender(<CharConditions {...defaultProps} campaignName='other-campaign' />);
      expect(screen.getByText('Blinded')).not.toHaveClass('condition-badge--active');
    });
  });

  describe('loadActiveConditions', () => {
    it('returns stored conditions array', () => {
      getRuntimeValue.mockReturnValue(['blinded', 'grappled']);
      const result = loadActiveConditions('Test Character', 'test-campaign');
      expect(result).toEqual(['blinded', 'grappled']);
    });

    it('returns empty array when stored value is null or not an array', () => {
      for (const badValue of [null, undefined, 'not-an-array', { key: 'blinded' }, 42, []]) {
        getRuntimeValue.mockReturnValue(badValue);
        const result = loadActiveConditions('Test Character', 'test-campaign');
        expect(result).toEqual([]);
      }
    });
  });
});
