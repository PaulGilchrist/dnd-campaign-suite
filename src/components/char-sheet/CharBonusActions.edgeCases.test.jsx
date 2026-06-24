// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharBonusActions from './CharBonusActions.jsx';

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingAid: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    pendingGreaterRestoration: null,
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    buildUpcastLevels: vi.fn(() => []),
  })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
  triggerPostCastRiderSaves: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 10),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn((_playerName, _campaignName) => ({ saveDcBonus: 0 })),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn((entity) => {
    if (entity.details) {
      return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    }
    return null;
  }),
}));

vi.mock('./DiceRollResult.jsx', () => ({
  default: vi.fn((props) => <div data-testid="dice-roll-result">{props.name || 'DiceRollResult'}</div>),
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="metamagic-popup">{props.spell?.name || 'MetamagicPopup'}</div>),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="spell-detail-popup">{props.spell?.name || 'SpellDetailPopup'}</div>),
}));

import { getInnateSorceryBonus } from '../../services/combat/buffs/buffService.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';

const basePlayerStats = {
  name: 'TestCharacter',
  rules: '5e',
  level: 5,
  attacks: [],
  bonusActions: [],
  spellAbilities: { spells: [] },
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

describe('CharBonusActions - Edge Cases', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  describe('edge cases', () => {
    it('handles playerStats with undefined spellAbilities gracefully', () => {
      const stats = createStats({
        spellAbilities: undefined,
        attacks: [{ name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' }],
      });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Main Gauche')).toBeInTheDocument();
    });
  });

  describe('undefined/null handling', () => {
    it('handles playerStats with undefined rules (defaults to 5e)', () => {
      const stats = { ...basePlayerStats, rules: undefined, bonusActions: [{ name: 'Test', description: 'Test desc', details: 'Test details' }] };
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
      expect(document.querySelector('.attacks.mastery-enabled')).not.toBeInTheDocument();
    });

    it('crashes when playerStats.bonusActions is undefined (production bug)', () => {
      const stats = createStats({ bonusActions: undefined });
      expect(() => render(<CharBonusActions playerStats={stats} />)).toThrow();
    });

    it('crashes when playerStats.bonusActions is null (production bug)', () => {
      const stats = createStats({ bonusActions: null });
      expect(() => render(<CharBonusActions playerStats={stats} />)).toThrow();
    });

    it('crashes when playerStats.attacks is undefined (production bug)', () => {
      const stats = createStats({ attacks: undefined, bonusActions: [{ name: 'Test', description: 'Test desc', details: 'Test details' }] });
      expect(() => render(<CharBonusActions playerStats={stats} />)).toThrow();
    });

    it('crashes when playerStats.attacks is null (production bug)', () => {
      const stats = createStats({ attacks: null, bonusActions: [{ name: 'Test', description: 'Test desc', details: 'Test details' }] });
      expect(() => render(<CharBonusActions playerStats={stats} />)).toThrow();
    });

    it('handles playerStats with undefined spellAbilities.spells gracefully', () => {
      const stats = createStats({ spellAbilities: { spells: undefined }, bonusActions: [{ name: 'Test', description: 'Test desc', details: 'Test details' }] });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });
  });

  describe('Nick mastery round check (2024 rules)', () => {
    const lightWeaponAttack = {
      name: 'Dagger',
      range: 5,
      hitBonus: 5,
      damage: '1d4+3',
      damageType: 'Piercing',
      type: 'Bonus Action',
      properties: ['Light'],
    };

    it('filters out Light weapon bonus action attack when Nick was used this round (2024 rules)', () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_Nick_UsedRound') return 1;
        return null;
      });
      const stats = createStats({ rules: '2024', attacks: [lightWeaponAttack] });
      render(<CharBonusActions playerStats={stats} getWeaponMastery={() => null} />);
      expect(screen.queryByText('Dagger')).not.toBeInTheDocument();
    });

    it('shows Light weapon bonus action attack when Nick was NOT used this round (2024 rules)', () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_Nick_UsedRound') return 0;
        return null;
      });
      const stats = createStats({ rules: '2024', attacks: [lightWeaponAttack] });
      render(<CharBonusActions playerStats={stats} getWeaponMastery={() => null} />);
      expect(screen.getByText('Dagger')).toBeInTheDocument();
    });

    it('shows Light weapon bonus action attack in 5e rules regardless of Nick round', () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_Nick_UsedRound') return 1;
        return null;
      });
      const stats = createStats({ rules: '5e', attacks: [lightWeaponAttack] });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Dagger')).toBeInTheDocument();
    });
  });

  describe('Elder Champion spell conversion', () => {
    it('converts action spells to bonus action spells when Elder Champion is active', () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Elder Champion' }];
        return null;
      });
      const actionSpell = { name: 'Shooting Star', range: '60 ft.', casting_time: '1 action', prepared: 'Prepared' };
      const stats = createStats({ spellAbilities: { spells: [actionSpell] } });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Shooting Star')).toBeInTheDocument();
      expect(screen.getByText('60 ft.')).toBeInTheDocument();
    });

    it('does not convert action spells when Elder Champion is not active', () => {
      getRuntimeValue.mockReturnValue(null);
      const actionSpell = { name: 'Shooting Star', range: '60 ft.', casting_time: '1 action', prepared: 'Prepared' };
      const stats = createStats({ spellAbilities: { spells: [actionSpell] } });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.queryByText('Shooting Star')).not.toBeInTheDocument();
    });

    it('shows both bonus action and converted action spells when Elder Champion is active', () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Elder Champion' }];
        return null;
      });
      const spells = [
        { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' },
        { name: 'Shooting Star', range: '60 ft.', casting_time: '1 action', prepared: 'Prepared' },
        { name: 'Misty Step', range: '30 ft.', casting_time: '1 bonus action', prepared: 'Prepared' },
      ];
      const stats = createStats({ spellAbilities: { spells } });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Shocking Grasp')).toBeInTheDocument();
      expect(screen.getByText('Shooting Star')).toBeInTheDocument();
      expect(screen.getByText('Misty Step')).toBeInTheDocument();
    });

    it('throws when getRuntimeValue throws during render (no try-catch at call site)', () => {
      getRuntimeValue.mockImplementation(() => {
        throw new Error('Storage error');
      });
      const stats = createStats({ spellAbilities: { spells: [{ name: 'Shooting Star', range: '60 ft.', casting_time: '1 action', prepared: 'Prepared' }] } });
      expect(() => render(<CharBonusActions playerStats={stats} />)).toThrow('Storage error');
    });
  });

  describe('featureCategories filter', () => {
    it('filters out bonus actions that are in featuresToIgnore list (5e)', () => {
      const ignoredAction = { name: 'Rage', description: 'Enter a rage.', details: 'Gain benefits.' };
      const stats = createStats({ rules: '5e', bonusActions: [ignoredAction] });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.queryByText(/Rage:/)).not.toBeInTheDocument();
    });

    it('filters out bonus actions that are in featuresToIgnore list (2024)', () => {
      const ignoredAction = { name: 'Barbarian Subclass', description: 'Subclass feature.', details: 'Power.' };
      const stats = createStats({ rules: '2024', bonusActions: [ignoredAction] });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.queryByText(/Barbarian Subclass:/)).not.toBeInTheDocument();
    });

    it('shows bonus actions NOT in featuresToIgnore list', () => {
      const actionable = { name: 'Cunning Action', description: 'Dash, Hide, or Disengage.', details: 'Move fast.' };
      const stats = createStats({ rules: '5e', bonusActions: [actionable] });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText(/Cunning Action:/)).toBeInTheDocument();
    });
  });

  describe('spells that share names with attacks are excluded from spell list', () => {
    it('shows the attack version but not the spell version when names match', () => {
      const spell = { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' };
      const attack = { name: 'Shocking Grasp', range: 'Touch', hitBonus: 5, damage: '1d8+3', damageType: 'Lightning', type: 'Bonus Action' };
      render(<CharBonusActions playerStats={createStats({ attacks: [attack], spellAbilities: { spells: [spell] } })} />);
      expect(screen.getByText('Shocking Grasp')).toBeInTheDocument();
    });
  });

  describe('onAttackClick with save DC attack', () => {
    const saveDcAttack = {
      name: 'Cone of Cold',
      range: 60,
      saveDc: 14,
      saveType: 'CON',
      damage: '8d8',
      damageType: 'Cold',
      type: 'Bonus Action',
    };

    it('does not show clickable hit bonus for save DC attacks', () => {
      getInnateSorceryBonus.mockReturnValue({ saveDcBonus: 0 });
      render(<CharBonusActions playerStats={createStats({ attacks: [saveDcAttack] })} />);
      expect(screen.queryByText('+5')).not.toBeInTheDocument();
    });
  });

  describe('popup rendering edge cases', () => {
    it('renders automation_info popup with icon and content', async () => {
      const automatedAction = {
        name: 'Auto Test',
        description: 'Automated bonus action',
        automation: { type: 'test_automation' },
      };
      hasAutomation.mockReturnValue(true);
      render(<CharBonusActions playerStats={createStats({ bonusActions: [automatedAction] })} onAutomationAction={vi.fn()} />);
      fireEvent.click(screen.getByText(/Auto Test:/));
      expect(screen.getByText(/Auto Test:/)).toBeInTheDocument();
    });
  });

  describe('bonus action spell click with nonexistent spell', () => {
    it('does not crash when handleBonusSpellClick is called with nonexistent spell name', () => {
      render(<CharBonusActions playerStats={createStats({ bonusActions: [{ name: 'Test', description: 'Test', details: 'Details' }] })} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });
  });
});
