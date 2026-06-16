import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MarchingOrderPanel from './MarchingOrderPanel.jsx';

describe('MarchingOrderPanel', () => {
    let marchingOrder, setMarchingOrder, characters, onClose;

    beforeEach(() => {
        marchingOrder = ['Alice', 'Bob'];
        setMarchingOrder = vi.fn();
        characters = [
            { name: 'Alice', imagePath: '/alice.png' },
            { name: 'Bob', imagePath: null },
            { name: 'Charlie', imagePath: '/charlie.png' },
        ];
        onClose = vi.fn();
    });

    it('should render the panel container', () => {
        const { container } = render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const panel = container.querySelector('.marching-order-panel');
        expect(panel).toBeInTheDocument();
    });

    it('should render the title', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        expect(screen.getByText('Marching Order')).toBeInTheDocument();
    });

    it('should render a close button with Font Awesome icon', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const closeBtn = document.querySelector('.marching-order-close');
        expect(closeBtn).toBeInTheDocument();
        const icon = document.querySelector('.fa-times');
        expect(icon).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        fireEvent.click(document.querySelector('.marching-order-close'));
        expect(onClose).toHaveBeenCalled();
    });

    it('should render the list container', () => {
        const { container } = render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const list = container.querySelector('.marching-order-list');
        expect(list).toBeInTheDocument();
    });

    it('should render rows for each character in marching order', () => {
        const { container } = render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const rows = container.querySelectorAll('.marching-order-row');
        expect(rows.length).toBe(2);
    });

    it('should render rank numbers for each row', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should render character names in rows', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('should mark the first row as leader', () => {
        const { container } = render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const rows = container.querySelectorAll('.marching-order-row');
        expect(rows[0]).toHaveClass('marching-order-leader');
        expect(rows[1]).not.toHaveClass('marching-order-leader');
    });

    it('should render character image if imagePath exists', () => {
        const { container } = render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const imgs = container.querySelectorAll('.marching-order-img');
        expect(imgs.length).toBe(1);
        expect(imgs[0]).toHaveAttribute('src', '/alice.png');
        expect(imgs[0]).toHaveAttribute('alt', 'Alice');
    });

    it('should render initial when no imagePath', () => {
        const { container } = render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const initials = container.querySelectorAll('.marching-order-initial');
        expect(initials.length).toBe(1);
        expect(initials[0]).toHaveTextContent('B');
    });

    it('should render controls (move up, move down, remove) for each row', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const upIcons = document.querySelectorAll('.fa-chevron-up');
        const downIcons = document.querySelectorAll('.fa-chevron-down');
        const removeIcons = document.querySelectorAll('.fa-xmark');
        expect(upIcons.length).toBe(2);
        expect(downIcons.length).toBe(2);
        expect(removeIcons.length).toBe(2);
    });

    it('should disable move up for the first row', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const buttons = document.querySelectorAll('.marching-order-controls button');
        expect(buttons[0]).toBeDisabled();
    });

    it('should disable move down for the last row', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        // 2 rows: 3 buttons each = 6 buttons total
        // Row 0: buttons[0]=up(disabled), buttons[1]=down, buttons[2]=remove
        // Row 1: buttons[3]=up, buttons[4]=down(disabled), buttons[5]=remove
        const buttons = document.querySelectorAll('.marching-order-controls button');
        expect(buttons[4]).toBeDisabled();
    });

    it('should move a character up when move up button is clicked', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const buttons = document.querySelectorAll('.marching-order-controls button');
        // Bob is at index 1, move up button is at index 3 (up, down, remove for row 1)
        fireEvent.click(buttons[3]);
        expect(setMarchingOrder).toHaveBeenCalledWith(['Bob', 'Alice']);
    });

    it('should not move up when already at index 0', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const buttons = document.querySelectorAll('.marching-order-controls button');
        // Alice is at index 0, move up button is at index 0
        fireEvent.click(buttons[0]);
        expect(setMarchingOrder).not.toHaveBeenCalled();
    });

    it('should move a character down when move down button is clicked', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const buttons = document.querySelectorAll('.marching-order-controls button');
        // Alice is at index 0, move down button is at index 1
        fireEvent.click(buttons[1]);
        expect(setMarchingOrder).toHaveBeenCalledWith(['Bob', 'Alice']);
    });

    it('should not move down when already at last index', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const buttons = document.querySelectorAll('.marching-order-controls button');
        // Bob is at index 1 (last), move down button is at index 4
        fireEvent.click(buttons[4]);
        expect(setMarchingOrder).not.toHaveBeenCalled();
    });

    it('should remove a character from order when remove button is clicked', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const buttons = document.querySelectorAll('.marching-order-controls button');
        // Remove button for Bob is at index 5 (up, down, remove for row 1)
        fireEvent.click(buttons[5]);
        const arg = setMarchingOrder.mock.calls[0][0];
        const result = typeof arg === 'function' ? arg(['Alice', 'Bob']) : arg;
        expect(result).toEqual(['Alice']);
    });

    it('should render empty message when marching order is empty', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={[]}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        expect(screen.getByText('No characters assigned to march order.')).toBeInTheDocument();
    });

    it('should not render empty message when order has items', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        expect(screen.queryByText('No characters assigned to march order.')).not.toBeInTheDocument();
    });

    it('should render add section when there are characters not in order', () => {
        const { container } = render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const addSection = container.querySelector('.marching-order-add-section');
        expect(addSection).toBeInTheDocument();
    });

    it('should render add label', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        expect(screen.getByText('Add character:')).toBeInTheDocument();
    });

    it('should render add buttons for characters not in order', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        expect(screen.getByText('+ Charlie')).toBeInTheDocument();
    });

    it('should add a character when add button is clicked', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        fireEvent.click(screen.getByText('+ Charlie'));
        const arg = setMarchingOrder.mock.calls[0][0];
        const result = typeof arg === 'function' ? arg(['Alice', 'Bob']) : arg;
        expect(result).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('should not add a character already in order', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        // Alice and Bob are already in order, so no add buttons for them
        expect(screen.queryByText('+ Alice')).not.toBeInTheDocument();
        expect(screen.queryByText('+ Bob')).not.toBeInTheDocument();
    });

    it('should not render add section when all characters are in order', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={['Alice', 'Bob', 'Charlie']}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const addSection = document.querySelector('.marching-order-add-section');
        expect(addSection).not.toBeInTheDocument();
    });

    it('should render add buttons with correct class', () => {
        render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const addBtns = document.querySelectorAll('.marching-order-add-btn');
        expect(addBtns.length).toBe(1);
    });

    it('should render controls with correct class', () => {
        const { container } = render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const controls = container.querySelectorAll('.marching-order-controls');
        expect(controls.length).toBe(2);
    });

    it('should render avatar container for each row', () => {
        const { container } = render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const avatars = container.querySelectorAll('.marching-order-avatar');
        expect(avatars.length).toBe(2);
    });

    it('should render name span with correct class', () => {
        const { container } = render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const nameSpans = container.querySelectorAll('.marching-order-name');
        expect(nameSpans.length).toBe(2);
    });

    it('should render rank span with correct class', () => {
        const { container } = render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const ranks = container.querySelectorAll('.marching-order-rank');
        expect(ranks.length).toBe(2);
    });

    it('should render add section with correct classes', () => {
        const { container } = render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const addSection = container.querySelector('.marching-order-add-section');
        expect(addSection).toHaveClass('marching-order-add-section');
        const addLabel = addSection.querySelector('.marching-order-add-label');
        expect(addLabel).toHaveClass('marching-order-add-label');
    });

    it('should handle single character in marching order', () => {
        const { container } = render(
            <MarchingOrderPanel
                marchingOrder={['Alice']}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const rows = container.querySelectorAll('.marching-order-row');
        expect(rows.length).toBe(1);
        const buttons = document.querySelectorAll('.marching-order-controls button');
        // First row: move up disabled, move down disabled
        expect(buttons[0]).toBeDisabled();
        expect(buttons[1]).toBeDisabled();
    });

    it('should render header with correct classes', () => {
        const { container } = render(
            <MarchingOrderPanel
                marchingOrder={marchingOrder}
                setMarchingOrder={setMarchingOrder}
                characters={characters}
                onClose={onClose}
            />
        );
        const header = container.querySelector('.marching-order-header');
        expect(header).toHaveClass('marching-order-header');
        const title = container.querySelector('.marching-order-title');
        expect(title).toHaveClass('marching-order-title');
    });
});
