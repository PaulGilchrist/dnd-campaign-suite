// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { useActionSpellMetamagic } from '../../hooks/combat/useActionSpellMetamagic.js';

const _syncedStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getStore: vi.fn(() => _syncedStore),
  useSyncedState: vi.fn((_, key, defaultValue) => {
    const hasValue = _syncedStore.has(key);
    const value = hasValue ? _syncedStore.get(key) : defaultValue;
    const setter = vi.fn((newValue) => {
      _syncedStore.set(key, newValue);
    });
    return [value, setter];
  }),
  useRuntimeValue: vi.fn((_, key, _campaignName) => {
    const hasValue = _syncedStore.has(key);
    return hasValue ? _syncedStore.get(key) : null;
  }),
  listeners: new Map(),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null, setPopupHtml: vi.fn(), rollAttack: vi.fn(), rollDamage: vi.fn(), rollSkillCheck: vi.fn(), rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
  collectWeaponMastery: vi.fn(() => ({ baseMastery: null, extraMasteries: [] })),
  evaluateAutoExpression: vi.fn(() => null),
}));

vi.mock('../../hooks/combat/useActionSpellMetamagic.js', () => ({
  useActionSpellMetamagic: vi.fn(() => ({
    pendingActionMetamagic: null, handleActionMetamagicConfirm: vi.fn(), handleActionMetamagicSkip: vi.fn(),
    handleActionSpellDamageClick: vi.fn(), handleSpellAttackClick: vi.fn(), handleSpellDamageClick: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn((entity) => {
    if (entity.details) return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    return null;
  }),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null, gateMetamagic: vi.fn(), handleConfirm: vi.fn(), handleSkip: vi.fn(),
    pendingAid: null, handleAidConfirm: vi.fn(), handleAidSkip: vi.fn(),
    pendingGreaterRestoration: null, handleGreaterRestorationConfirm: vi.fn(), handleGreaterRestorationSkip: vi.fn(),
    pendingRemoveCurse: null, handleRemoveCurseConfirm: vi.fn(), handleRemoveCurseSkip: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({ buildUpcastLevels: vi.fn(() => []) })),
}));

vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(() => ({ saveDcBonus: 0 })),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 1),
  getActiveCreatureName: vi.fn(() => 'TestCharacter'),
  loadCombatSummary: vi.fn(() => Promise.resolve({ lastAttack: null })),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn((name) => ({ baseName: name })),
}));

vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({ maxFocusPoints: 2 })),
}));

vi.mock('../../services/character/featRangeService.js', () => ({
  computeFeatRangeEffects: vi.fn(() => Promise.resolve({ rangeBonus: 5 })),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [3, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 10, rolls: [3, 2, 3, 2], modifier: 0 })),
}));

vi.mock('../../services/rules/features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('./useInitiativeEffects.js', () => ({
  default: vi.fn(),
}));

vi.mock('./CharBonusActions.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-bonus-actions">CharBonusActions</div>),
}));

vi.mock('./CharActionModals.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-action-modals">CharActionModals</div>),
}));

vi.mock('./CharActionSpellPopups.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-action-spell-popups">CharActionSpellPopups</div>),
}));

vi.mock('./useCharActionModals.js', () => ({
  default: vi.fn(() => ({
    pendingDamage: null, modalState: {}, setModalState: vi.fn(),
    resolveAttackDamage: vi.fn(), handleMasteryClose: vi.fn(), handleWeaponMasteryChoice: vi.fn(),
    handleWeaponKindMasteryClose: vi.fn(), handleDivineFuryDamageType: vi.fn(), handleDivineFurySkip: vi.fn(),
    handleGenericDamageTypeChoice: vi.fn(), handleGenericDamageTypeSkip: vi.fn(),
    handleDamageTypeModifierChoice: vi.fn(), handleDamageTypeModifierSkip: vi.fn(),
    handleEnhancedUnarmedChoice: vi.fn(), handleEnhancedUnarmedSkip: vi.fn(),
    handleFeatureChoiceConfirm: vi.fn(), handleFeatureChoiceSkip: vi.fn(),
    handleConstellationSelect: vi.fn(),
    combatSuperiorityModal: null, setCombatSuperiorityModal: vi.fn(),
    handleCombatSuperiorityConfirm: vi.fn(), handleAttackRiderManeuverUse: vi.fn(), handleAttackRiderManeuverSkip: vi.fn(),
  })),
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="secondary-target-modal">SecondaryTargetModal</div>),
}));

vi.mock('./modals/TacticalMasterModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="tactical-master-modal">TacticalMasterModal</div>),
}));

vi.mock('../../services/automation/handlers/combat/weaponMasteryHandler.js', () => ({
  applyMasteryEffect: vi.fn(() => Promise.resolve()),
}));

vi.mock('./useAttackDamageResolution.js', () => ({
  normalizeAutoDamage: vi.fn((autoDamage) => ({ attack: autoDamage, ctxOverrides: {} })),
}));

vi.mock('../../services/automation/contextBuilder.js', () => ({
  buildAttackContext: vi.fn(() => Promise.resolve({ hitBonus: 5 })),
  buildAttackContextSync: vi.fn(() => ({ hitBonus: 5 })),
}));

vi.mock('../../services/rules/core/spellDamageUtils.js', () => ({
  resolveSpellDamageAtLevel: vi.fn((spell) => {
    if (spell?.damage && typeof spell.damage === 'object') return spell.damage.amount || '';
    if (spell?.damage && typeof spell.damage === 'string' && spell.damage !== 'Utility') return spell.damage;
    return '';
  }),
  isAutoHitSpell: vi.fn((spell) => !!spell?.dc),
  resolveHealExpression: vi.fn((_spell, _level, mod) => `1d4+${mod ?? 0}`),
}));

vi.mock('../../services/ui/formatUtils.js', () => ({
  formatRange: vi.fn((range) => range || ''),
  signFormatter: new Intl.NumberFormat('en-US', { signDisplay: 'always' }),
  getAttackSpellLevel: vi.fn((spellAbilities, attackName) => {
    if (!spellAbilities?.spells) return null;
    const spell = spellAbilities.spells.find(s => s.name === attackName);
    return spell ? spell.level : null;
  }),
}));

vi.mock('../../services/ui/spellSectionUtils.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getActionSpellNames: vi.fn((playerStats) => {
    const names = new Set();
    for (const spell of playerStats.spellAbilities?.spells || []) {
      if (spell.casting_time === '1 action' && (spell.prepared === 'Always' || spell.prepared === 'Prepared')) {
        if (spell.damage || spell.heal_at_slot_level) {
          names.add(spell.name);
        }
      }
    }
    return names;
  }),
}));

// --- Helpers ---

const basePlayerStats = {
  name: 'TestCharacter', rules: '5e', level: 5, attacks: [], actions: [],
  spellAbilities: { spells: [], toHit: 5, saveDc: 13 },
  abilities: [{ name: 'STR', bonus: 3 }], proficiency: 3,
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

function mockRuntimeValues(buffs = [], conditions = []) {
  getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'activeBuffs') return buffs;
    if (key === 'hasteExtraActionUsed') return false;
    if (key === 'activeConditions') return conditions;
    return null;
  });
}

// --- Tests ---

describe('CharActions spell rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(['Hide', 'Dash', 'Disengage', 'Dodge', 'Grapple']) });
    getRuntimeValue.mockImplementation(() => null);
  });

  describe('spell rendering in actions section', () => {
    it('renders spells with correct name, level, and damage columns', async () => {
      mockRuntimeValues();

      const stats = createStats({
        spellAbilities: {
          spells: [
            { name: 'Fireball', level: 3, range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
            { name: 'Fire Bolt', level: 0, range: '120 ft', casting_time: '1 action', prepared: 'Prepared', damage: '1d10' },
          ],
          toHit: 5,
          saveDc: 15,
        },
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      expect(screen.getByText('Fireball')).toBeInTheDocument();
      expect(screen.getByText('8d6')).toBeInTheDocument();
      expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
      expect(screen.getByText('Cantrip')).toBeInTheDocument();
    });

    it.each([
      { spellName: 'Cure Wounds', level: 1, heal_at_slot_level: true, expectedType: 'Healing' },
      { spellName: 'Minor Illusion', level: 0, damage: 'Utility', expectedType: 'Utility' },
    ])('renders $spellName with "$expectedType" type label', async ({ spellName, level, heal_at_slot_level, damage, expectedType }) => {
      mockRuntimeValues();

      const stats = createStats({
        spellAbilities: {
          spells: [
            { name: spellName, level, range: 'Touch', casting_time: '1 action', prepared: 'Prepared', heal_at_slot_level, damage },
          ],
          toHit: 5,
          saveDc: 13,
        },
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      expect(screen.getByText(spellName)).toBeInTheDocument();
      expect(screen.getByText(expectedType)).toBeInTheDocument();
    });

    it('renders damage type from structured damage object', async () => {
      mockRuntimeValues();

      const stats = createStats({
        spellAbilities: {
          spells: [
            { name: 'Fireball', level: 3, range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: { amount: '8d6', damage_type: 'Fire' } },
          ],
          toHit: 5,
          saveDc: 15,
        },
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      expect(screen.getByText('Fire')).toBeInTheDocument();
    });
  });

  describe('hit column behavior', () => {
    it('shows empty hit column for auto-hit spells and spells without attack_type', async () => {
      mockRuntimeValues();

      const stats = createStats({
        spellAbilities: {
          spells: [
            { name: 'Ray of Sickness', level: 1, range: '60 ft', casting_time: '1 action', prepared: 'Prepared', damage: '2d8', dc: { dc_type: 'CON', dc_success: 'half' } },
            { name: 'Magic Missile', level: 1, range: '120 ft', casting_time: '1 action', prepared: 'Prepared', damage: '4d4+4' },
          ],
          toHit: 5,
          saveDc: 13,
        },
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      expect(screen.queryByText('+5')).not.toBeInTheDocument();
    });
  });

  describe('spell attack/damage click handlers', () => {
    it('calls resolveSpellDamage when damage is clicked for save-DC spell attack', async () => {
      const mockResolveSpellDamage = vi.fn();
      getRuntimeValue.mockReturnValue(null);

      useActionSpellMetamagic.mockReturnValue({
        pendingActionMetamagic: null,
        handleActionMetamagicConfirm: vi.fn(),
        handleActionMetamagicSkip: vi.fn(),
        handleActionSpellDamageClick: mockResolveSpellDamage,
        handleSpellAttackClick: vi.fn(),
      });

      const stats = createStats({
        attacks: [{ name: 'Witch Bolt', range: 60, saveDc: 14, saveType: 'CON', damage: '1d12', damageType: 'Lightning', type: 'Action' }],
      });

      await act(async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
        render(<CharActions playerStats={stats} />);
      });

      const damageElement = screen.getByText('1d12');
      await act(async () => { fireEvent.click(damageElement); });

      expect(mockResolveSpellDamage).toHaveBeenCalledWith(stats.attacks[0]);
    });

    it('calls handleSpellAttackClick for spell attacks with attack_type', async () => {
      const mockHandleSpellAttackClick = vi.fn();

      useActionSpellMetamagic.mockReturnValue({
        pendingActionMetamagic: null,
        handleActionMetamagicConfirm: vi.fn(),
        handleActionMetamagicSkip: vi.fn(),
        handleActionSpellDamageClick: vi.fn(),
        handleSpellAttackClick: mockHandleSpellAttackClick,
      });

      const stats = createStats({
        spellAbilities: {
          spells: [
            { name: 'Fire Bolt', level: 0, range: '120 ft', casting_time: '1 action', prepared: 'Prepared', damage: '1d10', attack_type: 'ranged' },
          ],
          toHit: 5,
          saveDc: 13,
        },
      });

      await act(async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
        render(<CharActions playerStats={stats} />);
      });

      const attackEl = screen.getByText('+5');
      await act(async () => { fireEvent.click(attackEl); });

      expect(mockHandleSpellAttackClick).toHaveBeenCalled();
    });
  });
});
