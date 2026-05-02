import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CharActions from './char-actions';

// Mock the usePopup hook
vi.mock('./common/use-popup', () => ({
  default: vi.fn(),
}));

// Mock sanitizeHtml
vi.mock('../../services/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

// Mock fetch for actions.json
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

import usePopup from './common/use-popup';

const mockPlayerStats = {
  rules: '5e',
  attacks: [
    {
      name: 'Longsword',
      range: 5,
      hitBonus: 5,
      hitBonusFormula: '+5 to hit',
      damage: '1d8+3',
      damageFormula: '1d8+3 slashing',
      damageType: 'Slashing',
      type: 'Action',
       },
     ],
  actions: [
    {
      name: 'Dash',
      description: 'You focus on movement',
      details: 'Your speed doubles',
       },
     ],
  bonusActions: [
    {
      name: 'Cunning Action',
      description: 'You can take a bonus action',
      details: 'Dash, Hide, or Disengage',
       },
     ],
  equipment: [
    {
      name: 'Longsword',
      equipment_category: 'Weapon',
      mastery: 'Piercing',
       },
     ],
};

describe('CharActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
     
     // Mock fetch for actions.json
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(['Dash', 'Disengage', 'Dodge', 'Hide', 'Withdraw']),
     });
      
      // Mock usePopup
    usePopup.mockImplementation((buildHtml) => ({
      showPopup: vi.fn(),
      PopupElement: null,
      setPopupHtml: vi.fn(),
      }));
    });

  afterEach(() => {
    vi.restoreAllMocks();
    });

  it('should render Actions section header', async () => {
    render(<CharActions playerStats={mockPlayerStats} />);

    expect(screen.getByText('Actions')).toBeInTheDocument();
    });

  it('should display attack headers', async () => {
    render(<CharActions playerStats={mockPlayerStats} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Range')).toBeInTheDocument();
    expect(screen.getByText('Hit')).toBeInTheDocument();
    expect(screen.getByText('Damage')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    });

  it('should display attack details', async () => {
    render(<CharActions playerStats={mockPlayerStats} />);

    expect(screen.getByText('Longsword')).toBeInTheDocument();
    expect(screen.getByText('5 ft.')).toBeInTheDocument();
    expect(screen.getByText('1d8+3')).toBeInTheDocument();
    expect(screen.getByText('Slashing')).toBeInTheDocument();
    });

  it('should display actions list', async () => {
    render(<CharActions playerStats={mockPlayerStats} />);

    expect(screen.getByText(/Dash:/)).toBeInTheDocument();
    });

  it('should display bonus actions section', async () => {
    render(<CharActions playerStats={mockPlayerStats} />);

    expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });

  it('should call setPopupHtml when hit bonus is clicked', async () => {
    const mockSetPopupHtml = vi.fn();
    usePopup.mockImplementation((buildHtml) => ({
      showPopup: vi.fn(),
      PopupElement: null,
      setPopupHtml: mockSetPopupHtml,
      }));

    render(<CharActions playerStats={mockPlayerStats} />);

    const hitBonusElement = screen.getByText('+5');
    fireEvent.click(hitBonusElement);

    expect(mockSetPopupHtml).toHaveBeenCalledWith('+5 to hit');
    });

  it('should call setPopupHtml when damage is clicked', async () => {
    const mockSetPopupHtml = vi.fn();
    usePopup.mockImplementation((buildHtml) => ({
      showPopup: vi.fn(),
      PopupElement: null,
      setPopupHtml: mockSetPopupHtml,
      }));

    render(<CharActions playerStats={mockPlayerStats} />);

    const damageElement = screen.getByText('1d8+3');
    fireEvent.click(damageElement);

    expect(mockSetPopupHtml).toHaveBeenCalledWith('1d8+3 slashing');
    });

  it('should not show Mastery column for 5e rules', async () => {
    render(<CharActions playerStats={mockPlayerStats} />);

    const masteryHeaders = screen.queryAllByText('Mastery');
    expect(masteryHeaders).toHaveLength(0);
    });

  it('should show Mastery column for 2024 rules', async () => {
    const stats2024 = {
      ...mockPlayerStats,
      rules: '2024',
      attacks: [
        {
          ...mockPlayerStats.attacks[0],
          type: 'Action',
          },
        ],
      equipment: [
        {
          name: 'Longsword',
          equipment_category: 'Weapon',
          mastery: 'Piercing',
          },
        ],
     };

    render(<CharActions playerStats={stats2024} />);

    expect(screen.getByText('Mastery')).toBeInTheDocument();
    });

  it('should display weapon mastery for 2024 rules', async () => {
    const stats2024 = {
      ...mockPlayerStats,
      rules: '2024',
      attacks: [
        {
          ...mockPlayerStats.attacks[0],
          type: 'Action',
          },
        ],
      equipment: [
        {
          name: 'Longsword',
          equipment_category: 'Weapon',
          mastery: 'Piercing',
          },
        ],
     };

    render(<CharActions playerStats={stats2024} />);

    expect(screen.getByText('Piercing')).toBeInTheDocument();
    });

  it('should handle empty attacks array', async () => {
    const emptyStats = {
      ...mockPlayerStats,
      attacks: [],
      actions: [],
      bonusActions: [],
     };

    render(<CharActions playerStats={emptyStats} />);

    expect(screen.getByText('Actions')).toBeInTheDocument();
    });

  it('should handle bonus action attacks', async () => {
    const statsWithBonusAttack = {
      ...mockPlayerStats,
      attacks: [
        {
          name: 'Handaxe',
          range: 20,
          hitBonus: 3,
          hitBonusFormula: null,
          damage: '1d6+2',
          damageFormula: null,
          damageType: 'Slashing',
          type: 'Bonus Action',
          },
        ],
      actions: [],
      bonusActions: [],
     };

    render(<CharActions playerStats={statsWithBonusAttack} />);

    expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    expect(screen.getByText('Handaxe')).toBeInTheDocument();
    });

  it('should load base actions from API', async () => {
    render(<CharActions playerStats={mockPlayerStats} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/data/actions.json');
     });
    });

  it('should display base actions after loading', async () => {
    render(<CharActions playerStats={mockPlayerStats} />);

    await waitFor(() => {
      expect(screen.getByText(/Base Actions:/)).toBeInTheDocument();
     });
    });

  it('should sanitize action descriptions', async () => {
    const { sanitizeHtml } = await import('../../services/sanitize.js');

    render(<CharActions playerStats={mockPlayerStats} />);

    expect(screen.getByText(/You focus on movement/)).toBeInTheDocument();
    });

  it('should show popup when action with details is clicked', async () => {
    const mockShowPopup = vi.fn();
    usePopup.mockImplementation((buildHtml) => ({
      showPopup: mockShowPopup,
      PopupElement: null,
      setPopupHtml: vi.fn(),
      }));

    render(<CharActions playerStats={mockPlayerStats} />);

    const actionElement = screen.getByText(/Dash:/);
    fireEvent.click(actionElement);

    expect(mockShowPopup).toHaveBeenCalled();
    });
});