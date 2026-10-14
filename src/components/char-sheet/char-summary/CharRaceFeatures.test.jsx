// @improved-by-ai
/**
 * CharRaceFeatures — which race-tracked resource rows render, and with what
 * label / store key / max.
 *
 * Seam mock (TrackedResourceInput's own hook/editing behavior is covered by
 * TrackedResourceInput.test.jsx): renders "<label>: <getMax()>" as visible
 * DOM, tagged with data-resource-key / data-campaign / data-player, so we
 * assert observable output instead of mock call logs.
 *
 * Covered behavior:
 *  - Dragonborn always shows a Breath Weapon row; max comes from
 *    traits[0].automation.uses (number, "proficiency_bonus", or default 1).
 *  - Goliath shows exactly the row mapped from its giant ancestry subrace;
 *    max is proficiency.
 *  - Unsupported races, missing race, and missing playerStats render nothing.
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

function renderFeatures(playerStats) {
    return render(<CharRaceFeatures playerStats={playerStats} campaignName={CAMPAIGN} />);
}

function expectTrackedRow(label, max, resourceKey) {
    const rows = screen.getAllByTestId('tracked-resource');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent(`${label}: ${max}`);
    expect(rows[0]).toHaveAttribute('data-resource-key', resourceKey);
}

function expectNothingRendered() {
    expect(screen.queryAllByTestId('tracked-resource')).toHaveLength(0);
}

describe('CharRaceFeatures', () => {
    describe('Dragonborn — Breath Weapon', () => {
        it.each([
            ['a number', { uses: 3 }, 3],
            ['"proficiency_bonus"', { uses: 'proficiency_bonus' }, 4],
            ['0 (falls back to default)', { uses: 0 }, 1],
            ['missing (defaults to 1)', {}, 1],
        ])('%s: automation.uses %j renders max %i', (_desc, automation, expectedMax) => {
            renderFeatures(dragonbornStats({ race: { name: 'Dragonborn', traits: [{ automation }] } }));
            expectTrackedRow('Breath Weapon', expectedMax, 'breathweaponUses');
        });

        it('resolves "proficiency_bonus" to 0 when proficiency is missing', () => {
            renderFeatures(dragonbornStats({
                proficiency: undefined,
                race: { name: 'Dragonborn', traits: [{ automation: { uses: 'proficiency_bonus' } }] },
            }));
            expectTrackedRow('Breath Weapon', 0, 'breathweaponUses');
        });

        it('still shows the row with max 1 when the race has no traits', () => {
            renderFeatures(dragonbornStats({ race: { name: 'Dragonborn' } }));
            expectTrackedRow('Breath Weapon', 1, 'breathweaponUses');
        });

        it('still shows the row with max 1 when traits is an empty array', () => {
            renderFeatures(dragonbornStats({ race: { name: 'Dragonborn', traits: [] } }));
            expectTrackedRow('Breath Weapon', 1, 'breathweaponUses');
        });

        it('wires player name and campaign through to the tracked resource row', () => {
            renderFeatures(dragonbornStats({ name: 'Vex' }));
            const row = screen.getByTestId('tracked-resource');
            expect(row).toHaveAttribute('data-player', 'Vex');
            expect(row).toHaveAttribute('data-campaign', CAMPAIGN);
        });
    });

    describe('Goliath — Giant Ancestry', () => {
        it.each([
            ['Stone Giant', "Stone's Endurance", 'stonesEnduranceUses'],
            ['Cloud Giant', "Cloud's Jaunt", 'cloudsJauntUses'],
            ['Fire Giant', "Fire's Burn", 'firesBurnUses'],
            ['Frost Giant', "Frost's Chill", 'frostsChillUses'],
            ['Hill Giant', "Hill's Tumble", 'hillsTumbleUses'],
            ['Storm Giant', "Storm's Thunder", 'stormsThunderUses'],
        ])('shows %s ancestry feature with proficiency as max', (subrace, label, resourceKey) => {
            renderFeatures(goliathStats({ race: { name: 'Goliath', subrace: { name: subrace } } }));
            expectTrackedRow(label, 5, resourceKey);
        });

        it('uses the current proficiency as max (0 when undefined)', () => {
            renderFeatures(goliathStats({ proficiency: undefined }));
            expectTrackedRow("Stone's Endurance", 0, 'stonesEnduranceUses');
        });

        it('renders nothing when the Goliath has no subrace', () => {
            renderFeatures(goliathStats({ race: { name: 'Goliath' } }));
            expectNothingRendered();
        });

        it('renders nothing for an unknown giant ancestry subrace', () => {
            renderFeatures(goliathStats({ race: { name: 'Goliath', subrace: { name: 'Frost Giantkin' } } }));
            expectNothingRendered();
        });
    });

    describe('unsupported races and missing data — render nothing', () => {
        it.each([
            ['an unsupported race', { name: 'Human' }],
            ['a race name with different capitalization (registry is exact-match)', { name: 'dragonborn' }],
            ['no race at all', undefined],
        ])('renders nothing for %s', (_desc, race) => {
            const { container } = renderFeatures(dragonbornStats({ race }));
            expectNothingRendered();
            expect(container).toBeEmptyDOMElement();
        });

        it('renders nothing when playerStats is null', () => {
            renderFeatures(null);
            expectNothingRendered();
        });

        it('renders nothing when playerStats is undefined', () => {
            renderFeatures(undefined);
            expectNothingRendered();
        });
    });
});
