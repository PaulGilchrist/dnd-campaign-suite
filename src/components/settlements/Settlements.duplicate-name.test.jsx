// @maintained-by-ai: 2026-10-14
// Lane: duplicate-name guard only (Settlements.jsx hasDuplicateName + inline error).
// Collisions block save with an inline error and keep the modal open; editing an
// existing settlement under its own name must never trip the guard; server-side
// duplicate rejections surface inline. Happy-path saves live in the saveDelete lane.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settlements from './Settlements.jsx';

const DUPLICATE_ERROR = 'A settlement with that name already exists';

// Module-level mock store for useEntityManagement — vi.mock closure captures this object.
const settlementMockStore = {
  items: [],
  loadItems: vi.fn(),
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

describe('Settlements - duplicate-name guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveSettlement.mockResolvedValue({ success: true });
    settlementMockStore.loadItems.mockResolvedValue(undefined);
    settlementMockStore.items = [{ name: 'QA Riverside Hamlet', size: 'village' }];
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const openNewSettlement = () => {
    fireEvent.click(screen.getByRole('button', { name: /new settlement/i }));
  };

  const openEditSettlement = (name) => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`edit settlement: ${name}`, 'i') }));
  };

  const typeSetName = (name) => {
    fireEvent.change(screen.getByRole('textbox', { name: /name\s?\*/i }), {
      target: { value: name },
    });
  };

  const clickSave = () => {
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
  };

  it.each([
    ['an exact collision', 'QA Riverside Hamlet'],
    ['a case-insensitive collision', 'qa riverside hamlet'],
    ['a whitespace-padded collision', '  QA Riverside Hamlet  '],
  ])('blocks creating a new settlement with %s: inline error, modal stays open, never saves', (_case, name) => {
    render(<Settlements campaignName="test" />);

    openNewSettlement();
    typeSetName(name);
    clickSave();

    expect(screen.getByText(DUPLICATE_ERROR)).toBeInTheDocument();
    expect(mockSaveSettlement).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /name\s?\*/i })).toHaveValue(name);
  });

  it('blocks renaming an edited settlement onto another settlement name', () => {
    settlementMockStore.items = [
      { name: 'QA Riverside Hamlet' },
      { name: 'Ironhaven' },
    ];
    render(<Settlements campaignName="test" />);

    openEditSettlement('Ironhaven');
    typeSetName('QA RIVERSIDE HAMLET');
    clickSave();

    expect(screen.getByText(DUPLICATE_ERROR)).toBeInTheDocument();
    expect(mockSaveSettlement).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
  });

  it('allows saving an edit under its own name without tripping the guard', async () => {
    settlementMockStore.items = [
      { name: 'QA Riverside Hamlet' },
      { name: 'Ironhaven' },
    ];
    render(<Settlements campaignName="test" />);

    openEditSettlement('Ironhaven');
    typeSetName('Ironhaven');
    fireEvent.change(screen.getByTestId('preview-toggle-settlement-notes'), {
      target: { value: 'Still mine' },
    });
    clickSave();

    await waitFor(() => {
      expect(mockSaveSettlement).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({ name: 'Ironhaven', notes: 'Still mine' }),
        'Ironhaven'
      );
    });
    expect(screen.queryByText(DUPLICATE_ERROR)).not.toBeInTheDocument();
  });

  it('clears the duplicate-name error when the modal is closed and reopened', () => {
    render(<Settlements campaignName="test" />);

    openNewSettlement();
    typeSetName('QA Riverside Hamlet');
    clickSave();
    expect(screen.getByText(DUPLICATE_ERROR)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    openNewSettlement();
    expect(screen.queryByText(DUPLICATE_ERROR)).not.toBeInTheDocument();
  });

  it('surfaces a server-side rejection message inline and keeps the modal open', async () => {
    mockSaveSettlement.mockRejectedValue(new Error(DUPLICATE_ERROR));

    render(<Settlements campaignName="test" />);

    openNewSettlement();
    typeSetName('Brand New Hamlet');
    clickSave();

    await waitFor(() => {
      expect(screen.getByText(DUPLICATE_ERROR)).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
  });
});
