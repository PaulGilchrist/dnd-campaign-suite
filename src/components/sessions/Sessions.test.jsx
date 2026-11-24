// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import Sessions from './Sessions.jsx';
import { emptyLinks } from '../../services/campaign/sessionPlannerUtils.js';

// Sessions mounts <Subscriber> (live sessions-style list sync, improve
// settlements-sessions-no-list-sse). Mock the shared SSE client so this
// file's beforeEach `vi.unstubAllGlobals()` — which also drops setup.js's
// global EventSource stub — cannot break later mounts (Notes.test.jsx
// precedent).
vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: () => () => {},
}));

const sessionMockStore = {
  items: [],
  loading: false,
  loadItems: vi.fn(),
  deleteItem: vi.fn(),
};

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: () => sessionMockStore,
}));

vi.mock('../../services/campaign/sessionsService.js', () => ({
  loadSessions: vi.fn(async () => ({ sessions: [] })),
  saveSession: vi.fn(async () => ({ success: true })),
  saveSessions: vi.fn(async () => ({ success: true })),
  deleteSession: vi.fn(async () => ({ success: true })),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMaps: vi.fn(async () => ({ maps: [] })),
  activateMap: vi.fn(async () => ({ success: true })),
}));
vi.mock('../../services/encounters/encountersService.js', () => ({
  loadEncounters: vi.fn(async () => ({ encounters: [] })),
}));
vi.mock('../../services/npcs/npcsService.js', () => ({
  loadNPCs: vi.fn(async () => ({ npcs: [] })),
}));
vi.mock('../../services/campaign/questsService.js', () => ({
  loadQuests: vi.fn(async () => ({ quests: [] })),
}));
vi.mock('../../services/campaign/settlementsService.js', () => ({
  loadSettlements: vi.fn(async () => ({ settlements: [] })),
}));
vi.mock('../../services/campaign/notesService.js', () => ({
  loadNotes: vi.fn(async () => ({ notes: [] })),
}));
vi.mock('../../services/npcs/npcCombatService.js', () => ({
  addNPCToInitiative: vi.fn(async () => {}),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async () => ({})),
}));

import { saveSession } from '../../services/campaign/sessionsService.js';
import { loadMaps, activateMap } from '../../services/maps/mapsService.js';
import { loadNPCs } from '../../services/npcs/npcsService.js';
import { addNPCToInitiative } from '../../services/npcs/npcCombatService.js';
import { addEntry } from '../../services/ui/logService.js';

const onViewInitiative = vi.fn();

const makeSession = (name, overrides = {}) => ({
  name,
  date: '',
  status: 'planned',
  summary: '',
  links: emptyLinks(),
  contingencies: [],
  checklist: [],
  ...overrides,
});

function renderSessions(overrides = {}) {
  return render(
    <Sessions
      campaignName="test-campaign"
      characters={[]}
      isLocalhost={true}
     
      onViewInitiative={onViewInitiative}
      {...overrides}
    />
  );
}

function openEditor(name) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`edit session: ${name}`, 'i') }));
}

const toastText = () => document.querySelector('.sessions-toast')?.textContent;

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  sessionMockStore.items = [];
  sessionMockStore.loading = false;
  loadMaps.mockResolvedValue({ maps: [] });
  loadNPCs.mockResolvedValue({ npcs: [] });
});

describe('Sessions — list rendering', () => {
  it('shows the New Session button and empty state', () => {
    renderSessions();
    expect(screen.getByRole('button', { name: /new session/i })).toBeInTheDocument();
    expect(screen.getByText(/no sessions yet/i)).toBeInTheDocument();
  });

  it('renders status badges and filters sessions by search query', () => {
    sessionMockStore.items = [makeSession('Cave Raid'), makeSession('City Visit', { status: 'played' })];
    renderSessions();
    expect(screen.getByText('Planned')).toBeInTheDocument();
    expect(screen.getByText('Played')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /search sessions/i }), { target: { value: 'Cave' } });
    expect(screen.getByText('Cave Raid')).toBeInTheDocument();
    expect(screen.queryByText('City Visit')).not.toBeInTheDocument();
  });

  it('opens the planner modal prefilled on row click', () => {
    sessionMockStore.items = [makeSession('Session 7')];
    renderSessions();
    openEditor('Session 7');
    expect(screen.getByRole('heading', { name: /plan session/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^name/i)).toHaveValue('Session 7');
  });
});

describe('Sessions — creating', () => {
  it('opens a blank planner, enables Save with a name, and saves the trimmed session', async () => {
    renderSessions();
    fireEvent.click(screen.getByRole('button', { name: /new session/i }));
    const nameInput = screen.getByLabelText(/^name/i);
    const saveBtn = screen.getByRole('button', { name: /^save$/i });
    expect(saveBtn).toBeDisabled();
    fireEvent.change(nameInput, { target: { value: ' Session 8 ' } });
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);
    await waitFor(() => expect(saveSession).toHaveBeenCalled());
    expect(saveSession.mock.calls.at(-1)[1].name).toBe('Session 8');
  });

  it('blocks duplicate names inline without saving', async () => {
    sessionMockStore.items = [makeSession('Session 8')];
    renderSessions();
    fireEvent.click(screen.getByRole('button', { name: /new session/i }));
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'session 8' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByText(/already exists/i)).toBeInTheDocument());
    expect(saveSession).not.toHaveBeenCalled();
  });
});

describe('Sessions — linked-resource automations', () => {
  it('auto-generates checklist items from links and tracks progress when items are checked', async () => {
    loadMaps.mockResolvedValueOnce({ maps: [{ name: 'Smugglers Cave' }] });
    renderSessions();
    fireEvent.click(screen.getByRole('button', { name: /new session/i }));
    // A fresh session starts with the two baseline items
    expect(await screen.findByText(/0 of 2 ready/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByText(/1 of 2 ready/i)).toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText(/link maps/i), { target: { value: 'Smugglers Cave' } });
    expect(await screen.findByText('Smugglers Cave set as active map')).toBeInTheDocument();
    expect(screen.getByText('Fog of war reset')).toBeInTheDocument();
    expect(screen.getByText(/1 of 4 ready/i)).toBeInTheDocument();
  });

  it('quick actions activate a linked map and send a combat-ready NPC to initiative', async () => {
    const grixxa = { name: 'Grixxa', armorClass: 15, hitPoints: 22 };
    loadNPCs.mockResolvedValue({ npcs: [grixxa] });
    sessionMockStore.items = [makeSession('Session 7', {
      links: { ...emptyLinks(), maps: ['Cave'], npcs: ['Grixxa'] },
    })];
    renderSessions();
    openEditor('Session 7');

    fireEvent.click(screen.getByRole('button', { name: /^activate$/i }));
    await waitFor(() => expect(activateMap).toHaveBeenCalledWith('test-campaign', 'Cave'));
    expect(toastText()).toBe('Cave set as active map');

    const initBtn = screen.getByRole('button', { name: /to initiative/i });
    expect(initBtn).not.toBeDisabled();
    fireEvent.click(initBtn);
    await waitFor(() => expect(addNPCToInitiative).toHaveBeenCalled());
    expect(addNPCToInitiative.mock.calls[0][1]).toEqual(grixxa);
    expect(addNPCToInitiative.mock.calls[0][2]).toBe(onViewInitiative);
    await waitFor(() => expect(toastText()).toBe('Grixxa added to initiative'));
  });

  it('disables the To Initiative chip for a statless NPC without touching the service', async () => {
    loadNPCs.mockResolvedValue({ npcs: [{ name: 'Grixxa' }] }); // no AC, no HP
    sessionMockStore.items = [makeSession('Session 7', {
      links: { ...emptyLinks(), npcs: ['Grixxa'] },
    })];
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderSessions();
    openEditor('Session 7');

    const initBtn = screen.getByRole('button', { name: /to initiative/i });
    // chip starts enabled while the picker loads, becomes disabled once Grixxa's stats resolve
    await waitFor(() => expect(initBtn).toBeDisabled());
    expect(initBtn).toHaveAttribute('title',
      "Fill in Grixxa's AC and HP (Stats tab) before adding to Initiative");
    fireEvent.click(initBtn);
    await waitFor(() => expect(loadNPCs).toHaveBeenCalled());
    expect(addNPCToInitiative).not.toHaveBeenCalled();
    expect(document.querySelector('.sessions-form-error')).toBeNull();
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('toasts a friendly message when a stale enabled chip hits a statless NPC (no throw, no form error)', async () => {
    // First load (modal picker) sees stats so the chip renders enabled;
    // by click time the NPC has lost its stats (stale list scenario).
    loadNPCs
      .mockResolvedValueOnce({ npcs: [{ name: 'Grixxa', armorClass: 15, hitPoints: 22 }] })
      .mockResolvedValueOnce({ npcs: [{ name: 'Grixxa' }] });
    sessionMockStore.items = [makeSession('Session 7', {
      links: { ...emptyLinks(), npcs: ['Grixxa'] },
    })];
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderSessions();
    openEditor('Session 7');

    const initBtn = screen.getByRole('button', { name: /to initiative/i });
    expect(initBtn).not.toBeDisabled();
    fireEvent.click(initBtn);

    await waitFor(() => expect(toastText())
      .toBe('Grixxa needs AC and HP filled in (Stats tab) before joining initiative'));
    expect(addNPCToInitiative).not.toHaveBeenCalled();
    expect(document.querySelector('.sessions-form-error')).toBeNull();
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('arms the in-app Add-anyway confirm for an attack-less NPC and drives both button paths', async () => {
    // Backlog 2026-11-17 EG: the inverted native join-confirm is gone — the
    // service's zero-write 'needs-weapon' refusal arms NpcUnarmedConfirmModal.
    const grixxa = { name: 'Grixxa', armorClass: 15, hitPoints: 22 };
    loadNPCs.mockResolvedValue({ npcs: [grixxa] });
    sessionMockStore.items = [makeSession('Session 7', {
      links: { ...emptyLinks(), npcs: ['Grixxa'] },
    })];
    renderSessions();
    openEditor('Session 7');

    addNPCToInitiative.mockResolvedValueOnce('needs-weapon');
    fireEvent.click(screen.getByRole('button', { name: /to initiative/i }));
    const dialog = await screen.findByRole('dialog', { name: 'No Weapons or Attacks' });
    expect(dialog).toHaveTextContent(
      'Grixxa has no weapons or attacks. If you add them to Initiative now, they will fight with an Unarmed Strike.'
    );
    expect(addNPCToInitiative).toHaveBeenCalledTimes(1);

    // Cancel: adds nothing — no service re-run, board untouched — and re-states
    // the refusal guidance as an inert toast.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel', exact: true }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'No Weapons or Attacks' })).not.toBeInTheDocument()
    );
    expect(addNPCToInitiative).toHaveBeenCalledTimes(1);
    expect(toastText()).toBe('Grixxa was not added — give them at least one weapon on the NPCs page');

    // Re-armed, `Add anyway` re-runs the join with the host-confirmed flag.
    addNPCToInitiative.mockResolvedValueOnce('needs-weapon').mockResolvedValueOnce('added');
    fireEvent.click(screen.getByRole('button', { name: /to initiative/i }));
    const armedAgain = await screen.findByRole('dialog', { name: 'No Weapons or Attacks' });
    fireEvent.click(within(armedAgain).getByRole('button', { name: 'Add anyway', exact: true }));
    await waitFor(() => expect(addNPCToInitiative).toHaveBeenCalledTimes(3));
    expect(addNPCToInitiative).toHaveBeenLastCalledWith(
      'test-campaign', grixxa, onViewInitiative, { addUnarmed: true }
    );
    await waitFor(() => expect(toastText()).toBe('Grixxa added to initiative'));
    expect(screen.queryByRole('dialog', { name: 'No Weapons or Attacks' })).not.toBeInTheDocument();
  });

  it('moves a linked resource to another session, saving both', async () => {
    sessionMockStore.items = [
      makeSession('Session 7', { links: { ...emptyLinks(), maps: ['Cave'] } }),
      makeSession('Session 8'),
    ];
    renderSessions();
    openEditor('Session 7');
    fireEvent.change(await screen.findByLabelText(/move cave to another session/i), { target: { value: 'Session 8' } });
    await waitFor(() => expect(saveSession).toHaveBeenCalledTimes(2));
    expect(saveSession.mock.calls.map(c => c[1].name)).toEqual(['Session 7', 'Session 8']);
    expect(saveSession.mock.calls[0][1].links.maps).toEqual([]);
    expect(saveSession.mock.calls[1][1].links.maps).toEqual(['Cave']);
  });

  // QA backlog 2026-11-24: the native `Delete Session Plan "X"?` confirm is
  // retired — the planner footer Delete opens the shared DeleteConfirmModal
  // tier (mirrors EncounterModal.delete-confirm-modal.test.jsx). A native
  // confirm firing anywhere on these lanes throws.
  const forbidNativeDialogs = () => {
    const spy = vi.spyOn(window, 'confirm').mockImplementation(() => {
      throw new Error('native window.confirm fired on the sessions delete path');
    });
    const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => {
      throw new Error('native window.prompt fired on the sessions played path');
    });
    return { spy, promptSpy };
  };

  const openDeleteDialog = () => {
    renderSessions();
    openEditor('Session 7');
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    return screen.getByRole('dialog', { name: 'Delete Session Plan' });
  };

  it('deletes the edited session through the shared in-app confirm dialog', async () => {
    const { spy, promptSpy } = forbidNativeDialogs();
    sessionMockStore.items = [makeSession('Session 7')];
    const dialog = openDeleteDialog();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent('Session 7');
    expect(within(dialog).getByRole('button', { name: 'Cancel', exact: true })).toHaveFocus();
    await waitFor(() => expect(sessionMockStore.deleteItem).not.toHaveBeenCalled());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Yes, Delete Permanently/i }));
    });
    expect(sessionMockStore.deleteItem).toHaveBeenCalledWith('Session 7');
    expect(spy).not.toHaveBeenCalled();
    expect(promptSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each`
    dismiss | label
    ${'cancel'}   | ${'the Cancel button'}
    ${'escape'}   | ${'ESCAPE'}
    ${'backdrop'} | ${'a pure BACKDROP click'}
  `('$label dismisses the delete dialog zero-write (planner intact, no native confirm)', ({ dismiss }) => {
    const { spy, promptSpy } = forbidNativeDialogs();
    sessionMockStore.items = [makeSession('Session 7')];
    const dialog = openDeleteDialog();
    if (dismiss === 'cancel') {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel', exact: true }));
    } else if (dismiss === 'escape') {
      fireEvent.keyDown(within(dialog).getByRole('button', { name: 'Cancel', exact: true }), { key: 'Escape' });
    } else {
      fireEvent.click(document.querySelector('.modal-shell-overlay'));
    }
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(sessionMockStore.deleteItem).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /plan session/i })).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    expect(promptSpy).not.toHaveBeenCalled();
  });

  it('marks a session as played through the in-app recap modal and logs the recap', async () => {
    const { spy, promptSpy } = forbidNativeDialogs();
    sessionMockStore.items = [makeSession('Session 7')];
    renderSessions();
    openEditor('Session 7');
    fireEvent.click(screen.getByRole('button', { name: /mark as played/i }));

    const dialog = screen.getByRole('dialog', { name: 'Mark Session as Played' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const recapInput = within(dialog).getByRole('textbox');
    // Prompt focus law: the dialog's first focusable element is the recap
    // textarea, so typing starts immediately (native-prompt parity).
    expect(recapInput).toHaveFocus();
    // Preview reflects the exact log row the Confirm writes — live per keystroke.
    expect(dialog).toHaveTextContent('Session “Session 7” marked as played');
    fireEvent.change(recapInput, { target: { value: 'Great session recap' } });
    expect(dialog).toHaveTextContent('Session “Session 7” marked as played — Great session recap');

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm', exact: true }));
    });
    await waitFor(() => expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({ type: 'session-played' })
    ));
    expect(addEntry.mock.calls[0][1].text)
      .toBe('Session “Session 7” marked as played — Great session recap');
    const saved = saveSession.mock.calls.at(-1)[1];
    expect(saved.status).toBe('played');
    expect(saved.summary).toBe('Great session recap');
    expect(spy).not.toHaveBeenCalled();
    expect(promptSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
