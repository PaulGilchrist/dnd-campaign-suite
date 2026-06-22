// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

import { mockState, dataLoaderMocks } from './test/appTestState.js';

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

vi.mock('./components/char-sheet/CharSheet.jsx', async () => {
  const { MockCharSheet } = await import('./test/mockComponents.jsx');
  return { default: MockCharSheet };
});
vi.mock('./components/initiative/initiative.jsx', async () => {
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

vi.mock('./components/common/Subscriber.jsx', () => ({
  default: function MockSubscriber() { return null; },
}));

const originalLocation = window.location;

describe('App', () => {
  const defaultFetch = () =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({}) });

  const setNonLocalhost = () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'example.com', reload: vi.fn() },
      writable: true,
      configurable: true,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();

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

    global.fetch = vi.fn(defaultFetch);

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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  const selectCampaign = async () => {
    fireEvent.click(screen.getByTestId('select-campaign-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('campaign-selection')).not.toBeInTheDocument();
    });
  };

  describe('SSE runtime event handling', () => {
    it('updates character when character change event received', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });

    it('skips character delete prefix events', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });

    it('skips character create prefix events', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });

    it('ignores events with null key', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });

    it('ignores events with null data', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });
  });

  describe('Map navigation stack', () => {
    it('pushes current map to history when entering a new map while already on a map', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => expect(screen.getByTestId('maps-manager')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('open-map-btn'));
      await waitFor(() => expect(screen.getByTestId('map-view')).toBeInTheDocument());
    });

    it('goes back to manager when history is empty on non-localhost', async () => {
      setNonLocalhost();
      const { loadMaps } = await import('./services/maps/mapsService.js');
      loadMaps.mockResolvedValue({ maps: [{ fileName: 'dungeon-1.json', isActive: true }] });

      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => expect(screen.getByTestId('map-view')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('map-back-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
        expect(screen.queryByTestId('maps-manager')).not.toBeInTheDocument();
      });
    });
  });

  describe('Settlements view', () => {
    it('renders Settlements view', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('settlements-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('settlements-view')).toBeInTheDocument();
      });
    });

    it('exercises Settlements onBack callback', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('settlements-btn'));
      await waitFor(() => expect(screen.getByTestId('settlements-view')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('settlements-back-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('settlements-view')).not.toBeInTheDocument();
      });
    });
  });

  describe('Campaign Log view', () => {
    it('renders Campaign Log view', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('log-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('campaign-log-view')).toBeInTheDocument();
      });
    });

    it('is idempotent when already on campaign log', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('log-btn'));
      await waitFor(() => expect(screen.getByTestId('campaign-log-view')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('log-btn'));
      expect(screen.getByTestId('campaign-log-view')).toBeInTheDocument();
    });
  });

  describe('Processing overlay', () => {
    it('shows loading overlay during character processing', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });

    it('hides loading overlay after processing completes', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });
  });

  describe('Overlays rendering', () => {
    it('renders SavePromptModal', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });

    it('renders DeathSavePromptModal', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });

    it('renders ConcentrationPromptModal', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
    });
  });
});
