// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AnimalShapesSelectionModal from './AnimalShapesSelectionModal.jsx';

// Mock dataLoader.loadMonsters to return controlled beast data
// Filtering rules: type='beast' (case-insensitive), CR <= maxCR, size Tiny/Small/Medium/Large (RAW "Large or smaller")
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

// Helper to extract beast name from a beast-item element
function getBeastName(itemEl) {
    const nameEl = itemEl.querySelector('.animal-shapes-beast-name');
    return nameEl ? nameEl.childNodes[0].textContent.trim() : '';
}

// Helper to find a beast item by name within a specific target section
function findBeastItemInSection(beastName, sectionIndex) {
    const sections = document.querySelectorAll('.animal-shapes-target-section');
    const section = sections[sectionIndex];
    if (!section) return null;
    const items = section.querySelectorAll('.animal-shapes-beast-item');
    for (const item of items) {
        if (getBeastName(item) === beastName) {
            return item;
        }
    }
    return null;
}

// Helper to find a beast item by name across all target sections (first match, section 0)
function findBeastItem(beastName) {
    return findBeastItemInSection(beastName, 0);
}

describe('AnimalShapesSelectionModal', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        const { loadMonsters } = await import('../../../services/ui/dataLoader.js');
        loadMonsters.mockImplementation(() => Promise.resolve(mockBeasts));
    });

    describe('modal structure', () => {
        it('renders the instruction text with CR limit', async () => {
            render(<AnimalShapesSelectionModal {...baseProps} />);
            await waitFor(() => {
                expect(screen.getByText(/Choose a beast form \(CR 4 or lower, Large or smaller\)/)).toBeInTheDocument();
            });
        });

        it('renders sections for each target', async () => {
            render(<AnimalShapesSelectionModal {...baseProps} />);
            await waitFor(() => {
                expect(screen.getByText('Alric')).toBeInTheDocument();
                expect(screen.getByText('Berenik')).toBeInTheDocument();
            });
        });

        it('renders Cancel and Transform buttons', async () => {
            render(<AnimalShapesSelectionModal {...baseProps} />);
            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
                const transformBtn = screen.getByRole('button', { name: /Transform/ });
                expect(transformBtn).toBeInTheDocument();
                expect(transformBtn).toBeDisabled();
            });
        });
    });

    describe('creature filtering', () => {
        it('filters out non-beast creatures', async () => {
            render(<AnimalShapesSelectionModal {...baseProps} />);
            await waitFor(() => {
                expect(screen.queryAllByText('Ghast').length).toBe(0);
            });
        });

        it('includes Tiny, Small, Medium and Large beasts (RAW "Large or smaller"), excludes Huge', async () => {
            render(<AnimalShapesSelectionModal {...baseProps} />);
            await waitFor(() => {
                const beasts = document.querySelectorAll('.animal-shapes-beast-name');
                const names = Array.from(beasts).map(el => el.childNodes[0].textContent.trim());
                // Medium creatures (Hippogriff) are selectable (CR 1)
                expect(names).toContain('Hippogriff');
                // Tiny creatures (Rat, Owl) are selectable (CR 0)
                expect(names).toContain('Rat');
                expect(names).toContain('Owl');
                // Huge creatures (Giant Elk) are excluded even at CR <= 4
                expect(names).not.toContain('Giant Elk');
            });
        });
    });

    describe('search functionality', () => {
        function getBeastNamesInSection(sectionEl) {
            const items = sectionEl.querySelectorAll('.animal-shapes-beast-item');
            return Array.from(items).map(getBeastName);
        }

        it('filters beasts by name when searching', async () => {
            render(<AnimalShapesSelectionModal {...baseProps} />);
            await waitFor(() => {
                expect(screen.getAllByText('Crocodile').length).toBe(2);
                expect(screen.getAllByText('Panther').length).toBe(2);
            });

            const inputs = document.querySelectorAll('input[type="text"]');
            fireEvent.change(inputs[0], { target: { value: 'cro' } });

            await waitFor(() => {
                const firstSection = document.querySelectorAll('.animal-shapes-target-section')[0];
                const firstNames = getBeastNamesInSection(firstSection);
                expect(firstNames).toContain('Crocodile');
                expect(firstNames).not.toContain('Panther');
            });
        });

        it('search is per-target (does not affect other targets)', async () => {
            render(<AnimalShapesSelectionModal {...baseProps} />);
            await waitFor(() => {
                expect(screen.getAllByText('Crocodile').length).toBe(2);
                expect(screen.getAllByText('Eagle').length).toBe(2);
            });

            const inputs = document.querySelectorAll('input[type="text"]');
            fireEvent.change(inputs[0], { target: { value: 'cro' } });

            await waitFor(() => {
                const firstSection = document.querySelectorAll('.animal-shapes-target-section')[0];
                const firstNames = getBeastNamesInSection(firstSection);
                expect(firstNames).toContain('Crocodile');
                expect(firstNames).not.toContain('Eagle');

                const secondSection = document.querySelectorAll('.animal-shapes-target-section')[1];
                const secondNames = getBeastNamesInSection(secondSection);
                expect(secondNames).toContain('Eagle');
            });
        });

        it('clears search filter when input is cleared', async () => {
            render(<AnimalShapesSelectionModal {...baseProps} />);
            await waitFor(() => {
                expect(screen.getAllByText('Crocodile').length).toBe(2);
                expect(screen.getAllByText('Panther').length).toBe(2);
            });

            const inputs = document.querySelectorAll('input[type="text"]');
            fireEvent.change(inputs[0], { target: { value: 'cro' } });
            await waitFor(() => {
                const firstSection = document.querySelectorAll('.animal-shapes-target-section')[0];
                const firstNames = getBeastNamesInSection(firstSection);
                expect(firstNames).not.toContain('Panther');
            });

            fireEvent.change(inputs[0], { target: { value: '' } });
            await waitFor(() => {
                const firstSection = document.querySelectorAll('.animal-shapes-target-section')[0];
                const firstNames = getBeastNamesInSection(firstSection);
                expect(firstNames).toContain('Panther');
            });
        });

        it('shows "No beasts match" when search has no results', async () => {
            render(<AnimalShapesSelectionModal {...baseProps} />);
            await waitFor(() => {
                expect(screen.getAllByText('Crocodile').length).toBe(2);
            });

            const inputs = document.querySelectorAll('input[type="text"]');
            fireEvent.change(inputs[0], { target: { value: 'xyznonexistent' } });

            await waitFor(() => {
                const firstSection = document.querySelectorAll('.animal-shapes-target-section')[0];
                expect(firstSection.querySelector('.sp-note')).toBeInTheDocument();
            });
        });

        it('performs case-insensitive search', async () => {
            render(<AnimalShapesSelectionModal {...baseProps} />);
            await waitFor(() => {
                expect(screen.getAllByText('Eagle').length).toBe(2);
            });

            const inputs = document.querySelectorAll('input[type="text"]');
            fireEvent.change(inputs[0], { target: { value: 'EAGLE' } });

            await waitFor(() => {
                const firstSection = document.querySelectorAll('.animal-shapes-target-section')[0];
                const firstNames = getBeastNamesInSection(firstSection);
                expect(firstNames).toContain('Eagle');
                expect(firstNames).not.toContain('Crocodile');
            });
        });
    });

    describe('beast selection', () => {
        it('selects a beast when clicking on it', async () => {
            render(<AnimalShapesSelectionModal {...baseProps} />);
            await waitFor(() => {
                expect(screen.getAllByText('Crocodile').length).toBe(2);
            });

            const crocItem = findBeastItem('Crocodile');
            fireEvent.click(crocItem);

            await waitFor(() => {
                const selectedBadge = document.querySelector('.animal-shapes-selected-badge');
                expect(selectedBadge).toBeInTheDocument();
                expect(selectedBadge.textContent).toContain('Crocodile');
            });
        });

        it('toggles selection off when clicking the same beast again', async () => {
            render(<AnimalShapesSelectionModal {...baseProps} />);
            await waitFor(() => {
                expect(screen.getAllByText('Crocodile').length).toBe(2);
            });

            const crocItem = findBeastItem('Crocodile');
            fireEvent.click(crocItem);
            await waitFor(() => {
                expect(document.querySelector('.animal-shapes-selected-badge')).toBeInTheDocument();
            });

            const selectedCroc = document.querySelector('.animal-shapes-beast-item.selected');
            expect(getBeastName(selectedCroc)).toBe('Crocodile');
            fireEvent.click(selectedCroc);
            await waitFor(() => {
                expect(document.querySelector('.animal-shapes-selected-badge')).not.toBeInTheDocument();
            });
        });

        it('switches selection to a different beast for the same target', async () => {
            render(<AnimalShapesSelectionModal {...baseProps} />);
            await waitFor(() => {
                expect(screen.getAllByText('Crocodile').length).toBe(2);
                expect(screen.getAllByText('Brown Bear').length).toBe(2);
            });

            fireEvent.click(findBeastItem('Crocodile'));
            await waitFor(() => {
                expect(document.querySelector('.animal-shapes-selected-badge').textContent).toContain('Crocodile');
            });

            fireEvent.click(findBeastItem('Brown Bear'));
            await waitFor(() => {
                expect(document.querySelector('.animal-shapes-selected-badge').textContent).toContain('Brown Bear');
            });
        });

        it('allows independent selection per target', async () => {
            render(<AnimalShapesSelectionModal {...baseProps} />);
            await waitFor(() => {
                expect(screen.getAllByText('Crocodile').length).toBe(2);
                expect(screen.getAllByText('Panther').length).toBe(2);
            });

            fireEvent.click(findBeastItemInSection('Crocodile', 0));
            await waitFor(() => {
                expect(document.querySelector('.animal-shapes-selected-badge').textContent).toContain('Crocodile');
            });

            fireEvent.click(findBeastItemInSection('Panther', 1));
            await waitFor(() => {
                const badges = document.querySelectorAll('.animal-shapes-selected-badge');
                expect(badges.length).toBe(2);
            });
        });
    });

    describe('confirm behavior', () => {
        it('does not call onConfirm when not all targets are selected', async () => {
            render(<AnimalShapesSelectionModal {...baseProps} />);
            await waitFor(() => {
                expect(screen.getAllByText('Crocodile').length).toBe(2);
            });

            fireEvent.click(findBeastItem('Crocodile'));

            const transformBtn = screen.getByRole('button', { name: /Transform/ });
            fireEvent.click(transformBtn);

            expect(baseProps.onConfirm).not.toHaveBeenCalled();
        });
    });
});
