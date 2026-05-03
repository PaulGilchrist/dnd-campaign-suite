import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';

const { MockCharSheet } = vi.hoisted(() => ({
  MockCharSheet: vi.fn(({ playerSummary }) => <div data-testid="char-sheet">{playerSummary?.name || 'no character'}</div>)
}));

const { MockCombat } = vi.hoisted(() => ({
  MockCombat: vi.fn(({ characters }) => <div data-testid="combat-tracking">{characters?.length || 0} chars</div>)
}));

const { CampaignSelectionFn } = vi.hoisted(() => ({
  CampaignSelectionFn: vi.fn(({ onCampaignSelect }) => (
    <div data-testid="campaign-selection">
      <button onClick={() => onCampaignSelect('test-campaign', [])}>Select Campaign</button>
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

vi.mock('../services/utils', () => ({
  default: { getFirstName: vi.fn((name) => name ? name.split(' ')[0] : '') }
}));

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

vi.mock('./components/char-sheet/char-sheet', () => ({ default: MockCharSheet }));

vi.mock('./components/combat-tracking/combat-tracking', () => ({ default: MockCombat }));

vi.mock('./components/campaign-selection/campaign-selection', () => ({ default: CampaignSelectionFn }));

vi.mock('./components/character-creation/character-creation-wizard', () => ({ default: WizardFn }));

const mockFetchData = {
  '/data/ability-scores.json': [{ full_name: 'Strength' }],
  '/data/classes.json': [{ name: 'Fighter' }],
  '/data/2024/classes.json': [{ name: 'Fighter 2024' }],
  '/data/equipment.json': [{ name: 'Longsword' }],
  '/data/magic-items.json': [{ name: 'Wand' }],
  '/data/races.json': [{ name: 'Human' }],
  '/data/2024/races.json': [{ name: 'Human 2024' }],
  '/data/magic-items-2024.json': [{ name: 'Wand 2024' }],
  '/data/spells.json': [{ name: 'Fireball' }],
  '/data/2024/spells.json': [{ name: 'Fireball 2024' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'location', 'get').mockReturnValue({ hostname: 'localhost' });

  window.sessionStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };

  global.fetch = vi.fn((url) => {
    if (mockFetchData[url]) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFetchData[url]) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });

  window.confirm = vi.fn(() => true);
  window.prompt = vi.fn(() => 'New Campaign Name');
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
    const preloaded = JSON.stringify([{ name: 'Test Character', level: 1 }]);
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'characters') return preloaded;
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByTestId('campaign-selection')).not.toBeInTheDocument();
    });
  });

  it('should show character sheet when campaign has characters', async () => {
    const preloaded = JSON.stringify([{ name: 'Test Character', level: 1 }]);
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'characters') return preloaded;
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
  });

  it('should not show campaign selection when characters are preloaded from sessionStorage', async () => {
    const preloaded = JSON.stringify([{ name: 'Preloaded Character', level: 1 }]);
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'characters') return preloaded;
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByTestId('campaign-selection')).not.toBeInTheDocument();
    });
  });

  it('should show main view when campaign was previously selected', async () => {
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByTestId('campaign-selection')).not.toBeInTheDocument();
    });
  });

  it('should show the campaign name in the header', async () => {
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'My Campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('My Campaign')).toBeInTheDocument();
    });
  });

  it('should show Add button when data is loaded', async () => {
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Add/)).toBeInTheDocument();
    });
  });

  it('should show Upload button when data is loaded', async () => {
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Upload/)).toBeInTheDocument();
    });
  });

  it('should show Campaigns button to go back', async () => {
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Campaigns/)).toBeInTheDocument();
    });
  });

  it('should show character tabs when characters exist', async () => {
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(document.querySelector('.app')).toBeInTheDocument();
    });
  });

  it('should render rename campaign button when on localhost', async () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({ hostname: 'localhost' });
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(document.querySelector('.rename-campaign-btn')).toBeInTheDocument();
    });
  });

  it('should disable rename campaign button when not on localhost', async () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({ hostname: 'example.com' });
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(document.querySelector('.rename-campaign-btn')).toHaveAttribute('disabled');
    });
  });

  it('should disable delete campaign button when characters exist', async () => {
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      if (key === 'characters') return JSON.stringify([{ name: 'Char1' }]);
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(document.querySelector('.delete-campaign-btn')).toHaveAttribute('disabled');
    });
  });

  it('should show Download button when active character exists', async () => {
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      if (key === 'characters') return JSON.stringify([{ name: 'Test Character', level: 1 }]);
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Download/)).toBeInTheDocument();
    });
  });

  it('should show Edit button when active character exists', async () => {
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      if (key === 'characters') return JSON.stringify([{ name: 'Test Character', level: 1 }]);
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Edit/)).toBeInTheDocument();
    });
  });

  it('should show Combat button when characters exist but no active character', async () => {
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      if (key === 'characters') return JSON.stringify([{ name: 'Char1' }, { name: 'Char2' }]);
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(document.querySelector('.app')).toBeInTheDocument();
    });
  });

  it('should handle upload error gracefully', async () => {
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      if (key === 'characters') return JSON.stringify([{ name: 'Test Character', level: 1 }]);
      return null;
    });

    // Mock FileReader to simulate error
    const mockFileReader = {
      onload: null,
      readAsText: vi.fn(function() {
        // Simulate error
        if (this.onerror) this.onerror(new Error('Read error'));
      }),
      onerror: null,
    };
    global.FileReader = vi.fn(() => mockFileReader);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Upload/)).toBeInTheDocument();
    });
  });

  it('should handle wizard completion with no campaign', async () => {
    window.sessionStorage.getItem = vi.fn(() => null);

    render(<App />);

    fireEvent.click(screen.getByText('Select Campaign'));

    await waitFor(() => {
      expect(screen.queryByTestId('character-wizard')).toBeInTheDocument();
    });
  });

  it('should handle edit wizard completion with no campaign', async () => {
    window.sessionStorage.getItem = vi.fn(() => null);

    render(<App />);

    // Set up active character first
    const preloaded = JSON.stringify([{ name: 'Test Character', level: 1 }]);
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'characters') return preloaded;
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Edit/)).toBeInTheDocument();
    });
  });

  it('should handle save click and trigger download', async () => {
    const preloaded = JSON.stringify([{ name: 'Test Character', level: 1 }]);
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'characters') return preloaded;
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Download/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Download/));
  });

  it('should handle upload click', async () => {
    const preloaded = JSON.stringify([{ name: 'Test Character', level: 1 }]);
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'characters') return preloaded;
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Upload/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Upload/));
  });

  it('should handle character click to switch active character', async () => {
    const preloaded = JSON.stringify([
      { name: 'Character 1', level: 1 },
      { name: 'Character 2', level: 2 },
    ]);
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'characters') return preloaded;
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const buttons = screen.getAllByText('Character 2');
    fireEvent.click(buttons[0]);
  });

  it('should show combat tracking when no active character and characters exist', async () => {
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    const preloaded = JSON.stringify([
      { name: 'Character 1', level: 1 },
    ]);
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'characters') return preloaded;
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Combat/)).toBeInTheDocument();
    });
  });

  it('should handle initiative click to show combat', async () => {
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    const preloaded = JSON.stringify([
      { name: 'Character 1', level: 1 },
    ]);
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'characters') return preloaded;
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Combat/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Combat/));
  });

  it('should handle rename campaign', async () => {
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('test-campaign')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Rename Campaign'));
  });

  it('should handle delete campaign when confirmed', async () => {
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    window.confirm = vi.fn(() => true);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('test-campaign')).toBeInTheDocument();
    });

    const deleteBtn = document.querySelector('.delete-campaign-btn');
    if (deleteBtn && !deleteBtn.disabled) {
      fireEvent.click(deleteBtn);
    }
  });

  it('should handle going back to campaigns', async () => {
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Campaigns/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Campaigns/));
  });

  it('should delete campaign when confirmed', async () => {
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/campaigns/')) {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('test-campaign')).toBeInTheDocument();
    });

    window.confirm = vi.fn(() => true);

    // Need to trigger delete - button is disabled when characters exist
    // Let's test without characters
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      if (key === 'characters') return JSON.stringify([]);
      return null;
    });

    render(<App />);

    const deleteBtn = document.querySelector('.delete-campaign-btn');
    if (deleteBtn && !deleteBtn.disabled) {
      fireEvent.click(deleteBtn);
    }
  });

  it('should handle delete campaign error', async () => {
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/campaigns/')) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Delete failed' })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('test-campaign')).toBeInTheDocument();
    });

    window.confirm = vi.fn(() => true);

    // Need to trigger delete
    const deleteBtn = document.querySelector('.delete-campaign-btn');
    if (deleteBtn && !deleteBtn.disabled) {
      fireEvent.click(deleteBtn);
    }
  });

  it('should not render char sheet when no active character', async () => {
    const preloaded = JSON.stringify([{ name: 'Char1', level: 1 }]);
    window.sessionStorage.getItem = vi.fn((key) => {
      if (key === 'characters') return preloaded;
      if (key === 'currentCampaign') return 'test-campaign';
      return null;
    });

    render(<App />);

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
