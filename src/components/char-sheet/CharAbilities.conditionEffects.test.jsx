// @maintained-by-ai
/**
 * CharAbilities — conditionEffects DISPLAY lane (isolated modifier paths).
 * Verifies how auto-fail saves, save advantage suffixes, exhaustion, pass without
 * a trace, jack of all trades, and rage change the rendered bonus/save/skill columns.
 * Covered by sibling lanes (do NOT re-add here):
 * - missingCoverage: JoAT / passWithoutTrace / rage stacked WITH exhaustion, tooltip
 *   sources, bardic inspiration stamping, rage-off control on primal skills.
 * - clickHandlers / saveBonus: roll-time forcedMode and saveBonusExpression parsing.
 * - event-context / contextFeatures: check ctx; toolEntries: tools; display-save:
 *   (Expert) suffix; rendering: baseline layout. Cosmic omen applies at roll time
 *   only (cosmicOmenHandler / saveProcessing) and is never read by this component.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharAbilities from './CharAbilities';

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const mockFn = vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
  }));
  return { default: mockFn };
});

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

const mockAllAbilityScores = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
  .map(name => ({ full_name: name, description: `${name} desc` }));

// Baseline level-5 fighter: proficiency = floor((5-1)/4 + 2) = 3.
// Skill bonuses are consistent with their ability modifier (unproficient = modifier only).
function createPlayerStats(overrides = {}) {
  return {
    name: 'Test Fighter',
    level: 5,
    abilities: [
      { name: 'Strength', bonus: 4, save: 6, totalScore: 18, skills: [{ name: 'Athletics', bonus: 8 }] },
      { name: 'Dexterity', bonus: 2, save: 4, totalScore: 14, skills: [{ name: 'Acrobatics', bonus: 2 }, { name: 'Stealth', bonus: 2 }] },
      { name: 'Constitution', bonus: 1, save: 3, totalScore: 12, skills: [] },
      { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [{ name: 'Arcana', bonus: 2 }] },
      { name: 'Wisdom', bonus: -1, save: 1, totalScore: 8, skills: [] },
      { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
    ],
    skillProficiencies: ['Athletics', 'Arcana'],
    automation: { primalKnowledge: [], passives: [] },
    expertise: [],
    ...overrides,
  };
}

const defaultProps = {
  allAbilityScores: mockAllAbilityScores,
  campaignName: 'test-campaign',
  exhaustionPenalty: 0,
  conditionEffects: {},
  isRaging: false,
};

function renderAbilities(overrides = {}) {
  const { stats: statsOverrides, ...propOverrides } = overrides;
  return render(
    <CharAbilities
      {...defaultProps}
      playerStats={createPlayerStats(statsOverrides)}
      {...propOverrides}
    />
  );
}

// Column layout per row: 1=name 2=score 3=check bonus 4=save 5=skills.
function columnTexts(container, nth) {
  return Array.from(container.querySelectorAll(`.abilities > div:nth-child(${nth})`)).map(c => c.textContent);
}

const getBonusTexts = container => columnTexts(container, 3);
const getSaveTexts = container => columnTexts(container, 4);

describe('CharAbilities condition effects display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('replaces only the targeted ability save with AUTO FAIL, leaving others numeric', () => {
    const { container } = renderAbilities({ conditionEffects: { autoFailSaves: ['str'] } });
    expect(getSaveTexts(container)).toEqual(['AUTO FAIL', '+4', '+3', '+0', '+1', '+2']);
  });

  it('suffixes saves with (Adv) for every save when saveAdvantageCount is set, and only listed abilities via saveAdvantageAbilities', () => {
    const all = renderAbilities({ conditionEffects: { saveAdvantageCount: 2 } });
    expect(getSaveTexts(all.container)).toEqual(
      ['+6 (Adv)', '+4 (Adv)', '+3 (Adv)', '+0 (Adv)', '+1 (Adv)', '+2 (Adv)']
    );
    all.unmount();

    const listed = renderAbilities({ conditionEffects: { saveAdvantageAbilities: ['STR'] } });
    expect(getSaveTexts(listed.container)).toEqual(['+6 (Adv)', '+4', '+3', '+0', '+1', '+2']);
  });

  it('subtracts the exhaustion penalty from every displayed ability bonus and save', () => {
    const { container } = renderAbilities({ exhaustionPenalty: 2 });
    expect(getBonusTexts(container)).toEqual(['+2', '+0', '-1', '-2', '-3', '-2']);
    expect(getSaveTexts(container)).toEqual(['+4', '+2', '+1', '-2', '-1', '+0']);
  });

  it('adds passWithoutTraceBonus to Stealth only, leaving other Dexterity skills unchanged', () => {
    renderAbilities({ conditionEffects: { passWithoutTraceBonus: '2' } });
    // Stealth: 2 + 2 = 4; Acrobatics untouched: 2
    expect(screen.getByText('Stealth (+4)')).toBeInTheDocument();
    expect(screen.getByText('Acrobatics (+2)')).toBeInTheDocument();
  });

  it('adds jack-of-all-trades half-proficiency to non-proficient skills only', () => {
    renderAbilities({
      stats: {
        level: 10,
        automation: { primalKnowledge: [], passives: [{ type: 'jack_of_all_trades' }] },
      },
    });
    // Level 10 → proficiency 4, half = 2. Proficient skills (Athletics, Arcana) untouched.
    expect(screen.getByText('Athletics (+8)')).toBeInTheDocument();
    expect(screen.getByText('Arcana (+2)')).toBeInTheDocument();
    expect(screen.getByText('Acrobatics (+4)')).toBeInTheDocument();
  });

  it('recomputes primal knowledge skills from STR while raging — proficient and expert included, non-primal untouched', () => {
    renderAbilities({
      stats: {
        automation: { primalKnowledge: ['Acrobatics', 'Athletics'], passives: [] },
        expertise: ['Athletics'],
      },
      isRaging: true,
    });
    // Acrobatics: STR bonus (4) replaces its DEX-based 2 (unproficient).
    expect(screen.getByText('Acrobatics (+4)')).toBeInTheDocument();
    // Athletics: STR bonus (4) + proficiency (3) + expertise (3) = 10, keeping the Expert suffix.
    expect(screen.getByText('Athletics (Expert) (+10)')).toBeInTheDocument();
    // Stealth is not primal knowledge: keeps its DEX-based 2.
    expect(screen.getByText('Stealth (+2)')).toBeInTheDocument();
  });
});
