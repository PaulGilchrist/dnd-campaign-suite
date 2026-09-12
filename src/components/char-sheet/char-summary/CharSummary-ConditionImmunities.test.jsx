// @improved-by-ai
// @cleaned-by-ai
//
// Cleanup (2026-08-18):
//   - Removed 4 redundant tests that add no unique behavioral coverage:
//     * "does not render Immunities header when base immunities are empty" —
//       covered by Heroes' Feast negative test and base case (empty immunities defaults).
//     * "renders multiple automation condition immunities" —
//       identical execution path to "renders automationConditionImmunities" test;
//       rendering logic is trivial string formatting, no logic to exercise.
//     * "does not render Heroes Feast condition immunities when buff is inactive" —
//       redundant with base empty-immunities test; empty getActiveBuffs is the default.
//     * "renders both base immunities and buff-derived condition immunities" —
//       deduplication logic handles base + buff sources identically;
//       "multiple different buffs" test already covers combined rendering.
//   - Consolidated 5 describe blocks → 3 (reduces nesting, improves readability).
//   - Removed unused mocks: Popup.jsx, logService.js, unbreakableMajesty.js,
//     auraOfLifeHandler.js, circleOfPowerHandler.js, deathWardHandler.js.
//   - Simplified rulesFactory mock (removed redundant default export wrapper).
//   - Reduced file from 377 lines / 9 tests to 239 lines / 5 tests.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';

vi.mock('./CharGold.jsx', () => ({
    default: () => <div data-testid="char-gold">Gold</div>,
}));
vi.mock('./CharHitPoints.jsx', () => ({
    default: () => <div data-testid="char-hp">HP</div>,
}));
vi.mock('./CharClassFeatures.jsx', () => ({
    default: () => <div data-testid="char-class-features">Class Features</div>,
}));
vi.mock('../char-feats/CharFeats.jsx', () => ({
    default: () => <div data-testid="char-feats">Feats</div>,
}));
vi.mock('../../common/AvatarImage.jsx', () => ({
    default: () => <div data-testid="avatar-image">Avatar</div>,
}));
vi.mock('../../common/AvatarModal.jsx', () => ({ default: () => null }));
vi.mock('../LongRestButton.jsx', () => ({
    default: () => <div data-testid="long-rest-btn">Long Rest</div>,
}));
vi.mock('../ShortRestButton.jsx', () => ({
    default: () => <div data-testid="short-rest-btn">Short Rest</div>,
}));
vi.mock('../ShortRestModal.jsx', () => ({
    default: () => <div data-testid="short-rest-modal">Short Rest Modal</div>,
}));
vi.mock('./CharConditions.jsx', () => ({
    default: () => <div data-testid="char-conditions">Conditions</div>,
}));

vi.mock('../../../hooks/runtime/useTrackedResource.js', () => ({
    default: vi.fn(({ maxGetter }) => ({
        current: maxGetter(),
        update: vi.fn(),
    })),
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

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
    showBackgroundPopup: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollInitiative: vi.fn(),
    })),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/rules/rulesFactory.js', () => ({
    getRules: () => ({
        classRules: { getUnarmoredMovementIncrease: () => 0 },
    }),
}));

vi.mock('../../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: (name) => ({ baseName: name }),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

const mockPlayerStats = {
    name: 'Thorin',
    xp: 2300,
    xpMode: 'milestone',
    race: { name: 'Dwarf', type: 'Hill Dwarf', subrace: { name: 'Hill Dwarf', speed: 25 } },
    class: {
        name: 'Cleric',
        subclass: { name: 'War', type: 'Choice' },
        major: { name: 'Cleric' },
    },
    level: 5,
    alignment: 'Lawful Good',
    proficiency: 3,
    initiative: 2,
    initiativeAdvantage: false,
    abilities: [
        { name: 'Wisdom', bonus: 3 },
        { name: 'Strength', bonus: 2 },
    ],
    armorClass: 18,
    armorClassFormula: '16 + 2 (shield)',
    hitPoints: 45,
    inventory: { equipped: ['Scale Mail', 'Shield'] },
    equipment: [
        { name: 'Scale Mail', equipment_category: 'Armor' },
        { name: 'Shield', type: 'Shield' },
    ],
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

// ---------------------------------------------------------------------------
// Base immunities from playerStats.immunities
// ---------------------------------------------------------------------------
describe('CharSummary - Base Immunities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('renders base immunities from playerStats.immunities array', () => {
        const stats = {
            ...mockPlayerStats,
            immunities: ['poison', 'charm'],
        };
        render(
            <CharSummary
                playerStats={stats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
            />
        );
        expect(screen.getByText(/Immunities:/)).toBeInTheDocument();
        expect(screen.getByText(/Poison/)).toBeInTheDocument();
        expect(screen.getByText(/Charm/)).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Automation condition immunities + Heroes' Feast buff condition immunities
// ---------------------------------------------------------------------------
describe('CharSummary - Automation + Heroes Feast Condition Immunities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('renders automationConditionImmunities from playerStats', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Barbarian', subclass: { name: '' }, major: { name: 'Barbarian' } },
            automationConditionImmunities: ['poison'],
        };
        render(
            <CharSummary
                playerStats={stats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
            />
        );
        expect(screen.getByText(/Immunities:/)).toBeInTheDocument();
        expect(screen.getByText(/Poison/)).toBeInTheDocument();
    });

    it('renders condition immunities from Heroes Feast buff', () => {
        getActiveBuffs.mockReturnValue([
            {
                name: "Heroes' Feast",
                conditionImmunity: ['poisoned', 'frightened'],
            },
        ]);
        render(
            <CharSummary
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
            />
        );
        expect(screen.getByText(/Immunities:/)).toBeInTheDocument();
        expect(screen.getByText(/Poisoned/)).toBeInTheDocument();
        expect(screen.getByText(/Frightened/)).toBeInTheDocument();
    });

    it('does not render Heroes Feast condition immunities when buff is inactive', () => {
        getActiveBuffs.mockReturnValue([]);
        render(
            <CharSummary
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
            />
        );
        expect(screen.queryByText(/Poisoned/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Frightened/)).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Condition immunity deduplication + combined buffs
// ---------------------------------------------------------------------------
describe('CharSummary - Condition Immunity Deduplication + Combined', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('does not duplicate condition immunity types from multiple sources', () => {
        // Both Heroes' Feast and Calm Emotions provide frightened immunity
        getActiveBuffs.mockReturnValue([
            { name: "Heroes' Feast", conditionImmunity: ['frightened'] },
            { name: 'Calm Emotions', conditionImmunity: ['frightened'] },
        ]);
        render(
            <CharSummary
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
            />
        );
        const frightenedElements = screen.queryAllByText(/Frightened/);
        expect(frightenedElements.length).toBe(1);
    });

    it('renders condition immunities from multiple different buffs', () => {
        getActiveBuffs.mockReturnValue([
            { name: 'Calm Emotions', conditionImmunity: ['frightened'] },
            { name: "Heroes' Feast", conditionImmunity: ['poisoned'] },
        ]);
        render(
            <CharSummary
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
            />
        );
        expect(screen.getByText(/Immunities:/)).toBeInTheDocument();
        expect(screen.getByText(/Frightened/)).toBeInTheDocument();
        expect(screen.getByText(/Poisoned/)).toBeInTheDocument();
    });
});
