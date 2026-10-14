// @maintained-by-ai: 2026-10-14
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

function renderModal(overrides = {}) {
  const props = {
    formData: {
      name: 'Session 7',
      date: '',
      status: 'planned',
      summary: '',
      links: { maps: [], encounters: [], npcs: [], quests: [], settlements: [], notes: [NOTE_GUID] },
      contingencies: [],
      checklist: [],
    },
    editingSession: { name: 'Session 7', status: 'planned' },
    otherSessions: [{ name: 'Session 8' }],
    resourceOptions: {
      maps: [], encounters: [], npcs: [], quests: [], settlements: [],
      notes: [{ value: NOTE_GUID, label: NOTE_LABEL }],
    },
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
    ...overrides,
  };
  return { props, ...render(<SessionPlannerModal {...props} />) };
}

describe('SessionPlannerModal unlink tooltips', () => {
  it('shows the note title (never the raw GUID) in the unlink tooltip and move aria-label', () => {
    const { container } = renderModal();
    // icon-only unlink button takes its accessible name from its title attribute
    expect(screen.getByRole('button', { name: `Unlink ${NOTE_LABEL}` })).toBeInTheDocument();
    expect(screen.getByLabelText(`Move ${NOTE_LABEL} to another session`)).toBeInTheDocument();
    expect(container.innerHTML).not.toContain(NOTE_GUID);
  });

  it('falls back to the raw value when no option label matches', () => {
    const { props } = renderModal({
      resourceOptions: { maps: [], encounters: [], npcs: [], quests: [], settlements: [], notes: [] },
    });
    fireEvent.click(screen.getByRole('button', { name: `Unlink ${NOTE_GUID}` }));
    expect(props.onRemoveLink).toHaveBeenCalledWith('notes', NOTE_GUID);
  });
});
