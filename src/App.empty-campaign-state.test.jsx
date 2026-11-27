// @maintained-by-ai 2026-11-26
/**
 * App-level wiring contract for the zero-character empty-state card
 * (backlog UM 2026-11-20, owner doctrine 2026-11-23).
 *
 * Only the seams the card's OWN gate in App.jsx needs are pinned here:
 *  - the card's button opens the creation wizard, the card yields while the
 *    wizard is mounted, and an explicit cancel returns the card (wizard-open
 *    gate);
 *  - a campaign WITH characters renders the sheet and NEVER the card
 *    (characters-length gate);
 *  - seeded starter: the card's "Open the starter checklist" affordance is
 *    the door back to a locally-dismissed FirstSessionChecklist (epoch
 *    remount).
 *
 * NOT re-pinned here (covered where it lives):
 *  - zero-character entry mounts no wizard / no sheet and burns no offer
 *    key — App.no-auto-wizard.test.jsx (owner doctrine 2026-11-23);
 *  - the card's own markup and the seed-gated checklist affordance —
 *    components/campaign-empty-state/EmptyCampaignState.test.jsx.
 *
 * Harness mirrors App.no-auto-wizard.test.jsx (shared mock doubles). The
 * starter-seed lane is mocked at the service boundary — one mock drives BOTH
 * the card affordance and the real FirstSessionChecklist panel.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState } from './test/appTestState.js';

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
  replaceRuntimeObject: vi.fn(),
  evictCharacterStores: vi.fn(),
  seedTrackedResources: vi.fn(),
  getStore: vi.fn(() => new Map()),
  notify: vi.fn(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('./services/campaign/campaignService.js', () => ({
  getCharacterFolders: vi.fn(async () => []),
  getCharacterFiles: vi.fn(async () => []),
  loadCharacters: vi.fn(async () => []),
  deleteCharacter: vi.fn(async () => {}),
  createCharacter: vi.fn(async (_campaign, characterData) => ({ character: characterData })),
  updateCharacter: vi.fn(async () => {}),
}));

// Starter-seed lane: ONE boundary drives both the empty-state card's
// checklist affordance and the real FirstSessionChecklist panel.
vi.mock('./services/campaign/starterSeedService.js', () => ({
  loadStarterSeed: vi.fn(async () => null),
  saveStarterSeed: vi.fn(async () => ({})),
}));

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

// --- Helpers ---

const SEED = {
  seed: 42,
  entities: {
    settlement: 'Thornhollow',
    dungeonTitle: 'Crypt of X',
    quests: ['Starter — Into the Ruins'],
    encounters: ['Dungeon Wave 1'],
  },
};

function jsonResponse(body) {
  return { ok: true, json: () => Promise.resolve(body) };
}

async function flushEffects() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function selectCampaign() {
  await waitFor(() => {
    expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
  });
  await act(async () => {
    fireEvent.click(screen.getByTestId('select-campaign-btn'));
  });
  await flushEffects();
}

function expectNoEmptyState() {
  expect(screen.queryByRole('button', { name: /Add your first character/ })).not.toBeInTheDocument();
}

// --- Test suite ---

describe('App - zero-character empty-state card wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

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

    mockState.campaignName = 'qa-arena';
    mockState.characters = [];
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);

    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost', reload: vi.fn() },
      writable: true,
      configurable: true,
    });

    global.fetch = vi.fn(() => Promise.resolve(jsonResponse({})));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('the card opens the creation wizard, yields while it is mounted, and returns after cancel', async () => {
    render(<App />);
    await selectCampaign();

    // The card owns the blank stage with NO wizard mounted until an
    // EXPLICIT press (the full no-auto-open doctrine is pinned in
    // App.no-auto-wizard.test.jsx).
    expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
    const card = screen.getByRole('button', { name: /Add your first character/ });

    // Pressing the card opens the SAME creation wizard as the sidebar
    // Add Character, and the card steps aside while it is mounted.
    fireEvent.click(card);
    await waitFor(() => {
      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
    });
    expectNoEmptyState();

    // Cancel → the blank stage is again owned by the card (wizard-open gate).
    fireEvent.click(screen.getByTestId('wizard-cancel-btn'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add your first character/ })).toBeInTheDocument();
    });
  });

  it('a campaign WITH characters renders the sheet and never the empty state', async () => {
    mockState.characters = [{ name: 'Aragorn', level: 1 }];
    render(<App />);
    await selectCampaign();

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expectNoEmptyState();
  });

  it('seeded starter: the card also offers the checklist, and activating it surfaces the checklist content', async () => {
    const { loadStarterSeed } = await import('./services/campaign/starterSeedService.js');
    loadStarterSeed.mockResolvedValue(SEED);
    mockState.campaignName = 'qa-starter';
    render(<App />);
    await selectCampaign();

    // The checklist panel itself is already visible for a seeded campaign…
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Open the starter checklist/ })).toBeInTheDocument();
    });
    expect(screen.getByText('First session — Thornhollow')).toBeInTheDocument();

    // …dismiss it (per-client UI), and the card's affordance becomes the door.
    fireEvent.click(screen.getByTitle('Dismiss checklist'));
    await waitFor(() => {
      expect(screen.queryByText('First session — Thornhollow')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Open the starter checklist/ }));
    await waitFor(() => {
      expect(screen.getByText('First session — Thornhollow')).toBeInTheDocument();
    });
    // Steps visibly rendered.
    expect(screen.getByText('See who lives in Thornhollow')).toBeInTheDocument();
  });
});
