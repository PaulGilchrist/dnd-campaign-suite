import { render, screen, fireEvent, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import MarchingOrderPanel from './MarchingOrderPanel.jsx';

const defaultCharacters = [
    { name: 'Alice', imagePath: '/alice.png' },
    { name: 'Bob', imagePath: null },
    { name: 'Charlie', imagePath: '/charlie.png' },
];

function StatefulPanel({ initialOrder, characters, onClose, campaignName }) {
    const [order, setOrder] = useState(initialOrder);
    return (
        <MarchingOrderPanel
            marchingOrder={order}
            setMarchingOrder={setOrder}
            characters={characters}
            onClose={onClose}
            campaignName={campaignName}
        />
    );
}

function renderPanel({ initialOrder = ['Alice', 'Bob'], characters = defaultCharacters, campaignName, onClose } = {}) {
    const onCloseMock = onClose ?? vi.fn();
    const { container } = render(
        <StatefulPanel
            initialOrder={initialOrder}
            characters={characters}
            onClose={onCloseMock}
            campaignName={campaignName}
        />
    );
    return { container, onClose: onCloseMock };
}

function getRowByName(container, name) {
    const nameEl = within(container).getByText(name);
    return nameEl.closest('.marching-order-row');
}

function getOrderedNames(container) {
    return [...container.querySelectorAll('.marching-order-name')].map(el => el.textContent);
}

function getControls(row) {
    return {
        up: within(row).getByTitle('Move up'),
        down: within(row).getByTitle('Move down'),
        remove: within(row).getByTitle('Remove from order'),
    };
}

describe('MarchingOrderPanel', () => {
    describe('rendering', () => {
        it('renders the panel with a title, close button, and row list', () => {
            const { container } = renderPanel();
            expect(container.querySelector('.marching-order-panel')).toBeInTheDocument();
            expect(screen.getByText('Marching Order')).toBeInTheDocument();
            expect(screen.getByLabelText('Close marching order')).toBeInTheDocument();
            expect(container.querySelector('.marching-order-list')).toBeInTheDocument();
        });

        it('calls onClose when the close button is clicked', () => {
            const { onClose } = renderPanel();
            fireEvent.click(screen.getByLabelText('Close marching order'));
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('renders rows in marching order with rank numbers and marks the first row as leader', () => {
            const { container } = renderPanel();
            expect(getOrderedNames(container)).toEqual(['Alice', 'Bob']);
            const ranks = [...container.querySelectorAll('.marching-order-rank')].map(el => el.textContent);
            expect(ranks).toEqual(['1', '2']);
            expect(getRowByName(container, 'Alice')).toHaveClass('marching-order-leader');
            expect(getRowByName(container, 'Bob')).not.toHaveClass('marching-order-leader');
        });

        it('renders the character image when imagePath exists and initials otherwise', () => {
            const { container } = renderPanel();
            const img = container.querySelector('.marching-order-img');
            expect(img).toHaveAttribute('src', '/alice.png');
            expect(img).toHaveAttribute('alt', 'Alice');
            expect(container.querySelector('.marching-order-initial')).toHaveTextContent('B');
        });

        it('renders initials for every character that has no image', () => {
            const characters = [
                { name: 'Alice', imagePath: null },
                { name: 'Bob', imagePath: null },
            ];
            const { container } = renderPanel({ initialOrder: ['Alice', 'Bob'], characters });
            const initials = [...container.querySelectorAll('.marching-order-initial')].map(el => el.textContent);
            expect(initials).toEqual(['A', 'B']);
        });
    });

    describe('move up', () => {
        it('moves a character up and re-ranks the rows', () => {
            const { container } = renderPanel();
            fireEvent.click(getControls(getRowByName(container, 'Bob')).up);
            expect(getOrderedNames(container)).toEqual(['Bob', 'Alice']);
            expect(getRowByName(container, 'Bob')).toHaveClass('marching-order-leader');
            expect([...container.querySelectorAll('.marching-order-rank')].map(el => el.textContent)).toEqual(['1', '2']);
        });

        it('disables the move up control for the first row', () => {
            const { container } = renderPanel();
            expect(getControls(getRowByName(container, 'Alice')).up).toBeDisabled();
        });
    });

    describe('move down', () => {
        it('moves a character down and re-ranks the rows', () => {
            const { container } = renderPanel();
            fireEvent.click(getControls(getRowByName(container, 'Alice')).down);
            expect(getOrderedNames(container)).toEqual(['Bob', 'Alice']);
            expect(getRowByName(container, 'Bob')).toHaveClass('marching-order-leader');
        });

        it('disables the move down control for the last row', () => {
            const { container } = renderPanel();
            expect(getControls(getRowByName(container, 'Bob')).down).toBeDisabled();
        });
    });

    describe('remove from order', () => {
        it('removes the character, re-ranks the remaining rows, and re-offers them in the add section', () => {
            const { container } = renderPanel();
            fireEvent.click(getControls(getRowByName(container, 'Bob')).remove);
            expect(getOrderedNames(container)).toEqual(['Alice']);
            expect([...container.querySelectorAll('.marching-order-rank')].map(el => el.textContent)).toEqual(['1']);
            expect(screen.getByText('+ Bob')).toBeInTheDocument();
        });

        it('removing the leader promotes the next character to leader', () => {
            const { container } = renderPanel();
            fireEvent.click(getControls(getRowByName(container, 'Alice')).remove);
            expect(getOrderedNames(container)).toEqual(['Bob']);
            expect(getRowByName(container, 'Bob')).toHaveClass('marching-order-leader');
        });

        it('allows re-adding a removed character to the end of the order', () => {
            const { container } = renderPanel();
            fireEvent.click(getControls(getRowByName(container, 'Bob')).remove);
            fireEvent.click(screen.getByText('+ Bob'));
            expect(getOrderedNames(container)).toEqual(['Alice', 'Bob']);
            expect(screen.queryByText('+ Bob')).not.toBeInTheDocument();
        });
    });

    describe('add to order', () => {
        it('renders add buttons only for characters not already in the order', () => {
            renderPanel();
            expect(screen.getByText('+ Charlie')).toBeInTheDocument();
            expect(screen.queryByText('+ Alice')).not.toBeInTheDocument();
            expect(screen.queryByText('+ Bob')).not.toBeInTheDocument();
        });

        it('appends the added character to the end of the order with the next rank', () => {
            const { container } = renderPanel();
            fireEvent.click(screen.getByText('+ Charlie'));
            expect(getOrderedNames(container)).toEqual(['Alice', 'Bob', 'Charlie']);
            expect(getRowByName(container, 'Charlie')).not.toHaveClass('marching-order-leader');
            expect([...container.querySelectorAll('.marching-order-rank')].map(el => el.textContent)).toEqual(['1', '2', '3']);
            expect(screen.queryByText('+ Charlie')).not.toBeInTheDocument();
        });

        it('does not render the add section when every character is in the order or no characters are provided', () => {
            const { container: full } = renderPanel({ initialOrder: ['Alice', 'Bob', 'Charlie'] });
            expect(full.querySelector('.marching-order-add-section')).not.toBeInTheDocument();
            const { container: empty } = renderPanel({ initialOrder: ['Alice'], characters: [] });
            expect(empty.querySelector('.marching-order-add-section')).not.toBeInTheDocument();
        });
    });

    describe('empty state', () => {
        it('shows an empty message when the marching order is empty', () => {
            renderPanel({ initialOrder: [] });
            expect(screen.getByText('No characters assigned to march order.')).toBeInTheDocument();
        });
    });

    describe('image paths', () => {
        it('prefixes relative image paths with the campaign name', () => {
            const characters = [{ name: 'Alice', imagePath: 'alice.png' }];
            const { container } = renderPanel({ initialOrder: ['Alice'], characters, campaignName: 'SummerCampaign' });
            expect(container.querySelector('.marching-order-img')).toHaveAttribute('src', 'campaigns/SummerCampaign/alice.png');
        });

        it('uses http image paths as-is even when a campaign name is present', () => {
            const characters = [{ name: 'Alice', imagePath: 'https://example.com/alice.png' }];
            const { container } = renderPanel({ initialOrder: ['Alice'], characters, campaignName: 'SummerCampaign' });
            expect(container.querySelector('.marching-order-img')).toHaveAttribute('src', 'https://example.com/alice.png');
        });

        it('renders initials without crashing when a marching order name has no matching character', () => {
            const { container } = renderPanel({ initialOrder: ['Ghost'] });
            const ghostRow = getRowByName(container, 'Ghost');
            expect(within(ghostRow).getByText('G')).toBeInTheDocument();
            expect(getRowByName(container, 'Ghost')).toHaveClass('marching-order-leader');
        });
    });
});
