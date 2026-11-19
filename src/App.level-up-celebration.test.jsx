// @maintained-by-ai
/**
 * Roadmap Item 8 — App-shell contract for the LEVEL UP celebration.
 *
 * Rides the App.runtime-events.test.jsx harness with the REAL runtime-state
 * module (importActual), so the celebration's detection seam is exercised
 * through the production echo-adoption lanes:
 *  - `change-<campaign>-<Char>` full-bucket echo (another client awarded XP
 *    through the runtime 'xp' key) → celebration on THIS client;
 *  - `character-update-*` echo (milestone level grant saved through the
 *    wizard's level field) → celebration on THIS client;
 *  - the per-row "Open wizard" button routes the EXISTING edit-wizard entry
 *    (handleEditCharacter + the wizard's activeCharacter seed) for the
 *    crossing character — pinned via the shared MockWizard doubles;
 *  - milestone-mode XP echoes stay silent (XP is not the advancement canon
 *    there); dismissal is by click only.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState } from './test/appTestState.js';
import { clearRuntimeState } from './hooks/runtime/useRuntimeState.js';
import * as campaignService from './services/campaign/campaignService.js';
import { loadMaps } from './services/maps/mapsService.js';

// Test access to the SSE handler wired into the (mocked) app-level Subscriber.
const subscriberMock = vi.hoisted(() => ({
  props: { handleEvent: null },
}));

// --- Core mocks (harness parity with App.runtime-events.test.jsx) ---

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

// useRuntimeState stays REAL (importActual): the celebration must be proven on
// the production store + echo-adoption lane, not a double.
vi.mock('./hooks/runtime/useRuntimeState.js', async () => {
  const actual = await vi.importActual('./hooks/runtime/useRuntimeState.js');
  return { ...actual };
});

// Network boundary for character CRUD (HTTP semantics owned elsewhere).
vi.mock('./services/campaign/campaignService.js', () => ({
  getCharacterFolders: vi.fn(async () => []),
  getCharacterFiles: vi.fn(async () => []),
  loadCharacters: vi.fn(async () => []),
  deleteCharacter: vi.fn(async () => {}),
  createCharacter: vi.fn(async (_campaign, characterData) => ({ character: characterData })),
  updateCharacter: vi.fn(async () => {}),
}));

// Shared mutable container so the hoisted vi.mock can read the
// current app data shape without capturing a stale reference.
const _appDataRef = { value: null };

vi.mock('./hooks/runtime/useAppData.js', () => ({
  default: vi.fn(() => _appDataRef.value),
}));

// --- Component mocks (shared doubles) ---

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

// Subscriber double that captures the handler so tests can push SSE events
// through the exact dispatch table the real SSE connection feeds.
vi.mock('./components/common/Subscriber.jsx', () => ({
  default: ({ handleEvent }) => {
    subscriberMock.props.handleEvent = handleEvent;
    return null;
  },
}));

// --- Helpers ---

// One experience-mode character (XP is advancement canon) and one milestone
// character (the wizard level bump is the only advancement seam).
const PARTY = [
  { name: 'Aragorn', level: 1, xp: 250, xpMode: 'experience', rules: '5e' },
  { name: 'Legolas', level: 4, xp: 0, xpMode: 'milestone', rules: '2024' },
];

function jsonResponse(body) {
  return { ok: true, json: () => Promise.resolve(body) };
}

async function flushEffects() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// Settle the async chain: roster load → rules compute → change-data seed →
// celebration arming (App arms only once the seed has landed).
async function settle() {
  for (let i = 0; i < 5; i++) await flushEffects();
}

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
  await settle();
}

async function renderInCampaign(characters = PARTY) {
  mockState.characters = characters;
  render(<App />);
  await selectCampaign();
}

// Push an SSE event through the captured App handler.
function dispatch(event) {
  return act(async () => {
    subscriberMock.props.handleEvent(event);
    await flushEffects();
  });
}

// --- Test suite ---

describe('App - LEVEL UP celebration (roadmap Item 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscriberMock.props.handleEvent = null;
    clearRuntimeState('Aragorn');
    clearRuntimeState('Legolas');

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

    campaignService.updateCharacter.mockImplementation(async () => {});
    getCharacterFoldersReset();
    loadMaps.mockResolvedValue({ maps: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('celebrates an SSE-echoed XP award on this client and hands off to the edit wizard for that character', async () => {
    await renderInCampaign();
    expect(screen.queryByText('LEVEL UP!')).not.toBeInTheDocument();

    // Another client awarded XP through the runtime 'xp' bucket — the exact
    // full-bucket echo App adopts via replaceRuntimeObject.
    await dispatch({ key: 'change-test-campaign-Aragorn', data: { xp: 350 } });

    const banner = screen.getByText('LEVEL UP!').closest('.level-up-banner');
    expect(banner).toHaveTextContent('Aragorn');
    expect(banner).toHaveTextContent('Level 1 → 2');

    // One click opens the EXISTING edit wizard seeded with THAT character.
    fireEvent.click(screen.getByText('Open wizard'));
    await waitFor(() => {
      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
    });
    expect(screen.getByTestId('editing-mode')).toBeInTheDocument();
    expect(screen.getByTestId('editing-character')).toHaveTextContent('Aragorn');
    expect(banner).not.toBeInTheDocument();
  });

  it('celebrates a milestone level grant landing through the character-update echo, then opens that character in the wizard', async () => {
    await renderInCampaign();

    await dispatch({
      key: 'character-update-test-campaign-Legolas.json',
      data: { name: 'Legolas', level: 5, xp: 0, xpMode: 'milestone', rules: '2024' },
    });

    const banner = screen.getByText('LEVEL UP!').closest('.level-up-banner');
    expect(banner).toHaveTextContent('Legolas');
    expect(banner).toHaveTextContent('Level 4 → 5');

    fireEvent.click(screen.getByText('Open wizard'));
    await waitFor(() => {
      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
    });
    expect(screen.getByTestId('editing-character')).toHaveTextContent('Legolas');
  });

  it('a milestone-mode XP echo never celebrates (XP is not the advancement canon there)', async () => {
    await renderInCampaign();
    await dispatch({ key: 'change-test-campaign-Legolas', data: { xp: 3000 } });
    expect(screen.queryByText('LEVEL UP!')).not.toBeInTheDocument();
  });

  it('dismisses by click without opening the wizard', async () => {
    await renderInCampaign();
    await dispatch({ key: 'change-test-campaign-Aragorn', data: { xp: 350 } });
    expect(screen.getByText('LEVEL UP!')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => {
      expect(screen.queryByText('LEVEL UP!')).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
  });
});

function getCharacterFoldersReset() {
  // Re-arm hoisted service doubles that tests may have spent.
  campaignService.createCharacter.mockImplementation(
    async (_campaign, characterData) => ({ character: characterData }),
  );
  campaignService.deleteCharacter.mockImplementation(async () => {});
}
