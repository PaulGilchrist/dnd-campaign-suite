// @maintained-by-ai
/* Backlog 2026-11-21 FFF (write-recap-disabled-when-ai-off): with AI off the
 * server 403s POST /ai/recap, so an enabled button burned a click before the
 * honest banner. The planner modal now probes GET /ai/status on mount (the
 * server's own `configured` derivation) and renders the Write recap button
 * disabled with a cause-naming title when configured:false. While the probe
 * is in flight (or the lane failed) the button keeps its neutral ENABLED face
 * — no flash of wrong state; the server refusal stays the backstop. */
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SessionPlannerModal from './SessionPlannerModal.jsx';
import { getAiStatus } from '../../services/ai/aiClient.js';

vi.mock('../../services/ai/aiClient.js', () => ({
  getAiStatus: vi.fn(),
  refineEntity: vi.fn(),
}));

const baseFormData = {
  name: 'Session 7',
  date: '',
  status: 'planned',
  summary: '',
  links: { maps: [], encounters: [], npcs: [], quests: [], settlements: [], notes: [] },
  contingencies: [],
  checklist: [],
};

function renderModal(overrides = {}) {
  const onWriteRecap = vi.fn();
  const props = {
    formData: baseFormData,
    editingSession: { name: 'Session 7', status: 'planned' },
    otherSessions: [],
    resourceOptions: { maps: [], encounters: [], npcs: [], quests: [], settlements: [], notes: [] },
    characters: [],
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
    onWriteRecap,
    ...overrides,
  };
  return { props, onWriteRecap, ...render(<SessionPlannerModal {...props} />) };
}

const recapBtn = () => screen.getByRole('button', { name: /write recap/i });

describe('SessionPlannerModal Write recap AI gate', () => {
  beforeEach(() => {
    getAiStatus.mockReset();
  });
  afterEach(cleanup);

  it('off face: configured:false disables the button with the cause-naming title', async () => {
    getAiStatus.mockResolvedValue({ configured: false, mode: 'off' });
    const { onWriteRecap } = renderModal();
    expect(getAiStatus).toHaveBeenCalledWith('test-campaign');
    await waitFor(() => expect(recapBtn()).toBeDisabled());
    expect(recapBtn()).toHaveAttribute('title', 'Enable AI in Admin to write recaps');
    // Still renders (visible, just blocked) — the label is unchanged.
    expect(recapBtn().textContent).toMatch(/Write recap/);
    fireEvent.click(recapBtn());
    expect(onWriteRecap).not.toHaveBeenCalled();
  });

  it('on face: configured:true keeps the button enabled and posts via the handler', async () => {
    getAiStatus.mockResolvedValue({ configured: true, mode: 'suggest' });
    const { onWriteRecap } = renderModal();
    await waitFor(() => expect(getAiStatus).toHaveBeenCalled());
    const btn = recapBtn();
    expect(btn).not.toBeDisabled();
    expect(btn.getAttribute('title')).toContain("Session 7's story");
    fireEvent.click(btn);
    expect(onWriteRecap).toHaveBeenCalledTimes(1);
  });

  it('in-flight face: a pending probe renders the neutral enabled face (no wrong-state flash)', () => {
    getAiStatus.mockReturnValue(new Promise(() => {})); // never resolves
    const { onWriteRecap } = renderModal();
    const btn = recapBtn();
    expect(btn).not.toBeDisabled();
    expect(btn.getAttribute('title')).not.toBe('Enable AI in Admin to write recaps');
    fireEvent.click(btn);
    expect(onWriteRecap).toHaveBeenCalledTimes(1);
  });

  it('status-lane failure keeps the enabled face (server refusal stays the backstop)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getAiStatus.mockRejectedValue(new Error('ai status returned 500'));
    renderModal();
    await waitFor(() => expect(errSpy).toHaveBeenCalled());
    expect(recapBtn()).not.toBeDisabled();
    errSpy.mockRestore();
  });

  it('unsaved-new modal: no button AND no status probe', () => {
    getAiStatus.mockResolvedValue({ configured: true });
    renderModal({ editingSession: null, formData: { ...baseFormData, name: '' } });
    expect(screen.queryByRole('button', { name: /write recap/i })).not.toBeInTheDocument();
    expect(getAiStatus).not.toHaveBeenCalled();
  });

  it('visitor face (no GM handler): no button and no status probe', () => {
    getAiStatus.mockResolvedValue({ configured: true });
    renderModal({ onWriteRecap: undefined });
    expect(screen.queryByRole('button', { name: /write recap/i })).not.toBeInTheDocument();
    expect(getAiStatus).not.toHaveBeenCalled();
  });

  it('busy state wins its own title and spinner while AI is on', async () => {
    getAiStatus.mockResolvedValue({ configured: true });
    renderModal({ recapBusy: true });
    await waitFor(() => expect(getAiStatus).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /writing recap/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', "The AI is writing this session's story…");
  });
});
