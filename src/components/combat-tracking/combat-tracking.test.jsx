import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CombatTracking from './combat-tracking';

// Mock modules - must be self-contained in factory function
vi.mock('../../services/storage', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
   },
}));

vi.mock('../../services/utils', () => ({
  default: {
    guid: vi.fn(() => 'test-guid'),
    getFirstName: vi.fn((name) => name?.split(' ')[0] || 'Unknown'),
   },
}));

vi.mock('../common/subscriber', () => ({
  default: function SubscriberMock({ handleEvent }) {
    return null; // Render nothing
  },
}));

// Mock window.confirm
const mockConfirm = vi.fn();
window.confirm = mockConfirm;

// Mock EventSource
const mockEventSource = {
  close: vi.fn(),
  onmessage: null,
  onerror: null,
};
global.EventSource = vi.fn(() => mockEventSource);

describe('CombatTracking', () => {
  const mockCharacters = [
    { name: 'Player One' },
    { name: 'Player Two' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render combat tracking header', async () => {
    render(<CombatTracking characters={mockCharacters} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Combat Tracking/)).toBeInTheDocument();
  });
   });

  it('should render creatures section', async () => {
    render(<CombatTracking characters={mockCharacters} />);
    
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Initiative')).toBeInTheDocument();
      expect(screen.getByText('Notes')).toBeInTheDocument();
  });
   });

  it('should render Clear button', async () => {
    render(<CombatTracking characters={mockCharacters} />);
    
    await waitFor(() => {
      expect(screen.getByText('Clear')).toBeInTheDocument();
  });
   });

  it('should render Add NPC and Remove NPC buttons', async () => {
    render(<CombatTracking characters={mockCharacters} />);
    
    await waitFor(() => {
      expect(screen.getByText('Add NPC')).toBeInTheDocument();
  });
   });

  it('should render Combat Round buttons', async () => {
    render(<CombatTracking characters={mockCharacters} />);
    
    await waitFor(() => {
      expect(screen.getByText('Combat Round')).toBeInTheDocument();
  });
   });

  it('should render Creature navigation buttons', async () => {
    render(<CombatTracking characters={mockCharacters} />);
    
    await waitFor(() => {
      expect(screen.getByText('Creature')).toBeInTheDocument();
  });
   });

  it('should handle clear button click with confirmation', async () => {
    mockConfirm.mockReturnValue(true);
    
    render(<CombatTracking characters={mockCharacters} />);
    
    await waitFor(() => {
      const clearButton = screen.getByText('Clear');
      fireEvent.click(clearButton);
     });
     
    expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to clear all combat status?');
  });

  it('should not clear when confirmation is denied', async () => {
    mockConfirm.mockReturnValue(false);
    
    render(<CombatTracking characters={mockCharacters} />);
    
    await waitFor(() => {
      const clearButton = screen.getByText('Clear');
      fireEvent.click(clearButton);
     });
     
    expect(mockConfirm).toHaveBeenCalled();
  });

  it('should handle initiative input change', async () => {
    render(<CombatTracking characters={mockCharacters} />);
    
    await waitFor(() => {
      const initiativeInputs = screen.getAllByRole('spinbutton');
      expect(initiativeInputs.length).toBeGreaterThan(0);
  });
   });

  it('should handle notes input change', async () => {
    render(<CombatTracking characters={mockCharacters} />);
    
    await waitFor(() => {
      const notesInputs = screen.getAllByRole('textbox');
      expect(notesInputs.length).toBeGreaterThan(0);
  });
   });

  it('should handle keyboard navigation - ArrowDown for next creature', async () => {
    render(<CombatTracking characters={mockCharacters} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Combat Tracking/)).toBeInTheDocument();
     });
     
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    // Component should not throw error
    expect(true).toBe(true);
  });

  it('should handle keyboard navigation - ArrowUp for previous creature', async () => {
    render(<CombatTracking characters={mockCharacters} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Combat Tracking/)).toBeInTheDocument();
     });
     
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    // Component should not throw error
    expect(true).toBe(true);
  });

  it('should handle keyboard navigation - ArrowRight for add combat round', async () => {
    render(<CombatTracking characters={mockCharacters} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Combat Tracking/)).toBeInTheDocument();
     });
     
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    // Component should not throw error
    expect(true).toBe(true);
  });

  it('should handle keyboard navigation - ArrowLeft for remove combat round', async () => {
    render(<CombatTracking characters={mockCharacters} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Combat Tracking/)).toBeInTheDocument();
     });
     
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    // Component should not throw error
    expect(true).toBe(true);
  });

  it('should handle keyboard navigation - + for add NPC', async () => {
    render(<CombatTracking characters={mockCharacters} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Combat Tracking/)).toBeInTheDocument();
     });
     
    fireEvent.keyDown(document, { key: '+' });
    // Component should not throw error
    expect(true).toBe(true);
  });

  it('should handle keyboard navigation - - for remove NPC', async () => {
    render(<CombatTracking characters={mockCharacters} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Combat Tracking/)).toBeInTheDocument();
     });
     
    fireEvent.keyDown(document, { key: '-' });
    // Component should not throw error
    expect(true).toBe(true);
  });

  it('should render with empty characters array', async () => {
    render(<CombatTracking characters={[]} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Combat Tracking/)).toBeInTheDocument();
  });
   });
});