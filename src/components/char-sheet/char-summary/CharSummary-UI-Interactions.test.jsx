// @improved-by-ai
// @cleaned-by-ai
//
// Quality improvements:
//   - Added missing mock for useDiceRollPopup (component calls it, was crashing)
//   - Added missing mocks for unmocked subcomponents
//     (AllySelectionModal, TrackedResourceInput, CreatureBadge, ConditionEffectBadges)
//   - Replaced window.location.hostname assignment with Object.defineProperty
//   - Removed duplicate/dead rulesFactory mock (not imported by CharSummary)
//   - Replaced expect.any(Function) with captured setPopupHtml reference
//   - Added assertion verifying rendered background text in positive test
//
// Cleanup (2026-08-18):
//   - Removed low-value negative test "does not call showBackgroundPopup when background is empty"
//     — trivial JavaScript truthiness conditional rendering, zero unique behavioral coverage.
//     Background rendering for empty/null values is covered by CharSummary-Display.test.jsx.
//   - Removed 5 unused mocks: CreatureBadge, ConditionEffectBadges, AllySelectionModal,
//     TrackedResourceInput, ShortRestModal — none exercised by background popup tests.
//   - Removed unused isBuffActive, unbreakableMajesty, auraOfLifeHandler, circleOfPowerHandler,
//     deathWardHandler mocks — not exercised by the background popup code path.
//   - Consolidated from 2 tests / 164 lines to 1 test / ~115 lines.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSummary from './CharSummary.jsx';
import { showBackgroundPopup } from '../../../hooks/combat/useActionPopup.js';
import { useDiceRollPopup } from '../../../hooks/combat/DiceRollContext.js';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';

vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('../char-feats/CharFeats.jsx', () => ({ default: () => <div data-testid="char-feats">Feats</div> }));
vi.mock('../../common/AvatarImage.jsx', () => ({ default: () => <div data-testid="avatar-image">Avatar</div> }));
vi.mock('../../common/AvatarModal.jsx', () => ({ default: () => null }));
vi.mock('../LongRestButton.jsx', () => ({ default: () => <div data-testid="long-rest-btn">Long Rest</div> }));
vi.mock('../ShortRestButton.jsx', () => ({ default: () => <div data-testid="short-rest-btn">Short Rest</div> }));
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

let setPopupHtml;

vi.mock('../../../hooks/combat/DiceRollContext.js', () => ({
    useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
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

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

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

// ---------------------------------------------------------------------------
// Background popup — calls showBackgroundPopup with correct args
// Unique behavioral coverage not present in any other test file.
// ---------------------------------------------------------------------------
describe('CharSummary - Background Popup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(window, 'location', {
            value: { hostname: 'localhost' },
            writable: true,
        });
        getActiveBuffs.mockReturnValue([]);
        setPopupHtml = vi.fn();
        vi.mocked(useDiceRollPopup).mockImplementation(() => ({ setPopupHtml }));
    });

    it('calls showBackgroundPopup with background name, setPopupHtml, and rules when background exists', () => {
        const stats = {
            ...mockPlayerStats,
            background: 'Soldier',
            rules: '5e',
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const bgEl = screen.getByText('Soldier');
        expect(bgEl).toBeInTheDocument();
        bgEl.click();
        expect(showBackgroundPopup).toHaveBeenCalledWith('Soldier', setPopupHtml, '5e');
    });
});
