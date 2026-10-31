// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settlements from './Settlements.jsx';

// Module-level mock store for useEntityManagement — vi.mock closure captures this object.
const settlementMockStore = {
  items: [],
  loading: false,
  loadItems: vi.fn(),
  deleteItem: vi.fn(),
};

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: () => settlementMockStore,
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

// This lane never triggers generation; the mock exists only to satisfy the module import.
vi.mock('../../services/campaign/settlementGenerator.js', () => ({
  generateSettlement: vi.fn(),
}));

// saveSettlement is the only service function the component calls directly; the others are
// passed into the mocked useEntityManagement and must merely exist. The lazy wrapper defers
// the reference past vi.mock hoisting.
const mockSaveSettlement = vi.fn();
vi.mock('../../services/campaign/settlementsService.js', () => ({
  loadSettlements: vi.fn(),
  saveSettlement: (...args) => mockSaveSettlement(...args),
  deleteSettlement: vi.fn(),
}));

const makeSettlement = (name) => ({
  name,
  size: 'village',
  population: '',
  tags: '',
  services: [],
  description: '',
  atmosphere: '',
  government: '',
  notableNPCs: [],
  rumors: [],
  notes: '',
  threat: '',
});

// Open the new-settlement modal with the name filled in (which enables Save).
const openNewForm = (name = 'My Settlement') => {
  render(<Settlements campaignName="test" />);
  fireEvent.click(screen.getByRole('button', { name: /new settlement/i }));
  fireEvent.change(screen.getByRole('textbox', { name: /name\s?\*/i }), { target: { value: name } });
};

// Render one settlement, open its edit modal, and stub the delete-confirmation answer.
const openEditForm = (name, confirmResult = true) => {
  vi.spyOn(globalThis.window, 'confirm').mockReturnValue(confirmResult);
  settlementMockStore.items = [makeSettlement(name)];
  render(<Settlements campaignName="test" />);
  fireEvent.click(screen.getByRole('button', { name: /edit settlement/i }));
};

describe('Settlements - save and delete behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveSettlement.mockResolvedValue({ success: true });
    settlementMockStore.deleteItem.mockResolvedValue({});
    settlementMockStore.items = [];
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Save', () => {
    it('saves an edited settlement with its new data and the original name as the rename target', async () => {
      openEditForm('Old Name');

      fireEvent.change(screen.getByDisplayValue('Old Name'), { target: { value: 'New Name' } });
      fireEvent.change(screen.getByTestId('preview-toggle-settlement-description'), {
        target: { value: 'A bustling marketplace' },
      });
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockSaveSettlement).toHaveBeenCalledWith(
          'test',
          expect.objectContaining({ name: 'New Name', description: 'A bustling marketplace' }),
          'Old Name'
        );
      });
    });

    it('saves a new settlement without an old name, reloads the list, and closes the modal', async () => {
      openNewForm();
      settlementMockStore.loadItems.mockClear(); // isolate the post-save reload from the mount load

      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockSaveSettlement).toHaveBeenCalledWith(
          'test',
          expect.objectContaining({ name: 'My Settlement' }),
          undefined
        );
        expect(settlementMockStore.loadItems).toHaveBeenCalled();
        expect(screen.queryByRole('heading', { name: 'New Settlement' })).not.toBeInTheDocument();
      });
    });

    it('disables Save and Cancel with a "Saving…" label while a save is in flight, then closes', async () => {
      let resolveSave;
      mockSaveSettlement.mockImplementation(() => new Promise((resolve) => {
        resolveSave = resolve;
      }));

      openNewForm();
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);

      expect(saveBtn).toBeDisabled();
      expect(saveBtn).toHaveTextContent('Saving…');
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

      resolveSave({ success: true });

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'New Settlement' })).not.toBeInTheDocument();
      });
    });

    it('re-enables Save and keeps the modal open with data intact when a save fails', async () => {
      mockSaveSettlement.mockRejectedValue(new Error('Save failed'));

      openNewForm();
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(saveBtn).not.toBeDisabled();
      });

      expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /name\s?\*/i })).toHaveValue('My Settlement');
      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });
  });

  describe('Delete', () => {
    it('does not delete when the user cancels the confirmation dialog', () => {
      openEditForm('Keep Me', false);
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(globalThis.window.confirm).toHaveBeenCalledWith('Delete Settlement "Keep Me"?');
      expect(settlementMockStore.deleteItem).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
    });

    it('deletes the settlement when confirmed, shows "Deleting…" in flight, then closes', async () => {
      let resolveDelete;
      settlementMockStore.deleteItem.mockImplementation(() => new Promise((resolve) => {
        resolveDelete = resolve;
      }));

      openEditForm('Delete Me');
      const deleteBtn = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(deleteBtn);

      expect(globalThis.window.confirm).toHaveBeenCalledWith('Delete Settlement "Delete Me"?');
      expect(settlementMockStore.deleteItem).toHaveBeenCalledWith('Delete Me');
      expect(deleteBtn).toBeDisabled();
      expect(screen.getByText('Deleting…')).toBeInTheDocument();

      resolveDelete({});

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Edit Settlement' })).not.toBeInTheDocument();
      });
    });

    it('re-enables Delete and keeps the modal open when a delete fails', async () => {
      settlementMockStore.deleteItem.mockRejectedValue(new Error('Delete failed'));

      openEditForm('Keep Me');
      const deleteBtn = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(deleteBtn).not.toBeDisabled();
      });

      expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
    });
  });
});
