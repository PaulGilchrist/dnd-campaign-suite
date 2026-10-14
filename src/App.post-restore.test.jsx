// @improved-by-ai
// App-level wiring tests for the post-rollback carry-over flow.
//
// CampaignAdmin's rollback handler writes a 'postRestoreNotice' to sessionStorage
// right before its full page reload. On boot, App must consume it: auto-select
// the campaign, land the GM on the Admin view (NOT the character sheet), and
// show a banner naming the restored snapshot.
//
// Unit-level behavior of the same feature is covered elsewhere and is
// deliberately NOT re-tested here:
// - hooks/ui/usePostRestoreNotice.test.js               → notice parsing/consumption,
//                                                          consumeRestore gating, banner drop
// - components/campaign-selection/CampaignSelection.test.jsx → auto-select prop behavior
// - components/campaign-admin/CampaignAdmin.rollback-upload.test.jsx → writing the notice,
//                                                          rendering the success banner

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState } from './test/appTestState.js';

// --- Core mocks (mirrors App.state-transitions.test.jsx) ---

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
}));

vi.mock('./hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeObject: vi.fn(),
  seedTrackedResources: vi.fn(),
  getStore: vi.fn(() => new Map()),
  notify: vi.fn(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

// useAppData is mocked (not the hook under test) so App renders instantly
// with deterministic rule data instead of fetching 20+ JSON files.
const _appDataRef = { value: null };

vi.mock('./hooks/runtime/useAppData.js', () => ({
  default: vi.fn(() => _appDataRef.value),
}));

// --- Heavy child components replaced with test doubles ---

vi.mock('./components/char-sheet/CharSheet.jsx', async () => {
  const { MockCharSheet } = await import('./test/mockComponents.jsx');
  return { default: MockCharSheet };
});
vi.mock('./components/initiative/Initiative.jsx', async () => {
  const { MockInitiative } = await import('./test/mockComponents.jsx');
  return { default: MockInitiative };
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

// CampaignSelection double: auto-selects without a click when App passes
// autoSelectCampaign (mirrors the real component, verified in its own test
// file), and still offers a manual select button so the no-notice flow can
// be exercised end-to-end.
vi.mock('./components/campaign-selection/CampaignSelection.jsx', async () => {
  const React = await import('react');
  const { mockState } = await import('./test/appTestState.js');
  return {
    default: function MockAutoSelectCampaigns({ onCampaignSelect, autoSelectCampaign }) {
      React.useEffect(() => {
        if (autoSelectCampaign) {
          onCampaignSelect(autoSelectCampaign, mockState.characters);
        }
      }, [autoSelectCampaign, onCampaignSelect]);
      return (
        <div data-testid="campaign-selection">
          <button
            data-testid="select-campaign-btn"
            onClick={() => onCampaignSelect(mockState.campaignName, mockState.characters)}
          >
            Select Campaign
          </button>
        </div>
      );
    },
  };
});

// CampaignAdmin double echoing the restoredSnapshot prop so the App-level
// prop wiring (hook state → banner) is observable.
vi.mock('./components/campaign-admin/CampaignAdmin.jsx', () => ({
  default: ({ campaignName, restoredSnapshot }) => (
    <div data-testid="campaign-admin">
      <span data-testid="admin-campaign">{campaignName}</span>
      {restoredSnapshot && (
        <span data-testid="admin-restored-banner">Campaign restored from {restoredSnapshot}</span>
      )}
    </div>
  ),
}));

vi.mock('./components/common/Subscriber.jsx', () => ({
  default: function MockSubscriber() { return null; },
}));

// --- Helpers ---

const RESTORED_FILE = 'test-campaign-2026-10-10T12-34-56-789.zip';

function writePostRestoreNotice(campaign = 'test-campaign', restored = RESTORED_FILE) {
  sessionStorage.setItem('postRestoreNotice', JSON.stringify({ campaign, restored }));
}

// --- Test suite ---

describe('App - post-rollback carry-over', () => {
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
    mockState.characters = [{ name: 'Aragorn', level: 1 }];

    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost', reload: vi.fn() },
      writable: true,
      configurable: true,
    });
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('consumes the notice on boot: auto-selects the campaign and lands on the Admin view with the snapshot banner, without a click', async () => {
    writePostRestoreNotice();

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('campaign-admin')).toBeInTheDocument();
    });

    // The banner names the exact snapshot that was restored, scoped to the
    // restored campaign.
    expect(screen.getByTestId('admin-campaign')).toHaveTextContent('test-campaign');
    expect(screen.getByTestId('admin-restored-banner').textContent)
      .toBe(`Campaign restored from ${RESTORED_FILE}`);

    // The restore landing replaces the normal post-selection landing
    // (character sheet) and removes the campaign-selection screen — all with
    // no user interaction after the reload.
    expect(screen.queryByTestId('campaign-selection')).not.toBeInTheDocument();
    expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();

    // One-shot: the notice is consumed so a later reload cannot re-trigger it.
    expect(sessionStorage.getItem('postRestoreNotice')).toBeNull();
  });

  it('normal boot without a notice shows campaign selection and never triggers the restore landing', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('campaign-admin')).not.toBeInTheDocument();

    // A normal manual campaign selection lands on the character sheet with
    // no admin view and no restored banner.
    await act(async () => {
      fireEvent.click(screen.getByTestId('select-campaign-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('campaign-admin')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-restored-banner')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('postRestoreNotice')).toBeNull();
  });
});
