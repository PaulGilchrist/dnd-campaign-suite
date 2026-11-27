// @maintained-by-ai 2026-11-26
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Settlements from './Settlements.jsx';

// Lane: form-field rendering/values — size auto-population, missing-data
// fallbacks, user-input preservation, save-button enablement.
// Threat-field edits -> formChanges lane; save/delete -> saveDelete lane.

// Module-level mock store captured by vi.mock closure.
const settlementMockStore = {
  items: [],
  loading: false,
  loadItems: vi.fn(),
  deleteItem: vi.fn(),
};

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: vi.fn(() => settlementMockStore),
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

const campaignName = 'test-campaign';

// Mock description data mirroring public/data/settlement-descriptions.json
// (per-size descriptions/atmospheres/governments/threats arrays; the component
// does not consume `features`). Math.random is pinned to 0 so `pick` always
// selects index 0, making expected values exact.
const descriptionsData = {
  village: {
    descriptions: ['A quiet village', 'A small farming village'],
    atmospheres: ['Peaceful', 'Rustic'],
    governments: ['Village council'],
    threats: ['Wild animals'],
  },
  town: {
    descriptions: ['A bustling town'],
    atmospheres: ['Lively'],
    governments: ['Mayor'],
    threats: ['Bandits'],
  },
  city: {
    descriptions: ['A great city'],
    atmospheres: ['Cosmopolitan'],
    governments: ['City council'],
    threats: ['Crime'],
  },
  metropolis: {
    descriptions: ['A vast metropolis'],
    atmospheres: ['Diverse'],
    governments: ['Duke'],
    threats: ['Political intrigue'],
  },
};

// Choosing a size in the NEW-settlement modal fills population from the
// component's built-in per-size ranges and description/atmosphere/government/
// threat from the fetched data. The rows collectively pin all four size→
// population ranges plus every data-availability branch: complete data shows
// and fills the threat field; a missing threats array or a wholly missing
// size key leaves text fields empty and keeps the threat field hidden.
const SIZE_FILL_CASES = [
  { label: 'complete village data', data: descriptionsData, size: 'village', population: '50-100 souls', description: 'A quiet village', atmosphere: 'Peaceful', government: 'Village council', threat: 'Wild animals' },
  { label: 'complete metropolis data', data: descriptionsData, size: 'metropolis', population: '50,000-100,000 souls', description: 'A vast metropolis', atmosphere: 'Diverse', government: 'Duke', threat: 'Political intrigue' },
  { label: 'town data missing only threats', data: { town: { descriptions: ['A bustling town'], atmospheres: ['Lively'], governments: ['Mayor'] } }, size: 'town', population: '800-1,500 souls', description: 'A bustling town', atmosphere: 'Lively', government: 'Mayor', threat: null },
  { label: 'no data for city', data: {}, size: 'city', population: '5,000-12,000 souls', description: '', atmosphere: '', government: '', threat: null },
];

const THREAT_PLACEHOLDER = /current dangers or tensions/i;
const changeSize = (size) =>
  fireEvent.change(screen.getByRole('combobox', { name: /size/i }), { target: { value: size } });

// Render, flush the descriptions fetch so descDataRef is populated (the ref
// is only read on size change), then open the New Settlement modal.
const openNewModal = async (data = descriptionsData) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });
  render(<Settlements campaignName={campaignName} />);
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: /new settlement/i }));
};

describe('Settlements - form fields (behavioral)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    settlementMockStore.items = [];
    settlementMockStore.loading = false;
    settlementMockStore.loadItems.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Size auto-population', () => {
    it.each(SIZE_FILL_CASES)(
      'fills population and available text fields for $label',
      async ({ data, size, population, description, atmosphere, government, threat }) => {
        await openNewModal(data);
        changeSize(size);

        expect(screen.getByLabelText('Population')).toHaveValue(population);
        expect(screen.getByPlaceholderText(/describe what the settlement looks/i)).toHaveValue(description);
        expect(screen.getByPlaceholderText(/mood and ambiance/i)).toHaveValue(atmosphere);
        expect(screen.getByPlaceholderText(/how is this settlement governed/i)).toHaveValue(government);

        if (threat === null) {
          expect(screen.queryByPlaceholderText(THREAT_PLACEHOLDER)).not.toBeInTheDocument();
        } else {
          expect(screen.getByPlaceholderText(THREAT_PLACEHOLDER)).toHaveValue(threat);
        }
      },
    );

    it('preserves the user-typed name, replaces prior auto-filled values on size change, and re-fills the same size on re-select', async () => {
      await openNewModal();

      // Threat field is hidden while empty (default village form).
      expect(screen.queryByPlaceholderText(THREAT_PLACEHOLDER)).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'My Village' } });
      changeSize('village');
      expect(screen.getByPlaceholderText(/describe what the settlement looks/i)).toHaveValue('A quiet village');

      // Re-selecting the same size re-fills even a user-cleared field.
      fireEvent.change(screen.getByPlaceholderText(/describe what the settlement looks/i), { target: { value: '' } });
      changeSize('village');
      expect(screen.getByPlaceholderText(/describe what the settlement looks/i)).toHaveValue('A quiet village');
      expect(screen.getByLabelText('Population')).toHaveValue('50-100 souls');

      // Switching size replaces all auto-filled values but keeps the typed name.
      changeSize('metropolis');
      expect(screen.getByLabelText(/name/i)).toHaveValue('My Village');
      expect(screen.getByLabelText('Population')).toHaveValue('50,000-100,000 souls');
      expect(screen.getByPlaceholderText(/describe what the settlement looks/i)).toHaveValue('A vast metropolis');
      expect(screen.getByPlaceholderText(THREAT_PLACEHOLDER)).toHaveValue('Political intrigue');
    });
  });

  describe('Name field validation', () => {
    it('enables Save only for a non-blank name, re-disabling on blank or whitespace-only input', async () => {
      await openNewModal();

      const saveBtn = screen.getByRole('button', { name: /save/i });
      expect(saveBtn).toBeDisabled();

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: 'My Settlement' } });
      expect(saveBtn).toBeEnabled();

      // Trimmed: whitespace-only names do not count as content.
      fireEvent.change(nameInput, { target: { value: '   ' } });
      expect(saveBtn).toBeDisabled();

      fireEvent.change(nameInput, { target: { value: 'My Settlement' } });
      expect(saveBtn).toBeEnabled();
    });
  });
});
