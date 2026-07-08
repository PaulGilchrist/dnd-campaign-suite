// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settlements from './Settlements.jsx';

const settlementMockReturn = {
  items: [],
  loading: false,
  loadItems: () => {},
  saveItems: async () => {},
  deleteItem: async () => {},
};

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: () => ({ ...settlementMockReturn }),
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
  generateSettlement: vi.fn().mockResolvedValue({
    name: 'Generated Town',
    size: 'town',
    description: 'A bustling town',
    atmosphere: 'Lively',
    government: 'Council',
    population: '1,500 souls',
    services: [],
    notableNPCs: [],
    rumors: [],
    tags: 'generated',
    notes: '',
    threat: 'Bandits',
  }),
}));

describe('Settlements - service management CRUD', () => {
  const mockUseSettlements = {
    items: [],
    loading: false,
    saveItems: async () => {},
    deleteItem: async () => {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    Object.assign(settlementMockReturn, mockUseSettlements);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds a new service row when Add Service is clicked', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const addSvcBtn = screen.getByRole('button', { name: /add service/i });
    fireEvent.click(addSvcBtn);
    // After adding a service, a remove button should appear
    const removeBtns = screen.getAllByTitle('Remove service');
    expect(removeBtns.length).toBe(1);
  });

  it('changes service type via select', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const addSvcBtn = screen.getByRole('button', { name: /add service/i });
    fireEvent.click(addSvcBtn);
    // The service type select is the first select with value 'tavern' (default)
    const allSelects = document.querySelectorAll('select');
    const svcSelect = Array.from(allSelects).find(s => s.value === 'tavern');
    fireEvent.change(svcSelect, { target: { value: 'blacksmith' } });
    expect(svcSelect.value).toBe('blacksmith');
  });

  it('changes service name via input', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const addSvcBtn = screen.getByRole('button', { name: /add service/i });
    fireEvent.click(addSvcBtn);
    const svcNameInput = screen.getByPlaceholderText('Business name');
    fireEvent.change(svcNameInput, { target: { value: 'The Golden Hammer' } });
    expect(svcNameInput.value).toBe('The Golden Hammer');
  });

  it('changes service description via textarea', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const addSvcBtn = screen.getByRole('button', { name: /add service/i });
    fireEvent.click(addSvcBtn);
    const svcDescTextarea = screen.getByPlaceholderText('Description…');
    fireEvent.change(svcDescTextarea, { target: { value: 'Quality ironwork at fair prices' } });
    expect(svcDescTextarea.value).toBe('Quality ironwork at fair prices');
  });

  it('removes a service when remove button is clicked', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const addSvcBtn = screen.getByRole('button', { name: /add service/i });
    fireEvent.click(addSvcBtn);
    fireEvent.click(addSvcBtn);
    fireEvent.click(addSvcBtn);
    // Remove the middle service
    const removeBtns = screen.getAllByTitle('Remove service');
    expect(removeBtns.length).toBe(3);
    fireEvent.click(removeBtns[1]);
    const remainingBtns = screen.getAllByTitle('Remove service');
    expect(remainingBtns.length).toBe(2);
  });

  it('renders all service type options in the select', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const addSvcBtn = screen.getByRole('button', { name: /add service/i });
    fireEvent.click(addSvcBtn);
    // The service type select is the first select with value 'tavern' (default)
    const allSelects = document.querySelectorAll('select');
    const svcSelect = Array.from(allSelects).find(s => s.value === 'tavern');
    expect(svcSelect).toHaveValue('tavern');
    fireEvent.change(svcSelect, { target: { value: 'inn' } });
    expect(svcSelect.value).toBe('inn');
    fireEvent.change(svcSelect, { target: { value: 'magic_shop' } });
    expect(svcSelect.value).toBe('magic_shop');
    fireEvent.change(svcSelect, { target: { value: 'bank' } });
    expect(svcSelect.value).toBe('bank');
  });
});

describe('Settlements - NPC management CRUD', () => {
  const mockUseSettlements = {
    items: [],
    loading: false,
    saveItems: async () => {},
    deleteItem: async () => {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    Object.assign(settlementMockReturn, mockUseSettlements);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds a new NPC row when Add NPC is clicked', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const addNpcBtn = screen.getByRole('button', { name: /add npc/i });
    fireEvent.click(addNpcBtn);
    const npcNameInputs = screen.getAllByPlaceholderText('NPC name');
    expect(npcNameInputs.length).toBeGreaterThanOrEqual(1);
  });

  it('changes NPC name via input', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const addNpcBtn = screen.getByRole('button', { name: /add npc/i });
    fireEvent.click(addNpcBtn);
    const npcNameInput = screen.getByPlaceholderText('NPC name');
    fireEvent.change(npcNameInput, { target: { value: 'Theron Blackwood' } });
    expect(npcNameInput.value).toBe('Theron Blackwood');
  });

  it('changes NPC role via input', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const addNpcBtn = screen.getByRole('button', { name: /add npc/i });
    fireEvent.click(addNpcBtn);
    const npcRoleInput = screen.getByPlaceholderText(/role/i);
    fireEvent.change(npcRoleInput, { target: { value: 'Innkeeper' } });
    expect(npcRoleInput.value).toBe('Innkeeper');
  });

  it('changes NPC description via textarea', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const addNpcBtn = screen.getByRole('button', { name: /add npc/i });
    fireEvent.click(addNpcBtn);
    const npcDescTextarea = screen.getByPlaceholderText('Description…');
    fireEvent.change(npcDescTextarea, { target: { value: 'A gruff but kind-hearted dwarf' } });
    expect(npcDescTextarea.value).toBe('A gruff but kind-hearted dwarf');
  });

  it('removes an NPC when remove button is clicked', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const addNpcBtn = screen.getByRole('button', { name: /add npc/i });
    fireEvent.click(addNpcBtn);
    fireEvent.click(addNpcBtn);
    // Remove the first NPC
    const removeBtns = screen.getAllByTitle('Remove NPC');
    expect(removeBtns.length).toBe(2);
    fireEvent.click(removeBtns[0]);
    const remainingBtns = screen.getAllByTitle('Remove NPC');
    expect(remainingBtns.length).toBe(1);
  });
});

describe('Settlements - rumor management CRUD', () => {
  const mockUseSettlements = {
    items: [],
    loading: false,
    saveItems: async () => {},
    deleteItem: async () => {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    Object.assign(settlementMockReturn, mockUseSettlements);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds a new rumor when Add Rumor is clicked', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const addRumorBtn = screen.getByRole('button', { name: /add rumor/i });
    fireEvent.click(addRumorBtn);
    const rumorTextareas = screen.getAllByRole('textbox');
    expect(rumorTextareas.length).toBeGreaterThanOrEqual(1);
  });

  it('changes rumor text via PreviewToggle', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const addRumorBtn = screen.getByRole('button', { name: /add rumor/i });
    fireEvent.click(addRumorBtn);
    // After adding a rumor, there are textareas: government, description, atmosphere, rumor, notes
    const allTextareas = document.querySelectorAll('textarea');
    const rumorTextarea = allTextareas[allTextareas.length - 2]; // second to last (before notes)
    fireEvent.change(rumorTextarea, { target: { value: 'The old mine has been reopened' } });
    expect(rumorTextarea.value).toBe('The old mine has been reopened');
  });

  it('removes a rumor when remove button is clicked', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const addRumorBtn = screen.getByRole('button', { name: /add rumor/i });
    fireEvent.click(addRumorBtn);
    fireEvent.click(addRumorBtn);
    // Remove the first rumor
    const removeBtns = screen.getAllByTitle('Remove rumor');
    expect(removeBtns.length).toBe(2);
    fireEvent.click(removeBtns[0]);
    const remainingBtns = screen.getAllByTitle('Remove rumor');
    expect(remainingBtns.length).toBe(1);
  });
});
