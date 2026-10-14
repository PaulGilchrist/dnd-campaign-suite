import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import POIPanel from './POIPanel.jsx';
import { POI_TYPES } from '../../config/outdoorConfig.js';

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

    describe('POI items rendering', () => {
        it('renders all POI type names as text', () => {
            renderPanel();
            for (const poiType of POI_TYPES) {
                expect(screen.getByText(poiType.name)).toBeInTheDocument();
            }
        });

        it('renders POI items in the correct order matching POI_TYPES', () => {
            renderPanel();
            const items = document.querySelectorAll('.poi-panel-item span');
            const names = [...items].map(span => span.textContent);
            const expectedNames = POI_TYPES.map(poi => poi.name);
            expect(names).toEqual(expectedNames);
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

        it('sets correct drag data for each POI type', () => {
            renderPanel();
            const items = document.querySelectorAll('.poi-panel-item');
            items.forEach((item, index) => {
                const expectedId = POI_TYPES[index].id;
                const dataTransfer = createDataTransfer();
                fireEvent.dragStart(item, { dataTransfer, currentTarget: item });
                expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', expectedId);
            });
        });
    });

    describe('drag ghost fallback behavior', () => {
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

        it.each([
            ['missing', (items) => {
                const svg = items[0].querySelector('svg');
                svg.removeAttribute('width');
                svg.removeAttribute('height');
            }],
            ['zero', (items) => {
                const svg = items[0].querySelector('svg');
                svg.setAttribute('width', '0');
                svg.setAttribute('height', '0');
            }],
        ])('uses fallback dimensions when SVG %s', (_, modifySvg) => {
            renderPanel();
            const items = document.querySelectorAll('.poi-panel-item');
            modifySvg(items);
            const firstItem = items[0];
            const dataTransfer = createDataTransfer();

            fireEvent.dragStart(firstItem, { dataTransfer, currentTarget: firstItem });

            expect(dataTransfer.setDragImage).toHaveBeenCalled();
            const callArgs = dataTransfer.setDragImage.mock.calls[0];
            expect(callArgs[1]).toBe(18);
            expect(callArgs[2]).toBe(18);
        });

        it('returns early without creating ghost when SVG element is not found', () => {
            renderPanel();
            const items = document.querySelectorAll('.poi-panel-item');
            const firstItem = items[0];
            const svg = firstItem.querySelector('svg');
            svg.remove();
            const dataTransfer = createDataTransfer();

            fireEvent.dragStart(firstItem, { dataTransfer, currentTarget: firstItem });

            expect(dataTransfer.setDragImage).not.toHaveBeenCalled();
        });
    });
});
