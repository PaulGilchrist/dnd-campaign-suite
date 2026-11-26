// @maintained-by-ai 2026-11-20
/**
 * Campaign-select seam — wizard open-state reset (2026-11-20 reattach bug).
 *
 * The wizard open-flags live on the never-unmounted App. Pre-fix, leaving a
 * campaign with the edit wizard open and re-entering SILENTLY RESURRECTED the
 * session, bound to the LIVE activeCharacter (the first roster entry the
 * re-select callback arms) — a GM editing War_Cleric got an edit session
 * aimed at AasimarTest's file. The create wizard resurrected empty (6b face).
 *
 * Pins (harness mirrors App.level-up-celebration.test.jsx):
 *  - open Edit for the SECOND roster character → Campaigns → re-select →
 *    NO wizard mounts at all (both resurrection classes dead);
 *  - the same seam on a freshly-opened CREATE wizard → NO resurrection;
 *  - while a wizard is open, switching the ACTIVE character (sidebar click)
 *    never re-targets the mounted edit session (captured editingCharacter);
 *  - adjacent behavior intact: normal Edit still seeds the clicked
 *    character; Cancel closes; re-select re-arms the sheet view.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState } from './test/appTestState.js';
import { clearRuntimeState } from './hooks/runtime/useRuntimeState.js';

// --- Core mocks (harness parity with App.level-up-celebration.test.jsx) ---

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

vi.mock('./hooks/runtime/useRuntimeState.js', async () => {
  const actual = await vi.importActual('./hooks/runtime/useRuntimeState.js');
  return { ...actual };
});

vi.mock('./services/campaign/campaignService.js', () => ({
  getCharacterFolders: vi.fn(async () => []),
  getCharacterFiles: vi.fn(async () => []),
  loadCharacters: vi.fn(async () => []),
  deleteCharacter: vi.fn(async () => {}),
  createCharacter: vi.fn(async (_campaign, characterData) => ({ character: characterData })),
  updateCharacter: vi.fn(async () => {}),
}));

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

vi.mock('./components/common/Subscriber.jsx', () => ({
  default: () => null,
}));

// --- Helpers ---

// First roster entry becomes activeCharacter on select (the reattach bait:
// pre-fix the resurrected edit wizard silently showed THIS character).
const ROSTER = [
  { name: 'AasimarTest', level: 1, xp: 0, xpMode: 'milestone', rules: '2024' },
  { name: 'War_Cleric', level: 1, xp: 0, xpMode: 'milestone', rules: '2024' },
];

function jsonResponse(body) {
  return { ok: true, json: () => Promise.resolve(body) };
}

async function flushEffects() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

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

async function renderInCampaign() {
  mockState.characters = ROSTER;
  render(<App />);
  await selectCampaign();
}

function leaveCampaign() {
  fireEvent.click(screen.getByTestId('back-to-campaigns-btn'));
}

function openEditWizard(charName) {
  fireEvent.click(screen.getByTestId(`char-btn-${charName}`));
  fireEvent.click(screen.getByText('Edit'));
}

// --- Test suite ---

describe('App - campaign-select seam closes wizard sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRuntimeState('AasimarTest');
    clearRuntimeState('War_Cleric');

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

  it('an open EDIT wizard does NOT resurrect across leave + re-select (was: silent reattach to the first roster char)', async () => {
    await renderInCampaign();
    // Sanity: normal Edit seeds the CLICKED character, not the active one.
    openEditWizard('War_Cleric');
    await waitFor(() => {
      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
    });
    expect(screen.getByTestId('editing-mode')).toBeInTheDocument();
    expect(screen.getByTestId('editing-character')).toHaveTextContent('War_Cleric');

    leaveCampaign();
    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });

    await selectCampaign();
    // Re-select re-arms the sheet view (adjacent behavior)…
    expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    // …but no wizard remounts: pre-fix `.character-creation-wizard` came back
    // bound to AasimarTest (the new activeCharacter).
    expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
  });

  it('an open CREATE wizard does NOT resurrect across leave + re-select (6b face)', async () => {
    await renderInCampaign();
    fireEvent.click(screen.getByTestId('add-character-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('editing-mode')).not.toBeInTheDocument();

    leaveCampaign();
    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });
    await selectCampaign();

    expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
  });

  it('a mounted edit session is bound to its captured character — switching the ACTIVE character never re-targets it', async () => {
    await renderInCampaign();
    openEditWizard('War_Cleric');
    await waitFor(() => {
      expect(screen.getByTestId('editing-character')).toHaveTextContent('War_Cleric');
    });

    // The escalation-face switch: roster click re-arms activeCharacter WHILE
    // the wizard is mounted. Pre-fix the live binding repainted the session
    // seed to AasimarTest mid-edit (mixed draft, wrong-file save lane).
    fireEvent.click(screen.getByTestId('char-btn-AasimarTest'));
    await settle();

    expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
    expect(screen.getByTestId('editing-character')).toHaveTextContent('War_Cleric');
  });

  it('adjacent sanity: opening and cancelling the edit wizard works both ways', async () => {
    await renderInCampaign();
    openEditWizard('AasimarTest');
    await waitFor(() => {
      expect(screen.getByTestId('editing-character')).toHaveTextContent('AasimarTest');
    });
    fireEvent.click(screen.getByTestId('wizard-cancel-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
    });

    // Re-open for the other character: seed follows the clicked sheet.
    openEditWizard('War_Cleric');
    await waitFor(() => {
      expect(screen.getByTestId('editing-character')).toHaveTextContent('War_Cleric');
    });
    fireEvent.click(screen.getByTestId('wizard-cancel-btn'));
    expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
  });
});
