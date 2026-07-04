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

describe('App - Views, Overlays & Props', () => {
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

    document.title = 'CharSheets';

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

  describe('Character switching', () => {
    it('switches active character from sidebar', async () => {
      mockState.characters = [
        { name: 'Aragorn', level: 1 },
        { name: 'Legolas', level: 2 },
      ];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
        expect(screen.getByTestId('character-name').textContent).toBe('Aragorn');
      });
      fireEvent.click(screen.getByTestId('char-btn-Legolas'));
      await waitFor(() => {
        expect(screen.getByTestId('character-name').textContent).toBe('Legolas');
      });
    });

    it('renders all characters in sidebar with active class on first', async () => {
      mockState.characters = [
        { name: 'Aragorn', level: 1 },
        { name: 'Legolas', level: 2 },
        { name: 'Gimli', level: 2 },
      ];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-btn-Aragorn')).toBeInTheDocument();
        expect(screen.getByTestId('char-btn-Legolas')).toBeInTheDocument();
        expect(screen.getByTestId('char-btn-Gimli')).toBeInTheDocument();
        expect(screen.getByTestId('char-btn-Aragorn')).toHaveClass('active');
      });
    });

    it('passes characters to sub-views', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();

      // Initiative receives computedCharacters via computed count
      fireEvent.click(screen.getByTestId('initiative-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('initiative')).toBeInTheDocument();
        expect(screen.getByTestId('init-char-count').textContent).toBe('1');
      });

      // Map view — go back to char-sheet first, then open maps
      fireEvent.click(screen.getByTestId('char-btn-Aragorn'));
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('open-map-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
        expect(screen.getByTestId('map-char-count').textContent).toBe('1');
      });

      // EncounterBuilder — go back to char-sheet then open encounter
      fireEvent.click(screen.getByTestId('map-back-btn'));
      fireEvent.click(screen.getByTestId('mm-back-btn'));
      fireEvent.click(screen.getByTestId('char-btn-Aragorn'));
      fireEvent.click(screen.getByTestId('encounter-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('encounter-builder')).toBeInTheDocument();
        expect(screen.getByTestId('eb-char-count').textContent).toBe('1');
      });

      // NPCs — go back to char-sheet then open NPCs
      fireEvent.click(screen.getByTestId('char-btn-Aragorn'));
      fireEvent.click(screen.getByTestId('npcs-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('npcs-view')).toBeInTheDocument();
        expect(screen.getByTestId('npcs-char-count').textContent).toBe('1');
      });
    });
  });

  describe('View coexistence with overlays', () => {
    it('wizard overlay renders above char-sheet', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('add-character-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    it('switches between views and hides char-sheet', async () => {
      const viewTests = [
        { btn: 'initiative-btn', view: 'initiative' },
        { btn: 'encounter-btn', view: 'encounter-builder' },
        { btn: 'notes-btn', view: 'notes-view' },
        { btn: 'quests-btn', view: 'quests-view' },
        { btn: 'npcs-btn', view: 'npcs-view' },
        { btn: 'factions-btn', view: 'factions-view' },
        { btn: 'settlements-btn', view: 'settlements-view' },
        { btn: 'log-btn', view: 'campaign-log-view' },
      ];

      for (const { btn, view } of viewTests) {
        const { unmount } = render(<App />);
        mockState.characters = [{ name: 'Aragorn', level: 1 }];
        await selectCampaign();
        await waitFor(() => {
          expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByTestId(btn));
        await waitFor(() => {
          expect(screen.getByTestId(view)).toBeInTheDocument();
          expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();
        });
        unmount();
      }
    });
  });

  describe('Map view types', () => {
    it('renders MapsManager when on localhost and maps clicked', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('maps-manager')).toBeInTheDocument();
      });
    });

    it('renders Map when on non-localhost and maps clicked with active map', async () => {
      setNonLocalhost();
      const { loadMaps } = await import('./services/maps/mapsService.js');
      loadMaps.mockResolvedValue({
        maps: [{ fileName: 'dungeon-1.json', isActive: true }],
      });

      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      fireEvent.click(screen.getByTestId('maps-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('map-view')).toBeInTheDocument();
      });
    });
  });

  describe('Sidebar props', () => {
    it('passes campaignName, theme, and localhost to Sidebar', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-campaign').textContent).toBe('test-campaign');
        expect(screen.getByTestId('sidebar-theme').textContent).toBe('dark');
        expect(screen.getByTestId('sidebar-localhost').textContent).toBe('true');
      });
    });
  });

  describe('CharSheet props and interactions', () => {
    it('renders CharSheet with correct character name', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
        expect(screen.getByTestId('character-name').textContent).toBe('Aragorn');
      });
    });

    it('triggers delete confirmation when delete button is clicked', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTitle('Delete Character'));
      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalled();
      });
    });

    it('opens edit wizard when edit button is clicked', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/Edit/));
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
        expect(screen.getByTestId('editing-mode')).toBeInTheDocument();
      });
    });
  });

  describe('Campaign selection flow', () => {
    it('shows wizard when selected campaign has no characters', async () => {
      mockState.characters = [];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();
    });

    it('shows char sheet when selected campaign has characters', async () => {
      mockState.characters = [{ name: 'Aragorn', level: 1 }];
      render(<App />);
      await selectCampaign();
      await waitFor(() => {
        expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('character-wizard')).not.toBeInTheDocument();
    });
  });
});
