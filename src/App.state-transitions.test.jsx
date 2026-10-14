// @maintained-by-ai
/**
 * App-level contract for view/theme title state transitions (App.jsx).
 *
 * This file owns the shell-level state machine that no sibling App test
 * exercises:
 *
 *  - Re-entry reset: leaving a campaign via "Campaigns" and selecting it
 *    again always lands back on the character sheet, whichever view was
 *    open when leaving (initiative, maps manager — the maps-manager row
 *    also pins that the persistent mapsView sub-state unmounts).
 *  - Campaign switching: selecting a DIFFERENT campaign clears the maps
 *    area state — a player who had a map open in the previous campaign
 *    must be able to open the new campaign's active map with one "Maps"
 *    click (a stale mapsView of type 'map' would silently swallow the
 *    click on the player branch of handleMapsClick).
 *  - Idempotent sidebar navigation: re-clicking the button for the view
 *    you are already on keeps you there (view + sidebar indicator intact),
 *    without crashing. (Maps-specific no-op re-clicks are covered by
 *    App.map-navigation.test.jsx.)
 *  - Theme transitions: restore from stored preference (valid and invalid
 *    values), and toggle round-trips from the default dark that persist
 *    to localStorage and echo into the Admin readout. Theme is display
 *    formatting, so localStorage is the sanctioned store here.
 *  - document.title follows the active view/character.
 *
 * Deliberately NOT re-tested here (covered by siblings):
 *  - Maps-click routing / back stack / manager behavior → App.map-navigation.test.jsx
 *  - waiting placeholder + "Check Again" → App.map-unavailable.test.jsx
 *  - map-activate SSE auto-open → App.map-activate.test.jsx
 *  - SSE dispatch table, character CRUD, roster landing → App.runtime-events.test.jsx
 *  - post-rollback carry-over landing → App.post-restore.test.jsx
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState, dataLoaderMocks } from './test/appTestState.js';
import { loadMaps } from './services/maps/mapsService.js';
import { loadCombatSummary } from './services/encounters/combatData.js';

// --- Core mocks (shared with other App test files) ---

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
  getCombatSummary: vi.fn(() => null),
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

// Stub the SSE subscriber so tests never open a real EventSource.
vi.mock('./components/common/Subscriber.jsx', () => ({
  default: function MockSubscriber() { return null; },
}));

// --- Helpers ---

function setLocalhost(hostname) {
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

// Let pending microtasks/effects flush (rules computation, title updates).
async function flushEffects() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// Click through the campaign selection screen into the app shell.
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

// Click "Campaigns" in the sidebar and wait for the selection screen.
async function backToCampaigns() {
  fireEvent.click(screen.getByTestId('back-to-campaigns-btn'));
  await waitFor(() => {
    expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
  });
}

// Render the app with a roster and land on the character sheet.
async function renderInCampaign(hostname = 'localhost', characters = [{ name: 'Aragorn', level: 1 }]) {
  setLocalhost(hostname);
  mockState.characters = characters;
  render(<App />);
  await selectCampaign();
  expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
}

// Navigate to a view and assert it actually rendered.
async function openView(buttonTestId, viewTestId) {
  fireEvent.click(screen.getByTestId(buttonTestId));
  await waitFor(() => {
    expect(screen.getByTestId(viewTestId)).toBeInTheDocument();
  });
}

// --- Test suite ---

describe('App - State Transitions', () => {
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

    // Quiet, observable failure channel for flows that must not alert.
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);

    setLocalhost('localhost');
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    );

    // No maps by default; the campaign-switch test re-arms per campaign.
    // (vi.clearAllMocks does NOT reset implementations, so re-arm here.)
    loadMaps.mockResolvedValue({ maps: [] });
    loadCombatSummary.mockResolvedValue(null);

    // Theme tests seed per-test; the shared setup.js localStorage mock
    // persists across tests in this file, so start from a clean slate.
    localStorage.clear();

    setupDataLoaderMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setLocalhost('localhost');
    localStorage.clear();
    // App's title effect survives unmount — reset so cross-test bleed
    // can never satisfy a later title assertion.
    document.title = '';
  });

  describe('Campaign re-entry resets the active view', () => {
    // Re-selecting the campaign must always land on the character sheet,
    // whichever view was open when the user left. Initiative represents the
    // plain views; the maps-manager row additionally pins that the mapsView
    // sub-state (which survives a same-campaign re-select via campaignName)
    // does not keep the maps area mounted over the sheet.
    it.each([
      ['initiative', 'initiative-btn', 'initiative'],
      ['maps manager', 'maps-btn', 'maps-manager'],
    ])('re-entering the campaign from the %s view lands on the character sheet', async (_label, buttonTestId, viewTestId) => {
      await renderInCampaign();

      await openView(buttonTestId, viewTestId);
      await backToCampaigns();

      await act(async () => {
        fireEvent.click(screen.getByTestId('select-campaign-btn'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
        expect(screen.getByTestId('character-name')).toHaveTextContent('Aragorn');
      });
      expect(screen.queryByTestId(viewTestId)).not.toBeInTheDocument();
    });
  });

  describe('Campaign switching clears stale maps state', () => {
    it('a player who had a map open can open the new campaign\'s active map with one Maps click', async () => {
      loadMaps.mockImplementation((campaign) =>
        Promise.resolve({
          maps: campaign === 'test-campaign'
            ? [{ fileName: 'old-map.json', isActive: true }]
            : [{ fileName: 'new-map.json', isActive: true }],
        }),
      );
      await renderInCampaign('example.com');

      // Player opens the first campaign's active map, then leaves.
      await openView('maps-btn', 'map-view');
      expect(screen.getByTestId('map-name').textContent).toBe('old-map');
      await backToCampaigns();

      // Switch to a different campaign with its own active map.
      mockState.campaignName = 'test-campaign-two';
      await act(async () => {
        fireEvent.click(screen.getByTestId('select-campaign-btn'));
      });
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
        expect(screen.getByTestId('sidebar-campaign').textContent).toBe('test-campaign-two');
      });

      // The stale 'old-map' view must be gone: one Maps click resolves
      // and opens the NEW campaign's map (if the old mapsView leaked,
      // the player branch of handleMapsClick would swallow this click).
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('map-name').textContent).toBe('new-map');
      });
      expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
      expect(screen.queryByText(/Waiting for the GM to open a map/)).not.toBeInTheDocument();
    });
  });

  describe('Idempotent sidebar navigation', () => {
    it('re-clicking the active view\'s button keeps the view and selection intact', async () => {
      await renderInCampaign();

      // Move to initiative and click its button again — same view, no crash,
      // no re-mount, sidebar indicator unchanged.
      await openView('initiative-btn', 'initiative');
      fireEvent.click(screen.getByTestId('initiative-btn'));
      await flushEffects();
      expect(screen.getByTestId('initiative')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar-active-indicator')).toHaveTextContent('Initiative');
      expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();
    });
  });

  describe('Theme state transitions', () => {
    it('toggles light and dark from the default, updating the sheet and persisting each choice', async () => {
      await renderInCampaign();

      // Clean localStorage → dark is the default.
      expect(document.body.getAttribute('data-theme')).toBe('dark');

      await openView('admin-btn', 'campaign-admin');

      fireEvent.click(screen.getByTestId('admin-toggle-theme-btn'));
      await waitFor(() => {
        expect(document.body.getAttribute('data-theme')).toBe('light');
        expect(screen.getByTestId('admin-theme')).toHaveTextContent('light');
      });
      expect(localStorage.getItem('theme')).toBe('light');

      fireEvent.click(screen.getByTestId('admin-toggle-theme-btn'));
      await waitFor(() => {
        expect(document.body.getAttribute('data-theme')).toBe('dark');
        expect(screen.getByTestId('admin-theme')).toHaveTextContent('dark');
      });
      expect(localStorage.getItem('theme')).toBe('dark');
    });

    // "Nothing stored → dark" is the clean-slate default already asserted
    // at the top of the toggle test, so only the restore and invalid-value
    // branches are parameterized here.
    it.each([
      ['light', 'light', 'light'],
      ['an unrecognized value', 'neon', 'dark'],
    ])('restores %s theme on mount', async (_label, stored, expected) => {
      localStorage.setItem('theme', stored);

      await renderInCampaign();

      expect(document.body.getAttribute('data-theme')).toBe(expected);
    });
  });

  describe('document.title follows the active view', () => {
    it('shows the active character name on the sheet and CharSheets elsewhere', async () => {
      await renderInCampaign('localhost', [
        { name: 'Aragorn', level: 1 },
        { name: 'Legolas', level: 2 },
      ]);

      expect(document.title).toBe('Aragorn');

      // Any non-sheet view reverts the title to the app name.
      await openView('initiative-btn', 'initiative');
      expect(document.title).toBe('CharSheets');

      // Selecting a character brings their name back.
      fireEvent.click(screen.getByTestId('char-btn-Legolas'));
      await waitFor(() => {
        expect(screen.getByTestId('character-name')).toHaveTextContent('Legolas');
      });
      expect(document.title).toBe('Legolas');
    });
  });
});
