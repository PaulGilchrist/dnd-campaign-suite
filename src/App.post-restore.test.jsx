import { render, screen, waitFor } from '@testing-library/react';
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

// CampaignSelection mock honoring the post-rollback auto-select prop.
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
      return React.createElement('div', { 'data-testid': 'campaign-selection' });
    },
  };
});

// CampaignAdmin mock echoing the restored-snapshot banner prop.
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

const RESTORED_FILE = 'test-campaign-2026-10-10T12-34-56-789.zip';

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

  it('auto-selects the campaign, opens the Admin view, shows the restored banner, and clears the flag', async () => {
    sessionStorage.setItem('postRestoreNotice', JSON.stringify({ campaign: 'test-campaign', restored: RESTORED_FILE }));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('campaign-admin')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('campaign-selection')).not.toBeInTheDocument();
    expect(screen.getByTestId('admin-campaign')).toHaveTextContent('test-campaign');
    expect(screen.getByTestId('admin-restored-banner')).toHaveTextContent(`Campaign restored from ${RESTORED_FILE}`);
    expect(sessionStorage.getItem('postRestoreNotice')).toBeNull();
  });

  it('shows campaign selection normally when no restore notice is present', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('campaign-admin')).not.toBeInTheDocument();
  });
});
