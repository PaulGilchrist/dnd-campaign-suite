// @maintained-by-ai 2026-11-27
// CharActions attack-row hit-cell lane: sacred weapon bonus display (buff-gated
// Charisma boost on melee/unarmed rows with its breakdown tooltip, +1 floor,
// exhaustion folded after the boost), the 2024 mastery column cell contents +
// popup dispatch, the save-DC substitution for save-based attacks, and hit-cell
// penalty classes. Pinned here per the CharActions.rendering.test.jsx delegation
// header; the mastery column's enable gating (rules + passive) is pinned
// stronger there, and the exact happy-path roll bytes live in that rendering
// lane — this file never restates them. The Sacred Weapon picker modal UI is
// owned by modals/divine/SacredWeaponModal.test.jsx.
// Mock hygiene (events-lane recipe, run2 #1853/#1855): the phantom
// `useSyncedState` export and its hand-rolled store mirror are deleted from the
// useRuntimeState.js mock — the real module exports no such symbol, and the
// phantom was UNREACHABLE dead mock code (CharActions.jsx imports the real hook
// from useSyncedState.js, which is not mocked). The real useSyncedState.js runs
// over the complete mocked primitive set (getRuntimeValue/setRuntimeValue/
// getStore/useRuntimeValue/listeners).
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';
import { showWeaponMasteryPopup } from '../../hooks/combat/useActionPopup.js';

const CAMPAIGN = 'test-campaign';

// Shared backing Map: the real useSyncedState.js reads/writes it through the
// mocked getStore/setRuntimeValue primitives; the mocked useRuntimeValue reads
// the same keys. No test seeds it — the store fixture just keeps the real hook
// inert; buffs are seeded through the getRuntimeValue mock below.
const _syncedStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getStore: vi.fn(() => _syncedStore),
  useRuntimeValue: vi.fn((_, key) => (_syncedStore.has(key) ? _syncedStore.get(key) : null)),
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

const basePlayerStats = {
  name: 'TestCharacter', rules: '5e', level: 5, attacks: [], actions: [],
  spellAbilities: { spells: [], toHit: 5, saveDc: 13 },
  abilities: [{ name: 'STR', bonus: 3 }], proficiency: 3,
};

const longsword = { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action', weaponType: 'melee' };
const unarmedStrike = { name: 'Unarmed Strike', range: 5, hitBonus: 5, damage: '1d6+3', damageType: 'Bludgeoning', type: 'Action', weaponType: 'unarmed' };

// Melee/unarmed fixture with an explicit Charisma entry on the given weapon(s).
function charismaStats(bonus, attacks = [longsword]) {
  return {
    ...basePlayerStats,
    attacks,
    abilities: [{ name: 'STR', bonus: 3 }, { name: 'Charisma', bonus }],
  };
}

function setBuffs(buffs) {
  getRuntimeValue.mockImplementation((_name, key) => (key === 'activeBuffs' ? buffs : null));
}

async function renderCharActions(stats, props = {}) {
  let result;
  await act(async () => {
    result = render(<CharActions playerStats={stats} campaignName={CAMPAIGN} {...props} />);
  });
  return result;
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
    it.each([
      { weapon: longsword },
      { weapon: unarmedStrike },
    ])('boosts $weapon.name hit bonus by Charisma and shows the breakdown tooltip when the buff is active', async ({ weapon }) => {
      setBuffs([{ effect: 'sacred_weapon' }]);

      await renderCharActions(charismaStats(4, [weapon]));

      const hit = screen.getByText('+9');
      expect(hit).toHaveAttribute('title', 'Base: +5, Sacred Weapon: +4');
      // campaign threading uses the real prop value, not an undefined-arg pin
      expect(getRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'activeBuffs', CAMPAIGN);
    });

    it.each([
      { name: 'ranged attack with buff active', buffs: [{ effect: 'sacred_weapon' }],
        attack: { name: 'Shortbow', range: 80, hitBonus: 5, damage: '1d6+3', damageType: 'Piercing', type: 'Action', weaponType: 'ranged' } },
      { name: 'melee attack without the buff', buffs: [], attack: longsword },
    ])('leaves hit bonus untouched for $name', async ({ buffs, attack }) => {
      setBuffs(buffs);

      await renderCharActions(charismaStats(4, [attack]));

      const hit = screen.getByText('+5');
      expect(hit).not.toHaveAttribute('title');
    });

    it('applies a minimum +1 bonus when the Charisma modifier is negative', async () => {
      setBuffs([{ effect: 'sacred_weapon' }]);

      await renderCharActions(charismaStats(-2));

      const hit = screen.getByText('+6');
      expect(hit).toHaveAttribute('title', 'Base: +5, Sacred Weapon: +1');
    });

    it('folds the exhaustion penalty into the boosted total without touching the breakdown tooltip', async () => {
      setBuffs([{ effect: 'sacred_weapon' }]);

      // Base 5 + sacred weapon 4 = 9, minus exhaustion 2 = 7
      await renderCharActions(charismaStats(4), { exhaustionPenalty: 2 });

      const hit = screen.getByText('+7');
      expect(hit).toHaveAttribute('title', 'Base: +5, Sacred Weapon: +4');
    });
  });

  describe('2024 mastery column cells', () => {
    it.each([
      { mastery: 'Vex', clickable: true },
      { mastery: undefined, clickable: false },
    ])('renders the mastery cell clickable=$clickable (mastery=$mastery)', async ({ mastery, clickable }) => {
      const stats = {
        ...basePlayerStats,
        rules: '2024',
        attacks: [{ ...longsword, mastery }],
        automation: { passives: [{ type: 'weapon_kind_mastery' }] },
      };
      const { container } = await renderCharActions(stats);

      expect(screen.getByText('Mastery')).toBeInTheDocument();
      // The attacks grid is flat (fragments, no row wrapper): 7 header cells,
      // then the attack row's 7 cells — the mastery cell is index 13.
      const cell = container.querySelectorAll('.attacks > div')[13];
      if (clickable) {
        expect(cell).toHaveClass('clickable');
        expect(cell).toHaveTextContent('Vex');
        fireEvent.click(cell);
        expect(showWeaponMasteryPopup).toHaveBeenCalledTimes(1);
        expect(showWeaponMasteryPopup).toHaveBeenCalledWith('Vex', expect.any(Function));
      } else {
        expect(cell).not.toHaveClass('clickable');
        expect(cell).toBeEmptyDOMElement();
        fireEvent.click(cell);
        expect(showWeaponMasteryPopup).not.toHaveBeenCalled();
      }
    });
  });

  it('shows the save DC instead of a hit bonus for save-based attacks', async () => {
    const stats = {
      ...basePlayerStats,
      attacks: [{ name: 'Witch Bolt', range: 60, saveDc: 14, saveType: 'CON', damage: '1d12', damageType: 'Lightning', type: 'Action' }],
    };
    await renderCharActions(stats);

    expect(screen.getByText(/DC 14 CON/)).toBeInTheDocument();
    expect(screen.queryByText('+5')).not.toBeInTheDocument();
  });

  describe('hit cell penalty states', () => {
    it.each([
      { name: 'exhaustion', props: { exhaustionPenalty: 2 }, text: '+3', classes: ['stat--penalized'] },
      { name: 'disadvantage', props: { conditionAttackMode: 'disadvantage' }, text: '+5', classes: ['stat--penalized'] },
      { name: 'cannotAct', props: { cannotAct: true }, text: '+5', classes: ['stat--penalized', 'disabled-attack'] },
    ])('marks the hit cell penalized for $name', async ({ props, text, classes }) => {
      await renderCharActions({ ...basePlayerStats, attacks: [longsword] }, props);

      const cell = screen.getByText(text);
      classes.forEach(cls => expect(cell).toHaveClass(cls));
      if (!classes.includes('disabled-attack')) {
        expect(cell).not.toHaveClass('disabled-attack');
      }
    });
  });
});
