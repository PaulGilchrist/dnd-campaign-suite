// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Sessions from './Sessions.jsx';
import { emptyLinks } from '../../services/campaign/sessionPlannerUtils.js';

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
      onBack={vi.fn()}
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

  it('quick actions activate a linked map and send an NPC to initiative', async () => {
    sessionMockStore.items = [makeSession('Session 7', {
      links: { ...emptyLinks(), maps: ['Cave'], npcs: ['Grixxa'] },
    })];
    renderSessions();
    openEditor('Session 7');

    fireEvent.click(screen.getByRole('button', { name: /^activate$/i }));
    await waitFor(() => expect(activateMap).toHaveBeenCalledWith('test-campaign', 'Cave'));
    expect(toastText()).toBe('Cave set as active map');

    fireEvent.click(screen.getByRole('button', { name: /to initiative/i }));
    await waitFor(() => expect(addNPCToInitiative).toHaveBeenCalled());
    expect(addNPCToInitiative.mock.calls[0][1]).toEqual({ name: 'Grixxa' });
    expect(addNPCToInitiative.mock.calls[0][2]).toBe(onViewInitiative);
    await waitFor(() => expect(toastText()).toBe('Grixxa added to initiative'));
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

  it('deletes the edited session after confirm', () => {
    sessionMockStore.items = [makeSession('Session 7')];
    vi.stubGlobal('confirm', () => true);
    renderSessions();
    openEditor('Session 7');
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(sessionMockStore.deleteItem).toHaveBeenCalledWith('Session 7');
  });

  it('marks a session as played and logs the recap to the campaign log', async () => {
    sessionMockStore.items = [makeSession('Session 7')];
    vi.stubGlobal('prompt', () => 'Great session recap');
    renderSessions();
    openEditor('Session 7');
    fireEvent.click(screen.getByRole('button', { name: /mark as played/i }));
    await waitFor(() => expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({ type: 'session-played' })
    ));
    expect(addEntry.mock.calls[0][1].text).toContain('Great session recap');
    const saved = saveSession.mock.calls.at(-1)[1];
    expect(saved.status).toBe('played');
    expect(saved.summary).toBe('Great session recap');
  });
});
