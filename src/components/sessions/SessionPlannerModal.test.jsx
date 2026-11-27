// @maintained-by-ai 2026-11-26
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SessionPlannerModal from './SessionPlannerModal.jsx';

// The footer's RecapButton probes GET /ai/status on mount (backlog 2026-11-21
// FFF) and AiRefineButton owns refineEntity — stub the whole transport lane so
// no test hits the network. Default face: AI configured (happy-path wiring).
// The Write-recap gate faces (AI off, visitor/unsaved-new absence, busy
// spinner) live in SessionPlannerModal.recap-ai-gate.test.jsx; the AI-refine
// lane lives in SessionPlannerModal.ai-refine.test.jsx; the unlink-tooltip
// label fallback lives in SessionPlannerModal.unlink-tooltip.test.jsx.
vi.mock('../../services/ai/aiClient.js', () => ({
  getAiStatus: vi.fn(async () => ({ configured: true })),
  refineEntity: vi.fn(),
}));

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
    banner: null,
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

  it('gates the To Initiative chip on the linked NPC combatReady flag (mirrors .npcs-init-btn)', () => {
    const linkless = { maps: [], encounters: [], quests: [], settlements: [], notes: [] };
    const { unmount } = renderModal({
      resourceOptions: { ...linkless, npcs: [{ value: 'Grixxa', label: 'Grixxa', combatReady: false }] },
    });
    const blocked = screen.getByRole('button', { name: /to initiative/i });
    expect(blocked).toBeDisabled();
    // Verbatim string pin: the Sessions.test.jsx container lane references this copy.
    expect(blocked).toHaveAttribute('title',
      "Fill in Grixxa's AC and HP (Stats tab) before adding to Initiative");
    unmount();

    const { props } = renderModal({
      resourceOptions: { ...linkless, npcs: [{ value: 'Grixxa', label: 'Grixxa', combatReady: true }] },
    });
    const live = screen.getByRole('button', { name: /to initiative/i });
    expect(live).not.toBeDisabled();
    fireEvent.click(live);
    expect(props.onQuickAction).toHaveBeenCalledWith('npcs', 'Grixxa');
  });

  it('moves and unlinks linked resources', () => {
    const { props } = renderModal();
    fireEvent.change(screen.getByLabelText(/move cave to another session/i), { target: { value: 'Session 8' } });
    expect(props.onMoveLink).toHaveBeenCalledWith('maps', 'Cave', 'Session 8');
    fireEvent.click(screen.getByRole('button', { name: /unlink cave/i }));
    expect(props.onRemoveLink).toHaveBeenCalledWith('maps', 'Cave');
  });

  it('renders checklist progress from parent state and toggles items by id', () => {
    // Progress re-derivation (done/total/pct) is pinned in sessionPlannerUtils
    // checklistProgress; the live check→progress loop through the real parent
    // handlers is owned by the Sessions.test.jsx container lane. Here only the
    // modal's own contract: the label reflects the injected checklist prop and
    // checkboxes route by id.
    const { props } = renderModal();
    expect(screen.getByText(/0 of 2 ready/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(props.onToggleChecklist).toHaveBeenCalledWith('auto-map-cave');
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

    // blank input never adds
    fireEvent.click(screen.getByRole('button', { name: /add$/i }));
    expect(props.onAddChecklistItem).not.toHaveBeenCalled();

    // added item is trimmed and the input resets for the next one
    const input = screen.getByLabelText(/new checklist item/i);
    fireEvent.change(input, { target: { value: '  Have initiative cards ready  ' } });
    fireEvent.click(screen.getByRole('button', { name: /add$/i }));
    expect(props.onAddChecklistItem).toHaveBeenCalledWith('Have initiative cards ready');
    expect(input).toHaveValue('');
  });

  it('renders contingency If → then rows, changes branch, and adds/removes rows', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Remove contingency' }));
    expect(props.onRemoveContingency).toHaveBeenCalledWith('c1');
  });

  it('copies composed XP-budget and rumor prompts to the clipboard with copied feedback', async () => {
    // Exact prompt bodies (party, avg level, campaign, NPCs) are pinned
    // verbatim in sessionPlannerUtils.test.js "prompt builders"; here only
    // that each button routes to its builder and the result reaches the
    // clipboard with toast feedback.
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /suggest xp budget/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
    expect(navigator.clipboard.writeText.mock.calls[0][0]).toContain('average level 5');
    await waitFor(() => expect(screen.getByText(/prompt copied/i)).toBeInTheDocument());

    navigator.clipboard.writeText.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /generate rumors/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
    const rumorText = navigator.clipboard.writeText.mock.calls[0][0];
    expect(rumorText).toContain('test-campaign');
    expect(rumorText).toContain('Grixxa');
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
    renderModal({ editingSession: null, formData: { ...baseFormData, name: '' }, banner: { message: 'A session with this name already exists', kind: 'error', conflict: false } });
    expect(screen.getByRole('heading', { name: /new session/i })).toBeInTheDocument();
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
  });

  it('keeps "Session Summary" and "Notes" as distinct labelled fields bound to their own keys', () => {
    const { props } = renderModal({
      formData: { ...baseFormData, summary: 'Stored summary', notes: 'Stored notes' },
    });
    const summaryField = screen.getByLabelText('Session Summary');
    const notesField = screen.getByLabelText('Notes');
    expect(summaryField).not.toBe(notesField);
    // both fields seed from persisted values
    expect(summaryField).toHaveValue('Stored summary');
    expect(notesField).toHaveValue('Stored notes');

    // Editing one field routes ONLY to its own key — labels never contradict bindings.
    fireEvent.change(notesField, { target: { value: 'Private GM note' } });
    expect(props.onFormChange).toHaveBeenCalledWith('notes', 'Private GM note');
    expect(props.onFormChange).not.toHaveBeenCalledWith('summary', 'Private GM note');

    props.onFormChange.mockClear();
    fireEvent.change(summaryField, { target: { value: 'Recap text' } });
    expect(props.onFormChange).toHaveBeenCalledWith('summary', 'Recap text');
    expect(props.onFormChange).not.toHaveBeenCalledWith('notes', 'Recap text');
  });

  it('firing Write recap posts through onWriteRecap only — never saves the form', () => {
    // The button's absence faces (visitor, unsaved-new) and its busy/AI-off
    // disabled faces are owned by SessionPlannerModal.recap-ai-gate.test.jsx.
    // Unique here: the recap click must not double as a form Save.
    const onWriteRecap = vi.fn();
    const { props } = renderModal({ onWriteRecap });
    fireEvent.click(screen.getByRole('button', { name: /write recap/i }));
    expect(onWriteRecap).toHaveBeenCalledTimes(1);
    expect(props.onSave).not.toHaveBeenCalled();
  });
});
