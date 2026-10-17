// LANE OWNERSHIP — AnimalShapesSelectionModal test trio
// - behavior.test.jsx (behavior lane): interaction lifecycle and callback contract —
//   loading/error states, Cancel/Close/Escape semantics, overlay click inertness,
//   Transform gating transitions (disabled/enabled) and the exact onConfirm payload.
//   Gating and click contracts are NOT re-asserted here.
// - THIS FILE (rendering lane): modal skeleton structure, creature filtering rules
//   (type / CR cap / size), per-target search filtering, and selection badge display
//   (badge TEXT scoped per target section — never gating or callback assertions).
// - .utils.test.jsx (presentation lane): custom title/icon, speed formatting,
//   image-error fallback, sort order, custom-CR instruction text.
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AnimalShapesSelectionModal from './AnimalShapesSelectionModal.jsx';

// Mock dataLoader.loadMonsters to return controlled beast data.
// Filtering rules exercised here: type='beast' (case-insensitive), CR <= maxCR,
// size Tiny/Small/Medium/Large (RAW "Large or smaller").
const mockBeasts = [
    {
        index: 'wolf',
        name: 'Wolf',
        type: 'Beast',
        size: 'Large',
        challenge_rating: '1/4',
        speed: { walk: 40, climb: 20, swim: 20 },
        actions: [{ name: 'Bite' }, { name: 'Dash' }],
    },
    {
        index: 'spider',
        name: 'Giant Spider',
        type: 'Beast',
        size: 'Large',
        challenge_rating: '1',
        speed: { walk: 20, climb: 20 },
        actions: [{ name: 'Bite' }, { name: 'Net' }],
    },
    {
        index: 'crocodile',
        name: 'Crocodile',
        type: 'Beast',
        size: 'Large',
        challenge_rating: '1',
        speed: { walk: 20, swim: 10 },
        actions: [{ name: 'Bite' }, { name: 'Grapple' }, { name: 'Swallow' }],
    },
    {
        index: 'panther',
        name: 'Panther',
        type: 'Beast',
        size: 'Small',
        challenge_rating: '1/4',
        speed: { walk: 40, climb: 20 },
        actions: [{ name: 'Bite' }],
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
        index: 'bear',
        name: 'Brown Bear',
        type: 'Beast',
        size: 'Large',
        challenge_rating: '1',
        speed: { walk: 40, climb: 20 },
        actions: [{ name: 'Bite' }, { name: 'Multiattack' }, { name: 'Dash' }],
    },
    {
        index: 'rat',
        name: 'Rat',
        type: 'beast',
        size: 'Tiny',
        challenge_rating: '0',
        speed: { walk: 20 },
        actions: [{ name: 'Bite' }],
    },
    {
        index: 'owl',
        name: 'Owl',
        type: 'BEAST',
        size: 'Tiny',
        challenge_rating: '0',
        speed: { fly: 10 },
        actions: [{ name: 'Beak' }],
    },
    {
        index: 'hippogriff',
        name: 'Hippogriff',
        type: 'Beast',
        size: 'Medium',
        challenge_rating: '1',
        speed: { walk: 40, fly: 60 },
        actions: [{ name: 'Horns' }, { name: 'Wings' }],
    },
    {
        index: 'giant-elk',
        name: 'Giant Elk',
        type: 'Beast',
        size: 'Huge',
        challenge_rating: '2',
        speed: { walk: 60 },
        actions: [{ name: 'Hooves' }],
    },
];

vi.mock('../../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn().mockImplementation(() => Promise.resolve(mockBeasts)),
}));

const baseProps = {
    targets: ['Alric', 'Berenik'],
    maxCR: 4,
    campaignName: 'test-campaign',
    title: 'Animal Shapes',
    icon: 'fa-paw',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
};

// Every mock beast that survives the RAW filters (beast type, CR <= 4,
// Large or smaller), in the component's CR-ascending / name-alphabetical order.
// Exact-array equality here also pins the absence of Ghast (Undead) and
// Giant Elk (Huge) without separate count checks.
const FULL_SECTION_NAMES = [
    'Owl', 'Rat',
    'Eagle', 'Panther', 'Wolf',
    'Brown Bear', 'Crocodile', 'Giant Spider', 'Hippogriff',
];

// Locate a target's section via its header's accessible text (exact name),
// so every subsequent query is scoped to that target rather than positional.
function sectionFor(targetName) {
    return screen.getByText(targetName).closest('.animal-shapes-target-section');
}

function searchInputFor(targetName) {
    return screen.getByPlaceholderText(`Search beasts for ${targetName}...`);
}

function beastNamesInSection(targetName) {
    return Array.from(sectionFor(targetName).querySelectorAll('.animal-shapes-beast-name'))
        .map(el => el.childNodes[0].textContent.trim());
}

function beastItemFor(targetName, beastName) {
    const item = Array.from(sectionFor(targetName).querySelectorAll('.animal-shapes-beast-item'))
        .find(el => el.querySelector('.animal-shapes-beast-name')?.childNodes[0].textContent.trim() === beastName);
    if (!item) throw new Error(`No beast item "${beastName}" in section for ${targetName}`);
    return item;
}

// Exact badge TEXT (icon glyph produces only whitespace, so trim yields the name).
function badgeTextFor(targetName) {
    const badge = sectionFor(targetName).querySelector('.animal-shapes-selected-badge');
    return badge ? badge.textContent.trim() : null;
}

async function renderLoaded(props) {
    const result = render(<AnimalShapesSelectionModal {...props} />);
    // Wait for the loaded footer; the accessible name pins title + live count atomically.
    await screen.findByRole('button', { name: 'Transform (0/2)' });
    return result;
}

describe('AnimalShapesSelectionModal - rendering', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        const { loadMonsters } = await import('../../../services/ui/dataLoader.js');
        loadMonsters.mockImplementation(() => Promise.resolve(mockBeasts));
    });

    describe('modal skeleton', () => {
        it('renders title, instruction text, one labelled section per target, and footer actions', async () => {
            await renderLoaded(baseProps);

            expect(screen.getByText('Animal Shapes')).toBeInTheDocument();
            expect(screen.getByText('Choose a beast form (CR 4 or lower, Large or smaller) for each target:')).toBeInTheDocument();

            // One section per target, identified by exact header text and per-target placeholder.
            expect(screen.getByText('Alric')).toBeInTheDocument();
            expect(screen.getByText('Berenik')).toBeInTheDocument();
            expect(searchInputFor('Alric')).toBeInTheDocument();
            expect(searchInputFor('Berenik')).toBeInTheDocument();

            // Exact accessible names. Disabled/enabled gating transitions are owned by the behavior lane.
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Transform (0/2)' })).toBeInTheDocument();
        });
    });

    describe('creature filtering', () => {
        it('renders exactly the RAW-allowed beasts in both target sections', async () => {
            await renderLoaded(baseProps);

            // Type filter (no Ghast), size filter (no Huge Giant Elk), and CR cap in one equality check.
            expect(beastNamesInSection('Alric')).toEqual(FULL_SECTION_NAMES);
            expect(beastNamesInSection('Berenik')).toEqual(FULL_SECTION_NAMES);
        });

        it('honours a fractional CR cap', async () => {
            await renderLoaded({ ...baseProps, maxCR: 0.25 });

            expect(beastNamesInSection('Alric')).toEqual(['Owl', 'Rat', 'Eagle', 'Panther', 'Wolf']);
            expect(screen.getByText('Choose a beast form (CR 0.25 or lower, Large or smaller) for each target:')).toBeInTheDocument();
        });
    });

    describe('per-target search', () => {
        it.each([
            ['cro', ['Crocodile']],
            ['CROC', ['Crocodile']],
            ['an', ['Panther', 'Giant Spider']],
        ])('filtering "%s" in one target shows exactly the matching beasts, case-insensitively, without affecting the other target', async (term, expectedNames) => {
            await renderLoaded(baseProps);

            fireEvent.change(searchInputFor('Alric'), { target: { value: term } });

            expect(beastNamesInSection('Alric')).toEqual(expectedNames);
            // The other target keeps the unfiltered list.
            expect(beastNamesInSection('Berenik')).toEqual(FULL_SECTION_NAMES);
        });

        it('restores the full list when the search input is cleared', async () => {
            await renderLoaded(baseProps);

            fireEvent.change(searchInputFor('Alric'), { target: { value: 'cro' } });
            expect(beastNamesInSection('Alric')).toEqual(['Crocodile']);

            fireEvent.change(searchInputFor('Alric'), { target: { value: '' } });
            expect(beastNamesInSection('Alric')).toEqual(FULL_SECTION_NAMES);
        });

        it('shows the exact "No beasts match." note only in the section being searched', async () => {
            await renderLoaded(baseProps);

            fireEvent.change(searchInputFor('Alric'), { target: { value: 'xyznonexistent' } });

            expect(within(sectionFor('Alric')).getByText('No beasts match.')).toBeInTheDocument();
            expect(within(sectionFor('Berenik')).queryByText('No beasts match.')).not.toBeInTheDocument();
        });
    });

    describe('selection badge display', () => {
        it('updates the target section badge text as it selects, deselects, and switches forms', async () => {
            await renderLoaded(baseProps);
            expect(badgeTextFor('Alric')).toBeNull();

            fireEvent.click(beastItemFor('Alric', 'Crocodile'));
            expect(badgeTextFor('Alric')).toBe('Crocodile');

            // Clicking the same beast again deselects — badge disappears.
            fireEvent.click(beastItemFor('Alric', 'Crocodile'));
            expect(badgeTextFor('Alric')).toBeNull();

            fireEvent.click(beastItemFor('Alric', 'Brown Bear'));
            expect(badgeTextFor('Alric')).toBe('Brown Bear');

            // Alric's choices never bleed into Berenik's section.
            expect(badgeTextFor('Berenik')).toBeNull();
        });

        it('renders an independent badge with the exact chosen form name in each target section', async () => {
            await renderLoaded(baseProps);

            fireEvent.click(beastItemFor('Alric', 'Crocodile'));
            fireEvent.click(beastItemFor('Berenik', 'Panther'));

            await waitFor(() => {
                expect(badgeTextFor('Alric')).toBe('Crocodile');
                expect(badgeTextFor('Berenik')).toBe('Panther');
            });
        });
    });
});
