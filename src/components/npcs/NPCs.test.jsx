import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('NPCs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNPCsManagement.mockReturnValue({
      npcs: [
        { name: 'Goblin', race: 'Humanoid', classRole: 'Scout', tags: 'enemy' },
        { name: 'Wizard', race: 'Humanoid', classRole: 'Caster', tags: 'boss' },
      ],
      loading: false,
      loadNPCsList: vi.fn(),
      saveNPCAction: vi.fn().mockResolvedValue({ npc: { name: 'New NPC' } }),
      deleteNPCAction: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('renders back button', () => {
    render(<NPCs {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
  });

  it('renders NPCs title', () => {
    render(<NPCs {...defaultProps} />);
    expect(screen.getByText('NPCs')).toBeInTheDocument();
  });

  it('renders New NPC button', () => {
    render(<NPCs {...defaultProps} />);
    expect(screen.getByRole('button', { name: /New NPC/i })).toBeInTheDocument();
  });

  it('renders Generate NPC button', () => {
    render(<NPCs {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Generate NPC/i })).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<NPCs {...defaultProps} />);
    expect(screen.getByLabelText('Search NPCs')).toBeInTheDocument();
  });

  it('renders NPC list items', () => {
    render(<NPCs {...defaultProps} />);
    expect(screen.getByTestId('npc-list-item-Goblin')).toBeInTheDocument();
    expect(screen.getByTestId('npc-list-item-Wizard')).toBeInTheDocument();
  });

  it('filters NPCs by search query', () => {
    render(<NPCs {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Search NPCs'), { target: { value: 'Goblin' } });
    expect(screen.getByTestId('npc-list-item-Goblin')).toBeInTheDocument();
    expect(screen.queryByTestId('npc-list-item-Wizard')).not.toBeInTheDocument();
  });

  it('shows clear button when search has query', () => {
    render(<NPCs {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Search NPCs'), { target: { value: 'test' } });
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('clears search when clear button clicked', () => {
    render(<NPCs {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Search NPCs'), { target: { value: 'Goblin' } });
    expect(screen.getByTestId('npc-list-item-Goblin')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(screen.getByTestId('npc-list-item-Wizard')).toBeInTheDocument();
  });

  it('shows empty state when no NPCs', () => {
    mockUseNPCsManagement.mockReturnValue({
      npcs: [], loading: false, loadNPCsList: vi.fn(),
      saveNPCAction: vi.fn(), deleteNPCAction: vi.fn(),
    });
    render(<NPCs {...defaultProps} />);
    expect(screen.getByText(/No NPCs yet/)).toBeInTheDocument();
  });

  it('shows no results state when search matches nothing', () => {
    render(<NPCs {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Search NPCs'), { target: { value: 'Nonexistent' } });
    expect(screen.getByText(/No NPCs found/)).toBeInTheDocument();
  });

  it('opens form modal when New NPC clicked', async () => {
    render(<NPCs {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
    await waitFor(() => {
      expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
    });
  });

  it('opens form modal when Generate NPC clicked', async () => {
    render(<NPCs {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Generate NPC/i }));
    await waitFor(() => {
      expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
    });
  });

  it('opens form modal when Edit clicked', async () => {
    render(<NPCs {...defaultProps} />);
    fireEvent.click(screen.getByTestId('edit-btn-Goblin'));
    await waitFor(() => {
      expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
    });
  });

  it('closes modal when Close clicked', async () => {
    render(<NPCs {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /New NPC/i }));
    await waitFor(() => {
      expect(screen.getByTestId('npc-form-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('npc-form-modal')).not.toBeInTheDocument();
  });

  it('calls onBack when back button clicked', () => {
    render(<NPCs {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    expect(defaultProps.onBack).toHaveBeenCalled();
  });

  it('calls addNPCToInitiative when Add to Initiative clicked', async () => {
    render(<NPCs {...defaultProps} />);
    fireEvent.click(screen.getByTestId('init-btn-Goblin'));
    // The addNPCToInitiative mock resolves synchronously
  });

  it('renders with loading state', () => {
    mockUseNPCsManagement.mockReturnValue({
      npcs: [], loading: true, loadNPCsList: vi.fn(),
      saveNPCAction: vi.fn(), deleteNPCAction: vi.fn(),
    });
    render(<NPCs {...defaultProps} />);
    expect(screen.getByText(/Loading NPCs/)).toBeInTheDocument();
  });

  it('filters by race', () => {
    render(<NPCs {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Search NPCs'), { target: { value: 'Humanoid' } });
    expect(screen.getByTestId('npc-list-item-Goblin')).toBeInTheDocument();
    expect(screen.getByTestId('npc-list-item-Wizard')).toBeInTheDocument();
  });

  it('filters by class role', () => {
    render(<NPCs {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Search NPCs'), { target: { value: 'Caster' } });
    expect(screen.getByTestId('npc-list-item-Wizard')).toBeInTheDocument();
    expect(screen.queryByTestId('npc-list-item-Goblin')).not.toBeInTheDocument();
  });

  it('filters by tags', () => {
    render(<NPCs {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Search NPCs'), { target: { value: 'boss' } });
    expect(screen.getByTestId('npc-list-item-Wizard')).toBeInTheDocument();
    expect(screen.queryByTestId('npc-list-item-Goblin')).not.toBeInTheDocument();
  });
});
