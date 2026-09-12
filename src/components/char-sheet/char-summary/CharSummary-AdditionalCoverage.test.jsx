// @improved-by-ai
// @cleaned-by-ai
//
// Quality improvements:
//   - Consolidated 3 describe blocks into 1 (reduces duplication, improves readability)
//   - Removed window.location.hostname mutation (global state pollution risk)
//   - Added missing mocks: DiceRollContext, logService, buffToggle
//   - Added @testing-library/jest-dom import (explicit dependency)
//   - Added negative tests: no climb/swim when undefined/null, no stormborn when inactive
//   - Added edge cases: zero speeds, multiple stormborn damage types, salmon aspect override
//   - Fixed getRuntimeValue mock usage (use vi.mocked() consistently)
//   - Added test for swimSpeed === 0 (falsy but valid)
//   - Removed redundant mocks (CreatureBadge, ConditionEffectBadges not needed for these assertions)
//   - Added Dexterity ability to mockPlayerStats (referenced by charSummaryCalc.js)
//   - Improved test descriptions with clearer intent
//
// Cleanup (2026-08-18):
//   - Removed 5 redundant negative tests: climbSpeed undefined/null/0 and swimSpeed undefined/null/0
//     All test JavaScript truthiness (falsy → no render) which is implementation detail, not behavior.
//     Coverage for base speed rendering is provided by CharSummary-SpeedCalculations.test.jsx.
//   - Removed 2 duplicate climb/swim "present" tests covered by CharSummary-SpeedCalculations.test.jsx.
//   - Removed 2 duplicate aquatic_adaptation tests covered by CharSummary-SpeedCalculations.test.jsx.
//   - Consolidated 3 stormborn negative tests (false/undefined/no-entry) into 1 parameterized test.
//   - Removed unused Popup, AllySelectionModal, TrackedResourceInput, sanitize mocks (not exercised).
//   - Removed unused logService, auraOfLifeHandler, circleOfPowerHandler, deathWardHandler mocks.
//   - Reduced file from 330 lines / 16 tests to 127 lines / 6 tests.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('../char-feats/CharFeats.jsx', () => ({ default: () => <div data-testid="char-feats">Feats</div> }));
vi.mock('../../common/AvatarImage.jsx', () => ({ default: () => <div data-testid="avatar-image">Avatar</div> }));
vi.mock('../../common/AvatarModal.jsx', () => ({ default: () => null }));
vi.mock('../LongRestButton.jsx', () => ({ default: () => <div data-testid="long-rest-btn">Long Rest</div> }));
vi.mock('../ShortRestButton.jsx', () => ({ default: () => <div data-testid="short-rest-btn">Short Rest</div> }));
vi.mock('../ShortRestModal.jsx', () => ({ default: () => <div data-testid="short-rest-modal">Short Rest Modal</div> }));
vi.mock('./CharConditions.jsx', () => ({ default: () => <div data-testid="char-conditions">Conditions</div> }));

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

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
    showBackgroundPopup: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn(), rollInitiative: vi.fn() })),
}));

vi.mock('../../../hooks/combat/DiceRollContext.js', () => ({
    useDiceRollPopup: () => ({ setPopupHtml: vi.fn() }),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/automation/common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../../services/rules/rulesFactory.js', () => ({
    default: {
        getRules: () => ({ classRules: { getUnarmoredMovementIncrease: () => 0 } }),
    },
    getRules: () => ({ classRules: { getUnarmoredMovementIncrease: () => 0 } }),
}));

vi.mock('../../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: (name) => ({ baseName: name }),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

const mockCampaignName = 'test-campaign';

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
    languages: [],
    automation: { passives: [], actions: [] },
    passives: [],
    exhaustionLevel: 0,
};

// ---------------------------------------------------------------------------
// Climb speed — buff override (base speed covered by CharSummary-SpeedCalculations.test.jsx)
// ---------------------------------------------------------------------------
describe('CharSummary - Climb Speed (buff override)', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it('renders climb speed from Aspect of the Wilds (Panther) overriding playerStats', () => {
        getActiveBuffs.mockReturnValue([{ name: 'Aspect of the Wilds', effect: 'climb_speed_aspect', optionName: 'Panther' }]);
        const stats = { ...mockPlayerStats, climbSpeed: 40 };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/climb 25 ft/)).toBeInTheDocument();
        expect(screen.queryByText(/climb 40 ft/)).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Swim speed — aquatic_adaptation override (base speed covered by CharSummary-SpeedCalculations.test.jsx)
// ---------------------------------------------------------------------------
describe('CharSummary - Swim Speed (buff override)', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it('aquatic_adaptation sets swimSpeed to 2x base speed even when playerStats.swimSpeed is set', () => {
        getActiveBuffs.mockReturnValue([{ effect: 'aquatic_adaptation' }]);
        const stats = { ...mockPlayerStats, swimSpeed: 40 };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/swim 50 ft/)).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Stormborn resistances — conditional rendering based on wrathOfTheSeaActive
// ---------------------------------------------------------------------------
describe('CharSummary - Stormborn Resistances', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it('renders stormborn resistances when wrathOfTheSeaActive and passives contain stormborn', () => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
            if (key === 'wrathOfTheSeaActive') return true;
            return null;
        });
        const stats = {
            ...mockPlayerStats,
            automation: {
                ...mockPlayerStats.automation,
                passives: [{ type: 'resistance', name: 'Stormborn', damageTypes: ['cold'] }],
            },
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Cold/)).toBeInTheDocument();
    });

    it('renders multiple stormborn damage types when wrathOfTheSeaActive', () => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
            if (key === 'wrathOfTheSeaActive') return true;
            return null;
        });
        const stats = {
            ...mockPlayerStats,
            automation: {
                ...mockPlayerStats.automation,
                passives: [{ type: 'resistance', name: 'Stormborn', damageTypes: ['cold', 'lightning'] }],
            },
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Cold/)).toBeInTheDocument();
        expect(screen.getByText(/Lightning/)).toBeInTheDocument();
    });

    it.each([
        [false, 'false'],
        [undefined, 'undefined'],
        [null, 'null'],
    ])('does not render stormborn resistances when wrathOfTheSeaActive is %s', (_value, _label) => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
            if (key === 'wrathOfTheSeaActive') return _value;
            return null;
        });
        const stats = {
            ...mockPlayerStats,
            automation: {
                ...mockPlayerStats.automation,
                passives: [{ type: 'resistance', name: 'Stormborn', damageTypes: ['cold'] }],
            },
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.queryByText(/Cold/)).not.toBeInTheDocument();
    });
});
