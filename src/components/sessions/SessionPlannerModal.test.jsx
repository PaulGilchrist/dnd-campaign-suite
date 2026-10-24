// @maintained-by-ai: 2026-10-14
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
  links: { maps: ['Cave'], encounters: [], npcs: ['Grixxa'], quests: [], settlements: [], notes: [] },
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
  it('renders linked chips with quick actions wired to onQuickAction', () => {
    const { props } = renderModal();
    expect(screen.getByText('Cave')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /activate/i }));
    expect(props.onQuickAction).toHaveBeenCalledWith('maps', 'Cave');
    // NPCs get their own initiative quick action
    fireEvent.click(screen.getByRole('button', { name: /to initiative/i }));
    expect(props.onQuickAction).toHaveBeenCalledWith('npcs', 'Grixxa');
  });

  it('disables the To Initiative chip when the linked NPC lacks stats (mirrors .npcs-init-btn gate)', () => {
    const { props } = renderModal({
      resourceOptions: {
        maps: [], encounters: [], quests: [], settlements: [], notes: [],
        npcs: [{ value: 'Grixxa', label: 'Grixxa', combatReady: false }],
      },
    });
    const initBtn = screen.getByRole('button', { name: /to initiative/i });
    expect(initBtn).toBeDisabled();
    expect(initBtn).toHaveAttribute('title',
      "Fill in Grixxa's AC and HP (Stats tab) before adding to Initiative");
    fireEvent.click(initBtn);
    expect(props.onQuickAction).not.toHaveBeenCalled();
  });

  it('keeps the To Initiative chip enabled when the linked NPC is combat-ready', () => {
    const { props } = renderModal({
      resourceOptions: {
        maps: [], encounters: [], quests: [], settlements: [], notes: [],
        npcs: [{ value: 'Grixxa', label: 'Grixxa', combatReady: true }],
      },
    });
    const initBtn = screen.getByRole('button', { name: /to initiative/i });
    expect(initBtn).not.toBeDisabled();
    fireEvent.click(initBtn);
    expect(props.onQuickAction).toHaveBeenCalledWith('npcs', 'Grixxa');
  });

  it('moves and unlinks linked resources', () => {
    const { props } = renderModal();
    fireEvent.change(screen.getByLabelText(/move cave to another session/i), { target: { value: 'Session 8' } });
    expect(props.onMoveLink).toHaveBeenCalledWith('maps', 'Cave', 'Session 8');
    fireEvent.click(screen.getByRole('button', { name: /unlink cave/i }));
    expect(props.onRemoveLink).toHaveBeenCalledWith('maps', 'Cave');
  });

  it('toggles checklist items by id and reflects progress from parent state', () => {
    const { props } = renderModal();
    expect(screen.getByText(/0 of 2 ready/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(props.onToggleChecklist).toHaveBeenCalledWith('auto-map-cave');

    const checkedForm = { ...baseFormData, checklist: baseFormData.checklist.map((c, i) => i === 0 ? { ...c, done: true } : c) };
    renderModal({ formData: checkedForm });
    expect(screen.getByText(/1 of 2 ready/i)).toBeInTheDocument();
  });

  it('shows auto badge on auto items and allows removing/adding custom items', () => {
    const formData = {
      ...baseFormData,
      checklist: [...baseFormData.checklist, { id: 'custom-1', label: 'Print handout', auto: false, done: false }],
    };
    const { props, container } = renderModal({ formData });
    // auto badge on each auto item, none on the custom item
    expect(screen.getAllByText('auto')).toHaveLength(2);
    // one remove button per custom item only
    expect(container.querySelectorAll('.sessions-checklist-remove')).toHaveLength(1);
    fireEvent.click(container.querySelector('.sessions-checklist-remove'));
    expect(props.onRemoveChecklistItem).toHaveBeenCalledWith('custom-1');

    fireEvent.change(screen.getByLabelText(/new checklist item/i), { target: { value: 'Have initiative cards ready' } });
    fireEvent.click(screen.getByRole('button', { name: /add$/i }));
    expect(props.onAddChecklistItem).toHaveBeenCalledWith('Have initiative cards ready');
  });

  it('renders contingency If → then rows, changes branch, and adds new ones', () => {
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
    fireEvent.click(screen.getByRole('button', { name: /add contingency/i }));
    expect(props.onAddContingency).toHaveBeenCalled();
  });

  it('copies a composed XP prompt to the clipboard', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /suggest xp budget/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const text = navigator.clipboard.writeText.mock.calls[0][0];
    expect(text).toContain('Session 7');
    expect(text).toContain('average level 5');
    await waitFor(() => expect(screen.getByText(/prompt copied/i)).toBeInTheDocument());
  });

  it('copies a composed rumor prompt including campaign name and linked NPCs', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /generate rumors/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const text = navigator.clipboard.writeText.mock.calls[0][0];
    expect(text).toContain('test-campaign');
    expect(text).toContain('Grixxa');
  });

  it('shows Mark as Played only for a planned session and calls onMarkPlayed', () => {
    const { props, unmount } = renderModal();
    const playedBtn = screen.getByRole('button', { name: /mark as played/i });
    fireEvent.click(playedBtn);
    expect(props.onMarkPlayed).toHaveBeenCalled();
    unmount();

    renderModal({
      editingSession: { name: 'Session 7', status: 'played' },
      formData: { ...baseFormData, status: 'played' },
    });
    expect(screen.queryByRole('button', { name: /mark as played/i })).not.toBeInTheDocument();
  });

  it('shows the New Session title and error banner when creating with an error', () => {
    renderModal({ editingSession: null, formData: { ...baseFormData, name: '' }, error: 'A session with this name already exists' });
    expect(screen.getByRole('heading', { name: /new session/i })).toBeInTheDocument();
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
  });
});
