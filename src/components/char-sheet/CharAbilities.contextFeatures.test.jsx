// @maintained-by-ai
/**
 * CharAbilities — event-driven roll context lane.
 * Owns the `internal-skill-check` window-event contract (routing, bonus math,
 * malformed-event rejection, unmount teardown), the Powerful Build /
 * strCheckDisadvantage forced-mode rules, and strSaveReplace save stamping.
 *
 * Covered by sibling lanes (do NOT re-add here):
 * - event-context: exhaustion on ability-check events, wisCheckReplace, peerless
 *   athlete skills, unknown checkType, unmatched skill names.
 * - clickHandlers: click → roll calls, d20Floor10/strokeOfLuck/autoReroll ctx,
 *   strCheckReplace, the save ctx matrix — including its exact-match base-keys
 *   row, which pins the ABSENCE of strSaveReplace/strScore when unflagged.
 * - reliableTalent: CLA-291 proficiency gate via clicks.
 * - conditionEffects / saveBonus / display-save / toolEntries / rendering: display.
 */
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  // Stable roll interface across renders: onClick closures and the event handler
  // always call these same fns, so assertions never chase mock.results by index.
  const rollMocks = {
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
  };
  return { default: vi.fn(() => rollMocks) };
});

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(() => Promise.resolve([])),
}));

const mockStore = new Map();
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useSyncedState: vi.fn(() => [null, vi.fn()]),
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

function createPlayerStats(overrides = {}) {
  return {
    name: 'Test Fighter',
    level: 5,
    abilities: [
      { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [{ name: 'Athletics', bonus: 8 }] },
      { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [{ name: 'Acrobatics', bonus: 6 }] },
      { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
      { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [{ name: 'Arcana', bonus: 2 }] },
      { name: 'Wisdom', bonus: -1, save: 1, totalScore: 9, skills: [{ name: 'Perception', bonus: 3 }] },
      { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
    ],
    skillProficiencies: ['Athletics', 'Arcana'],
    automation: { primalKnowledge: ['Athletics'], passives: [] },
    expertise: [],
    ...overrides,
  };
}

function renderAbilities({ playerStats = createPlayerStats(), conditionEffects = {}, exhaustionPenalty = 0 } = {}) {
  return render(
    <CharAbilities
      allAbilityScores={mockAllAbilityScores}
      playerStats={playerStats}
      campaignName="test-campaign"
      exhaustionPenalty={exhaustionPenalty}
      conditionEffects={conditionEffects}
      isRaging={false}
    />
  );
}

function rollMocks() {
  return vi.mocked(useLoggedDiceRoll).mock.results[0].value;
}

function dispatchSkillCheck(detail) {
  window.dispatchEvent(new CustomEvent('internal-skill-check', { detail }));
}

// Rows render as: 1=name 2=score 3=check bonus 4=save 5=skills.
// Scope by ability-name so tests don't depend on bonus values being unique.
function rowCell(container, abilityName, nth) {
  const row = Array.from(container.querySelectorAll('.abilities'))
    .find(r => r.querySelector('.left')?.textContent === abilityName);
  const cell = row ? row.children[nth - 1] : null;
  expect(cell, `${abilityName} column ${nth} not found`).toBeTruthy();
  return cell;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStore.clear();
});

describe('internal-skill-check event routing', () => {
  it('routes skill and ability events to the matching roll fn with the computed bonus and no context', () => {
    renderAbilities();
    dispatchSkillCheck({ skillName: 'Athletics', checkType: 'skill' });
    expect(rollMocks().rollSkillCheck).toHaveBeenCalledWith('Athletics', 8, undefined);
    dispatchSkillCheck({ skillName: 'Strength', checkType: 'check' });
    expect(rollMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', 4, undefined);
  });

  it('subtracts the exhaustion penalty from event-triggered skill and ability rolls', () => {
    renderAbilities({ exhaustionPenalty: 2 });
    dispatchSkillCheck({ skillName: 'Athletics', checkType: 'skill' });
    expect(rollMocks().rollSkillCheck).toHaveBeenCalledWith('Athletics', 6, undefined);
    dispatchSkillCheck({ skillName: 'Strength', checkType: 'check' });
    expect(rollMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', 2, undefined);
  });

  it('stamps makeCheckContext on event-triggered rolls, gating reliableTalent to proficient skills', () => {
    renderAbilities({ conditionEffects: { reliableTalent: true, d20Floor10: true } });
    // Proficient skill via event → both flags stamped.
    dispatchSkillCheck({ skillName: 'Athletics', checkType: 'skill' });
    expect(rollMocks().rollSkillCheck).toHaveBeenCalledWith('Athletics', 8, {
      d20Floor10: true,
      reliableTalent: true,
    });
    // Raw ability check via event → reliableTalent excluded (CLA-291), d20Floor10 still stamped.
    dispatchSkillCheck({ skillName: 'Strength', checkType: 'check' });
    expect(rollMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', 4, { d20Floor10: true });
  });

  it('ignores malformed events: missing detail, no skillName, and checkType "check" naming a skill', () => {
    renderAbilities();
    dispatchSkillCheck({});
    window.dispatchEvent(new CustomEvent('internal-skill-check'));
    dispatchSkillCheck({ skillName: 'Athletics', checkType: 'check' });
    expect(rollMocks().rollSkillCheck).not.toHaveBeenCalled();
    expect(rollMocks().rollAbilityCheck).not.toHaveBeenCalled();
    expect(rollMocks().rollSavingThrow).not.toHaveBeenCalled();
  });

  it('detaches the listener on unmount', () => {
    const { unmount } = renderAbilities();
    unmount();
    dispatchSkillCheck({ skillName: 'Strength', checkType: 'check' });
    expect(rollMocks().rollAbilityCheck).not.toHaveBeenCalled();
  });
});

describe('STR forced-mode rules on clicked checks', () => {
  it('Powerful Build forces advantage on STR ability-check and Athletics skill clicks', () => {
    const { container } = renderAbilities({ conditionEffects: { strCheckAdvantage: true } });
    fireEvent.click(rowCell(container, 'Strength', 3));
    expect(rollMocks().rollAbilityCheck).toHaveBeenCalledWith('Strength', 4, { forcedMode: 'advantage' });
    const athleticsCell = Array.from(container.querySelectorAll('.clickable'))
      .find(el => el.textContent.startsWith('Athletics'));
    expect(athleticsCell).toBeTruthy();
    fireEvent.click(athleticsCell);
    expect(rollMocks().rollSkillCheck).toHaveBeenCalledWith('Athletics', 8, { forcedMode: 'advantage' });
  });

  it('strCheckDisadvantage is scoped to STR — a DEX check click rolls unforced', () => {
    const { container } = renderAbilities({ conditionEffects: { strCheckDisadvantage: true } });
    fireEvent.click(rowCell(container, 'Dexterity', 3));
    expect(rollMocks().rollAbilityCheck).toHaveBeenCalledWith('Dexterity', 2, {});
  });
});

describe('strSaveReplace save stamping', () => {
  it('clicking the STR save stamps strSaveReplace with the Strength score', () => {
    const { container } = renderAbilities({ conditionEffects: { strSaveReplace: true } });
    fireEvent.click(rowCell(container, 'Strength', 4));
    expect(rollMocks().rollSavingThrow).toHaveBeenCalledWith('Strength', 6, {
      forcedMode: undefined,
      autoFail: undefined,
      strSaveReplace: true,
      strScore: 14,
    });
  });
});
