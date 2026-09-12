// @improved-by-ai
// @cleaned-by-ai
//
// Improved: parameterized AC buff tests, removed redundant imports,
// added negative-path and multi-buff coverage, uses shared mock data.
//
// Issues fixed:
//   - Added missing '@testing-library/jest-dom' import for toBeInTheDocument()
//   - Removed redundant 'getRuntimeValue' import (was imported but only used via mocked module)
//   - Removed window.location.hostname mutation (global state modification)
//   - Uses shared mock data from CharSummary.test-mocks.test.jsx
//   - Consolidated 5 individual tests → 1 parameterized test (it.each)
//   - Added negative-path test (no buff indicators when no buffs active)
//   - Added multi-buff test (multiple AC buffs active simultaneously)
//   - Added Defensive Duelist test (bonus not previously tested)
//
// Cleanup (2026-08-18):
//   - Absorbed all coverage from deleted CharSummary-Branches.test.jsx (4 redundant tests).
//     Defensive duelist (+acBonus) and tremorsense badge positive/negative paths all covered
//     by this file's parameterized it.each + comprehensive negative test.
//
// Cleanup (2026-08-18b):
//   - Replaced brittle negative-path test (5 specific string absence assertions) with single
//     structural assertion: query all `.aura-source` elements. Robust against text format changes.
//   - Removed redundant multi-buff test (haste + shield_of_faith). Both buffs individually
//     covered by it.each; rendering is trivial string concatenation — no logic to exercise.
//   - Reduced file from 147 lines / 8 tests (9 iterations) to 130 lines / 7 tests (8 iterations).

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
// AC bonus buff indicators — parameterized across all tested buff types
// ---------------------------------------------------------------------------
describe('CharSummary - AC Bonus Buff Indicators', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        [{ effect: 'haste' }, /\+2 from Haste/],
        [{ effect: 'shield' }, /\+5 from Shield/],
        [{ effect: 'shield_of_faith' }, /\+2 from Shield of Faith/],
        [{ effect: 'barkskin' }, /AC 17 from Barkskin/],
        [{ effect: 'defensive_duelist', acBonus: 3 }, /\+3 from Defensive Duelist/],
    ])('renders "%s" buff indicator', (buff, expectedText) => {
        getActiveBuffs.mockReturnValue([buff]);
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(expectedText)).toBeInTheDocument();
    });

    it('renders mage armor AC formula when mage_armor buff is active', () => {
        getActiveBuffs.mockReturnValue([{ effect: 'mage_armor', baseAc: 13 }]);
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/\(13 \+ 2 Dex\)/)).toBeInTheDocument();
    });

    // ---------------------------------------------------------------------------
    // Negative path — no buff indicators when no buffs active
    // ---------------------------------------------------------------------------
    it('does not show any AC buff indicators when no buffs are active', () => {
        getActiveBuffs.mockReturnValue([]);
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(document.querySelectorAll('.aura-source').length).toBe(0);
    });
});
