import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTargetMapStatuses = vi.fn();

vi.mock('../../../../services/maps/spellOverlayService.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getTargetMapStatuses: (...args) => mockGetTargetMapStatuses(...args),
    };
});

import SecondaryTargetModal from './SecondaryTargetModal.jsx';

const creatureTargets = [
    { name: 'Goblin A', type: 'creature' },
    { name: 'Goblin B', type: 'creature' },
];

describe('SecondaryTargetModal map distance badges', () => {
    beforeEach(() => {
        mockGetTargetMapStatuses.mockReset().mockResolvedValue(null);
    });

    const baseProps = {
        title: 'Pick a Target',
        targets: creatureTargets,
        onTargetSelected: vi.fn(),
        onSkip: vi.fn(),
    };

    it('renders in/out/off-map badges when a map is active', async () => {
        mockGetTargetMapStatuses.mockResolvedValue({
            'Goblin A': { status: 'in', distFt: 10 },
            'Goblin B': { status: 'off-map', distFt: null },
        });

        render(<SecondaryTargetModal {...baseProps} campaignName="test-campaign" attackerName="Wizard" rangeFt={30} />);

        await waitFor(() => {
            expect(screen.getByText('In range · 10 ft')).toBeInTheDocument();
            expect(screen.getByText('Off map')).toBeInTheDocument();
        });
        expect(mockGetTargetMapStatuses).toHaveBeenCalledWith('test-campaign', 'Wizard', ['Goblin A', 'Goblin B'], 30);
    });

    it('renders blocked badge for targets behind cover', async () => {
        mockGetTargetMapStatuses.mockResolvedValue({
            'Goblin A': { status: 'blocked', distFt: 20 },
            'Goblin B': { status: 'out', distFt: 90 },
        });

        render(<SecondaryTargetModal {...baseProps} campaignName="test-campaign" attackerName="Wizard" rangeFt={30} />);

        await waitFor(() => {
            expect(screen.getByText('Blocked · 20 ft')).toBeInTheDocument();
            expect(screen.getByText('Out of range · 90 ft')).toBeInTheDocument();
        });
    });

    it('renders no badges when no map is active', async () => {
        render(<SecondaryTargetModal {...baseProps} campaignName="test-campaign" attackerName="Wizard" />);

        await waitFor(() => {
            expect(mockGetTargetMapStatuses).toHaveBeenCalled();
        });
        expect(screen.queryByText(/In range|Out of range|Off map|Blocked/)).not.toBeInTheDocument();
    });

    it('skips distance lookup without campaignName/attackerName', async () => {
        render(<SecondaryTargetModal {...baseProps} />);

        expect(screen.getByText('Goblin A')).toBeInTheDocument();
        expect(mockGetTargetMapStatuses).not.toHaveBeenCalled();
    });

    it('selecting and confirming still works with badges shown', async () => {
        mockGetTargetMapStatuses.mockResolvedValue({
            'Goblin A': { status: 'in', distFt: 5 },
            'Goblin B': { status: 'in', distFt: 10 },
        });

        const onTargetSelected = vi.fn();
        render(<SecondaryTargetModal {...baseProps} onTargetSelected={onTargetSelected} campaignName="test-campaign" attackerName="Wizard" rangeFt={30} />);

        await waitFor(() => {
            expect(screen.getByText('In range · 10 ft')).toBeInTheDocument();
        });

        const rows = document.querySelectorAll('.secondary-target-row');
        fireEvent.click(rows[1]);
        fireEvent.click(screen.getByRole('button', { name: /Attack/ }));
        expect(onTargetSelected).toHaveBeenCalledWith('Goblin B');
    });
});
