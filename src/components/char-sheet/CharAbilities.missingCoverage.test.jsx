// @improved-by-ai
/**
 * CharAbilities — modifier-stacking & runtime-store roll lane.
 * Owns behaviors no sibling lane covers:
 * - getSkillBonus stacking ORDER with exhaustion (JoAT / passWithoutTrace / rage
 *   combined with the penalty — siblings own each modifier in isolation).
 * - bardicInspirationDie stamped onto ability/skill/save rolls from the runtime store.
 * - the `luckyDisadvantageActive` PROP (clickHandlers only covers ce.luckyDisadvantage).
 * - getSaveAdvantageSource tooltip SOURCES (computedStats fallback, top-level
 *   precedence, non-spell source list — saveBonus owns Warding Bond tooltips).
 * - null saveBonusExpression zeroing the bonus without breaking the roll path.
 *
 * Covered by sibling lanes (do NOT re-add here):
 * - clickHandlers: click → roll calls, check/save context matrices, forcedMode priority.
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
  // rage GATE itself on a skill filed under Strength (raw bonus vs STR bonus).
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

  it('stamps bardicInspiration and its die onto ability-check clicks', () => {
    const { rollAbilityCheck } = mockRoll;
    fireEvent.click(renderAbilities().getByText('+4'));
    expect(rollAbilityCheck).toHaveBeenCalledWith('Strength', 4, {
      bardicInspiration: true,
      bardicInspirationDie: 8,
    });
  });

  it('stamps bardicInspiration onto skill-check clicks', () => {
    const { rollSkillCheck } = mockRoll;
    fireEvent.click(renderAbilities().getByText('Athletics (+8)'));
    expect(rollSkillCheck).toHaveBeenCalledWith('Athletics', 8, {
      bardicInspiration: true,
      bardicInspirationDie: 8,
    });
  });

  it('stamps bardicInspiration onto saving-throw clicks', () => {
    const { rollSavingThrow } = mockRoll;
    fireEvent.click(renderAbilities().getByText('+6'));
    expect(rollSavingThrow).toHaveBeenCalledWith('Strength', 6, {
      forcedMode: undefined,
      autoFail: undefined,
      bardicInspiration: true,
      bardicInspirationDie: 8,
    });
  });
});

describe('rolls stamp no spurious context when nothing is pending', () => {
  it('clicks an ability bonus with a bare empty context object', () => {
    // Empty store + empty conditionEffects: { } exactly — no forcedMode,
    // no bardicInspiration, no lucky keys (deep-equality pins absence).
    const { rollAbilityCheck } = mockRoll;
    fireEvent.click(renderAbilities({ luckyDisadvantageActive: false }).getByText('+4'));
    expect(rollAbilityCheck).toHaveBeenCalledWith('Strength', 4, {});
  });

  it('clicks a save with only the base save-context keys', () => {
    // makeSaveContext always emits forcedMode/autoFail (undefined here);
    // nothing else may be stamped when no save effects exist.
    const { rollSavingThrow } = mockRoll;
    fireEvent.click(renderAbilities().getByText('+6'));
    expect(rollSavingThrow).toHaveBeenCalledWith('Strength', 6, {
      forcedMode: undefined,
      autoFail: undefined,
    });
  });
});

describe('luckyDisadvantageActive prop', () => {
  // Unique to this lane: the prop (not the conditionEffects field) forcing
  // luck disadvantage onto rolls.
  it('forces luck disadvantage onto ability check context from the prop alone', () => {
    const { rollAbilityCheck } = mockRoll;
    fireEvent.click(renderAbilities({ luckyDisadvantageActive: true }).getByText('+4'));
    expect(rollAbilityCheck).toHaveBeenCalledWith('Strength', 4, {
      luckyDisadvantage: true,
      luckyDisadvantageType: 'disadvantage',
    });
  });

  it('forces luck disadvantage onto save context from the prop alone', () => {
    const { rollSavingThrow } = mockRoll;
    fireEvent.click(renderAbilities({ luckyDisadvantageActive: true }).getByText('+6'));
    expect(rollSavingThrow).toHaveBeenCalledWith('Strength', 6, {
      forcedMode: undefined,
      autoFail: undefined,
      luckyDisadvantage: true,
    });
  });
});

describe('save advantage tooltip sources', () => {
  // getSaveAdvantageSource tooltip text — saveBonus lane owns Warding Bond.

  it('falls back to computedStats.saveModifiers when top-level saveModifiers is absent', () => {
    const stats = createPlayerStats({
      saveModifiers: undefined,
      computedStats: {
        saveModifiers: [
          { target: 'saving_throw', effect: 'advantage', condition: 'against_spell', source: 'Stone of Protection' },
        ],
      },
    });
    const saveCell = renderAbilities({
      stats,
      conditionEffects: { saveAdvantage: ['against_spell'] },
    }).getByText(/^\+6/);
    expect(saveCell.title).toBe('Stone of Protection');
  });

  it('prefers top-level saveModifiers sources over computedStats', () => {
    const stats = createPlayerStats({
      saveModifiers: [
        { target: 'saving_throw', effect: 'advantage', condition: 'against_spell', source: 'Ring of Protection' },
      ],
      computedStats: {
        saveModifiers: [
          { target: 'saving_throw', effect: 'advantage', condition: 'against_spell', source: 'Stale Computed Source' },
        ],
      },
    });
    const saveCell = renderAbilities({
      stats,
      conditionEffects: { saveAdvantage: ['against_spell'] },
    }).getByText(/^\+6/);
    expect(saveCell.title).toContain('Ring of Protection');
    expect(saveCell.title).not.toContain('Stale Computed Source');
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
    const { rollSavingThrow } = mockRoll;
    const saveCell = renderAbilities({
      conditionEffects: { saveBonusExpression: null, saveBonusAbilities: ['STR'] },
    }).getByText('+6');
    expect(saveCell).toBeInTheDocument();
    expect(saveCell.title).not.toContain('Warding Bond');
    fireEvent.click(saveCell);
    expect(rollSavingThrow).toHaveBeenCalledWith('Strength', 6, {
      forcedMode: undefined,
      autoFail: undefined,
    });
  });
});
