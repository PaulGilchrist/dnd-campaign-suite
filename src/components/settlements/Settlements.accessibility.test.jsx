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

  const settlementsWithItems = [
    { name: 'Fireport', size: 'town', population: '1,500 souls', tags: 'coastal', services: [], description: 'A town of fire' },
  ];

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
      { regex: /back/i, accessibleName: 'Back' },
      { regex: /new settlement/i, accessibleName: 'New Settlement' },
      { regex: /generate settlement/i, accessibleName: 'Generate Settlement' },
    ])('gives the %p button an accessible name of "$accessibleName"', ({ regex, accessibleName }) => {
      render(<Settlements campaignName={campaignName} onBack={() => {}} />);
      const btn = screen.getByRole('button', { name: regex });
      expect(btn).toHaveAccessibleName(accessibleName);
    });
  });

  describe('Search controls', () => {
    it('labels the search input with an exact accessible name', () => {
      render(<Settlements campaignName={campaignName} onBack={() => {}} />);
      const searchInput = screen.getByLabelText('Search settlements');
      expect(searchInput).toHaveAccessibleName('Search settlements');
    });

    it('provides an accessible name for the clear search button while a search is active', () => {
      render(<Settlements campaignName={campaignName} onBack={() => {}} />);
      fireEvent.change(screen.getByLabelText('Search settlements'), { target: { value: 'test' } });
      const clearBtn = screen.getByRole('button', { name: /clear search/i });
      expect(clearBtn).toHaveAccessibleName('Clear search');
    });

    it('renders the clear search button only while a search query is present', () => {
      render(<Settlements campaignName={campaignName} onBack={() => {}} />);
      expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Search settlements'), { target: { value: 'fire' } });
      expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /clear search/i }));
      expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
    });
  });

  describe('Settlement modal controls', () => {
    it('provides an accessible name for the modal close button', () => {
      render(<Settlements campaignName={campaignName} onBack={() => {}} />);
      fireEvent.click(screen.getByRole('button', { name: /new settlement/i }));
      const closeBtn = screen.getByRole('button', { name: /close/i });
      expect(closeBtn).toHaveAccessibleName('Close');
    });

    it('moves focus to the name input when the modal opens', () => {
      render(<Settlements campaignName={campaignName} onBack={() => {}} />);
      fireEvent.click(screen.getByRole('button', { name: /new settlement/i }));
      expect(screen.getByLabelText(/name/i)).toHaveFocus();
    });
  });

  describe('Settlement list items', () => {
    beforeEach(() => {
      settlementMockStore.items = settlementsWithItems;
    });

    it('exposes each settlement as a keyboard-focusable button', () => {
      render(<Settlements campaignName={campaignName} onBack={() => {}} />);
      const settlementItem = screen.getByRole('button', { name: /edit settlement: fireport/i });
      expect(settlementItem).toHaveAttribute('role', 'button');
      expect(settlementItem).toHaveAttribute('tabindex', '0');
    });

    it('labels each settlement with an aria-label describing the edit action', () => {
      render(<Settlements campaignName={campaignName} onBack={() => {}} />);
      const settlementItem = screen.getByRole('button', { name: /edit settlement: fireport/i });
      expect(settlementItem).toHaveAccessibleName('Edit settlement: Fireport');
    });

    it('opens the edit modal when a settlement is activated with Enter', () => {
      render(<Settlements campaignName={campaignName} onBack={() => {}} />);
      fireEvent.keyDown(
        screen.getByRole('button', { name: /edit settlement: fireport/i }),
        { key: 'Enter' }
      );
      expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
    });

    it('opens the edit modal when a settlement is activated with Space', () => {
      render(<Settlements campaignName={campaignName} onBack={() => {}} />);
      fireEvent.keyDown(
        screen.getByRole('button', { name: /edit settlement: fireport/i }),
        { key: ' ' }
      );
      expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
    });

    it('does not open the edit modal when an unrelated key is pressed', () => {
      render(<Settlements campaignName={campaignName} onBack={() => {}} />);
      fireEvent.keyDown(
        screen.getByRole('button', { name: /edit settlement: fireport/i }),
        { key: 'Delete' }
      );
      expect(screen.queryByRole('heading', { name: 'Edit Settlement' })).not.toBeInTheDocument();
    });
  });

  describe('Size filter buttons', () => {
    const sizeLabels = ['Village', 'Town', 'City', 'Metropolis'];

    it.each(sizeLabels)('provides a descriptive title hint on the %s filter button', (label) => {
      render(<Settlements campaignName={campaignName} onBack={() => {}} />);
      const sizeBtn = screen.getByRole('button', { name: label });
      expect(sizeBtn).toHaveAttribute('title', `Filter: ${label}`);
    });
  });


});
