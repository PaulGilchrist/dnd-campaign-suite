// @maintained-by-ai
/**
 * CharAbilities — modifier-stacking & runtime-store roll lane.
 * Owns behaviors no sibling lane covers:
 * - getSkillBonus stacking ORDER with exhaustion (JoAT / passWithoutTrace / rage
 *   combined with the penalty — siblings own each modifier in isolation).
 * - bardicInspirationDie stamped onto ability/skill/save rolls from the runtime store
 *   (absence when the store is empty is pinned by clickHandlers' bare-{} assertions).
 * - the `luckyDisadvantageActive` PROP (clickHandlers only covers ce.luckyDisadvantage).
 * - getSaveAdvantageSource tooltip SOURCES (computedStats fallback, top-level
 *   precedence, non-spell source list — saveBonus owns Warding Bond tooltips).
 * - null saveBonusExpression zeroing the bonus without breaking the roll path.
 *
 * Covered by sibling lanes (do NOT re-add here):
 * - clickHandlers: click → roll calls incl. empty-context deep-equality, check/save
 *   context matrices, forcedMode priority.
 * - conditionEffects: JoAT / passWithoutTrace / rage / (Adv) / AUTO FAIL in isolation.
 * - saveBonus: saveBonusExpression parsing, wisdom_modifier, saveBonusAbilities filter.
 * - event-context / contextFeatures: `internal-skill-check` event routing.
 * - reliableTalent (CLA-291) / psiBolsteredKnack (CLA-270): proficiency gates.
 * - toolEntries / display-save / rendering: tools, (Expert) suffix, baseline layout.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities';

// Stable roll interface shared across renders (psiBolsteredKnack pattern) —
// avoids brittle per-render mock.results[0] lookups.
const mockRoll = {
  popupHtml: null,
  setPopupHtml: vi.fn(),
  rollAbilityCheck: vi.fn(),
  rollSavingThrow: vi.fn(),
  rollSkillCheck: vi.fn(),
};

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => mockRoll),
}));

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(() => Promise.resolve([])),
}));

const mockStore = new Map();
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => mockStore),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn((key, prop) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn((key, prop) => mockStore.get(`${key}:${prop}`) ?? null),
}));

const mockAllAbilityScores = [
  { full_name: 'Strength', description: 'STR desc' },
  { full_name: 'Dexterity', description: 'DEX desc' },
  { full_name: 'Constitution', description: 'CON desc' },
  { full_name: 'Intelligence', description: 'INT desc' },
  { full_name: 'Wisdom', description: 'WIS desc' },
  { full_name: 'Charisma', description: 'CHA desc' },
];

// Fixture chosen so queried cell texts are unique across the grid:
// bonus column {+4,+2,+1,+0,-1,+0}, save column {+6,+5,+3,+0,+7,+2}.
function createPlayerStats(overrides = {}) {
  return {
    name: 'Test Fighter',
    level: 5,
    abilities: [
      { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Athletics', bonus: 8 }] },
      { name: 'Dexterity', bonus: 2, save: 5, totalScore: 12, skills: [{ name: 'Acrobatics', bonus: 2 }, { name: 'Stealth', bonus: 6 }] },
      { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
      { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [{ name: 'Arcana', bonus: 2 }] },
      { name: 'Wisdom', bonus: -1, save: 7, totalScore: 8, skills: [{ name: 'Perception', bonus: 3 }] },
      { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
    ],
    skillProficiencies: ['Athletics', 'Arcana'],
    automation: { primalKnowledge: [], passives: [] },
    expertise: [],
    ...overrides,
  };
}

function renderAbilities({ stats, exhaustionPenalty = 0, conditionEffects = {}, isRaging = false, luckyDisadvantageActive } = {}) {
  return render(
    <CharAbilities
      allAbilityScores={mockAllAbilityScores}
      playerStats={stats || createPlayerStats()}
      campaignName="test-campaign"
      exhaustionPenalty={exhaustionPenalty}
      conditionEffects={conditionEffects}
      isRaging={isRaging}
      luckyDisadvantageActive={luckyDisadvantageActive}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStore.clear();
});

describe('skill bonus stacking order with exhaustion', () => {
  // Siblings cover JoAT / passWithoutTrace WITHOUT exhaustion; this lane pins
  // that the flat bonus is ADDED AFTER the exhaustion subtraction (so the flat
  // bonus is never reduced twice) and that exhaustion applies exactly once.
  it('adds jack-of-all-trades half-proficiency after exhaustion, and never to proficient skills', () => {
    // level 10 → proficiency 4, half-proficiency 2
    const stats = createPlayerStats({
      level: 10,
      automation: { primalKnowledge: [], passives: [{ type: 'jack_of_all_trades' }] },
    });
    renderAbilities({ stats, exhaustionPenalty: 1 });
    // Acrobatics (not proficient): 2 − 1 + 2 = 3
    expect(screen.getByText('Acrobatics (+3)')).toBeInTheDocument();
    // Athletics (proficient): 8 − 1, no JoAT half added
    expect(screen.getByText('Athletics (+7)')).toBeInTheDocument();
  });

  it('keeps passWithoutTraceBonus intact when exhaustion also applies', () => {
    renderAbilities({
      exhaustionPenalty: 1,
      conditionEffects: { passWithoutTraceBonus: '3' },
    });
    // Stealth: (6 − 1) + 3 = 8 — the flat bonus is not reduced by exhaustion
    expect(screen.getByText('Stealth (+8)')).toBeInTheDocument();
    // Control: other Dexterity skills get no passWithoutTrace bonus
    expect(screen.getByText('Acrobatics (+1)')).toBeInTheDocument();
  });
});

describe('rage rewrites primal-knowledge skills listed under Strength', () => {
  // conditionEffects lane covers STR-replacing a DEX skill; this pins the
  // rage GATE itself on a skill filed under Strength — including the
  // rage-OFF control explicitly delegated to this lane.
  it('shows the STR bonus only while raging and the raw skill bonus when rage ends', () => {
    const stats = createPlayerStats({
      automation: { primalKnowledge: ['Stealth'], passives: [] },
      skillProficiencies: [],
      abilities: [
        { name: 'Strength', bonus: 3, save: 5, totalScore: 16, skills: [{ name: 'Stealth', bonus: 1 }] },
        { name: 'Dexterity', bonus: 2, save: 5, totalScore: 12, skills: [] },
        { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
        { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
        { name: 'Wisdom', bonus: -1, save: 7, totalScore: 8, skills: [] },
        { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
      ],
    });
    const raging = renderAbilities({ stats, isRaging: true });
    // Non-proficient primal skill: STR bonus 3 only (no proficiency bump)
    expect(screen.getByText('Stealth (+3)')).toBeInTheDocument();
    raging.unmount();
    renderAbilities({ stats, isRaging: false });
    // Without rage the raw DEX-based skill bonus stands
    expect(screen.getByText('Stealth (+1)')).toBeInTheDocument();
  });
});

describe('bardic inspiration die flows from the runtime store into clicked rolls', () => {
  beforeEach(() => {
    mockStore.set('Test Fighter:bardicInspirationDie', 8);
  });

  // One render, all three stamped roll sites (ability / skill / save cells).
  // Absence of bardic keys on an empty store is pinned by clickHandlers'
  // exact-{} / base-save-context assertions — not re-added here.
  it('stamps bardicInspiration and its die onto ability, skill, and save clicks', () => {
    const { getByText } = renderAbilities();
    const bi = { bardicInspiration: true, bardicInspirationDie: 8 };

    fireEvent.click(getByText('+4'));
    expect(mockRoll.rollAbilityCheck).toHaveBeenCalledWith('Strength', 4, bi);

    fireEvent.click(getByText('Athletics (+8)'));
    expect(mockRoll.rollSkillCheck).toHaveBeenCalledWith('Athletics', 8, bi);

    fireEvent.click(getByText('+6'));
    expect(mockRoll.rollSavingThrow).toHaveBeenCalledWith('Strength', 6, {
      forcedMode: undefined,
      autoFail: undefined,
      ...bi,
    });
  });
});

describe('luckyDisadvantageActive prop', () => {
  // Unique to this lane: the prop (not the conditionEffects field) forcing
  // luck disadvantage onto rolls — check and save context builders.
  it('forces luck disadvantage onto ability-check and save contexts from the prop alone', () => {
    const { getByText } = renderAbilities({ luckyDisadvantageActive: true });

    fireEvent.click(getByText('+4'));
    expect(mockRoll.rollAbilityCheck).toHaveBeenCalledWith('Strength', 4, {
      luckyDisadvantage: true,
      luckyDisadvantageType: 'disadvantage',
    });

    fireEvent.click(getByText('+6'));
    expect(mockRoll.rollSavingThrow).toHaveBeenCalledWith('Strength', 6, {
      forcedMode: undefined,
      autoFail: undefined,
      luckyDisadvantage: true,
    });
  });
});

describe('save advantage tooltip sources', () => {
  // getSaveAdvantageSource tooltip text — saveBonus lane owns Warding Bond.

  it('prefers top-level saveModifiers sources and falls back to computedStats when absent', () => {
    const computed = [
      { target: 'saving_throw', effect: 'advantage', condition: 'against_spell', source: 'Stale Computed Source' },
    ];
    // Top-level present: its source wins, the stale computedStats entry never shows.
    const topRender = renderAbilities({
      stats: createPlayerStats({
        saveModifiers: [
          { target: 'saving_throw', effect: 'advantage', condition: 'against_spell', source: 'Ring of Protection' },
        ],
        computedStats: { saveModifiers: computed },
      }),
      conditionEffects: { saveAdvantage: ['against_spell'] },
    });
    const top = topRender.getByText(/^\+6/);
    expect(top.title).toContain('Ring of Protection');
    expect(top.title).not.toContain('Stale Computed Source');
    topRender.unmount();

    // Top-level absent: same source resolves via the computedStats fallback.
    const fallback = renderAbilities({
      stats: createPlayerStats({
        saveModifiers: undefined,
        computedStats: { saveModifiers: computed },
      }),
      conditionEffects: { saveAdvantage: ['against_spell'] },
    }).getByText(/^\+6/);
    expect(fallback.title).toBe('Stale Computed Source');
  });

  it('lists every non-spell advantage source for saveAdvantageCount', () => {
    const stats = createPlayerStats({
      computedStats: {
        saveModifiers: [
          { target: 'saving_throw', effect: 'advantage', condition: 'being_frightened', source: 'Courage Aura' },
          { target: 'saving_throw', effect: 'advantage', condition: 'being_charmed', source: 'Draconic Majesty' },
        ],
      },
    });
    const saveCell = renderAbilities({
      stats,
      conditionEffects: { saveAdvantageCount: 2 },
    }).getByText(/^\+6/);
    expect(saveCell.title).toBe('Courage Aura, Draconic Majesty');
  });
});

describe('null saveBonusExpression is treated as no bonus', () => {
  it('renders the unmodified save, shows no warding-bond tooltip, and still rolls', () => {
    const saveCell = renderAbilities({
      conditionEffects: { saveBonusExpression: null, saveBonusAbilities: ['STR'] },
    }).getByText('+6');
    expect(saveCell).toBeInTheDocument();
    expect(saveCell.title).not.toContain('Warding Bond');
    fireEvent.click(saveCell);
    expect(mockRoll.rollSavingThrow).toHaveBeenCalledWith('Strength', 6, {
      forcedMode: undefined,
      autoFail: undefined,
    });
  });
});
