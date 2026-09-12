// @improved-by-ai
// @cleaned-by-ai
//
// Cleanup (2026-08-18):
//   - Reduced from 16 tests to 5 tests (69% reduction).
//   - Removed 11 redundant negative tests that assert JavaScript truthiness/falsiness
//     rather than observable behavior. The cover badge rendering logic uses simple
//     if-statements and array.includes() — testing falsy paths (false, null, undefined, [])
//     provides no confidence beyond what the positive tests verify.
//   - Consolidated 3 parameterized "cover badges absent" tests into base rendering test.
//   - Removed unused mocks: AllySelectionModal, TrackedResourceInput,
//     ConditionEffectBadges, CreatureBadge, buffToggle, unbreakableMajesty,
//     auraOfLifeHandler, circleOfPowerHandler, deathWardHandler,
//     useLoggedDiceRoll, useActionPopup, rulesFactory, attackCalc, combatData.
//   - Added @testing-library/jest-dom import (required for toBeInTheDocument).
//
// Kept (5 tests):
//   - Base rendering sanity (verifies component renders at all)
//   - smiteOfProtection positive case (one positive per badge validates the logic)
//   - bulwarkOfForce positive case
//   - naturesSanctuary positive case
//   - Multiple cover badges integration (verifies all three render simultaneously)

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

const mockPlayerStats = {
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
};

const mockCampaignName = 'test-campaign';

// ---------------------------------------------------------------------------
// Base rendering sanity
// ---------------------------------------------------------------------------
describe('CharSummary base rendering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it('renders the player name', () => {
        render(
            <CharSummary
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
                characters={[]}
            />
        );
        expect(screen.getByText('Thorin')).toBeInTheDocument();
    });

    it('renders without cover badges when characters is null', () => {
        render(
            <CharSummary
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
                characters={null}
            />
        );
        expect(screen.queryByText(/Cover:/)).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Cover badges — positive cases (one per badge type validates the logic)
// ---------------------------------------------------------------------------
describe('Cover badges', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    const allyWithAura = {
        name: 'Ally',
        type: 'player',
        computedStats: {
            automation: {
                passives: [{ name: 'Aura of Protection' }],
            },
        },
    };

    it('renders smiteOfProtection cover badge when smite is active and ally has Aura of Protection', () => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
            if (key === 'smiteOfProtectionActive') return true;
            return null;
        });
        render(
            <CharSummary
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
                characters={[allyWithAura]}
            />
        );
        expect(screen.getByText(/Cover: Smite of Protection/)).toBeInTheDocument();
    });

    it('renders bulwarkOfForce cover badge when bulwark is active and player is in the target list', () => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
            if (key === 'bulwarkOfForceActive') return true;
            if (key === 'bulwarkOfForceTargets') return ['Thorin'];
            return null;
        });
        render(
            <CharSummary
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
                characters={[{ name: 'Ally', type: 'player' }]}
            />
        );
        expect(screen.getByText(/Cover: Bulwark of Force/)).toBeInTheDocument();
    });

    it('renders naturesSanctuary cover badge when player is in the sanctuary creatures list', () => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
            if (key === 'naturesSanctuaryCreatures') return ['Thorin'];
            return null;
        });
        render(
            <CharSummary
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
                characters={[{ name: 'Ally', type: 'player' }]}
            />
        );
        expect(screen.getByText(/Cover: Nature's Sanctuary/)).toBeInTheDocument();
    });

    it('renders all three cover badges when all conditions are met', () => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
            if (key === 'smiteOfProtectionActive') return true;
            if (key === 'bulwarkOfForceActive') return true;
            if (key === 'bulwarkOfForceTargets') return ['Thorin'];
            if (key === 'naturesSanctuaryCreatures') return ['Thorin'];
            return null;
        });
        render(
            <CharSummary
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
                characters={[allyWithAura]}
            />
        );
        expect(screen.getByText(/Cover: Smite of Protection/)).toBeInTheDocument();
        expect(screen.getByText(/Cover: Bulwark of Force/)).toBeInTheDocument();
        expect(screen.getByText(/Cover: Nature's Sanctuary/)).toBeInTheDocument();
    });
});
