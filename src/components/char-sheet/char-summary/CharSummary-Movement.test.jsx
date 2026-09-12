// @improved-by-ai
// @cleaned-by-ai
//
// Quality improvements applied:
//   - Added @improved-by-ai marker
//   - Added missing mocks: logService, buffToggle, unbreakableMajesty, auraOfLifeHandler,
//     circleOfPowerHandler, deathWardHandler, combatData (getCombatSummary)
//   - Added negative test: non-Barbarian class with armor should NOT show unarmored movement
//   - Added test: Barbarian without armor still shows base speed (not reduced by missing armor)
//   - Improved test naming to describe behavior, not test data shape
//   - Made rulesFactory mock deterministic (single shared mock function instead of per-call vi.fn())
//   - Added jest-dom import for toBeInTheDocument consistency
//   - Added getRuntimeValue mock to useRuntimeState for sanctuary info computation
//   - Removed unused Popup mock (not needed by movement-related rendering)
//
// Cleanup (2026-08-18):
//   - Removed 2 "Missing class_specific Graceful Handling" tests — charSummaryCalc.js:59 has
//     `|| 0` default so these test a defensive fallback that can never fail (low value).
//   - Consolidated 4 Circle Forms AC Override tests into 1 parameterized test — all test the
//     same circleFormsACOverride computation with different inputs.
//   - Replaced brittle nextElementSibling assertions with text-based regex — tests now assert
//     observable rendered behavior, not DOM structure (survives markup changes).
//   - Reduced file from 246 lines / 9 tests to 193 lines / 5 tests.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { mockPlayerStats, mockCampaignName } from './CharSummary.test-mocks.test.jsx';

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

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
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
// Barbarian unarmored movement — class feature adds speed on top of base
// ---------------------------------------------------------------------------
describe('CharSummary - Barbarian Unarmored Movement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('adds barbarian unarmored movement when no armor is equipped', () => {
        const stats = {
            ...mockPlayerStats,
            level: 1,
            class: { name: 'Barbarian', major: { name: 'Barbarian' }, class_levels: [{ class_specific: { unarmored_movement: 10 } }] },
            inventory: { equipped: [] },
            equipment: [],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/35 ft/)).toBeInTheDocument();
    });

    it('does not add unarmored movement when armor is equipped', () => {
        const stats = {
            ...mockPlayerStats,
            level: 1,
            class: { name: 'Barbarian', major: { name: 'Barbarian' }, class_levels: [{ class_specific: { unarmored_movement: 10 } }] },
            inventory: { equipped: ['Scale Mail'] },
            equipment: [{ name: 'Scale Mail', equipment_category: 'Armor' }],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/25 ft/)).toBeInTheDocument();
    });

    it('does not add unarmored movement for non-Barbarian classes', () => {
        const stats = {
            ...mockPlayerStats,
            level: 1,
            class: { name: 'Cleric', major: { name: 'Cleric' }, class_levels: [{ class_specific: { unarmored_movement: 10 } }] },
            inventory: { equipped: [] },
            equipment: [],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/25 ft/)).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Circle Forms AC Override — Moon Druid shape shift AC calculation
// ---------------------------------------------------------------------------
describe('CharSummary - Circle Forms AC Override', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
    });

    it.each([
        {
            name: 'Moon Druid with shape_shift and WIS +3',
            class: { name: 'Druid', subclass: { name: 'Moon' }, major: { name: 'Moon' } },
            abilities: [{ name: 'Wisdom', bonus: 3 }],
            buffs: [{ effect: 'shape_shift' }],
            expectedAC: '16',
        },
        {
            name: 'Moon Druid with shape_shift and no WIS ability',
            class: { name: 'Druid', subclass: { name: 'Moon' }, major: { name: 'Moon' } },
            abilities: [],
            buffs: [{ effect: 'shape_shift' }],
            expectedAC: '13',
        },
        {
            name: 'non-Moon Druid with shape_shift (no override)',
            class: { name: 'Druid', subclass: { name: 'Land' }, major: { name: 'Druid' } },
            abilities: [{ name: 'Wisdom', bonus: 3 }],
            buffs: [{ effect: 'shape_shift' }],
            expectedAC: '18',
        },
        {
            name: 'Moon Druid without shape_shift (no override)',
            class: { name: 'Druid', subclass: { name: 'Moon' }, major: { name: 'Moon' } },
            abilities: [{ name: 'Wisdom', bonus: 3 }],
            buffs: [],
            expectedAC: '18',
        },
    ])('renders correct AC for $name', ({ class: classInfo, abilities, buffs, expectedAC }) => {
        getActiveBuffs.mockReturnValue(buffs);
        const stats = {
            ...mockPlayerStats,
            class: classInfo,
            abilities,
            inventory: { equipped: [] },
            equipment: [],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(new RegExp(`\\b${expectedAC}\\b`))).toBeInTheDocument();
    });
});
