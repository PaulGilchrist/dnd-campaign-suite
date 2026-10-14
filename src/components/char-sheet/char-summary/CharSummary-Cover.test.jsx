// @improved-by-ai
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
// grants the effect and names the player as a beneficiary. Key-only mocks
// (the previous approach) masked all identity and conjunction logic.

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

describe('CharSummary cover badges — neutral state', () => {
    it('renders the summary with no cover badges when nothing grants cover', () => {
        renderSummary({ characters: [makeCharacter('Sister')] });

        expect(screen.getByText('Thorin')).toBeInTheDocument();
        expect(coverBadges()).toHaveLength(0);
    });

    it('renders the summary without cover badges when characters prop is null', () => {
        renderSummary({ characters: null });

        expect(screen.getByText('Thorin')).toBeInTheDocument();
        expect(coverBadges()).toHaveLength(0);
    });
});

describe('Smite of Protection cover badge', () => {
    it('shows half-cover badge when an ally in Aura of Protection has the smite active', () => {
        seedRuntime({ 'Sister.smiteOfProtectionActive': true });

        renderSummary({ characters: [auraAlly('Sister')] });

        const badge = screen.getByText('(+2 Cover: Smite of Protection)');
        expect(badge).toHaveAttribute('title', expect.stringContaining('Half Cover from Smite of Protection'));
    });

    it('does NOT show the badge when the smiting ally lacks Aura of Protection', () => {
        seedRuntime({ 'Sister.smiteOfProtectionActive': true });

        renderSummary({ characters: [makeCharacter('Sister')] });

        expect(coverBadges()).toHaveLength(0);
    });

    it('does NOT show the badge when no ally has the smite active', () => {
        renderSummary({ characters: [auraAlly('Sister')] });

        expect(coverBadges()).toHaveLength(0);
    });
});

describe('Bulwark of Force cover badge', () => {
    it('shows half-cover badge when an ally raised the bulwark and named the player as a target', () => {
        seedRuntime({
            'Ally.bulwarkOfForceActive': true,
            'Ally.bulwarkOfForceTargets': ['Thorin'],
        });

        renderSummary({ characters: [makeCharacter('Ally')] });

        const badge = screen.getByText('(+2 Cover: Bulwark of Force)');
        expect(badge).toHaveAttribute('title', expect.stringContaining('Half Cover from Bulwark of Force'));
    });

    it('does NOT show the badge when the player is not in the bulwark target list', () => {
        seedRuntime({
            'Ally.bulwarkOfForceActive': true,
            'Ally.bulwarkOfForceTargets': ['Merric'],
        });

        renderSummary({ characters: [makeCharacter('Ally')] });

        expect(coverBadges()).toHaveLength(0);
    });

    it('does NOT show the badge when only the player themselves raised the bulwark', () => {
        seedRuntime({
            'Thorin.bulwarkOfForceActive': true,
            'Thorin.bulwarkOfForceTargets': ['Thorin'],
        });

        renderSummary({ characters: [makeCharacter('Thorin')] });

        expect(coverBadges()).toHaveLength(0);
    });
});

describe("Nature's Sanctuary cover badge", () => {
    it('shows half-cover badge when an ally sanctuary names the player among its creatures', () => {
        seedRuntime({ 'Ally.naturesSanctuaryCreatures': ['Thorin'] });

        renderSummary({ characters: [makeCharacter('Ally')] });

        const badge = screen.getByText("(+2 Cover: Nature's Sanctuary)");
        expect(badge).toHaveAttribute('title', expect.stringContaining("Half Cover from Nature's Sanctuary"));
    });

    it('does NOT show the badge when the sanctuary protects only other creatures', () => {
        seedRuntime({ 'Ally.naturesSanctuaryCreatures': ['Merric'] });

        renderSummary({ characters: [makeCharacter('Ally')] });

        expect(coverBadges()).toHaveLength(0);
    });
});

describe('Multiple cover sources', () => {
    it('renders exactly one badge per cover type even when two allies grant the same cover', () => {
        seedRuntime({
            'Ally.bulwarkOfForceActive': true,
            'Ally.bulwarkOfForceTargets': ['Thorin'],
            'Bram.bulwarkOfForceActive': true,
            'Bram.bulwarkOfForceTargets': ['Thorin'],
        });

        renderSummary({ characters: [makeCharacter('Ally'), makeCharacter('Bram')] });

        expect(screen.getAllByText('(+2 Cover: Bulwark of Force)')).toHaveLength(1);
    });

    it('renders all three cover badges together when all three sources grant cover', () => {
        seedRuntime({
            'Sister.smiteOfProtectionActive': true,
            'Ally.bulwarkOfForceActive': true,
            'Ally.bulwarkOfForceTargets': ['Thorin'],
            'Ally.naturesSanctuaryCreatures': ['Thorin'],
        });

        renderSummary({ characters: [auraAlly('Sister'), makeCharacter('Ally')] });

        expect(coverBadges()).toHaveLength(3);
        expect(screen.getByText('(+2 Cover: Smite of Protection)'.replace('+', '+'))).toBeInTheDocument();
        expect(screen.getByText('(+2 Cover: Bulwark of Force)'.replace('+', '+'))).toBeInTheDocument();
        expect(screen.getByText("(+2 Cover: Nature's Sanctuary)")).toBeInTheDocument();
    });
});
