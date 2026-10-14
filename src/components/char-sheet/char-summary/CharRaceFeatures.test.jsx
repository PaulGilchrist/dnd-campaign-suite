import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharRaceFeatures from './CharRaceFeatures.jsx';

/*
 * Tests CharRaceFeatures behavior:
 *  - Supported races render TrackedResourceInput with the correct label/resourceKey/maxUses
 *  - Unsupported/missing races return null (no DOM output)
 *  - Null/undefined playerStats returns null
 *
 * TrackedResourceInput is mocked to render the label text so we can verify
 * observable DOM output rather than implementation details (prop passthrough).
 */

const mockCalls = [];

vi.mock('./TrackedResourceInput.jsx', () => ({
    default: function MockTrackedResourceInput({ label, getMax, resourceKey }) {
        mockCalls.push({ label, resourceKey, max: getMax() });
        return <div className="race-features">{label}</div>;
    },
}));

const basePlayerStats = {
    name: 'Thorin',
    level: 5,
    proficiency: 3,
    race: { name: 'Mountain Dwarf' },
};

const campaignName = 'test-campaign';

function makeStats(overrides = {}) {
    return { ...basePlayerStats, ...overrides };
}

function renderComponent(playerStats, campaign = campaignName) {
    return render(<CharRaceFeatures playerStats={playerStats} campaignName={campaign} />);
}

beforeEach(() => {
    vi.clearAllMocks();
    mockCalls.length = 0;
});

function assertTrackedResourceRendered(expected) {
    expect(mockCalls.length).toBe(1);
    expect(mockCalls[0].label).toBe(expected.label);
    expect(mockCalls[0].resourceKey).toBe(expected.resourceKey);
    expect(mockCalls[0].max).toBe(expected.max);
}

function assertNoTrackedResourceRendered() {
    expect(mockCalls.length).toBe(0);
}

describe('CharRaceFeatures', () => {
    describe('Dragonborn — Breath Weapon', () => {
        it.each([
            ['number uses', { uses: 3 }, 3],
            ['proficiency_bonus uses', { uses: 'proficiency_bonus' }, 4],
            ['undefined uses defaults to 1', {}, 1],
        ])('renders Breath Weapon with max uses when automation.uses is %s', (_desc, automation, maxUses) => {
            const stats = makeStats({
                race: { name: 'Dragonborn', traits: [{ automation }] },
                proficiency: 4,
            });
            renderComponent(stats);
            assertTrackedResourceRendered({
                label: 'Breath Weapon',
                resourceKey: 'breathweaponUses',
                max: maxUses,
            });
        });

        it('renders Breath Weapon when traits is missing or empty', () => {
            const stats1 = makeStats({ race: { name: 'Dragonborn' } });
            renderComponent(stats1);
            expect(mockCalls.length).toBe(1);
            expect(mockCalls[0].label).toBe('Breath Weapon');
            expect(mockCalls[0].max).toBe(1);

            mockCalls.length = 0;
            const stats2 = makeStats({ race: { name: 'Dragonborn', traits: [] } });
            renderComponent(stats2);
            expect(mockCalls.length).toBe(1);
            expect(mockCalls[0].max).toBe(1);
        });
    });

    describe('Goliath — Giant Ancestry', () => {
        it('renders nothing when Goliath has no subrace or unknown subrace', () => {
            const stats = makeStats({ race: { name: 'Goliath' } });
            renderComponent(stats);
            assertNoTrackedResourceRendered();
            expect(screen.queryByText(/Stone's Endurance|Cloud's Jaunt|Fire's Burn|Frost's Chill|Hill's Tumble|Storm's Thunder/)).not.toBeInTheDocument();
        });

        it.each([
            ['Stone Giant', 'Stone Giant', "Stone's Endurance", 'stonesEnduranceUses'],
            ['Cloud Giant', 'Cloud Giant', "Cloud's Jaunt", 'cloudsJauntUses'],
            ['Fire Giant', 'Fire Giant', "Fire's Burn", 'firesBurnUses'],
            ['Frost Giant', 'Frost Giant', "Frost's Chill", 'frostsChillUses'],
            ['Hill Giant', 'Hill Giant', "Hill's Tumble", 'hillsTumbleUses'],
            ['Storm Giant', 'Storm Giant', "Storm's Thunder", 'stormsThunderUses'],
        ])('renders %s ancestry feature for Goliath', (_name, subraceName, expectedLabel, expectedResourceKey) => {
            const stats = makeStats({
                race: { name: 'Goliath', subrace: { name: subraceName } },
                proficiency: 5,
            });
            renderComponent(stats);
            assertTrackedResourceRendered({
                label: expectedLabel,
                resourceKey: expectedResourceKey,
                max: 5,
            });
        });

        it('renders with max uses equal to proficiency (0 when undefined)', () => {
            const stats = makeStats({
                race: { name: 'Goliath', subrace: { name: 'Stone Giant' } },
                proficiency: undefined,
            });
            renderComponent(stats);
            assertTrackedResourceRendered({
                label: "Stone's Endurance",
                resourceKey: 'stonesEnduranceUses',
                max: 0,
            });
        });
    });

    describe('Unsupported races and null input — render nothing', () => {
        it('renders nothing for unsupported races', () => {
            const stats = makeStats({ race: { name: 'Human' } });
            renderComponent(stats);
            assertNoTrackedResourceRendered();
        });

        it('renders nothing when race is undefined', () => {
            const stats = makeStats({ race: undefined });
            renderComponent(stats);
            assertNoTrackedResourceRendered();
        });

        it('renders nothing when playerStats is null or undefined', () => {
            render(<CharRaceFeatures playerStats={null} campaignName={campaignName} />);
            assertNoTrackedResourceRendered();
            mockCalls.length = 0;
            render(<CharRaceFeatures playerStats={undefined} campaignName={campaignName} />);
            assertNoTrackedResourceRendered();
        });
    });
});
