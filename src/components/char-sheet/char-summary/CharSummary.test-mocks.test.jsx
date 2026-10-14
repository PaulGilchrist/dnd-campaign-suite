//
// Shared mock data for CharSummary component tests.
// All test files should import from this module rather than duplicating
// the mockPlayerStats object. Extend with spread syntax for test-specific overrides:
//   { ...mockPlayerStats, feats: [{ name: 'Test' }] }
//
// Fields added in this improvement:
//   - feats (feat popup tests)
//   - toolProficiencies (proficiencies display tests)
//   - dexterity ability bonus (many tests add it manually)
//   - rules (ruleset selection tests)
//   - automationConditionalImmunities (rage/feign death tests)
//   - wrathOfTheSeaActive (wrath of the sea badge tests)
//
// Cleanup (2026-08-18):
//   - No tests in this file — it is a mock data module only.
//   - Note: ~20 test files still duplicate mock setup (vi.mock calls) instead of
//     importing from this module. The module exports mockPlayerStats/mockCampaignName;
//     mock setup (vi.mock) cannot be shared because each test file needs different
//     mock configurations. This is inherent to Vitest's per-file mock isolation.
//   - CharSummary-Features.test.jsx (dead file, 0 tests) was removed separately.

const mockPlayerStats = {
    name: 'Thorin',
    xp: 2300,
    xpMode: 'milestone',
    rules: '5e',
    race: { name: 'Dwarf', type: 'Hill Dwarf', subrace: { name: 'Hill Dwarf', speed: 25 } },
    class: { name: 'Cleric', subclass: { name: 'War', type: 'Choice' }, major: { name: 'Cleric' } },
    level: 5,
    alignment: 'Lawful Good',
    proficiency: 3,
    initiative: 2,
    initiativeAdvantage: false,
    abilities: [
        { name: 'Wisdom', bonus: 3 },
        { name: 'Strength', bonus: 2 },
        { name: 'Dexterity', bonus: 2 },
    ],
    armorClass: 18,
    armorClassFormula: '16 + 2 (shield)',
    hitPoints: 45,
    inventory: { equipped: ['Scale Mail', 'Shield'] },
    equipment: [{ name: 'Scale Mail', equipment_category: 'Armor' }, { name: 'Shield', type: 'Shield' }],
    background: 'Soldier',
    immunities: [],
    resistances: [],
    vulnerabilities: [],
    senses: [],
    proficiencies: [],
    toolProficiencies: [],
    languages: [],
    automation: { passives: [], actions: [] },
    automationConditionalImmunities: [],
    passives: [],
    exhaustionLevel: 0,
    feats: [],
    wrathOfTheSeaActive: false,
};

const mockCampaignName = 'test-campaign';

export { mockPlayerStats, mockCampaignName };
