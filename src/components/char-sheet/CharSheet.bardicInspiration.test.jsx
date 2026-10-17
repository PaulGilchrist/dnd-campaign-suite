// @maintained-by-ai
// CharSheet UI lane: runtime-driven injection of synthetic Bardic Inspiration
// features into the playerStats handed to CharSpecialActions / CharReactions.
// Grant/eligibility state machine: services/combat/auras/bardicInspirationState.test.js
// Spend handlers + log shapes: CharSheet.featureRiders.test.jsx
// Offer modals/popups: BardicInspirationReactionModal + AttackResultPopup tests.

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSheet from './CharSheet';
import rulesFactory from '../../services/rules/rulesFactory.js';
import {
  createMockStore,
  createDefaultProps,
  createMockPlayerStats,
} from './CharSheet.test-utils.jsx';

// ---------------------------------------------------------------------------
// Mocks — child components (props inspection is the observable surface here)
// ---------------------------------------------------------------------------

vi.mock('./char-summary/CharSummary.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-summary"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharAbilities.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-abilities"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharActions.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-actions"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharInventory.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-inventory"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharReactions.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-reactions"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharSpecialActions.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-special-actions"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharCharacterAdvancement.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-character-advancement"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./char-spells/CharSpells.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-spells"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

// ---------------------------------------------------------------------------
// Mocks — services
// ---------------------------------------------------------------------------

vi.mock('../../services/automation/handlers/shieldOfFaithHandler.js', () => ({
  applyShieldOfFaith: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraComboEffects.js', () => ({
  computeAuraComboEffects: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn().mockReturnValue({
    attackAdvantageCount: 0,
    attackDisadvantageCount: 0,
    autoReroll: false,
    autoRerollCondition: null,
    autoRerollBonus: null,
    cannotAct: false,
  }),
  getNetAttackMode: vi.fn().mockReturnValue('normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn().mockReturnValue({ creatures: [] }),
  loadCombatSummary: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => expr),
}));

vi.mock('../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isCreatureWarded: vi.fn().mockReturnValue(false),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn().mockReturnValue(null),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getProperty: vi.fn().mockResolvedValue(null),
    setProperty: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../common/popup.jsx', () => ({
  default: vi.fn(({ children }) => <div data-testid="popup">{children}</div>),
}));

vi.mock('../common/AttackResultPopup.jsx', () => ({
  default: vi.fn((props) => (
    <div data-testid="attack-result-popup">
      <span>{props.popupHtml?.name || 'Attack'}</span>
    </div>
  )),
}));

// ---------------------------------------------------------------------------
// Mocks — hooks (store passthrough, no business-logic defaults duplicated)
// ---------------------------------------------------------------------------

const mockStore = createMockStore();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => mockStore),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn((key, prop, _camp) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn((_key, _prop, _val, _camp) => mockStore.set(`${_key}:${_prop}`, _val)),
  useRuntimeValue: vi.fn((key, prop) => {
    const defaults = { activeConditions: [], activeBuffs: [], targetEffects: [] };
    const def = Object.prototype.hasOwnProperty.call(defaults, prop) ? defaults[prop] : null;
    return mockStore.get(`${key}:${prop}`) ?? def;
  }),
}));

vi.mock('../../services/rules/rulesFactory.js', () => ({
  default: {
    getPlayerStats: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BI_SPECIAL = 'Use Bardic Inspiration';
const BI_DEFENSE = 'Combat Inspiration - Defense';
const BI_OFFENSE = 'Combat Inspiration - Offense';

const grantBI = ({ die, options, grantedBy }) => {
  if (die != null) mockStore.set('Test Character:bardicInspirationDie', die);
  if (options !== undefined) mockStore.set('Test Character:bardicInspirationCombatOptions', options);
  if (grantedBy !== undefined) mockStore.set('Test Character:bardicInspirationGrantedBy', grantedBy);
};

// Renders CharSheet and returns the feature lists actually delivered to the
// child components (the injection's only observable output).
async function renderAndReadFeatures(stats) {
  vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));
  render(<CharSheet {...createDefaultProps()} />);
  await waitFor(() => {
    expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
  });
  const { default: CharSpecialActions } = await import('./CharSpecialActions.jsx');
  const { default: CharReactions } = await import('./CharReactions.jsx');
  return {
    specialActions: CharSpecialActions.mock.calls.at(-1)[0].playerStats.specialActions || [],
    reactions: CharReactions.mock.calls.at(-1)[0].playerStats.reactions || [],
  };
}

const assertFeature = (feature, { automationType, descriptionIncludes }) => {
  expect(feature.automation.type).toBe(automationType);
  descriptionIncludes.forEach((fragment) => expect(feature.description).toContain(fragment));
};

// ---------------------------------------------------------------------------
// Injection matrix — die presence gates everything; combat options select reactions
// ---------------------------------------------------------------------------

describe('bardic inspiration feature injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it.each([
    {
      label: 'no die granted — fully inert even with combat options set',
      grant: { die: null, options: JSON.stringify(['defense_add_to_ac', 'offense_add_to_damage']) },
      specials: [],
      reactions: [],
    },
    {
      label: 'die granted, options unset',
      grant: { die: 6, options: undefined },
      specials: [{ name: BI_SPECIAL, automationType: 'bardic_inspiration_use', descriptionIncludes: ['1d6', 'Die granted by unknown'] }],
      reactions: [],
    },
    {
      label: 'invalid JSON options fail soft (special survives, no reactions)',
      grant: { die: 6, options: 'not-valid-json' },
      specials: [{ name: BI_SPECIAL, automationType: 'bardic_inspiration_use', descriptionIncludes: ['1d6'] }],
      reactions: [],
    },
    {
      label: 'defense option adds the defense reaction',
      grant: { die: 10, options: JSON.stringify(['defense_add_to_ac']), grantedBy: 'Bard' },
      specials: [{ name: BI_SPECIAL, automationType: 'bardic_inspiration_use', descriptionIncludes: ['1d10', 'Die granted by Bard'] }],
      reactions: [{ name: BI_DEFENSE, automationType: 'bardic_inspiration_defense', descriptionIncludes: ['1d10', ' Reaction ', 'AC'] }],
    },
    {
      label: 'offense option adds the offense reaction',
      grant: { die: 12, options: JSON.stringify(['offense_add_to_damage']), grantedBy: 'Bard' },
      specials: [{ name: BI_SPECIAL, automationType: 'bardic_inspiration_use', descriptionIncludes: ['1d12'] }],
      reactions: [{ name: BI_OFFENSE, automationType: 'bardic_inspiration_offense', descriptionIncludes: ['1d12', 'damage'] }],
    },
    {
      label: 'both options coexist',
      grant: { die: 8, options: JSON.stringify(['defense_add_to_ac', 'offense_add_to_damage']), grantedBy: 'Bard' },
      specials: [{ name: BI_SPECIAL, automationType: 'bardic_inspiration_use', descriptionIncludes: ['1d8'] }],
      reactions: [
        { name: BI_DEFENSE, automationType: 'bardic_inspiration_defense', descriptionIncludes: ['1d8'] },
        { name: BI_OFFENSE, automationType: 'bardic_inspiration_offense', descriptionIncludes: ['1d8'] },
      ],
    },
  ])('injects $specials.length special / $reactions.length reaction(s) — $label', async ({ grant, specials, reactions }) => {
    grantBI(grant);

    const { specialActions, reactions: deliveredReactions } = await renderAndReadFeatures(createMockPlayerStats({
      class: { name: 'Bard' },
    }));

    const deliveredSpecials = specialActions.filter((f) => f.name === BI_SPECIAL);
    expect(deliveredSpecials.length).toBe(specials.length);
    specials.forEach((expected) => {
      assertFeature(deliveredSpecials.find((f) => f.name === expected.name), expected);
    });

    const deliveredBIReactions = deliveredReactions.filter((f) => f.name === BI_DEFENSE || f.name === BI_OFFENSE);
    expect(deliveredBIReactions.map((f) => f.name).sort()).toEqual(reactions.map((f) => f.name).sort());
    reactions.forEach((expected) => {
      assertFeature(deliveredBIReactions.find((f) => f.name === expected.name), expected);
    });
  });

  it('never duplicates or overwrites Bardic Inspiration entries already on the sheet', async () => {
    grantBI({ die: 8, options: JSON.stringify(['defense_add_to_ac', 'offense_add_to_damage']), grantedBy: 'Bard' });

    const { specialActions, reactions } = await renderAndReadFeatures(createMockPlayerStats({
      class: { name: 'Bard' },
      specialActions: [{ name: BI_SPECIAL, description: 'existing special' }],
      reactions: [
        { name: BI_DEFENSE, description: 'existing defense' },
        { name: BI_OFFENSE, description: 'existing offense' },
      ],
    }));

    expect(specialActions.filter((f) => f.name === BI_SPECIAL)).toHaveLength(1);
    expect(specialActions.find((f) => f.name === BI_SPECIAL).description).toBe('existing special');
    expect(reactions.filter((f) => f.name === BI_DEFENSE)).toHaveLength(1);
    expect(reactions.find((f) => f.name === BI_DEFENSE).description).toBe('existing defense');
    expect(reactions.filter((f) => f.name === BI_OFFENSE)).toHaveLength(1);
    expect(reactions.find((f) => f.name === BI_OFFENSE).description).toBe('existing offense');
  });
});
