// @improved-by-ai
//
// Lane: speed overrides derived from activeBuffs/playerStats priority chains
// (deriveAspectSpeeds + aquatic_adaptation) and Stormborn resistances gated on
// wrathOfTheSeaActive (computeResistances). Stormborn is covered ONLY here.
//
// Cleanup (2026-08-19):
//   - Restored climb/swim-from-playerStats and Salmon swim tests: SpeedCalculations
//     delegated them here ("fully duplicated in AdditionalCoverage") while this file
//     had removed them pointing back at SpeedCalculations — a circular delegation gap
//     leaving those branches covered nowhere.
//   - Added Panther-climb-scaling test (climb = totalSpeed + buffSpeedBonus via
//     speed_boost) — the arithmetic on charSummaryCalc.js:265 was untested.
//   - Stormborn positives: exact Resistances-line content assertions replace loose
//     /Cold/ regex; also pins the Wrath of the Sea badge rendered from the same
//     wrathOfTheSeaActive gate. Negatives assert the whole line/badge is absent.
//   - Stormborn positives consolidated into one parameterized it.each (same code path).
//   - Imports shared mockPlayerStats/mockCampaignName (removed 30-line local duplicate);
//     tests add per-test overrides via spread.
//   - Single module-level beforeEach replaces three identical blocks; removed redundant
//     per-describe getActiveBuffs.mockReturnValue([]) where the default applies.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
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

beforeEach(() => {
    vi.resetAllMocks();
    getActiveBuffs.mockReturnValue([]);
});

function renderSummary(stats) {
    return render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
}

// ---------------------------------------------------------------------------
// Movement speed overrides — priority chains in deriveAspectSpeeds and the
// aquatic_adaptation buff handler (buff wins over playerStats, Panther/Salmon
// climb/swim scale with buffed speed).
// ---------------------------------------------------------------------------
describe('CharSummary - climb/swim speed overrides', () => {
    it('shows climb speed from playerStats when no buffs override it', () => {
        renderSummary({ ...mockPlayerStats, climbSpeed: 40 });
        expect(screen.getByText(/climb 40 ft\./)).toBeInTheDocument();
    });

    it('shows swim speed from playerStats when no buffs override it', () => {
        renderSummary({ ...mockPlayerStats, swimSpeed: 40 });
        expect(screen.getByText(/swim 40 ft\./)).toBeInTheDocument();
    });

    it('Aspect of the Wilds (Panther) climb uses base speed, overriding playerStats.climbSpeed', () => {
        getActiveBuffs.mockReturnValue([{ name: 'Aspect of the Wilds', effect: 'climb_speed_aspect', optionName: 'Panther' }]);
        renderSummary({ ...mockPlayerStats, climbSpeed: 40 });
        expect(screen.getByText(/climb 25 ft\./)).toBeInTheDocument();
        expect(screen.queryByText(/climb 40 ft\./)).not.toBeInTheDocument();
    });

    it('Aspect of the Wilds (Panther) climb scales with speed buffs (base + 10)', () => {
        getActiveBuffs.mockReturnValue([
            { name: 'Aspect of the Wilds', effect: 'climb_speed_aspect', optionName: 'Panther' },
            { name: 'Longstrider', effect: 'speed_boost', speedBonus: 10 },
        ]);
        renderSummary({ ...mockPlayerStats, climbSpeed: 40 });
        expect(screen.getByText(/climb 35 ft\./)).toBeInTheDocument();
        expect(screen.queryByText(/climb 25 ft\./)).not.toBeInTheDocument();
    });

    it('Aspect of the Wilds (Salmon) grants swim equal to base speed and no climb', () => {
        getActiveBuffs.mockReturnValue([{ name: 'Aspect of the Wilds', effect: 'climb_speed_aspect', optionName: 'Salmon' }]);
        renderSummary(mockPlayerStats);
        expect(screen.getByText(/swim 25 ft\./)).toBeInTheDocument();
        expect(screen.queryByText(/climb/)).not.toBeInTheDocument();
    });

    it('aquatic_adaptation swim is 2x base speed, overriding playerStats.swimSpeed', () => {
        getActiveBuffs.mockReturnValue([{ effect: 'aquatic_adaptation' }]);
        renderSummary({ ...mockPlayerStats, swimSpeed: 40 });
        expect(screen.getByText(/swim 50 ft\./)).toBeInTheDocument();
        expect(screen.queryByText(/swim 40 ft\./)).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Stormborn resistances — only surfaced while wrathOfTheSeaActive is set in
// the runtime store (computeResistances gate).
// ---------------------------------------------------------------------------
describe('CharSummary - Stormborn Resistances', () => {
    function mockWrathOfTheSea(active) {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
            key === 'wrathOfTheSeaActive' ? active : null);
    }

    function statsWithStormborn(damageTypes) {
        return {
            ...mockPlayerStats,
            automation: {
                ...mockPlayerStats.automation,
                passives: [{ type: 'resistance', name: 'Stormborn', damageTypes }],
            },
        };
    }

    it.each([
        [['cold'], 'Resistances: Cold'],
        [['cold', 'lightning'], 'Resistances: Cold, Lightning'],
    ])('renders Stormborn damage types and Wrath of the Sea badge while active (%#)', async (damageTypes, expectedLine) => {
        mockWrathOfTheSea(true);
        renderSummary(statsWithStormborn(damageTypes));
        expect(screen.getByText('Resistances:').closest('div')).toHaveTextContent(expectedLine);
        expect(screen.getByText('Wrath of the Sea')).toBeInTheDocument();
    });

    it.each([false, null, undefined])('hides the Resistances line and Wrath of the Sea badge when wrathOfTheSeaActive is %s', (active) => {
        mockWrathOfTheSea(active);
        renderSummary(statsWithStormborn(['cold']));
        expect(screen.queryByText('Resistances:')).not.toBeInTheDocument();
        expect(screen.queryByText('Wrath of the Sea')).not.toBeInTheDocument();
    });
});
