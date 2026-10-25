// @maintained-by-ai: 2026-10-25
// Duplicate-name banner lifecycle for the Quests modal (backlog 2026-10-13:
// banner never cleared while typing; 2026-10-25: aligned to the Factions
// LIVE-typing pattern). Contract: typing a duplicate name shows the inline
// error banner LIVE (no Save press needed) and disables Save while it
// persists; editing the name to a unique value clears the banner and
// re-enables Save in the same tick; clicking the disabled Save never
// persists; the save-press guard stays as backstop via the server-surfaced
// error lane (stale-list race). Edit flow: renaming onto ANOTHER quest's
// name blocks live; an edit keeping its OWN name never collides.
// Save-disabled-on-empty-name semantics are owned by Quests.test.jsx.
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
const banner = () => document.querySelector('.quests-form-error');

function renderWithQuests(quests, managementOverrides = {}) {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  useEntityManagement.mockReturnValue({
    items: quests,
    loading: false,
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

describe('Quests live duplicate-name guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the banner LIVE while typing a duplicate, disables Save, and clears both in the same tick on a unique name', async () => {
    const { mockSave } = renderWithQuests([quest()]);

    openNewModal();
    expect(banner()).toBeNull();
    expect(saveButton()).toBeDisabled(); // empty name (existing gate)

    // Typing a case-insensitive duplicate blocks WITHOUT any Save press.
    fireEvent.change(nameInput(), { target: { value: 'the lost artifact' } });
    expect(banner()).not.toBeNull();
    expect(screen.getByText(DUPLICATE_ERROR)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    // A disabled Save never persists, banner or not.
    fireEvent.click(saveButton());
    expect(mockSave).not.toHaveBeenCalled();
    expect(screen.getByText(DUPLICATE_ERROR)).toBeInTheDocument();

    // Editing to a unique value clears banner + re-enables Save same tick.
    fireEvent.change(nameInput(), { target: { value: 'the lost artifact II' } });
    expect(banner()).toBeNull();
    expect(saveButton()).not.toBeDisabled();

    // Retyping the duplicate re-blocks LIVE (derived, no sticky one-shot).
    fireEvent.change(nameInput(), { target: { value: 'THE LOST ARTIFACT' } });
    expect(screen.getByText(DUPLICATE_ERROR)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    fireEvent.click(saveButton());
    expect(mockSave).not.toHaveBeenCalled();

    // A unique name then saves cleanly.
    fireEvent.change(nameInput(), { target: { value: 'Unique Rescue Quest' } });
    expect(banner()).toBeNull();
    fireEvent.click(saveButton());
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(DUPLICATE_ERROR)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'New Quest' })).not.toBeInTheDocument();
  });

  it('edit flow: renaming onto another quest blocks live; keeping its own name never collides', async () => {
    const { mockSave } = renderWithQuests([
      quest({ id: 'quest-1', name: 'The Lost Artifact' }),
      quest({ id: 'quest-2', name: 'QA Parity Quest' }),
    ]);

    // Opening an edit on its own name is NOT a self-collision.
    fireEvent.click(screen.getByRole('button', { name: 'Edit quest: QA Parity Quest' }));
    expect(banner()).toBeNull();
    expect(saveButton()).not.toBeDisabled();

    // Renaming onto another quest's name blocks live, before any Save press.
    fireEvent.change(nameInput(), { target: { value: 'the lost artifact' } });
    expect(screen.getByText(DUPLICATE_ERROR)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    fireEvent.click(saveButton());
    expect(mockSave).not.toHaveBeenCalled();

    // Renaming back to its own current name clears the guard (no false positive).
    fireEvent.change(nameInput(), { target: { value: 'QA Parity Quest' } });
    expect(banner()).toBeNull();
    expect(saveButton()).not.toBeDisabled();

    // And a fresh unique rename saves normally.
    fireEvent.change(nameInput(), { target: { value: 'QA Parity Quest Renamed' } });
    expect(banner()).toBeNull();
    fireEvent.click(saveButton());
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
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
