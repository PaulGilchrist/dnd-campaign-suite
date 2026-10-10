// Regression tests for duplicate-name overwrite: creating a settlement whose
// name collides case-insensitively with an existing one must show an inline
// error, keep the modal open, and never call saveSettlement
// (mirrors the Quests/Factions duplicate-name guards).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settlements from './Settlements.jsx';

// Module-level mock store for useEntityManagement — vi.mock closure captures this object.
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
  generateSettlement: vi.fn().mockResolvedValue({}),
}));

const mockSaveSettlement = vi.fn();
vi.mock('../../services/campaign/settlementsService.js', () => ({
  loadSettlements: vi.fn(),
  saveSettlement: (...args) => mockSaveSettlement(...args),
  deleteSettlement: vi.fn(),
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

const openNewSettlement = () => {
  fireEvent.click(screen.getByRole('button', { name: /new settlement/i }));
};

const typeSetName = (name) => {
  fireEvent.change(screen.getByRole('textbox', { name: /name\s?\*/i }), {
    target: { value: name },
  });
};

describe('Settlements - duplicate-name guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveSettlement.mockResolvedValue({ success: true });
    settlementMockStore.loadItems.mockResolvedValue(undefined);
    settlementMockStore.items = [
      makeSettlement('QA Riverside Hamlet', { population: '1,200 souls' }),
    ];
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an inline error and never saves when a new settlement name collides exactly', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);

    openNewSettlement();
    typeSetName('QA Riverside Hamlet');
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByText('A settlement with that name already exists')).toBeInTheDocument();
    expect(mockSaveSettlement).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /name\s?\*/i })).toHaveValue('QA Riverside Hamlet');
  });

  it('rejects a case-insensitive collision without saving', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);

    openNewSettlement();
    typeSetName('qa riverside hamlet');
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByText('A settlement with that name already exists')).toBeInTheDocument();
    expect(mockSaveSettlement).not.toHaveBeenCalled();
  });

  it('rejects renaming an edited settlement onto another settlement name', () => {
    settlementMockStore.items = [
      makeSettlement('QA Riverside Hamlet'),
      makeSettlement('Ironhaven'),
    ];
    render(<Settlements campaignName="test" onBack={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /edit settlement: ironhaven/i }));
    fireEvent.change(screen.getByDisplayValue('Ironhaven'), { target: { value: 'QA RIVERSIDE HAMLET' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByText('A settlement with that name already exists')).toBeInTheDocument();
    expect(mockSaveSettlement).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
  });

  it('allows saving an edited settlement under its own name', async () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /edit settlement: qa riverside hamlet/i }));
    fireEvent.change(screen.getByTestId('preview-toggle-settlement-notes'), {
      target: { value: 'Still mine' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockSaveSettlement).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({ name: 'QA Riverside Hamlet', notes: 'Still mine' }),
        'QA Riverside Hamlet'
      );
    });
    expect(screen.queryByText('A settlement with that name already exists')).not.toBeInTheDocument();
  });

  it('allows creating a settlement with a unique name', async () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);

    openNewSettlement();
    typeSetName('Brand New Hamlet');
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockSaveSettlement).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({ name: 'Brand New Hamlet' }),
        undefined
      );
    });
    expect(screen.queryByText('A settlement with that name already exists')).not.toBeInTheDocument();
  });

  it('clears the duplicate-name error when the modal is closed and reopened', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);

    openNewSettlement();
    typeSetName('QA Riverside Hamlet');
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(screen.getByText('A settlement with that name already exists')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    openNewSettlement();
    expect(screen.queryByText('A settlement with that name already exists')).not.toBeInTheDocument();
  });

  it('surfaces a server-side rejection message inline and keeps the modal open', async () => {
    mockSaveSettlement.mockRejectedValue(new Error('A settlement with that name already exists'));

    render(<Settlements campaignName="test" onBack={() => {}} />);

    openNewSettlement();
    typeSetName('Server Collision Hamlet');
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText('A settlement with that name already exists')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
  });
});
