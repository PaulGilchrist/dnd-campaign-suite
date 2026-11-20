// @maintained-by-ai
/**
 * App-shell contract for the log-decoded audio cue lane (roadmap Item 10,
 * owner ruling 2026-11-20): CombatCues mounts ONCE at App level, so every
 * view — Character sheet, Maps, Log, Initiative — hears save/death/attack
 * cues, and the Initiative view can never double the lane.
 *
 * Rides the App.level-up-celebration.test.jsx harness: REAL CombatCues and
 * the REAL cueForLogEntry decoder; only the browser boundaries are doubled —
 * subscribeToSSE (shared-singleton lane, its own suite's job) and playCue
 * (media playback). Subscriber and CampaignReloadNotice are mocked so the
 * capture below proves CombatCues is the only cue-lane subscriber on the
 * shell, and the one-instance law is an exact count.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState } from './test/appTestState.js';
import { subscribeToSSE } from './services/ui/sseClient.js';
import { playCue } from './services/ui/audioCues.js';

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

// The cue lane's ONLY browser boundaries: the SSE subscription (captured so
// tests push appends through it) and playback. The decoder stays real.
vi.mock('./services/ui/sseClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, subscribeToSSE: vi.fn(() => vi.fn()) };
});

vi.mock('./services/ui/audioCues.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, playCue: vi.fn() };
});

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
vi.mock('./components/sidebar/Sidebar.jsx', async () => {
  const { MockSidebar } = await import('./test/mockComponents.jsx');
  return { default: MockSidebar };
});
vi.mock('./components/character-creation/CharacterCreationWizard.jsx', async () => {
  const { MockWizard } = await import('./test/mockComponents.jsx');
  return { default: MockWizard };
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
vi.mock('./components/campaign-admin/CampaignAdmin.jsx', async () => {
  const { MockCampaignAdmin } = await import('./test/mockComponents.jsx');
  return { default: MockCampaignAdmin };
});
vi.mock('./components/log/Log.jsx', async () => {
  const { MockLog } = await import('./test/mockComponents.jsx');
  return { default: MockLog };
});
vi.mock('./components/music/MusicPlayer.jsx', async () => {
  const { MockMusicPlayer } = await import('./test/mockComponents.jsx');
  return { default: MockMusicPlayer };
});

// Subscriber/CampaignReloadNotice/FirstSessionChecklist also ride
// subscribeToSSE — mocked so the one-instance count below measures ONLY the
// cue lane.
vi.mock('./components/common/Subscriber.jsx', () => ({ default: () => null }));
vi.mock('./components/common/CampaignReloadNotice/CampaignReloadNotice.jsx', () => ({
  default: () => null,
}));
vi.mock('./components/campaign-starter/FirstSessionChecklist.jsx', () => ({
  default: () => null,
}));

// --- Helpers ---

const PARTY = [
  { name: 'Aragorn', level: 1, xp: 250, xpMode: 'experience', rules: '5e' },
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

async function renderInCampaign(characters = PARTY) {
  mockState.characters = characters;
  render(<App />);
  await selectCampaign();
}

// The cue lane's handler(s) as captured through the subscribeToSSE double.
const cueHandlers = () => subscribeToSSE.mock.calls.map(([, handler]) => handler);

function emitLogAppend(data) {
  return act(async () => {
    cueHandlers().forEach((handler) => handler({ key: 'log-test-campaign', data }));
    await flushEffects();
  });
}

const cuesPlayed = () => playCue.mock.calls.map(([cue]) => cue);

// --- Test suite ---

describe('App - combat cue lane (App-level mount, owner ruling 2026-11-20)', () => {
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

  it('never subscribes the cue lane on the campaign-select screen', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });
    expect(subscribeToSSE).not.toHaveBeenCalled();
  });

  it('mounts exactly one cue lane per campaign session and cues in the sheet view', async () => {
    await renderInCampaign();
    // One subscription, for this campaign — the sheet view is active, the
    // Initiative tracker is not mounted anywhere.
    expect(subscribeToSSE).toHaveBeenCalledTimes(1);
    expect(subscribeToSSE).toHaveBeenCalledWith('test-campaign', expect.any(Function));

    await emitLogAppend({ type: 'roll', rollType: 'save', saveResult: 'success', message: 'probe' });
    expect(cuesPlayed()).toEqual(['save-success']);
  });

  it('keeps ONE lane across navigating to the Initiative view (no doubling)', async () => {
    await renderInCampaign();
    fireEvent.click(screen.getByTestId('initiative-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('initiative')).toBeInTheDocument();
    });
    // The tracker mounted, yet the lane was NOT re-subscribed by it.
    expect(subscribeToSSE).toHaveBeenCalledTimes(1);

    await emitLogAppend({ type: 'hp_change', threshold: 'dead', targetName: 'Goblin', message: 'probe' });
    expect(cuesPlayed()).toEqual(['monster-death']);
  });

  it('cues every legal append with exactly one cue per row in any view', async () => {
    await renderInCampaign();
    fireEvent.click(screen.getByTestId('log-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('campaign-log-view')).toBeInTheDocument();
    });
    await emitLogAppend({ type: 'roll', rollType: 'attack', hit: true, isCrit: true, message: 'probe' });
    expect(cuesPlayed()).toEqual(['crit']);

    // Silent faces stay silent through the App seam too.
    playCue.mockClear();
    await emitLogAppend({ type: 'roll', rollType: 'save', name: 'Concentration Save', saveResult: 'success' });
    await emitLogAppend({ type: 'note', noteText: 'quiet' });
    await act(async () => {
      cueHandlers().forEach((handler) => handler({ key: 'log-test-campaign', data: null }));
      await flushEffects();
    });
    expect(playCue).not.toHaveBeenCalled();
  });
});
