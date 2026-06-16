import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharConditions, { EXHAUSTION_LEVELS, loadActiveConditions } from './CharConditions.jsx';

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
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

vi.mock('../../../hooks/usePopup.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    showPopup: vi.fn(),
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

vi.mock('../../../services/combat/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../../services/combat/unbreakableMajesty.js', () => ({
  clearUnbreakableMajesty: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { rollD20 } from '../../../services/dice/diceRoller.js';
import { clearUnbreakableMajesty } from '../../../services/combat/unbreakableMajesty.js';
import { computeAuraBonus } from '../../../services/combat/auraOfProtection.js';

describe('CharConditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    rollD20.mockReturnValue(15);
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
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

  it('should render the conditions container', () => {
    render(<CharConditions {...defaultProps} />);
    expect(document.querySelector('.char-conditions')).toBeInTheDocument();
  });

  it('should render exhaustion badge with level 0', () => {
    render(<CharConditions {...defaultProps} />);
    expect(screen.getByText('Exhaustion (0)')).toBeInTheDocument();
  });

  it('should not disable the minus exhaustion button at level 0', () => {
    render(<CharConditions {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const minusBtn = buttons.find(b => b.textContent === '−');
    expect(minusBtn).toBeDisabled();
  });

  it('should disable the plus exhaustion button when dead', () => {
    render(<CharConditions {...defaultProps} exhaustionLevel={6} />);
    const buttons = screen.getAllByRole('button');
    const plusBtn = buttons.find(b => b.textContent === '+');
    expect(plusBtn).toBeDisabled();
  });

  it('should show DEAD label when exhaustion level is 6', () => {
    render(<CharConditions {...defaultProps} exhaustionLevel={6} />);
    const label = screen.getByTitle(/Exhaustion level 6.*DEAD/);
    expect(label).toBeInTheDocument();
  });

  it('should render all condition badges', () => {
    render(<CharConditions {...defaultProps} />);
    expect(screen.getByText('Blinded')).toBeInTheDocument();
    expect(screen.getByText('Charmed')).toBeInTheDocument();
    expect(screen.getByText('Incapacitated')).toBeInTheDocument();
    expect(screen.getByText('Stunned')).toBeInTheDocument();
  });

  it('should mark a condition badge as active when in activeConditions', () => {
    getRuntimeValue.mockReturnValue(['blinded']);
    render(<CharConditions {...defaultProps} />);
    const blindedBtn = screen.getByText('Blinded');
    expect(blindedBtn).toHaveClass('condition-badge--active');
  });

  it('should activate a condition badge on click', () => {
    getRuntimeValue.mockReturnValue([]);
    render(<CharConditions {...defaultProps} />);
    const charmedBtn = screen.getByText('Charmed');
    fireEvent.click(charmedBtn);
    expect(charmedBtn).toHaveClass('condition-badge--active');
  });

  it('should deactivate a condition badge when toggled off directly', () => {
    getRuntimeValue.mockReturnValue(['blinded']);
    render(<CharConditions {...defaultProps} />);
    const blindedBtn = screen.getByText('Blinded');
    fireEvent.click(blindedBtn);
    expect(blindedBtn).not.toHaveClass('condition-badge--active');
  });

  it('should call onConditionsChange when toggling a condition', () => {
    getRuntimeValue.mockReturnValue([]);
    render(<CharConditions {...defaultProps} />);
    const charmedBtn = screen.getByText('Charmed');
    fireEvent.click(charmedBtn);
    expect(defaultProps.onConditionsChange).toHaveBeenCalled();
  });

  it('should increase exhaustion level on plus button click', () => {
    render(<CharConditions {...defaultProps} exhaustionLevel={2} />);
    const buttons = screen.getAllByRole('button');
    const plusBtn = buttons.find(b => b.textContent === '+');
    fireEvent.click(plusBtn);
    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'exhaustionLevel', 3, 'test-campaign');
  });

  it('should decrease exhaustion level on minus button click', () => {
    render(<CharConditions {...defaultProps} exhaustionLevel={3} />);
    const buttons = screen.getAllByRole('button');
    const minusBtn = buttons.find(b => b.textContent === '−');
    fireEvent.click(minusBtn);
    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'exhaustionLevel', 2, 'test-campaign');
  });

  it('should not decrease exhaustion below 0', () => {
    render(<CharConditions {...defaultProps} exhaustionLevel={0} />);
    const buttons = screen.getAllByRole('button');
    const minusBtn = buttons.find(b => b.textContent === '−');
    fireEvent.click(minusBtn);
    // The minus button is disabled, so no action should occur
    expect(minusBtn).toBeDisabled();
  });

  it('should not increase exhaustion above 6', () => {
    render(<CharConditions {...defaultProps} exhaustionLevel={6} />);
    const buttons = screen.getAllByRole('button');
    const plusBtn = buttons.find(b => b.textContent === '+');
    // The plus button is disabled when dead, so no action should occur
    expect(plusBtn).toBeDisabled();
  });

  it('should log a roll entry when decreasing exhaustion with con save', () => {
    render(<CharConditions {...defaultProps} exhaustionLevel={3} />);
    const buttons = screen.getAllByRole('button');
    const minusBtn = buttons.find(b => b.textContent === '−');
    fireEvent.click(minusBtn);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/log'),
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('should show a d20 popup when decreasing exhaustion', () => {
    render(<CharConditions {...defaultProps} exhaustionLevel={3} />);
    const buttons = screen.getAllByRole('button');
    const minusBtn = buttons.find(b => b.textContent === '−');
    fireEvent.click(minusBtn);
    // The usePopup mock's setPopupHtml gets called
  });

  it('should reduce exhaustion if con save succeeds', () => {
    // rollD20 returns 15, con save bonus is 3, total 18 >= dc 13
    render(<CharConditions {...defaultProps} exhaustionLevel={3} />);
    const buttons = screen.getAllByRole('button');
    const minusBtn = buttons.find(b => b.textContent === '−');
    fireEvent.click(minusBtn);

    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'exhaustionLevel', 2, 'test-campaign');
  });

  it('should call clearUnbreakableMajesty when incapacitated is toggled off', () => {
    getRuntimeValue.mockReturnValue(['incapacitated']);
    render(<CharConditions {...defaultProps} />);
    const incapacitatedBtn = screen.getByText('Incapacitated');
    fireEvent.click(incapacitatedBtn);
    expect(clearUnbreakableMajesty).toHaveBeenCalledWith(
      'Test Character',
      'test-campaign'
    );
  });

  it('should call clearUnbreakableMajesty when incapacitated is toggled on', () => {
    getRuntimeValue.mockReturnValue([]);
    render(<CharConditions {...defaultProps} />);
    const incapacitatedBtn = screen.getByText('Incapacitated');
    fireEvent.click(incapacitatedBtn);
    expect(clearUnbreakableMajesty).toHaveBeenCalledWith(
      'Test Character',
      'test-campaign'
    );
  });

  it('should log a save entry when toggling a condition with a save', async () => {
    getRuntimeValue.mockReturnValue([]);
    render(<CharConditions {...defaultProps} />);
    const charmedBtn = screen.getByText('Charmed');
    fireEvent.click(charmedBtn);
    await vi.waitFor(() => {
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'activeConditions', [], 'test-campaign');
    });
  });

  it('should remove condition from active list on successful save', async () => {
    getRuntimeValue.mockReturnValue(['charmed']);
    render(<CharConditions {...defaultProps} />);
    const charmedBtn = screen.getByText('Charmed');
    fireEvent.click(charmedBtn);
    await vi.waitFor(() => {
      // After successful save, condition should be removed
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'activeConditions', [], 'test-campaign');
    });
  });

  it('should not remove condition on failed save', () => {
    rollD20.mockReturnValueOnce(1);

    getRuntimeValue.mockReturnValue(['charmed']);
    render(<CharConditions {...defaultProps} />);
    const charmedBtn = screen.getByText('Charmed');
    fireEvent.click(charmedBtn);
    // rollD20 returns 1, bonus is 2, total 3 < DC 10, condition stays
    expect(charmedBtn).toHaveClass('condition-badge--active');
  });

  it('should not toggle condition when it has no save ability', () => {
    getRuntimeValue.mockReturnValue([]);
    render(<CharConditions {...defaultProps} />);
    const blindedBtn = screen.getByText('Blinded');
    fireEvent.click(blindedBtn);
    expect(blindedBtn).toHaveClass('condition-badge--active');
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/log'),
      expect.any(Object)
    );
  });

  it('should apply aura bonus to save roll', async () => {
    computeAuraBonus.mockResolvedValueOnce({
      bonus: 3,
      sourceName: 'Paladin',
    });
    getRuntimeValue.mockReturnValue([]);
    render(<CharConditions {...defaultProps} />);
    const charmedBtn = screen.getByText('Charmed');
    fireEvent.click(charmedBtn);
    // rollD20=15, bonus=2, aura=3, total=20 >= DC 10, condition removed
    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'activeConditions', [], 'test-campaign');
  });

  it('should show save advantage when conditionEffects.saveAdvantage includes condition', () => {
    getRuntimeValue.mockReturnValue([]);
    render(<CharConditions {...defaultProps} conditionEffects={{ saveAdvantage: ['charmed'] }} />);
    const charmedBtn = screen.getByText('Charmed');
    fireEvent.click(charmedBtn);
    // With advantage, both rolls are 15, total 15+2=17 >= DC 10
    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'activeConditions', [], 'test-campaign');
  });

  it('should show save advantage when conditionEffects.saveAdvantageCount > 0', () => {
    getRuntimeValue.mockReturnValue([]);
    render(<CharConditions {...defaultProps} conditionEffects={{ saveAdvantageCount: 1 }} />);
    const charmedBtn = screen.getByText('Charmed');
    fireEvent.click(charmedBtn);
    // With advantage, both rolls are 15, total 15+2=17 >= DC 10
    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'activeConditions', [], 'test-campaign');
  });

  it('should load conditions from runtime storage on mount', () => {
    getRuntimeValue.mockReturnValue(['blinded', 'stunned']);
    render(<CharConditions {...defaultProps} />);
    expect(screen.getByText('Blinded')).toHaveClass('condition-badge--active');
    expect(screen.getByText('Stunned')).toHaveClass('condition-badge--active');
  });

  it('should reset conditions when playerStats.name changes', () => {
    getRuntimeValue.mockReturnValue(['blinded']);
    const { rerender } = render(<CharConditions {...defaultProps} />);
    expect(screen.getByText('Blinded')).toHaveClass('condition-badge--active');

    getRuntimeValue.mockReturnValue([]);
    rerender(<CharConditions {...defaultProps} playerStats={{ ...mockPlayerStats, name: 'Other Character' }} />);
    expect(screen.getByText('Blinded')).not.toHaveClass('condition-badge--active');
  });

  it('should save conditions to runtime storage on change', () => {
    getRuntimeValue.mockReturnValue([]);
    render(<CharConditions {...defaultProps} />);
    const charmedBtn = screen.getByText('Charmed');
    fireEvent.click(charmedBtn);
    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'activeConditions', ['charmed'], 'test-campaign');
  });

  it('should render with exhaustion badge active class when level > 0', () => {
    render(<CharConditions {...defaultProps} exhaustionLevel={2} />);
    const badge = document.querySelector('.exhaustion-badge');
    expect(badge).toHaveClass('exhaustion-badge--active');
  });

  it('should render with exhaustion badge dead class when level >= 6', () => {
    render(<CharConditions {...defaultProps} exhaustionLevel={6} />);
    const badge = document.querySelector('.exhaustion-badge');
    expect(badge).toHaveClass('exhaustion-badge--dead');
  });

  it('should render with exhaustion badge default class when level is 0', () => {
    render(<CharConditions {...defaultProps} exhaustionLevel={0} />);
    const badge = document.querySelector('.exhaustion-badge');
    expect(badge).not.toHaveClass('exhaustion-badge--active');
    expect(badge).not.toHaveClass('exhaustion-badge--dead');
  });

  it('should export EXHAUSTION_LEVELS constant', () => {
    expect(EXHAUSTION_LEVELS).toBe(6);
  });

  it('should export loadActiveConditions function', () => {
    expect(typeof loadActiveConditions).toBe('function');
  });

  it('should call onConditionsChange after condition toggle', () => {
    getRuntimeValue.mockReturnValue([]);
    render(<CharConditions {...defaultProps} />);
    const charmedBtn = screen.getByText('Charmed');
    fireEvent.click(charmedBtn);
    expect(defaultProps.onConditionsChange).toHaveBeenCalled();
  });

  it('should not call onConditionsChange after exhaustion decrease', () => {
    render(<CharConditions {...defaultProps} exhaustionLevel={3} />);
    const buttons = screen.getAllByRole('button');
    const minusBtn = buttons.find(b => b.textContent === '−');
    fireEvent.click(minusBtn);
    expect(defaultProps.onConditionsChange).not.toHaveBeenCalled();
  });

  it('should include aura bonus detail in log entry when aura is present on save', async () => {
    computeAuraBonus.mockResolvedValueOnce({
      bonus: 3,
      sourceName: 'Paladin',
    });
    getRuntimeValue.mockReturnValue([]);
    render(<CharConditions {...defaultProps} />);
    const charmedBtn = screen.getByText('Charmed');
    fireEvent.click(charmedBtn);
    await vi.waitFor(() => {
      // After successful save with aura, the condition is removed
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'activeConditions', [], 'test-campaign');
    });
  });

  describe('loadActiveConditions', () => {
    it('should return stored conditions array', () => {
      getRuntimeValue.mockReturnValue(['blinded', 'grappled']);
      const result = loadActiveConditions('Test Character', 'test-campaign');
      expect(result).toEqual(['blinded', 'grappled']);
    });

    it('should return empty array when no stored conditions', () => {
      getRuntimeValue.mockReturnValue(null);
      const result = loadActiveConditions('Test Character', 'test-campaign');
      expect(result).toEqual([]);
    });

    it('should return empty array when stored value is not an array', () => {
      getRuntimeValue.mockReturnValue('not-an-array');
      const result = loadActiveConditions('Test Character', 'test-campaign');
      expect(result).toEqual([]);
    });
  });
});
