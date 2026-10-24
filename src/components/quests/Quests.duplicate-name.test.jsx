// @maintained-by-ai: 2026-10-24
// Duplicate-name banner lifecycle for the Quests modal (backlog 2026-10-13:
// banner never cleared while typing). Contract: a duplicate-name Save click
// shows the inline error without persisting; EDITING the name clears the
// banner immediately (before any Save press); resubmitting the duplicate
// re-shows it (guard not weakened); fixing the name saves normally; a
// server-surfaced duplicate error clears on name change too, while unrelated
// save failures stay until Save/Close. Click-guard semantics are owned by
// Quests.test.jsx's "duplicate-name guard" block — this file owns the
// clear-on-name-change arc.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Quests from './Quests.jsx';

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: vi.fn(),
}));
import { useEntityManagement } from '../../hooks/useEntityManagement.js';

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange, placeholder, label }) => (
    <div data-testid={`preview-toggle-${id}`}>
      <label>{label}</label>
      <textarea
        data-testid={`field-${id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  ),
}));

const DUPLICATE_ERROR = 'A quest with that name already exists';

const defaultProps = {
  campaignName: 'test-campaign',
  isLocalhost: true,
  onBack: vi.fn(),
};

const nameInput = () => screen.getByRole('textbox', { name: /Name/ });
const saveButton = () => screen.getByRole('button', { name: 'Save' });

function renderWithQuests(quests, managementOverrides = {}) {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  useEntityManagement.mockReturnValue({
    items: quests,
    loading: false,
    loadItems: vi.fn(),
    saveItems: mockSave,
    deleteItem: vi.fn(),
    ...managementOverrides,
  });
  return { ...render(<Quests {...defaultProps} />), mockSave };
}

const quest = (overrides = {}) => ({
  id: 'quest-1',
  name: 'The Lost Artifact',
  status: 'active',
  description: '',
  rewards: '',
  notes: '',
  ...overrides,
});

const openNewModal = () => fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));

describe('Quests duplicate-name error clears on name change', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('duplicate Save shows the error, editing the name clears it instantly, and resubmitting the duplicate re-shows it', async () => {
    const { mockSave } = renderWithQuests([quest()]);

    openNewModal();
    fireEvent.change(nameInput(), { target: { value: 'the lost artifact' } });
    fireEvent.click(saveButton());

    expect(screen.getByText(DUPLICATE_ERROR)).toBeInTheDocument();
    expect(mockSave).not.toHaveBeenCalled();

    // Fixing the name clears the banner immediately — no Save press needed.
    fireEvent.change(nameInput(), { target: { value: 'the lost artifact II' } });
    expect(screen.queryByText(DUPLICATE_ERROR)).not.toBeInTheDocument();
    expect(saveButton()).not.toBeDisabled();

    // Retyping the duplicate keeps the banner gone until the next Save press…
    fireEvent.change(nameInput(), { target: { value: 'THE LOST ARTIFACT' } });
    expect(screen.queryByText(DUPLICATE_ERROR)).not.toBeInTheDocument();

    // …and resubmitting re-shows it, still without persisting.
    fireEvent.click(saveButton());
    expect(screen.getByText(DUPLICATE_ERROR)).toBeInTheDocument();
    expect(mockSave).not.toHaveBeenCalled();

    // A unique name then saves cleanly.
    fireEvent.change(nameInput(), { target: { value: 'Unique Rescue Quest' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(DUPLICATE_ERROR)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'New Quest' })).not.toBeInTheDocument();
  });

  it('clears the banner on name change when renaming an existing quest onto another quest', () => {
    renderWithQuests([
      quest({ id: 'quest-1', name: 'The Lost Artifact' }),
      quest({ id: 'quest-2', name: 'QA Parity Quest' }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Edit quest: QA Parity Quest' }));
    fireEvent.change(nameInput(), { target: { value: 'the lost artifact' } });
    fireEvent.click(saveButton());
    expect(screen.getByText(DUPLICATE_ERROR)).toBeInTheDocument();

    fireEvent.change(nameInput(), { target: { value: 'QA Parity Quest Renamed' } });
    expect(screen.queryByText(DUPLICATE_ERROR)).not.toBeInTheDocument();
    expect(saveButton()).not.toBeDisabled();
  });

  it('clears a server-surfaced duplicate error on name change but keeps unrelated save failures visible', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Locally-loaded list has no collision (stale-list race), server 400s instead.
    const serverReject = vi.fn().mockRejectedValueOnce(new Error(DUPLICATE_ERROR));
    renderWithQuests([], { saveItems: serverReject });

    openNewModal();
    fireEvent.change(nameInput(), { target: { value: 'Race Condition Quest' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByText(DUPLICATE_ERROR)).toBeInTheDocument());
    expect(serverReject).toHaveBeenCalledTimes(1);

    fireEvent.change(nameInput(), { target: { value: 'Race Condition Quest Fixed' } });
    expect(screen.queryByText(DUPLICATE_ERROR)).not.toBeInTheDocument();

    // Unrelated failure: editing the name must NOT wipe it.
    serverReject.mockRejectedValueOnce(new Error('Network unavailable'));
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByText('Network unavailable')).toBeInTheDocument());

    fireEvent.change(nameInput(), { target: { value: 'Still Broken Quest' } });
    expect(screen.getByText('Network unavailable')).toBeInTheDocument();
    errorSpy.mockRestore();
  });
});
