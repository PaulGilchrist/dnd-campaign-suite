// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settlements from './Settlements.jsx';

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: vi.fn(() => ({
    items: [],
    loading: false,
    loadItems: vi.fn(),
    saveItems: vi.fn().mockResolvedValue(undefined),
    deleteItem: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: function PreviewToggle({ value, onChange, placeholder, label, id }) {
    return (
      <div className="preview-toggle-wrapper">
        {label && <label htmlFor={id}>{label}</label>}
        <textarea
          data-testid={`preview-toggle-${id}`}
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    );
  },
}));

vi.mock('../../services/campaign/settlementGenerator.js', () => ({
  generateSettlement: vi.fn().mockResolvedValue({
    name: 'Generated Town',
    size: 'town',
    description: 'A bustling town',
    atmosphere: 'Lively',
    government: 'Council',
    population: '1,500 souls',
    services: [],
    notableNPCs: [],
    rumors: [],
    tags: 'generated',
    notes: '',
    threat: 'Bandits',
  }),
}));

import { useEntityManagement } from '../../hooks/useEntityManagement.js';

describe('Settlements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockUseSettlements = {
    items: [],
    loading: false,
    saveItems: vi.fn().mockResolvedValue(undefined),
    deleteItem: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    useEntityManagement.mockReturnValue(mockUseSettlements);
  });

  describe('header and initial render', () => {
    it('renders header with title and back button', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByRole('heading', { name: /settlements/i })).toBeInTheDocument();
      expect(screen.getByText(/back/i)).toBeInTheDocument();
    });

    it('renders new settlement button', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByRole('button', { name: /new settlement/i })).toBeInTheDocument();
    });

    it('renders generate settlement button', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByRole('button', { name: /generate settlement/i })).toBeInTheDocument();
    });

    it('renders search bar', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByLabelText('Search settlements')).toBeInTheDocument();
    });

    it('renders size filter buttons', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByRole('button', { name: /village/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /town/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /city/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /metropolis/i })).toBeInTheDocument();
    });

    it('renders empty state when no settlements exist', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByText(/no settlements yet/i)).toBeInTheDocument();
    });

    it('renders loading state when loading', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        loading: true,
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByText(/loading settlements/i)).toBeInTheDocument();
    });
  });

  describe('settlements list', () => {
    it('renders settlements list when settlements exist', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          {
            name: 'Sample Town',
            size: 'town',
            population: '1,500 souls',
            tags: 'coastal',
            services: [{ type: 'inn', name: 'The Inn' }],
            description: 'A nice town by the sea',
          },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByText('Sample Town')).toBeInTheDocument();
      expect(screen.getByText('1,500 souls')).toBeInTheDocument();
    });

    it('shows service count in settlement list', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'Service Town', size: 'town', population: '', tags: '', services: [{ type: 'inn' }, { type: 'tavern' }], description: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByText(/2 services/i)).toBeInTheDocument();
    });

    it('shows single service count without plural', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'Service Town', size: 'town', population: '', tags: '', services: [{ type: 'inn' }], description: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByText(/1 service/)).toBeInTheDocument();
    });

    it('shows tags when present', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'Tagged Town', size: 'town', population: '', tags: 'coastal, trade', services: [], description: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByText('coastal, trade')).toBeInTheDocument();
    });

    it('shows description preview truncated at 120 chars', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'Long Desc Town', size: 'town', population: '', tags: '', services: [], description: 'A'.repeat(200) },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const listItem = screen.getByRole('button', { name: /edit settlement/i });
      expect(listItem.textContent).toContain('…');
    });

    it('renders size badge for village', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'Village', size: 'village', population: '', tags: '', services: [], description: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByText('village')).toBeInTheDocument();
    });

    it('renders size badge for city', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'City', size: 'city', population: '', tags: '', services: [], description: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByText('city')).toBeInTheDocument();
    });

    it('renders size badge for metropolis', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'Metropolis', size: 'metropolis', population: '', tags: '', services: [], description: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByText('metropolis')).toBeInTheDocument();
    });

    it('handles settlement with no services gracefully', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'No Services', size: 'village', population: '', tags: '', services: null, description: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByText('No Services')).toBeInTheDocument();
    });

    it('handles settlement with empty services array gracefully', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'Empty Services', size: 'village', population: '', tags: '', services: [], description: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByText('Empty Services')).toBeInTheDocument();
    });

    it('renders settlement with no population', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'No Pop', size: 'village', population: null, tags: '', services: [], description: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByText('No Pop')).toBeInTheDocument();
    });

    it('renders settlement with no description', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'No Desc', size: 'village', population: '', tags: '', services: [], description: null },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByText('No Desc')).toBeInTheDocument();
    });

    it('renders settlement with no tags', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'No Tags', size: 'village', population: '', tags: null, services: [], description: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      expect(screen.getByText('No Tags')).toBeInTheDocument();
    });
  });

  describe('filtering', () => {
    it('filters settlements by search query and shows no results for non-matching query', async () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'Fireport', size: 'town', population: '', tags: '', services: [], description: 'A town of fire' },
          { name: 'Iceholm', size: 'village', population: '', tags: '', services: [], description: 'A cold village' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const searchInput = screen.getByLabelText('Search settlements');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
      expect(screen.getByText(/no settlements found matching your filters/i)).toBeInTheDocument();
    });

    it('filters settlements by size', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'Fireport', size: 'town', population: '', tags: '', services: [], description: '' },
          { name: 'Iceholm', size: 'village', population: '', tags: '', services: [], description: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const villageBtn = screen.getByRole('button', { name: /village/i });
      fireEvent.click(villageBtn);
      expect(screen.getByText('Iceholm')).toBeInTheDocument();
      expect(screen.queryByText('Fireport')).not.toBeInTheDocument();
    });

    it('toggles size filter off when clicked again', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'Fireport', size: 'town', population: '', tags: '', services: [], description: '' },
          { name: 'Iceholm', size: 'village', population: '', tags: '', services: [], description: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const villageBtn = screen.getByRole('button', { name: /village/i });
      fireEvent.click(villageBtn);
      fireEvent.click(villageBtn);
      expect(screen.getByText('Fireport')).toBeInTheDocument();
      expect(screen.getByText('Iceholm')).toBeInTheDocument();
    });

    it('shows no settlements matching when search yields no results', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'Fireport', size: 'town', population: '', tags: '', services: [], description: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const searchInput = screen.getByLabelText('Search settlements');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
      expect(screen.getByText(/no settlements found matching your filters/i)).toBeInTheDocument();
    });

    it('shows no settlements matching when size filter yields no results', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'Fireport', size: 'town', population: '', tags: '', services: [], description: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const villageBtn = screen.getByRole('button', { name: /village/i });
      fireEvent.click(villageBtn);
      expect(screen.getByText(/no settlements found matching your filters/i)).toBeInTheDocument();
    });

    it('clears search when clear button is clicked', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'Fireport', size: 'town', population: '', tags: '', services: [], description: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const searchInput = screen.getByLabelText('Search settlements');
      fireEvent.change(searchInput, { target: { value: 'fire' } });
      const clearBtn = screen.getByLabelText('Clear search');
      fireEvent.click(clearBtn);
      expect(searchInput.value).toBe('');
    });
  });

  describe('modal - open and close', () => {
    it('opens modal when new settlement button is clicked', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
    });

    it('opens edit modal when clicking a settlement', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'Edit Me', size: 'village', population: '100 souls', tags: '', services: [], description: '', atmosphere: '', government: '', notableNPCs: [], rumors: [], notes: '', threat: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const settlementItem = screen.getByRole('button', { name: /edit settlement/i });
      fireEvent.click(settlementItem);
      expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
    });

    it('closes modal when cancel button is clicked', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelBtn);
      expect(screen.queryByRole('heading', { name: 'New Settlement' })).not.toBeInTheDocument();
    });

    it('closes modal when close button is clicked', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      const closeBtn = screen.getByLabelText('Close');
      fireEvent.click(closeBtn);
      expect(screen.queryByRole('heading', { name: 'New Settlement' })).not.toBeInTheDocument();
    });
  });

  describe('modal - form fields', () => {
    it('shows size selector in modal', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      expect(screen.getByRole('combobox', { name: /size/i })).toBeInTheDocument();
    });

    it('shows population input in modal', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      expect(screen.getByPlaceholderText(/souls/i)).toBeInTheDocument();
    });

    it('renders services section in modal', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      expect(screen.getByText(/services/i)).toBeInTheDocument();
    });

    it('renders notable NPCs section in modal', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      expect(screen.getByText(/notable npcs/i)).toBeInTheDocument();
    });

    it('renders rumors section in modal', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      expect(screen.getByText(/rumors/i)).toBeInTheDocument();
    });

    it('renders government preview toggle in modal', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      expect(screen.getByText(/government/i)).toBeInTheDocument();
    });

    it('renders description preview toggle in modal', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      expect(screen.getByText(/description/i)).toBeInTheDocument();
    });

    it('renders atmosphere preview toggle in modal', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      expect(screen.getByText(/atmosphere/i)).toBeInTheDocument();
    });

    it('renders tags input in modal', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
    });

    it('renders notes preview toggle in modal', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      expect(screen.getByText(/notes/i)).toBeInTheDocument();
    });
  });

  describe('modal - add/remove items', () => {
    it('allows adding a service', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      const addServiceBtn = screen.getByRole('button', { name: /add service/i });
      fireEvent.click(addServiceBtn);
      expect(screen.getByRole('button', { name: /remove service/i })).toBeInTheDocument();
    });

    it('allows adding an NPC', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      const addNpcBtn = screen.getByRole('button', { name: /add npc/i });
      fireEvent.click(addNpcBtn);
      expect(screen.getByRole('button', { name: /remove npc/i })).toBeInTheDocument();
    });

    it('allows adding a rumor', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      const addRumorBtn = screen.getByRole('button', { name: /add rumor/i });
      fireEvent.click(addRumorBtn);
      expect(screen.getByRole('button', { name: /remove rumor/i })).toBeInTheDocument();
    });

    it('allows removing a service after adding', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      const addServiceBtn = screen.getByRole('button', { name: /add service/i });
      fireEvent.click(addServiceBtn);
      const removeServiceBtn = screen.getByRole('button', { name: /remove service/i });
      fireEvent.click(removeServiceBtn);
      expect(screen.queryByRole('button', { name: /remove service/i })).not.toBeInTheDocument();
    });

    it('allows removing an NPC after adding', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      const addNpcBtn = screen.getByRole('button', { name: /add npc/i });
      fireEvent.click(addNpcBtn);
      const removeNpcBtn = screen.getByRole('button', { name: /remove npc/i });
      fireEvent.click(removeNpcBtn);
      expect(screen.queryByRole('button', { name: /remove npc/i })).not.toBeInTheDocument();
    });

    it('allows removing a rumor after adding', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      const addRumorBtn = screen.getByRole('button', { name: /add rumor/i });
      fireEvent.click(addRumorBtn);
      const removeRumorBtn = screen.getByRole('button', { name: /remove rumor/i });
      fireEvent.click(removeRumorBtn);
      expect(screen.queryByRole('button', { name: /remove rumor/i })).not.toBeInTheDocument();
    });
  });

  describe('modal - save and delete', () => {
    it('saves a new settlement when save is clicked with name', async () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: 'My Settlement' } });
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);
      await waitFor(() => {
        expect(mockUseSettlements.saveItems).toHaveBeenCalled();
      });
    });

    it('does not save when name is empty', async () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);
      expect(mockUseSettlements.saveItems).not.toHaveBeenCalled();
    });

    it('disables save button when name is empty', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      const saveBtn = screen.getByRole('button', { name: /save/i });
      expect(saveBtn).toBeDisabled();
    });

    it('shows delete button when editing a settlement', () => {
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'Delete Me', size: 'village', population: '', tags: '', services: [], description: '', atmosphere: '', government: '', notableNPCs: [], rumors: [], notes: '', threat: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const settlementItem = screen.getByRole('button', { name: /edit settlement/i });
      fireEvent.click(settlementItem);
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('does not show delete button for new settlement', () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const modalOpen = screen.getByRole('button', { name: /new settlement/i });
      fireEvent.click(modalOpen);
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('calls deleteSettlementAction when delete is confirmed', async () => {
      global.window.confirm = vi.fn(() => true);
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'Delete Me', size: 'village', population: '', tags: '', services: [], description: '', atmosphere: '', government: '', notableNPCs: [], rumors: [], notes: '', threat: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const settlementItem = screen.getByRole('button', { name: /edit settlement/i });
      fireEvent.click(settlementItem);
      const deleteBtn = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(deleteBtn);
      await waitFor(() => {
        expect(mockUseSettlements.deleteItem).toHaveBeenCalledWith('Delete Me');
      });
    });

    it('does not delete when user cancels confirmation', async () => {
      global.window.confirm = vi.fn(() => false);
      useEntityManagement.mockReturnValue({
        ...mockUseSettlements,
        items: [
          { name: 'Keep Me', size: 'village', population: '', tags: '', services: [], description: '', atmosphere: '', government: '', notableNPCs: [], rumors: [], notes: '', threat: '' },
        ],
      });
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const settlementItem = screen.getByRole('button', { name: /edit settlement/i });
      fireEvent.click(settlementItem);
      const deleteBtn = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(deleteBtn);
      expect(mockUseSettlements.deleteItem).not.toHaveBeenCalled();
    });
  });

  describe('generate settlement', () => {
    it('generates a settlement when generate button is clicked', async () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const genBtn = screen.getByRole('button', { name: /generate settlement/i });
      fireEvent.click(genBtn);
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
      });
    });

    it('disables generate button while generating', async () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      const genBtn = screen.getByRole('button', { name: /generate settlement/i });
      fireEvent.click(genBtn);
      await waitFor(() => {
        expect(genBtn).toBeDisabled();
      });
    });
  });
});
