// @improved-by-ai
/**
 * App-level contract for the ZERO-CHARACTER FIRST-RUN doctrine (owner
 * decision 2026-11-23, improvement seeded-campaign-onboarding-asymmetry).
 *
 * Entering a fresh zero-character campaign NEVER auto-mounts the creation
 * wizard. Both seeded presets (qa-arena, qa-starter) and plain campaigns land
 * on their normal first-run view — the starter checklist and/or the
 * EmptyCampaignState card — and hero building stays an EXPLICIT click. The
 * removed seam was the offer-once auto-open in the select callback (and its
 * localStorage `character-wizard-offered:<campaign>` pref facade
 * `wizardOfferedStore.js`); no flag or dual-path remains.
 *
 * Pinned here:
 *  - first select of a zero-character campaign mounts NO wizard, writes NO
 *    `character-wizard-offered:*` key, and leaves the empty-state card owning
 *    the blank stage (the shell stays navigable);
 *  - the explicit wizard lane still works from that first-run view: sidebar
 *    "Add Character" opens the SAME wizard;
 *  - a SEEDED zero-character starter also never auto-opens: its checklist is
 *    mounted (with the GM-only "Build your heroes" step) instead;
 *  - a NON-localhost (LAN visitor) origin likewise gets no auto-open and burns
 *    no key (GM-only creation guard, bug-zero-char-auto-wizard-traps-lan-
 *    visitor-creation-is-gm-only, stays intact).
 *
 * Harness mirrors App.empty-campaign-state.test.jsx (shared mock doubles,
 * starter-seed lane mocked at the service boundary). localStorage is NOT
 * auto-cleared by src/test/setup.js, so each test clears it up front to
 * simulate a clean browser profile.
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

function expectNoWizard() {
  expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
  expect(document.querySelectorAll('[class*=wizard]').length).toBe(0);
}

function offeredKeys() {
  return Object.keys(localStorage).filter((k) => k.startsWith('character-wizard-offered'));
}

// --- Test suite ---

describe('App - zero-character entry never auto-opens the wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear(); // clean browser profile per test

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

  it('a fresh zero-character ARENA select mounts NO wizard and burns no offer key', async () => {
    mockState.campaignName = 'qa-arena';
    render(<App />);
    await selectCampaign();

    // Normal first-run view owns the stage: no wizard, no sheet, and the
    // empty-state card's explicit add door is present.
    expectNoWizard();
    expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add your first character/ })).toBeInTheDocument();
    // The removed pref facade wrote nothing anywhere.
    expect(offeredKeys()).toHaveLength(0);
  });

  it('the sidebar Add Character lane still opens the wizard from the first-run view', async () => {
    mockState.campaignName = 'qa-arena';
    render(<App />);
    await selectCampaign();
    expectNoWizard();

    fireEvent.click(screen.getByTestId('add-character-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
    });
  });

  it('a fresh zero-character STARTER select shows the checklist, not a wizard', async () => {
    const { loadStarterSeed } = await import('./services/campaign/starterSeedService.js');
    loadStarterSeed.mockResolvedValue(SEED);
    mockState.campaignName = 'qa-starter';
    render(<App />);
    await selectCampaign();

    // Checklist lands on the stage (unchanged preset behavior) with its
    // GM-only Build-heroes step…
    expectNoWizard();
    await waitFor(() => {
      expect(screen.getByText('First session — Thornhollow')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Build your heroes/ })).toBeInTheDocument();
    expect(offeredKeys()).toHaveLength(0);

    // …and that step is the explicit wizard door.
    fireEvent.click(screen.getByRole('button', { name: /Build your heroes/ }));
    await waitFor(() => {
      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
    });
  });

  it('visitor origin (non-localhost): zero-character select mounts no wizard and writes no key', async () => {
    // GM-only creation guard stays intact (bug-zero-char-auto-wizard-traps-
    // lan-visitor-creation-is-gm-only): visitors never got the auto-open and
    // never get the wizard from the blank stage.
    Object.defineProperty(window, 'location', {
      value: { hostname: '192.168.0.44', reload: vi.fn() },
      writable: true,
      configurable: true,
    });
    mockState.campaignName = 'qa-arena';
    render(<App />);
    await selectCampaign();

    expectNoWizard();
    // The shell is navigable for the visitor (card with hint, not a dead end).
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(offeredKeys()).toHaveLength(0);
  });
});
