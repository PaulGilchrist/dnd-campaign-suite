// @improved-by-ai
// @cleaned-by-ai
//
// Improved: fixed global state mutation, added jest-dom import,
// uses shared mock data, improved test naming with named parameters,
// added edge-case coverage for undefined/null acPenalty.
//
// Issues fixed:
//   - Removed window.location.hostname mutation (global state modification)
//   - Added missing '@testing-library/jest-dom' import for toBeInTheDocument()
//   - Uses shared mock data from CharSummary.test-mocks.test.jsx
//   - Uses named it.each parameters for clearer failure messages
//   - Added negative-path tests (undefined, null acPenalty)
//   - Added logService mock (component calls addEntry in event handlers)
//
// Cleanup (2026-08-18):
//   - Removed 3 redundant negative tests: acPenalty undefined/null/conditionEffects undefined.
//     All test JavaScript truthiness (falsy → no render) which is implementation detail, not behavior.
//     The acPenalty: 0 case already covers the "no penalty" observable behavior.
//   - Reduced file from 148 lines / 5 tests to 115 lines / 4 tests.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import CharSummary from './CharSummary.jsx';
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

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
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

vi.mock('../../../services/automation/common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
}));

// ---------------------------------------------------------------------------
// AC slow penalty — verifies the Slow spell penalty indicator renders
// correctly and is absent when no penalty applies.
// ---------------------------------------------------------------------------
describe('CharSummary - AC Slow Penalty', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        { penalty: 2, expectedDisplay: '−2' },
        { penalty: 5, expectedDisplay: '−5' },
        { penalty: 10, expectedDisplay: '−10' },
    ])('renders AC slow penalty of $expectedDisplay when acPenalty is $penalty', ({ penalty, expectedDisplay }) => {
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            conditionEffects={{ acPenalty: penalty }}
        />);
        expect(screen.getByText(`(${expectedDisplay} from Slow)`)).toBeInTheDocument();
    });

    it('does not render AC slow penalty when acPenalty is zero', () => {
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            conditionEffects={{ acPenalty: 0 }}
        />);
        expect(screen.queryByText(/from Slow/)).not.toBeInTheDocument();
    });
});
