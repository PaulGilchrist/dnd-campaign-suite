// @maintained-by-ai
// CLA-270: Psi-Bolstered Knack proficiency gate on check contexts.
// The Knack boost must only be offered for skill/tool checks the
// character has proficiency with — never raw ability checks, non-
// proficient cells, non-Soulknives, or Soulknives below level 3.
// This file OWNS the CLA-270 proficiency gates (CharAbilities
// .missingCoverage.test.jsx explicitly defers them here).

import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { isProficientSkillOrToolCheck } from '../../services/rules/psiBolsteredKnack.js';

const mockRollInterface = {
  popupHtml: null,
  setPopupHtml: vi.fn(),
  rollAbilityCheck: vi.fn(),
  rollSavingThrow: vi.fn(),
  rollSkillCheck: vi.fn(),
};

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const mockFn = vi.fn(() => mockRollInterface);
  return { default: mockFn };
});

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(() => Promise.resolve([
    { name: "Thieves' Tools", equipment_category: 'Tools', ability: 'Dexterity' },
  ])),
}));

const mockAllAbilityScores = [
  { full_name: 'Strength', description: 'STR desc' },
  { full_name: 'Dexterity', description: 'DEX desc' },
  { full_name: 'Constitution', description: 'CON desc' },
  { full_name: 'Intelligence', description: 'INT desc' },
  { full_name: 'Wisdom', description: 'WIS desc' },
  { full_name: 'Charisma', description: 'CHA desc' },
];

function createSoulknifeStats(overrides = {}) {
  return {
    name: 'Soulknife Test',
    level: 14,
    abilities: [
      { name: 'Strength', bonus: 1, save: 3, totalScore: 12, skills: [{ name: 'Athletics', bonus: 3 }] },
      { name: 'Dexterity', bonus: 4, save: 4, totalScore: 18, skills: [{ name: 'Acrobatics', bonus: 6 }] },
      { name: 'Constitution', bonus: 2, save: 2, totalScore: 14, skills: [] },
      { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [{ name: 'Arcana', bonus: 0 }] },
      { name: 'Wisdom', bonus: 1, save: 1, totalScore: 12, skills: [{ name: 'Insight', bonus: 6 }, { name: 'Perception', bonus: 1 }] },
      { name: 'Charisma', bonus: 3, save: 5, totalScore: 16, skills: [] },
    ],
    skillProficiencies: ['Insight', 'Acrobatics'],
    toolProficiencies: ["Thieves' Tools"],
    expertise: [],
    inventory: { equipped: [], backpack: ["Thieves' Tools"] },
    class: {
      name: 'Rogue',
      major: { name: 'Soulknife' },
      subclass: { name: 'Soulknife' },
      class_levels: [{ level: 14, energy: { energy_die_type: 10, energy_die_num: 10 } }],
    },
    automation: { passives: [] },
    ...overrides,
  };
}

function rogueClassStats(level, subclass) {
  return createSoulknifeStats({
    level,
    class: {
      name: 'Rogue',
      major: { name: subclass },
      subclass: { name: subclass },
      class_levels: [],
    },
  });
}

function defaultProps(playerStats) {
  return {
    allAbilityScores: mockAllAbilityScores,
    playerStats,
    campaignName: 'test-campaign',
    exhaustionPenalty: 0,
    conditionEffects: {},
    isRaging: false,
    onReroll: vi.fn(),
    onStrokeOfLuck: vi.fn(),
  };
}

function getMocks() {
  return vi.mocked(useLoggedDiceRoll).mock.results[0].value;
}

function findClickableByText(text) {
  const clickableEls = document.querySelectorAll('.clickable');
  return Array.from(clickableEls).find((el) => el.textContent === text);
}

function clickAbilityCheckCell(abilityName) {
  const rows = Array.from(document.querySelectorAll('.char-abilities .abilities'));
  const row = rows.find((r) => r.children[0]?.textContent?.trim() === abilityName);
  fireEvent.click(row.children[2]);
}

// Asserts the roll actually happened (pins name+bonus) and then checks
// whether the Knack flag is present — never a vacuous pass on zero calls.
function lastRollCall(mock, name, bonus) {
  expect(mock).toHaveBeenCalledWith(name, bonus, expect.any(Object));
  return mock.mock.calls.at(-1)[2];
}

describe('CharAbilities Psi-Bolstered Knack proficiency gate (CLA-270)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers the Knack with the class psionic die on proficient skill and tool checks', async () => {
    render(<CharAbilities {...defaultProps(createSoulknifeStats())} />);

    fireEvent.click(findClickableByText('Insight (+6)'));
    const skillCtx = lastRollCall(getMocks().rollSkillCheck, 'Insight', 6);
    expect(skillCtx).toEqual(expect.objectContaining({ psiBolsteredKnack: true, psiBolsteredKnackDieSize: 10 }));

    await waitFor(() => expect(findClickableByText("Thieves' Tools (+9)")).toBeTruthy());
    fireEvent.click(findClickableByText("Thieves' Tools (+9)"));
    const toolCtx = lastRollCall(getMocks().rollAbilityCheck, "Thieves' Tools", 9);
    expect(toolCtx).toEqual(expect.objectContaining({ psiBolsteredKnack: true, psiBolsteredKnackDieSize: 10 }));
  });

  it('rolls WITHOUT the Knack on ineligible cells: non-proficient skill and raw ability check', () => {
    render(<CharAbilities {...defaultProps(createSoulknifeStats())} />);

    fireEvent.click(findClickableByText('Perception (+1)'));
    const skillCtx = lastRollCall(getMocks().rollSkillCheck, 'Perception', 1);
    expect(skillCtx.psiBolsteredKnack).toBeUndefined();

    clickAbilityCheckCell('Intelligence');
    const abilityCtx = lastRollCall(getMocks().rollAbilityCheck, 'Intelligence', 0);
    expect(abilityCtx.psiBolsteredKnack).toBeUndefined();
  });

  it.each([
    { label: 'never for a non-Soulknife rogue', level: 14, subclass: 'Thief', offers: false },
    { label: 'never below level 3', level: 2, subclass: 'Soulknife', offers: false },
    { label: 'from level 3, defaulting to d6 without psionic die data', level: 3, subclass: 'Soulknife', offers: true },
  ])('gates on subclass and level: $label', ({ level, subclass, offers }) => {
    render(<CharAbilities {...defaultProps(rogueClassStats(level, subclass))} />);
    fireEvent.click(findClickableByText('Insight (+6)'));

    const ctx = lastRollCall(getMocks().rollSkillCheck, 'Insight', 6);
    if (offers) {
      expect(ctx.psiBolsteredKnack).toBe(true);
      expect(ctx.psiBolsteredKnackDieSize).toBe(6);
    } else {
      expect(ctx.psiBolsteredKnack).toBeUndefined();
    }
  });
});

describe('isProficientSkillOrToolCheck', () => {
  const stats = createSoulknifeStats();

  it.each([
    ['proficient skill', stats, 'Insight', true],
    ['expertise-only skill', { ...stats, skillProficiencies: [], expertise: ['Acrobatics'] }, 'Acrobatics', true],
    ['proficient tool', stats, "Thieves' Tools", true],
    ['non-proficient skill', stats, 'Arcana', false],
    ['non-proficient tool', stats, "Navigator's Tools", false],
    ['raw ability name', stats, 'Intelligence', false],
    ['missing check name', stats, undefined, false],
    ['missing stats', null, 'Insight', false],
  ])('is %s', (_label, s, name, expected) => {
    expect(isProficientSkillOrToolCheck(s, name)).toBe(expected);
  });
});
