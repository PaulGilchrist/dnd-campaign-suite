// @maintained-by-ai
// AI Dress overlay preview layer (backlog ai-dress-belongs-in-map-view):
// proposed ops render as cell-anchored markers ON the map svg before Apply,
// vanish when the proposal clears, and flag off-grid ops loudly.
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DressPreviewOverlay from './DressPreviewOverlay.jsx';

const GEOMETRY = {
    cellCenter: (x, y) => ({ x: x * 40 + 20, y: y * 40 + 20 }),
    cellPath: ({ x, y }) => `M${x - 20},${y - 20}h40v40h-40Z`,
};

const markers = (...ms) => ms.map((m, i) => ({ key: `k${i}`, valid: true, ...m }));

describe('DressPreviewOverlay', () => {
    it('renders nothing without drawable markers (close/Apply → zero residue)', () => {
        const { container } = render(
            <svg><DressPreviewOverlay markers={[]} {...GEOMETRY} /></svg>,
        );
        expect(container.querySelector('[data-testid="dress-preview"]')).toBeNull();
    });

    it('skips coord-less (unresolvable-id) markers — the modal list stays their surface', () => {
        const { container } = render(
            <svg>
                <DressPreviewOverlay
                    markers={markers({ kind: 'remove', x: null, y: null, label: 'remove ghost (not on this view)', valid: false })}
                    {...GEOMETRY}
                />
            </svg>,
        );
        expect(container.querySelector('[data-testid="dress-preview"]')).toBeNull();
    });

    it('draws add dots and remove cell outlines with the readable op labels at their cells', () => {
        const { container } = render(
            <svg>
                <DressPreviewOverlay
                    markers={markers(
                        { kind: 'add', x: 12, y: 8, label: 'add chest at 12,8' },
                        { kind: 'remove', x: 3, y: 4, label: 'remove torch at 3,4' },
                    )}
                    {...GEOMETRY}
                />
            </svg>,
        );
        const layer = container.querySelector('[data-testid="dress-preview"]');
        expect(layer).not.toBeNull();
        expect(container.querySelector('circle.dress-preview-dot')).not.toBeNull();
        expect(container.querySelector('.dress-preview-marker-remove .dress-preview-cell')).not.toBeNull();
        expect(screen.getByText('add chest at 12,8')).toBeInTheDocument();
        expect(screen.getByText('remove torch at 3,4')).toBeInTheDocument();
        // Anchored at the cell centres the host geometry reports.
        expect(container.querySelector('circle.dress-preview-dot')).toHaveAttribute('cx', '500');
        expect(screen.getByText('remove torch at 3,4')).toHaveAttribute('y', String(4 * 40 + 20 + 24));
    });

    it('move renders its amber source outline next to the cyan destination marker', () => {
        const { container } = render(
            <svg>
                <DressPreviewOverlay
                    markers={markers(
                        { kind: 'move-from', x: 2, y: 4, label: '' },
                        { kind: 'add', x: 9, y: 6, label: 'move torch → 9,6' },
                    )}
                    {...GEOMETRY}
                />
            </svg>,
        );
        expect(container.querySelector('.dress-preview-marker-move-from .dress-preview-cell')).not.toBeNull();
        expect(screen.getByText('move torch → 9,6')).toBeInTheDocument();
    });

    it('off-grid ops read as a loud invalid marker (⚠ label + invalid class)', () => {
        const { container } = render(
            <svg>
                <DressPreviewOverlay
                    markers={markers({ kind: 'add', x: 99, y: 2, label: 'add chest at 99,2', valid: false })}
                    {...GEOMETRY}
                />
            </svg>,
        );
        expect(container.querySelector('.dress-preview-invalid')).not.toBeNull();
        expect(screen.getByText('⚠ add chest at 99,2')).toBeInTheDocument();
    });
});
