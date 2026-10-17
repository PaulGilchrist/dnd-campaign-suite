// @maintained-by-ai
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';
import { showWeaponMasteryPopup } from '../../hooks/combat/useActionPopup.js';

const _syncedStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getStore: vi.fn(() => _syncedStore),
  useSyncedState: vi.fn((_, key, defaultValue) => {
    const hasValue = _syncedStore.has(key);
    const value = hasValue ? _syncedStore.get(key) : defaultValue;
    const setter = vi.fn((newValue) => { _syncedStore.set(key, newValue); });
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
    popupHtml: null, setPopupHtml: vi.fn(), rollAttack: vi.fn(), rollDamage: vi.fn(),
    rollSkillCheck: vi.fn(), rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
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
  computeFeatRangeEffects: vi.fn(() => Promise.resolve(null)),
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

const longsword = { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action', weaponType: 'melee' };

function charismaStats(bonus) {
  return createStats({
    attacks: [longsword],
    abilities: [{ name: 'STR', bonus: 3 }, { name: 'Charisma', bonus }],
  });
}

describe('CharActions attack row display (sacred weapon, mastery, save DC, penalties)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
    getRuntimeValue.mockImplementation(() => null);
    hasAutomation.mockImplementation(() => false);
  });

  describe('sacred weapon hit bonus', () => {
    it('boosts melee hit bonus by Charisma and shows the breakdown tooltip when buff is active', async () => {
      mockRuntimeValues([{ effect: 'sacred_weapon' }]);

      await act(async () => { render(<CharActions playerStats={charismaStats(4)} />); });

      const hit = screen.getByText('+9');
      expect(hit).toHaveAttribute('title', 'Base: +5, Sacred Weapon: +4');
    });

    it.each([
      { name: 'ranged attack with buff active', buffs: [{ effect: 'sacred_weapon' }],
        attack: { name: 'Shortbow', range: 80, hitBonus: 5, damage: '1d6+3', damageType: 'Piercing', type: 'Action', weaponType: 'ranged' } },
      { name: 'melee attack without the buff', buffs: [], attack: longsword },
    ])('leaves hit bonus untouched for $name', async ({ buffs, attack }) => {
      mockRuntimeValues(buffs);

      const stats = createStats({
        attacks: [attack],
        abilities: [{ name: 'STR', bonus: 3 }, { name: 'Charisma', bonus: 4 }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });

      const hit = screen.getByText('+5');
      expect(hit).not.toHaveAttribute('title');
    });

    it('applies a minimum +1 bonus when the Charisma modifier is negative', async () => {
      mockRuntimeValues([{ effect: 'sacred_weapon' }]);

      await act(async () => { render(<CharActions playerStats={charismaStats(-2)} />); });

      const hit = screen.getByText('+6');
      expect(hit).toHaveAttribute('title', 'Base: +5, Sacred Weapon: +1');
    });

    it('folds the exhaustion penalty into the sacred-weapon-boosted total', async () => {
      mockRuntimeValues([{ effect: 'sacred_weapon' }]);

      // Base 5 + sacred weapon 4 = 9, minus exhaustion 2 = 7
      await act(async () => { render(<CharActions playerStats={charismaStats(4)} exhaustionPenalty={2} />); });

      expect(screen.getByText('+7')).toBeInTheDocument();
    });
  });

  describe('2024 mastery column', () => {
    it('renders the Mastery header and the attack mastery name as a clickable cell that opens the popup', async () => {
      mockRuntimeValues();

      const stats = createStats({
        rules: '2024',
        attacks: [{ ...longsword, mastery: 'Vex' }],
        automation: { passives: [{ type: 'weapon_kind_mastery' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });

      expect(screen.getByText('Mastery')).toBeInTheDocument();
      const cell = screen.getByText('Vex');
      expect(cell).toHaveClass('clickable');

      fireEvent.click(cell);
      expect(showWeaponMasteryPopup).toHaveBeenCalledWith('Vex', expect.anything());
    });
  });

  it('shows the save DC instead of a hit bonus for save-based attacks', async () => {
    mockRuntimeValues();

    const stats = createStats({
      attacks: [{ name: 'Witch Bolt', range: 60, saveDc: 14, saveType: 'CON', damage: '1d12', damageType: 'Lightning', type: 'Action' }],
    });
    await act(async () => { render(<CharActions playerStats={stats} />); });

    expect(screen.getByText(/DC 14 CON/)).toBeInTheDocument();
    expect(screen.queryByText('+5')).not.toBeInTheDocument();
  });

  describe('hit cell penalty states', () => {
    it.each([
      { name: 'exhaustion', props: { exhaustionPenalty: 2 }, text: '+3', classes: ['stat--penalized'] },
      { name: 'disadvantage', props: { conditionAttackMode: 'disadvantage' }, text: '+5', classes: ['stat--penalized'] },
      { name: 'cannotAct', props: { cannotAct: true }, text: '+5', classes: ['stat--penalized', 'disabled-attack'] },
    ])('marks the hit cell penalized for $name', async ({ props, text, classes }) => {
      await act(async () => { render(<CharActions playerStats={createStats({ attacks: [longsword] })} {...props} />); });

      const cell = screen.getByText(text);
      classes.forEach(cls => expect(cell).toHaveClass(cls));
      if (!classes.includes('disabled-attack')) {
        expect(cell).not.toHaveClass('disabled-attack');
      }
    });
  });
});
