// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import POIPanel from './POIPanel.jsx';
import { POI_TYPES } from '../../config/outdoorConfig.js';

function createDataTransfer() {
    const data = {};
    return {
        data,
        setData: vi.fn((format, value) => {
            data[format] = value;
        }),
        setDragImage: vi.fn(),
    };
}

function getItems() {
    return [...document.querySelectorAll('.poi-panel-item')];
}

function renderedNames() {
    return getItems().map(item => item.querySelector('span').textContent);
}

function renderPanel(onClose = vi.fn()) {
    return render(<POIPanel onClose={onClose} />);
}

describe('POIPanel', () => {
    let onClose;

    beforeEach(() => {
        onClose = vi.fn();
    });

    it('renders every POI type by name, in exact POI_TYPES order, each draggable', () => {
        renderPanel(onClose);
        const items = getItems();
        expect(items).toHaveLength(POI_TYPES.length);
        expect(renderedNames()).toEqual(POI_TYPES.map(poiType => poiType.name));
        for (const item of items) {
            expect(item).toHaveAttribute('draggable', 'true');
        }
    });

    it('calls onClose exactly once when the close button is clicked', () => {
        renderPanel(onClose);
        fireEvent.click(screen.getByRole('button'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('each item dragStart dispatches its exact text/plain id and centers a scaled drag ghost', () => {
        renderPanel(onClose);
        const items = getItems();
        expect(items).toHaveLength(POI_TYPES.length);

        items.forEach((item, index) => {
            const dataTransfer = createDataTransfer();
            fireEvent.dragStart(item, { dataTransfer, currentTarget: item });

            // Exact payload bytes for this item's type, dispatched once per drag.
            expect(dataTransfer.setData).toHaveBeenCalledTimes(1);
            expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', POI_TYPES[index].id);
            expect(dataTransfer.data['text/plain']).toBe(POI_TYPES[index].id);

            // Ghost: 36x36 icon capped at 48 keeps full size; anchor is its center (18, 18).
            expect(dataTransfer.setDragImage).toHaveBeenCalledTimes(1);
            const [ghost, ghostX, ghostY] = dataTransfer.setDragImage.mock.calls[0];
            expect(ghostX).toBe(18);
            expect(ghostY).toBe(18);
            expect(ghost.querySelector('svg')).not.toBeNull();
        });
    });
});
