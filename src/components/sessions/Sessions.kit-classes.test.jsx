// @maintained-by-ai
//
// .ct-* design-kit convergence (tranche 3): the Sessions lane arrived
// ALREADY container-rooted and kit-skinned end to end (the zero-ct-* census
// was stale — the planner rode ct-modal-* and ct-btn/* from birth). OWNED
// HERE are the residual seams:
//   - the 409 "Reload list" recovery button rides ct-btn ct-btn-sm — its
//     former lane `padding` line (0-1-0) was dead under the 0-2-0 kit base
//     and is retired now that the sm tier lives in App.css;
//   - the footer variant hierarchy (danger / plain / primary) and the kit
//     modal chrome are re-pinned so a future re-skin cannot drift them.
// Behaviour pins (discard confirms, conflict reload, recap, picker cache)
// stay in the sibling test files — do not duplicate them here.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SessionPlannerModal from './SessionPlannerModal.jsx';

// The footer's RecapButton probes GET /ai/status on mount and AiRefineButton
// owns refineEntity — stub the transport lane so no kit probe hits the
// network (SessionPlannerModal.test idiom).
vi.mock('../../services/ai/aiClient.js', () => ({
  getAiStatus: vi.fn(async () => ({ configured: true })),
  refineEntity: vi.fn(),
}));

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
  links: { maps: [], encounters: [], npcs: [], quests: [], settlements: [], notes: [] },
  contingencies: [],
  checklist: [],
};

function renderModal(overrides = {}) {
  return render(
    <SessionPlannerModal
      formData={baseFormData}
      setFormData={vi.fn()}
      editingSession={{ name: 'Session 7', status: 'planned' }}
      otherSessions={[]}
      resourceOptions={{ maps: [], encounters: [], npcs: [], quests: [], settlements: [], notes: [] }}
      characters={[]}
      campaignName="test-campaign"
      saving={false}
      deleting={false}
      banner={null}
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
      {...overrides}
    />
  );
}

describe('Sessions planner .ct-* kit classes (tranche 3 convergence)', () => {
  it('planner modal rides the ct-modal chrome with the kit footer hierarchy', () => {
    const { container } = renderModal();
    expect(container.querySelector('.ct-modal-overlay .ct-modal.sessions-modal')).toBeInTheDocument();
    expect(container.querySelector('.ct-modal-header .ct-modal-close')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save/ })).toHaveClass('ct-btn', 'ct-btn-primary');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('ct-btn');
    expect(screen.getByRole('button', { name: /Delete/ })).toHaveClass('ct-btn', 'ct-btn-danger');
    // Lane-tinted footer chips keep their kit base alongside the tokens.
    expect(screen.getByRole('button', { name: /Played/ })).toHaveClass('ct-btn', 'sessions-played-btn');
  });

  it('the 409 Reload list recovery button rides the compact kit tier', () => {
    renderModal({
      banner: { message: 'Session "Session 7" was modified elsewhere.', kind: 'error', conflict: true },
    });
    const reload = screen.getByRole('button', { name: /Reload list/ });
    expect(reload).toHaveClass('ct-btn', 'ct-btn-sm', 'sessions-error-reload-btn');
  });

  it('the dead padding line is retired from the Sessions.css reload-button rule', async () => {
    const { readFileSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'Sessions.css'),
      'utf-8'
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    // The compound width law survives (App.css.test.jsx owns its assertions).
    expect(css).toMatch(/\.ct-container \.ct-modal\.sessions-modal\s*{/);
    const reloadBlock = css.match(/\.sessions-error-reload-btn\s*{([^}]*)}/);
    expect(reloadBlock, 'placement rule must survive').not.toBeNull();
    expect(reloadBlock[1], 'kit .ct-btn-sm owns the sizing now').not.toContain('padding');
  });
});
