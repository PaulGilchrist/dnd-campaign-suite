// @maintained-by-ai
// CharAbilities tool-entry cells: which inventory tools appear, under which ability
// row, and with what computed bonus (proficiency, exhaustion, negative formatting).
// Click-to-roll behavior for tool entries is covered in reliableTalent /
// psiBolsteredKnack sibling tests — not re-tested here.
import { render, screen, waitFor, within } from '@testing-library/react';
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

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(() => null),
}));

// Only these items exist in the equipment data: three Tools with abilities,
// plus a non-Tools item and Tools-without-ability must never surface.
const mockEquipment = [
  { name: "Healer's Kit", equipment_category: 'Tools', ability: 'Wisdom', utilize: 'Healing' },
  { name: "Thieves' Tools", equipment_category: 'Tools', ability: 'Dexterity', utilize: 'Pick locks' },
  { name: 'Musical Instrument (Lute)', equipment_category: 'Tools', ability: 'Charisma', utilize: 'Performance' },
  { name: 'Non-tool item', equipment_category: 'Equipment', ability: null, utilize: null },
];

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(() => Promise.resolve(mockEquipment)),
}));

const BASE_ABILITIES = [
  { name: 'Strength', bonus: 4, save: 6, totalScore: 14, skills: [] },
  { name: 'Dexterity', bonus: 2, save: 4, totalScore: 12, skills: [] },
  { name: 'Constitution', bonus: 1, save: 3, totalScore: 11, skills: [] },
  { name: 'Intelligence', bonus: 0, save: 0, totalScore: 10, skills: [] },
  { name: 'Wisdom', bonus: 2, save: 4, totalScore: 14, skills: [] },
  { name: 'Charisma', bonus: 0, save: 2, totalScore: 10, skills: [] },
];

// Patch only what a test needs; everything else stays at the baseline values.
function statsWith({ level = 5, toolProficiencies = [], inventory = { equipped: [], backpack: [] }, abilityBonuses = {} } = {}) {
  return {
    name: 'Test Fighter',
    level,
    abilities: BASE_ABILITIES.map(a => (
      a.name in abilityBonuses ? { ...a, bonus: abilityBonuses[a.name] } : a
    )),
    skillProficiencies: [],
    toolProficiencies,
    automation: { primalKnowledge: [], passives: [] },
    expertise: [],
    inventory,
  };
}

function ui(stats, exhaustionPenalty = 0) {
  return (
    <CharAbilities
      allAbilityScores={[
        { full_name: 'Strength', description: 'STR desc' },
        { full_name: 'Dexterity', description: 'DEX desc' },
        { full_name: 'Constitution', description: 'CON desc' },
        { full_name: 'Intelligence', description: 'INT desc' },
        { full_name: 'Wisdom', description: 'WIS desc' },
        { full_name: 'Charisma', description: 'CHA desc' },
      ]}
      playerStats={stats}
      campaignName='test-campaign'
      exhaustionPenalty={exhaustionPenalty}
      conditionEffects={{}}
      isRaging={false}
      onReroll={vi.fn()}
      onStrokeOfLuck={vi.fn()}
    />
  );
}

// The tool cell lives inside the row whose name cell is the ability's full name.
function abilityRow(name) {
  return within(screen.getByText(name).closest('.abilities'));
}

describe('CharAbilities tool entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders proficient tools with ability + proficiency bonus, from both inventory lanes, deduplicated and grouped under their ability row', async () => {
    // Level 5 => proficiency = Math.floor((5-1)/4 + 2) = 3
    const stats = statsWith({
      toolProficiencies: ["Healer's Kit", "Thieves' Tools", 'Musical Instrument (Lute)'],
      inventory: {
        equipped: ["Healer's Kit", "Thieves' Tools", 'Non-tool item'],
        backpack: ['Unknown Tool', "Thieves' Tools", 'Musical Instrument (Lute)'],
      },
      abilityBonuses: { Dexterity: 4, Charisma: 3 },
    });
    render(ui(stats));

    // Proficient: wis(2) + prof(3) = +5, in the Wisdom row.
    await screen.findByText("Healer's Kit (+5)");
    expect(abilityRow('Wisdom').getByText("Healer's Kit (+5)")).toBeInTheDocument();
    // Thieves' Tools in equipped AND backpack: dex(4) + prof(3) = +7, rendered once.
    expect(abilityRow('Dexterity').getByText("Thieves' Tools (+7)")).toBeInTheDocument();
    expect(screen.getAllByText("Thieves' Tools (+7)")).toHaveLength(1);
    // Backpack-only tool: cha(3) + prof(3) = +6, in the Charisma row.
    expect(abilityRow('Charisma').getByText('Musical Instrument (Lute) (+6)')).toBeInTheDocument();
    // Not in equipment data / not a Tools category: never rendered.
    expect(screen.queryByText(/Unknown Tool/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Non-tool item/)).not.toBeInTheDocument();
  });

  it('shows ability-bonus-only entries for non-proficient tools, including negative bonuses', async () => {
    // toolProficiencies missing entirely => treated as not proficient.
    const stats = statsWith({
      toolProficiencies: undefined,
      inventory: { equipped: ["Healer's Kit", "Thieves' Tools"], backpack: [] },
      abilityBonuses: { Dexterity: -2 },
    });
    render(ui(stats));

    await screen.findByText("Healer's Kit (+2)"); // wis(2), no proficiency
    expect(abilityRow('Dexterity').getByText("Thieves' Tools (-2)")).toBeInTheDocument(); // dex(-2), minus sign shown
  });

  it('applies the exhaustion penalty to tool bonuses, into negative totals', async () => {
    const stats = statsWith({
      toolProficiencies: ["Healer's Kit"],
      inventory: { equipped: ["Healer's Kit"], backpack: [] },
    });
    // wis(2) + prof(3) - exhaustion(8) = -3
    render(ui(stats, 8));

    await screen.findByText("Healer's Kit (-3)");
  });

  it('renders no tool entries when inventory is missing or empty', async () => {
    const { rerender } = render(ui(statsWith({
      inventory: { equipped: ["Healer's Kit"], backpack: [] },
    })));
    // Anchor: confirms the async equipment load has rendered the tool.
    await screen.findByText("Healer's Kit (+2)");

    rerender(ui(statsWith({ inventory: undefined })));
    await waitFor(() => {
      expect(screen.queryByText(/Healer's Kit/)).not.toBeInTheDocument();
    });

    rerender(ui(statsWith({ inventory: { equipped: [], backpack: [] } })));
    await waitFor(() => {
      expect(screen.queryByText(/Healer's Kit/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Thieves' Tools/)).not.toBeInTheDocument();
    });
  });
});
