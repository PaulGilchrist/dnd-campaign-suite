// @maintained-by-ai 2026-11-26
// Core Quests-planner behaviors: GM-only gate, header/search/loading/empty
// states, new/edit modal lifecycle (clean-draft close, form reset), Save
// gating (blank name, in-flight, failure), save payloads (create + update),
// list rendering, and the in-flight delete button state.
// Owned by sibling files — do NOT duplicate here:
//   duplicate-name guard (live banner + server-400 lane) → Quests.duplicate-name.test.jsx
//   delete dialog confirm/cancel/failure + close-on-success → Quests.delete-close.test.jsx
//   409 conflict reload / reload-discard toll → Quests.conflict-reload.test.jsx, Quests.reload-discard-confirm.test.jsx
//   SSE list sync → Quests.sse-sync.test.jsx
//   markdown row preview + 100-char truncation → Quests.preview-markdown.test.jsx
//   .ct-* kit classes + byte-pinned form ids → Quests.kit-classes.test.jsx
//   Print Quest Board handout → Quests.print-board.test.jsx
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Quests from './Quests.jsx';

const mockUseQuestsManagement = vi.fn();

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: (campaignName, config) => mockUseQuestsManagement(campaignName, config),
}));

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

const defaultProps = {
  campaignName: 'test-campaign',
  isLocalhost: true,
};

const quest = (overrides = {}) => ({
  id: 'quest-1',
  name: 'Find the Lost Sword',
  status: 'active',
  description: '',
  rewards: '',
  notes: '',
  ...overrides,
});

// Map form fields to their queries in the quest modal.
const field = {
  name: () => screen.getByRole('textbox', { name: /Name/ }),
  status: () => screen.getByRole('combobox', { name: 'Quest status' }),
  description: () => screen.getByTestId('field-quest-description'),
  rewards: () => screen.getByTestId('field-quest-rewards'),
  notes: () => screen.getByTestId('field-quest-notes'),
};

function fillQuestForm(values) {
  for (const [key, value] of Object.entries(values)) {
    fireEvent.change(field[key](), { target: { value } });
  }
}

function expectFormValues(values) {
  for (const [key, value] of Object.entries(values)) {
    expect(field[key]()).toHaveValue(value);
  }
}

const openNewModal = () => fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
const openEditModal = (name) => fireEvent.click(screen.getByRole('button', { name: `Edit quest: ${name}` }));

const DEFAULT_FORM = { name: '', status: 'active', description: '', rewards: '', notes: '' };

function renderWithQuests(quests = [], managementOverrides = {}, componentProps = {}) {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockResolvedValue(undefined);
  mockUseQuestsManagement.mockReturnValue({
    items: quests,
    loading: false,
    loadItems: vi.fn(),
    saveItems: mockSave,
    deleteItem: mockDelete,
    ...managementOverrides,
  });
  return {
    ...render(<Quests {...defaultProps} {...componentProps} />),
    mockSave,
    mockDelete,
  };
}

describe('Quests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing for non-GM visitors (isLocalhost false)', () => {
    renderWithQuests([quest()], {}, { isLocalhost: false });
    expect(screen.queryByRole('heading', { name: /Quests/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New Quest/ })).not.toBeInTheDocument();
  });

  it('renders the header: title, New Quest button, and search input with a real-ellipsis placeholder', () => {
    renderWithQuests([]);
    expect(screen.getByRole('heading', { name: /Quests/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Quest/ })).toBeInTheDocument();
    const search = screen.getByRole('textbox', { name: /Search Quests/ });
    expect(search).toHaveAttribute('placeholder', 'Search Quests…');
  });

  it('shows a loading state whose text carries a real ellipsis, not a literal \\u2026 escape', () => {
    renderWithQuests([], { loading: true });
    const loading = screen.getByText(/Loading quests/);
    expect(loading.textContent).toContain('Loading quests…');
    expect(loading.textContent).not.toContain('\\u2026');
  });

  it('shows an empty state when there are no quests', () => {
    renderWithQuests([]);
    expect(screen.getByText(/No quests yet/)).toBeInTheDocument();
  });

  it('shows the no-results message with the query, but not for whitespace-only searches', () => {
    renderWithQuests([quest()]);

    fireEvent.change(screen.getByRole('textbox', { name: /Search Quests/ }), { target: { value: 'dragons' } });
    expect(screen.getByText(/No quests found matching/).textContent).toContain('dragons');

    fireEvent.change(screen.getByRole('textbox', { name: /Search Quests/ }), { target: { value: '   ' } });
    expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
    expect(screen.queryByText(/No quests found matching/)).not.toBeInTheDocument();
  });

  it('opens and closes the new-quest modal via Cancel or Close (X) on a clean draft, but not via overlay click', async () => {
    renderWithQuests([]);

    openNewModal();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

    // Clean draft: the discard toll is skipped (resolves silently true); the
    // close settles through the shared hook's await seam → waitFor, not sync.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'New Quest' })).not.toBeInTheDocument()
    );
    expect(screen.queryByRole('dialog', { name: 'Discard Changes?' })).toBeNull();

    openNewModal();
    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'New Quest' })).not.toBeInTheDocument()
    );

    openNewModal();
    fireEvent.click(document.querySelector('.ct-modal-overlay'));
    expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();
  });

  it('disables the save button until the name is non-blank', () => {
    renderWithQuests([]);
    openNewModal();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    fillQuestForm({ name: '   ' });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    fillQuestForm({ name: 'Find the Lost Sword' });
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('disables the Cancel and Save buttons while a save is in progress', () => {
    renderWithQuests([], { saveItems: vi.fn().mockImplementation(() => new Promise(() => {})) });

    openNewModal();
    fillQuestForm({ name: 'New Quest' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('saves a new quest with all form fields, closing the modal, and resets the form on reopen', async () => {
    const { mockSave } = renderWithQuests([quest({ id: 'quest-1', name: 'Existing Quest' })]);

    openNewModal();
    fillQuestForm({
      name: 'New Quest',
      status: 'completed',
      description: 'New desc',
      rewards: '50 gold',
      notes: 'New notes',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'New Quest' })).not.toBeInTheDocument();

    const savedQuests = mockSave.mock.calls[0][0];
    expect(savedQuests.find((q) => q.id === 'quest-1').name).toBe('Existing Quest');
    const newQuest = savedQuests.find((q) => q.name === 'New Quest');
    expect(newQuest.id).toBeDefined();
    expect(newQuest).toMatchObject({
      status: 'completed',
      description: 'New desc',
      rewards: '50 gold',
      notes: 'New notes',
    });

    openNewModal();
    expectFormValues(DEFAULT_FORM);
  });

  it('logs the error, keeps the modal open, and re-enables save when saving fails', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    renderWithQuests([], { saveItems: vi.fn().mockRejectedValue(new Error('Save failed')) });

    openNewModal();
    fillQuestForm({ name: 'New Quest' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Failed to save quest:', expect.any(Error)));
    expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('renders each quest row with its name and status pill', () => {
    renderWithQuests([
      quest({ id: 'quest-1', name: 'Find the Lost Sword', status: 'active' }),
      quest({ id: 'quest-2', name: 'Defeat the Dragon', status: 'completed' }),
      quest({ id: 'quest-3', name: 'Rescue the Princess', status: 'failed' }),
    ]);

    expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
    expect(screen.getByText('Defeat the Dragon')).toBeInTheDocument();
    expect(screen.getByText('Rescue the Princess')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('opens the edit modal when a quest row is clicked or activated via Enter or Space', () => {
    renderWithQuests([quest({ name: 'Clickable Quest' })]);

    openEditModal('Clickable Quest');
    expect(screen.getByRole('heading', { name: 'Edit Quest' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const listItem = screen.getByRole('button', { name: 'Edit quest: Clickable Quest' });

    fireEvent.keyDown(listItem, { key: 'Enter' });
    expect(screen.getByRole('heading', { name: 'Edit Quest' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.keyDown(listItem, { key: ' ' });
    expect(screen.getByRole('heading', { name: 'Edit Quest' })).toBeInTheDocument();
  });

  it('filters quests by name (case-insensitive) and does not search descriptions', () => {
    renderWithQuests([
      quest({ id: 'quest-1', name: 'Find the Lost Sword', description: 'Search for the sword' }),
      quest({ id: 'quest-2', name: 'Defeat the Dragon', description: 'Slay the dragon' }),
    ]);

    const searchInput = screen.getByRole('textbox', { name: /Search Quests/ });

    fireEvent.change(searchInput, { target: { value: 'dragon' } });
    expect(screen.getByText('Defeat the Dragon')).toBeInTheDocument();
    expect(screen.queryByText('Find the Lost Sword')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'find the lost sword' } });
    expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
    expect(screen.queryByText('Defeat the Dragon')).not.toBeInTheDocument();
  });

  it('shows a clear-search button only with a query and restores all quests when clicked', () => {
    renderWithQuests([
      quest({ id: 'quest-1', name: 'Quest One' }),
      quest({ id: 'quest-2', name: 'Quest Two' }),
    ]);

    const searchInput = screen.getByRole('textbox', { name: /Search Quests/ });
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'one' } });
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
    expect(screen.getByText('Quest One')).toBeInTheDocument();
    expect(screen.queryByText('Quest Two')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(searchInput.value).toBe('');
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
    expect(screen.getByText('Quest One')).toBeInTheDocument();
    expect(screen.getByText('Quest Two')).toBeInTheDocument();
  });

  it('pre-populates the edit modal with the quest data, shows a Delete button, and uses real-ellipsis placeholders', () => {
    renderWithQuests([
      quest({
        name: 'Find the Lost Sword',
        status: 'completed',
        description: 'An old quest',
        rewards: '100 gold',
        notes: 'Almost done',
      }),
    ]);

    openEditModal('Find the Lost Sword');
    expect(screen.getByRole('heading', { name: 'Edit Quest' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expectFormValues({
      name: 'Find the Lost Sword',
      status: 'completed',
      description: 'An old quest',
      rewards: '100 gold',
      notes: 'Almost done',
    });
    expect(field.description()).toHaveAttribute('placeholder', 'Describe the quest…');
    expect(field.rewards()).toHaveAttribute('placeholder', 'Describe rewards…');
    expect(field.notes()).toHaveAttribute('placeholder', 'Additional notes…');
    expect(document.body.textContent).not.toContain('\\u2026');
  });

  it('disables the delete button while a delete is in progress and closes the modal after', async () => {
    let deleteResolve;
    renderWithQuests([quest({ name: 'Delete Test Quest' })], {
      deleteItem: vi.fn().mockImplementation(() => new Promise((resolve) => { deleteResolve = resolve; })),
    });

    openEditModal('Delete Test Quest');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // The footer button arms the shared in-app dialog; the write happens ONLY
    // after `Yes, Delete Permanently` (QA backlog 2026-11-24).
    const dialog = await screen.findByRole('dialog', { name: 'Delete Quest' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, Delete Permanently' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Deleting/ })).toBeDisabled());

    await act(async () => deleteResolve());
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(document.querySelector('.ct-modal-overlay')).toBeNull();
  });

  it('saves edited quest data while leaving other quests untouched', async () => {
    const { mockSave } = renderWithQuests([
      quest({ id: 'quest-1', name: 'Original Name', description: 'Original desc', rewards: '10 gold' }),
      quest({ id: 'quest-2', name: 'Untouched Quest' }),
    ]);

    openEditModal('Original Name');
    fillQuestForm({
      name: 'Updated Name',
      status: 'completed',
      description: 'Updated desc',
      rewards: '100 gold',
      notes: 'Updated notes',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    const savedQuests = mockSave.mock.calls[0][0];
    expect(savedQuests.find((q) => q.id === 'quest-1')).toMatchObject({
      name: 'Updated Name',
      status: 'completed',
      description: 'Updated desc',
      rewards: '100 gold',
      notes: 'Updated notes',
    });
    expect(savedQuests.find((q) => q.id === 'quest-2').name).toBe('Untouched Quest');
  });
});
