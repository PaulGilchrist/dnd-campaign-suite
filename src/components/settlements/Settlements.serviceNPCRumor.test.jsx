import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settlements from './Settlements.jsx';

// Module-level mock store for useEntityManagement — vi.mock captures this
// object by reference. Tests mutate its `items` field before rendering so the
// component reads fresh state.
const settlementMockStore = {
  items: [],
  loading: false,
  loadItems: vi.fn(),
  saveItems: vi.fn(),
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

const openNewSettlementModal = () => {
  fireEvent.click(screen.getByRole('button', { name: /new settlement/i }));
};

describe('Settlements - service, NPC, and rumor rows', () => {
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

  describe('Add-remove-add cycle', () => {
    const rowTypes = [
      {
        label: 'service',
        addButtonName: /add service/i,
        removeTitle: 'Remove service',
        rowCount: () => screen.queryAllByPlaceholderText('Business name').length,
      },
      {
        label: 'NPC',
        addButtonName: /add npc/i,
        removeTitle: 'Remove NPC',
        rowCount: () => screen.queryAllByPlaceholderText('NPC name').length,
      },
      {
        label: 'rumor',
        addButtonName: /add rumor/i,
        removeTitle: 'Remove rumor',
        rowCount: () => screen.queryAllByTestId(/preview-toggle-settlement-rumor-/).length,
      },
    ];

    it.each(rowTypes)('can add, remove, and re-add a $label row', ({ addButtonName, removeTitle, rowCount }) => {
      render(<Settlements campaignName="test" onBack={() => {}} />);
      openNewSettlementModal();

      const addBtn = screen.getByRole('button', { name: addButtonName });
      fireEvent.click(addBtn);
      expect(rowCount()).toBe(1);

      fireEvent.click(screen.getByTitle(removeTitle));
      expect(rowCount()).toBe(0);

      fireEvent.click(addBtn);
      expect(rowCount()).toBe(1);
    });
  });
});
