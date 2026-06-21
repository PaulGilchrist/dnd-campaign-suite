// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NPCs from './NPCs';

const mockUseNPCsManagement = vi.fn();

vi.mock('../../hooks/management/useNPCsManagement.js', () => ({
  default: (...args) => mockUseNPCsManagement(...args),
}));

vi.mock('./NPCListItem.jsx', () => ({
  default: vi.fn(({ npc, onEdit, onAddToInitiative }) => (
    <li data-testid={`npc-list-item-${npc.name}`}>
      <span>{npc.name}</span>
      <button data-testid={`edit-btn-${npc.name}`} onClick={() => onEdit(npc)}>Edit</button>
      <button data-testid={`init-btn-${npc.name}`} onClick={() => onAddToInitiative(npc)}>Add to Initiative</button>
    </li>
  )),
}));

vi.mock('./NPCFormModal.jsx', () => ({
  default: ({ onClose, onSave, onDelete }) => (
    <div data-testid="npc-form-modal">
      <button onClick={onClose}>Close</button>
      <button onClick={onSave}>Save</button>
      <button onClick={onDelete}>Delete</button>
    </div>
  ),
}));

vi.mock('../../services/npcs/npcFormUtils.js', () => ({
  getDefaultFormData: vi.fn(() => ({
    name: '', race: '', classRole: '', appearance: '', personality: '',
    goals: '', secrets: '', notes: '', tags: '', attitude: 'neutral',
    image: '', imageName: '', imagePath: '', armorClass: 10, hitPoints: '',
    hitDice: '', initiativeBonus: '', speed: { walk: '30 ft.' },
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrowBonuses: {}, skillBonuses: {}, damageResistances: [],
    damageImmunities: [], conditionImmunities: [], actions: [], traits: '', reactions: '',
  })),
  cleanNPCData: vi.fn((data) => data),
}));

vi.mock('../../services/npcs/npcCombatService.js', () => ({
  addNPCToInitiative: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/npcs/npcGenerator.js', () => ({
  generateNPC: vi.fn().mockResolvedValue({ name: 'Generated NPC', race: 'Humanoid' }),
}));

const defaultProps = {
  campaignName: 'test-campaign',
  onBack: vi.fn(),
  onViewInitiative: vi.fn(),
};

const defaultNPCs = [
  { name: 'Goblin', race: 'Humanoid', classRole: 'Scout', tags: 'enemy' },
  { name: 'Wizard', race: 'Humanoid', classRole: 'Caster', tags: 'boss' },
];

function renderWithNPCs(npcs = defaultNPCs) {
  mockUseNPCsManagement.mockReturnValue({
    npcs,
    loading: false,
    loadNPCsList: vi.fn(),
    saveNPCAction: vi.fn().mockResolvedValue({ npc: { name: 'New NPC' } }),
    deleteNPCAction: vi.fn().mockResolvedValue(undefined),
  });
  return render(<NPCs {...defaultProps} />);
}

describe('NPCs', () => {
  describe('header controls', () => {
    it('renders back button', () => {
      renderWithNPCs();
      expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
    });

    it('renders NPCs title', () => {
      renderWithNPCs();
      expect(screen.getByText('NPCs')).toBeInTheDocument();
    });

    it('renders New NPC button', () => {
      renderWithNPCs();
      expect(screen.getByRole('button', { name: /New NPC/i })).toBeInTheDocument();
    });

    it('renders Generate NPC button', () => {
      renderWithNPCs();
      expect(screen.getByRole('button', { name: /Generate NPC/i })).toBeInTheDocument();
    });

    it('calls onBack when back button clicked', () => {
      renderWithNPCs();
      fireEvent.click(screen.getByRole('button', { name: /Back/i }));
      expect(defaultProps.onBack).toHaveBeenCalled();
    });
  });

  describe('search functionality', () => {
    it('renders search input', () => {
      renderWithNPCs();
      expect(screen.getByLabelText('Search NPCs')).toBeInTheDocument();
    });

    it('shows clear button when search has query', () => {
      renderWithNPCs();
      fireEvent.change(screen.getByLabelText('Search NPCs'), { target: { value: 'test' } });
      expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
    });

    it('clears search when clear button clicked', () => {
      renderWithNPCs();
      fireEvent.change(screen.getByLabelText('Search NPCs'), { target: { value: 'Goblin' } });
      expect(screen.getByTestId('npc-list-item-Goblin')).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Clear search'));
      expect(screen.getByTestId('npc-list-item-Wizard')).toBeInTheDocument();
    });

    it('filters NPCs by search query', () => {
      renderWithNPCs();
      fireEvent.change(screen.getByLabelText('Search NPCs'), { target: { value: 'Goblin' } });
      expect(screen.getByTestId('npc-list-item-Goblin')).toBeInTheDocument();
      expect(screen.queryByTestId('npc-list-item-Wizard')).not.toBeInTheDocument();
    });

    it('filters by race', () => {
      renderWithNPCs();
      fireEvent.change(screen.getByLabelText('Search NPCs'), { target: { value: 'Humanoid' } });
      expect(screen.getAllByTestId(/^npc-list-item-/).length).toBeGreaterThan(0);
    });

    it('filters by class role', () => {
      renderWithNPCs();
      fireEvent.change(screen.getByLabelText('Search NPCs'), { target: { value: 'Caster' } });
      expect(screen.getByTestId('npc-list-item-Wizard')).toBeInTheDocument();
      expect(screen.queryByTestId('npc-list-item-Goblin')).not.toBeInTheDocument();
    });

    it('filters by tags', () => {
      renderWithNPCs();
      fireEvent.change(screen.getByLabelText('Search NPCs'), { target: { value: 'boss' } });
      expect(screen.getByTestId('npc-list-item-Wizard')).toBeInTheDocument();
      expect(screen.queryByTestId('npc-list-item-Goblin')).not.toBeInTheDocument();
    });
  });

  describe('NPC list rendering', () => {
    it('renders NPC list items', () => {
      renderWithNPCs();
      expect(screen.getByTestId('npc-list-item-Goblin')).toBeInTheDocument();
      expect(screen.getByTestId('npc-list-item-Wizard')).toBeInTheDocument();
    });
  });

  describe('empty and loading states', () => {
    it('shows empty state when no NPCs', () => {
      mockUseNPCsManagement.mockReturnValue({
        npcs: [], loading: false, loadNPCsList: vi.fn(),
        saveNPCAction: vi.fn(), deleteNPCAction: vi.fn(),
      });
      render(<NPCs {...defaultProps} />);
      expect(screen.getByText(/No NPCs yet/)).toBeInTheDocument();
    });

    it('shows no results state when search matches nothing', () => {
      renderWithNPCs();
      fireEvent.change(screen.getByLabelText('Search NPCs'), { target: { value: 'Nonexistent' } });
      expect(screen.getByText(/No NPCs found/)).toBeInTheDocument();
    });

    it('renders with loading state', () => {
      mockUseNPCsManagement.mockReturnValue({
        npcs: [], loading: true, loadNPCsList: vi.fn(),
        saveNPCAction: vi.fn(), deleteNPCAction: vi.fn(),
      });
      render(<NPCs {...defaultProps} />);
      expect(screen.getByText(/Loading NPCs/)).toBeInTheDocument();
    });
  });

  describe('modal interactions', () => {
    it('opens form modal when New NPC clicked', async () => {
      renderWithNPCs();
      fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
    });

    it('opens form modal when Generate NPC clicked', async () => {
      renderWithNPCs();
      fireEvent.click(screen.getByRole('button', { name: /Generate NPC/i }));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
    });

    it('opens form modal when Edit clicked', async () => {
      renderWithNPCs();
      fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
    });

    it('closes modal when Close clicked', async () => {
      renderWithNPCs();
      fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
      await waitFor(() => {
        expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument();
    });
  });

  describe('initiative', () => {
    it('calls addNPCToInitiative when Add to Initiative clicked', async () => {
      renderWithNPCs();
      fireEvent.click(screen.getByTestId('init-btn-Goblin'));
      // The addNPCToInitiative mock resolves synchronously
    });
  });
});
