import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HexGridLayer from './HexGridLayer.jsx';
import { getAllHexes } from '../../services/maps/hexMapUtils.js';

vi.mock('../../config/outdoorConfig.js', () => ({
    HEX_SIZE: 30,
}));

vi.mock('../../services/maps/hexMapUtils.js', () => ({
    getAllHexes: vi.fn(() => []),
    hexToPixel: vi.fn(() => ({ x: 10, y: 20 })),
    hexToSVGPath: vi.fn(() => 'M10,20 l30,0'),
}));

function makeHexes(hexCols, hexRows) {
    const hexes = [];
    for (let r = 0; r < hexRows; r++) {
        for (let q = 0; q < hexCols; q++) {
            hexes.push({ q, r });
        }
    }
    return hexes;
}

describe('HexGridLayer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render the hex-grid-layer group', () => {
            const { container } = render(<HexGridLayer hexCols={3} hexRows={2} />);
            expect(container.querySelector('g.hex-grid-layer')).toBeInTheDocument();
        });

        it.each`
            hexCols | hexRows | expectedPaths
            ${0}    | ${3}    | ${0}
            ${3}    | ${0}    | ${0}
            ${0}    | ${0}    | ${0}
            ${1}    | ${1}    | ${1}
            ${3}    | ${2}    | ${6}
            ${5}    | ${4}    | ${20}
        `('should render one path per hex ($expectedPaths paths for $hexCols x $hexRows)', ({ hexCols, hexRows, expectedPaths }) => {
            vi.mocked(getAllHexes).mockReturnValue(makeHexes(hexCols, hexRows));
            const { container } = render(<HexGridLayer hexCols={hexCols} hexRows={hexRows} />);
            expect(container.querySelectorAll('path')).toHaveLength(expectedPaths);
        });

        it('should render large grids without crashing', () => {
            vi.mocked(getAllHexes).mockReturnValue(makeHexes(20, 15));
            expect(() => render(<HexGridLayer hexCols={20} hexRows={15} />)).not.toThrow();
        });
    });

    describe('Memoization', () => {
        it('should regenerate paths when grid dimensions change', () => {
            vi.mocked(getAllHexes).mockImplementation((cols, rows) => makeHexes(cols, rows));
            const { container, rerender } = render(<HexGridLayer hexCols={2} hexRows={2} />);
            expect(container.querySelectorAll('path')).toHaveLength(4);

            rerender(<HexGridLayer hexCols={3} hexRows={3} />);
            expect(container.querySelectorAll('path')).toHaveLength(9);
        });
    });
});
