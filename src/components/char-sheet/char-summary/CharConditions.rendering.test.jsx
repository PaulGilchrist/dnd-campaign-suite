import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharConditions from './CharConditions.jsx';
import { rollD20 } from '../../../services/dice/diceRoller.js';

let runtimeValues = {};

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => {
    const storageKey = `${name}::${key}`;
    return runtimeValues[storageKey] ?? runtimeValues[key] ?? null;
  }),
  setRuntimeValue: vi.fn((name, key, value) => {
    runtimeValues[`${name}::${key}`] = value;
  }),
  addStorageChangeListener: vi.fn(() => () => {}),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilityLabel: vi.fn((abbr) => abbr?.toUpperCase() || 'None'),
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

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../services/automation/handlers/buffs/auraOfPurityHandler.js', () => ({
  isAuraOfPurityActive: vi.fn(() => false),
  getAuraOfPuritySaveAdvantageConditions: vi.fn(() => []),
}));

vi.mock('../../../services/combat/conditions/conditionEffects.js', () => ({
  hasSaveAdvantage: vi.fn(() => false),
}));

describe('CharConditions rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeValues = {};
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

  describe('empty state', () => {
    it('renders nothing when no conditions and no exhaustion', () => {
      const { container } = render(<CharConditions {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('exhaustion badge rendering', () => {
    it('shows dead styling in title when exhaustion is at maximum (level 6)', () => {
      render(<CharConditions {...defaultProps} exhaustionLevel={6} />);
      expect(screen.getByText('Exhaustion (6)')).toHaveAttribute('title', 'Exhaustion level 6 - DEAD\n\n');
    });

    it('disables plus button when exhaustion is at maximum level', () => {
      render(<CharConditions {...defaultProps} exhaustionLevel={6} />);
      expect(screen.getByRole('button', { name: '+' })).toBeDisabled();
    });

    it.each`
      level | minusEnabled | plusEnabled
      ${1}  | ${true}      | ${true}
      ${5}  | ${true}      | ${true}
    `('exhaustion at level $level - minus button $minusEnabled, plus button $plusEnabled', ({ level, minusEnabled, plusEnabled }) => {
      render(<CharConditions {...defaultProps} exhaustionLevel={level} />);
      expect(screen.getByRole('button', { name: '−' }).disabled).toBe(!minusEnabled);
      expect(screen.getByRole('button', { name: '+' }).disabled).toBe(!plusEnabled);
    });
  });

  describe('condition deduplication', () => {
    it('renders each unique condition only once despite duplicates in the array', () => {
      runtimeValues['Test Character::activeConditions'] = ['charmed', 'charmed', 'blinded'];
      runtimeValues['Test Character::activeConditionMeta'] = {
        charmed: { dc: 12, ability: 'wis' },
        blinded: { dc: 10, ability: null },
      };
      render(<CharConditions {...defaultProps} />);
      expect(screen.getAllByText('Charmed DC 12')).toHaveLength(1);
      expect(screen.getByText('Blinded DC 10')).toBeInTheDocument();
    });
  });

  describe('condition display text and tooltips', () => {
    it.each`
      condition      | conditions           | meta                                      | displayText
      ${'charmed'}   | ${['charmed']}       | ${{ charmed: { dc: 12, ability: 'wis' } }} | ${'Charmed DC 12'}
      ${'blinded-dc'}| ${['blinded']}       | ${{ blinded: { dc: 10 } }}                 | ${'Blinded DC 10'}
      ${'blinded-ability'} | ${['blinded']} | ${{ blinded: { ability: 'con' } }}         | ${'Blinded'}
    `('renders "$displayText" for condition with meta $meta', ({ conditions, meta, displayText }) => {
      runtimeValues['Test Character::activeConditions'] = conditions;
      runtimeValues['Test Character::activeConditionMeta'] = meta;
      render(<CharConditions {...defaultProps} />);
      expect(screen.getByText(displayText)).toBeInTheDocument();
    });

    it.each`
      condition      | conditions           | meta                                      | displayText
      ${'charmed'}   | ${['charmed']}       | ${{ charmed: { dc: 12, ability: 'wis' } }} | ${'Charmed DC 12'}
      ${'blinded'}   | ${['blinded']}       | ${{}}                                       | ${'Blinded'}
    `('sets tooltip from CONDITION_DESCRIPTIONS for $condition', ({ conditions, meta, displayText }) => {
      runtimeValues['Test Character::activeConditions'] = conditions;
      runtimeValues['Test Character::activeConditionMeta'] = meta;
      render(<CharConditions {...defaultProps} />);
      expect(screen.getByText(displayText).getAttribute('title')).toContain('can\'t');
    });

    it('sets tooltip for exhaustion level', () => {
      runtimeValues['Test Character::activeConditions'] = [];
      runtimeValues['Test Character::activeConditionMeta'] = {};
      render(<CharConditions {...defaultProps} exhaustionLevel={2} />);
      expect(screen.getByText('Exhaustion (2)').getAttribute('title')).toContain('Exhaustion level 2');
    });
  });

  describe('condition savability behavior', () => {
    it('triggers a save roll popup when clicking a savable condition', async () => {
      runtimeValues['Test Character::activeConditions'] = ['charmed'];
      runtimeValues['Test Character::activeConditionMeta'] = { charmed: { dc: 14, ability: 'wis' } };

      render(<CharConditions {...defaultProps} />);
      fireEvent.click(screen.getByText('Charmed DC 14'));

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalled();
      });
    });

    it('removes condition from the list after a successful save', async () => {
      runtimeValues['Test Character::activeConditions'] = ['charmed'];
      runtimeValues['Test Character::activeConditionMeta'] = { charmed: { dc: 14, ability: 'wis' } };

      render(<CharConditions {...defaultProps} />);
      fireEvent.click(screen.getByText('Charmed DC 14'));

      await waitFor(() => {
        expect(screen.queryByText('Charmed DC 14')).not.toBeInTheDocument();
      });
    });
  });

  describe('combined conditions and exhaustion display', () => {
    it('renders both conditions and exhaustion in the same grid', () => {
      runtimeValues['Test Character::activeConditions'] = ['charmed'];
      runtimeValues['Test Character::activeConditionMeta'] = { charmed: { dc: 12, ability: 'wis' } };
      render(<CharConditions {...defaultProps} exhaustionLevel={2} />);
      expect(screen.getByText('Charmed DC 12')).toBeInTheDocument();
      expect(screen.getByText('Exhaustion (2)')).toBeInTheDocument();
    });
  });

  describe('character name change re-mount', () => {
    it('loads conditions from the new character name when playerStats.name changes', () => {
      runtimeValues['Test Character::activeConditions'] = ['charmed'];
      runtimeValues['Test Character::activeConditionMeta'] = { charmed: { dc: 12, ability: 'wis' } };
      runtimeValues['New Character::activeConditions'] = ['blinded'];
      runtimeValues['New Character::activeConditionMeta'] = { blinded: { dc: 10, ability: 'con' } };

      const { rerender } = render(<CharConditions {...defaultProps} />);
      expect(screen.getByText('Charmed DC 12')).toBeInTheDocument();

      const newPlayerStats = {
        ...mockPlayerStats,
        name: 'New Character',
      };
      rerender(<CharConditions {...defaultProps} playerStats={newPlayerStats} />);
      expect(screen.getByText('Blinded DC 10')).toBeInTheDocument();
    });
  });
});
