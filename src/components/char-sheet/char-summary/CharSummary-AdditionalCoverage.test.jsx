// @maintained-by-ai
//
// Lane: speed overrides derived from activeBuffs/playerStats priority chains
// (deriveAspectSpeeds + aquatic_adaptation) and Stormborn resistances gated on
// wrathOfTheSeaActive (computeResistances). Stormborn is covered ONLY here;
// sibling files (Movement, SpeedCalculations, PassiveEffects, ResistanceTypes)
// explicitly delegate climb/swim overrides and Stormborn to this file.
// Wrath-of-the-Sea badge rendering is covered in CharSummary-Badges.test.jsx —
// here the badge is only asserted as a side-pin of the same gate.

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

// Full exact Speed-row text — pins walk speed plus which appendages appear,
// in render order, so a leaked or missing climb/swim value fails even when
// the walk number is coincidentally right.
const speedRow = () => screen.getByText(/^\d+ ft\./);

// ---------------------------------------------------------------------------
// Movement speed overrides — priority chains in deriveAspectSpeeds and the
// aquatic_adaptation buff handler (buff wins over playerStats, Panther/Salmon
// climb/swim scale with buffed speed).
// ---------------------------------------------------------------------------
describe('CharSummary - climb/swim speed overrides', () => {
    it('shows climb and swim speeds straight from playerStats when no buffs override them', () => {
        renderSummary({ ...mockPlayerStats, climbSpeed: 40, swimSpeed: 40 });
        expect(speedRow()).toHaveTextContent(/^25 ft\., climb 40 ft\., swim 40 ft\.$/);
    });

    it('Aspect of the Wilds (Panther) climb tracks base + speed buffs, overriding playerStats.climbSpeed', () => {
        getActiveBuffs.mockReturnValue([
            { name: 'Aspect of the Wilds', effect: 'climb_speed_aspect', optionName: 'Panther' },
            { name: 'Longstrider', effect: 'speed_boost', speedBonus: 10 },
        ]);
        renderSummary({ ...mockPlayerStats, climbSpeed: 40 });
        expect(speedRow()).toHaveTextContent(/^35 ft\., climb 35 ft\.$/);
    });

    it('Aspect of the Wilds (Salmon) grants swim equal to base speed and no climb', () => {
        getActiveBuffs.mockReturnValue([{ name: 'Aspect of the Wilds', effect: 'climb_speed_aspect', optionName: 'Salmon' }]);
        renderSummary(mockPlayerStats);
        expect(speedRow()).toHaveTextContent(/^25 ft\., swim 25 ft\.$/);
    });

    it('aquatic_adaptation swim is 2x base speed, overriding playerStats.swimSpeed', () => {
        getActiveBuffs.mockReturnValue([{ effect: 'aquatic_adaptation' }]);
        renderSummary({ ...mockPlayerStats, swimSpeed: 40 });
        expect(speedRow()).toHaveTextContent(/^25 ft\., swim 50 ft\.$/);
    });
});

// ---------------------------------------------------------------------------
// Stormborn resistances — the Resistances line requires BOTH an active
// wrathOfTheSeaActive flag in the runtime store AND Stormborn damage types
// on the character (computeResistances gate); the badge pins the flag alone.
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

    it('renders every Stormborn damage type and the Wrath of the Sea badge while active', () => {
        mockWrathOfTheSea(true);
        renderSummary(statsWithStormborn(['cold', 'lightning']));
        expect(screen.getByText('Resistances:').closest('div')).toHaveTextContent('Resistances: Cold, Lightning');
        expect(screen.getByText('Wrath of the Sea')).toBeInTheDocument();
    });

    it('shows the badge but no Resistances line when active with no Stormborn damage types', () => {
        mockWrathOfTheSea(true);
        renderSummary(mockPlayerStats);
        expect(screen.queryByText('Resistances:')).not.toBeInTheDocument();
        expect(screen.getByText('Wrath of the Sea')).toBeInTheDocument();
    });

    it('hides the Resistances line and Wrath of the Sea badge when inactive despite Stormborn passives', () => {
        mockWrathOfTheSea(false);
        renderSummary(statsWithStormborn(['cold', 'lightning']));
        expect(screen.queryByText('Resistances:')).not.toBeInTheDocument();
        expect(screen.queryByText('Wrath of the Sea')).not.toBeInTheDocument();
    });
});
