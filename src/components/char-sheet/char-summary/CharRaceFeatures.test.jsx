// @maintained-by-ai
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
 *    traits[0].automation.uses (number, "proficiency_bonus" → proficiency,
 *    falsy or missing → 1).
 *  - Goliath shows exactly the row mapped from its giant ancestry subrace;
 *    max is proficiency (0 when missing). Unmapped subrace → nothing.
 *  - Anything else (unsupported race, case mismatch, missing race or
 *    playerStats) renders an empty DOM.
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
            ['numeric automation.uses', 3, { name: 'Dragonborn', traits: [{ automation: { uses: 3 } }] }, 4],
            ['"proficiency_bonus"', 4, { name: 'Dragonborn', traits: [{ automation: { uses: 'proficiency_bonus' } }] }, 4],
            ['"proficiency_bonus" with proficiency missing', 0, { name: 'Dragonborn', traits: [{ automation: { uses: 'proficiency_bonus' } }] }, undefined],
            ['0 (falls back to default 1)', 1, { name: 'Dragonborn', traits: [{ automation: { uses: 0 } }] }, 4],
            ['race with no traits (defaults to 1)', 1, { name: 'Dragonborn' }, 4],
        ])('%s renders Breath Weapon max %i', (desc, max, race, proficiency) => {
            expectSingleRow(dragonbornStats({ race, proficiency }), 'Breath Weapon', max, 'breathweaponUses');
        });
    });

    describe('Goliath — Giant Ancestry', () => {
        it.each([
            ['Stone Giant', 5, "Stone's Endurance", 'stonesEnduranceUses', 5],
            ['Cloud Giant', 5, "Cloud's Jaunt", 'cloudsJauntUses', 5],
            ['Fire Giant', 5, "Fire's Burn", 'firesBurnUses', 5],
            ['Frost Giant', 5, "Frost's Chill", 'frostsChillUses', 5],
            ['Hill Giant', 5, "Hill's Tumble", 'hillsTumbleUses', 5],
            ['Storm Giant', 5, "Storm's Thunder", 'stormsThunderUses', 5],
        ])('shows %s ancestry feature with max %i', (subrace, max, label, resourceKey, proficiency) => {
            expectSingleRow(
                goliathStats({ proficiency, race: { name: 'Goliath', subrace: { name: subrace } } }),
                label,
                max,
                resourceKey,
            );
        });

        it('uses 0 as max when proficiency is missing', () => {
            expectSingleRow(
                goliathStats({ proficiency: undefined }),
                "Stone's Endurance",
                0,
                'stonesEnduranceUses',
            );
        });
    });

    describe('renders nothing for everything else', () => {
        it.each([
            ['null playerStats', null],
            ['an unsupported race', dragonbornStats({ race: { name: 'Human' } })],
            ['a race name with different capitalization (registry is exact-match)', dragonbornStats({ race: { name: 'dragonborn' } })],
            ['a Goliath with an unmapped giant ancestry subrace', goliathStats({ race: { name: 'Goliath', subrace: { name: 'Frost Giantkin' } } })],
        ])('%s', (_desc, playerStats) => {
            expectNothingRendered(playerStats);
        });
    });
});
