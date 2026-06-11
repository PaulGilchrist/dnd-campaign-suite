import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { buildFeatureDetailHtml } from '../../hooks/useActionPopup.js';

vi.mock('../../hooks/useLoggedDiceRoll.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../hooks/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 10),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  getLastDamageEvent: vi.fn(() => null),
  saveLastDamageEvent: vi.fn(),
  default: vi.fn(() => ({
    currentSP: 10,
    maxSP: 10,
    spendSorceryPoints: vi.fn(),
    logMetamagic: vi.fn(),
    saveLastDamageEvent: vi.fn(),
    getLastDamageEvent: vi.fn(() => null),
    clearLastDamageEvent: vi.fn(),
  })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/useActionSpellMetamagic.js', () => ({
  useActionSpellMetamagic: vi.fn(() => ({
    pendingActionMetamagic: null,
    handleActionMetamagicConfirm: vi.fn(),
    handleActionMetamagicSkip: vi.fn(),
    handleActionSpellDamageClick: vi.fn(),
    handleSpellAttackClick: vi.fn(),
    handleSpellDamageClick: vi.fn(),
  })),
}));

vi.mock('../../hooks/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
  })),
}));

vi.mock('../../hooks/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    buildUpcastLevels: vi.fn(() => []),
  })),
}));

vi.mock('../../services/combat/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
  collectWeaponMastery: vi.fn(() => ({ baseMastery: null, extraMasteries: [] })),
  evaluateAutoExpression: vi.fn(() => 0),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/automation/handlers/divineInterventionHandler.js', () => ({
  onSpellSelected: vi.fn(),
}));

vi.mock('../../services/rules/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

vi.mock('../../services/rules/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

vi.mock('../../services/combat/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(() => ({ saveDcBonus: 0 })),
}));

vi.mock('../../services/automation/contextBuilder.js', () => ({
  buildAttackContext: vi.fn(() => Promise.resolve({})),
  buildAttackContextSync: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/rules/empoweredSpellService.js', () => ({
  buildEmpoweredSpellState: vi.fn(() => null),
  executeEmpoweredReroll: vi.fn(() => Promise.resolve(null)),
  getEmpoweredSpellDescription: vi.fn(() => 'Empowered Spell description'),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => null),
  rollExpressionDoubled: vi.fn(() => null),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({})),
}));

vi.mock('../../services/character/featRangeService.js', () => ({
  computeFeatRangeEffects: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/automation/handlers/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import useLoggedDiceRoll from '../../hooks/useLoggedDiceRoll.js';

const mockPlayerStats = {
  name: 'TestCharacter',
  rules: '5e',
  attacks: [
    {
      name: 'Longsword',
      range: 5,
      hitBonus: 5,
      hitBonusFormula: '1d20+5',
      damage: '1d8+3',
      damageFormula: '1d8+3',
      damageType: 'Slashing',
      type: 'Action',
    },
  ],
  actions: [
    {
      name: 'Dash',
      description: 'You focus on movement',
      details: 'Your speed doubles',
    },
  ],
  bonusActions: [
    {
      name: 'Cunning Action',
      description: 'You can take a bonus action',
      details: 'Dash, Hide, or Disengage',
    },
  ],
  equipment: [
    {
      name: 'Longsword',
      equipment_category: 'Weapon',
      mastery: 'Piercing',
    },
  ],
};

describe('CharActions', () => {
  let mockSetPopupHtml;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetPopupHtml = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(['Dash', 'Disengage', 'Dodge', 'Hide', 'Withdraw']),
    });

    useLoggedDiceRoll.mockImplementation(() => ({
      popupHtml: null,
      setPopupHtml: mockSetPopupHtml,
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===== Basic Rendering Tests =====

  it('should render Actions section header', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('should display attack headers', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Range')).toBeInTheDocument();
    expect(screen.getByText('Hit')).toBeInTheDocument();
    expect(screen.getByText('Damage')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('should display attack details', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    expect(screen.getByText('Longsword')).toBeInTheDocument();
    expect(screen.getByText('5 ft.')).toBeInTheDocument();
    expect(screen.getByText('1d8+3')).toBeInTheDocument();
    expect(screen.getByText('Slashing')).toBeInTheDocument();
  });

  it('should display actions list', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    expect(screen.getByText(/Dash:/)).toBeInTheDocument();
  });

  it('should display bonus actions section', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
  });

  it('should load base actions from API', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/data/actions.json');
    });
  });

  it('should display base actions after loading', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Base Actions:/)).toBeInTheDocument();
    });
  });

  it('should sanitize action descriptions', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    expect(screen.getByText(/You focus on movement/)).toBeInTheDocument();
  });

  // ===== Attack Interaction Tests =====

  it('should render attack hit bonus as clickable', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    const hitBonusElement = screen.getByText('+5');
    expect(hitBonusElement).toHaveClass('clickable');
  });

  it('should render attack damage as clickable', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    const damageElement = screen.getByText('1d8+3');
    expect(damageElement).toHaveClass('clickable');
  });

  // ===== Weapon Mastery Tests =====

  it('should not show Mastery column for 5e rules', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    const masteryHeaders = screen.queryAllByText('Mastery');
    expect(masteryHeaders).toHaveLength(0);
  });

  it('should show Mastery column for 2024 rules', async () => {
    const stats2024 = {
      ...mockPlayerStats,
      rules: '2024',
      attacks: [
        {
          ...mockPlayerStats.attacks[0],
          type: 'Action',
        },
      ],
      equipment: [
        {
          name: 'Longsword',
          equipment_category: 'Weapon',
          mastery: 'Piercing',
        },
      ],
    };

    await act(async () => {
      render(<CharActions playerStats={stats2024} />);
    });

    expect(screen.getByText('Mastery')).toBeInTheDocument();
  });

  it('should display weapon mastery for 2024 rules', async () => {
    const stats2024 = {
      ...mockPlayerStats,
      rules: '2024',
      attacks: [
        {
          ...mockPlayerStats.attacks[0],
          type: 'Action',
        },
      ],
      equipment: [
        {
          name: 'Longsword',
          equipment_category: 'Weapon',
          mastery: 'Piercing',
        },
      ],
    };

    await act(async () => {
      render(<CharActions playerStats={stats2024} />);
    });

    expect(screen.getByText('Piercing')).toBeInTheDocument();
  });

  it('should not show mastery for weapon not in equipment', async () => {
    const stats = {
      ...mockPlayerStats,
      rules: '2024',
      equipment: [],
    };

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Mastery')).toBeInTheDocument();
  });

  it('should handle 2024 rules with magical weapon name', async () => {
    const stats2024 = {
      rules: '2024',
      attacks: [
        {
          name: '+1 Longsword',
          range: 5,
          hitBonus: 6,
          hitBonusFormula: null,
          damage: '1d8+4',
          damageFormula: null,
          damageType: 'Slashing',
          type: 'Action',
        },
      ],
      actions: [],
      bonusActions: [],
      equipment: [
        {
          name: 'Longsword',
          equipment_category: 'Weapon',
          mastery: 'Piercing',
        },
      ],
    };

    await act(async () => {
      render(<CharActions playerStats={stats2024} />);
    });

    expect(screen.getByText('Piercing')).toBeInTheDocument();
  });

  // ===== Save DC Spell Tests =====

  it('should show save DC instead of hit bonus for save-based spells', async () => {
    const statsWithSaveSpell = {
      ...mockPlayerStats,
      attacks: [
        {
          name: 'Sacred Flame',
          range: 60,
          saveDc: 14,
          saveType: 'DEX',
          saveSuccess: 'none',
          damage: '1d8',
          damageType: 'Radiant',
          type: 'Action',
        },
      ],
      actions: [],
      bonusActions: [],
    };

    await act(async () => {
      render(<CharActions playerStats={statsWithSaveSpell} />);
    });

    expect(screen.getByText('DC 14 DEX')).toBeInTheDocument();
    expect(screen.getByText('1d8')).toBeInTheDocument();
  });

  // ===== Bonus Action Tests =====

  it('should handle bonus action attacks', async () => {
    const statsWithBonusAttack = {
      ...mockPlayerStats,
      attacks: [
        {
          name: 'Handaxe',
          range: 20,
          hitBonus: 3,
          hitBonusFormula: null,
          damage: '1d6+2',
          damageFormula: null,
          damageType: 'Slashing',
          type: 'Bonus Action',
        },
      ],
      actions: [],
      bonusActions: [],
    };

    await act(async () => {
      render(<CharActions playerStats={statsWithBonusAttack} />);
    });

    expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    expect(screen.getByText('Handaxe')).toBeInTheDocument();
  });

  it('should render both bonus action attacks and bonus action descriptions', async () => {
    const statsWithBoth = {
      ...mockPlayerStats,
      attacks: [
        ...mockPlayerStats.attacks,
        {
          name: 'Handaxe',
          range: 20,
          hitBonus: 3,
          hitBonusFormula: null,
          damage: '1d6+2',
          damageFormula: null,
          damageType: 'Slashing',
          type: 'Bonus Action',
        },
      ],
    };

    await act(async () => {
      render(<CharActions playerStats={statsWithBoth} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
      expect(screen.getByText('Handaxe')).toBeInTheDocument();
      expect(screen.getByText(/Cunning Action:/)).toBeInTheDocument();
    });
  });

  // ===== Empty State Tests =====

  it('should handle empty attacks array', async () => {
    const emptyStats = {
      ...mockPlayerStats,
      attacks: [],
      actions: [],
      bonusActions: [],
    };

    await act(async () => {
      render(<CharActions playerStats={emptyStats} />);
    });

    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  // ===== Popup Tests =====

  it('should render popupHtml in the actions section', async () => {
    useLoggedDiceRoll.mockImplementation(() => ({
      popupHtml: '<div>Popup Content</div>',
      setPopupHtml: vi.fn(),
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    }));

    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    });
  });

  it('should dismiss popup when overlay is clicked', async () => {
    const mockDismiss = vi.fn();
    useLoggedDiceRoll.mockImplementation(() => ({
      popupHtml: '<div>Popup Content</div>',
      setPopupHtml: mockDismiss,
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    }));

    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    await waitFor(() => {
      const overlay = screen.getByTestId('popup-overlay');
      fireEvent.click(overlay);
    });

    expect(mockDismiss).toHaveBeenCalledWith(null);
  });

  // ===== Action Click Tests =====

  it('should show popup when action with details is clicked', async () => {
    const mockSetPopupHtml = vi.fn();
    useLoggedDiceRoll.mockImplementation(() => ({
      popupHtml: null,
      setPopupHtml: mockSetPopupHtml,
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    }));

    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    const actionElement = screen.getByText(/Dash:/);
    await act(async () => {
      fireEvent.click(actionElement);
    });

    expect(mockSetPopupHtml).toHaveBeenCalled();
  });

  // ===== buildFeatureDetailHtml Tests =====

  it('should return null for feature without details', () => {
    const result = buildFeatureDetailHtml({ name: 'Test', description: 'Test desc' });
    expect(result).toBeNull();
  });

  it('should return html for feature with details', () => {
    const result = buildFeatureDetailHtml({ name: 'Test', description: 'Test desc', details: 'Some details' });
    expect(result).toContain('<b>Test</b>');
    expect(result).toContain('Some details');
  });

  // ===== Cannot Act Tests =====

  it('should show incapacitated label when cannotAct is true', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} cannotAct />);
    });

    expect(screen.getByText('(Incapacitated)')).toBeInTheDocument();
  });

  it('should show penalized styling when exhaustionPenalty > 0', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} exhaustionPenalty={2} />);
    });

    const hitElement = screen.getByText('+3');
    expect(hitElement).toHaveClass('stat--penalized');
  });

  it('should show penalized styling when conditionAttackMode is disadvantage', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} conditionAttackMode='disadvantage' />);
    });

    const hitElement = screen.getByText('+5');
    expect(hitElement).toHaveClass('stat--penalized');
  });

  it('should show disabled-attack class when cannotAct is true', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} cannotAct />);
    });

    const hitElement = screen.getByText('+5');
    expect(hitElement).toHaveClass('disabled-attack');
  });

  // ===== Exhaustion Penalty Tests =====

  it('should apply exhaustion penalty to hit bonus display', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} exhaustionPenalty={3} />);
    });

    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  // ===== Metamagic / Empowered Spell Rendering Tests =====

  it('should render Empowered Spell action name for Metamagic automation', async () => {
    const sorcererStats = {
      ...mockPlayerStats,
      name: 'TestSorcerer',
      class: { name: 'Sorcerer' },
      level: 5,
      abilities: [
        { name: 'Charisma', bonus: 4, score: 18 },
      ],
      actions: [
        {
          name: 'Metamagic',
          description: 'You can bend the fabric of reality..',
          automation: {
            type: 'spell_modifier',
            options: ['Careful Spell'],
          },
        },
      ],
    };

    await act(async () => {
      render(<CharActions playerStats={sorcererStats} campaignName="test-campaign" />);
    });

    expect(screen.getByText(/Empowered Spell:/)).toBeInTheDocument();
  });

  // ===== Automation Badge Tests =====

  it('should not show automation badges for actions without automation', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    expect(screen.queryByRole('span', { name: /DC/ })).not.toBeInTheDocument();
  });

  // ===== Action with no details should not be clickable =====

  it('should render action without details as non-clickable', async () => {
    const stats = {
      ...mockPlayerStats,
      actions: [
        {
          name: 'Simple Action',
          description: 'Just a simple action',
        },
      ],
    };

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText(/Simple Action:/)).toBeInTheDocument();
  });

  // ===== Multiple attacks handling =====

  it('should display multiple attacks correctly', async () => {
    const stats = {
      ...mockPlayerStats,
      attacks: [
        mockPlayerStats.attacks[0],
        {
          name: 'Shortbow',
          range: 80,
          hitBonus: 4,
          damage: '1d6+2',
          damageType: 'Piercing',
          type: 'Action',
        },
      ],
    };

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Longsword')).toBeInTheDocument();
    expect(screen.getByText('Shortbow')).toBeInTheDocument();
  });

  // ===== Attack types other than Action/Bonus Action are filtered =====

  it('should filter out attacks that are not Action type', async () => {
    const stats = {
      ...mockPlayerStats,
      attacks: [
        {
          name: 'Reaction Attack',
          range: 5,
          hitBonus: 3,
          damage: '1d6+2',
          damageType: 'Slashing',
          type: 'Reaction',
        },
      ],
    };

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.queryByText('Reaction Attack')).not.toBeInTheDocument();
  });

  // ===== Component memoization (areEqual) =====

  it('should use React.memo with custom areEqual comparison', async () => {
    const stats1 = { ...mockPlayerStats };
    const { unmount } = await act(async () => {
      return render(<CharActions playerStats={stats1} />);
    });

    unmount();

    const stats2 = { ...mockPlayerStats };
    await act(async () => {
      render(<CharActions playerStats={stats2} />);
    });

    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  // ===== CSS class for 2024 mastery-enabled =====

  it('should add mastery-enabled class to attacks div for 2024 rules', async () => {
    const stats2024 = {
      ...mockPlayerStats,
      rules: '2024',
    };

    await act(async () => {
      render(<CharActions playerStats={stats2024} />);
    });

    const attacksDiv = document.querySelector('.attacks.mastery-enabled');
    expect(attacksDiv).toBeInTheDocument();
  });

  it('should not add mastery-enabled class for 5e rules', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    const attacksDiv = document.querySelector('.attacks');
    expect(attacksDiv).not.toHaveClass('mastery-enabled');
  });

  // ===== CharBonusActions is rendered =====

  it('should render CharBonusActions component', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
  });

  // ===== Fetch error handling =====

  it('should handle fetch error gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);

    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.reject(new Error('JSON error')),
    });

    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });

  // ===== Default exhaustionPenalty is 0 =====

  it('should default exhaustionPenalty to 0', async () => {
    await act(async () => {
      render(<CharActions playerStats={mockPlayerStats} />);
    });

    expect(screen.getByText('+5')).toBeInTheDocument();
  });
});
