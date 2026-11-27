// @maintained-by-ai 2026-11-27
// CharActions spell-DISPLAY lane: the resolved damage/heal formula cells in the
// action bar (heal-modifier threading, Potent Spellcasting cantrip boost and its
// cantrip-only guard, utility-spell omission) plus feature-row DC/damage badges.
// Deliberately NOT covered here (pinned by siblings):
// - row columns, cell clickability, hit/damage-cell dispatch → CharActions.spellRendering.test.jsx
// - metamagic/popup event-bus behaviour → CharActions.events.test.jsx
// Mock hygiene (events-lane recipe, run2 #1853/#1855): the REAL useSyncedState.js
// runs against the mocked useRuntimeState.js primitives (getStore/
// setRuntimeValue/listeners) — the phantom `useSyncedState` export previously
// mocked ON useRuntimeState.js is deleted (that module does not export it, and
// CharActions imports the hook from useSyncedState.js; #1869 empirically
// confirmed the phantom was unreachable dead mock code), and with it the
// hand-rolled store mirror. Real spellSectionUtils/formatUtils render the row
// set and labels (no mirrors).
import { render, screen, act } from '@testing-library/react';
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
    popupHtml: null, setPopupHtml: vi.fn(), rollAttack: vi.fn(), rollDamage: vi.fn(),
    rollSkillCheck: vi.fn(), rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn((action) => !!action?.automation),
  collectWeaponMastery: vi.fn(() => ({ baseMastery: null, extraMasteries: [] })),
  evaluateAutoExpression: vi.fn(() => null),
}));

vi.mock('../../hooks/combat/useActionSpellMetamagic.js', () => ({
  useActionSpellMetamagic: vi.fn(metamagicDefaults),
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

vi.mock('../../services/rules/core/spellDamageUtils.js', () => ({
  resolveSpellDamageAtLevel: vi.fn((spell) => {
    if (spell?.damage && typeof spell.damage === 'string') return spell.damage;
    return '';
  }),
  isAutoHitSpell: vi.fn(() => false),
  resolveHealExpression: vi.fn((_spell, _level, mod) => `1d4+${mod ?? 0}`),
}));

// --- Helpers ---

const basePlayerStats = {
  name: 'TestCharacter', rules: '5e', level: 5, attacks: [], actions: [],
  spellAbilities: { spells: [], toHit: 5, saveDc: 13, prepared: [], modifier: 2 },
  abilities: [{ name: 'STR', bonus: 3 }, { name: 'Wisdom', bonus: 2 }], proficiency: 3,
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

function statsWithSpells(spells, overrides = {}) {
  return createStats({
    ...overrides,
    spellAbilities: { ...basePlayerStats.spellAbilities, ...overrides.spellAbilities, spells },
  });
}

async function renderActions(stats, campaignName = undefined) {
  globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
  await act(async () => { render(<CharActions playerStats={stats} campaignName={campaignName} />); });
}

// Potent Spellcasting feature as authored on real character data (2024 Cleric cantrip bonus).
const potentSpellcastingFeature = { type: 'damage_bonus', name: 'Potent Spellcasting', options: ['Spellcasting Ability', 'Wisdom'], upgrades: false };

// --- Tests ---

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  _syncedStore.clear();
  getRuntimeValue.mockReturnValue(null);
  useActionSpellMetamagic.mockReturnValue(metamagicDefaults());
  useSpellMetamagicFlow.mockReturnValue(flowDefaults());
});

describe('CharActions action spell bar', () => {
  it('shows the resolved heal formula with the caster spellcasting modifier for healing action spells', async () => {
    await renderActions(statsWithSpells(
      [{ name: 'Healing Word', level: 1, heal_at_slot_level: true, casting_time: '1 action', prepared: 'Prepared' }],
      { spellAbilities: { toHit: 5, saveDc: 13, modifier: 2 } },
    ));

    expect(screen.getByText('Healing Word')).toBeInTheDocument();
    expect(screen.getByText('1d4+2')).toBeInTheDocument();
  });

  it('omits action spells that deal neither damage nor healing', async () => {
    await renderActions(statsWithSpells(
      [{ name: 'Minor Illusion', level: 0, casting_time: '1 action', prepared: 'Always' }],
    ));

    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.queryByText('Minor Illusion')).not.toBeInTheDocument();
  });

  // Potent Spellcasting at the display seam: boost applies to cantrips only, and
  // only once a Spellcasting-Ability option is chosen. Cell clickability is
  // pinned by spellRendering's row-column/dispatch tests, not restated here.
  it.each([
    {
      label: 'adds the Wis bonus to cantrip damage when Spellcasting Ability is chosen',
      spell: { name: 'Burning Hands', level: 0, damage: '1d6', casting_time: '1 action', prepared: 'Prepared' },
      chosenOption: 'Spellcasting Ability', expectedText: '1d6+2', absentText: null,
    },
    {
      label: 'leaves cantrip damage unmodified until an option is chosen',
      spell: { name: 'Burning Hands', level: 0, damage: '1d6', casting_time: '1 action', prepared: 'Prepared' },
      chosenOption: null, expectedText: '1d6', absentText: '1d6+2',
    },
    {
      label: 'never boosts leveled spell damage (cantrip-only guard)',
      spell: { name: 'Fireball', level: 3, range: '150 ft', damage: '8d6', casting_time: '1 action', prepared: 'Prepared' },
      // Bonus is fully opted-in (Wis 2) — if it leaked past the cantrip-only
      // guard the cell would read 8d6+2.
      chosenOption: 'Spellcasting Ability', expectedText: '8d6', absentText: '8d6+2',
    },
  ])('Potent Spellcasting: $label', async ({ spell, chosenOption, expectedText, absentText }) => {
    getRuntimeValue.mockImplementation((_name, key) => (key === '_Potent_Spellcasting_option' ? chosenOption : null));

    await renderActions(statsWithSpells([spell], { automation: { actions: [potentSpellcastingFeature] } }));

    expect(screen.getByText(expectedText)).toBeInTheDocument();
    if (absentText) {
      expect(screen.queryByText(absentText)).not.toBeInTheDocument();
    }
  });
});

describe('CharActions automation feature-row badges', () => {
  it.each([
    {
      label: 'shows numeric save DC and damage badges',
      automation: { type: 'save_attack', saveDc: 15, saveType: 'CHA', damage: '2d6', damageType: 'Fire' },
      expectedBadges: [/DC 15 CHA/, /2d6 Fire/],
    },
    {
      label: "resolves the 'ability' save DC placeholder to the caster's spell save DC",
      automation: { type: 'save_attack', saveDc: 'ability', saveType: 'CON' },
      expectedBadges: [/DC 13 CON/],
    },
    {
      label: 'renders no badge for automations without a save DC or damage',
      automation: { type: 'combat_stance' },
      expectedBadges: [],
    },
  ])('$label', async ({ automation, expectedBadges }) => {
    const stats = createStats({
      actions: [{ name: 'Feature Action', description: 'Do the thing.', automation }],
    });

    await renderActions(stats, 'test-campaign');

    expect(screen.getByText(/Feature Action:/)).toBeInTheDocument();
    for (const badge of expectedBadges) {
      expect(screen.getByText(badge)).toBeInTheDocument();
    }
    if (expectedBadges.length === 0) {
      expect(screen.queryByText(/DC \d/)).not.toBeInTheDocument();
    }
  });
});
