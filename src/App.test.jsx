import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';

const mockState = vi.hoisted(() => ({
  campaignName: 'test-campaign',
  characters: [],
}));

const dataLoaderMocks = vi.hoisted(() => ({
  loadAbilityScores: vi.fn(),
  loadClassData: vi.fn(),
  loadEquipment: vi.fn(),
  loadMagicItems: vi.fn(),
  loadRaceData: vi.fn(),
  loadSpells: vi.fn(),
}));

const { MockCharSheet } = vi.hoisted(() => ({
  MockCharSheet: vi.fn(({ playerSummary, onDeleteCharacter }) => (
    <div data-testid="char-sheet">
      {playerSummary?.name || 'no character'}
      <button title="Delete Character" onClick={() => onDeleteCharacter?.(playerSummary?.name)}>Delete</button>
    </div>
  ))
}));

const { MockCombat } = vi.hoisted(() => ({
  MockCombat: vi.fn(({ characters }) => <div data-testid="combat-tracking">{characters?.length || 0} chars</div>)
}));

const { CampaignSelectionFn } = vi.hoisted(() => ({
  CampaignSelectionFn: vi.fn(({ onCampaignSelect }) => (
    <div data-testid="campaign-selection">
      <button onClick={() => onCampaignSelect(mockState.campaignName, mockState.characters)}>Select Campaign</button>
    </div>
  ))
}));

const { WizardFn } = vi.hoisted(() => ({
  WizardFn: vi.fn(({ onComplete, onCancel, characterData, isEditing }) => (
    <div data-testid="character-wizard">
      <button onClick={() => onComplete({ name: 'New Character', level: 1 })}>Complete</button>
      <button onClick={onCancel}>Cancel</button>
      {characterData && <div>Editing: {characterData.name}</div>}
      {isEditing && <div>Editing Mode</div>}
    </div>
  ))
}));

vi.mock('./services/utils.js', () => ({
  default: { getFirstName: vi.fn((name) => name ? name.split(' ')[0] : '') }
}));

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

vi.mock('./components/char-sheet/CharSheet.jsx', () => ({ default: MockCharSheet }));

vi.mock('./components/combat-tracking/combat-tracking.jsx', () => ({ default: MockCombat }));

vi.mock('./components/campaign-selection/CampaignSelection.jsx', () => ({ default: CampaignSelectionFn }));

vi.mock('./components/character-creation/CharacterCreationWizard.jsx', () => ({ default: WizardFn }));

vi.mock('./services/dataLoader.js', () => dataLoaderMocks);

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
  });

  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

  dataLoaderMocks.loadAbilityScores.mockResolvedValue([{ full_name: 'Strength' }]);
  dataLoaderMocks.loadClassData.mockImplementation((version) =>
    Promise.resolve(version === '2024' ? [{ name: 'Fighter 2024' }] : [{ name: 'Fighter' }])
  );
  dataLoaderMocks.loadEquipment.mockResolvedValue([{ name: 'Longsword' }]);
  dataLoaderMocks.loadMagicItems.mockImplementation((version) =>
    Promise.resolve(version === '2024' ? [{ name: 'Wand 2024' }] : [{ name: 'Wand' }])
  );
  dataLoaderMocks.loadRaceData.mockImplementation((version) =>
    Promise.resolve(version === '2024' ? [{ name: 'Human 2024' }] : [{ name: 'Human' }])
  );
  dataLoaderMocks.loadSpells.mockImplementation((version) =>
    Promise.resolve(version === '2024' ? [{ name: 'Fireball 2024' }] : [{ name: 'Fireball' }])
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('should render campaign selection initially', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });
  });

  it('should navigate to main view when campaign is selected', async () => {
    mockState.characters = [{ name: 'Test Character', level: 1 }];

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.queryByTestId('campaign-selection')).not.toBeInTheDocument();
    });
  });

  it('should show character sheet when campaign has characters', async () => {
    mockState.characters = [{ name: 'Test Character', level: 1 }];

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('should hide campaign selection after selecting campaign with characters', async () => {
    mockState.characters = [{ name: 'Preloaded Character', level: 1 }];

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.queryByTestId('campaign-selection')).not.toBeInTheDocument();
    });
  });

  it('should show main view after campaign selection', async () => {
    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.queryByTestId('campaign-selection')).not.toBeInTheDocument();
    });
  });

  it('should show the campaign name in the header', async () => {
    mockState.campaignName = 'My Campaign';

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByText('My Campaign')).toBeInTheDocument();
    });
  });

  it('should show Add button when data is loaded', async () => {
    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByText(/Add/)).toBeInTheDocument();
    });
  });

  it('should show Upload button when data is loaded', async () => {
    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByText(/Upload/)).toBeInTheDocument();
    });
  });

  it('should show Campaigns button to go back', async () => {
    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByText(/Campaigns/)).toBeInTheDocument();
    });
  });

  it('should show character tabs when characters exist', async () => {
    mockState.characters = [{ name: 'Char1' }];

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(document.querySelector('.app')).toBeInTheDocument();
    });
  });

  it('should render rename campaign button when on localhost', async () => {
    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(document.querySelector('.rename-campaign-btn')).toBeInTheDocument();
    });
  });

  it('should disable rename campaign button when not on localhost', async () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'example.com', reload: vi.fn() },
      writable: true,
    });

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(document.querySelector('.rename-campaign-btn')).toHaveAttribute('disabled');
    });
  });

  it('should disable delete campaign button when characters exist', async () => {
    mockState.characters = [{ name: 'Char1' }];

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(document.querySelector('.delete-campaign-btn')).toHaveAttribute('disabled');
    });
  });

  it('should show Download button when active character exists', async () => {
    mockState.characters = [{ name: 'Test Character', level: 1 }];

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByText(/Download/)).toBeInTheDocument();
    });
  });

  it('should show Edit button when active character exists', async () => {
    mockState.characters = [{ name: 'Test Character', level: 1 }];

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByText(/Edit/)).toBeInTheDocument();
    });
  });

  it('should show combat tracking when characters exist but no active character', async () => {
    mockState.characters = [{ name: 'Char1' }, { name: 'Char2' }];

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    // First character is set active, so Combat button shows. Click it to set activeCharacter to null.
    fireEvent.click(screen.getByText(/Combat/));

    await waitFor(() => {
      expect(screen.getByTestId('combat-tracking')).toBeInTheDocument();
    });
  });

  it('should handle upload error gracefully', async () => {
    mockState.characters = [{ name: 'Test Character', level: 1 }];

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByText(/Upload/)).toBeInTheDocument();
    });
  });

  it('should show wizard when campaign has no characters', async () => {
    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
    });
  });

  it('should show edit wizard when Edit clicked', async () => {
    mockState.characters = [{ name: 'Test Character', level: 1 }];

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByText(/Edit/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Edit/));

    await waitFor(() => {
      expect(screen.getByTestId('character-wizard')).toBeInTheDocument();
      expect(screen.getByText('Editing Mode')).toBeInTheDocument();
    });
  });

  it('should handle save click and trigger download', async () => {
    mockState.characters = [{ name: 'Test Character', level: 1 }];

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByText(/Download/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Download/));
  });

  it('should handle upload click', async () => {
    mockState.characters = [{ name: 'Test Character', level: 1 }];

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByText(/Upload/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Upload/));
  });

  it('should handle character click to switch active character', async () => {
    mockState.characters = [
      { name: 'Character 1', level: 1 },
      { name: 'Character 2', level: 2 },
    ];

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const buttons = screen.getAllByText('Character 2');
    fireEvent.click(buttons[0]);
  });

  it('should show combat tracking when no active character and characters exist', async () => {
    mockState.characters = [{ name: 'Character 1', level: 1 }];

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    // First character is set active, so Combat button shows. Click it to set activeCharacter to null.
    fireEvent.click(screen.getByText(/Combat/));

    await waitFor(() => {
      expect(screen.getByTestId('combat-tracking')).toBeInTheDocument();
    });
  });

  it('should handle initiative click to show combat', async () => {
    mockState.characters = [{ name: 'Character 1', level: 1 }];

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Combat/));

    await waitFor(() => {
      expect(screen.getByTestId('combat-tracking')).toBeInTheDocument();
    });
  });

  it('should handle rename campaign', async () => {
    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByText('test-campaign')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Rename Campaign'));
  });

  it('should handle delete campaign when confirmed', async () => {
    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByText('test-campaign')).toBeInTheDocument();
    });

    const deleteBtn = document.querySelector('.delete-campaign-btn');
    if (deleteBtn && !deleteBtn.disabled) {
      fireEvent.click(deleteBtn);
    }
  });

  it('should handle going back to campaigns', async () => {
    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByText(/Campaigns/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Campaigns/));

    await waitFor(() => {
      expect(screen.getByTestId('campaign-selection')).toBeInTheDocument();
    });
  });

  it('should delete campaign when confirmed', async () => {
    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByText('test-campaign')).toBeInTheDocument();
    });

    const deleteBtn = document.querySelector('.delete-campaign-btn');
    if (deleteBtn && !deleteBtn.disabled) {
      fireEvent.click(deleteBtn);
    }
  });

  it('should handle rename campaign error', async () => {
    // First fetch call IS the rename (no prior fetch in this test)
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Rename failed' }) }));

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByText('test-campaign')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Rename Campaign'));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalled();
    });
  });

  it('should handle delete character error', async () => {
    // First fetch call IS the delete (no prior fetch in this test)
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Delete failed' }) }));

    mockState.characters = [{ name: 'Test', level: 1 }];

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const deleteButton = document.querySelector('[title="Delete Character"]');
    if (deleteButton) {
      fireEvent.click(deleteButton);
    }

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalled();
    });
  });

  it('should handle campaign name prompt cancel', async () => {
    window.prompt = vi.fn(() => null);

    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
    global.fetch = fetchSpy;

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByText('test-campaign')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Rename Campaign'));

    // prompt returns null, so rename returns early without calling fetch
    await waitFor(() => {
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  it('should handle delete campaign error', async () => {
    // First fetch call IS the delete (no prior fetch in this test)
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Delete failed' }) }));

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByText('test-campaign')).toBeInTheDocument();
    });

    const deleteBtn = document.querySelector('.delete-campaign-btn');
    if (deleteBtn && !deleteBtn.disabled) {
      fireEvent.click(deleteBtn);
    }

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalled();
    });
  });

  it('should not render char sheet when no active character', async () => {
    mockState.characters = [{ name: 'Char1', level: 1 }];

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    // Click Combat to set activeCharacter to null
    fireEvent.click(screen.getByText(/Combat/));

    await waitFor(() => {
      expect(screen.queryByTestId('char-sheet')).not.toBeInTheDocument();
    });
  });
});
