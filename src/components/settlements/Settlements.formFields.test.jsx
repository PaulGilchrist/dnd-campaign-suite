// @maintained-by-ai: 2026-10-14
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

const SIZE_CASES = [
  { size: 'village', population: '50-100 souls', description: 'A quiet village', atmosphere: 'Peaceful', government: 'Village council', threat: 'Wild animals' },
  { size: 'town', population: '800-1,500 souls', description: 'A bustling town', atmosphere: 'Lively', government: 'Mayor', threat: 'Bandits' },
  { size: 'city', population: '5,000-12,000 souls', description: 'A great city', atmosphere: 'Cosmopolitan', government: 'City council', threat: 'Crime' },
  { size: 'metropolis', population: '50,000-100,000 souls', description: 'A vast metropolis', atmosphere: 'Diverse', government: 'Duke', threat: 'Political intrigue' },
];

// Sizes whose mock data is missing (partially or wholly): population must
// still come from the component's built-in ranges; missing text fields stay
// empty and the threat field stays hidden.
const PARTIAL_CASES = [
  { label: 'village, missing atmospheres/governments/threats', data: { village: { descriptions: ['A quiet village'] } }, size: 'village', population: '50-100 souls', description: 'A quiet village', atmosphere: '', government: '' },
  { label: 'town, missing threats', data: { town: { descriptions: ['A bustling town'], atmospheres: ['Lively'], governments: ['Mayor'] } }, size: 'town', population: '800-1,500 souls', description: 'A bustling town', atmosphere: 'Lively', government: 'Mayor' },
  { label: 'city, no data at all', data: {}, size: 'city', population: '5,000-12,000 souls', description: '', atmosphere: '', government: '' },
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
    it.each(SIZE_CASES)(
      'auto-populates population, description, atmosphere, government, and threat for $size',
      async ({ size, population, description, atmosphere, government, threat }) => {
        await openNewModal();
        changeSize(size);

        expect(screen.getByLabelText('Population')).toHaveValue(population);
        expect(screen.getByPlaceholderText(/describe what the settlement looks/i)).toHaveValue(description);
        expect(screen.getByPlaceholderText(/mood and ambiance/i)).toHaveValue(atmosphere);
        expect(screen.getByPlaceholderText(/how is this settlement governed/i)).toHaveValue(government);
        expect(screen.getByPlaceholderText(THREAT_PLACEHOLDER)).toHaveValue(threat);
      },
    );

    it.each(PARTIAL_CASES)(
      'fills built-in population and only the available text fields for $label',
      async ({ data, size, population, description, atmosphere, government }) => {
        await openNewModal(data);
        changeSize(size);

        expect(screen.getByLabelText('Population')).toHaveValue(population);
        expect(screen.getByPlaceholderText(/describe what the settlement looks/i)).toHaveValue(description);
        expect(screen.getByPlaceholderText(/mood and ambiance/i)).toHaveValue(atmosphere);
        expect(screen.getByPlaceholderText(/how is this settlement governed/i)).toHaveValue(government);
        expect(screen.queryByPlaceholderText(THREAT_PLACEHOLDER)).not.toBeInTheDocument();
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
    it('enables save only once the name has content', async () => {
      await openNewModal();

      const saveBtn = screen.getByRole('button', { name: /save/i });
      expect(saveBtn).toBeDisabled();

      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'My Settlement' } });
      expect(saveBtn).toBeEnabled();
    });
  });
});
