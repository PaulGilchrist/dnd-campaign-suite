// @maintained-by-ai
// PlaytestBanner — the app-level session ribbon (plan 2026-11-25). Owns ONLY:
// stamp-driven visibility (incl. the GM-only gate), the End→confirm→rollback
// handoff wiring, and the honest failure face when the restore point is gone
// (banner STAYS, error names the problem). The rollback/reload machinery is
// owned by playtestService.test.js — cited, never re-driven.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlaytestBanner from './PlaytestBanner.jsx';
import { endEncounterPlaytest } from '../../services/encounters/playtestService.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn(),
}));
vi.mock('../../services/encounters/playtestService.js', () => ({
    endEncounterPlaytest: vi.fn(),
}));

import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const CN = 'test-campaign';
const SNAP = 'test-campaign-2026-11-25T10-00-00-000.zip';
const STAMP = { active: true, snapshot: SNAP, encounterName: 'Goblin Drill' };

function mount() {
    return render(<PlaytestBanner campaignName={CN} isLocalhost />);
}

beforeEach(() => {
    vi.mocked(useRuntimeValue).mockReturnValue(STAMP);
    vi.mocked(endEncounterPlaytest).mockReset();
});

it('renders nothing without an active stamp', () => {
    vi.mocked(useRuntimeValue).mockReturnValue(null);
    const { container } = mount();
    expect(container).toBeEmptyDOMElement();
});

it('renders nothing for a visitor origin (GM-only ribbon)', () => {
    const { container } = render(<PlaytestBanner campaignName={CN} isLocalhost={false} />);
    expect(container).toBeEmptyDOMElement();
});

it('names the encounter and the snapshot, and offers End Playtest', () => {
    mount();
    expect(screen.getByRole('status')).toHaveTextContent('Goblin Drill');
    const end = screen.getByRole('button', { name: /End Playtest/i });
    expect(end).toHaveAttribute('title', `Roll the campaign back to ${SNAP}`);
});

it('End routes through the shared confirm dialog and fires the rollback', async () => {
    vi.mocked(endEncounterPlaytest).mockReturnValue(new Promise(() => {})); // never settles: no reload in tests
    mount();
    fireEvent.click(screen.getByRole('button', { name: /End Playtest/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(SNAP);
    fireEvent.click(screen.getByRole('button', { name: 'Roll back campaign' }));
    await waitFor(() => expect(endEncounterPlaytest).toHaveBeenCalledWith(CN));
});

it('Cancel on the confirm never rolls back', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /End Playtest/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(endEncounterPlaytest).not.toHaveBeenCalled();
});

it('a refused rollback keeps the banner up and surfaces the reason', async () => {
    vi.mocked(endEncounterPlaytest).mockRejectedValue(
        new Error('Restore point pruned — roll back from Campaign Admin')
    );
    mount();
    fireEvent.click(screen.getByRole('button', { name: /End Playtest/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll back campaign' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Campaign Admin');
    // The ribbon itself (role=status) must survive — the campaign is still dirty.
    expect(screen.getByRole('status')).toBeInTheDocument();
});
