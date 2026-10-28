// @maintained-by-ai
/**
 * App-level contract for SSE runtime events and the character lifecycle.
 *
 * This file owns the two things no other App test exercises:
 *
 *  1. The SSE dispatch table (App.jsx → handleRuntimeEvent, captured from
 *     the mocked Subscriber): which event keys mutate what state.
 *     - `character-*` one test covers the whole row: update replaces a
 *       roster entry by name and swaps the active sheet only when the
 *       updated character is active; create appends the new character to
 *       every client's roster (deduped by name so the creating tab's own
 *       refetch + SSE echo never doubles it — bug-character-create-no-live-
 *       mirror); delete (own describe, own roster)
 *       removes a roster entry by its underscore-sanitized file name AND,
 *       when the deleted character is the one open in the sheet, reassigns
 *       the active character to the next remaining one (or null when the
 *       roster empties) — mirroring the local-delete lane's fallback —
 *       while the API is never re-called.
 *     - `pipeline-<campaign>-<key>` mirrors into the runtime store with
 *       skipSync=true (the SSE echo must never re-POST to the server).
 *     - `change-<campaign>-<key>` routes campaign keys (isCampaignKey) to
 *       the campaign store and everything else to the character store,
 *       also skipSync=true; bardic-inspiration prompts gate other writes
 *       until cleared. Null (cleared-key) echoes REMOVE the key from the
 *       campaign store (declared defaults win — never a raw null in the
 *       mirror); scalar echoes mirror into the campaign store; for
 *       character keys both stay dropped (snapshot lane).
 *     - Malformed events (null key, foreign campaigns, null/scalar data on
 *       character keys) are ignored.
 *  2. Character CRUD through the App shell: landing after campaign
 *     selection, wizard cancel-then-create lifecycle, edit-wizard seeding,
 *     and confirmed delete — asserted as observable UI outcomes (roster +
 *     active sheet), with campaignService stubbed at the network boundary.
 *
 * Deliberately NOT re-tested here:
 *  - map-activate SSE auto-open → App.map-activate.test.jsx
 *  - Maps-click routing / back stack → App.map-navigation.test.jsx
 *  - waiting placeholder → App.map-unavailable.test.jsx
 *  - view/theme reset transitions → App.state-transitions.test.jsx
 *  - post-rollback carry-over → App.post-restore.test.jsx
 *  - wizard alert/refresh internals on failure → useCharacterWizard.test.js
 *  - delete confirm/callback state → useCharacterManagement.test.js
 *  - HTTP semantics of campaignService → campaignService.test.js
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState } from './test/appTestState.js';
import { setRuntimeObject, getStore, notify } from './hooks/runtime/useRuntimeState.js';
import * as campaignService from './services/campaign/campaignService.js';
import { loadMaps } from './services/maps/mapsService.js';

// Test access to the SSE handler wired into the (mocked) app-level Subscriber.
const subscriberMock = vi.hoisted(() => ({
  props: { handleEvent: null },
}));

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

// Network boundary for character CRUD. HTTP semantics are covered by
// campaignService.test.js; hook-level confirm/callback behavior by the
// hook tests. Here we only stub so App outcomes are deterministic.
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

// --- Component mocks ---

// Local CharSheet double: adds a level readout (beyond the shared mock) so
// SSE character-* updates to the ACTIVE character are observable — the rest
// of the surface matches the shared double so CRUD flows behave identically.
vi.mock('./components/char-sheet/CharSheet.jsx', async () => {
  const React = await import('react');
  return {
    default: function CharSheetDouble({ playerSummary, onDeleteCharacter, onEditCharacter }) {
      return React.createElement(
        'div',
        { 'data-testid': 'char-sheet' },
        React.createElement(
          'span',
          { 'data-testid': 'character-name' },
          playerSummary?.name || 'no character'
        ),
        React.createElement(
          'span',
          { 'data-testid': 'character-level' },
          String(playerSummary?.level ?? 'none')
        ),
        React.createElement(
          'button',
          // Mirrors the real CharSummary leaf (:626): named confirm at the
          // click point, dispatch only on accept (fix#36 queue — the hook no
          // longer confirms; 2026-10-28-P — the prompt names the character).
          { onClick: () => { if (window.confirm(`Delete character "${playerSummary?.name}"? This action is irreversible.`)) onDeleteCharacter?.(playerSummary?.name); } },
          'Delete Char'
        ),
        React.createElement('button', { onClick: () => onEditCharacter?.() }, 'Edit')
      );
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

const PARTY = [
  { name: 'Aragorn', level: 1 },
  { name: 'Legolas', level: 2 },
];

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
  await waitFor(() => {
    expect(screen.queryByTestId('campaign-selection')).not.toBeInTheDocument();
  });
  await flushEffects();
}

// Render the app and select test-campaign with the given roster.
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

// setRuntimeObject calls scoped to a store key (MapContextSync also writes
// '__campaign__'/'__map__' on mount — those are unrelated noise here).
function writesFor(storeKey) {
  return setRuntimeObject.mock.calls.filter((call) => call[0] === storeKey);
}

// --- Test suite ---

describe('App - Runtime Events & State Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscriberMock.props.handleEvent = null;

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
    window.prompt = vi.fn(() => 'New Campaign Name');

    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost', reload: vi.fn() },
      writable: true,
      configurable: true,
    });

    global.fetch = vi.fn(() => Promise.resolve(jsonResponse({})));

    // Re-arm service doubles (mockRejectedValueOnce etc. may be spent).
    campaignService.deleteCharacter.mockImplementation(async () => {});
    campaignService.createCharacter.mockImplementation(
      async (_campaign, characterData) => ({ character: characterData }),
    );
    campaignService.updateCharacter.mockImplementation(async () => {});
    getStore.mockImplementation(() => new Map());
    loadMaps.mockResolvedValue({ maps: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Campaign selection landing', () => {
    it('lands on the first character sheet, lists the whole roster, and switches sheets on sidebar clicks', async () => {
      await renderInCampaign([...PARTY, { name: 'Gimli', level: 3 }]);

      expect(screen.getByTestId('char-btn-Aragorn')).toBeInTheDocument();
      expect(screen.getByTestId('char-btn-Legolas')).toBeInTheDocument();
      expect(screen.getByTestId('char-btn-Gimli')).toBeInTheDocument();
      expect(screen.getByTestId('character-name')).toHaveTextContent('Aragorn');
      expect(screen.getByTestId('character-level')).toHaveTextContent('1');

      fireEvent.click(screen.getByTestId('char-btn-Gimli'));
      await waitFor(() => {
        expect(screen.getByTestId('character-name')).toHaveTextContent('Gimli');
        expect(screen.getByTestId('character-level')).toHaveTextContent('3');
      });

      fireEvent.click(screen.getByTestId('char-btn-Legolas'));
      await waitFor(() => {
        expect(screen.getByTestId('character-name')).toHaveTextContent('Legolas');
      });
    });

    it('auto-opens the creation wizard when the selected campaign has no characters', async () => {
      await renderInCampaign([]);

      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();
    });
  });

  describe('Character creation wizard', () => {
    it('cancels without creating, then creates on complete and refreshes the roster from the server', async () => {
      await renderInCampaign();

      // Cancel closes the wizard and touches nothing.
      fireEvent.click(screen.getByTestId('add-character-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('wizard-cancel-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
      });
      expect(campaignService.createCharacter).not.toHaveBeenCalled();
      expect(screen.getByTestId('char-btn-Aragorn')).toBeInTheDocument();
      expect(screen.getByTestId('char-btn-Legolas')).toBeInTheDocument();

      // Server-side truth for the roster refresh the create flow performs.
      const created = { name: 'New Character', level: 1 };
      global.fetch = vi.fn((url) => {
        if (url === '/api/campaigns/test-campaign') {
          return Promise.resolve(jsonResponse({ files: ['new-character.json'] }));
        }
        if (url.endsWith('/new-character.json')) {
          return Promise.resolve(jsonResponse(created));
        }
        return Promise.resolve(jsonResponse({}));
      });

      fireEvent.click(screen.getByTestId('add-character-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('wizard-complete-btn'));
      });

      expect(campaignService.createCharacter).toHaveBeenCalledWith(
        'test-campaign',
        expect.objectContaining({ name: 'New Character' }),
      );
      expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('char-btn-New Character')).toBeInTheDocument();
        expect(screen.getByTestId('character-name')).toHaveTextContent('New Character');
      });
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('keeps the wizard open and alerts when character creation fails', async () => {
      campaignService.createCharacter.mockRejectedValueOnce(new Error('server offline'));
      await renderInCampaign();

      fireEvent.click(screen.getByTestId('add-character-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('wizard-complete-btn'));
      });

      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('server offline'));
      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      expect(screen.queryByTestId('char-btn-New Character')).not.toBeInTheDocument();
    });
  });

  describe('Edit wizard', () => {
    it('opens in editing mode seeded with the active character, and cancel returns to an untouched sheet', async () => {
      await renderInCampaign();

      fireEvent.click(screen.getByText('Edit'));
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });
      expect(screen.getByTestId('editing-mode')).toBeInTheDocument();
      expect(screen.getByTestId('editing-character')).toHaveTextContent('Aragorn');

      fireEvent.click(screen.getByTestId('wizard-cancel-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
      });
      expect(campaignService.updateCharacter).not.toHaveBeenCalled();
      expect(screen.getByTestId('character-name')).toHaveTextContent('Aragorn');
    });
  });

  describe('Character deletion', () => {
    it('deletes after confirmation, dropping the character from the roster onto the next one', async () => {
      await renderInCampaign();

      fireEvent.click(screen.getByText('Delete Char'));

      // Single dialog, exact leaf bytes (fix#36 queue: hook guard removed —
      // the name used to appear only in the retired second stacked hook
      // prompt; 2026-10-28-P: the leaf prompt itself now names the character
      // — the dispatched name is also pinned on the deleteCharacter call).
      expect(window.confirm).toHaveBeenCalledTimes(1);
      expect(window.confirm).toHaveBeenCalledWith('Delete character "Aragorn"? This action is irreversible.');
      expect(window.confirm).not.toHaveBeenCalledWith(expect.stringContaining('Legolas'));
      await waitFor(() => {
        // Case-preserved canonical recipe ('Aragorn' → 'Aragorn.json'), NOT the
        // old lowercase guess (bug-character-delete-sanitizer-mismatch).
        expect(campaignService.deleteCharacter).toHaveBeenCalledWith('test-campaign', 'Aragorn.json');
      });
      await waitFor(() => {
        expect(screen.queryByTestId('char-btn-Aragorn')).not.toBeInTheDocument();
        expect(screen.getByTestId('character-name')).toHaveTextContent('Legolas');
      });
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('alerts and keeps the roster intact when the delete request fails', async () => {
      // Single-warn doctrine pin: campaignService is mocked here, so the
      // service layer's own console.error never runs — assert directly that
      // the App wrapper logs NOTHING (its job is the alert only) while the
      // user-visible alert still fires (2026-10-28-P backlog).
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      campaignService.deleteCharacter.mockRejectedValueOnce(new Error('server offline'));
      await renderInCampaign();

      fireEvent.click(screen.getByText('Delete Char'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Failed to delete character: server offline');
      });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(screen.getByTestId('char-btn-Aragorn')).toBeInTheDocument();
      expect(screen.getByTestId('character-name')).toHaveTextContent('Aragorn');
    });
  });

  describe('SSE runtime events', () => {
    beforeEach(async () => {
      await renderInCampaign();
    });

    it('character-update replaces a roster entry (swapping the active sheet only for the active character); character-create appends exactly one entry, deduped on re-echo', async () => {
      await dispatch({
        key: 'character-update-test-campaign-Aragorn.json',
        data: { name: 'Aragorn', level: 5 },
      });

      expect(screen.getByTestId('char-btn-Aragorn')).toBeInTheDocument();
      expect(screen.getByTestId('character-name')).toHaveTextContent('Aragorn');
      expect(screen.getByTestId('character-level')).toHaveTextContent('5');

      // Updating a NON-active character must leave the open sheet untouched.
      await dispatch({
        key: 'character-update-test-campaign-Legolas.json',
        data: { name: 'Legolas', level: 9 },
      });

      expect(screen.getByTestId('character-name')).toHaveTextContent('Aragorn');
      expect(screen.getByTestId('character-level')).toHaveTextContent('5');

      // bug-character-create-no-live-mirror: a create frame appends the new
      // character to every client's roster — passive tabs see new party
      // members live, no reload.
      await dispatch({
        key: 'character-create-test-campaign-stranger.json',
        data: { name: 'Stranger', level: 1 },
      });

      expect(screen.getByTestId('char-btn-Stranger')).toBeInTheDocument();
      expect(screen.getByTestId('char-btn-Aragorn')).toBeInTheDocument();
      expect(screen.getByTestId('char-btn-Legolas')).toBeInTheDocument();
      // The create echo must NOT hijack the open sheet on a passive tab.
      expect(screen.getByTestId('character-name')).toHaveTextContent('Aragorn');

      // Re-echo (e.g. the creating tab's refetch already listed the character)
      // must dedup by name — exactly one entry.
      await dispatch({
        key: 'character-create-test-campaign-stranger.json',
        data: { name: 'Stranger', level: 1 },
      });

      expect(screen.getAllByTestId('char-btn-Stranger')).toHaveLength(1);
    });

    it('mirrors pipeline events into the runtime store with skipSync (never re-posting the SSE echo)', async () => {
      const data = { total: 14, critical: false };

      await dispatch({ key: 'pipeline-test-campaign-damage:rolled', data });

      expect(setRuntimeObject).toHaveBeenCalledWith('damage:rolled', data, 'test-campaign', true);
    });

    it('applies character-scoped change events to the character store with skipSync', async () => {
      const data = { hp: { current: 7, max: 12 } };

      await dispatch({ key: 'change-test-campaign-Aragorn', data });

      expect(writesFor('Aragorn')).toEqual([['Aragorn', data, 'test-campaign', true]]);
    });

    it('routes campaign-scoped change events into the campaign store and wakes its listeners', async () => {
      const campaignStore = new Map();
      getStore.mockImplementation(() => campaignStore);

      const data = [{ target: 'Goblin', effect: 'bless' }];
      await dispatch({ key: 'change-test-campaign-targetEffects', data });

      expect(campaignStore.get('targetEffects')).toEqual(data);
      expect(notify).toHaveBeenCalledWith('campaign');
      expect(writesFor('targetEffects')).toHaveLength(0);
    });

    // Cross-tab staleness bug: cleared keys publish null and scalars are plain
    // value updates — dropping them kept resolved prompts (travel EventDialog)
    // open and actionable on every other client. A cleared-key echo mirrors as
    // a key REMOVE (not a stored null) so useSyncedState consumers fall back
    // to their DECLARED default (pendingEvent's is null → the dialog closes)
    // and typed consumers never receive a raw null (arrival-echo blank-screen
    // bug: storing null crashed the whole SPA on travel arrival).
    it('mirrors a null cleared-key echo as a key REMOVE so stale prompts close without feeding null', async () => {
      const campaignStore = new Map([[
        'travel-pendingEvent', { title: 'Wolves on the Hunt', type: 'combat' },
      ]]);
      getStore.mockImplementation(() => campaignStore);

      await dispatch({ key: 'change-test-campaign-travel-pendingEvent', data: null });

      expect(campaignStore.has('travel-pendingEvent')).toBe(false);
      expect(notify).toHaveBeenCalledWith('campaign');
      expect(writesFor('travel-pendingEvent')).toHaveLength(0);
    });

    // bug-hex-arrival-null-echo-blank-screen: arrival's per-key DELETEs echo
    // null for the typed COMPLETED_TRIP_KEYS; raw null in the store crashed
    // useTravelManagement's render (path.length). Mirror them as removals so
    // the hook's declared defaults ([] / 0 / null) win instead.
    it('removes typed travel keys on null cleared-key echoes (arrival cleanup never stores null)', async () => {
      const campaignStore = new Map([
        ['travel-destination', { q: 20, r: 10 }],
        ['travel-path', [{ q: 21, r: 10 }, { q: 20, r: 10 }]],
        ['travel-pathIndex', 1],
      ]);
      getStore.mockImplementation(() => campaignStore);

      for (const key of ['travel-destination', 'travel-path', 'travel-pathIndex']) {
        await dispatch({ key: `change-test-campaign-${key}`, data: null });
      }

      expect(campaignStore.size).toBe(0);
      expect(notify).toHaveBeenCalledWith('campaign');
      expect(writesFor('travel-path')).toHaveLength(0);
    });

    it('mirrors scalar change echoes (string values) into the campaign store', async () => {
      const campaignStore = new Map();
      getStore.mockImplementation(() => campaignStore);

      await dispatch({ key: 'change-test-campaign-travel-lastMessage', data: 'Party has arrived.' });

      expect(campaignStore.get('travel-lastMessage')).toBe('Party has arrived.');
      expect(notify).toHaveBeenCalledWith('campaign');
      expect(writesFor('travel-lastMessage')).toHaveLength(0);
    });

    it('keeps dropping null/scalar echoes for character-scoped keys (full-snapshot lane)', async () => {
      const campaignStore = new Map();
      getStore.mockImplementation(() => campaignStore);

      await dispatch({ key: 'change-test-campaign-Aragorn', data: null });
      await dispatch({ key: 'change-test-campaign-Aragorn', data: 'corrupt' });

      expect(writesFor('Aragorn')).toHaveLength(0);
      expect(campaignStore.size).toBe(0);
      expect(notify).not.toHaveBeenCalledWith('campaign');
    });

    it('suppresses character-store writes while a bardic-inspiration prompt is pending, resuming once cleared', async () => {
      await dispatch({
        key: 'change-test-campaign-Aragorn',
        data: { biPrompt: { promptId: 'bi-1' } },
      });
      expect(writesFor('Aragorn')).toHaveLength(0);

      // The cleared signal itself is swallowed too — only the gate moves.
      await dispatch({
        key: 'change-test-campaign-Aragorn',
        data: { biPromptCleared: true },
      });
      expect(writesFor('Aragorn')).toHaveLength(0);

      // Normal traffic resumes after the prompt window.
      await dispatch({ key: 'change-test-campaign-Aragorn', data: { hp: 12 } });
      expect(writesFor('Aragorn')).toEqual([['Aragorn', { hp: 12 }, 'test-campaign', true]]);
    });

    it.each([
      ['null key', { key: null, data: { hp: 1 } }],
      ['null data', { key: 'change-test-campaign-Aragorn', data: null }],
      ['non-object data', { key: 'change-test-campaign-Aragorn', data: 'corrupt' }],
      ['another campaign pipeline key', { key: 'pipeline-other-campaign-damage:rolled', data: { total: 1 } }],
    ])('ignores runtime events with %s without crashing or touching state', async (_label, event) => {
      const campaignStore = new Map();
      getStore.mockImplementation(() => campaignStore);

      await dispatch(event);

      expect(writesFor('Aragorn')).toHaveLength(0);
      expect(writesFor('damage:rolled')).toHaveLength(0);
      expect(campaignStore.size).toBe(0);
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });
  });

  // Remote deletes (SSE echoes from another client) mirror the local-delete
  // lane: the roster entry goes, and when the deleted character is the one
  // open in the sheet the active character falls back to the next remaining
  // one (cloneDeep(remaining[0])) or null when the roster empties — no ghost
  // sheet of a deleted character (ghost-sheet backlog, 2026-10-28-P). The
  // API is never re-called here. Matches delete file names by the canonical
  // characterFileName() recipe ("Sir Basil" → Sir_Basil.json). Own describe:
  // renders its own rosters.
  describe('SSE character-delete events', () => {
    it('deleting the ACTIVE character reassigns the sheet to the next remaining one, removing the sidebar link without re-calling the API', async () => {
      // Landing auto-selects the first character, so Sir Basil is open.
      await renderInCampaign([{ name: 'Sir Basil', level: 4 }, { name: 'Legolas', level: 2 }]);
      expect(screen.getByTestId('character-name')).toHaveTextContent('Sir Basil');

      await dispatch({
        key: 'character-delete-other-folder-Sir_Basil.json',
        data: { file: 'Sir_Basil.json' },
      });

      expect(screen.queryByTestId('char-btn-Sir Basil')).not.toBeInTheDocument();
      expect(screen.getByTestId('char-btn-Legolas')).toBeInTheDocument();
      expect(screen.getByTestId('character-name')).toHaveTextContent('Legolas');
      expect(campaignService.deleteCharacter).not.toHaveBeenCalled();
    });

    it('deleting a NON-active character leaves the open sheet untouched', async () => {
      await renderInCampaign([{ name: 'Sir Basil', level: 4 }, { name: 'Legolas', level: 2 }]);

      await dispatch({
        key: 'character-delete-test-campaign-Legolas.json',
        data: { file: 'Legolas.json' },
      });

      expect(screen.queryByTestId('char-btn-Legolas')).not.toBeInTheDocument();
      expect(screen.getByTestId('char-btn-Sir Basil')).toBeInTheDocument();
      expect(screen.getByTestId('character-name')).toHaveTextContent('Sir Basil');
      expect(screen.getByTestId('character-level')).toHaveTextContent('4');
    });

    it('deleting the LAST character nulls the active one (sheet unmounts, no ghost)', async () => {
      await renderInCampaign([{ name: 'Sir Basil', level: 4 }]);
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();

      await dispatch({
        key: 'character-delete-test-campaign-Sir_Basil.json',
        data: { file: 'Sir_Basil.json' },
      });

      expect(screen.queryByTestId('char-btn-Sir Basil')).not.toBeInTheDocument();
      expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();
    });
  });
});