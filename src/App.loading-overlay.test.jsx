// @maintained-by-ai
/**
 * App-level pins for the blocking loading overlay (2026-11-12 OP backlog:
 * `.loading-overlay` had ZERO CSS, so the "Loading party stats" enrichment
 * band was an unstyled in-flow div and the sidebar stayed clickable while
 * the roster was still empty).
 *
 * Pinned contract:
 *  - every loading face App.jsx renders carries role="status" and
 *    aria-busy="true" so assistive tech announces the busy state while the
 *    fixed backdrop (styled in App.css — contract lives in
 *    App.css.test.jsx) blocks pointer interaction,
 *  - the full-page rules-data face renders through a real App mount: the
 *    overlay replaces the shell while useAppData reports isLoading, and
 *    still carries the accessibility attributes.
 *
 * The in-tree enrichment face (processingCharacters) is driven by internal
 * enrichment state that cannot be set from the test surface, so it is
 * pinned by the source scan below; live browser verification covers the
 * computed-style blocking behaviour.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState, dataLoaderMocks } from './test/appTestState.js';
import { loadMaps } from './services/maps/mapsService.js';
import { loadCombatSummary } from './services/encounters/combatData.js';

// --- Core mocks (shared with the other App test files) ---

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
  useRuntimeValue: vi.fn(() => null),
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
vi.mock('./components/music/MusicPlayer.jsx', async () => {
  const { MockMusicPlayer } = await import('./test/mockComponents.jsx');
  return { default: MockMusicPlayer };
});
vi.mock('./components/campaign-admin/CampaignAdmin.jsx', async () => {
  const { MockCampaignAdmin } = await import('./test/mockComponents.jsx');
  return { default: MockCampaignAdmin };
});

// Stub the SSE subscriber so tests never open a real EventSource.
vi.mock('./components/common/Subscriber.jsx', () => ({
  default: function MockSubscriber() { return null; },
}));

// --- Helpers (mirrored from App.upload-input.test.jsx) ---

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

async function flushEffects() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('App loading overlay (blocking busy faces)', () => {
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
      isLoading: true,
    };

    mockState.campaignName = 'test-campaign';
    mockState.characters = [{ name: 'Aragorn', level: 1 }];

    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);

    setLocalhost('localhost');
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    );

    loadMaps.mockResolvedValue({ maps: [] });
    loadCombatSummary.mockResolvedValue(null);

    localStorage.clear();
    setupDataLoaderMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setLocalhost('localhost');
    localStorage.clear();
    document.title = '';
  });

  it('every loading-overlay face carries role="status" and aria-busy', () => {
    // Source scan: all three faces (rules data, campaign, and the in-tree
    // party-stats enrichment band) share the same wrapper contract. The
    // enrichment band depends on internal processingCharacters state that
    // cannot be driven from the test surface, so it is pinned here.
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'App.jsx'), 'utf8');
    const faces = source.match(/<div className="loading-overlay"[^>]*>/g) || [];
    expect(faces, 'App.jsx renders the loading overlay on three faces').toHaveLength(3);
    for (const face of faces) {
      expect(face, 'busy overlay should be announced as a status region').toContain('role="status"');
      expect(face, 'busy overlay should mark the app busy').toContain('aria-busy="true"');
    }
  });

  it('renders the full-page rules-data face as a busy status overlay', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('select-campaign-btn'));
    });

    // useAppData still reports isLoading, so the shell is replaced by the
    // blocking overlay rather than the sidebar/views.
    await waitFor(() => {
      expect(screen.queryByTestId('campaign-selection')).not.toBeInTheDocument();
    });
    await flushEffects();

    const overlay = document.querySelector('.loading-overlay');
    expect(overlay, 'loading face should mount the styled overlay element').not.toBeNull();
    expect(overlay).toHaveAttribute('role', 'status');
    expect(overlay).toHaveAttribute('aria-busy', 'true');
    const spinner = overlay.querySelector('.loading-spinner');
    expect(spinner, 'overlay should show its spinner/text face').not.toBeNull();
    expect(spinner.textContent).toContain('Loading rules data');
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
  });
});
