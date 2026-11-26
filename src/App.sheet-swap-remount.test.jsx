// @maintained-by-ai 2026-11-24
/**
 * App-level contract: the character sheet is KEYED on the active character's
 * identity (App.jsx <CharSheet key={activeCharacter.name}>).
 *
 * Regression (run AZ 2026-11-24, sheet-swap hazard): a sidebar roster click
 * flips document.title to the newly selected character immediately while the
 * sheet's playerStats recompute asynchronously. Unkeyed, the SAME CharSheet
 * instance survived the switch and kept rendering the PREVIOUS character's
 * body — with its live Edit/Delete/Upload handlers — for the whole swap
 * window (the named native confirm was the only backstop, and a blind accept
 * once deleted a permanent fixture). Keying on the character's name forces a
 * clean remount on every switch, so stale handlers can never be attached to
 * the visible sheet: the fresh instance mounts with the new character and
 * nothing before it can be clicked belongs to anyone else.
 *
 * Owned here (App mount-lane only):
 *  - Switch B → A: the B sheet UNMOUNTS synchronously with the click and a
 *    fresh sheet instance mounts for A (no prop-update-in-place of the old
 *    instance), and the delete lane dispatched from the sheet targets A.
 *  - Re-click the SAME character (roster refresh hands CharSheet a brand-new
 *    object with the same name): NO remount — the sheet keeps its instance
 *    and its legitimate in-sheet state.
 * Deeper CharSummary-internal lanes (header-button rendering, named confirm
 * copy) stay in the char-summary folder tests; live swap-window behavior is
 * verified in the QA pass.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import App from './App.jsx';

import { mockState, dataLoaderMocks } from './test/appTestState.js';
import { loadMaps } from './services/maps/mapsService.js';
import { loadCombatSummary } from './services/encounters/combatData.js';

// --- Core mocks (shared harness, mirrors App.state-transitions.test.jsx) ---

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

const _appDataRef = { value: null };

vi.mock('./hooks/runtime/useAppData.js', () => ({
  default: vi.fn(() => _appDataRef.value),
}));

// --- Component mocks ---

// CharSheet stands in as a lifecycle-TRACKED twin of the shared mock: mount/
// unmount pushes the character name it was mounted for. A keyed remount shows
// up as an UNMOUNT of the previous name; a plain prop update (the pre-fix
// behavior) would leave the instance mounted and push nothing here.
const charSheetLifecycle = vi.hoisted(() => ({ mounts: [], unmounts: [] }));

vi.mock('./components/char-sheet/CharSheet.jsx', async () => {
  const { MockCharSheet } = await import('./test/mockComponents.jsx');
  return {
    default: function TrackedCharSheet(props) {
      // Capture the mount-time character in a ref so the mount-only effect
      // never needs props in its deps (exhaustive-deps clean).
      const mountedFor = React.useRef(props.playerSummary?.name);
      React.useEffect(() => {
        const name = mountedFor.current;
        charSheetLifecycle.mounts.push(name);
        return () => { charSheetLifecycle.unmounts.push(name); };
      }, []);
      return React.createElement(MockCharSheet, props);
    },
  };
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

// Render the app with a roster and land on the character sheet.
async function renderInCampaign(characters) {
  setLocalhost('localhost');
  mockState.characters = characters;
  render(<App />);
  await selectCampaign();
  expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
}

// --- Test suite ---

describe('App - sheet-swap keying (CharSheet remounts on character switch)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    charSheetLifecycle.mounts = [];
    charSheetLifecycle.unmounts = [];

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

  it('switching characters unmounts the previous sheet and mounts a fresh one (no stale instance survives the swap)', async () => {
    await renderInCampaign([
      { name: 'Aragorn', level: 1 },
      { name: 'Legolas', level: 2 },
    ]);

    // Auto-mounted sheet belongs to the first character.
    expect(screen.getByTestId('character-name')).toHaveTextContent('Aragorn');
    expect(charSheetLifecycle.mounts).toEqual(['Aragorn']);
    expect(charSheetLifecycle.unmounts).toEqual([]);

    // Roster click for a DIFFERENT character — asserted synchronously, i.e.
    // inside what used to be the swap window. The keyed sheet means the
    // Aragorn instance is GONE (unmounted) and a fresh instance mounted for
    // Legolas; the old handlers cannot still own any rendered button.
    fireEvent.click(screen.getByTestId('char-btn-Legolas'));

    expect(document.title).toBe('test-campaign — Legolas');
    expect(screen.getByTestId('character-name')).toHaveTextContent('Legolas');
    expect(charSheetLifecycle.unmounts).toEqual(['Aragorn']);
    expect(charSheetLifecycle.mounts).toEqual(['Aragorn', 'Legolas']);

    // And the header Delete dispatched from the freshly mounted sheet targets
    // the intended character — never the previous sheet's owner.
    fireEvent.click(screen.getByTitle('Delete Character'));
    await flushEffects();
    const deleteCalls = global.fetch.mock.calls.filter(([url, options]) =>
      String(options?.method) === 'DELETE' || String(url).includes('Legolas'),
    );
    expect(deleteCalls.length).toBeGreaterThan(0);
    const staleDeletes = global.fetch.mock.calls.filter(([url]) =>
      String(url).includes('Aragorn'),
    );
    expect(staleDeletes).toHaveLength(0);
  });

  it('re-clicking the SAME character keeps the mounted sheet instance (no remount, in-sheet state survives)', async () => {
    await renderInCampaign([
      { name: 'Aragorn', level: 1 },
      { name: 'Legolas', level: 2 },
    ]);

    // handleCharacterClick clones a BRAND-NEW object for the same name; the
    // key is the character's identity, so the instance must survive — an
    // ordinary re-render must not destroy legitimate in-sheet state.
    fireEvent.click(screen.getByTestId('char-btn-Aragorn'));
    await flushEffects();

    expect(screen.getByTestId('character-name')).toHaveTextContent('Aragorn');
    expect(charSheetLifecycle.mounts).toEqual(['Aragorn']);
    expect(charSheetLifecycle.unmounts).toEqual([]);
  });
});
