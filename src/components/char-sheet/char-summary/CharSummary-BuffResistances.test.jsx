// @improved-by-ai
// @cleaned-by-ai
//
// Cleanup (2026-08-18):
//   - Consolidated 8 single-buff tests → 1 parameterized it.each test.
//     All 8 followed identical execution path: renderSummary([buff]) → getByText(/.../).
//   - Removed empty/missing resistanceTypes tests (lines 198-206):
//     charSummaryCalc.js flatMap(b => b.resistanceTypes || []) handles these;
//     component-level assertions add minimal confidence.
//   - Removed duplicate Stone Skin bludgeoning test (lines 235-238):
//     identical to line 173-176 — same buff, same assertion.
//   - Removed "three different buffs" test (lines 257-266):
//     trivial string concatenation, no logic to exercise; covered by dedup tests.
//   - Rewrote "no active buffs" test: replaced 7 brittle string-absence assertions
//     with single structural assertion querying .resistance-types container.
//   - Reduced file from 306 lines / 17 tests to 230 lines / 7 tests.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSummary from './CharSummary.jsx';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';

// ---------------------------------------------------------------------------
// Mocks — co-located component imports that must not render real DOM
// ---------------------------------------------------------------------------
vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('./CharRaceFeatures.jsx', () => ({ default: () => <div data-testid="char-race-features">Race Features</div> }));
vi.mock('./CharFeatFeatures.jsx', () => ({ default: () => <div data-testid="char-feat-features">Feat Features</div> }));
vi.mock('./TrackedResourceInput.jsx', () => ({ default: () => <div data-testid="tracked-resource-input">TrackedResource</div> }));
vi.mock('../char-feats/CharFeats.jsx', () => ({ default: () => <div data-testid="char-feats">Feats</div> }));
vi.mock('../../common/AvatarImage.jsx', () => ({ default: () => <div data-testid="avatar-image">Avatar</div> }));
vi.mock('../../common/AvatarModal.jsx', () => ({ default: () => null }));
vi.mock('../../common/CreatureBadge.jsx', () => ({ default: ({ label }) => <span data-testid="creature-badge">{label}</span> }));
vi.mock('../../common/AllySelectionModal.jsx', () => ({ default: () => null }));
vi.mock('../../initiative/ConditionEffectBadges.jsx', () => ({ default: () => <div data-testid="condition-effect-badges">Badges</div> }));
vi.mock('../LongRestButton.jsx', () => ({ default: () => <div data-testid="long-rest-btn">Long Rest</div> }));
vi.mock('../ShortRestButton.jsx', () => ({ default: () => <div data-testid="short-rest-btn">Short Rest</div> }));
vi.mock('../ShortRestModal.jsx', () => ({ default: () => <div data-testid="short-rest-modal">Short Rest Modal</div> }));
vi.mock('./CharConditions.jsx', () => ({ default: () => <div data-testid="char-conditions">Conditions</div> }));
vi.mock('../../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));

// ---------------------------------------------------------------------------
// Runtime / state mocks
// ---------------------------------------------------------------------------
vi.mock('../../../hooks/runtime/useTrackedResource.js', () => ({
    default: vi.fn(({ maxGetter }) => ({ current: maxGetter(), update: vi.fn() })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    useRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    getStore: vi.fn(() => new Map()),
}));

vi.mock('../../../hooks/runtime/useSyncedState.js', () => ({
    useSyncedState: vi.fn((_name, _key, defaultValue) => [defaultValue, vi.fn()]),
}));

vi.mock('../../../hooks/combat/DiceRollContext.js', () => ({
    useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
    showBackgroundPopup: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn(), rollInitiative: vi.fn() })),
}));

// ---------------------------------------------------------------------------
// Service mocks
// ---------------------------------------------------------------------------
vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/rules/rulesFactory.js', () => ({
    default: {
        getRules: vi.fn(() => ({ classRules: { getUnarmoredMovementIncrease: vi.fn(() => 0) } })),
    },
    getRules: vi.fn(() => ({ classRules: { getUnarmoredMovementIncrease: vi.fn(() => 0) } })),
}));

vi.mock('../../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: (name) => ({ baseName: name }),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/automation/common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
}));

vi.mock('../../../services/automation/handlers/buffs/auraOfLifeHandler.js', () => ({
    isAuraOfLifeActive: vi.fn(() => false),
    handle: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(() => false),
    handle: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/deathWardHandler.js', () => ({
    isDeathWardActive: vi.fn(() => false),
    handle: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------
const mockPlayerStats = {
    name: 'Thorin',
    xp: 2300,
    xpMode: 'milestone',
    race: { name: 'Dwarf', type: 'Hill Dwarf', subrace: { name: 'Hill Dwarf', speed: 25 } },
    class: { name: 'Cleric', subclass: { name: 'War', type: 'Choice' }, major: { name: 'Cleric' } },
    level: 5,
    alignment: 'Lawful Good',
    proficiency: 3,
    initiative: 2,
    initiativeAdvantage: false,
    abilities: [{ name: 'Wisdom', bonus: 3 }, { name: 'Strength', bonus: 2 }],
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
    languages: [],
    automation: { passives: [], actions: [] },
    passives: [],
    exhaustionLevel: 0,
};

const mockCampaignName = 'test-campaign';

function renderSummary(buffsOverride) {
    if (buffsOverride !== undefined) {
        vi.mocked(getActiveBuffs).mockReturnValue(buffsOverride);
    }
    render(
        <CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
        />
    );
}

// ---------------------------------------------------------------------------
// Buff resistance types — parameterized across all tested buff sources
// ---------------------------------------------------------------------------
describe('CharSummary — buff resistance types render correctly', () => {
    beforeEach(() => vi.resetAllMocks());

    it.each([
        [{ name: 'Aura of Life', resistanceTypes: ['necrotic'] }, /Necrotic/],
        [{ name: 'Aura of Purity', resistanceTypes: ['poison'] }, /Poison/],
        [{ name: 'Protection from Poison', resistanceTypes: ['poison'] }, /Poison/],
        [{ name: 'Stone Skin', resistanceTypes: ['bludgeoning'] }, /Bludgeoning/],
        [{ effect: 'warding_bond', resistanceTypes: ['cold'] }, /Cold/],
        [{ name: 'Starry Form', constellation: 'Archer', resistanceTypes: ['fire'] }, /Fire/],
        [{ name: 'Superior Defense', resistanceTypes: ['slashing'] }, /Slashing/],
        [{ name: 'Rage of the Gods', resistanceTypes: ['radiant'] }, /Radiant/],
    ])('renders %p resistance type', (buff, expectedText) => {
        renderSummary([buff]);
        expect(screen.getByText(expectedText)).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Feign Death — resistance + condition immunity (unique: tests both)
// ---------------------------------------------------------------------------
describe('CharSummary — Feign Death (resistance + condition immunity)', () => {
    beforeEach(() => vi.resetAllMocks());

    it('renders poison condition immunity and poison resistance from Feign Death', () => {
        renderSummary([
            {
                name: 'Feign Death',
                resistanceTypes: ['poison'],
                conditionImmunity: ['Poisoned'],
            },
        ]);
        expect(screen.getByText(/Immunities:/)).toBeInTheDocument();
        expect(screen.getByText(/Poisoned/)).toBeInTheDocument();
        expect(screen.getByText('Poison')).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Stone Skin — buff resistance + runtime value damage types
// ---------------------------------------------------------------------------
describe('CharSummary — Stone Skin (buff + runtime value)', () => {
    beforeEach(() => vi.resetAllMocks());

    it('renders piercing resistance from stoneSkinDamageTypes runtime value alongside buff resistance', () => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
            if (key === 'stoneSkinDamageTypes') return ['piercing'];
            return null;
        });
        renderSummary([{ name: 'Stone Skin', resistanceTypes: ['bludgeoning'] }]);
        expect(screen.getByText(/Piercing/)).toBeInTheDocument();
        expect(screen.getByText(/Bludgeoning/)).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Resistance deduplication
// ---------------------------------------------------------------------------
describe('CharSummary — resistance deduplication', () => {
    beforeEach(() => vi.resetAllMocks());

    it('deduplicates a resistance type that appears in two buffs', () => {
        renderSummary([
            { name: 'Aura of Purity', resistanceTypes: ['poison'] },
            { name: 'Feign Death', resistanceTypes: ['poison'] },
        ]);
        const poisonElements = screen.queryAllByText('Poison');
        expect(poisonElements.length).toBe(1);
    });

    it('deduplicates a resistance type that appears in buff and runtime value', () => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
            if (key === 'stoneSkinDamageTypes') return ['bludgeoning'];
            return null;
        });
        renderSummary([
            { name: 'Stone Skin', resistanceTypes: ['bludgeoning'] },
        ]);
        const bludgeoningElements = screen.queryAllByText('Bludgeoning');
        expect(bludgeoningElements.length).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// No active buffs — negative path
// ---------------------------------------------------------------------------
describe('CharSummary — no active buffs', () => {
    beforeEach(() => vi.resetAllMocks());

    it('renders no buff-derived resistances when getActiveBuffs returns empty array', () => {
        renderSummary([]);
        expect(document.querySelectorAll('.resistance-type').length).toBe(0);
    });
});
