// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MarchingOrderPanel from './MarchingOrderPanel.jsx';

const defaultCharacters = [
    { name: 'Alice', imagePath: '/alice.png' },
    { name: 'Bob', imagePath: null },
    { name: 'Charlie', imagePath: '/charlie.png' },
];

function renderPanel(marchingOrder = ['Alice', 'Bob'], characters = defaultCharacters, overrides = {}) {
    const setMarchingOrder = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
        <MarchingOrderPanel
            marchingOrder={marchingOrder}
            setMarchingOrder={setMarchingOrder}
            characters={characters}
            onClose={onClose}
            {...overrides}
        />
    );
    return { container, setMarchingOrder, onClose };
}

function getRowByName(container, name) {
    const rows = container.querySelectorAll('.marching-order-row');
    for (const row of rows) {
        if (row.querySelector('.marching-order-name').textContent === name) {
            return row;
        }
    }
    return null;
}

describe('MarchingOrderPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('renders the panel with title, close button, and list', () => {
            const { container } = renderPanel();
            expect(container.querySelector('.marching-order-panel')).toBeInTheDocument();
            expect(screen.getByText('Marching Order')).toBeInTheDocument();
            expect(container.querySelector('.marching-order-list')).toBeInTheDocument();
        });

        it('calls onClose when close button is clicked', () => {
            const { onClose } = renderPanel();
            const closeBtn = document.querySelector('.marching-order-close');
            fireEvent.click(closeBtn);
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('renders rows with rank numbers, character names, and leader class on first row', () => {
            const { container } = renderPanel();
            const rows = container.querySelectorAll('.marching-order-row');
            expect(rows.length).toBe(2);
            expect(rows[0]).toHaveClass('marching-order-leader');
            expect(rows[1]).not.toHaveClass('marching-order-leader');
            const ranks = [...container.querySelectorAll('.marching-order-rank')].map(el => el.textContent);
            expect(ranks).toEqual(['1', '2']);
            expect(screen.getByText('Alice')).toBeInTheDocument();
            expect(screen.getByText('Bob')).toBeInTheDocument();
        });

        it('renders character image when imagePath exists, initial otherwise', () => {
            const { container } = renderPanel();
            const img = container.querySelector('.marching-order-img');
            expect(img).toHaveAttribute('src', '/alice.png');
            expect(img).toHaveAttribute('alt', 'Alice');
            const initials = container.querySelectorAll('.marching-order-initial');
            expect(initials.length).toBe(1);
            expect(initials[0]).toHaveTextContent('B');
        });

        it('renders initials for all characters without images', () => {
            const characters = [
                { name: 'Alice', imagePath: null },
                { name: 'Bob', imagePath: null },
            ];
            const { container } = renderPanel(['Alice', 'Bob'], characters);
            const initials = container.querySelectorAll('.marching-order-initial');
            expect(initials.length).toBe(2);
            expect(initials[0]).toHaveTextContent('A');
            expect(initials[1]).toHaveTextContent('B');
        });
    });

    describe('move up', () => {
        it('swaps the character up when not at the top', () => {
            const { container, setMarchingOrder } = renderPanel();
            const bobRow = getRowByName(container, 'Bob');
            const buttons = bobRow.querySelectorAll('.marching-order-controls button');
            fireEvent.click(buttons[0]);
            expect(setMarchingOrder).toHaveBeenCalledWith(['Bob', 'Alice']);
        });

        it('does nothing when the character is already at index 0', () => {
            const { container, setMarchingOrder } = renderPanel();
            const aliceRow = getRowByName(container, 'Alice');
            const buttons = aliceRow.querySelectorAll('.marching-order-controls button');
            fireEvent.click(buttons[0]);
            expect(setMarchingOrder).not.toHaveBeenCalled();
        });

        it('disables the move up button for the first row', () => {
            const { container } = renderPanel();
            const aliceRow = getRowByName(container, 'Alice');
            const buttons = aliceRow.querySelectorAll('.marching-order-controls button');
            expect(buttons[0]).toBeDisabled();
        });
    });

    describe('move down', () => {
        it('swaps the character down when not at the bottom', () => {
            const { container, setMarchingOrder } = renderPanel();
            const aliceRow = getRowByName(container, 'Alice');
            const buttons = aliceRow.querySelectorAll('.marching-order-controls button');
            fireEvent.click(buttons[1]);
            expect(setMarchingOrder).toHaveBeenCalledWith(['Bob', 'Alice']);
        });

        it('does nothing when the character is already at the last index', () => {
            const { container, setMarchingOrder } = renderPanel();
            const bobRow = getRowByName(container, 'Bob');
            const buttons = bobRow.querySelectorAll('.marching-order-controls button');
            fireEvent.click(buttons[1]);
            expect(setMarchingOrder).not.toHaveBeenCalled();
        });

        it('disables the move down button for the last row', () => {
            const { container } = renderPanel();
            const bobRow = getRowByName(container, 'Bob');
            const buttons = bobRow.querySelectorAll('.marching-order-controls button');
            expect(buttons[1]).toBeDisabled();
        });
    });

    describe('remove from order', () => {
        it('removes the character when the remove button is clicked', () => {
            const { container, setMarchingOrder } = renderPanel();
            const bobRow = getRowByName(container, 'Bob');
            const buttons = bobRow.querySelectorAll('.marching-order-controls button');
            fireEvent.click(buttons[2]);
            const arg = setMarchingOrder.mock.calls[0][0];
            const result = typeof arg === 'function' ? arg(['Alice', 'Bob']) : arg;
            expect(result).toEqual(['Alice']);
        });

        it('removes the first character when remove is clicked on row 0', () => {
            const { container, setMarchingOrder } = renderPanel();
            const aliceRow = getRowByName(container, 'Alice');
            const buttons = aliceRow.querySelectorAll('.marching-order-controls button');
            fireEvent.click(buttons[2]);
            const arg = setMarchingOrder.mock.calls[0][0];
            const result = typeof arg === 'function' ? arg(['Alice', 'Bob']) : arg;
            expect(result).toEqual(['Bob']);
        });
    });

    describe('add to order', () => {
        it('renders add buttons for characters not in order', () => {
            renderPanel();
            expect(screen.getByText('+ Charlie')).toBeInTheDocument();
        });

        it('appends the character when add button is clicked', () => {
            const { setMarchingOrder } = renderPanel();
            fireEvent.click(screen.getByText('+ Charlie'));
            const arg = setMarchingOrder.mock.calls[0][0];
            const result = typeof arg === 'function' ? arg(['Alice', 'Bob']) : arg;
            expect(result).toEqual(['Alice', 'Bob', 'Charlie']);
        });

        it('does not show add buttons for characters already in order', () => {
            renderPanel();
            expect(screen.queryByText('+ Alice')).not.toBeInTheDocument();
            expect(screen.queryByText('+ Bob')).not.toBeInTheDocument();
        });

        it('does not show add section when all characters are in order', () => {
            const { container } = renderPanel(
                ['Alice', 'Bob', 'Charlie'],
                defaultCharacters,
            );
            expect(container.querySelector('.marching-order-add-section')).not.toBeInTheDocument();
        });

        it('does not show add section when characters array is empty', () => {
            const { container } = renderPanel(['Alice'], []);
            expect(container.querySelector('.marching-order-add-section')).not.toBeInTheDocument();
        });
    });

    describe('empty state', () => {
        it('shows empty message when marching order is empty', () => {
            renderPanel([], defaultCharacters);
            expect(screen.getByText('No characters assigned to march order.')).toBeInTheDocument();
        });
    });

    describe('single character', () => {
        it('renders one row with both move buttons disabled', () => {
            const { container } = renderPanel(['Alice']);
            const rows = container.querySelectorAll('.marching-order-row');
            expect(rows.length).toBe(1);
            const buttons = container.querySelectorAll('.marching-order-controls button');
            expect(buttons[0]).toBeDisabled();
            expect(buttons[1]).toBeDisabled();
        });
    });
});
