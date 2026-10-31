// @maintained-by-ai: 2026-10-14
// Modal action mechanics only: loading/empty states, modal open/close,
// delete-button visibility, and generate button state. Intentionally NOT
// duplicated here (covered in sibling files):
//   - size badges, population, service counts, tags, description previews
//       -> Settlements.listRendering.test.jsx
//   - search/size filtering behavior, no-results messages
//       -> Settlements.filtering.test.jsx
//   - search clear-button visibility, accessible names, focus management
//       -> Settlements.accessibility.test.jsx
//   - generated draft prefilled into the modal, generation error handling
//       -> Settlements.generate.test.jsx
//   - save/delete behavior, draft lifecycle
//       -> Settlements.saveDelete.test.jsx / crudOperations.test.jsx
//   - form field changes, size auto-population, name validation, threat field
//       -> Settlements.formFields.test.jsx / formChanges.test.jsx
//   - service/NPC/rumor add-remove cycles
//       -> Settlements.serviceNPCRumor.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settlements from './Settlements.jsx';
import { generateSettlement } from '../../services/campaign/settlementGenerator.js';

// Module-level mock store captured by the vi.mock factory. Tests mutate its
// `items`/`loading` fields before rendering so the component reads fresh state.
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

const renderSettlements = () =>
  render(<Settlements campaignName="test-campaign" />);

describe('Settlements - modal actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settlementMockStore.items = [];
    settlementMockStore.loading = false;
    settlementMockStore.loadItems.mockResolvedValue(undefined);
    // The component fetches settlement-descriptions.json on mount; no test
    // in this file changes the size select, so the response body is irrelevant.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('List view', () => {
    it('shows a loading state while settlements are being fetched', () => {
      settlementMockStore.loading = true;
      renderSettlements();
      expect(screen.getByText(/loading settlements/i)).toBeInTheDocument();
      expect(screen.queryByText(/no settlements yet/i)).not.toBeInTheDocument();
    });

    it('shows the empty state when there are no settlements', () => {
      renderSettlements();
      expect(screen.getByText(/no settlements yet/i)).toBeInTheDocument();
    });
  });

  describe('New settlement modal', () => {
    it('opens on "New Settlement", hides Delete, and closes on Cancel', () => {
      renderSettlements();
      fireEvent.click(screen.getByRole('button', { name: /new settlement/i }));
      expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
      // Delete is reserved for editing an existing settlement.
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.queryByRole('heading', { name: 'New Settlement' })).not.toBeInTheDocument();
    });
  });

  describe('Edit settlement modal', () => {
    it('opens prefilled with the settlement data and shows the Delete button', () => {
      settlementMockStore.items = [{ name: 'Old Town', size: 'town', population: '2,500 souls' }];
      renderSettlements();
      fireEvent.click(screen.getByRole('button', { name: /edit settlement: old town/i }));
      expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /name\s?\*/i })).toHaveValue('Old Town');
      expect(screen.getByRole('combobox', { name: /size/i })).toHaveValue('town');
      expect(screen.getByLabelText('Population')).toHaveValue('2,500 souls');
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });
  });

  describe('Generate settlement flow', () => {
    it('disables the generate button while generating and re-enables it when done', async () => {
      let resolveGenerate;
      vi.mocked(generateSettlement).mockImplementationOnce(() => new Promise((resolve) => {
        resolveGenerate = resolve;
      }));

      renderSettlements();
      const generateBtn = screen.getByRole('button', { name: /generate settlement/i });
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(generateBtn).toBeDisabled();
      });
      expect(generateBtn).toHaveTextContent('Generating…');

      resolveGenerate({ name: 'Generated Town' });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
      });
      expect(generateBtn).toBeEnabled();
      expect(generateBtn).toHaveTextContent('Generate Settlement');
    });
  });
});
