// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settlements from './Settlements.jsx';

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

  describe('Header controls', () => {
    it.each([
      { regex: /new settlement/i, accessibleName: 'New Settlement' },
      { regex: /generate settlement/i, accessibleName: 'Generate Settlement' },
    ])('gives the %p button an accessible name of "$accessibleName"', ({ regex, accessibleName }) => {
      renderSettlements();
      expect(screen.getByRole('button', { name: regex })).toHaveAccessibleName(accessibleName);
    });
  });

  describe('Search controls', () => {
    it('labels the search input and shows a named clear button only while a query is present', () => {
      renderSettlements();
      expect(getSearchInput()).toHaveAccessibleName('Search settlements');
      expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();

      fireEvent.change(getSearchInput(), { target: { value: 'fire' } });
      const clearBtn = screen.getByRole('button', { name: /clear search/i });
      expect(clearBtn).toHaveAccessibleName('Clear search');

      fireEvent.click(clearBtn);
      expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
    });
  });

  describe('Settlement modal controls', () => {
    it('provides an accessible name for the modal close button', () => {
      renderSettlements();
      fireEvent.click(screen.getByRole('button', { name: /new settlement/i }));
      expect(screen.getByRole('button', { name: /close/i })).toHaveAccessibleName('Close');
    });

    it('moves focus to the name input when the modal opens', () => {
      renderSettlements();
      fireEvent.click(screen.getByRole('button', { name: /new settlement/i }));
      expect(screen.getByLabelText(/name/i)).toHaveFocus();
    });
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

    it('exposes each settlement as a focusable button labelled with the edit action', () => {
      renderSettlements();
      const settlementItem = screen.getByRole('button', { name: /edit settlement: fireport/i });
      expect(settlementItem).toHaveAccessibleName('Edit settlement: Fireport');
      expect(settlementItem).toHaveAttribute('tabindex', '0');
    });

    it.each(['Enter', ' '])('opens the edit modal when a settlement is activated with %s', (key) => {
      renderSettlements();
      fireEvent.keyDown(screen.getByRole('button', { name: /edit settlement: fireport/i }), { key });
      expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
    });

    it('does not open the edit modal when an unrelated key is pressed', () => {
      renderSettlements();
      fireEvent.keyDown(screen.getByRole('button', { name: /edit settlement: fireport/i }), { key: 'Delete' });
      expect(screen.queryByRole('heading', { name: 'Edit Settlement' })).not.toBeInTheDocument();
    });
  });

  describe('Size filter buttons', () => {
    it.each(['Village', 'Town', 'City', 'Metropolis'])('provides a descriptive title hint on the %s filter button', (label) => {
      renderSettlements();
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('title', `Filter: ${label}`);
    });
  });
});
