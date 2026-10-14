// @maintained-by-ai
/**
 * CLA-291 regression — CharAbilities CLICK lane for the Reliable Talent gate.
 * makeCheckContext stamps reliableTalent ONLY for proficient skill/tool checks:
 *   - proficient skill / tool  -> stamp
 *   - non-proficient skill / tool AND raw ability check -> never stamp
 *
 * This file owns the click path only. Do NOT re-add here:
 * - DiceRollResult.displayFeatures: reliableTalent FLOOR rendering (roll ≤9/10, attack, save).
 * - CharAbilities.contextFeatures: the same gate driven by the internal-skill-check EVENT.
 */
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(() => Promise.resolve([
    { name: "Thieves' Tools", equipment_category: 'Tools', ability: 'Dexterity' },
    { name: "Navigator's Tools", equipment_category: 'Tools', ability: 'Wisdom' },
  ])),
}));

const mockStore = new Map();
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
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

// Insight + Thieves' Tools are proficient; Acrobatics + Navigator's Tools are not.
function createPlayerStats(overrides = {}) {
  return {
    name: 'Rogue Test',
    level: 17,
    abilities: [
      { name: 'Strength', bonus: 0, save: 2, totalScore: 10, skills: [{ name: 'Athletics', bonus: 6 }] },
      { name: 'Dexterity', bonus: 2, save: 4, totalScore: 14, skills: [{ name: 'Acrobatics', bonus: 2 }] },
      { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
      { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [{ name: 'Arcana', bonus: 6 }] },
      { name: 'Wisdom', bonus: 1, save: 1, totalScore: 12, skills: [{ name: 'Animal Handling', bonus: 1 }, { name: 'Insight', bonus: 7 }] },
      { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
    ],
    skillProficiencies: ['Athletics', 'Arcana', 'Insight'],
    toolProficiencies: ["Thieves' Tools"],
    expertise: [],
    inventory: { equipped: ["Thieves' Tools", "Navigator's Tools"], backpack: [] },
    automation: { passives: [] },
    ...overrides,
  };
}

function rollMocks() {
  const results = vi.mocked(useLoggedDiceRoll).mock.results;
  return results[results.length - 1].value;
}

// Skills render synchronously; tools render after the equipment effect resolves — poll (bounded).
async function clickCell(prefix) {
  let el = null;
  for (let i = 0; i < 20 && !el; i++) {
    el = Array.from(document.querySelectorAll('.clickable')).find((c) => c.textContent.startsWith(prefix));
    if (!el) await new Promise((r) => setTimeout(r, 25));
  }
  expect(el, `clickable cell "${prefix}" not found`).toBeTruthy();
  fireEvent.click(el);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStore.clear();
});

describe('CLA-291 CharAbilities click lane — reliableTalent proficiency gate', () => {
  const renderAbilities = () => render(
    <CharAbilities
      allAbilityScores={mockAllAbilityScores}
      playerStats={createPlayerStats()}
      campaignName="test-campaign"
      exhaustionPenalty={0}
      conditionEffects={{ reliableTalent: true }}
      isRaging={false}
    />
  );

  it.each`
    cell                | roll
    ${'Insight'}        | ${'rollSkillCheck'}
    ${"Thieves' Tools"} | ${'rollAbilityCheck'}
  `('stamps reliableTalent for a proficient $cell check', async ({ cell, roll }) => {
    renderAbilities();
    await clickCell(cell);
    expect(rollMocks()[roll]).toHaveBeenCalledWith(cell, expect.any(Number), { reliableTalent: true });
  });

  it.each`
    cell                  | roll
    ${'Acrobatics'}       | ${'rollSkillCheck'}
    ${"Navigator's Tools"} | ${'rollAbilityCheck'}
  `('never stamps reliableTalent for a NON-proficient $cell check', async ({ cell, roll }) => {
    renderAbilities();
    await clickCell(cell);
    // Exact-match: reliableTalent absent AND nothing spurious stamped.
    expect(rollMocks()[roll]).toHaveBeenCalledWith(cell, expect.any(Number), {});
  });

  it('never stamps reliableTalent on a raw ability-check bonus cell', () => {
    const { container } = renderAbilities();
    const strRow = Array.from(container.querySelectorAll('.abilities'))
      .find((r) => r.querySelector('.left')?.textContent === 'Strength');
    fireEvent.click(strRow.children[2]); // col 3 = ability check bonus
    expect(rollMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), {});
  });
});
