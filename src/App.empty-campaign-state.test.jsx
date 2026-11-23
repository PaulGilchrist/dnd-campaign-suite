// @improved-by-ai
/**
 * App-level contract for the zero-character empty-state card
 * (backlog UM 2026-11-20, owner doctrine 2026-11-23).
 *
 * A zero-character campaign has ALWAYS landed on a FULLY BLANK main stage
 * since the retired offer-once auto-wizard was removed — nav + dice tray, no
 * affordance, the sidebar "Add Character" the only door. The card renders on
 * exactly the blank stage: campaign loaded + zero characters + no view active
 * + no wizard open.
 *
 * Pinned here:
 *  - zero characters → empty-state card ("Add your first character"), no
 *    auto-wizard, no char sheet;
 *  - pressing the card's button opens the SAME creation wizard as the sidebar
 *    Add Character, and the card yields while the wizard is mounted;
 *  - entry NEVER auto-mounts a wizard — the card owns the blank stage from
 *    the first frame (the no-auto-open contract lives in
 *    App.no-auto-wizard.test.jsx);
 *  - a campaign WITH characters renders the sheet and NEVER the card;
 *  - seeded starter campaign: the card ALSO offers "Open the starter
 *    checklist", and activating it surfaces the FirstSessionChecklist content
 *    (epoch remount revives a locally-dismissed checklist).
 *
 * Harness mirrors App.wizard-offered.test.jsx (shared mock doubles). The
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

describe('App - zero-character empty-state card', () => {
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

    mockState.campaignName = 'test-campaign';
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

  it('zero characters lands on the empty-state card, not a blank stage', async () => {
    mockState.campaignName = 'qa-arena';
    render(<App />);
    await selectCampaign();

    // No auto-wizard (owner doctrine 2026-11-23), no sheet — and the stage
    // is NOT blank.
    expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();
    const card = screen.getByRole('button', { name: /Add your first character/ });
    expect(card.closest('.empty-campaign-state .ct-empty-state')).toBeInTheDocument();
    // Plain arena campaign (no seed): the checklist affordance stays absent.
    expect(screen.queryByRole('button', { name: /Open the starter checklist/ })).not.toBeInTheDocument();
  });

  it('pressing "Add your first character" opens the same wizard the sidebar Add Character opens, and the card yields while it is mounted', async () => {
    mockState.campaignName = 'qa-arena';
    render(<App />);
    await selectCampaign();

    fireEvent.click(screen.getByRole('button', { name: /Add your first character/ }));
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

  it('no wizard auto-mounts on entry — the card owns the blank stage from the start, and still after an explicit open + cancel', async () => {
    mockState.campaignName = 'qa-arena';
    render(<App />);
    await selectCampaign();

    // Owner doctrine 2026-11-23: zero-character entry never auto-opens the
    // wizard, so the card takes the blank stage immediately.
    expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
    expect(localStorage.getItem('character-wizard-offered:qa-arena')).toBeNull();
    const card = screen.getByRole('button', { name: /Add your first character/ });
    expect(card).toBeInTheDocument();

    // The card yields only to an EXPLICIT wizard open, and returns after it.
    fireEvent.click(card);
    await waitFor(() => {
      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
    });
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
