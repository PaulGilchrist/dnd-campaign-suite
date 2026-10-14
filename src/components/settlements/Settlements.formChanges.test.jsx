// Threat-field form behavior while editing an existing settlement.
// Intentionally NOT duplicated here (covered in sibling files):
//   - size change auto-populates population/description/atmosphere/government/threat
//       with exact deterministic values -> Settlements.formFields.test.jsx
//   - threat field hidden when editing a settlement without a threat
//       -> Settlements.formFields.test.jsx
//   - threat field revealed by a size change in the new-settlement modal
//       -> Settlements.formFields.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settlements from './Settlements.jsx';

// Module-level mock store for useEntityManagement — vi.mock captures this object
// by reference. Tests mutate its `items` field before rendering so the component
// reads fresh state.
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

const THREAT_PLACEHOLDER = /current dangers or tensions/i;

const renderEditingSettlement = (settlement) => {
  settlementMockStore.items = [settlement];
  render(<Settlements campaignName="test" onBack={() => {}} />);
  fireEvent.click(
    screen.getByRole('button', { name: new RegExp(`edit settlement: ${settlement.name}`, 'i') }),
  );
};

describe('Settlements - form field changes (threat field)', () => {
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

  it('shows the threat field with its current value when editing a settlement that has a threat, and updates when typed', () => {
    renderEditingSettlement(makeSettlement('Threat Town', { threat: 'Bandits' }));

    expect(screen.getByText('Threats')).toBeInTheDocument();
    const threatField = screen.getByPlaceholderText(THREAT_PLACEHOLDER);
    expect(threatField).toHaveValue('Bandits');
    fireEvent.change(threatField, { target: { value: 'Dragon sightings' } });
    expect(threatField).toHaveValue('Dragon sightings');
  });

  it('hides the threat field again when the threat value is cleared', () => {
    renderEditingSettlement(makeSettlement('Threat Town', { threat: 'Bandits' }));

    fireEvent.change(screen.getByPlaceholderText(THREAT_PLACEHOLDER), { target: { value: '' } });

    expect(screen.queryByPlaceholderText(THREAT_PLACEHOLDER)).not.toBeInTheDocument();
    expect(screen.queryByText('Threats')).not.toBeInTheDocument();
  });
});
