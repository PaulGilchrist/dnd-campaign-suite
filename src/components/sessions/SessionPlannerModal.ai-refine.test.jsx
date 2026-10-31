// @maintained-by-ai
/* Lane: Session planner AI refine payload (bug-ai-refine-session-preflight-dead).
 * Raw editor formData always carries the GM-owned lifecycle fields
 * (playedAt/checklist — seeded by getDefaultSessionData) and structured
 * contingency rows; sessionSchema is additionalProperties:false with a
 * STRING_LIST contingencies, so EVERY editor-sourced refine was dead at the
 * server preflight before the model was ever called. The footer must project
 * the authored-row shape — and the proposal must land in the FORM only
 * (never-write), merging so the planner-owned fields survive for the later
 * Save (mirrors the NPC avatar-trio precedent). */
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SessionPlannerModal from './SessionPlannerModal.jsx';
import { getDefaultSessionData, projectSessionForRefine, emptyLinks } from '../../services/campaign/sessionPlannerUtils.js';
import { refineEntity } from '../../services/ai/aiClient.js';

vi.mock('../../services/ai/aiClient.js', () => ({
  refineEntity: vi.fn(),
}));

const DIRTY_ROW = {
  name: 'Session 7: Smuggler’s Cave',
  date: '2026-11-02',
  status: 'planned',
  playedAt: null,
  summary: 'The party tails the courier to the tidal stairs.',
  notes: 'Keep Grixxa’s token off-page until act two.',
  contingencies: [
    { id: 'ctg-1', ifText: 'Players parley', thenText: 'Grixxa offers a deal', branch: 'negotiate' },
  ],
  checklist: [
    { id: 'auto-baseline-chars', label: 'Player characters up to date', auto: true, done: false },
    { id: 'custom-prop', label: 'Print the tide charts', auto: false, done: true },
  ],
  links: { maps: ['Cave'], encounters: [], npcs: ['Grixxa'], quests: [], settlements: [], notes: [] },
  updatedAt: 1793124887756,
};

function renderEditor(formOverrides = {}, { editing = true } = {}) {
  const formData = getDefaultSessionData({ ...DIRTY_ROW, ...formOverrides });
  const setFormData = vi.fn();
  render(
    <SessionPlannerModal
      formData={formData}
      setFormData={setFormData}
      editingSession={editing ? { name: formData.name, status: 'planned' } : null}
      otherSessions={[]}
      resourceOptions={{ maps: [], encounters: [], npcs: [], quests: [], settlements: [], notes: [] }}
      pickerLoadError={null}
      campaignName="test-campaign"
      saving={false}
      deleting={false}
      error={null}
      onClose={vi.fn()}
      onReloadList={vi.fn()}
      onSave={vi.fn()}
      onDelete={vi.fn()}
      onFormChange={vi.fn()}
      onAddLink={vi.fn()}
      onRemoveLink={vi.fn()}
      onMoveLink={vi.fn()}
      onQuickAction={vi.fn()}
      onAddContingency={vi.fn()}
      onContingencyChange={vi.fn()}
      onRemoveContingency={vi.fn()}
      onToggleChecklist={vi.fn()}
      onAddChecklistItem={vi.fn()}
      onRemoveChecklistItem={vi.fn()}
      onMarkPlayed={vi.fn()}
    />
  );
  return { formData, setFormData };
}

const openRefineAndAsk = async (instruction) => {
  fireEvent.click(screen.getByRole('button', { name: /refine with AI/i }));
  fireEvent.change(screen.getByPlaceholderText(/what should change/i), { target: { value: instruction } });
  fireEvent.click(screen.getByRole('button', { name: /apply to form/i }));
  await waitFor(() => expect(refineEntity).toHaveBeenCalled());
};

beforeEach(() => {
  refineEntity.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('SessionPlannerModal AI refine (authored-row projection)', () => {
  it('sends a schema-clean entity: no playedAt/checklist/contingencies, links passed through', async () => {
    renderEditor();
    refineEntity.mockResolvedValue({ ok: false, errors: ['stopped after payload probe'] });
    await openRefineAndAsk('add a mid-session twist to the summary');

    const sent = refineEntity.mock.calls[0][0];
    expect(sent.campaignName).toBe('test-campaign');
    expect(sent.kind).toBe('session');
    expect(sent.instruction).toBe('add a mid-session twist to the summary');

    const entity = sent.entity;
    expect(entity).not.toHaveProperty('playedAt');
    expect(entity).not.toHaveProperty('checklist');
    expect(entity).not.toHaveProperty('contingencies');
    // Authored fields ride through untouched.
    expect(entity.name).toBe('Session 7: Smuggler’s Cave');
    expect(entity.status).toBe('planned');
    expect(entity.links.maps).toEqual(['Cave']);
    expect(entity.links.npcs).toEqual(['Grixxa']);
  });

  it('drops the proposal into the form WITHOUT writing and keeps the planner-owned fields', async () => {
    const { setFormData } = renderEditor();
    refineEntity.mockResolvedValue({
      ok: true,
      replacement: {
        name: 'Session 7: Smuggler’s Cave',
        date: '2026-11-02',
        status: 'planned',
        summary: 'Act one closes with the courier’s drowned token on the table.',
        notes: DIRTY_ROW.notes,
        contingencies: [],
        links: DIRTY_ROW.links,
      },
    });
    await openRefineAndAsk('add a mid-session twist');

    // Proposal applied via a functional update (form-only — Save stays the
    // only write lane; no CRUD service is even mounted here).
    const [updater] = setFormData.mock.calls.at(-1);
    expect(typeof updater).toBe('function');
    const applied = updater(getDefaultSessionData(DIRTY_ROW));
    expect(applied.summary).toBe('Act one closes with the courier’s drowned token on the table.');
    // Merge, not replace: the schema-clean proposal carries no lifecycle
    // fields and its contingencies are pinned back so the structured planner
    // rows (plus the row stamp) survive for the next Save.
    expect(applied.playedAt).toBeNull();
    expect(applied.checklist).toHaveLength(2);
    expect(applied.contingencies).toEqual(DIRTY_ROW.contingencies);
    expect(applied.updatedAt).toBe(1793124887756);
  });

  it('surfaces preflight/schema errors in the .ai-refine-error strip, form untouched', async () => {
    const { setFormData } = renderEditor();
    refineEntity.mockResolvedValue({ ok: false, errors: ["value has unknown field 'playedAt'"] });
    await openRefineAndAsk('anything');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("value has unknown field 'playedAt'");
    // Failed proposal: the editor form never moved (instruction text is
    // AiRefineButton-local state, so setFormData is not touched at all).
    expect(setFormData).not.toHaveBeenCalled();
  });
});

describe('SessionPlannerModal AI refine — unsaved NEW session (backlog session-planner-refine-gate-confuses)', () => {
  it('renders the refine button in the same footer slot with no disk row and opens the modal', () => {
    renderEditor({ name: 'Draft Dawn' }, { editing: false });

    // Same footer placement as the existing-session lane; row-only actions
    // (Delete / Mark as Played) stay gated.
    const refine = screen.getByRole('button', { name: /refine with AI/i });
    expect(refine.closest('.ct-modal-footer .ct-modal-actions')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /^delete/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /mark as played/i })).toBeNull();

    fireEvent.click(refine);
    expect(screen.getByRole('dialog', { name: /refine session with AI/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/what should change/i)).toBeInTheDocument();
  });

  it('refines from the LIVE FORM DATA (projection, no id/row needed) and applies to the form only', async () => {
    const NEW_FORM = {
      name: 'Draft Dawn',
      date: '2026-11-09',
      summary: 'Rough outline: the tide temple opens at dusk.',
      notes: '',
    };
    const { formData, setFormData } = renderEditor(NEW_FORM, { editing: false });
    refineEntity.mockResolvedValue({
      ok: true,
      replacement: {
        ...NEW_FORM,
        name: 'Refined New Dawn',
        status: 'planned',
        contingencies: [],
        links: emptyLinks(),
      },
    });
    await openRefineAndAsk('Change the name field to: Refined New Dawn');

    // Preflight input came from the unsaved form: no playedAt/checklist/
    // contingencies (GM-owned, projected away), no id/updatedAt — the server
    // never needed a disk row.
    const sent = refineEntity.mock.calls[0][0];
    expect(sent.kind).toBe('session');
    const entity = sent.entity;
    expect(entity.name).toBe('Draft Dawn');
    expect(entity.summary).toBe('Rough outline: the tide temple opens at dusk.');
    expect(entity).not.toHaveProperty('playedAt');
    expect(entity).not.toHaveProperty('checklist');
    expect(entity).not.toHaveProperty('contingencies');

    // Proposal lands in the FORM via the functional updater; nothing else is
    // touched (no CRUD service is even mounted here — Save is the only write).
    expect(setFormData).toHaveBeenCalledTimes(1);
    const [updater] = setFormData.mock.calls[0];
    const applied = updater(formData);
    expect(applied.name).toBe('Refined New Dawn');
    expect(applied.playedAt).toBeNull();
    expect(applied.checklist).toHaveLength(2);
  });
});

describe('projectSessionForRefine', () => {
  it('is a pure projection: input form state is not mutated', () => {
    const form = getDefaultSessionData(DIRTY_ROW);
    const before = JSON.stringify(form);
    const projected = projectSessionForRefine(form);
    expect(JSON.stringify(form)).toBe(before);
    expect(projected).not.toHaveProperty('playedAt');
    expect(projected).not.toHaveProperty('checklist');
    expect(projected).not.toHaveProperty('contingencies');
  });

  it('survives designer-shaped rows (string or null contingencies) unchanged', () => {
    const strings = projectSessionForRefine(getDefaultSessionData({ name: 'S', contingencies: ['If parley → deal'] }));
    expect(strings).not.toHaveProperty('contingencies');
    expect(projectSessionForRefine(getDefaultSessionData({ name: 'S', contingencies: null }))).not.toHaveProperty('contingencies');
  });
});
