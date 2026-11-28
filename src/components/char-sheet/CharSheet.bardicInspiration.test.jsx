// @maintained-by-ai 2026-11-27
// CharSheet UI lane: runtime-driven injection of synthetic Bardic Inspiration
// features into the playerStats handed to CharSpecialActions / CharReactions.
// Grant/eligibility state machine: services/combat/auras/bardicInspirationState.test.js
// Spend handlers + log shapes: CharSheet.featureRiders.test.jsx
// Offer popups: AttackResultPopup + DiceRollResult tests — the popup-inline
// `Bardic Inspiration - Offense/Defense (dN)` buttons are the single
// adjudication lanes (the <name>-biPrompt modal/key lane was deleted 2026-11-18).

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

// Full-shape builders mirroring CharSheet.jsx injectBardicInspirationFeatures
// (CharSheet.jsx:128-174) — name, exact player-facing description, and the
// complete automation object, so extra/missing automation fields fail here.
const biUse = (die, grantedBy = 'unknown') => ({
  name: BI_SPECIAL,
  description: `Roll your Bardic Inspiration die (1d${die}) and add the result to an ability check. Die granted by ${grantedBy}.`,
  automation: { type: 'bardic_inspiration_use' },
});
const biDefense = (die, grantedBy = 'unknown') => ({
  name: BI_DEFENSE,
  description: `Use your Reaction when hit by an attack roll to roll your Bardic Inspiration die (1d${die}) and add the number rolled to your AC. Die granted by ${grantedBy}.`,
  automation: { type: 'bardic_inspiration_defense' },
});
const biOffense = (die, grantedBy = 'unknown') => ({
  name: BI_OFFENSE,
  description: `Use your Reaction after hitting a target with an attack roll to roll your Bardic Inspiration die (1d${die}) and add the number rolled to the attack's damage. Die granted by ${grantedBy}.`,
  automation: { type: 'bardic_inspiration_offense' },
});

const byName = (list) => [...list].sort((a, b) => a.name.localeCompare(b.name));

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

// ---------------------------------------------------------------------------
// Injection matrix — die presence gates everything; combat options select reactions
// ---------------------------------------------------------------------------

describe('bardic inspiration feature injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  // Full delivered arrays are compared (fixture lists start empty), so each
  // row also pins that nothing else leaks into either list.
  it.each([
    {
      label: 'no die granted — fully inert even with combat options set',
      grant: { die: null, options: JSON.stringify(['defense_add_to_ac', 'offense_add_to_damage']) },
      specials: [],
      reactions: [],
    },
    {
      label: 'die granted, options unset (grantedBy falls back to unknown)',
      grant: { die: 6, options: undefined },
      specials: [biUse(6)],
      reactions: [],
    },
    {
      label: 'invalid JSON options fail soft (special survives, no reactions)',
      grant: { die: 6, options: 'not-valid-json', grantedBy: 'Bard' },
      specials: [biUse(6, 'Bard')],
      reactions: [],
    },
    {
      label: 'defense option adds the defense reaction',
      grant: { die: 10, options: JSON.stringify(['defense_add_to_ac']), grantedBy: 'Bard' },
      specials: [biUse(10, 'Bard')],
      reactions: [biDefense(10, 'Bard')],
    },
    {
      label: 'offense option adds the offense reaction',
      grant: { die: 12, options: JSON.stringify(['offense_add_to_damage']), grantedBy: 'Bard' },
      specials: [biUse(12, 'Bard')],
      reactions: [biOffense(12, 'Bard')],
    },
    {
      label: 'both options coexist',
      grant: { die: 8, options: JSON.stringify(['defense_add_to_ac', 'offense_add_to_damage']), grantedBy: 'Bard' },
      specials: [biUse(8, 'Bard')],
      reactions: [biDefense(8, 'Bard'), biOffense(8, 'Bard')],
    },
  ])('injects $specials.length special / $reactions.length reaction(s) — $label', async ({ grant, specials, reactions }) => {
    grantBI(grant);

    const delivered = await renderAndReadFeatures(createMockPlayerStats({
      class: { name: 'Bard' },
    }));

    expect(byName(delivered.specialActions)).toEqual(byName(specials));
    expect(byName(delivered.reactions)).toEqual(byName(reactions));
  });

  it('leaves existing sheet entries untouched — no duplicates, overwrites, or dropped siblings', async () => {
    grantBI({ die: 8, options: JSON.stringify(['defense_add_to_ac', 'offense_add_to_damage']), grantedBy: 'Bard' });

    const specialActions = [
      { name: BI_SPECIAL, description: 'existing special' },
      { name: 'Second Wind', description: 'ordinary special' },
    ];
    const reactions = [
      { name: BI_DEFENSE, description: 'existing defense' },
      { name: BI_OFFENSE, description: 'existing offense' },
      { name: 'Opportunity Attack', description: 'ordinary reaction' },
    ];

    const delivered = await renderAndReadFeatures(createMockPlayerStats({
      class: { name: 'Bard' },
      specialActions,
      reactions,
    }));

    expect(byName(delivered.specialActions)).toEqual(byName(specialActions));
    expect(byName(delivered.reactions)).toEqual(byName(reactions));
  });
});
