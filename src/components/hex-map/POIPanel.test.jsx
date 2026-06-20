// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import POIPanel from './POIPanel.jsx';

const POI_TYPE_IDS = [
    'camp',
    'city',
    'dungeon',
    'hazard',
    'landmark',
    'loreSite',
    'naturalWonder',
    'settlement',
    'tower',
];

function renderPanel(onClose = vi.fn()) {
    return render(<POIPanel onClose={onClose} />);
}

describe('POIPanel', () => {
    let onClose;

    beforeEach(() => {
        onClose = vi.fn();
    });

    describe('close button', () => {
        it('renders a close button', () => {
            renderPanel(onClose);
            expect(screen.getByRole('button')).toBeInTheDocument();
        });

        it('calls onClose when clicked', () => {
            renderPanel(onClose);
            fireEvent.click(screen.getByRole('button'));
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('POI items', () => {
        it('renders one item per POI type with the correct name', () => {
            renderPanel();
            const expectedNames = ['Camp', 'City', 'Dungeon', 'Hazard', 'Landmark', 'Lore Site', 'Natural Wonder', 'Settlement', 'Tower'];
            expectedNames.forEach(name => {
                expect(screen.getByText(name)).toBeInTheDocument();
            });
        });

        it('renders exactly 9 POI items', () => {
            const { container } = renderPanel();
            const items = container.querySelectorAll('.poi-panel-item');
            expect(items).toHaveLength(9);
        });

        it('makes each POI item draggable', () => {
            const { container } = renderPanel();
            const items = container.querySelectorAll('.poi-panel-item');
            items.forEach(item => {
                expect(item).toHaveAttribute('draggable', 'true');
            });
        });
    });

    describe('drag behavior', () => {
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

        it('sets the correct POI type id as drag data for each item', () => {
            renderPanel();
            const items = document.querySelectorAll('.poi-panel-item');
            POI_TYPE_IDS.forEach((id, index) => {
                const dataTransfer = createDataTransfer();
                fireEvent.dragStart(items[index], { dataTransfer, currentTarget: items[index] });
                expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', id);
            });
        });

        it('creates a drag ghost image on drag start', () => {
            renderPanel();
            const items = document.querySelectorAll('.poi-panel-item');
            const firstItem = items[0];
            const dataTransfer = createDataTransfer();
            fireEvent.dragStart(firstItem, { dataTransfer, currentTarget: firstItem });
            expect(dataTransfer.setDragImage).toHaveBeenCalled();
        });
    });
});
