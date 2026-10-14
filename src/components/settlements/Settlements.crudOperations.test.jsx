// Row-level CRUD is covered in Settlements.serviceNPCRumor.test.jsx (new modal)
// and Settlements.modalActions.test.jsx (edit modal open/close + prefilled data).
// This file retains only the unique behavioral gap: draft-discard semantics
// when the edit modal is closed and reopened.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settlements from './Settlements.jsx';

// Module-level mock store for useEntityManagement — vi.mock captures this
// object by reference. Tests mutate its `items` field before rendering so the
// component reads fresh state.
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
  generateSettlement: vi.fn(),
}));

const makeSettlement = (name, overrides = {}) => ({
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
  ...overrides,
});

const openEditSettlement = () => {
  fireEvent.click(screen.getByRole('button', { name: /edit settlement/i }));
};

describe('Settlements - CRUD operations (behavioral)', () => {
  const campaignName = 'test-campaign';

  beforeEach(() => {
    vi.clearAllMocks();
    settlementMockStore.items = [];
    settlementMockStore.loading = false;
    settlementMockStore.loadItems.mockResolvedValue(undefined);
    // The component fetches settlement-descriptions.json on mount; no test here
    // changes the size select, so the response body is irrelevant.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Draft lifecycle', () => {
    it('discards unsaved row edits when the modal is closed and reopened', () => {
      settlementMockStore.items = [makeSettlement('Old Town')];
      render(<Settlements campaignName={campaignName} onBack={() => {}} />);
      openEditSettlement();

      fireEvent.click(screen.getByRole('button', { name: /add service/i }));
      expect(screen.queryByPlaceholderText('Business name')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      openEditSettlement();

      expect(screen.queryByPlaceholderText('Business name')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('Old Town')).toBeInTheDocument();
    });
  });
});
