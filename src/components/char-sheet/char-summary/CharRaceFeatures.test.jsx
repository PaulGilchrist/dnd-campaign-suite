// @maintained-by-ai 2026-11-26
/**
 * CharRaceFeatures — which race-tracked resource rows render, and with what
 * label / store key / max / player / campaign wiring.
 *
 * Seam mock (TrackedResourceInput's own hook/editing behavior is covered by
 * TrackedResourceInput.test.jsx): renders "<label>: <getMax()>" as visible
 * DOM, tagged with data-resource-key / data-campaign / data-player, so we
 * assert observable output instead of mock call logs.
 *
 * Covered behavior:
 *  - Dragonborn always shows a Breath Weapon row; max comes from
 *    traits[0].automation.uses (number passthrough, "proficiency_bonus" →
 *    proficiency (0 when missing), falsy or missing-traits → 1).
 *  - Goliath shows exactly the row mapped from its giant ancestry subrace
 *    (full mapping table pinned: label + store key per ancestry);
 *    max is proficiency (0 when missing). Unmapped subrace → nothing.
 *  - Anything else (missing playerStats, unsupported race) renders an
 *    empty DOM via the exact-match registry gate.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CharRaceFeatures from './CharRaceFeatures.jsx';

vi.mock('./TrackedResourceInput.jsx', () => ({
    default: function MockTrackedResourceInput({ label, resourceKey, getMax, campaignName, playerName }) {
        return (
            <div
                data-testid="tracked-resource"
                data-resource-key={resourceKey}
                data-campaign={campaignName}
                data-player={playerName}
            >
                {`${label}: ${getMax()}`}
            </div>
        );
    },
}));

const CAMPAIGN = 'test-campaign';

function dragonbornStats(overrides = {}) {
    return {
        name: 'Dagna',
        level: 5,
        proficiency: 4,
        race: { name: 'Dragonborn', traits: [{ automation: { uses: 3 } }] },
        ...overrides,
    };
}

function goliathStats(overrides = {}) {
    return {
        name: 'Kraka',
        level: 5,
        proficiency: 5,
        race: { name: 'Goliath', subrace: { name: 'Stone Giant' } },
        ...overrides,
    };
}

function expectSingleRow(playerStats, label, max, resourceKey) {
    render(<CharRaceFeatures playerStats={playerStats} campaignName={CAMPAIGN} />);
    const rows = screen.getAllByTestId('tracked-resource');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent(`${label}: ${max}`);
    expect(rows[0]).toHaveAttribute('data-resource-key', resourceKey);
    expect(rows[0]).toHaveAttribute('data-player', playerStats.name);
    expect(rows[0]).toHaveAttribute('data-campaign', CAMPAIGN);
}

function expectNothingRendered(playerStats) {
    const { container } = render(<CharRaceFeatures playerStats={playerStats} campaignName={CAMPAIGN} />);
    expect(screen.queryAllByTestId('tracked-resource')).toHaveLength(0);
    expect(container).toBeEmptyDOMElement();
}

describe('CharRaceFeatures', () => {
    describe('Dragonborn — Breath Weapon', () => {
        it.each([
            // branch: rawUses numeric → passthrough
            ['numeric automation.uses', 3, { name: 'Dragonborn', traits: [{ automation: { uses: 3 } }] }, 4],
            // branch: rawUses === 'proficiency_bonus' → proficiency
            ['"proficiency_bonus"', 4, { name: 'Dragonborn', traits: [{ automation: { uses: 'proficiency_bonus' } }] }, 4],
            // branch: 'proficiency_bonus' with `|| 0` right-hand side
            ['"proficiency_bonus" with proficiency missing', 0, { name: 'Dragonborn', traits: [{ automation: { uses: 'proficiency_bonus' } }] }, undefined],
            // branch: rawUses falsy numeric → `|| 1` default
            ['0 (falls back to default 1)', 1, { name: 'Dragonborn', traits: [{ automation: { uses: 0 } }] }, 4],
            // branch: optional chaining short-circuits on missing traits → `|| 1`
            ['race with no traits (defaults to 1)', 1, { name: 'Dragonborn' }, 4],
        ])('%s renders Breath Weapon max %i', (_desc, max, race, proficiency) => {
            expectSingleRow(dragonbornStats({ race, proficiency }), 'Breath Weapon', max, 'breathWeaponUses');
        });
    });

    describe('Goliath — Giant Ancestry', () => {
        // Pins the full private ancestry→(label, store key) mapping table;
        // max column exercises proficiency passthrough and the `|| 0` default.
        it.each([
            ['Stone Giant', "Stone's Endurance", 'stonesEnduranceUses', 5, 5],
            ['Cloud Giant', "Cloud's Jaunt", 'cloudsJauntUses', 5, 5],
            ['Fire Giant', "Fire's Burn", 'firesBurnUses', 5, 5],
            ['Frost Giant', "Frost's Chill", 'frostsChillUses', 5, 5],
            ['Hill Giant', "Hill's Tumble", 'hillsTumbleUses', 5, 5],
            ['Storm Giant', "Storm's Thunder", 'stormsThunderUses', 5, 5],
            ['Stone Giant', "Stone's Endurance", 'stonesEnduranceUses', 0, undefined],
        ])('shows %s ancestry %s (%s) with max %i', (subrace, label, resourceKey, max, proficiency) => {
            expectSingleRow(
                goliathStats({ proficiency, race: { name: 'Goliath', subrace: { name: subrace } } }),
                label,
                max,
                resourceKey,
            );
        });
    });

    describe('renders nothing for everything else', () => {
        it.each([
            // branch: entry gate `playerStats?.race?.name` → no component
            ['null playerStats', null],
            // branch: registry exact-match miss → null (includes odd casing)
            ['an unsupported race', dragonbornStats({ race: { name: 'Human' } })],
            // branch: Goliath feature's own `!config` gate (distinct path)
            ['a Goliath with an unmapped giant ancestry subrace', goliathStats({ race: { name: 'Goliath', subrace: { name: 'Frost Giantkin' } } })],
        ])('%s', (_desc, playerStats) => {
            expectNothingRendered(playerStats);
        });
    });
});
