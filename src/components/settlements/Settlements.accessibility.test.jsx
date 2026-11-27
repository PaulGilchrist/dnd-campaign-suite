// @maintained-by-ai 2026-11-26
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settlements from './Settlements.jsx';

// Accessibility/keyboard lane only: accessible names, focus behavior, and the
// custom role="button" list-item activation. Mechanics (open/close/save/delete
// flows) belong to Settlements.modalActions/saveDelete/generate tests.

// Module-level mock store captured by the vi.mock factory. Tests mutate its
// `items` field before rendering so the component reads fresh state.
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

describe('Settlements - accessibility and keyboard', () => {
  const campaignName = 'test-campaign';

  const renderSettlements = () =>
    render(<Settlements campaignName={campaignName} />);

  const getSearchInput = () => screen.getByLabelText('Search settlements');
  const getEditButton = (name) =>
    screen.getByRole('button', { name: `Edit settlement: ${name}` });

  beforeEach(() => {
    vi.clearAllMocks();
    settlementMockStore.items = [];
    settlementMockStore.loading = false;
    settlementMockStore.loadItems.mockResolvedValue(undefined);
    // The component fetches settlement-descriptions.json on mount; no test
    // here reads its body, so an empty response is sufficient.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gives the header New and Generate buttons their accessible names', () => {
    renderSettlements();
    expect(screen.getByRole('button', { name: 'New Settlement' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Settlement' })).toBeInTheDocument();
  });

  it('labels the search input and shows a named clear button only while a query is present', () => {
    renderSettlements();
    expect(getSearchInput()).toHaveAccessibleName('Search settlements');
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();

    fireEvent.change(getSearchInput(), { target: { value: 'fire' } });
    const clearBtn = screen.getByRole('button', { name: 'Clear search' });

    fireEvent.click(clearBtn);
    expect(getSearchInput()).toHaveValue('');
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
  });

  it('opens the new-settlement modal accessibly: focus lands on the name input and the close button is named', () => {
    renderSettlements();
    fireEvent.click(screen.getByRole('button', { name: 'New Settlement' }));
    expect(screen.getByLabelText(/name/i)).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  describe('Settlement list items', () => {
    const fireport = {
      name: 'Fireport',
      size: 'town',
      population: '1,500 souls',
      tags: 'coastal',
      services: [],
      description: 'A town of fire',
    };

    beforeEach(() => {
      settlementMockStore.items = [fireport];
    });

    it('exposes each settlement as a focusable role=button labelled with the edit action', () => {
      renderSettlements();
      const settlementItem = getEditButton('Fireport');
      // The row is a non-native <li role="button">, so tabindex=0 is the
      // keyboard-accessibility contract that makes it reachable by Tab.
      expect(settlementItem).toHaveAttribute('tabindex', '0');
    });

    it.each(['Enter', ' '])('opens the edit modal when a settlement is activated with "%s"', (key) => {
      renderSettlements();
      fireEvent.keyDown(getEditButton('Fireport'), { key });
      expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
    });

    it('does not open the edit modal when an unrelated key is pressed', () => {
      renderSettlements();
      fireEvent.keyDown(getEditButton('Fireport'), { key: 'Delete' });
      expect(screen.queryByRole('heading', { name: 'Edit Settlement' })).not.toBeInTheDocument();
    });
  });

  it('gives every size filter button a descriptive title hint', () => {
    renderSettlements();
    for (const label of ['Village', 'Town', 'City', 'Metropolis']) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('title', `Filter: ${label}`);
    }
  });
});
