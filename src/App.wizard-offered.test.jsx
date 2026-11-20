// @maintained-by-ai
/**
 * App-level contract for the once-per-campaign zero-character auto-wizard
 * (backlog KA 2026-11-18).
 *
 * Selecting a zero-character campaign auto-opened the creation wizard on
 * EVERY re-select — Cancel → Campaigns → re-enter re-blocked the next click
 * again. The select callback now gates the auto-open behind the per-client
 * localStorage display pref `character-wizard-offered:<campaign>` (same tier
 * as the TV pref `initiative-tv`): the first-ever offer stamps the flag, a
 * stamped campaign lands on the navigable shell instead.
 *
 * Pinned here:
 *  - first select of a zero-character campaign auto-opens AND stamps;
 *  - cancel → back → re-select the SAME campaign: no re-open, zero wizard
 *    mounts, and the very next sidebar click navigates (nothing blocks it);
 *  - the flag is per-campaign: a different zero-character campaign with no
 *    flag still auto-opens (and stamps only its own key);
 *  - the pref never gates deliberate lanes: the sidebar Add Character button
 *    still opens the wizard for an already-stamped campaign;
 *  - the stamp is localStorage-only: no fetch hits the server with it;
 *  - a NON-localhost (LAN visitor) origin never gets the auto-open at all
 *    (creation is GM-only everywhere else, server POST 403s) AND its offer
 *    key stays unburned, so a later GM session on the same profile still
 *    gets its one offer (LAN-visitor dead-end bug 2026-11-20).
 *
 * Harness mirrors App.runtime-events.test.jsx (shared mock doubles, campaign
 * Service stubbed at the network boundary). localStorage is NOT auto-cleared
 * by src/test/setup.js, so each test clears it up front to simulate a clean
 * browser profile.
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

async function backToCampaigns() {
  await waitFor(() => {
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });
  fireEvent.click(screen.getByTestId('back-to-campaigns-btn'));
  await waitFor(() => {
    expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
  });
}

function offeredKey(name) {
  return `character-wizard-offered:${name}`;
}

// --- Test suite ---

describe('App - zero-character auto-wizard offered once per campaign', () => {
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

  it('auto-opens the wizard on the FIRST select of a zero-character campaign and stamps the pref', async () => {
    mockState.campaignName = 'qa-wiza';
    render(<App />);
    await selectCampaign();

    expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
    expect(localStorage.getItem(offeredKey('qa-wiza'))).toBe('1');
  });

  it('cancel → back → re-select of the SAME campaign does not re-open, and the next click navigates', async () => {
    mockState.campaignName = 'qa-wiza';
    render(<App />);
    await selectCampaign();

    await waitFor(() => {
      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('wizard-cancel-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
    });

    backToCampaigns();
    await selectCampaign();

    // The offered flag suppresses the auto-open: zero wizard mounts after the
    // re-select, and the shell is navigable — the very next click (a sidebar
    // view) lands without needing a Cancel first.
    expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[class*=wizard]').length).toBe(0);
    fireEvent.click(screen.getByTestId('log-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('campaign-log-view')).toBeInTheDocument();
    });
    expect(screen.getByTestId('sidebar-active-indicator')).toHaveTextContent('Log');
  });

  it('a DIFFERENT zero-character campaign with no flag still auto-opens (per-campaign, not global)', async () => {
    mockState.campaignName = 'qa-wiza';
    render(<App />);
    await selectCampaign();
    await waitFor(() => {
      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('wizard-cancel-btn'));

    backToCampaigns();
    mockState.campaignName = 'qa-wizb';
    await selectCampaign();

    expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
    expect(localStorage.getItem(offeredKey('qa-wizb'))).toBe('1');
    // Only qa-wizb's own key was stamped by this select.
    expect(localStorage.getItem(offeredKey('qa-wiza'))).toBe('1');
  });

  it('stays localStorage-only: the offered pref never reaches the server', async () => {
    mockState.campaignName = 'qa-wiza';
    render(<App />);
    await selectCampaign();
    await waitFor(() => {
      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('wizard-cancel-btn'));
    backToCampaigns();
    await selectCampaign();

    const offeredWrites = global.fetch.mock.calls.filter(
      ([, options]) => String(options?.body ?? '').includes('character-wizard-offered'),
    );
    expect(offeredWrites).toHaveLength(0);
  });

  it('never gates deliberate lanes: Add Character still opens the wizard for a stamped campaign', async () => {
    mockState.campaignName = 'qa-wiza';
    render(<App />);
    await selectCampaign();
    await waitFor(() => {
      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('wizard-cancel-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('add-character-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
    });
  });

  it('visitor origin (non-localhost): zero-character select does NOT mount the auto-wizard and burns no offer key', async () => {
    // LAN-visitor dead-end bug 2026-11-20: character creation is GM-only
    // (sidebar door, empty-state card, server POST refuseUnlessGm), so the
    // offer-once auto-open must not mount for a visitor either.
    Object.defineProperty(window, 'location', {
      value: { hostname: '192.168.0.44', reload: vi.fn() },
      writable: true,
      configurable: true,
    });
    mockState.campaignName = 'qa-wiza';
    render(<App />);
    await selectCampaign();

    expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[class*=wizard]').length).toBe(0);
    // The shell is navigable for the visitor (empty stage, not a dead end).
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    // No offer made ⇒ no key burned: visitors never trip markWizardOffered.
    expect(localStorage.getItem(offeredKey('qa-wiza'))).toBeNull();
  });

  it('visitor select leaves the key unburned so a later GM session still gets its one offer', async () => {
    mockState.campaignName = 'qa-wiza';
    Object.defineProperty(window, 'location', {
      value: { hostname: '192.168.0.44', reload: vi.fn() },
      writable: true,
      configurable: true,
    });
    render(<App />);
    await selectCampaign();
    expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();

    // The same browser profile now runs as the GM (localhost origin): the
    // untouched offer key means the auto-wizard still fires exactly once.
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost', reload: vi.fn() },
      writable: true,
      configurable: true,
    });
    backToCampaigns();
    await selectCampaign();

    await waitFor(() => {
      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
    });
    expect(localStorage.getItem(offeredKey('qa-wiza'))).toBe('1');
  });
});
