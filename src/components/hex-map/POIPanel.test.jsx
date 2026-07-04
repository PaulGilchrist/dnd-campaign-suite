// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import POIPanel from './POIPanel.jsx';

function renderPanel(onClose = vi.fn()) {
    return render(<POIPanel onClose={onClose} />);
}

describe('POIPanel', () => {
    let onClose;

    beforeEach(() => {
        onClose = vi.fn();
    });

    describe('close button', () => {
        it('calls onClose when clicked', () => {
            renderPanel(onClose);
            fireEvent.click(screen.getByRole('button'));
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('POI items', () => {
        it('renders exactly 9 POI items', () => {
            const { container } = renderPanel();
            const items = container.querySelectorAll('.poi-panel-item');
            expect(items).toHaveLength(9);
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

        it('sets drag data and creates a ghost image on drag start', () => {
            renderPanel();
            const items = document.querySelectorAll('.poi-panel-item');
            const firstItem = items[0];
            const dataTransfer = createDataTransfer();
            fireEvent.dragStart(firstItem, { dataTransfer, currentTarget: firstItem });
            expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'camp');
            expect(dataTransfer.setDragImage).toHaveBeenCalled();
        });
    });
});
// @cleaned-by-ai
