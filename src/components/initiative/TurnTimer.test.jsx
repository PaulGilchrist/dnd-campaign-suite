import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Controlled useSyncedState: local state only (no server in a unit test).
let syncedValue = null;
const setTimer = vi.fn((v) => { syncedValue = typeof v === 'function' ? v(syncedValue) : v; });
vi.mock('../../hooks/runtime/useSyncedState.js', () => ({
    useSyncedState: () => [syncedValue, setTimer],
}));

import TurnTimer from './TurnTimer.jsx';

beforeEach(() => {
    syncedValue = null;
    setTimer.mockClear();
});

describe('TurnTimer (L5-002 §7.5)', () => {
    it('renders NOTHING while enforcement is off (byte-identical)', () => {
        const { container } = render(<TurnTimer campaignName="test-campaign" enforcementOn={false} isLocalhost />);
        expect(container.firstChild).toBeNull();
    });

    it('shows the armed clock + Start/Pause/Reset controls when enforcement is on', () => {
        const { container } = render(<TurnTimer campaignName="test-campaign" enforcementOn isLocalhost />);
        expect(container.querySelector('.turn-timer')).toBeTruthy();
        expect(screen.getByText('Start')).toBeTruthy();
    });

    it('GM can start the clock (writes running:true + endsAt to the runtime key)', () => {
        render(<TurnTimer campaignName="test-campaign" enforcementOn isLocalhost />);
        fireEvent.click(screen.getByText('Start'));
        expect(setTimer).toHaveBeenCalled();
        const written = setTimer.mock.calls.at(-1)[0];
        expect(written.running).toBe(true);
        expect(typeof written.endsAt).toBe('number');
    });

    it('duration/auto controls are GM-only (hidden from remote clients)', () => {
        render(<TurnTimer campaignName="test-campaign" enforcementOn isLocalhost={false} />);
        expect(screen.queryByText('auto')).toBeNull();
        expect(screen.queryByText('Start')).toBeTruthy(); // clock + transport still shown
    });

    it('warn class appears at ≤10s remaining', () => {
        syncedValue = { seconds: 60, running: true, endsAt: Date.now() + 5000, autoAdvance: false };
        const { container } = render(<TurnTimer campaignName="test-campaign" enforcementOn isLocalhost />);
        expect(container.querySelector('.turn-timer--warn')).toBeTruthy();
    });
});
