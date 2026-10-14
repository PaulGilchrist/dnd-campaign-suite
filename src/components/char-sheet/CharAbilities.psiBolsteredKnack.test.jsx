// CLA-270: Psi-Bolstered Knack proficiency gate on check contexts.
// The Knack boost must only be offered for skill/tool checks the
// character has proficiency with — never raw ability checks or
// non-proficient skill cells.

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

describe('CharAbilities Psi-Bolstered Knack proficiency gate (CLA-270)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers the Knack on a proficient skill check', () => {
    render(<CharAbilities {...defaultProps(createSoulknifeStats())} />);
    fireEvent.click(findClickableByText('Insight (+6)'));
    expect(getMocks().rollSkillCheck).toHaveBeenCalledWith(
      'Insight',
      6,
      expect.objectContaining({ psiBolsteredKnack: true, psiBolsteredKnackDieSize: 10 })
    );
  });

  it('does NOT offer the Knack on a non-proficient skill check', () => {
    render(<CharAbilities {...defaultProps(createSoulknifeStats())} />);
    fireEvent.click(findClickableByText('Perception (+1)'));
    const ctx = getMocks().rollSkillCheck.mock.calls[0][2] || {};
    expect(ctx.psiBolsteredKnack).toBeUndefined();
  });

  it('does NOT offer the Knack on a raw ability check', () => {
    render(<CharAbilities {...defaultProps(createSoulknifeStats())} />);
    clickAbilityCheckCell('Intelligence');
    const ctx = getMocks().rollAbilityCheck.mock.calls[0][2] || {};
    expect(ctx.psiBolsteredKnack).toBeUndefined();
  });

  it('offers the Knack on a proficient tool check', async () => {
    render(<CharAbilities {...defaultProps(createSoulknifeStats())} />);
    await waitFor(() => {
      const toolCell = findClickableByText("Thieves' Tools (+9)");
      expect(toolCell).toBeTruthy();
    });
    fireEvent.click(findClickableByText("Thieves' Tools (+9)"));
    expect(getMocks().rollAbilityCheck).toHaveBeenCalledWith(
      "Thieves' Tools",
      9,
      expect.objectContaining({ psiBolsteredKnack: true })
    );
  });

  it('does NOT offer the Knack for non-Soulknife rogues', () => {
    const stats = createSoulknifeStats({
      class: { name: 'Rogue', major: { name: 'Thief' }, subclass: { name: 'Thief' }, class_levels: [] },
    });
    render(<CharAbilities {...defaultProps(stats)} />);
    fireEvent.click(findClickableByText('Insight (+6)'));
    const ctx = getMocks().rollSkillCheck.mock.calls[0][2] || {};
    expect(ctx.psiBolsteredKnack).toBeUndefined();
  });
});

describe('isProficientSkillOrToolCheck', () => {
  const stats = createSoulknifeStats();

  it('is true for proficient skills', () => {
    expect(isProficientSkillOrToolCheck(stats, 'Insight')).toBe(true);
  });

  it('is true for expertise skills', () => {
    expect(isProficientSkillOrToolCheck({ ...stats, skillProficiencies: [], expertise: ['Acrobatics'] }, 'Acrobatics')).toBe(true);
  });

  it('is false for non-proficient skills', () => {
    expect(isProficientSkillOrToolCheck(stats, 'Arcana')).toBe(false);
  });

  it('is false for raw ability names', () => {
    expect(isProficientSkillOrToolCheck(stats, 'Intelligence')).toBe(false);
  });

  it('is true for proficient tools and false for non-proficient tools', () => {
    expect(isProficientSkillOrToolCheck(stats, "Thieves' Tools")).toBe(true);
    expect(isProficientSkillOrToolCheck(stats, "Navigator's Tools")).toBe(false);
  });

  it('is false for missing check names or stats', () => {
    expect(isProficientSkillOrToolCheck(stats, undefined)).toBe(false);
    expect(isProficientSkillOrToolCheck(null, 'Insight')).toBe(false);
  });
});
