// @maintained-by-ai
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

vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
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
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  useRuntimeValue: vi.fn(() => null),
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

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn((_props) => <div data-testid="metamagic-popup">{_props.spell?.name || 'MetamagicPopup'}</div>),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn((_props) => <div data-testid="spell-detail-popup">SpellDetailPopup</div>),
}));

vi.mock('./HexAbilityModal.jsx', () => ({
  default: vi.fn((props) => <div data-testid="hex-ability-modal"><button onClick={props.onCancel}>Cancel</button></div>),
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: vi.fn((props) => <div data-testid="secondary-target-modal">{props.title}</div>),
}));

vi.mock('./ArcaneVigorModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="arcane-vigor-modal">Arcane Vigor</div>),
}));

vi.mock('../../services/rules/core/spellDamageUtils.js', () => ({
  resolveSpellDamageAtLevel: vi.fn(() => null),
  isAutoHitSpell: vi.fn(() => false),
  resolveHealExpression: vi.fn(() => ''),
}));

vi.mock('../../services/ui/spellSectionUtils.js', () => ({
  getBonusActionSpellNames: vi.fn(() => new Set()),
}));

vi.mock('../../services/character/featureCategories.js', () => ({
  getCategories: vi.fn(() => ({ featuresToIgnore: [] })),
}));

vi.mock('../../hooks/combat/useSimpleDamageRoll.js', () => ({
  useSimpleDamageRoll: vi.fn(() => vi.fn()),
}));

vi.mock('../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: vi.fn(() => ({ resolvePositions: vi.fn(), cachedPosRef: {} })),
}));

vi.mock('../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: vi.fn(() => ({ castAction: vi.fn() })),
}));

vi.mock('../../services/ui/formatUtils.js', () => ({
  formatRange: vi.fn((range) => {
    if (!range && range !== 0) return '';
    return `${range} ft.`;
  }),
  signFormatter: { format: (n) => (n >= 0 ? `+${n}` : `${n}`) },
  getAttackSpellLevel: vi.fn((_spellAbilities, attackName) => {
    if (attackName === 'Minor Illusion Attack') return 0;
    if (attackName === 'Ice Knife') return 2;
    return null;
  }),
}));

import { getInnateSorceryBonus } from '../../services/combat/buffs/buffService.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';
import { getBonusActionSpellNames } from '../../services/ui/spellSectionUtils.js';
import { getCategories } from '../../services/character/featureCategories.js';

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
    it('returns null when there are no bonus actions, bonus action attacks, or bonus action spells', () => {
      const stats = createStats({
        bonusActions: [],
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
        spellAbilities: { spells: [] },
      });

      const { container } = render(<CharBonusActions playerStats={stats} />);
      expect(container.firstChild).toBeNull();
    });

    it.each([
      {
        label: 'bonusActions array has entries',
        stats: createStats({ bonusActions: [{ name: 'Cunning Action', description: 'Dash, Hide, or Disengage.' }] }),
      },
      {
        label: 'bonus action attacks exist',
        stats: createStats({ attacks: [{ name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' }] }),
      },
      {
        label: 'bonus action spells exist',
        spell: { name: 'Shocking Grasp', level: 0, range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' },
        stats: createStats({ spellAbilities: { spells: [{ name: 'Shocking Grasp', level: 0, range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' }] } }),
      },
    ])('renders section when $label', ({ stats, spell }) => {
      if (spell) {
        vi.mocked(getBonusActionSpellNames).mockImplementation(() => new Set([spell.name]));
      }
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
      if (spell) {
        // The spell lane must actually render the row, not just the header.
        expect(screen.getByText(spell.name)).toBeInTheDocument();
      }
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

    it('displays name, level, range, hit bonus, damage, and damage type', () => {
      render(<CharBonusActions playerStats={createStats({ attacks: [bonusActionAttack] })} exhaustionPenalty={0} />);
      expect(screen.getByText('Main Gauche')).toBeInTheDocument();
      expect(screen.getByText('5 ft.')).toBeInTheDocument();
      expect(screen.getByText('+5')).toBeInTheDocument();
      expect(screen.getByText('1d4+3')).toBeInTheDocument();
      expect(screen.getByText('Piercing')).toBeInTheDocument();
    });

    it('reduces the displayed hit bonus by exhaustionPenalty', () => {
      render(<CharBonusActions playerStats={createStats({ attacks: [bonusActionAttack] })} exhaustionPenalty={3} />);
      expect(screen.getByText('+2')).toBeInTheDocument();
      expect(screen.queryByText('+5')).not.toBeInTheDocument();
    });

    it.each([
      { saveDcBonus: 0, expected: 'DC 14 CON' },
      { saveDcBonus: 1, expected: 'DC 15 CON' },
    ])('save DC attacks show $expected in the hit column with sorcery bonus $saveDcBonus', ({ saveDcBonus, expected }) => {
      vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus });
      const saveDcAttack = { name: 'Cone of Cold', range: 60, saveDc: 14, saveType: 'CON', damage: '8d8', damageType: 'Cold', type: 'Bonus Action' };
      render(<CharBonusActions playerStats={createStats({ attacks: [saveDcAttack] })} exhaustionPenalty={0} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
      // A save DC row never shows a to-hit bonus.
      expect(screen.queryByText('+5')).not.toBeInTheDocument();
    });

    it.each([
      { attackName: 'Minor Illusion Attack', spellLevel: 0, expected: 'Cantrip' },
      { attackName: 'Ice Knife', spellLevel: 2, expected: '2' },
      { attackName: 'Main Gauche', spellLevel: null, expected: null },
    ])('attack level column shows $expected for spell attack $attackName', ({ attackName, spellLevel, expected }) => {
      // The formatUtils mock maps these two names to fixed levels; others → null.
      const stats = createStats({
        attacks: [{ name: attackName, range: 60, hitBonus: 5, damage: '1d8', damageType: 'Psychic', type: 'Bonus Action' }],
        spellAbilities: { toHit: 5, spells: [{ name: attackName, level: spellLevel }] },
      });
      render(<CharBonusActions playerStats={stats} getWeaponMastery={() => null} exhaustionPenalty={0} />);
      if (expected) {
        expect(screen.getByText(expected)).toBeInTheDocument();
      } else {
        expect(screen.queryByText('Cantrip')).not.toBeInTheDocument();
      }
    });
  });

  describe('bonus feature rows rendering', () => {
    it('renders bonus feature rows with name and description', () => {
      const bonusAction = {
        name: 'Cunning Action',
        description: 'You can take a bonus action.',
        details: 'Dash, Hide, or Disengage.',
      };
      render(<CharBonusActions playerStats={createStats({ bonusActions: [bonusAction] })} />);
      expect(screen.getByText('Cunning Action:')).toBeInTheDocument();
      expect(screen.getByText(/You can take a bonus action/)).toBeInTheDocument();
    });

    it('filters out bonus actions listed in featuresToIgnore', () => {
      vi.mocked(getCategories).mockReturnValue({ featuresToIgnore: ['Spellcasting'] });
      const bonusActions = [
        { name: 'Spellcasting', description: 'Cast spells.' },
        { name: 'Cunning Action', description: 'Dash, Hide, or Disengage.', details: 'Quick movement.' },
      ];
      render(<CharBonusActions playerStats={createStats({ bonusActions })} />);
      expect(screen.queryByText(/Spellcasting:/)).not.toBeInTheDocument();
      expect(screen.getByText(/Cunning Action:/)).toBeInTheDocument();
    });

    it.each([
      { label: 'healing_pool', automation: { type: 'healing_pool', pool: 15 }, badge: /Pool: 15 HP/ },
      { label: 'damage', automation: { type: 'bonus_action_attack', damage: '1d8+3', damageType: 'Slashing' }, badge: /1d8\+3 Slashing/ },
    ])('shows a $label automation badge on bonus action rows', ({ automation, badge }) => {
      vi.mocked(hasAutomation).mockReturnValue(true);
      const bonusAction = { name: 'Automated Feature', description: 'Feature with automation.', automation };
      render(<CharBonusActions playerStats={createStats({ bonusActions: [bonusAction] })} />);
      expect(screen.getByText(badge)).toBeInTheDocument();
    });
  });

  describe('2024 rules Mastery column', () => {
    const bonusActionAttack = { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' };

    it.each([
      { label: 'with', passives: [{ type: 'weapon_kind_mastery', name: 'Weapon Kind Mastery' }] },
      { label: 'without', passives: [] },
    ])('shows the Mastery column header only $label a weapon_kind_mastery passive', ({ label, passives }) => {
      render(<CharBonusActions
        playerStats={createStats({ rules: '2024', attacks: [bonusActionAttack], automation: { passives } })}
        getWeaponMastery={() => null}
      />);
      expect((!!screen.queryByText('Mastery'))).toBe(label === 'with');
    });
  });

  describe('bonus action spells - level display', () => {
    it.each([
      { spell: { name: 'Shocking Grasp', level: 0, range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' }, expected: 'Cantrip' },
      { spell: { name: 'Hideous Laughter', level: 1, range: '60 ft.', casting_time: '1 bonus action', prepared: 'Prepared' }, expected: '1' },
    ])('spell rows show $expected in the level column', ({ spell, expected }) => {
      vi.mocked(getBonusActionSpellNames).mockImplementation(() => new Set([spell.name]));
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [spell] } })} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
      expect(screen.getByText(spell.name)).toBeInTheDocument();
    });
  });
});
