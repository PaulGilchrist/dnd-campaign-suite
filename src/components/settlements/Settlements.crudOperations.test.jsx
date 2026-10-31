// @maintained-by-ai: 2026-10-14
// Row-level CRUD lives in sibling lanes: serviceNPCRumor (row add/remove),
// modalActions (open/close + prefilled edit), saveDelete (save/delete flows),
// duplicate-name (name guard). This file retains only the unique behavioral
// gap: draft-discard semantics when the edit modal is closed and reopened.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settlements from './Settlements.jsx';

// Module-level mock store captured by the vi.mock factory by reference.
// Tests mutate `items` before rendering so the component reads fresh state.
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

const openEditSettlement = () =>
  fireEvent.click(screen.getByRole('button', { name: /edit settlement/i }));

describe('Settlements - draft discard (behavioral)', () => {
  beforeEach(() => {
    settlementMockStore.items = [];
    settlementMockStore.loading = false;
    // The component fetches settlement-descriptions.json on mount; no test
    // here changes the size select, so the response body is irrelevant.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('discards unsaved row edits when the edit modal is closed and reopened', () => {
    // getDefaultFormData() fills any missing fields on edit, so a name-only
    // settlement is enough to exercise the open → edit → cancel → reopen flow.
    settlementMockStore.items = [{ name: 'Old Town' }];
    render(<Settlements campaignName="test-campaign" />);
    openEditSettlement();

    fireEvent.click(screen.getByRole('button', { name: /add service/i }));
    expect(screen.getByPlaceholderText('Business name')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    openEditSettlement();

    expect(screen.queryByPlaceholderText('Business name')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Old Town')).toBeInTheDocument();
  });
});
