// @maintained-by-ai
// Playtest confirm connected-clients heads-up (backlog 2026-11-25): the
// confirm step asks the hub how many OTHER SSE clients are connected
// (fetchOtherConnectedClients — the GM-only /api/sse-clients lane, whose
// own-exclusion semantics are pinned server-side in server/routes/sse.test.js
// and service-side in playtestService.test.js — cited, never re-driven here).
// Legs locked: absent at zero (no false positive, base copy byte-intact),
// appear naming the count single/plural, non-blocking (Start stays armed),
// re-arm re-asks, failed read degrades to the no-notice face at console.debug.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EncounterPlaytestButton from './EncounterPlaytestButton.jsx';
import { fetchOtherConnectedClients } from '../../services/encounters/playtestService.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn(() => null),
}));
vi.mock('../../services/encounters/playtestService.js', () => ({
    startEncounterPlaytest: vi.fn(async () => ({ snapshot: 's.zip' })),
    fetchOtherConnectedClients: vi.fn(async () => 0),
}));

const BASE_COPY = 'This is a GM-solo test: no player tabs should be connected.';

function mount(props = {}) {
    render(
        <EncounterPlaytestButton
            campaignName="test-campaign"
            encounterTitle="Ambush from the Brush"
            currentEncounterName={null}
            selectedMonsters={[]}
            characters={[]}
            onStarted={vi.fn()}
            onToast={vi.fn()}
            {...props}
        />
    );
}

async function armConfirm() {
    fireEvent.click(screen.getByRole('button', { name: /Playtest/i }));
    return screen.findByRole('dialog');
}

beforeEach(() => {
    vi.mocked(fetchOtherConnectedClients).mockReset().mockResolvedValue(0);
});

it('is ABSENT when no other clients are connected, and asks the hub for the campaign', async () => {
    mount();
    const dialog = await armConfirm();
    await waitFor(() => expect(fetchOtherConnectedClients).toHaveBeenCalledWith('test-campaign'));
    // Let any resolved notice land, then prove the face stays clean.
    await waitFor(() => expect(dialog).toHaveTextContent(BASE_COPY));
    expect(dialog).not.toHaveTextContent('other tab');
    expect(dialog).not.toHaveTextContent('other tabs');
});

it('appears naming the count (plural) with the rollback promise, styled as a warning', async () => {
    vi.mocked(fetchOtherConnectedClients).mockResolvedValue(3);
    mount();
    const dialog = await armConfirm();
    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent(
        '3 other tabs are connected — this test rolls the whole campaign back when it ends.'
    );
    expect(notice).toHaveTextContent('rolled back with it');
    expect(notice.className).toContain('warning');
    expect(notice.className).toContain('encounter-playtest-notice');
    // Non-blocking: the base copy AND the Start affordance stay intact.
    expect(dialog).toHaveTextContent(BASE_COPY);
    expect(screen.getByRole('button', { name: 'Start Playtest' })).toBeEnabled();
});

it('appears with honest single-tab grammar at a count of one', async () => {
    vi.mocked(fetchOtherConnectedClients).mockResolvedValue(1);
    mount();
    await armConfirm();
    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent(
        '1 other tab is connected — this test rolls the whole campaign back when it ends.'
    );
    expect(notice).toHaveTextContent('That tab watches the staged board live');
});

it('re-arming the confirm re-asks the hub (stale answers from a closed dialog never show)', async () => {
    let resolveFirst;
    vi.mocked(fetchOtherConnectedClients)
        .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
        .mockResolvedValueOnce(0);
    mount();
    const first = await armConfirm();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const second = await armConfirm();
    await waitFor(() => expect(fetchOtherConnectedClients).toHaveBeenCalledTimes(2));
    // The still-pending first-dialog answer arrives NOW, after the re-arm:
    // its sequence token is stale, so it must never paint in either dialog.
    resolveFirst(5);
    await waitFor(() => expect(second).toHaveTextContent(BASE_COPY));
    // Flush the microtask chain so the stale 5-settle would land if it could.
    await Promise.resolve();
    await Promise.resolve();
    expect(first.isConnected).toBe(false);
    expect(second).not.toHaveTextContent('other tabs');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('a failed count read keeps the no-notice face at console.debug, never blocking the confirm', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.mocked(fetchOtherConnectedClients).mockRejectedValue(new Error('404'));
    mount();
    const dialog = await armConfirm();
    await waitFor(() => expect(fetchOtherConnectedClients).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent(BASE_COPY);
    expect(screen.getByRole('button', { name: 'Start Playtest' })).toBeEnabled();
    expect(debugSpy).toHaveBeenCalled();
    debugSpy.mockRestore();
});
