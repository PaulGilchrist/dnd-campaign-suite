import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import POILayer from './POILayer.jsx';
import * as hexMapUtils from '../../services/maps/hexMapUtils.js';

vi.mock('../../services/maps/hexMapUtils.js', () => ({
    hexToPixel: vi.fn((q, r) => ({ x: q * 50, y: r * 40 })),
    hexDistance: vi.fn((a, b) => Math.max(1, Math.abs(a.q - b.q), Math.abs(a.r - b.r))),
}));

function makeProps(overrides = {}) {
    return {
        pois: [
            { id: 'poi-1', type: 'city', q: 0, r: 0, label: 'City A', visible: true, linkedMap: null },
            { id: 'poi-2', type: 'camp', q: 1, r: 0, label: 'Camp B', visible: true, linkedMap: null },
            { id: 'poi-3', type: 'dungeon', q: 0, r: 1, label: 'Dungeon C', visible: true, linkedMap: 'dungeon-map.json' },
        ],
        onPoiPointerDown: vi.fn(),
        onPoiContextMenu: vi.fn(),
        poiDragging: null,
        poiHover: null,
        isLocalhost: true,
        partyPosition: null,
        onPoiEnter: vi.fn(),
        validLinkedMaps: new Set(),
        roadStartPoiId: null,
        ...overrides,
    };
}

function renderLayer(overrideProps = {}) {
    const props = makeProps();
    const result = render(<POILayer {...props} {...overrideProps} />);
    return { props, ...result };
}

function createEnterablePoi(overrides = {}) {
    return { id: 'enterable-poi', type: 'dungeon', q: 0, r: 1, visible: true, linkedMap: 'dungeon-map.json', ...overrides };
}

describe('POILayer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('renders a POI item and label for every POI', () => {
            renderLayer();
            expect(screen.getByText('City A')).toBeInTheDocument();
            expect(screen.getByText('Camp B')).toBeInTheDocument();
            expect(screen.getByText('Dungeon C')).toBeInTheDocument();
        });

        it('renders nothing when the POI list is empty', () => {
            renderLayer({ pois: [] });
            expect(screen.queryByText('City A')).not.toBeInTheDocument();
        });

        it('renders a POI without a label when label is absent', () => {
            renderLayer({ pois: [{ id: 'poi-1', type: 'city', q: 0, r: 0, visible: true }] });
            expect(screen.queryByText('City A')).not.toBeInTheDocument();
            expect(screen.queryByText('City')).not.toBeInTheDocument();
        });
    });

    describe('visibility', () => {
        it.each([
            ['localhost with visible POI', true, true, true],
            ['localhost with invisible POI (faded)', true, false, true],
            ['non-localhost with invisible POI (hidden)', false, false, false],
            ['non-localhost with visible POI', false, true, true],
        ])('POI visibility: %s', (_desc, isLocalhost, visible, shouldBeVisible) => {
            renderLayer({
                isLocalhost,
                pois: [{ id: 'vis-poi', type: 'city', q: 0, r: 0, visible, label: 'Visible POI' }],
            });
            if (shouldBeVisible) {
                expect(screen.getByText('Visible POI')).toBeInTheDocument();
            } else {
                expect(screen.queryByText('Visible POI')).not.toBeInTheDocument();
            }
        });

        it.each([
            ['reduced (0.4)', false, '0.4'],
            ['full (1)', true, '1'],
        ])('applies %s opacity to %s POIs', (_label, visible, expectedOpacity) => {
            renderLayer({
                pois: [{ id: 'vis-poi', type: 'city', q: 0, r: 0, visible }],
            });
            const group = document.querySelector('g.poi-item');
            expect(group.getAttribute('opacity')).toBe(expectedOpacity);
        });
    });

    describe('interaction callbacks', () => {
        it('calls onPoiPointerDown on pointer down for non-enterable POIs', () => {
            const { props } = renderLayer();
            const hitArea = document.querySelector('.poi-item rect[fill="transparent"]');
            fireEvent.pointerDown(hitArea, { button: 0 });
            expect(props.onPoiPointerDown).toHaveBeenCalledWith('poi-1', expect.any(Object));
        });

        it('calls onPoiContextMenu on right-click for non-enterable POIs', () => {
            const { props } = renderLayer();
            const hitArea = document.querySelector('.poi-item rect[fill="transparent"]');
            fireEvent.contextMenu(hitArea, { button: 2 });
            expect(props.onPoiContextMenu).toHaveBeenCalledWith('poi-1', expect.any(Object));
        });
    });

    describe('enterable POIs', () => {
        function renderEnterable(overrides = {}) {
            vi.mocked(hexMapUtils.hexDistance).mockImplementation((a, b) => {
                if (a.q === 0 && a.r === 0 && b.q === 0 && b.r === 1) return 1;
                if (a.q === 0 && a.r === 0 && b.q === 0 && b.r === 0) return 0;
                return 2;
            });
            const props = makeProps({
                partyPosition: { q: 0, r: 0 },
                validLinkedMaps: new Set(['dungeon-map.json']),
                pois: [createEnterablePoi()],
                ...overrides,
            });
            const result = render(<POILayer {...props} {...overrides} />);
            return { props, ...result };
        }

        it('shows an Enter badge when adjacent to the party with a valid linked map', () => {
            renderEnterable();
            expect(screen.getByText('Enter')).toBeInTheDocument();
        });

        it.each([
            ['not adjacent to the party', { pois: [createEnterablePoi({ q: 5, r: 5 })] }],
            ['missing a linked map', { pois: [createEnterablePoi({ linkedMap: null })] }],
            ['linked to a map not in validLinkedMaps', { validLinkedMaps: new Set(['other-map.json']) }],
            ['marked invisible', { pois: [createEnterablePoi({ visible: false })] }],
            ['when the party has no position', { partyPosition: null }],
            ['when validLinkedMaps is null', { validLinkedMaps: null }],
            ['when validLinkedMaps is undefined', { validLinkedMaps: undefined }],
        ])('does not show the Enter badge when the POI is %s', (_desc, overrides) => {
            renderEnterable(overrides);
            expect(screen.queryByText('Enter')).not.toBeInTheDocument();
        });

        it('calls onPoiEnter with the POI when the enterable hit area is clicked', () => {
            const { props } = renderEnterable();
            const hitArea = document.querySelector('.poi-item-enterable rect[fill="transparent"]');
            fireEvent.click(hitArea);
            expect(props.onPoiEnter).toHaveBeenCalledWith(expect.objectContaining({ id: 'enterable-poi' }));
            expect(props.onPoiPointerDown).not.toHaveBeenCalled();
        });

        it('still opens the context menu on right-click for enterable POIs', () => {
            const { props } = renderEnterable();
            const hitArea = document.querySelector('.poi-item-enterable rect[fill="transparent"]');
            fireEvent.contextMenu(hitArea, { button: 2 });
            expect(props.onPoiContextMenu).toHaveBeenCalledWith('enterable-poi', expect.any(Object));
        });
    });

    describe('road-start selection ring', () => {
        it('shows the selection ring on the POI matching roadStartPoiId', () => {
            renderLayer({ roadStartPoiId: 'poi-1' });
            expect(document.querySelector('circle[stroke="#A08060"]')).toBeInTheDocument();
        });

        it('does not show the selection ring when roadStartPoiId does not match any POI', () => {
            renderLayer({ roadStartPoiId: 'nonexistent-poi' });
            expect(document.querySelector('circle[stroke="#A08060"]')).not.toBeInTheDocument();
        });

        it('does not show the selection ring when roadStartPoiId is null', () => {
            renderLayer({ roadStartPoiId: null });
            expect(document.querySelector('circle[stroke="#A08060"]')).not.toBeInTheDocument();
        });
    });

    describe('drag state', () => {
        it('highlights the POI whose id matches poiDragging', () => {
            renderLayer({ poiDragging: { poiId: 'poi-1' } });
            expect(document.querySelector('.poi-item rect[stroke="#FFD700"]')).toBeInTheDocument();
        });

        it('does not highlight POIs when poiDragging has a non-matching id', () => {
            renderLayer({ poiDragging: { poiId: 'nonexistent' } });
            expect(document.querySelector('.poi-item rect[stroke="#FFD700"]')).not.toBeInTheDocument();
        });
    });

    describe('placement drop preview', () => {
        it('shows a drop-preview box at the hovered position', () => {
            renderLayer({ poiHover: { x: 45, y: 50 } });
            expect(document.querySelector('rect[fill="rgba(255,215,0,0.2)"]')).toBeInTheDocument();
        });

        it('does not show a drop-preview when poiHover is null', () => {
            renderLayer({ poiHover: null });
            expect(document.querySelector('rect[fill="rgba(255,215,0,0.2)"]')).not.toBeInTheDocument();
        });
    });
});
