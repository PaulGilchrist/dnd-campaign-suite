// @maintained-by-ai
//
// Coverage ownership (CharSummary family delegation):
//   This file is the ONLY owner of the AC-row cover badges — the
//   "(+2 Cover: <source>)" spans rendered by AC_BADGE_SPECS in CharSummary.jsx
//   from the cover guards in charSummaryCalc.js (checkSmiteOfProtectionCover /
//   computeCoverBadges), driven by the `characters` prop + runtime store.
//   - Cover resolution math at attack time → services/combat/coverService.test.js
//     and services/rules/combat/coverService.test.js
//   - AC totals and non-cover AC attribution → CharSummary-BadgesAndAC.test.jsx
//   - Wrath of the Sea / sanctuary creature badges → CharSummary-Badges.test.jsx,
//     CharSummary-AdditionalCoverage.test.jsx
//
// Strategy: getRuntimeValue is a NAME+KEY aware fake (mirrors the real store's
// per-character namespaces) so a badge can only appear when the rules say it
// should — from the right source character, only if that source actively
// grants the effect and names the player as a beneficiary. Each table case
// below pins one rule branch: the positive it.each proves each source can
// grant its badge, the negative it.each proves each conjunction leg /
// self-exclusion / null-characters guard suppresses it.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('./CharRaceFeatures.jsx', () => ({ default: () => <div data-testid="char-race-features">Race Features</div> }));
vi.mock('./CharFeatFeatures.jsx', () => ({ default: () => <div data-testid="char-feat-features">Feat Features</div> }));
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

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

const CAMPAIGN = 'test-campaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'Thorin',
        xp: 2300,
        xpMode: 'milestone',
        race: { name: 'Dwarf', type: 'Hill Dwarf', subrace: { name: 'Hill Dwarf', speed: 25 } },
        class: { name: 'Cleric', subclass: { name: 'War', type: 'Choice' }, major: { name: 'Cleric' } },
        level: 5,
        alignment: 'Lawful Good',
        proficiency: 3,
        initiative: 2,
        initiativeAdvantage: false,
        abilities: [{ name: 'Wisdom', bonus: 3 }, { name: 'Strength', bonus: 2 }],
        armorClass: 18,
        armorClassFormula: '16 + 2 (shield)',
        hitPoints: 45,
        inventory: { equipped: ['Scale Mail', 'Shield'] },
        equipment: [{ name: 'Scale Mail', equipment_category: 'Armor' }, { name: 'Shield', type: 'Shield' }],
        background: 'Soldier',
        immunities: [],
        resistances: [],
        vulnerabilities: [],
        senses: [],
        proficiencies: [],
        languages: [],
        automation: { passives: [], actions: [] },
        passives: [],
        exhaustionLevel: 0,
        ...overrides,
    };
}

function makeCharacter(name, { passives = [] } = {}) {
    return {
        name,
        type: 'player',
        computedStats: { automation: { passives: passives.map(p => ({ name: p })) } },
    };
}

const auraAlly = (name) => makeCharacter(name, { passives: ['Aura of Protection'] });

// Name+key aware runtime fake — mirrors the real store's per-character
// namespaces. Anything not listed reads as null (neutral).
function seedRuntime(valuesByCharacterKey) {
    getRuntimeValue.mockImplementation((name, key) =>
        valuesByCharacterKey[`${name}.${key}`] ?? null);
}

function renderSummary({ playerStats = makePlayerStats(), characters = [] } = {}) {
    return render(
        <CharSummary
            playerStats={playerStats}
            campaignName={CAMPAIGN}
            exhaustionLevel={0}
            characters={characters}
        />
    );
}

const COVER_BADGE_TEXT = /\(\+2 Cover: .+\)/;

const coverBadges = () => screen.queryAllByText(COVER_BADGE_TEXT);

beforeEach(() => {
    // mockReset (not just clear) so a mockImplementation seeded by a prior
    // test can never leak into the next one.
    getRuntimeValue.mockReset().mockReturnValue(null);
    getActiveBuffs.mockReturnValue([]);
});

// One case per cover source: the minimum ally state that grants the badge.
const COVERING_SOURCES = [
    {
        source: 'Smite of Protection',
        characters: [auraAlly('Sister')],
        seed: { 'Sister.smiteOfProtectionActive': true },
    },
    {
        source: 'Bulwark of Force',
        characters: [makeCharacter('Ally')],
        seed: {
            'Ally.bulwarkOfForceActive': true,
            'Ally.bulwarkOfForceTargets': ['Thorin'],
        },
    },
    {
        source: "Nature's Sanctuary",
        characters: [makeCharacter('Ally')],
        seed: { 'Ally.naturesSanctuaryCreatures': ['Thorin'] },
    },
];

describe('CharSummary AC-row cover badges', () => {
    it.each(COVERING_SOURCES)(
        'shows exactly one (+2 Cover: $source) badge when an ally grants it to the player',
        ({ source, characters, seed }) => {
            seedRuntime(seed);

            renderSummary({ characters });

            const badge = screen.getByText(`(+2 Cover: ${source})`);
            expect(badge).toHaveAttribute('title', expect.stringContaining(`Half Cover from ${source}`));
            expect(coverBadges()).toHaveLength(1);
        }
    );

    // Each case breaks exactly one rule leg: missing effect, missing aura
    // conjunction, player not a named beneficiary, self-granted cover, or a
    // missing characters prop. None of them may show any cover badge.
    it.each([
        {
            case: 'nothing grants cover (inert ally)',
            characters: [makeCharacter('Sister')],
            seed: {},
        },
        {
            case: 'characters prop is null',
            characters: null,
            seed: {},
        },
        {
            case: 'smite is active but the ally lacks Aura of Protection',
            characters: [makeCharacter('Sister')],
            seed: { 'Sister.smiteOfProtectionActive': true },
        },
        {
            case: 'ally has Aura of Protection but no smite active',
            characters: [auraAlly('Sister')],
            seed: {},
        },
        {
            case: 'bulwark is active but names only another target',
            characters: [makeCharacter('Ally')],
            seed: {
                'Ally.bulwarkOfForceActive': true,
                'Ally.bulwarkOfForceTargets': ['Merric'],
            },
        },
        {
            case: 'the player raised the bulwark on themselves',
            characters: [makeCharacter('Thorin')],
            seed: {
                'Thorin.bulwarkOfForceActive': true,
                'Thorin.bulwarkOfForceTargets': ['Thorin'],
            },
        },
        {
            case: "sanctuary protects only other creatures",
            characters: [makeCharacter('Ally')],
            seed: { 'Ally.naturesSanctuaryCreatures': ['Merric'] },
        },
    ])('shows no cover badge when $case', ({ characters, seed }) => {
        seedRuntime(seed);

        renderSummary({ characters });

        expect(screen.getByText('Thorin')).toBeInTheDocument();
        expect(coverBadges()).toHaveLength(0);
    });

    it('renders one badge per cover type when multiple sources grant cover at once', () => {
        seedRuntime({
            'Sister.smiteOfProtectionActive': true,
            // two allies grant the SAME cover type — must collapse to one badge
            'Ally.bulwarkOfForceActive': true,
            'Ally.bulwarkOfForceTargets': ['Thorin'],
            'Bram.bulwarkOfForceActive': true,
            'Bram.bulwarkOfForceTargets': ['Thorin'],
            'Ally.naturesSanctuaryCreatures': ['Thorin'],
        });

        renderSummary({
            characters: [auraAlly('Sister'), makeCharacter('Ally'), makeCharacter('Bram')],
        });

        expect(screen.getAllByText('(+2 Cover: Bulwark of Force)')).toHaveLength(1);
        expect(coverBadges()).toHaveLength(3);
    });
});
