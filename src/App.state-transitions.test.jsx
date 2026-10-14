
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState, dataLoaderMocks } from './test/appTestState.js';

// --- Core mocks (shared with App.runtime-events.test.jsx and App.map-navigation.test.jsx) ---

vi.mock('./services/ui/dataLoader.js', async () => {
  const { dataLoaderMocks } = await import('./test/appTestState.js');
  return dataLoaderMocks;
});

vi.mock('./services/ui/utils.js', () => ({
  default: { getName: vi.fn((name) => name || '') },
}));

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

vi.mock('./services/maps/mapsService.js', () => ({
  loadMaps: vi.fn(),
}));

vi.mock('./services/ui/storage.js', () => ({
  __esModule: true,
  default: {
    get: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('./services/encounters/combatData.js', async () => ({
  loadCombatSummary: vi.fn(() => Promise.resolve(null)),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('./hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeObject: vi.fn(),
  seedTrackedResources: vi.fn(),
  getStore: vi.fn(() => new Map()),
  notify: vi.fn(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

// Shared mutable container so the hoisted vi.mock can read the
// current app data shape without capturing a stale reference.
const _appDataRef = { value: null };

vi.mock('./hooks/runtime/useAppData.js', () => ({
  default: vi.fn(() => _appDataRef.value),
}));

// --- Component mocks ---

vi.mock('./components/char-sheet/CharSheet.jsx', async () => {
  const { MockCharSheet } = await import('./test/mockComponents.jsx');
  return { default: MockCharSheet };
});
vi.mock('./components/initiative/Initiative.jsx', async () => {
  const { MockInitiative } = await import('./test/mockComponents.jsx');
  return { default: MockInitiative };
});
vi.mock('./components/campaign-selection/CampaignSelection.jsx', async () => {
  const { MockCampaignSelection } = await import('./test/mockComponents.jsx');
  return { default: MockCampaignSelection };
});
vi.mock('./components/character-creation/CharacterCreationWizard.jsx', async () => {
  const { MockWizard } = await import('./test/mockComponents.jsx');
  return { default: MockWizard };
});
vi.mock('./components/sidebar/Sidebar.jsx', async () => {
  const { MockSidebar } = await import('./test/mockComponents.jsx');
  return { default: MockSidebar };
});
vi.mock('./components/maps-manager/MapsManager.jsx', async () => {
  const { MockMapsManager } = await import('./test/mockComponents.jsx');
  return { default: MockMapsManager };
});
vi.mock('./components/map/Map.jsx', async () => {
  const { MockMap } = await import('./test/mockComponents.jsx');
  return { default: MockMap };
});
vi.mock('./components/encounter/EncounterBuilder.jsx', async () => {
  const { MockEncounterBuilder } = await import('./test/mockComponents.jsx');
  return { default: MockEncounterBuilder };
});
vi.mock('./components/notes/Notes.jsx', async () => {
  const { MockNotes } = await import('./test/mockComponents.jsx');
  return { default: MockNotes };
});
vi.mock('./components/quests/Quests.jsx', async () => {
  const { MockQuests } = await import('./test/mockComponents.jsx');
  return { default: MockQuests };
});
vi.mock('./components/npcs/NPCs.jsx', async () => {
  const { MockNPCs } = await import('./test/mockComponents.jsx');
  return { default: MockNPCs };
});
vi.mock('./components/factions/Factions.jsx', async () => {
  const { MockFactions } = await import('./test/mockComponents.jsx');
  return { default: MockFactions };
});
vi.mock('./components/settlements/Settlements.jsx', async () => {
  const { MockSettlements } = await import('./test/mockComponents.jsx');
  return { default: MockSettlements };
});
vi.mock('./components/log/Log.jsx', async () => {
  const { MockLog } = await import('./test/mockComponents.jsx');
  return { default: MockLog };
});
vi.mock('./components/campaign-admin/CampaignAdmin.jsx', async () => {
  const { MockCampaignAdmin } = await import('./test/mockComponents.jsx');
  return { default: MockCampaignAdmin };
});

// Subscriber fires events asynchronously via setTimeout to match real SSE timing.
// This avoids synchronous event dispatch during render which would cause
// inconsistent state and unreliable tests.
vi.mock('./components/common/Subscriber.jsx', () => ({
  default: function MockSubscriber() { return null; },
}));

// --- Helpers ---

function setLocalhost(hostname = 'localhost') {
  Object.defineProperty(window, 'location', {
    value: { hostname, reload: vi.fn() },
    writable: true,
    configurable: true,
  });
}

function setupDataLoaderMocks() {
  dataLoaderMocks.loadAbilityScores.mockResolvedValue([{ full_name: 'Strength' }]);
  dataLoaderMocks.loadClassData.mockImplementation((v) =>
    Promise.resolve(v === '2024' ? [{ name: 'Fighter 2024' }] : [{ name: 'Fighter' }]),
  );
  dataLoaderMocks.loadEquipment.mockResolvedValue([{ name: 'Longsword' }]);
  dataLoaderMocks.loadMagicItems.mockImplementation((v) =>
    Promise.resolve(v === '2024' ? [{ name: 'Wand 2024' }] : [{ name: 'Wand' }]),
  );
  dataLoaderMocks.loadRaceData.mockImplementation((v) =>
    Promise.resolve(v === '2024' ? [{ name: 'Human 2024' }] : [{ name: 'Human' }]),
  );
  dataLoaderMocks.loadSpells.mockImplementation((v) =>
    Promise.resolve(v === '2024' ? [{ name: 'Fireball 2024' }] : [{ name: 'Fireball' }]),
  );
}

// Helper to wait for all microtasks and useEffects to flush.
// This ensures state updates from useEffects are visible.
async function flushEffects() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// Helper to wait for the campaign selection screen to appear, then click select.
async function selectCampaign() {
  await waitFor(() => {
    expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
  });
  await act(async () => {
    fireEvent.click(screen.getByTestId('select-campaign-btn'));
  });
  await waitFor(() => {
    expect(screen.queryByTestId('campaign-selection')).not.toBeInTheDocument();
  });
  await flushEffects();
}

// --- Test suite ---

describe('App - State Transitions', () => {
  const defaultFetch = () =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({}) });

  beforeEach(() => {
    vi.clearAllMocks();

    _appDataRef.value = {
      abilityScores: [{ full_name: 'Strength' }],
      classes: [{ name: 'Fighter' }],
      classes2024: [{ name: 'Fighter 2024' }],
      equipment: [{ name: 'Longsword' }],
      magicItems: [{ name: 'Wand' }],
      magicItems2024: [{ name: 'Wand 2024' }],
      monsters: [],
      races: [{ name: 'Human' }],
      races2024: [{ name: 'Human 2024' }],
      spells: [{ name: 'Fireball' }],
      spells2024: [{ name: 'Fireball 2024' }],
      isLoading: false,
    };

    mockState.campaignName = 'test-campaign';
    mockState.characters = [];

    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => 'New Campaign Name');

    setLocalhost('localhost');
    global.fetch = vi.fn(defaultFetch);

    setupDataLoaderMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setLocalhost('localhost');
  });

  describe('Campaign reset transitions', () => {
    it('resets activeView when navigating back to campaign selection', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);

      // Navigate into the app
      await selectCampaign();
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();

      // Navigate to a different view
      fireEvent.click(screen.getByTestId('initiative-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('initiative')).toBeInTheDocument();
        expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();
      });

      // Go back to campaign selection
      fireEvent.click(screen.getByTestId('back-to-campaigns-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
      });

      // Select campaign again — activeView should reset (charSheet)
      await act(async () => {
        fireEvent.click(screen.getByTestId('select-campaign-btn'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
        expect(screen.queryByTestId('initiative')).not.toBeInTheDocument();
      });
    });

    it('resets mapsView when navigating back to campaign selection', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);

      await selectCampaign();
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();

      // Open maps manager
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });

      // Go back to campaign selection
      fireEvent.click(screen.getByTestId('back-to-campaigns-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
      });

      // Re-enter — maps should reset to initial state (charSheet, not maps)
      await act(async () => {
        fireEvent.click(screen.getByTestId('select-campaign-btn'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
        expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
      });
    });
  });

  describe('Maps view state transitions', () => {
    it('idempotent sidebar clicks do not re-navigate', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);

      await selectCampaign();
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();

      // Navigate to initiative
      fireEvent.click(screen.getByTestId('initiative-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('initiative')).toBeInTheDocument();
      });

      // Click initiative again — should not crash or change state
      fireEvent.click(screen.getByTestId('initiative-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('initiative')).toBeInTheDocument();
        expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();
      });

      // Navigate to notes
      fireEvent.click(screen.getByTestId('notes-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('notes-view')).toBeInTheDocument();
      });

      // Click notes again — idempotent
      fireEvent.click(screen.getByTestId('notes-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('notes-view')).toBeInTheDocument();
        expect(screen.queryByTestId('initiative')).not.toBeInTheDocument();
      });
    });
  });

  describe('Theme state transitions', () => {
    it('toggles theme and persists to localStorage', async () => {
      const localStorageMock = {
        getItem: vi.fn(() => 'dark'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true,
        configurable: true,
      });

      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);

      await selectCampaign();
      expect(document.body.getAttribute('data-theme')).toBe('dark');

      // Navigate to admin to access theme toggle
      fireEvent.click(screen.getByTestId('admin-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('campaign-admin')).toBeInTheDocument();
      });

      // Toggle theme
      fireEvent.click(screen.getByTestId('admin-toggle-theme-btn'));
      await waitFor(() => {
        expect(document.body.getAttribute('data-theme')).toBe('light');
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');

      // Toggle back to dark
      fireEvent.click(screen.getByTestId('admin-toggle-theme-btn'));
      await waitFor(() => {
        expect(document.body.getAttribute('data-theme')).toBe('dark');
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
    });

    it('respects initial theme from localStorage on mount', async () => {
      const localStorageMock = {
        getItem: vi.fn((key) => key === 'theme' ? 'light' : null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true,
        configurable: true,
      });

      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);

      await selectCampaign();
      expect(document.body.getAttribute('data-theme')).toBe('light');
    });
  });
});
