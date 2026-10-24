// @maintained-by-ai: 2026-10-24
// Regression test for bug-quest-edit-modal-stays-open-after-delete:
// an accepted delete that resolves MUST unmount the Edit Quest modal
// (mirroring NPCs/Notes/Factions/Sessions handleDelete close-on-success).
// A declined confirm must leave both the row and the modal intact.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Quests from './Quests.jsx';

const mockUseQuestsManagement = vi.fn();

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: (campaignName, config) => mockUseQuestsManagement(campaignName, config),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange, placeholder, label }) => (
    <div data-testid={`preview-toggle-${id}`}>
      <label>{label}</label>
      <textarea
        data-testid={`field-${id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  ),
}));

const defaultProps = {
  campaignName: 'test-campaign',
  isLocalhost: true,
  onBack: vi.fn(),
};

const quest = (overrides = {}) => ({
  id: 'quest-1',
  name: 'QA Quest Two',
  status: 'active',
  description: '',
  rewards: '',
  notes: '',
  ...overrides,
});

// Items live in a mutable array so the mocked hook reflects the removal
// when the component re-renders after deleteItem resolves — same shape as
// useEntityManagement's loadItems refresh in the real app.
function renderWithLiveList(items) {
  const deleteItem = vi.fn().mockImplementation((id) => {
    const idx = items.findIndex(q => q.id === id);
    if (idx !== -1) items.splice(idx, 1);
    return Promise.resolve();
  });
  mockUseQuestsManagement.mockImplementation(() => ({
    items,
    loading: false,
    loadItems: vi.fn(),
    saveItems: vi.fn().mockResolvedValue(undefined),
    deleteItem,
  }));
  return { ...render(<Quests {...defaultProps} />), deleteItem };
}

const openEditModal = (name) => fireEvent.click(screen.getByRole('button', { name: `Edit quest: ${name}` }));
const overlay = () => document.querySelector('.ct-modal-overlay');

describe('Quests delete modal close', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('unmounts the edit modal and removes the row after an accepted delete resolves', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const items = [
      quest({ id: 'quest-1', name: 'QA Quest Two' }),
      quest({ id: 'quest-2', name: 'The Lost Artifact' }),
    ];
    const { deleteItem } = renderWithLiveList(items);

    openEditModal('QA Quest Two');
    expect(overlay()).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(window.confirm).toHaveBeenCalledWith('Delete quest "QA Quest Two"?');
    expect(deleteItem).toHaveBeenCalledWith('quest-1');

    await waitFor(() => expect(overlay()).toBeNull());
    expect(screen.queryByRole('heading', { name: 'Edit Quest' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit quest: QA Quest Two' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit quest: The Lost Artifact' })).toBeInTheDocument();
  });

  it('keeps the row and the open modal when the confirm is declined', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const items = [quest({ id: 'quest-1', name: 'QA Quest Two' })];
    const { deleteItem } = renderWithLiveList(items);

    openEditModal('QA Quest Two');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(deleteItem).not.toHaveBeenCalled();
    expect(overlay()).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Edit quest: QA Quest Two' })).toBeInTheDocument();
  });

  it('keeps the modal open with an inline error when the delete request fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const errorSpy = vi.spyOn(console, 'error');
    const items = [quest({ id: 'quest-1', name: 'QA Quest Two' })];
    mockUseQuestsManagement.mockReturnValue({
      items,
      loading: false,
      loadItems: vi.fn(),
      saveItems: vi.fn().mockResolvedValue(undefined),
      deleteItem: vi.fn().mockRejectedValue(new Error('Delete failed')),
    });
    render(<Quests {...defaultProps} />);

    openEditModal('QA Quest Two');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Failed to delete quest:', expect.any(Error)));
    expect(overlay()).not.toBeNull();
    expect(screen.getByText('Delete failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).not.toHaveAttribute('disabled');
  });
});
