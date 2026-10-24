// @maintained-by-ai: 2026-10-24
// Generate-settlement behavior only: the generator's output lands in the new-
// settlement modal as a fully prefilled draft, failures are logged without
// opening the modal, and a dirty form is protected by a confirm-before-overwrite
// gate. Intentionally NOT duplicated here (sibling lanes):
//   - generate button disabled/"Generating…"/re-enabled, modal open/close,
//     delete-button visibility -> Settlements.modalActions.test.jsx
//   - generic save/delete error logging -> Settlements.saveDelete.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settlements from './Settlements.jsx';
import { generateSettlement } from '../../services/campaign/settlementGenerator.js';

// Module-level mock store captured by the vi.mock factory. Tests mutate its
// fields before rendering so the component reads fresh state.
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

// saveSettlement is mocked so the Cancel-leg tests can prove nothing POSTs.
const mockSaveSettlement = vi.fn();
vi.mock('../../services/campaign/settlementsService.js', () => ({
  loadSettlements: vi.fn(),
  saveSettlement: (...args) => mockSaveSettlement(...args),
  deleteSettlement: vi.fn(),
}));

// Mirrors the exact shape settlementGenerator.generateSettlement() returns.
const generatedSettlement = {
  name: 'Generated Town',
  size: 'town',
  description: 'A bustling town of brick and smoke.',
  atmosphere: 'Lively',
  government: 'Council of Elders',
  population: '1,500 souls',
  services: [{ type: 'inn', name: 'The Rusty Anchor', description: 'A fine inn' }],
  notableNPCs: [{ name: 'Mayor Aldric', role: 'Mayor', description: 'Old and shrewd' }],
  rumors: ['A dragon sleeps in the hills'],
  tags: 'generated',
  notes: '',
  threat: 'Bandits',
};

describe('Settlements - generate settlement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settlementMockStore.items = [];
    settlementMockStore.loading = false;
    settlementMockStore.loadItems.mockResolvedValue(undefined);
    vi.mocked(generateSettlement).mockResolvedValue(generatedSettlement);
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

  const renderAndGenerate = () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /generate settlement/i }));
  };

  it('opens the new settlement modal prefilled with every generated field', async () => {
    renderAndGenerate();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
    });

    expect(screen.getByRole('textbox', { name: /name\s?\*/i })).toHaveValue('Generated Town');
    expect(screen.getByRole('combobox', { name: /size/i })).toHaveValue('town');
    expect(screen.getByLabelText('Population')).toHaveValue('1,500 souls');
    expect(screen.getByLabelText(/tags/i)).toHaveValue('generated');
    expect(screen.getByTestId('preview-toggle-settlement-government')).toHaveValue('Council of Elders');
    expect(screen.getByTestId('preview-toggle-settlement-description')).toHaveValue('A bustling town of brick and smoke.');
    expect(screen.getByTestId('preview-toggle-settlement-atmosphere')).toHaveValue('Lively');
    expect(screen.getByPlaceholderText(/current dangers or tensions/i)).toHaveValue('Bandits');

    expect(screen.getByDisplayValue('The Rusty Anchor')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Mayor Aldric')).toBeInTheDocument();
    expect(screen.getByTestId('preview-toggle-settlement-rumor-0')).toHaveValue('A dragon sleeps in the hills');

    // Generated output is a draft for a new settlement, not an edit in place.
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('logs the error, keeps the modal closed, and re-enables the button when generation fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(generateSettlement).mockRejectedValueOnce(new Error('Generation failed'));
    renderAndGenerate();

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to generate settlement:', expect.any(Error));
      expect(screen.getByRole('button', { name: /generate settlement/i })).toBeEnabled();
    });

    expect(screen.queryByRole('heading', { name: 'New Settlement' })).not.toBeInTheDocument();
  });

  describe('dirty-form confirm gate', () => {
    // Fill the new-settlement modal with the half-typed example from the ticket.
    const typeCustomDetails = () => {
      fireEvent.click(screen.getByRole('button', { name: /new settlement/i }));
      fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Violetfield' } });
      fireEvent.change(screen.getByLabelText(/tags/i), { target: { value: 'coastal, trade-hub' } });
      fireEvent.change(screen.getByLabelText('Population'), { target: { value: '312 souls' } });
      fireEvent.change(screen.getByTestId('preview-toggle-settlement-description'), {
        target: { value: 'A crooked little harbour town.' },
      });
    };

    it('asks for confirmation before replacing a half-typed form, and Cancel keeps every value byte-exact with zero POSTs', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<Settlements campaignName="test" onBack={() => {}} />);
      typeCustomDetails();

      fireEvent.click(screen.getByRole('button', { name: /generate settlement/i }));

      expect(confirmSpy).toHaveBeenCalledWith('Generate will replace your entered settlement details?');
      // The generator never runs, so its output cannot touch any field.
      expect(generateSettlement).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Name *')).toHaveValue('Violetfield');
      expect(screen.getByLabelText(/tags/i)).toHaveValue('coastal, trade-hub');
      expect(screen.getByLabelText('Population')).toHaveValue('312 souls');
      expect(screen.getByTestId('preview-toggle-settlement-description')).toHaveValue('A crooked little harbour town.');
      // Nothing hits disk on the Cancel leg.
      expect(mockSaveSettlement).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
      });
    });

    it('fills the form with generator output when the confirmation is accepted', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      render(<Settlements campaignName="test" onBack={() => {}} />);
      typeCustomDetails();

      fireEvent.click(screen.getByRole('button', { name: /generate settlement/i }));

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(generateSettlement).toHaveBeenCalled();
      });
      expect(screen.getByLabelText('Name *')).toHaveValue('Generated Town');
      expect(screen.getByLabelText(/tags/i)).toHaveValue('generated');
      expect(screen.getByLabelText('Population')).toHaveValue('1,500 souls');
      expect(screen.getByTestId('preview-toggle-settlement-description')).toHaveValue('A bustling town of brick and smoke.');
      // Generating is still a draft-only action — no save without the Save button.
      expect(mockSaveSettlement).not.toHaveBeenCalled();
    });

    it('also prompts when the only entered content is an added service, NPC, or rumor row', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<Settlements campaignName="test" onBack={() => {}} />);
      fireEvent.click(screen.getByRole('button', { name: /new settlement/i }));
      fireEvent.click(screen.getByRole('button', { name: /add service/i }));

      fireEvent.click(screen.getByRole('button', { name: /generate settlement/i }));

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(generateSettlement).not.toHaveBeenCalled();
    });

    it('never prompts on an empty/default form — generate proceeds directly', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm');
      render(<Settlements campaignName="test" onBack={() => {}} />);

      // No modal open (formData null).
      fireEvent.click(screen.getByRole('button', { name: /generate settlement/i }));
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
      });
      expect(confirmSpy).not.toHaveBeenCalled();

      // Modal freshly opened on the untouched default form (size 'village' is default, not dirty).
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      fireEvent.click(screen.getByRole('button', { name: /new settlement/i }));
      fireEvent.click(screen.getByRole('button', { name: /generate settlement/i }));

      expect(confirmSpy).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByLabelText('Name *')).toHaveValue('Generated Town');
      });
    });
  });
});
