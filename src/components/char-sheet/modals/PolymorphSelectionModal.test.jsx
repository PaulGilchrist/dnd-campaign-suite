// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PolymorphSelectionModal from './PolymorphSelectionModal.jsx';

// Core lane: loading, list filtering/sorting, search, selection, confirm/cancel,
// and CLA-391 load-effect dep stability. Customization props (title/actionLabel),
// allowAnyCreature / object_into_creature modes, excludeTypes display, CR display,
// and class-feature fallbacks live in PolymorphSelectionModal.features.test.jsx.
//
// Fixture is deliberately local: the features lane suggested a shared fixture module,
// but that would require a new helper file (out of scope here), and the two fixtures
// intentionally differ (this one needs Rat for the maxCR-0 path and both Eagle and
// Ghast for the exclusion smoke assertion). classFeatures is NOT mocked here —
// real 5e druid level 4 yields 'walk only (no swim or fly)' limitations.
//
// NOTE: beast-row speed display is intentionally not asserted — source filtering of
// climb/burrow/swim via limitation substrings is a known defect in the bug ledger
// ('walk only (no swim or fly)'.includes('fly') === true). Row retention keys only
// off walk speed, so the name-list assertions below are stable.

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

// Mirrors the wild_shape_select caller (CharSheet.modals.jsx) which omits
// excludeTypes and maxCR — the fresh `[]` default in the effect deps used to
// refire loadBeasts every render (infinite loop, tab crash, CLA-391).
const druidStats2024 = {
    rules: '2024',
    level: 20,
    class: { name: 'Druid', class_levels: [{ level: 20, beast_max_cr: 1, wild_shape: 4 }] },
};

function getBeastItems() {
    return Array.from(document.querySelectorAll('.wild-shape-beast-item'));
}

function beastNameOf(item) {
    const clone = item.querySelector('.wild-shape-beast-name').cloneNode(true);
    clone.querySelector('.wild-shape-beast-cr')?.remove();
    return clone.textContent.replace(/\s+/g, ' ').trim();
}

function getBeastNames() {
    return getBeastItems().map(beastNameOf);
}

function findBeastItem(beastName) {
    return getBeastItems().find(item =>
        item.querySelector('.wild-shape-beast-name').textContent.includes(beastName)) || null;
}

function getSelectedItemNames() {
    return Array.from(document.querySelectorAll('.wild-shape-beast-item.selected')).map(beastNameOf);
}

function waitForBeastsLoaded() {
    return waitFor(() => {
        expect(document.querySelectorAll('.wild-shape-beast-item').length).toBeGreaterThan(0);
    });
}

describe('PolymorphSelectionModal (core)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows a loading message and no list while creature data is in flight', async () => {
        const { loadMonsters } = await import('../../../services/ui/dataLoader.js');
        loadMonsters.mockImplementationOnce(() => new Promise(() => { /* never resolves */ }));

        render(<PolymorphSelectionModal {...baseProps} />);

        expect(screen.getByText('Loading available creatures...')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Search beasts...')).not.toBeInTheDocument();
    });

    it('lists exactly the CR<=1 walking beasts, sorted by CR then name, with wild shape copy', async () => {
        render(<PolymorphSelectionModal {...baseProps} />);
        await waitForBeastsLoaded();

        expect(screen.getByText('Choose a beast form (CR 1 or lower)')).toBeInTheDocument();
        // Type filter (no Ghast), CR filter, and no-walk filter (no Eagle) in one
        // exact-list assertion, plus CR-then-name sort order.
        expect(getBeastNames()).toEqual([
            'Rat', 'Panther', 'Wolf', 'Brown Bear', 'Crocodile', 'Giant Spider',
        ]);

        const movement = Array.from(document.querySelectorAll('.wild-shape-info'))
            .find(d => d.textContent.startsWith('Movement:'));
        expect(movement).toHaveTextContent('walk only');
    });

    it('honors the maxCR prop when listing beasts', async () => {
        render(<PolymorphSelectionModal {...baseProps} maxCR={0} />);
        await waitForBeastsLoaded();

        expect(screen.getByText('Choose a beast form (CR 0 or lower)')).toBeInTheDocument();
        expect(getBeastNames()).toEqual(['Rat']);
    });

    it('search filters by name case-insensitively, shows no-results copy, and restores on clear', async () => {
        render(<PolymorphSelectionModal {...baseProps} />);
        await waitForBeastsLoaded();

        const input = screen.getByPlaceholderText('Search beasts...');

        fireEvent.change(input, { target: { value: 'cro' } });
        await waitFor(() => {
            expect(getBeastNames()).toEqual(['Crocodile']);
        });

        fireEvent.change(input, { target: { value: 'WOLF' } });
        await waitFor(() => {
            expect(getBeastNames()).toEqual(['Wolf']);
        });

        fireEvent.change(input, { target: { value: 'xyznonexistent' } });
        await waitFor(() => {
            expect(screen.getByText(/No beasts match/)).toBeInTheDocument();
            expect(document.querySelectorAll('.wild-shape-beast-item')).toHaveLength(0);
        });

        fireEvent.change(input, { target: { value: '' } });
        await waitFor(() => {
            expect(getBeastNames()).toEqual([
                'Rat', 'Panther', 'Wolf', 'Brown Bear', 'Crocodile', 'Giant Spider',
            ]);
        });
    });

    it('single-selects a beast (switchable), and confirms once with the chosen beast', async () => {
        render(<PolymorphSelectionModal {...baseProps} />);
        await waitForBeastsLoaded();

        const confirmBtn = screen.getByRole('button', { name: 'Wild Shape' });
        expect(confirmBtn).toBeDisabled();

        fireEvent.click(findBeastItem('Wolf'));
        await waitFor(() => expect(confirmBtn).toBeEnabled());
        expect(getSelectedItemNames()).toEqual(['Wolf']);

        // Selection switches and stays single
        fireEvent.click(findBeastItem('Brown Bear'));
        await waitFor(() => expect(getSelectedItemNames()).toEqual(['Brown Bear']));

        fireEvent.click(findBeastItem('Wolf'));
        fireEvent.click(confirmBtn);

        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
        expect(baseProps.onConfirm.mock.calls[0][0]).toMatchObject({ index: 'wolf', name: 'Wolf' });
    });

    it('calls onCancel from the Cancel button and the Escape key', async () => {
        render(<PolymorphSelectionModal {...baseProps} />);
        await waitForBeastsLoaded();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(baseProps.onCancel).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(baseProps.onCancel).toHaveBeenCalledTimes(2);
    });

    it('loads monsters exactly once when maxCR and excludeTypes are omitted, even across rerenders (CLA-391)', async () => {
        const { loadMonsters } = await import('../../../services/ui/dataLoader.js');
        const renderModal = () => (
            <PolymorphSelectionModal
                playerStats={druidStats2024}
                campaignName="test-campaign"
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        const { rerender } = render(renderModal());
        await waitForBeastsLoaded();
        rerender(renderModal());
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(loadMonsters).toHaveBeenCalledTimes(1);
    });

    it('keeps the load effect stable when given an inline excludeTypes array by value (CLA-391)', async () => {
        const { loadMonsters } = await import('../../../services/ui/dataLoader.js');
        const renderModal = () => (
            <PolymorphSelectionModal
                playerStats={druidStats2024}
                maxCR={1}
                campaignName="test-campaign"
                excludeTypes={['undead']}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        const { rerender } = render(renderModal());
        await waitForBeastsLoaded();
        rerender(renderModal());
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(loadMonsters).toHaveBeenCalledTimes(1);
    });
});
