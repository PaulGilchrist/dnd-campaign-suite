// @maintained-by-ai
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MarchingOrderPanel from './MarchingOrderPanel.jsx';

const characters = [
    { name: 'Alice', imagePath: '/alice.png' },
    { name: 'Bob', imagePath: null },
    { name: 'Charlie', imagePath: '/charlie.png' },
];

// Controlled harness: captures every exact resolved setMarchingOrder payload
// and keeps the rendered roster in sync (the panel is fully prop-driven).
function renderPanel({ initialOrder = ['Alice', 'Bob'], roster = characters, campaignName } = {}) {
    const onClose = vi.fn();
    const writes = [];
    let current = initialOrder;
    let rerender;
    const setMarchingOrder = vi.fn(update => {
        current = typeof update === 'function' ? update(current) : update;
        writes.push(current);
        rerender(ui(current));
    });
    const ui = (order) => (
        <MarchingOrderPanel
            marchingOrder={order}
            setMarchingOrder={setMarchingOrder}
            characters={roster}
            onClose={onClose}
            campaignName={campaignName}
        />
    );
    const utils = render(ui(current));
    rerender = utils.rerender;
    return { ...utils, writes, onClose, setMarchingOrder, lastWrite: () => writes[writes.length - 1] };
}

const namesIn = container => [...container.querySelectorAll('.marching-order-name')].map(el => el.textContent);
const ranksIn = container => [...container.querySelectorAll('.marching-order-rank')].map(el => el.textContent);
const leaderName = container => container.querySelector('.marching-order-leader .marching-order-name')?.textContent ?? null;
const addButtons = container => [...container.querySelectorAll('.marching-order-add-btn')].map(el => el.textContent);

function rowControl(container, name, title) {
    const row = [...container.querySelectorAll('.marching-order-row')]
        .find(r => r.querySelector('.marching-order-name').textContent === name);
    return within(row).getByTitle(title);
}

describe('MarchingOrderPanel', () => {
    it('renders the titled panel and fires onClose exactly once without touching the order', () => {
        const { onClose, setMarchingOrder } = renderPanel();
        expect(screen.getByText('Marching Order')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Close marching order'));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(setMarchingOrder).not.toHaveBeenCalled();
    });

    it('renders rows in exact order with ranks, leader mark, images and initials — tolerating stale names', () => {
        const { container } = renderPanel({ initialOrder: ['Alice', 'Bob', 'Ghost'] });
        expect(namesIn(container)).toEqual(['Alice', 'Bob', 'Ghost']);
        expect(ranksIn(container)).toEqual(['1', '2', '3']);
        expect(leaderName(container)).toBe('Alice');
        const img = container.querySelector('.marching-order-img');
        expect(img).toHaveAttribute('src', '/alice.png');
        expect(img).toHaveAttribute('alt', 'Alice');
        expect([...container.querySelectorAll('.marching-order-initial')].map(el => el.textContent)).toEqual(['B', 'G']);
    });

    it('shows an honest empty message and offers the full roster when nobody is in the order', () => {
        const { container } = renderPanel({ initialOrder: [] });
        expect(screen.getByText('No characters assigned to march order.')).toBeInTheDocument();
        expect(namesIn(container)).toEqual([]);
        expect(addButtons(container)).toEqual(['+ Alice', '+ Bob', '+ Charlie']);
    });

    it('move up and move down emit exact swapped payloads and re-rank; ends are disabled', () => {
        const { container, lastWrite } = renderPanel({ initialOrder: ['Alice', 'Bob', 'Charlie'] });
        expect(rowControl(container, 'Alice', 'Move up')).toBeDisabled();
        expect(rowControl(container, 'Charlie', 'Move down')).toBeDisabled();

        fireEvent.click(rowControl(container, 'Bob', 'Move up'));
        expect(lastWrite()).toEqual(['Bob', 'Alice', 'Charlie']);
        expect(namesIn(container)).toEqual(['Bob', 'Alice', 'Charlie']);
        expect(leaderName(container)).toBe('Bob');

        fireEvent.click(rowControl(container, 'Alice', 'Move down'));
        expect(lastWrite()).toEqual(['Bob', 'Charlie', 'Alice']);
        expect(namesIn(container)).toEqual(['Bob', 'Charlie', 'Alice']);
        expect(ranksIn(container)).toEqual(['1', '2', '3']);
        expect(leaderName(container)).toBe('Bob');
    });

    it('remove emits exact payload, promotes the next leader, and re-offers the character', () => {
        const { container, lastWrite } = renderPanel();
        fireEvent.click(rowControl(container, 'Alice', 'Remove from order'));
        expect(lastWrite()).toEqual(['Bob']);
        expect(namesIn(container)).toEqual(['Bob']);
        expect(ranksIn(container)).toEqual(['1']);
        expect(leaderName(container)).toBe('Bob');
        expect(screen.getByText('+ Alice')).toBeInTheDocument();
    });

    it('add section offers only missing characters and appends clicks to the end', () => {
        const { container, lastWrite } = renderPanel();
        expect(addButtons(container)).toEqual(['+ Charlie']);

        fireEvent.click(screen.getByText('+ Charlie'));
        expect(lastWrite()).toEqual(['Alice', 'Bob', 'Charlie']);
        expect(namesIn(container)).toEqual(['Alice', 'Bob', 'Charlie']);
        expect(ranksIn(container)).toEqual(['1', '2', '3']);
        expect(container.querySelector('.marching-order-add-section')).not.toBeInTheDocument();

        fireEvent.click(rowControl(container, 'Bob', 'Remove from order'));
        expect(addButtons(container)).toEqual(['+ Bob']);
        fireEvent.click(screen.getByText('+ Bob'));
        expect(lastWrite()).toEqual(['Alice', 'Charlie', 'Bob']);
        expect(namesIn(container)).toEqual(['Alice', 'Charlie', 'Bob']);
    });

    it('resolves image paths: campaign-relative gets prefixed, absolute URLs stay untouched', () => {
        const { container } = renderPanel({
            roster: [
                { name: 'Alice', imagePath: 'alice.png' },
                { name: 'Bob', imagePath: 'https://example.com/bob.png' },
            ],
            campaignName: 'SummerCampaign',
        });
        const srcs = [...container.querySelectorAll('.marching-order-img')].map(el => el.getAttribute('src'));
        expect(srcs).toEqual(['campaigns/SummerCampaign/alice.png', 'https://example.com/bob.png']);
    });
});
