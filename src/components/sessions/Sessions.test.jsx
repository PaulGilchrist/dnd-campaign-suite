import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Sessions from './Sessions.jsx';

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
import { loadMaps } from '../../services/maps/mapsService.js';

const makeSession = (name, overrides = {}) => ({
  name,
  date: '',
  status: 'planned',
  summary: '',
  links: { maps: [], encounters: [], npcs: [], quests: [], settlements: [], notes: [] },
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
      onViewInitiative={vi.fn()}
      {...overrides}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
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

  it('renders planned and played status badges from the store', () => {
    sessionMockStore.items = [
      makeSession('Session 7', { status: 'planned' }),
      makeSession('Session 6', { status: 'played' }),
    ];
    renderSessions();
    expect(screen.getByText('Session 7')).toBeInTheDocument();
    expect(screen.getByText('Planned')).toBeInTheDocument();
    expect(screen.getByText('Played')).toBeInTheDocument();
  });

  it('filters by search query', () => {
    sessionMockStore.items = [makeSession('Cave Raid'), makeSession('City Visit')];
    renderSessions();
    fireEvent.change(screen.getByRole('textbox', { name: /search sessions/i }), { target: { value: 'Cave' } });
    expect(screen.getByText('Cave Raid')).toBeInTheDocument();
    expect(screen.queryByText('City Visit')).not.toBeInTheDocument();
  });

  it('opens the planner modal with prefilled data on row click', () => {
    sessionMockStore.items = [makeSession('Session 7', { status: 'planned' })];
    renderSessions();
    fireEvent.click(screen.getByRole('button', { name: /edit session: session 7/i }));
    expect(screen.getByRole('heading', { name: /plan session/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^name/i)).toHaveValue('Session 7');
  });
});

describe('Sessions — creating', () => {
  it('opens a blank planner and disables Save until a name is typed', async () => {
    renderSessions();
    fireEvent.click(screen.getByRole('button', { name: /new session/i }));
    const nameInput = screen.getByLabelText(/^name/i);
    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn).toBeDisabled();
    fireEvent.change(nameInput, { target: { value: 'Session 8' } });
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);
    await waitFor(() => expect(saveSession).toHaveBeenCalled());
    const saved = saveSession.mock.calls.at(-1)[1];
    expect(saved.name).toBe('Session 8');
  });

  it('blocks duplicate names inline', async () => {
    sessionMockStore.items = [makeSession('Session 8')];
    renderSessions();
    fireEvent.click(screen.getByRole('button', { name: /new session/i }));
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'session 8' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.getByText(/already exists/i)).toBeInTheDocument());
  });
});

describe('Sessions — checklist auto-generation', () => {
  it('generates auto checklist items when a map is linked', async () => {
    loadMaps.mockResolvedValueOnce({ maps: [{ name: 'Smugglers Cave' }] });
    renderSessions();
    fireEvent.click(screen.getByRole('button', { name: /new session/i }));
    const mapSelect = await screen.findByLabelText(/link maps/i);
    fireEvent.change(mapSelect, { target: { value: 'Smugglers Cave' } });
    await waitFor(() => expect(screen.getByText('Smugglers Cave set as active map')).toBeInTheDocument());
    expect(screen.getByText('Fog of war reset')).toBeInTheDocument();
  });

  it('progress bar label updates when a checklist item is checked', async () => {
    renderSessions();
    fireEvent.click(screen.getByRole('button', { name: /new session/i }));
    // Baseline items appear automatically for a fresh session
    const progressLabel = await screen.findByText(/0 of 2 ready/i);
    expect(progressLabel).toBeInTheDocument();
    const firstCheck = screen.getAllByRole('checkbox')[0];
    fireEvent.click(firstCheck);
    await waitFor(() => expect(screen.getByText(/1 of 2 ready/i)).toBeInTheDocument());
  });
});
