// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PolymorphSelectionModal from './PolymorphSelectionModal.jsx';

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
        index: 'spider',
        name: 'Giant Spider',
        type: 'Beast',
        size: 'Medium',
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
        index: 'brown_bear',
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
        type: 'Beast',
        size: 'Tiny',
        challenge_rating: '0',
        speed: { walk: 20 },
        actions: [],
    },
];

vi.mock('../../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(async () => mockMonsters),
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

function findBeastItem(beastName) {
    for (const item of document.querySelectorAll('.wild-shape-beast-item')) {
        const nameEl = item.querySelector('.wild-shape-beast-name');
        if (nameEl && nameEl.textContent.includes(beastName)) {
            return item;
        }
    }
    return null;
}

function getBeastNames() {
    const items = document.querySelectorAll('.wild-shape-beast-item');
    return Array.from(items).map(item => {
        const nameEl = item.querySelector('.wild-shape-beast-name');
        if (!nameEl) return '';
        const clone = nameEl.cloneNode(true);
        const crSpan = clone.querySelector('.wild-shape-beast-cr');
        if (crSpan) crSpan.remove();
        return clone.textContent.replace(/\s+/g, ' ').trim();
    });
}

function waitForBeastsLoaded() {
    return waitFor(() => {
        const items = document.querySelectorAll('.wild-shape-beast-item');
        expect(items.length).toBeGreaterThan(0);
    });
}

describe('PolymorphSelectionModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('loading state', () => {
        it('shows loading text while data is loading', async () => {
            const { loadMonsters } = await import('../../../services/ui/dataLoader.js');
            const originalImpl = loadMonsters.getMockImplementation();
            loadMonsters.mockReturnValue(new Promise(() => { /* never resolves */ }));

            render(<PolymorphSelectionModal {...baseProps} />);

            expect(screen.getByText('Loading available creatures...')).toBeInTheDocument();

            loadMonsters.mockImplementation(originalImpl);
        });
    });

    describe('filtering', () => {
        it('renders the modal with header, instruction text, and filtered beasts', async () => {
            render(<PolymorphSelectionModal {...baseProps} />);
            await waitForBeastsLoaded();
            expect(screen.getByText('Choose a beast form (CR 1 or lower)')).toBeInTheDocument();
            expect(screen.getByText('Wolf')).toBeInTheDocument();
        });

        it('renders wild shape limitations info when not allowAnyCreature', async () => {
            render(<PolymorphSelectionModal {...baseProps} />);
            await waitForBeastsLoaded();
            const infoDivs = document.querySelectorAll('.wild-shape-info');
            const movementText = Array.from(infoDivs).find(d => d.querySelector('strong')?.textContent === 'Movement:');
            expect(movementText).toBeInTheDocument();
            expect(movementText.textContent).toContain('walk only');
        });

        it('filters out non-beast creatures when allowAnyCreature is false', async () => {
            render(<PolymorphSelectionModal {...baseProps} />);
            await waitForBeastsLoaded();
            expect(screen.queryByText('Ghast')).not.toBeInTheDocument();
        });

        it('filters out creatures with CR above effectiveMaxCR', async () => {
            render(<PolymorphSelectionModal {...makeProps({ maxCR: 0 })} />);
            await waitForBeastsLoaded();
            expect(screen.getByText('Rat')).toBeInTheDocument();
            expect(screen.queryByText('Wolf')).not.toBeInTheDocument();
        });

        it('filters beasts that lack walk speed per wild shape limitations', async () => {
            render(<PolymorphSelectionModal {...baseProps} />);
            await waitForBeastsLoaded();
            expect(screen.queryByText('Eagle')).not.toBeInTheDocument();
            expect(screen.getByText('Crocodile')).toBeInTheDocument();
        });
    });

    describe('search functionality', () => {
        it('filters beasts by name, clears on empty input, and handles no results and case-insensitivity', async () => {
            render(<PolymorphSelectionModal {...baseProps} />);
            await waitForBeastsLoaded();
            expect(screen.getByText('Crocodile')).toBeInTheDocument();
            expect(screen.getByText('Panther')).toBeInTheDocument();

            const input = screen.getByPlaceholderText('Search beasts...');

            // Filter by partial name
            fireEvent.change(input, { target: { value: 'cro' } });
            await waitFor(() => {
                const names = getBeastNames();
                expect(names).toContain('Crocodile');
                expect(names).not.toContain('Panther');
            });

            // Case-insensitive search
            fireEvent.change(input, { target: { value: 'WOLF' } });
            await waitFor(() => {
                const names = getBeastNames();
                expect(names).toContain('Wolf');
            });

            // No results
            fireEvent.change(input, { target: { value: 'xyznonexistent' } });
            await waitFor(() => {
                expect(screen.getByText(/No beasts match/)).toBeInTheDocument();
            });

            // Clear restores all
            fireEvent.change(input, { target: { value: '' } });
            await waitFor(() => {
                const names = getBeastNames();
                expect(names).toContain('Panther');
                expect(names).toContain('Wolf');
            });
        });
    });

    describe('beast selection', () => {
        it('selects a beast, enables confirm, and calls onConfirm with correct data', async () => {
            render(<PolymorphSelectionModal {...baseProps} />);
            await waitForBeastsLoaded();

            const confirmBtn = screen.getByRole('button', { name: 'Wild Shape' });
            expect(confirmBtn).toBeDisabled();

            const wolfItem = findBeastItem('Wolf');
            expect(wolfItem).toBeInTheDocument();
            fireEvent.click(wolfItem);

            await waitFor(() => {
                expect(confirmBtn).toBeEnabled();
            });

            const selectedItem = document.querySelector('.wild-shape-beast-item.selected');
            expect(selectedItem).toBeInTheDocument();
            expect(selectedItem.querySelector('.wild-shape-beast-name').textContent).toContain('Wolf');

            fireEvent.click(confirmBtn);

            await waitFor(() => {
                expect(baseProps.onConfirm).toHaveBeenCalled();
                const selected = baseProps.onConfirm.mock.calls[0][0];
                expect(selected.index).toBe('wolf');
            });
        });

        it('switches selection to a different beast', async () => {
            render(<PolymorphSelectionModal {...baseProps} />);
            await waitForBeastsLoaded();

            const wolfItem = findBeastItem('Wolf');
            fireEvent.click(wolfItem);

            const bearItem = findBeastItem('Brown Bear');
            fireEvent.click(bearItem);

            await waitFor(() => {
                const selected = document.querySelector('.wild-shape-beast-item.selected');
                const nameEl = selected.querySelector('.wild-shape-beast-name');
                expect(nameEl.textContent).toContain('Brown Bear');
            });
        });

        it('does not call onConfirm if no beast is selected', async () => {
            render(<PolymorphSelectionModal {...baseProps} />);
            await waitForBeastsLoaded();
            const confirmBtn = screen.getByRole('button', { name: 'Wild Shape' });
            expect(confirmBtn).toBeDisabled();
            fireEvent.click(confirmBtn);
            expect(baseProps.onConfirm).not.toHaveBeenCalled();
        });
    });

    describe('CLA-391 unstable excludeTypes dep', () => {
        // Mirrors the wild_shape_select caller (CharSheet.modals.jsx) which omits
        // excludeTypes and maxCR — the fresh `[]` default in the effect deps used to
        // refire loadBeasts every render (infinite loop, tab crash).
        const druidStats = {
            rules: '2024',
            level: 20,
            class: { name: 'Druid', class_levels: [{ level: 20, beast_max_cr: 1, wild_shape: 4 }] },
        };

        it('loads beasts exactly once when excludeTypes and maxCR are omitted', async () => {
            const { loadMonsters } = await import('../../../services/ui/dataLoader.js');
            render(<PolymorphSelectionModal
                playerStats={druidStats}
                campaignName="test-campaign"
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />);
            await waitForBeastsLoaded();
            await new Promise(resolve => setTimeout(resolve, 250));
            expect(loadMonsters).toHaveBeenCalledTimes(1);
        });

        it('honors caller-supplied excludeTypes by value without refiring the load effect', async () => {
            const { loadMonsters } = await import('../../../services/ui/dataLoader.js');
            const { rerender } = render(<PolymorphSelectionModal
                playerStats={druidStats}
                maxCR={1}
                campaignName="test-campaign"
                excludeTypes={['undead']}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />);
            await waitForBeastsLoaded();
            rerender(<PolymorphSelectionModal
                playerStats={druidStats}
                maxCR={1}
                campaignName="test-campaign"
                excludeTypes={['undead']}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />);
            await new Promise(resolve => setTimeout(resolve, 250));
            expect(loadMonsters).toHaveBeenCalledTimes(1);
            expect(screen.queryByText('Ghast')).not.toBeInTheDocument();
        });

        it('calls onConfirm with the chosen beast payload', async () => {
            const onConfirm = vi.fn();
            render(<PolymorphSelectionModal
                playerStats={druidStats}
                campaignName="test-campaign"
                onConfirm={onConfirm}
                onCancel={vi.fn()}
            />);
            await waitForBeastsLoaded();
            fireEvent.click(findBeastItem('Wolf'));
            fireEvent.click(screen.getByRole('button', { name: 'Wild Shape' }));
            expect(onConfirm).toHaveBeenCalledTimes(1);
            expect(onConfirm.mock.calls[0][0]).toMatchObject({ index: 'wolf', name: 'Wolf' });
        });
    });

    describe('close behavior', () => {
        it('calls onCancel when Cancel button is clicked', async () => {
            render(<PolymorphSelectionModal {...baseProps} />);
            await waitForBeastsLoaded();
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(baseProps.onCancel).toHaveBeenCalled();
        });

        it('closes when Escape key is pressed', async () => {
            render(<PolymorphSelectionModal {...baseProps} />);
            await waitForBeastsLoaded();
            fireEvent.keyDown(document, { key: 'Escape' });
            expect(baseProps.onCancel).toHaveBeenCalled();
        });
    });
});
