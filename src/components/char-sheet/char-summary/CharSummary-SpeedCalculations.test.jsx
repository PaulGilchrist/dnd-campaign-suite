// @improved-by-ai
//
// CharSummary speed-row calculations — the ONLY owner in the CharSummary family of:
// exhaustion reduction (applySpeedConditions), condition speed effects
// (speedHalved / speedReduction / speedZero), fly-speed suffixes, and ice walk.
// Delegated to siblings (do not duplicate here):
//   - Barbarian/Monk unarmored movement .......... CharSummary-Movement.test.jsx
//   - passive speed_bonus / speed_increase /
//     acrobatic_movement / aquatic_affinity ...... CharSummary-PassiveEffects.test.jsx
//   - climb/swim overrides, Aspect of the Wilds,
//     aquatic_adaptation ......................... CharSummary-AdditionalCoverage.test.jsx
//   - fly-buff "Active" badges ................... CharSummary-Badges*.test.jsx
//
// Quality improvements (2026-10-14):
//   - All speed assertions now target the Speed-row span (speedSpan(), the family
//     convention) and match its FULL text. The previous page-wide /5 ft/ and
//     /0 ft/ regexes also matched substrings of "25 ft." and "10 ft.", so the
//     exhaustion ladder could be completely broken and the tests still passed.
//   - Added previously untested behavior: halve-then-reduce ordering, floor clamp
//     at 0 ft, the "Speed halved" penalty notice incl. speedHalvedSource, fly
//     mirroring exhaustion-reduced walk speed, glistening_flight ignoring a
//     provided flySpeed, and negative paths (no fly / no ice walk suffix).
//   - Consolidated 4 identical beforeEach blocks into one; dropped the
//     AllySelectionModal mock (closed modal renders nothing — same mock set as
//     CharSummary-Movement.test.jsx); removed the stale header (claimed 12
//     tests, file had 18).

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
// Exhaustion: 25 − 5/level, clamped at 0 (levels 5–6 never go negative)
// ---------------------------------------------------------------------------
describe('exhaustion reduces walk speed by 5 ft per level', () => {
    it.each([
        { level: 0, text: /^25 ft\.$/, label: 'baseline, no reduction' },
        { level: 1, text: /^20 ft\.$/, label: '−5 ft' },
        { level: 2, text: /^15 ft\.$/, label: '−10 ft' },
        { level: 3, text: /^10 ft\.$/, label: '−15 ft' },
        { level: 4, text: /^5 ft\.$/, label: '−20 ft' },
        { level: 5, text: /^0 ft\.$/, label: 'speed reduced to zero' },
        { level: 6, text: /^0 ft\.$/, label: 'clamped at zero, never negative' },
    ])('exhaustion level $level ($label) shows $text', ({ level, text }) => {
        renderSummary({ exhaustionLevel: level });
        expect(speedSpan()).toHaveTextContent(text);
    });
});

// ---------------------------------------------------------------------------
// Condition speed effects — halved, flat reduction, zero, precedence, clamping
// ---------------------------------------------------------------------------
describe('condition speed effects', () => {
    it.each([
        { effects: { speedHalved: true }, text: /^12 ft\.$/, label: 'speed halved with floor (25 → 12)' },
        { effects: { speedReduction: 10 }, text: /^15 ft\.$/, label: 'flat reduction (25 − 10)' },
        { effects: { speedZero: true }, text: /^0 ft\.$/, label: 'speed set to zero' },
    ])('$label', ({ effects, text }) => {
        renderSummary({ conditionEffects: effects });
        expect(speedSpan()).toHaveTextContent(text);
    });

    it('speedZero takes precedence over speedHalved and speedReduction', () => {
        renderSummary({ conditionEffects: { speedZero: true, speedHalved: true, speedReduction: 10 } });
        expect(speedSpan()).toHaveTextContent(/^0 ft\.$/);
    });

    it('halves before applying a flat reduction (25 → 12 → 2)', () => {
        renderSummary({ conditionEffects: { speedHalved: true, speedReduction: 10 } });
        expect(speedSpan()).toHaveTextContent(/^2 ft\.$/);
    });

    it('never renders negative speed when the reduction exceeds remaining speed', () => {
        renderSummary({ exhaustionLevel: 4, conditionEffects: { speedReduction: 10 } });
        expect(speedSpan()).toHaveTextContent(/^0 ft\.$/);
    });

    it.each([
        { level: 1, effects: { speedHalved: true }, text: /^10 ft\.$/, label: 'halved after exhaustion (25 − 5 → 10)' },
        { level: 1, effects: { speedReduction: 5 }, text: /^15 ft\.$/, label: 'reduced after exhaustion (25 − 5 − 5)' },
    ])('stacks with exhaustion: $label', ({ level, effects, text }) => {
        renderSummary({ exhaustionLevel: level, conditionEffects: effects });
        expect(speedSpan()).toHaveTextContent(text);
    });

    it('shows a halved-speed penalty notice next to the reduced speed', () => {
        renderSummary({ conditionEffects: { speedHalved: true } });
        expect(speedSpan()).toHaveTextContent(/^12 ft\.$/);
        expect(screen.getByText('(Speed halved from Slow)')).toBeInTheDocument();
    });

    it('names the halving source when conditionEffects provides one', () => {
        renderSummary({ conditionEffects: { speedHalved: true, speedHalvedSource: 'Ray of Enfeeblement' } });
        expect(screen.getByText('(Speed halved by Ray of Enfeeblement)')).toBeInTheDocument();
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
    ])('$label', ({ buff, text }) => {
        renderSummary({ buffs: [buff] });
        expect(speedSpan()).toHaveTextContent(text);
    });

    it('glistening_flight mirrors walk speed with hover, ignoring any provided flySpeed', () => {
        renderSummary({ buffs: [{ effect: 'glistening_flight', flySpeed: 40 }] });
        expect(speedSpan()).toHaveTextContent(/^25 ft\., fly 25 ft\.\s+\(hover\)\s*$/);
    });

    it('mirrored fly follows the exhaustion-reduced walk speed (exhaustion 1 → fly 20 ft)', () => {
        renderSummary({ buffs: [{ effect: 'fly_speed_equals_walk_speed' }], exhaustionLevel: 1 });
        expect(speedSpan()).toHaveTextContent(/^20 ft\., fly 20 ft\.\s*$/);
    });

    it('omits the fly suffix when no fly buff is active', () => {
        renderSummary();
        expect(speedSpan()).toHaveTextContent(/^25 ft\.$/);
    });
});

// ---------------------------------------------------------------------------
// Ice walk suffix
// ---------------------------------------------------------------------------
describe('ice walk suffix', () => {
    it('appends ", ice walk" to the speed row when the ice_walk buff is active', () => {
        renderSummary({ buffs: [{ effect: 'ice_walk' }] });
        expect(speedSpan()).toHaveTextContent(/^25 ft\., ice walk$/);
    });

    it('omits the ice walk suffix when no ice_walk buff is active', () => {
        renderSummary();
        expect(screen.queryByText(/ice walk/)).not.toBeInTheDocument();
    });
});
