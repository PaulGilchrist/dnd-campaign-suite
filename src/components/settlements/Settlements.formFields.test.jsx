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
          aria-label={label || ''}
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

describe('Settlements - form field changes (non-size)', () => {
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

  it('updates name field when changed', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: 'My New Settlement' } });
    expect(nameInput.value).toBe('My New Settlement');
  });

  it('updates population field when changed', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const popInput = screen.getByPlaceholderText(/souls/i);
    fireEvent.change(popInput, { target: { value: '5,000 souls' } });
    expect(popInput.value).toBe('5,000 souls');
  });

  it('updates tags field when changed', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const tagsInput = screen.getByLabelText(/tags/i);
    fireEvent.change(tagsInput, { target: { value: 'coastal, trade, dwarven' } });
    expect(tagsInput.value).toBe('coastal, trade, dwarven');
  });

  it('updates government via PreviewToggle', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const govTextarea = screen.getByTestId('preview-toggle-settlement-government');
    fireEvent.change(govTextarea, { target: { value: 'Monarchy ruled by Queen Elara' } });
    expect(govTextarea.value).toBe('Monarchy ruled by Queen Elara');
  });

  it('updates description via PreviewToggle', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const descTextarea = screen.getByTestId('preview-toggle-settlement-description');
    fireEvent.change(descTextarea, { target: { value: 'A bustling port town' } });
    expect(descTextarea.value).toBe('A bustling port town');
  });

  it('updates atmosphere via PreviewToggle', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const atmTextarea = screen.getByTestId('preview-toggle-settlement-atmosphere');
    fireEvent.change(atmTextarea, { target: { value: 'Vibrant and colorful' } });
    expect(atmTextarea.value).toBe('Vibrant and colorful');
  });

  it('updates notes via PreviewToggle', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const notesTextarea = screen.getByTestId('preview-toggle-settlement-notes');
    fireEvent.change(notesTextarea, { target: { value: 'GM note: important quest location' } });
    expect(notesTextarea.value).toBe('GM note: important quest location');
  });

  it('clears search when X button is clicked', () => {
    Object.assign(settlementMockReturn, {
      ...mockUseSettlements,
      items: [
        { name: 'Fireport', size: 'town', population: '', tags: '', services: [], description: 'A town of fire' },
      ],
    });
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const searchInput = screen.getByLabelText('Search settlements');
    fireEvent.change(searchInput, { target: { value: 'fire' } });
    expect(screen.getByText('Fireport')).toBeInTheDocument();
    const clearBtn = screen.getByLabelText('Clear search');
    fireEvent.click(clearBtn);
    expect(searchInput.value).toBe('');
    expect(screen.getByText('Fireport')).toBeInTheDocument();
  });
});
