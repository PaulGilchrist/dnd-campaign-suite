import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionPlannerModal from './SessionPlannerModal.jsx';

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn(async () => {}) },
  });
});

const NOTE_GUID = 'cb7fa303-dfcc-4586-b7da-4c37e568dd4c';
const NOTE_LABEL = 'Important Plot Hook The ancient artifact is hidden in the o';

const formData = {
  name: 'Session 7',
  date: '',
  status: 'planned',
  summary: '',
  links: { maps: [], encounters: [], npcs: [], quests: [], settlements: [], notes: [NOTE_GUID] },
  contingencies: [],
  checklist: [],
};

function renderNoteModal() {
  return render(<SessionPlannerModal
    formData={formData}
    editingSession={{ name: 'Session 7', status: 'planned' }}
    otherSessions={[{ name: 'Session 8' }]}
    resourceOptions={{
      maps: [], encounters: [], npcs: [], quests: [], settlements: [],
      notes: [{ value: NOTE_GUID, label: NOTE_LABEL }],
    }}
    characters={[]}
    campaignName="test-campaign"
    saving={false}
    deleting={false}
    error={null}
    onClose={vi.fn()}
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
  />);
}

describe('SessionPlannerModal note link labels', () => {
  it('unlink tooltip shows the note title, not the raw GUID', () => {
    const { container } = renderNoteModal();
    const unlink = screen.getByRole('button', { name: `Unlink ${NOTE_LABEL}` });
    expect(unlink).toBeInTheDocument();
    expect(unlink.getAttribute('title')).toBe(`Unlink ${NOTE_LABEL}`);
    expect(container.innerHTML).not.toContain(`Unlink ${NOTE_GUID}`);
  });

  it('move select aria-label shows the note title, not the raw GUID', () => {
    const { container } = renderNoteModal();
    const move = screen.getByLabelText(`Move ${NOTE_LABEL} to another session`);
    expect(move).toBeInTheDocument();
    expect(container.innerHTML).not.toContain(`Move ${NOTE_GUID} to another session`);
  });

  it('falls back to the raw value when no option label matches', () => {
    const props = {
      formData: { ...formData, links: { ...formData.links, maps: ['Lost Keep'] } },
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
    };
    render(<SessionPlannerModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /unlink lost keep/i }));
    expect(props.onRemoveLink).toHaveBeenCalledWith('maps', 'Lost Keep');
  });
});
