// @improved-by-ai
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
//   - Climb/swim stat overrides, Salmon/Panther aspects, stormborn → CharSummary-AdditionalCoverage.test.jsx
//
// Quality improvements over previous revision (11 tests → 16 tests / 22 runs):
//   - Speed assertions now scope to the Speed-row span (speedSpan helper, family
//     convention from CharSummary-Movement) and pin the FULL span text — the old
//     page-wide /25 ft/ regex passed even if armor gating leaked "swim" or the
//     bonus rendered anywhere else on the sheet.
//   - Added guard-branch coverage that previously let broken code pass silently:
//     wrong passive type, unknown effect, conditionless speed_bonus, malformed
//     bonusExpression (exposed a real NaN defect — fixed in charSummaryCalc.js),
//     stacking accumulation loop, and the armorClassFormula heavy-armor fallback.
//   - Pinned the automation-passives vs top-level-passives list split:
//     elemental_attunement_movement reads playerStats.passives while every other
//     movement passive reads automation.passives — an easy wiring regression.
//   - Single module-level beforeEach replaces four identical blocks; stats() /
//     speedBonusPassive() fixture helpers remove 6 duplicated 8-line fixture objects.
//   - Removed ShortRestModal and useActionPopup mocks: never mounted/triggered by
//     these render-only tests (over-mocking noise).

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
        renderSummary(stats([speedBonusPassive('no_heavy_armor')]));
        expect(speedSpan()).toHaveTextContent(/^35 ft\.$/);
    });

    it('suppresses the bonus when heavy armor is equipped', () => {
        const playerStats = stats([speedBonusPassive('no_heavy_armor')], {
            inventory: { equipped: ['Plate'] },
            equipment: [{ name: 'Plate', armor_category: 'Heavy' }],
        });
        renderSummary(playerStats);
        expect(speedSpan()).toHaveTextContent(/^25 ft\.$/);
    });

    it('detects heavy armor via armorClassFormula when no equipment list exists', () => {
        const playerStats = stats([speedBonusPassive('no_heavy_armor')], {
            equipment: undefined,
            armorClassFormula: '16 + 2 (Heavy)',
        });
        renderSummary(playerStats);
        expect(speedSpan()).toHaveTextContent(/^25 ft\.$/);
    });
});

// ---------------------------------------------------------------------------
// speed_bonus passive — no_armor_no_shield condition
// ---------------------------------------------------------------------------
describe('speed_bonus passive — no_armor_no_shield condition', () => {
    it('adds the bonus when nothing protective is equipped', () => {
        const playerStats = stats([speedBonusPassive('no_armor_no_shield')], {
            inventory: { equipped: [] },
            equipment: [],
        });
        renderSummary(playerStats);
        expect(speedSpan()).toHaveTextContent(/^35 ft\.$/);
    });

    it.each([
        ['armor', ['Scale Mail'], [{ name: 'Scale Mail', equipment_category: 'Armor' }]],
        ['shield alone', ['Shield'], [{ name: 'Shield', type: 'Shield' }]],
        ['both armor and shield', ['Scale Mail', 'Shield'], [{ name: 'Scale Mail', equipment_category: 'Armor' }, { name: 'Shield', type: 'Shield' }]],
    ])('suppresses the bonus when %s is equipped', (_label, equipped, equipment) => {
        const playerStats = stats([speedBonusPassive('no_armor_no_shield')], {
            inventory: { equipped },
            equipment,
        });
        renderSummary(playerStats);
        expect(speedSpan()).toHaveTextContent(/^25 ft\.$/);
    });

    it('uses the parsed bonusExpression instead of the +10 default', () => {
        const playerStats = stats([speedBonusPassive('no_armor_no_shield', '15')], {
            inventory: { equipped: [] },
            equipment: [],
        });
        renderSummary(playerStats);
        expect(speedSpan()).toHaveTextContent(/^40 ft\.$/);
    });
});

// ---------------------------------------------------------------------------
// speed_bonus / speed_increase guards and stacking
// ---------------------------------------------------------------------------
describe('passive speed bonus guards', () => {
    it.each([
        ['a non-passive_buff type', { type: 'action_cost', effect: 'speed_bonus', condition: 'no_armor_no_shield' }],
        ['an unrecognized effect', { type: 'passive_buff', effect: 'darkvision_bonus', condition: 'no_armor_no_shield' }],
        ['no condition at all', { type: 'passive_buff', effect: 'speed_bonus' }],
    ])('contributes nothing for %s', (_label, passive) => {
        const playerStats = stats([passive], { inventory: { equipped: [] }, equipment: [] });
        renderSummary(playerStats);
        expect(speedSpan()).toHaveTextContent(/^25 ft\.$/);
    });

    it('treats a malformed speed_bonus bonusExpression as zero instead of rendering NaN', () => {
        const playerStats = stats([speedBonusPassive('no_armor_no_shield', 'fast')], {
            inventory: { equipped: [] },
            equipment: [],
        });
        renderSummary(playerStats);
        expect(speedSpan()).toHaveTextContent(/^25 ft\.$/);
    });

    it('stacks bonuses from multiple qualifying passives', () => {
        const playerStats = stats([
            speedBonusPassive('no_armor_no_shield'),
            { type: 'passive_buff', effect: 'speed_increase', bonusExpression: '5' },
        ], { inventory: { equipped: [] }, equipment: [] });
        renderSummary(playerStats);
        expect(speedSpan()).toHaveTextContent(/^40 ft\.$/);
    });

    it('applies speed_increase unconditionally with its parsed bonus', () => {
        renderSummary(stats([{ type: 'passive_buff', effect: 'speed_increase', bonusExpression: '5' }]));
        expect(speedSpan()).toHaveTextContent(/^30 ft\.$/);
    });

    it('treats a malformed speed_increase bonusExpression as zero', () => {
        renderSummary(stats([{ type: 'passive_buff', effect: 'speed_increase', bonusExpression: 'five' }]));
        expect(speedSpan()).toHaveTextContent(/^25 ft\.$/);
    });
});

// ---------------------------------------------------------------------------
// acrobatic_movement passive — conditional suffix on the speed row
// ---------------------------------------------------------------------------
describe('acrobatic_movement passive', () => {
    it('appends the acrobatic movement suffix while unarmored and unshielded', () => {
        const playerStats = stats([{ effect: 'acrobatic_movement' }], {
            inventory: { equipped: [] },
            equipment: [],
        });
        renderSummary(playerStats);
        expect(speedSpan()).toHaveTextContent(/^25 ft\., acrobatic movement$/);
    });

    it.each([
        ['armor', ['Scale Mail'], [{ name: 'Scale Mail', equipment_category: 'Armor' }]],
        ['shield alone', ['Shield'], [{ name: 'Shield', type: 'Shield' }]],
    ])('omits the suffix when %s is equipped', (_label, equipped, equipment) => {
        const playerStats = stats([{ effect: 'acrobatic_movement' }], {
            inventory: { equipped },
            equipment,
        });
        renderSummary(playerStats);
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
