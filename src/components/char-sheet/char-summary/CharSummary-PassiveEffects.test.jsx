// @maintained-by-ai
//
// Coverage ownership (CharSummary family delegation): automation/passive movement
// effects of computeCharSummaryContext — the ONLY owner in the family of all four
// lanes (verified by grep over all CharSummary-* siblings):
//   - passive speed_bonus + speed_increase passives (charSummaryCalc.js passiveSpeedContribution):
//     no_heavy_armor / no_armor_no_shield conditions, default & explicit bonusExpression,
//     stacking, type/effect/condition guards, NaN guard, armorClassFormula fallback
//   - acrobatic_movement suffix (applyMovementPassives automation-passives lane)
//   - elemental_attunement_movement (applyMovementPassives TOP-LEVEL passives lane)
//   - aquatic_affinity swim grant + non-override of buff-set swim speeds
//
// NOT owned here (delegated — do not re-add):
//   - Buff-driven speed (haste/speed_boost/large_form), exhaustion & condition speed,
//     fly-condition rendering → CharSummary-SpeedCalculations.test.jsx
//   - Barbarian/Monk unarmored movement, Circle Forms AC → CharSummary-Movement.test.jsx
//     (Movement also pins BOTH computeHasArmorOrShield detection arms — armor-only and
//     shield-only — so this file only needs one suppression run per affected passive)
//   - Climb/swim stat overrides, Salmon/Panther aspects, stormborn → CharSummary-AdditionalCoverage.test.jsx
//   - no_armor_no_shield calc-lane gating + default +10 parse → CharSummary.test-mocks.test.jsx
//     fixture-contract suite
//
// Trim pass (16 tests / 22 runs → 13 tests / 18 runs) — every production branch in
// passiveSpeedContribution / applyMovementPassives stays pinned; removed runs were
// second and third occurrences of the same branch:
//   - Stacking test now runs on the ARMORED default fixture (speed_bonus no_heavy_armor
//     +10 default parse + speed_increase +5 → 40), absorbing the separate "speed_increase
//     unconditional" test and the unarmored single-effect grant test.
//   - no_armor_no_shield suppression keeps the shield-only run only (the quirky
//     baseName==='Shield' arm); armor-only and both were covered by Movement siblings.
//   - Malformed/missing bonusExpression folds into one it.each covering the NaN guard
//     on both effects AND the missing-bonusExpression truthy guard on speed_increase.
//   - Heavy-armor suppression and the armorClassFormula fallback share one it.each.
//   - Speed assertions scope to the Speed-row span (speedSpan helper, family convention)
//     and pin the FULL span text; guard branches previously let broken code pass silently
//     (the malformed-expression case exposed a real NaN defect, fixed in charSummaryCalc.js).

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

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn(), rollInitiative: vi.fn() })),
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
    sanitizeHtml: (html) => html,
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

beforeEach(() => {
    vi.clearAllMocks();
    getActiveBuffs.mockReturnValue([]);
});

// Fixture builder: base stats with automation passives swapped in.
const stats = (passives, overrides = {}) => ({
    ...mockPlayerStats,
    automation: { ...mockPlayerStats.automation, passives },
    ...overrides,
});

const speedBonusPassive = (condition, bonusExpression = '10') =>
    ({ type: 'passive_buff', effect: 'speed_bonus', condition, bonusExpression });

const speedIncreasePassive = (bonusExpression) =>
    ({ type: 'passive_buff', effect: 'speed_increase', bonusExpression });

const unarmored = { inventory: { equipped: [] }, equipment: [] };

// exhaustionLevel is a required numeric input to applySpeedConditions — omitting it NaNs the total.
const renderSummary = (playerStats) =>
    render(<CharSummary playerStats={playerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);

// The Speed row renders as <b>Speed: </b><span>{total} ft.{suffixes}</span> —
// asserting the full span text pins totals AND the presence/order of suffixes.
const speedSpan = () => screen.getByText(/^\d+ ft\./);

// ---------------------------------------------------------------------------
// speed_bonus passive — no_heavy_armor condition
// ---------------------------------------------------------------------------
describe('speed_bonus passive — no_heavy_armor condition', () => {
    it('adds the bonus when equipped armor is not heavy', () => {
        // Default fixture wears Scale Mail (Medium) — the mid-point between
        // unarmored and heavy, so a leaked "anything armored blocks it" bug fails here.
        renderSummary(stats([speedBonusPassive('no_heavy_armor')]));
        expect(speedSpan()).toHaveTextContent(/^35 ft\.$/);
    });

    it.each([
        ['heavy armor is in the equipment list', {
            inventory: { equipped: ['Plate'] },
            equipment: [{ name: 'Plate', armor_category: 'Heavy' }],
        }],
        // Fallback branch: no equipment list at all — only the AC formula string names it.
        ['heavy armor is only named in armorClassFormula', {
            equipment: undefined,
            armorClassFormula: '16 + 2 (Heavy)',
        }],
    ])('suppresses the bonus when %s', (_label, overrides) => {
        renderSummary(stats([speedBonusPassive('no_heavy_armor')], overrides));
        expect(speedSpan()).toHaveTextContent(/^25 ft\.$/);
    });
});

// ---------------------------------------------------------------------------
// speed_bonus passive — no_armor_no_shield condition
// ---------------------------------------------------------------------------
describe('speed_bonus passive — no_armor_no_shield condition', () => {
    it('adds its parsed bonusExpression when nothing protective is equipped', () => {
        renderSummary(stats([speedBonusPassive('no_armor_no_shield', '15')], unarmored));
        expect(speedSpan()).toHaveTextContent(/^40 ft\.$/);
    });

    it('suppresses the bonus when a shield alone is equipped', () => {
        // Shield-only pins the baseName==='Shield' detection arm here; the
        // armor-only arm is pinned by CharSummary-Movement's armored negatives.
        renderSummary(stats([speedBonusPassive('no_armor_no_shield')], {
            inventory: { equipped: ['Shield'] },
            equipment: [{ name: 'Shield', type: 'Shield' }],
        }));
        expect(speedSpan()).toHaveTextContent(/^25 ft\.$/);
    });
});

// ---------------------------------------------------------------------------
// speed_bonus / speed_increase guards, expression hygiene, and stacking
// ---------------------------------------------------------------------------
describe('passive speed bonus guards', () => {
    it.each([
        ['a non-passive_buff type', { type: 'action_cost', effect: 'speed_bonus', condition: 'no_armor_no_shield' }],
        ['an unrecognized effect', { type: 'passive_buff', effect: 'darkvision_bonus', condition: 'no_armor_no_shield' }],
        ['no condition at all', { type: 'passive_buff', effect: 'speed_bonus' }],
    ])('contributes nothing for %s', (_label, passive) => {
        // Unarmored setup: these also act as the positive-control baseline —
        // qualifying passives add to 25 ft. in the very same fixture above.
        renderSummary(stats([passive], unarmored));
        expect(speedSpan()).toHaveTextContent(/^25 ft\.$/);
    });

    it.each([
        ['a malformed speed_bonus bonusExpression', speedBonusPassive('no_armor_no_shield', 'fast'), unarmored],
        ['a malformed speed_increase bonusExpression', speedIncreasePassive('five'), undefined],
        ['speed_increase with no bonusExpression', speedIncreasePassive(undefined), undefined],
    ])('treats %s as zero instead of rendering NaN', (_label, passive, overrides) => {
        renderSummary(stats([passive], overrides));
        expect(speedSpan()).toHaveTextContent(/^25 ft\.$/);
    });

    it('stacks bonuses and applies speed_increase unconditionally, armor equipped', () => {
        // Default fixture wears Scale Mail + Shield: the +10 no_heavy_armor bonus
        // still qualifies (Medium), speed_increase +5 ignores armor entirely, and
        // 25+10+5=40 pins the accumulation loop (assignment instead of += fails).
        renderSummary(stats([
            speedBonusPassive('no_heavy_armor'),
            speedIncreasePassive('5'),
        ]));
        expect(speedSpan()).toHaveTextContent(/^40 ft\.$/);
    });
});

// ---------------------------------------------------------------------------
// acrobatic_movement passive — conditional suffix on the speed row
// ---------------------------------------------------------------------------
describe('acrobatic_movement passive', () => {
    it('appends the acrobatic movement suffix while unarmored and unshielded', () => {
        renderSummary(stats([{ effect: 'acrobatic_movement' }], unarmored));
        expect(speedSpan()).toHaveTextContent(/^25 ft\., acrobatic movement$/);
    });

    it('omits the suffix when armor is equipped', () => {
        renderSummary(stats([{ effect: 'acrobatic_movement' }], {
            inventory: { equipped: ['Scale Mail'] },
            equipment: [{ name: 'Scale Mail', equipment_category: 'Armor' }],
        }));
        expect(speedSpan()).toHaveTextContent(/^25 ft\.$/);
    });
});

// ---------------------------------------------------------------------------
// elemental_attunement_movement passive — top-level passives lane
// ---------------------------------------------------------------------------
describe('elemental_attunement_movement passive', () => {
    it('grants fly and swim speeds mirroring walk speed', () => {
        renderSummary({
            ...mockPlayerStats,
            passives: [{ effect: 'elemental_attunement_movement' }],
        });
        expect(speedSpan()).toHaveTextContent(/^25 ft\., swim 25 ft\., fly 25 ft\.\s*$/);
    });

    it('is only read from top-level passives — automation.passives does not grant it', () => {
        renderSummary(stats([{ effect: 'elemental_attunement_movement' }]));
        expect(speedSpan()).toHaveTextContent(/^25 ft\.$/);
    });
});

// ---------------------------------------------------------------------------
// aquatic_affinity passive — swim speed grant
// ---------------------------------------------------------------------------
describe('aquatic_affinity passive', () => {
    it('grants swim speed equal to walk speed when no swim speed exists', () => {
        renderSummary(stats([{ effect: 'aquatic_affinity' }]));
        expect(speedSpan()).toHaveTextContent(/^25 ft\., swim 25 ft\.$/);
    });

    it('does not override swim speed already set by the aquatic_adaptation buff', () => {
        getActiveBuffs.mockReturnValue([{ effect: 'aquatic_adaptation' }]);
        renderSummary(stats([{ effect: 'aquatic_affinity' }]));
        expect(speedSpan()).toHaveTextContent(/^25 ft\., swim 50 ft\.$/);
    });
});
