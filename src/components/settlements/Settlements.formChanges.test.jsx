// @maintained-by-ai: 2026-10-14
// Form-change behavior while editing an existing settlement: typing into fields
// updates the draft, and the conditional threat field tracks its value.
// Intentionally NOT duplicated here (covered in sibling files):
//   - size-change auto-population, new-modal threat reveal -> Settlements.formFields.test.jsx
//   - edit modal open/prefill -> Settlements.modalActions.test.jsx
//   - draft discard on cancel/reopen -> Settlements.crudOperations.test.jsx
//   - service/NPC/rumor row add-remove -> Settlements.serviceNPCRumor.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settlements from './Settlements.jsx';

// Module-level mock store captured by vi.mock by reference; tests mutate
// `items` before rendering so the component reads fresh state.
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

const renderEditingSettlement = (settlement) => {
  settlementMockStore.items = [settlement];
  render(<Settlements campaignName="test" />);
  fireEvent.click(
    screen.getByRole('button', { name: new RegExp(`edit settlement: ${settlement.name}`, 'i') }),
  );
};

describe('Settlements - form field changes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settlementMockStore.items = [];
    settlementMockStore.loading = false;
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

  it('updates the draft when plain fields are edited, preserving earlier edits', () => {
    renderEditingSettlement({
      name: 'Threat Town',
      size: 'village',
      population: '200-400 souls',
      government: 'Mayor',
      notes: 'Draft notes',
    });

    fireEvent.change(screen.getByPlaceholderText('Settlement name'), { target: { value: 'Renamed Town' } });
    fireEvent.change(screen.getByLabelText('Population'), { target: { value: '800-1,500 souls' } });
    fireEvent.change(screen.getByPlaceholderText(/how is this settlement governed/i), { target: { value: 'Council' } });
    fireEvent.change(screen.getByPlaceholderText(/additional gm notes/i), { target: { value: 'Updated notes' } });

    expect(screen.getByPlaceholderText('Settlement name')).toHaveValue('Renamed Town');
    expect(screen.getByLabelText('Population')).toHaveValue('800-1,500 souls');
    expect(screen.getByPlaceholderText(/how is this settlement governed/i)).toHaveValue('Council');
    expect(screen.getByPlaceholderText(/additional gm notes/i)).toHaveValue('Updated notes');
  });

  it('shows the threat field with its value while editing, updates when typed, and hides it when cleared', () => {
    renderEditingSettlement({ name: 'Threat Town', size: 'village', threat: 'Bandits' });

    const threatField = screen.getByPlaceholderText(/current dangers or tensions/i);
    expect(threatField).toHaveValue('Bandits');

    fireEvent.change(threatField, { target: { value: 'Dragon sightings' } });
    expect(threatField).toHaveValue('Dragon sightings');

    fireEvent.change(threatField, { target: { value: '' } });
    expect(screen.queryByText('Threats')).not.toBeInTheDocument();
  });
});
