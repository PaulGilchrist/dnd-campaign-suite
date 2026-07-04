// @improved-by-ai
import { render, screen } from '@testing-library/react';
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

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="metamagic-popup">{props.spell?.name || 'MetamagicPopup'}</div>),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="spell-detail-popup">{props.spell?.name || 'SpellDetailPopup'}</div>),
}));

import { getInnateSorceryBonus } from '../../services/combat/buffs/buffService.js';

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

describe('CharBonusActions - Rendering', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  describe('section visibility', () => {
    it('returns null when there are no bonus actions, attacks, spells, or horde breaker', () => {
      const stats = createStats({
        bonusActions: [],
        attacks: [
          { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
        ],
        spellAbilities: { spells: [] },
      });

      const { container } = render(<CharBonusActions playerStats={stats} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders section when bonusActions array has entries', () => {
      const stats = createStats({
        bonusActions: [{ name: 'Cunning Action', description: 'Dash, Hide, or Disengage.' }],
      });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });

    it('renders section when bonus action attacks exist', () => {
      const stats = createStats({
        attacks: [{ name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' }],
      });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });

    it('renders section when bonus action spells exist', () => {
      const stats = createStats({
        spellAbilities: {
          spells: [{ name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' }],
        },
      });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });
  });

  describe('bonus action attacks rendering', () => {
    const bonusActionAttack = {
      name: 'Main Gauche',
      range: 5,
      hitBonus: 5,
      damage: '1d4+3',
      damageType: 'Piercing',
      type: 'Bonus Action',
    };

    it('displays the attack name, range, damage, and damage type', () => {
      const stats = createStats({ attacks: [bonusActionAttack] });
      const { container } = render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Main Gauche')).toBeInTheDocument();
      expect(screen.getByText('5 ft.')).toBeInTheDocument();
      expect(screen.getByText('1d4+3')).toBeInTheDocument();
      expect(screen.getByText('Piercing')).toBeInTheDocument();
      expect(container.querySelector('.stat--penalized')).not.toBeInTheDocument();
    });

    it('applies exhaustion penalty and stat classes to hit bonus display', () => {
      const stats = createStats({ attacks: [bonusActionAttack] });

      // exhaustion penalty changes hit bonus from +5 to +2 and adds stat--penalized
      const { container: penalizedContainer } = render(<CharBonusActions playerStats={stats} exhaustionPenalty={3} />);
      expect(screen.getByText('+2')).toBeInTheDocument();
      expect(penalizedContainer.querySelector('.stat--penalized')).toBeInTheDocument();

      // conditionAttackMode disadvantage also adds stat--penalized
      const { container: disadvantageContainer } = render(<CharBonusActions playerStats={stats} conditionAttackMode="disadvantage" />);
      expect(disadvantageContainer.querySelector('.stat--penalized')).toBeInTheDocument();

      // cannotAct adds both stat--penalized and disabled-attack
      const { container: cannotActContainer } = render(<CharBonusActions playerStats={stats} cannotAct />);
      expect(cannotActContainer.querySelector('.stat--penalized')).toBeInTheDocument();
      expect(cannotActContainer.querySelector('.disabled-attack')).toBeInTheDocument();
    });
  });

  describe('bonus action attacks with save DC', () => {
    const saveDcAttack = {
      name: 'Cone of Cold',
      range: 60,
      saveDc: 14,
      saveType: 'CON',
      damage: '8d8',
      damageType: 'Cold',
      type: 'Bonus Action',
    };

    it('displays save DC instead of hit bonus', () => {
      getInnateSorceryBonus.mockReturnValue({ saveDcBonus: 0 });
      render(<CharBonusActions playerStats={createStats({ attacks: [saveDcAttack] })} />);
      expect(screen.getByText('DC 14 CON')).toBeInTheDocument();
      expect(screen.queryByText('+5')).not.toBeInTheDocument();
    });

    it('applies innate sorcery save DC bonus', () => {
      getInnateSorceryBonus.mockReturnValue({ saveDcBonus: 1 });
      render(<CharBonusActions playerStats={createStats({ attacks: [saveDcAttack] })} />);
      expect(screen.getByText('DC 15 CON')).toBeInTheDocument();
    });
  });

  describe('bonus action spells rendering', () => {
    const bonusActionSpell = { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' };

    it('displays the spell name, range, and type', () => {
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [bonusActionSpell] } })} />);
      expect(screen.getByText('Shocking Grasp')).toBeInTheDocument();
      expect(screen.getByText('Touch')).toBeInTheDocument();
      expect(screen.getByText('Utility')).toBeInTheDocument();
    });

    it('filters spells by prepared status and casting time', () => {
      const spells = [
        { ...bonusActionSpell, name: 'Unprepared Spell', prepared: 'Unprepared' },
        { ...bonusActionSpell, name: 'Always Prepared', prepared: 'Always' },
        { ...bonusActionSpell, name: 'Action Spell', casting_time: '1 action' },
        { ...bonusActionSpell, name: 'Bonus Action Spell', casting_time: '1 bonus action' },
      ];
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells } })} />);
      expect(screen.queryByText('Unprepared Spell')).not.toBeInTheDocument();
      expect(screen.queryByText('Action Spell')).not.toBeInTheDocument();
      expect(screen.getByText('Always Prepared')).toBeInTheDocument();
      expect(screen.getByText('Bonus Action Spell')).toBeInTheDocument();
    });
  });

  describe('bonus action descriptions rendering', () => {
    const bonusActionDesc = {
      name: 'Cunning Action',
      description: 'You can take a bonus action.',
      details: 'Dash, Hide, or Disengage.',
    };

    it('renders bonus action with clickable name when it has details', () => {
      render(<CharBonusActions playerStats={createStats({ bonusActions: [bonusActionDesc] })} />);
      expect(screen.getByText(/Cunning Action:/)).toBeInTheDocument();
      expect(screen.getByText(/You can take a bonus action/)).toBeInTheDocument();
      expect(screen.getByText(/Cunning Action:/)).toHaveClass('clickable');
    });

    it('renders non-clickable when there are no details and no automation', () => {
      const simple = { name: 'Simple Bonus', description: 'A simple bonus action without details.' };
      render(<CharBonusActions playerStats={createStats({ bonusActions: [simple] })} />);
      expect(screen.getByText(/Simple Bonus:/)).not.toHaveClass('clickable');
    });
  });

  describe('2024 rules rendering', () => {
    const bonusActionAttack = { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' };

    it('shows Mastery column header and applies mastery-enabled class for 2024 rules', () => {
      render(<CharBonusActions playerStats={createStats({ rules: '2024', attacks: [bonusActionAttack] })} getWeaponMastery={() => null} />);
      expect(screen.getByText('Mastery')).toBeInTheDocument();
      expect(document.querySelector('.attacks.mastery-enabled')).toBeInTheDocument();
    });
  });

  describe('combined content rendering', () => {
    it('renders bonus action attacks, descriptions, and spells together', () => {
      const stats = createStats({
        attacks: [{ name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' }],
        bonusActions: [{ name: 'Cunning Action', description: 'You can take a bonus action.', details: 'Dash, Hide, or Disengage.' }],
        spellAbilities: { spells: [{ name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' }] },
      });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Main Gauche')).toBeInTheDocument();
      expect(screen.getByText(/Cunning Action:/)).toBeInTheDocument();
      expect(screen.getByText('Shocking Grasp')).toBeInTheDocument();
      expect(screen.getByText('Hit')).toBeInTheDocument();
      expect(screen.getByText('Damage')).toBeInTheDocument();
    });
  });

});
