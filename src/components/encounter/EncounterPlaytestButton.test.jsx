// @maintained-by-ai
// EncounterPlaytestButton — EB's Playtest CTA (plan 2026-11-25). Owns ONLY
// the button/modal wiring: one-test-at-a-time locking while a stamp is
// active, the confirm-copy name resolution, start wiring (args + onStarted
// on success, onToast on failure). The orchestration itself is owned by
// playtestService.test.js — cited, never re-driven.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EncounterPlaytestButton from './EncounterPlaytestButton.jsx';
import { startEncounterPlaytest } from '../../services/encounters/playtestService.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn(),
}));
vi.mock('../../services/encounters/playtestService.js', () => ({
    startEncounterPlaytest: vi.fn(),
}));

import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const baseProps = {
    campaignName: 'test-campaign',
    encounterTitle: 'Ambush from the Brush',
    currentEncounterName: null,
    selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 2 }],
    characters: [{ name: 'Thorin' }],
    onStarted: vi.fn(),
    onToast: vi.fn(),
};

function mount(overrides = {}) {
    const props = { ...baseProps, onStarted: vi.fn(), onToast: vi.fn(), ...overrides };
    render(<EncounterPlaytestButton {...props} />);
    return props;
}

async function openConfirmAndCommit() {
    fireEvent.click(screen.getByRole('button', { name: /Playtest/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Start Playtest' }));
    return dialog;
}

beforeEach(() => {
    vi.mocked(useRuntimeValue).mockReturnValue(null);
    vi.mocked(startEncounterPlaytest).mockReset().mockResolvedValue({ snapshot: 's.zip' });
});

it('is enabled with an honest title when no playtest is stamped', () => {
    mount();
    const btn = screen.getByRole('button', { name: /Playtest/i });
    expect(btn).toBeEnabled();
    expect(btn).toHaveAttribute('title', expect.stringContaining('roll back'));
});

it('locks with the cause while a playtest session is already active', () => {
    vi.mocked(useRuntimeValue).mockReturnValue({ active: true, snapshot: 's.zip', encounterName: 'X' });
    mount();
    const btn = screen.getByRole('button', { name: /Playtest/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', expect.stringContaining('End the current playtest before starting a new one'));
});

it('confirm copy names the loaded encounter and promises the full-party rollback contract', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Playtest/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Ambush from the Brush');
    expect(dialog).toHaveTextContent('full party');
    expect(dialog).toHaveTextContent('no player tabs');
});

it('Cancel closes the confirm without starting anything', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Playtest/i }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(startEncounterPlaytest).not.toHaveBeenCalled();
});

it('Start rides the service with the draft and hands off onStarted', async () => {
    const props = mount();
    await openConfirmAndCommit();
    await waitFor(() => expect(startEncounterPlaytest).toHaveBeenCalledWith({
        campaignName: 'test-campaign',
        encounterName: 'Ambush from the Brush',
        selectedMonsters: props.selectedMonsters,
        characters: props.characters,
    }));
    await waitFor(() => expect(props.onStarted).toHaveBeenCalled());
    expect(props.onToast).not.toHaveBeenCalled();
});

it('a failed start toasts the reason and never navigates', async () => {
    vi.mocked(startEncounterPlaytest).mockRejectedValue(new Error('Failed to snapshot the campaign'));
    const props = mount();
    await openConfirmAndCommit();
    await waitFor(() => expect(props.onToast).toHaveBeenCalledWith(
        'Failed to start playtest: Failed to snapshot the campaign', true
    ));
    expect(props.onStarted).not.toHaveBeenCalled();
});
