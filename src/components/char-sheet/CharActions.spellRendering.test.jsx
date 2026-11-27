// @maintained-by-ai 2026-11-27
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { useActionSpellMetamagic } from '../../hooks/combat/useActionSpellMetamagic.js';
import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js';

// Default hook returns, re-seeded every beforeEach (clearAllMocks does not drop
// mockReturnValue overrides, so per-test seams must not leak). Hoisted so the
// vi.mock factories can share them with the test body.
const { metamagicDefaults, flowDefaults } = vi.hoisted(() => ({
  metamagicDefaults: () => ({
    pendingActionMetamagic: null, handleActionMetamagicConfirm: vi.fn(), handleActionMetamagicSkip: vi.fn(),
    handleActionSpellDamageClick: vi.fn(), handleSpellAttackClick: vi.fn(), handleSpellDamageClick: vi.fn(),
  }),
  flowDefaults: () => ({
    pendingMetamagic: null, gateMetamagic: vi.fn(), handleConfirm: vi.fn(), handleSkip: vi.fn(),
    pendingAid: null, handleAidConfirm: vi.fn(), handleAidSkip: vi.fn(),
    pendingGreaterRestoration: null, handleGreaterRestorationConfirm: vi.fn(), handleGreaterRestorationSkip: vi.fn(),
    pendingRemoveCurse: null, handleRemoveCurseConfirm: vi.fn(), handleRemoveCurseSkip: vi.fn(),
  }),
}));

// Shared backing Map for the real useSyncedState (CharActions imports it from
// useSyncedState.js, which reads getStore/setRuntimeValue/listeners from here).
// No test seeds it — the store fixture just keeps the real hook inert.
const _syncedStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getStore: vi.fn(() => _syncedStore),
  useRuntimeValue: vi.fn(() => null),
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
  useActionSpellMetamagic: vi.fn(metamagicDefaults),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn(() => null),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(flowDefaults),
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

vi.mock('./modals/TacticalMasterModal.jsx', async () => {
  const { createTacticalMasterModalMock } = await import('./CharActions.test-utils.jsx');
  return createTacticalMasterModalMock();
});

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

// Real isAutoHitSpell (heal spells + Magic Missile) so the save-DC hit-cell branch stays
// exercised; only the damage-formula resolvers are stubbed for flat test fixtures.
vi.mock('../../services/rules/core/spellDamageUtils.js', async (importOriginal) => ({
  ...(await importOriginal()),
  resolveSpellDamageAtLevel: vi.fn((spell) => {
    if (spell?.damage && typeof spell.damage === 'object') return spell.damage.amount || '';
    if (spell?.damage && typeof spell.damage === 'string' && spell.damage !== 'Utility') return spell.damage;
    return '';
  }),
  resolveHealExpression: vi.fn((_spell, _level, mod) => `1d4+${mod ?? 0}`),
}));

// Real spellSectionUtils.getActionSpellNames and real formatUtils render the
// row set / labels; only hook-owned services are stubbed above.

// --- Helpers ---

const basePlayerStats = {
  name: 'TestCharacter', rules: '5e', level: 5, attacks: [], actions: [],
  spellAbilities: { spells: [], toHit: 5, saveDc: 13 },
  abilities: [{ name: 'STR', bonus: 3 }], proficiency: 3,
};

function spell(name, overrides = {}) {
  return { name, range: '60 ft', casting_time: '1 action', prepared: 'Prepared', ...overrides };
}

const longsword = { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' };

function statsWithSpells(spells, overrides = {}) {
  return { ...basePlayerStats, ...overrides, spellAbilities: { ...basePlayerStats.spellAbilities, spells, ...overrides.spellAbilities } };
}

async function renderActions(stats) {
  globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
  await act(async () => { render(<CharActions playerStats={stats} />); });
}

// --- Tests ---

describe('CharActions spell rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
    getRuntimeValue.mockReturnValue(null);
    useActionSpellMetamagic.mockReturnValue(metamagicDefaults());
    useSpellMetamagicFlow.mockReturnValue(flowDefaults());
  });

  it('renders spell rows with name, level, range, and damage columns (Cantrip label for level 0)', async () => {
    await renderActions(statsWithSpells([
      spell('Fireball', { level: 3, range: '150 ft', damage: '8d6' }),
      spell('Fire Bolt', { level: 0, range: '120 ft', damage: '1d10' }),
    ]));

    expect(screen.getByText('Fireball')).toHaveClass('clickable');
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('150 ft.')).toBeInTheDocument();
    expect(screen.getByText('8d6')).toBeInTheDocument();
    expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
    expect(screen.getByText('Cantrip')).toBeInTheDocument();
    expect(screen.getByText('120 ft.')).toBeInTheDocument();
    expect(screen.getByText('1d10')).toBeInTheDocument();
  });

  it.each([
    {
      label: 'shows the damage_type from a structured damage object',
      s: spell('Fireball', { level: 3, damage: { amount: '8d6', damage_type: 'Fire' } }),
      expectedType: 'Fire',
    },
    {
      label: 'shows Healing for heal_at_slot_level spells',
      s: spell('Cure Wounds', { level: 1, heal_at_slot_level: true }),
      expectedType: 'Healing',
    },
    {
      label: 'shows Utility for non-damage cantrips',
      s: spell('Minor Illusion', { level: 0, damage: 'Utility' }),
      expectedType: 'Utility',
    },
  ])('Type column: $label', async ({ s, expectedType }) => {
    await renderActions(statsWithSpells([s]));

    expect(screen.getByText(s.name)).toBeInTheDocument();
    expect(screen.getByText(expectedType)).toBeInTheDocument();
    if (expectedType === 'Fire') {
      // The amount from the structured object must land in the damage column.
      expect(screen.getByText('8d6')).toBeInTheDocument();
    }
  });

  it.each([
    {
      label: 'attack cantrip shows clickable attack bonus that dispatches handleSpellAttackClick',
      s: spell('Fire Bolt', { level: 0, attack_type: 'ranged', damage: '1d10' }),
      expectedHit: '+5',
      clickable: true,
    },
    {
      label: 'save-DC spell shows the caster DC instead of an attack bonus',
      s: spell('Ray of Sickness', { level: 1, damage: '2d8', dc: { dc_type: 'CON', dc_success: 'half' } }),
      expectedHit: 'DC 13 CON',
      clickable: false,
    },
    {
      label: 'auto-hit spell (Magic Missile) shows an empty hit cell',
      s: spell('Magic Missile', { level: 1, damage: '4d4+4' }),
      expectedHit: null,
      clickable: false,
    },
    {
      label: 'spell without attack_type shows an empty hit cell',
      s: spell('Color Spray', { level: 1, damage: '8d6' }),
      expectedHit: null,
      clickable: false,
    },
  ])('Hit column: $label', async ({ s, expectedHit, clickable }) => {
    const handleSpellAttackClick = vi.fn();
    useActionSpellMetamagic.mockReturnValue({ ...metamagicDefaults(), handleSpellAttackClick });

    await renderActions(statsWithSpells([s]));

    if (expectedHit) {
      const hitCell = screen.getByText(expectedHit);
      if (clickable) {
        expect(hitCell).toHaveClass('clickable');
        await act(async () => { fireEvent.click(hitCell); });
        expect(handleSpellAttackClick).toHaveBeenCalledTimes(1);
        expect(handleSpellAttackClick).toHaveBeenCalledWith(expect.objectContaining({
          name: s.name, type: 'Action', hitBonus: 5, damage: '1d10',
        }));
      } else {
        expect(hitCell).toHaveClass('save-dc-display');
      }
    } else {
      expect(screen.queryByText('+5')).not.toBeInTheDocument();
      expect(document.querySelector('.save-dc-display')).toBeNull();
    }
  });

  it.each([
    {
      label: 'save-DC spell routes the damage click to resolveSpellDamage with the composed attack item',
      s: spell('Fireball', { level: 3, damage: '8d6', dc: { dc_type: 'CON', dc_success: 'half' } }),
      expectResolve: true,
    },
    {
      label: 'attack spell routes the damage click to the metamagic gate with the authored spell, bypassing resolveSpellDamage',
      s: spell('Fire Bolt', { level: 0, attack_type: 'ranged', damage: '1d10' }),
      expectResolve: false,
    },
  ])('Damage cell dispatch: $label', async ({ s, expectResolve }) => {
    const resolveSpellDamage = vi.fn();
    const gateMetamagic = vi.fn();
    useActionSpellMetamagic.mockReturnValue({ ...metamagicDefaults(), handleActionSpellDamageClick: resolveSpellDamage });
    useSpellMetamagicFlow.mockReturnValue({ ...flowDefaults(), gateMetamagic });

    const stats = statsWithSpells([s]);
    await renderActions(stats);

    await act(async () => { fireEvent.click(screen.getByText(s.damage)); });

    if (expectResolve) {
      // attackItem composition (type/saveDc/saveType/resolved damage) is component-owned.
      expect(resolveSpellDamage).toHaveBeenCalledTimes(1);
      expect(resolveSpellDamage).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Fireball', damage: '8d6', saveDc: 13, saveType: 'CON', type: 'Action',
      }));
      expect(gateMetamagic).not.toHaveBeenCalled();
    } else {
      // The gate receives the raw authored spell object, by identity.
      expect(gateMetamagic).toHaveBeenCalledTimes(1);
      expect(gateMetamagic).toHaveBeenCalledWith(stats.spellAbilities.spells[0], {});
      expect(resolveSpellDamage).not.toHaveBeenCalled();
    }
  });

  it('spell name cells carry the wand-cast affordance; weapon name cells stay bare', async () => {
    await renderActions(statsWithSpells(
      [spell('Fire Bolt', { level: 0, attack_type: 'ranged', damage: '1d10' })],
      { attacks: [longsword] },
    ));

    const spellCell = screen.getByText('Fire Bolt');
    expect(spellCell).toHaveClass('left', 'clickable');
    expect(spellCell).toHaveAttribute('title', 'Open spell details to cast');
    expect(spellCell).toHaveAttribute('data-testid', 'castable-row-fire-bolt');
    const icon = spellCell.querySelector('i.fa-solid.fa-wand-magic-sparkles');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('spell-cast-icon');

    const weaponCell = screen.getByText('Longsword');
    expect(weaponCell.querySelector('i')).toBeNull();
    expect(weaponCell).not.toHaveAttribute('title');
    expect(weaponCell).not.toHaveAttribute('data-testid');
  });

  it('routes a save-DC attack-row damage click to resolveSpellDamage', async () => {
    const resolveSpellDamage = vi.fn();
    useActionSpellMetamagic.mockReturnValue({ ...metamagicDefaults(), handleActionSpellDamageClick: resolveSpellDamage });

    const stats = {
      ...basePlayerStats,
      attacks: [{ name: 'Witch Bolt', range: 60, saveDc: 14, saveType: 'CON', damage: '1d12', damageType: 'Lightning', type: 'Action' }],
    };
    await renderActions(stats);

    await act(async () => { fireEvent.click(screen.getByText('1d12')); });

    expect(resolveSpellDamage).toHaveBeenCalledTimes(1);
    expect(resolveSpellDamage).toHaveBeenCalledWith(expect.objectContaining({ name: 'Witch Bolt', saveDc: 14 }));
  });
});
