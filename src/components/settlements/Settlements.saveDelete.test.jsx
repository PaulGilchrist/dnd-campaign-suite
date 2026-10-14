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

// Only saveSettlement is invoked directly by the component. loadSettlements and
// deleteSettlement are passed into the (mocked) useEntityManagement hook and never
// reach the service, so they are exported only as inert placeholders (Vitest
// requires every named import the component makes to exist on the mock).
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

const openNewSettlement = () => {
  fireEvent.click(screen.getByRole('button', { name: /new settlement/i }));
};

const openEditSettlement = () => {
  fireEvent.click(screen.getByRole('button', { name: /edit settlement/i }));
};

describe('Settlements - save and delete behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveSettlement.mockResolvedValue({ success: true });
    settlementMockStore.deleteItem.mockResolvedValue({});
    settlementMockStore.loadItems.mockResolvedValue(undefined);
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
      settlementMockStore.items = [makeSettlement('Old Name')];
      render(<Settlements campaignName="test" onBack={() => {}} />);

      openEditSettlement();

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

    it('saves a new settlement without an old name', async () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);

      openNewSettlement();
      fireEvent.change(screen.getByRole('textbox', { name: /name\s?\*/i }), {
        target: { value: 'My Settlement' },
      });
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockSaveSettlement).toHaveBeenCalledWith(
          'test',
          expect.objectContaining({ name: 'My Settlement' }),
          undefined
        );
      });
    });

    it('reloads the settlement list and closes the modal after a successful save', async () => {
      render(<Settlements campaignName="test" onBack={() => {}} />);

      openNewSettlement();
      fireEvent.change(screen.getByRole('textbox', { name: /name\s?\*/i }), {
        target: { value: 'My Settlement' },
      });
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockSaveSettlement).toHaveBeenCalled();
        expect(settlementMockStore.loadItems).toHaveBeenCalled();
      });

      expect(screen.queryByRole('heading', { name: 'New Settlement' })).not.toBeInTheDocument();
    });

    it('disables the save button and shows "Saving…" while a save is in flight', async () => {
      let resolveSave;
      mockSaveSettlement.mockImplementation(() => new Promise((resolve) => {
        resolveSave = resolve;
      }));

      render(<Settlements campaignName="test" onBack={() => {}} />);

      openNewSettlement();
      fireEvent.change(screen.getByRole('textbox', { name: /name\s?\*/i }), {
        target: { value: 'My Settlement' },
      });

      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);

      expect(saveBtn).toBeDisabled();
      expect(saveBtn).toHaveTextContent('Saving…');

      resolveSave({ success: true });

      await waitFor(() => {
        expect(mockSaveSettlement).toHaveBeenCalled();
        expect(screen.queryByRole('heading', { name: 'New Settlement' })).not.toBeInTheDocument();
      });
    });

    it('re-enables the save button and keeps the modal open with data intact when a save fails', async () => {
      mockSaveSettlement.mockRejectedValue(new Error('Save failed'));

      render(<Settlements campaignName="test" onBack={() => {}} />);

      openNewSettlement();
      fireEvent.change(screen.getByRole('textbox', { name: /name\s?\*/i }), {
        target: { value: 'My Settlement' },
      });

      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);
      expect(saveBtn).toBeDisabled();

      await waitFor(() => {
        expect(mockSaveSettlement).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(saveBtn).not.toBeDisabled();
      });

      expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /name\s?\*/i })).toHaveValue('My Settlement');
    });

    it('disables the cancel button while a save is in flight', () => {
      mockSaveSettlement.mockImplementation(() => new Promise(() => {}));

      render(<Settlements campaignName="test" onBack={() => {}} />);

      openNewSettlement();
      fireEvent.change(screen.getByRole('textbox', { name: /name\s?\*/i }), {
        target: { value: 'My Settlement' },
      });
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(mockSaveSettlement).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    });
  });

  describe('Delete', () => {
    it('does not delete when the user cancels the confirmation dialog', () => {
      vi.spyOn(globalThis.window, 'confirm').mockReturnValue(false);

      settlementMockStore.items = [makeSettlement('Keep Me')];
      render(<Settlements campaignName="test" onBack={() => {}} />);

      openEditSettlement();
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(settlementMockStore.deleteItem).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
    });

    it('deletes the settlement through the delete action when the user confirms', async () => {
      vi.spyOn(globalThis.window, 'confirm').mockReturnValue(true);

      settlementMockStore.items = [makeSettlement('Delete Me')];
      render(<Settlements campaignName="test" onBack={() => {}} />);

      openEditSettlement();
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(settlementMockStore.deleteItem).toHaveBeenCalledWith('Delete Me');
      });
    });

    it('disables the delete button and shows "Deleting…" while a delete is in flight, then closes the modal', async () => {
      vi.spyOn(globalThis.window, 'confirm').mockReturnValue(true);

      let resolveDelete;
      settlementMockStore.deleteItem.mockImplementation(() => new Promise((resolve) => {
        resolveDelete = resolve;
      }));

      settlementMockStore.items = [makeSettlement('Deleting...')];
      render(<Settlements campaignName="test" onBack={() => {}} />);

      openEditSettlement();
      const deleteBtn = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(deleteBtn);

      expect(deleteBtn).toBeDisabled();
      expect(screen.getByText('Deleting…')).toBeInTheDocument();

      resolveDelete({});

      await waitFor(() => {
        expect(settlementMockStore.deleteItem).toHaveBeenCalled();
        expect(screen.queryByRole('heading', { name: 'Edit Settlement' })).not.toBeInTheDocument();
      });
    });

    it('re-enables the delete button and keeps the modal open when a delete fails', async () => {
      vi.spyOn(globalThis.window, 'confirm').mockReturnValue(true);

      settlementMockStore.deleteItem.mockRejectedValue(new Error('Delete failed'));

      settlementMockStore.items = [makeSettlement('Keep Me')];
      render(<Settlements campaignName="test" onBack={() => {}} />);

      openEditSettlement();
      const deleteBtn = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(settlementMockStore.deleteItem).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(deleteBtn).not.toBeDisabled();
      });

      expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
    });
  });
});
