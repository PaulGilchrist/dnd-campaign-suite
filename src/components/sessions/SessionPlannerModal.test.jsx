import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SessionPlannerModal from './SessionPlannerModal.jsx';

// Stub clipboard (jsdom does not provide navigator.clipboard by default)
beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn(async () => {}) },
  });
});

const baseFormData = {
  name: 'Session 7',
  date: '',
  status: 'planned',
  summary: '',
  links: { maps: ['Cave'], encounters: [], npcs: [], quests: [], settlements: [], notes: [] },
  contingencies: [],
  checklist: [
    { id: 'auto-map-cave', label: 'Cave set as active map', auto: true, done: false },
    { id: 'auto-map-cave-fog', label: 'Fog of war reset', auto: true, done: false },
  ],
};

function renderModal(overrides = {}) {
  const props = {
    formData: baseFormData,
    editingSession: { name: 'Session 7', status: 'planned' },
    otherSessions: [{ name: 'Session 8' }],
    resourceOptions: {
      maps: [{ value: 'Cave', label: 'Cave' }, { value: 'Keep', label: 'Keep' }],
      encounters: [{ value: 'Cave Defenders', label: 'Cave Defenders' }],
      npcs: [{ value: 'Grixxa', label: 'Grixxa' }],
      quests: [], settlements: [], notes: [],
    },
    characters: [{ name: 'Aragorn', level: 5 }],
    campaignName: 'test-campaign',
    saving: false,
    deleting: false,
    error: null,
    onClose: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onFormChange: vi.fn(),
    onAddLink: vi.fn(),
    onRemoveLink: vi.fn(),
    onMoveLink: vi.fn(),
    onQuickAction: vi.fn(),
    onAddContingency: vi.fn(),
    onContingencyChange: vi.fn(),
    onRemoveContingency: vi.fn(),
    onToggleChecklist: vi.fn(),
    onAddChecklistItem: vi.fn(),
    onRemoveChecklistItem: vi.fn(),
    onMarkPlayed: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<SessionPlannerModal {...props} />) };
}

describe('SessionPlannerModal', () => {
  it('renders linked resource chips with quick actions', () => {
    renderModal();
    expect(screen.getByText('Cave')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /activate/i })).toBeInTheDocument();
  });

  it('toggles a checklist item and updates the progress label', () => {
    renderModal();
    expect(screen.getByText(/0 of 2 ready/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    // onToggleChecklist is called by id; label is controlled by parent.
    // Also verify the checkbox reflects the checked value passed back:
    const checkedForm = { ...baseFormData, checklist: baseFormData.checklist.map((c, i) => i === 0 ? { ...c, done: true } : c) };
    renderModal({ formData: checkedForm });
    expect(screen.getByText(/1 of 2 ready/i)).toBeInTheDocument();
  });

  it('calls onQuickAction for maps with the linked name', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /activate/i }));
    expect(props.onQuickAction).toHaveBeenCalledWith('maps', 'Cave');
  });

  it('renders contingency If → then rows with branch selector', () => {
    const formData = {
      ...baseFormData,
      contingencies: [{ id: 'c1', ifText: 'Players parley', thenText: 'Grixxa offers a deal', branch: 'negotiate' }],
    };
    const { container, props } = renderModal({ formData });
    expect(screen.getByDisplayValue('Players parley')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Grixxa offers a deal')).toBeInTheDocument();
    expect(container.querySelector('.session-branch-negotiate')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/contingency 1 branch/i), { target: { value: 'failure' } });
    expect(props.onContingencyChange).toHaveBeenCalledWith('c1', 'branch', 'failure');
  });

  it('adds a contingency when Add Contingency is clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /add contingency/i }));
    expect(props.onAddContingency).toHaveBeenCalled();
  });

  it('adds a custom checklist item', () => {
    const { props } = renderModal();
    fireEvent.change(screen.getByLabelText(/new checklist item/i), { target: { value: 'Have initiative cards ready' } });
    fireEvent.click(screen.getByRole('button', { name: /add$/i }));
    expect(props.onAddChecklistItem).toHaveBeenCalledWith('Have initiative cards ready');
  });

  it('shows the auto badge on auto items but not on custom items', () => {
    const formData = {
      ...baseFormData,
      checklist: [
        { id: 'auto-map-cave', label: 'Cave set as active map', auto: true, done: false },
        { id: 'custom-1', label: 'Print handout', auto: false, done: false },
      ],
    };
    const { container } = renderModal({ formData });
    expect(screen.getByText('auto')).toBeInTheDocument();
    // one remove button per custom item only
    expect(container.querySelectorAll('.sessions-checklist-remove')).toHaveLength(1);
  });

  it('copies a composed XP prompt to the clipboard', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /suggest xp budget/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const text = navigator.clipboard.writeText.mock.calls[0][0];
    expect(text).toContain('Session 7');
    expect(text).toContain('Aragorn'.slice(0, 0) + 'average level 5');
    await waitFor(() => expect(screen.getByText(/prompt copied/i)).toBeInTheDocument());
  });

  it('copies a composed rumor prompt including campaign name', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /generate rumors/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(navigator.clipboard.writeText.mock.calls[0][0]).toContain('test-campaign');
  });

  it('shows Mark as Played only for a planned session', () => {
    const { unmount } = renderModal();
    expect(screen.getByRole('button', { name: /mark as played/i })).toBeInTheDocument();
    unmount();

    const playedSession = { name: 'Session 7', status: 'played' };
    renderModal({
      editingSession: playedSession,
      formData: { ...baseFormData, status: 'played' },
    });
    expect(screen.queryByRole('button', { name: /mark as played/i })).not.toBeInTheDocument();
  });

  it('calls onMarkPlayed when Mark as Played is clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /mark as played/i }));
    expect(props.onMarkPlayed).toHaveBeenCalled();
  });

  it('calls onMoveLink with the target session name', () => {
    const { props } = renderModal();
    const moveSelect = screen.getByLabelText(/move cave to another session/i);
    fireEvent.change(moveSelect, { target: { value: 'Session 8' } });
    expect(props.onMoveLink).toHaveBeenCalledWith('maps', 'Cave', 'Session 8');
  });

  it('unlinks a resource via the unlink button', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /unlink cave/i }));
    expect(props.onRemoveLink).toHaveBeenCalledWith('maps', 'Cave');
  });
});
