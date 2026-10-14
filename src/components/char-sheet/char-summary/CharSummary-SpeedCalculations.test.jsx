// @maintained-by-ai
//
// CharSummary speed-row calculations — the ONLY owner in the CharSummary family of:
// exhaustion reduction (applySpeedConditions), condition speed effects
// (speedHalved / speedReduction / speedZero + halved-source notice), fly-speed
// suffixes, and ice walk.
// Delegated to siblings (do not duplicate here):
//   - Barbarian/Monk unarmored movement .......... CharSummary-Movement.test.jsx
//   - passive speed_bonus / speed_increase /
//     acrobatic_movement / aquatic_affinity ...... CharSummary-PassiveEffects.test.jsx
//   - climb/swim overrides, Aspect of the Wilds,
//     aquatic_adaptation ......................... CharSummary-AdditionalCoverage.test.jsx
//   - fly-buff "Active" badges ................... CharSummary-Badges*.test.jsx
//
// Each case here must discriminate: linear-coefficient levels are sampled once
// (level 2 pins the −5/level slope; level 6 uniquely pins the clamp at 0 —
// level 5 would render 0 even without the clamp), speedZero's early-return is
// proven by the standalone case alone (adding halve/reduce flags on top can
// never change a 0 output), and "reduce after exhaustion" is dropped because
// exhaustion and flat reduction are both subtractions (order cannot diverge).

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

// ---------------------------------------------------------------------------
// Helpers — Speed row renders <b>Speed: </b><span>{n} ft.{suffix}</span>.
// mockPlayerStats base: Hill Dwarf, 25 ft walk, no climb/swim/fly.
// ---------------------------------------------------------------------------
const renderSummary = ({ stats = mockPlayerStats, buffs = [], exhaustionLevel = 0, conditionEffects } = {}) => {
    getActiveBuffs.mockReturnValue(buffs);
    render(
        <CharSummary
            playerStats={stats}
            campaignName={mockCampaignName}
            exhaustionLevel={exhaustionLevel}
            conditionEffects={conditionEffects}
        />
    );
};

const speedSpan = () => screen.getByText(/^\d+ ft\./);

beforeEach(() => {
    vi.clearAllMocks();
    getActiveBuffs.mockReturnValue([]);
});

// ---------------------------------------------------------------------------
// Exhaustion: 25 − 5/level, clamped at 0 (level 2 pins the slope,
// level 6 pins the clamp — the only value that goes negative unclamped)
// ---------------------------------------------------------------------------
describe('exhaustion reduces walk speed by 5 ft per level', () => {
    it.each([
        { level: 2, text: /^15 ft\.$/, label: '−5 ft per level' },
        { level: 6, text: /^0 ft\.$/, label: 'clamped at zero, never negative' },
    ])('exhaustion level $level ($label) shows $text', ({ level, text }) => {
        renderSummary({ exhaustionLevel: level });
        expect(speedSpan()).toHaveTextContent(text);
    });
});

// ---------------------------------------------------------------------------
// Condition speed effects — halved (with source notice), flat reduction,
// zero, halve-before-reduce ordering, clamp after reduction
// ---------------------------------------------------------------------------
describe('condition speed effects', () => {
    it.each([
        {
            effects: { speedHalved: true },
            text: /^12 ft\.$/,
            notice: '(Speed halved from Slow)',
            label: 'speed halved with floor (25 → 12), generic Slow notice',
        },
        {
            effects: { speedHalved: true, speedHalvedSource: 'Ray of Enfeeblement' },
            text: /^12 ft\.$/,
            notice: '(Speed halved by Ray of Enfeeblement)',
            label: 'halved notice names the provided source',
        },
        {
            effects: { speedReduction: 10 },
            text: /^15 ft\.$/,
            notice: null,
            label: 'flat reduction (25 − 10), no halved notice',
        },
        {
            effects: { speedZero: true },
            text: /^0 ft\.$/,
            notice: null,
            label: 'speed set to zero, no halved notice',
        },
    ])('$label', ({ effects, text, notice }) => {
        renderSummary({ conditionEffects: effects });
        expect(speedSpan()).toHaveTextContent(text);
        if (notice) {
            expect(screen.getByText(notice)).toBeInTheDocument();
        } else {
            expect(screen.queryByText(/\(Speed halved/)).not.toBeInTheDocument();
        }
    });

    it('halves before applying a flat reduction (25 → 12 → 2, not 7)', () => {
        renderSummary({ conditionEffects: { speedHalved: true, speedReduction: 10 } });
        expect(speedSpan()).toHaveTextContent(/^2 ft\.$/);
    });

    it('never renders negative speed when the reduction exceeds remaining speed', () => {
        renderSummary({ exhaustionLevel: 4, conditionEffects: { speedReduction: 10 } });
        expect(speedSpan()).toHaveTextContent(/^0 ft\.$/);
    });

    it('halves the exhaustion-reduced walk speed (25 − 5 → 10, not 7)', () => {
        renderSummary({ exhaustionLevel: 1, conditionEffects: { speedHalved: true } });
        expect(speedSpan()).toHaveTextContent(/^10 ft\.$/);
    });
});

// ---------------------------------------------------------------------------
// Fly speed suffix — mirroring, fixed, own-speed, hover, exhaustion-aware
// ---------------------------------------------------------------------------
describe('fly speed suffix from buffs', () => {
    it.each([
        { buff: { effect: 'fly_speed_equals_walk_speed' }, text: /^25 ft\., fly 25 ft\.\s*$/, label: 'generic fly mirrors walk speed, no hover' },
        { buff: { effect: 'fly_speed_20_hover' }, text: /^25 ft\., fly 20 ft\.\s+\(hover\)\s*$/, label: 'fixed 20 ft fly with hover' },
        { buff: { effect: 'dragon_wings', flySpeed: 60 }, text: /^25 ft\., fly 60 ft\.\s+\(hover\)\s*$/, label: 'dragon_wings uses its own flySpeed' },
        { buff: { effect: 'glistening_flight', flySpeed: 40 }, text: /^25 ft\., fly 25 ft\.\s+\(hover\)\s*$/, label: 'glistening_flight mirrors walk speed with hover, ignoring any provided flySpeed' },
    ])('$label', ({ buff, text }) => {
        renderSummary({ buffs: [buff] });
        expect(speedSpan()).toHaveTextContent(text);
    });

    it('mirrored fly follows the exhaustion-reduced walk speed (exhaustion 1 → fly 20 ft)', () => {
        renderSummary({ buffs: [{ effect: 'fly_speed_equals_walk_speed' }], exhaustionLevel: 1 });
        expect(speedSpan()).toHaveTextContent(/^20 ft\., fly 20 ft\.\s*$/);
    });
});

// ---------------------------------------------------------------------------
// Ice walk suffix + plain-speed negative control
// ---------------------------------------------------------------------------
describe('ice walk suffix', () => {
    it('appends ", ice walk" to the speed row when the ice_walk buff is active', () => {
        renderSummary({ buffs: [{ effect: 'ice_walk' }] });
        expect(speedSpan()).toHaveTextContent(/^25 ft\., ice walk$/);
    });

    it('renders plain walk speed when no fly or ice-walk effects are active', () => {
        renderSummary();
        expect(speedSpan()).toHaveTextContent(/^25 ft\.$/);
    });
});
