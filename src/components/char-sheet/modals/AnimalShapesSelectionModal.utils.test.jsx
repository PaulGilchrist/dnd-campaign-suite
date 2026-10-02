// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AnimalShapesSelectionModal from './AnimalShapesSelectionModal.jsx';

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
];

vi.mock('../../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(async () => mockBeasts),
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

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

describe('AnimalShapesSelectionModal - utility rendering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('customization props', () => {
        it('renders custom title in the header', async () => {
            render(<AnimalShapesSelectionModal {...makeProps({ title: 'Wild Shape Selection' })} />);
            await waitFor(() => {
                expect(screen.getByText('Wild Shape Selection')).toBeInTheDocument();
            });
        });

        it('renders custom icon in the header', async () => {
            render(<AnimalShapesSelectionModal {...makeProps({ icon: 'fa-dragon' })} />);
            await waitFor(() => {
                const icons = document.querySelectorAll('i.fa-solid.fa-dragon');
                expect(icons.length).toBeGreaterThan(0);
            });
        });
    });

    describe('speed display', () => {
        it('renders combined movement speeds for beasts with multiple types', async () => {
            render(<AnimalShapesSelectionModal {...baseProps} />);
            await waitFor(() => {
                const section = document.querySelectorAll('.animal-shapes-target-section')[0];
                const wolfItem = Array.from(section.querySelectorAll('.animal-shapes-beast-item')).find(item => {
                    const nameEl = item.querySelector('.animal-shapes-beast-name');
                    return nameEl && nameEl.childNodes[0].textContent.trim() === 'Wolf';
                });
                expect(wolfItem).not.toBeNull();
                const statsEl = wolfItem.querySelector('.animal-shapes-beast-stats');
                expect(statsEl.textContent.trim()).toBe('Walk 40, Climb 20, Swim 20');
            });
        });
    });

    describe('beast image error handling', () => {
        it('hides the img element when image loading fails', async () => {
            render(<AnimalShapesSelectionModal {...baseProps} />);
            await waitFor(() => {
                const images = document.querySelectorAll('.animal-shapes-beast-avatar img');
                expect(images.length).toBeGreaterThan(0);
            });

            const images = document.querySelectorAll('.animal-shapes-beast-avatar img');
            fireEvent.error(images[0]);

            await waitFor(() => {
                expect(images[0].style.display).toBe('none');
            });
        });
    });

    describe('sorting order', () => {
        it('displays beasts sorted by CR ascending then alphabetically by name', async () => {
            render(<AnimalShapesSelectionModal {...baseProps} />);
            await waitFor(() => {
                const section = document.querySelectorAll('.animal-shapes-target-section')[0];
                const items = section.querySelectorAll('.animal-shapes-beast-item');
                const names = Array.from(items).map(item => {
                    const nameEl = item.querySelector('.animal-shapes-beast-name');
                    return nameEl ? nameEl.childNodes[0].textContent.trim() : '';
                });

                // Verify the list is non-empty
                expect(names.length).toBeGreaterThan(0);

                // CR 0.25 beasts (Eagle, Panther, Wolf) should appear before CR 1 beasts (Brown Bear, Crocodile, Giant Spider)
                const isCR1 = (name) => name === 'Brown Bear' || name === 'Crocodile' || name === 'Giant Spider';
                const isCRQuarter = (name) => name === 'Eagle' || name === 'Panther' || name === 'Wolf';
                const cr1BeastIndices = names.filter(isCR1).map(name => names.indexOf(name));
                const crQuarterIndices = names.filter(isCRQuarter).map(name => names.indexOf(name));

                const maxQuarterIndex = Math.max(...crQuarterIndices);
                const minCR1Index = Math.min(...cr1BeastIndices);

                expect(maxQuarterIndex).toBeLessThan(minCR1Index);

                // Within CR 0.25, alphabetical order: Eagle < Panther < Wolf
                expect(names.indexOf('Eagle')).toBeLessThan(names.indexOf('Panther'));
                expect(names.indexOf('Panther')).toBeLessThan(names.indexOf('Wolf'));

                // Within CR 1, alphabetical order: Brown Bear < Crocodile < Giant Spider
                expect(names.indexOf('Brown Bear')).toBeLessThan(names.indexOf('Crocodile'));
                expect(names.indexOf('Crocodile')).toBeLessThan(names.indexOf('Giant Spider'));
            });
        });
    });

    describe('instruction text', () => {
        it('displays the correct CR limit in the instruction paragraph', async () => {
            render(<AnimalShapesSelectionModal {...makeProps({ maxCR: 2 })} />);
            await waitFor(() => {
                expect(screen.getByText(/Choose a beast form \(CR 2 or lower, Large or smaller\)/)).toBeInTheDocument();
            });
        });
    });
});
