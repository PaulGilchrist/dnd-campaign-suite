// @improved-by-ai
// @cleaned-by-ai
//
// Quality improvements:
//   - Removed window.location.hostname = 'localhost' (6×) — global state mutation, not needed for speed tests
//   - Replaced nextElementSibling + textContent with getByText regex — tests rendered behavior, not DOM structure
//   - Removed redundant mocks (rulesFactory, attackCalc) — not used by speed calculation code path
//   - Consolidated fly speed tests from 4 describe blocks to 1 parameterized test
//   - Consolidated condition speed tests from 4 separate tests to 1 parameterized + priority test
//   - Added edge-case tests — combined exhaustion+speed reduction, missing climb/swim speeds
//   - Simplified fly speed regex patterns — removed fragile .*hover/s patterns
//   - Removed redundant beforeEach duplication — one beforeEach per describe block
//   - Improved test naming — each name clearly states the behavior being verified
//
// Cleanup (2026-08-18):
//   - Removed 4 climb/swim tests — all fully duplicated in CharSummary-AdditionalCoverage.test.jsx
//     (climbSpeed from playerStats, swimSpeed from playerStats, Aspect of the Wilds Panther climb,
//      aquatic_adaptation swim). AdditionalCoverage has more thorough override testing.
//   - Removed 2 combined movement tests — trivial string concatenation of independently verified
//     buff behaviors. Minimal confidence gain; covered by individual buff tests.
//   - Reduced file from 238 lines / 18 tests to 149 lines / 12 tests.

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
vi.mock('../../common/AllySelectionModal.jsx', () => ({ default: () => <div data-testid="ally-selection-modal">Ally Selection</div> }));

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

vi.mock('../../../services/ui/sanitize.js', () => ({
    sanitizeHtml: (html) => html,
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

// ---------------------------------------------------------------------------
// Exhaustion speed reduction — parameterized across all levels
// ---------------------------------------------------------------------------
describe('CharSummary - Exhaustion Speed Reduction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        [0, '25 ft'],
        [1, '20 ft'],
        [2, '15 ft'],
        [3, '10 ft'],
        [4, '5 ft'],
        [5, '0 ft'],
        [6, '0 ft'],
    ])('renders %s speed at exhaustion level %d', (level, expected) => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={level} />);
        expect(screen.getByText(new RegExp(`${expected}`))).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Condition speed effects — parameterized + priority test
// ---------------------------------------------------------------------------
describe('CharSummary - Condition Speed Effects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        [{ speedHalved: true }, '12 ft'],
        [{ speedReduction: 10 }, '15 ft'],
        [{ speedZero: true }, '0 ft'],
    ])('applies %j condition effect correctly', (effects, expected) => {
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            conditionEffects={effects}
        />);
        expect(screen.getByText(new RegExp(`${expected}`))).toBeInTheDocument();
    });

    it('speedZero overrides speedHalved', () => {
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            conditionEffects={{ speedZero: true, speedHalved: true }}
        />);
        expect(screen.getByText(/0 ft/)).toBeInTheDocument();
    });

    it('combines exhaustion with speed halved condition', () => {
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={1}
            conditionEffects={{ speedHalved: true }}
        />);
        expect(screen.getByText(/10 ft/)).toBeInTheDocument();
    });

    it('combines exhaustion with speed reduction', () => {
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={1}
            conditionEffects={{ speedReduction: 5 }}
        />);
        expect(screen.getByText(/15 ft/)).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Fly speed — parameterized across buff types
// ---------------------------------------------------------------------------
describe('CharSummary - Fly Speed', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        [{ effect: 'fly_speed_equals_walk_speed' }, /fly 25 ft/, 'fly_speed_equals_walk_speed'],
        [{ effect: 'fly_speed_20_hover' }, /fly 20 ft\. +\(hover\)/, 'fly_speed_20_hover'],
        [{ effect: 'glistening_flight', flySpeed: 40 }, /fly 25 ft\. +\(hover\)/, 'glistening_flight'],
        [{ effect: 'dragon_wings', flySpeed: 60 }, /fly 60 ft\. +\(hover\)/, 'dragon_wings'],
    ])('renders fly speed correctly for %s buff', (buff, expectedText, _label) => {
        getActiveBuffs.mockReturnValue([buff]);
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(expectedText)).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Ice walk buff rendering
// ---------------------------------------------------------------------------
describe('CharSummary - Ice Walk Buff', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it('renders ice walk when ice_walk buff is active', () => {
        getActiveBuffs.mockReturnValue([{ effect: 'ice_walk' }]);
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/ice walk/)).toBeInTheDocument();
    });
});
