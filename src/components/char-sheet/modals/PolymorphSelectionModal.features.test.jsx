// @maintained-by-ai
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PolymorphSelectionModal from './PolymorphSelectionModal.jsx';

// Features lane: customization props (title/actionLabel), allowAnyCreature /
// object_into_creature modes, excludeTypes, CR display, and class-feature
// fallbacks. Core flows (loading, search, selection, close, CLA-391 dep
// stability) live in PolymorphSelectionModal.test.jsx.

// Mock dataLoader.loadMonsters to return controlled creature data
const mockMonsters = [
    {
        index: 'wolf',
        name: 'Wolf',
        type: 'Beast',
        size: 'Medium',
        challenge_rating: '1/4',
        speed: { walk: 40, climb: 20, swim: 20 },
        actions: [{ name: 'Bite' }, { name: 'Dash' }],
    },
    {
        index: 'giant_spider',
        name: 'Giant Spider',
        type: 'Beast',
        size: 'Medium',
        challenge_rating: '1',
        speed: { walk: 20, climb: 20 },
        actions: [{ name: 'Bite' }, { name: 'Net' }],
    },
    {
        index: 'eagle',
        name: 'Eagle',
        type: 'Beast',
        size: 'Small',
        challenge_rating: '1/4',
        speed: { fly: 50 },
        actions: [{ name: 'Beak' }, { name: 'Talons' }],
    },
    {
        index: 'ghast',
        name: 'Ghast',
        type: 'Undead',
        size: 'Medium',
        challenge_rating: '2',
        speed: { walk: 40 },
        actions: [{ name: 'Claws' }],
    },
    {
        index: 'rat',
        name: 'Rat',
        type: 'Beast',
        size: 'Tiny',
        challenge_rating: '0',
        speed: { walk: 20 },
        actions: [],
    },
    {
        index: 'giant_constrictor_snake',
        name: 'Giant Constrictor Snake',
        type: 'Beast',
        size: 'Huge',
        challenge_rating: '2',
        speed: { walk: 30, swim: 30 },
        actions: [{ name: 'Bite' }, { name: 'Constrict' }],
    },
    {
        index: 'giant_scorpion',
        name: 'Giant Scorpion',
        type: 'Beast',
        size: 'Large',
        challenge_rating: '10',
        speed: { walk: 40 },
        actions: [{ name: 'Claw' }],
    },
];

vi.mock('../../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(async () => mockMonsters),
}));

let getClassFeaturesOverride = undefined;
const CLASS_FEATURES_DEFAULT = {
    wildShapeLimitations: 'walk only (no swim or fly)',
    maxWildShapeChallengeRating: 1,
};

vi.mock('../../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(() => getClassFeaturesOverride ?? CLASS_FEATURES_DEFAULT),
}));

const baseProps = {
    playerStats: { class: { name: 'Druid' }, level: 4, rules: '5e' },
    maxCR: 1,
    campaignName: 'test-campaign',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

describe('PolymorphSelectionModal - Features', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getClassFeaturesOverride = undefined;
    });

    it('renders custom title in the header and custom action label on the confirm button', async () => {
        render(<PolymorphSelectionModal {...makeProps({ title: 'Polymorph Selection', actionLabel: 'Transform' })} />);
        await waitFor(() => {
            expect(screen.getByText('Polymorph Selection')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Transform/ })).toBeInTheDocument();
        });
        // Default title/actionLabel ("Wild Shape") are exercised by every test
        // in the core lane (PolymorphSelectionModal.test.jsx).
    });

    it('allowAnyCreature mode lists non-beasts with creature-specific copy and no wild-shape panels', async () => {
        render(<PolymorphSelectionModal {...makeProps({ allowAnyCreature: true, maxCR: 3 })} />);
        await waitFor(() => {
            // Non-beast Ghast (CR 2) now passes the type filter; numeric maxCR
            // prop overrides the class-feature default of 1 (label shows CR 3).
            expect(screen.getByText('Ghast')).toBeInTheDocument();
            expect(screen.getByText('Choose a creature form (CR 3 or lower)')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Search creatures...')).toBeInTheDocument();
        });
        expect(screen.queryByText(/Movement:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Excluded Types:/)).not.toBeInTheDocument();
    });

    it('object_into_creature mode caps the list at CR 9 regardless of maxCR', async () => {
        render(<PolymorphSelectionModal {...makeProps({
            allowAnyCreature: true,
            maxCR: 1,
            mode: 'object_into_creature',
        })} />);
        await waitFor(() => {
            expect(screen.getByText('Choose a creature form (CR 9 or lower)')).toBeInTheDocument();
            // Ghast (CR 2) exceeds maxCR 1 but passes the CR 9 mode cap
            expect(screen.getByText('Ghast')).toBeInTheDocument();
            expect(screen.queryByText('Giant Scorpion')).not.toBeInTheDocument();
        });
    });

    it('excludeTypes hides those creature types and lists them in an info panel', async () => {
        render(<PolymorphSelectionModal {...makeProps({
            allowAnyCreature: true,
            maxCR: 3,
            excludeTypes: ['Undead'],
        })} />);
        await waitFor(() => {
            expect(screen.getByText('Excluded Types:')).toBeInTheDocument();
            expect(screen.getByText('Excluded Types:').parentElement).toHaveTextContent('Undead');
            expect(screen.queryByText('Ghast')).not.toBeInTheDocument();
            expect(screen.getByText('Wolf')).toBeInTheDocument();
        });
    });

    it('formats fractional challenge ratings as decimals in beast rows', async () => {
        render(<PolymorphSelectionModal {...baseProps} />);
        await waitFor(() => {
            // Wolf and Panther would both render 'CR 0.25'; only Wolf remains here
            expect(screen.getAllByText('CR 0.25')).toHaveLength(1);
            expect(screen.getByText('CR 0')).toBeInTheDocument();
            expect(screen.getByText('Walk 20')).toBeInTheDocument();
        });
    });

    it('falls back to class-feature max CR when maxCR prop is not a number', async () => {
        getClassFeaturesOverride = {
            wildShapeLimitations: 'walk only (no swim or fly)',
            maxWildShapeChallengeRating: 0,
        };
        render(<PolymorphSelectionModal {...makeProps({ maxCR: null })} />);
        await waitFor(() => {
            expect(screen.getByText('Choose a beast form (CR 0 or lower)')).toBeInTheDocument();
            expect(screen.getByText('Rat')).toBeInTheDocument();
            expect(screen.queryByText('Wolf')).not.toBeInTheDocument();
        });
    });
});
