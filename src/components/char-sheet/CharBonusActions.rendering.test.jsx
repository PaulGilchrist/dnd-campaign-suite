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
    it('returns null when there are no bonus actions, bonus action attacks, bonus action spells, or horde breaker', () => {
      const stats = createStats({
        bonusActions: [],
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
        spellAbilities: { spells: [] },
      });

      const { container } = render(<CharBonusActions playerStats={stats} />);
      expect(container.firstChild).toBeNull();
    });

    it.each([
      { label: 'bonusActions array has entries', stats: createStats({ bonusActions: [{ name: 'Cunning Action', description: 'Dash, Hide, or Disengage.' }] }) },
      { label: 'bonus action attacks exist', stats: createStats({ attacks: [{ name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' }] }) },
    ])('renders section when $label', ({ stats }) => {
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });

    it('renders section when bonus action spells exist', () => {
      vi.mocked(getBonusActionSpellNames).mockImplementation(() => new Set(['Shocking Grasp']));
      const spell = { name: 'Shocking Grasp', level: 0, range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' };
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [spell] } })} />);
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
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Main Gauche')).toBeInTheDocument();
      expect(screen.getByText('5 ft.')).toBeInTheDocument();
      expect(screen.getByText('1d4+3')).toBeInTheDocument();
      expect(screen.getByText('Piercing')).toBeInTheDocument();
    });

    it('applies exhaustionPenalty to hit bonus display', () => {
      const stats = createStats({ attacks: [bonusActionAttack] });
      render(<CharBonusActions playerStats={stats} exhaustionPenalty={3} />);
      expect(screen.getByText('+2')).toBeInTheDocument();
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

    it.each([
      { bonus: 0, expected: 'DC 14 CON', noHitBonus: true },
      { bonus: 1, expected: 'DC 15 CON', noHitBonus: false },
    ])('displays save DC with sorcery bonus ($bonus)', ({ bonus, expected, noHitBonus }) => {
      vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus: bonus });
      render(<CharBonusActions playerStats={createStats({ attacks: [saveDcAttack] })} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
      if (noHitBonus) {
        expect(screen.queryByText('+5')).not.toBeInTheDocument();
      }
    });
  });

  describe('bonus action descriptions rendering', () => {
    it('renders bonus action with clickable name when it has details', () => {
      const bonusActionDesc = {
        name: 'Cunning Action',
        description: 'You can take a bonus action.',
        details: 'Dash, Hide, or Disengage.',
      };
      render(<CharBonusActions playerStats={createStats({ bonusActions: [bonusActionDesc] })} />);
      expect(screen.getByText(/Cunning Action:/)).toBeInTheDocument();
      expect(screen.getByText(/You can take a bonus action/)).toBeInTheDocument();
    });
  });

  describe('2024 rules rendering', () => {
    const bonusActionAttack = { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' };

    it('shows Mastery column header for 2024 rules with weapon_kind_mastery passive', () => {
      render(<CharBonusActions playerStats={createStats({ rules: '2024', attacks: [bonusActionAttack], automation: { passives: [{ type: 'weapon_kind_mastery', name: 'Weapon Kind Mastery' }] } })} getWeaponMastery={() => null} />);
      expect(screen.getByText('Mastery')).toBeInTheDocument();
    });

    it('does not show Mastery column when 2024 rules but no weapon_kind_mastery passive', () => {
      render(<CharBonusActions playerStats={createStats({ rules: '2024', attacks: [bonusActionAttack], automation: { passives: [] } })} getWeaponMastery={() => null} />);
      expect(screen.queryByText('Mastery')).not.toBeInTheDocument();
    });
  });

  describe('bonus action attack attack level display', () => {
    it('shows Cantrip for level 0 attacks', () => {
      const stats = createStats({
        attacks: [{ name: 'Minor Illusion Attack', range: 120, hitBonus: 5, damage: '1d8', damageType: 'Psychic', type: 'Bonus Action' }],
        spellAbilities: { toHit: 5, spells: [{ name: 'Minor Illusion Attack', level: 0 }] },
      });
      render(<CharBonusActions playerStats={stats} getWeaponMastery={() => null} />);
      expect(screen.getByText('Cantrip')).toBeInTheDocument();
    });

    it('shows numeric level for higher level attacks', () => {
      const stats = createStats({
        attacks: [{ name: 'Ice Knife', range: 60, hitBonus: 5, damage: '1d10', damageType: 'Cold', type: 'Bonus Action' }],
        spellAbilities: { toHit: 5, spells: [{ name: 'Ice Knife', level: 2 }] },
      });
      render(<CharBonusActions playerStats={stats} getWeaponMastery={() => null} />);
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('bonus action spells - level display', () => {
    it('shows Cantrip for level 0 bonus action spells', () => {
      vi.mocked(getBonusActionSpellNames).mockImplementation(() => new Set(['Shocking Grasp']));
      const spell = { name: 'Shocking Grasp', level: 0, range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' };
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [spell] } })} />);
      expect(screen.getByText('Cantrip')).toBeInTheDocument();
    });

    it('shows numeric level for leveled bonus action spells', () => {
      vi.mocked(getBonusActionSpellNames).mockImplementation(() => new Set(['Hideous Laughter']));
      const spell = { name: 'Hideous Laughter', level: 1, range: '60 ft.', casting_time: '1 bonus action', prepared: 'Prepared' };
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [spell] } })} />);
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  describe('bonus action descriptions - featuresToIgnore filtering', () => {
    it('filters out bonus actions that are in featuresToIgnore list', () => {
      vi.mocked(getCategories).mockReturnValue({ featuresToIgnore: ['Spellcasting'] });
      const bonusActions = [
        { name: 'Spellcasting', description: 'Cast spells.' },
        { name: 'Cunning Action', description: 'Dash, Hide, or Disengage.', details: 'Quick movement.' },
      ];
      render(<CharBonusActions playerStats={createStats({ bonusActions })} />);
      expect(screen.queryByText(/Spellcasting:/)).not.toBeInTheDocument();
      expect(screen.getByText(/Cunning Action:/)).toBeInTheDocument();
    });
  });

  describe('automation badges on bonus actions', () => {
    it('shows pool badge for healing_pool automation', () => {
      vi.mocked(hasAutomation).mockReturnValue(true);
      const bonusAction = {
        name: 'Favored Soul',
        description: 'Healing pool feature.',
        automation: { type: 'healing_pool', pool: 15 },
      };
      render(<CharBonusActions playerStats={createStats({ bonusActions: [bonusAction] })} />);
      expect(screen.getByText(/Pool: 15 HP/)).toBeInTheDocument();
    });

    it('shows damage badge for bonus action with damage', () => {
      vi.mocked(hasAutomation).mockReturnValue(true);
      const bonusAction = {
        name: 'War Priest',
        description: 'Make an attack.',
        automation: { type: 'bonus_action_attack', damage: '1d8+3', damageType: 'Slashing' },
      };
      render(<CharBonusActions playerStats={createStats({ bonusActions: [bonusAction] })} />);
      expect(screen.getByText(/1d8\+3 Slashing/)).toBeInTheDocument();
    });
  });

});
