// @maintained-by-ai 2026-11-26
// This lane owns the service/NPC/rumor row-linking contract in the settlement
// modal: rows add blank, every field edit binds to the correct row by index,
// removal targets the clicked row, and re-added rows start blank. The only
// type-specific default (service type "tavern") is pinned here too. Plain
// top-level fields, save payloads, and draft discard live in sibling lanes
// (formChanges, saveDelete, crudOperations); generate's dirty-gate only
// clicks the add buttons to arm the draft — it asserts none of the binding
// semantics below.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settlements from './Settlements.jsx';

// Module-level mock store for useEntityManagement — vi.mock captures this
// object by reference. Tests mutate `items` before rendering so the
// component reads fresh state.
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

// Renders the list view and opens the new-settlement modal.
const openNewSettlementModal = () => {
  const result = render(<Settlements campaignName="test" />);
  fireEvent.click(screen.getByRole('button', { name: /new settlement/i }));
  return result;
};

const rowTypes = [
  {
    label: 'service',
    addButton: /add service/i,
    removeTitle: 'Remove service',
    rows: () => screen.getAllByPlaceholderText('Business name'),
  },
  {
    label: 'NPC',
    addButton: /add npc/i,
    removeTitle: 'Remove NPC',
    rows: () => screen.getAllByPlaceholderText('NPC name'),
  },
  {
    label: 'rumor',
    addButton: /add rumor/i,
    removeTitle: 'Remove rumor',
    rows: () => screen.getAllByTestId(/preview-toggle-settlement-rumor-/),
  },
];

describe('Settlements - service, NPC, and rumor rows', () => {
  beforeEach(() => {
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

  it.each(rowTypes)(
    'binds $label rows by index across add, edit, remove, and re-add',
    ({ addButton, removeTitle, rows }) => {
      openNewSettlementModal();
      const add = () => fireEvent.click(screen.getByRole('button', { name: addButton }));
      const remove = (i) => fireEvent.click(screen.getAllByTitle(removeTitle)[i]);

      add();
      expect(rows()).toHaveLength(1); // a new modal starts with no rows
      fireEvent.change(rows()[0], { target: { value: 'First' } });

      add();
      expect(rows()[1]).toHaveValue(''); // second row is independent of the first
      fireEvent.change(rows()[1], { target: { value: 'Second' } });
      expect(rows()[0]).toHaveValue('First');

      remove(0);
      expect(rows()).toHaveLength(1);
      expect(rows()[0]).toHaveValue('Second'); // removal targets the clicked row

      add();
      expect(rows()).toHaveLength(2);
      expect(rows()[1]).toHaveValue(''); // re-added row starts blank
    },
  );

  it('links the type, role, and description fields of service and NPC rows', () => {
    const { container } = openNewSettlementModal();
    fireEvent.click(screen.getByRole('button', { name: /add service/i }));
    fireEvent.click(screen.getByRole('button', { name: /add npc/i }));

    // The type select is the modal's only field without an accessible name or
    // placeholder (size/threat selects are labelled elsewhere), so its scoped
    // class is the only handle; every other field is queried by user-visible
    // attributes. Both descriptions share the placeholder "Description…" and
    // appear in service-then-NPC DOM order.
    const svcType = container.querySelector('.settlements-svc-type');
    const [svcDesc, npcDesc] = screen.getAllByPlaceholderText('Description…');
    const npcRole = screen.getByPlaceholderText('Role (e.g., Innkeeper)');
    expect(svcType).toHaveValue('tavern'); // service type default

    fireEvent.change(svcType, { target: { value: 'magic_shop' } });
    fireEvent.change(svcDesc, { target: { value: 'Rare potions' } });
    fireEvent.change(npcRole, { target: { value: 'Innkeeper' } });
    fireEvent.change(npcDesc, { target: { value: 'Knows every gossip' } });

    // Each field round-trips its own edit, proving no handler cross-writes:
    // a field-name mix-up would surface as a mismatched pair below.
    expect(svcType).toHaveValue('magic_shop');
    expect(svcDesc).toHaveValue('Rare potions');
    expect(npcRole).toHaveValue('Innkeeper');
    expect(npcDesc).toHaveValue('Knows every gossip');
  });
});
