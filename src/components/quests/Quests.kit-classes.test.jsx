// @maintained-by-ai
//
// .ct-* design-kit convergence (tranche 3): the Quests planner arrived
// ALREADY container-rooted and kit-skinned (the zero-ct-* census was stale —
// re-census before trusting it). OWNED HERE are the residual seams:
//   - the modal Cancel button shed its duplicated `ct-btn ct-btn` token —
//     exactly one kit class, the plain secondary tier;
//   - the 409 "Reload list" recovery button rides ct-btn ct-btn-sm and the
//     dead `padding` line (0-1-0, always out-specified by the 0-2-0 base)
//     is gone from Quests.css;
//   - the byte-pinned planner form ids (#quest-name/#quest-status/
//     #quest-description/#quest-rewards/#quest-notes) survive the chrome —
//     re-pinned here alongside the kit classes so a future re-skin can
//     neither drift the kit hierarchy nor drop the DOM contract.
// Behaviour pins (conflict reload, duplicate names, SSE sync, markdown
// preview) stay in the sibling test files — do not duplicate them here.

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUseQuestsManagement = vi.fn();

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: (...args) => mockUseQuestsManagement(...args),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange, placeholder, label }) => (
    <div data-testid={`preview-toggle-${id}`}>
      <label>{label}</label>
      <textarea
        id={id}
        data-testid={`field-${id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  ),
}));

import Quests from './Quests.jsx';

function renderQuests(quests = []) {
  mockUseQuestsManagement.mockReturnValue({
    items: quests,
    loading: false,
    loadItems: vi.fn(),
    saveItems: vi.fn().mockResolvedValue(undefined),
    deleteItem: vi.fn().mockResolvedValue(undefined),
  });
  return render(<Quests campaignName="test-campaign" isLocalhost />);
}

describe('Quests .ct-* kit classes (tranche 3 convergence)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('view root carries the kit container; toolbar and empty state ride the tiers', () => {
    const { container } = renderQuests();
    expect(container.querySelector('.ct-container')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Quest/ })).toHaveClass('ct-new-btn');
    const empty = container.querySelector('.ct-empty-state');
    expect(empty).toHaveTextContent('No quests yet.');
  });

  it('quest form modal rides the ct-modal chrome with the kit footer hierarchy', () => {
    const { container } = renderQuests();
    fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
    expect(container.querySelector('.ct-modal-overlay .ct-modal.quests-modal')).toBeInTheDocument();
    expect(container.querySelector('.ct-modal-header .ct-modal-close')).toBeInTheDocument();
    const save = screen.getByRole('button', { name: /Save/ });
    expect(save).toHaveClass('ct-btn', 'ct-btn-primary');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel).toHaveClass('ct-btn');
    // The duplicated `ct-btn ct-btn` token is gone — exactly one kit class.
    expect(
      cancel.className.split(/\s+/).filter((token) => token === 'ct-btn')
    ).toHaveLength(1);
  });

  it('byte-pinned planner form ids survive the kit chrome', () => {
    const { container } = renderQuests();
    fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
    for (const id of ['quest-name', 'quest-status', 'quest-description', 'quest-rewards', 'quest-notes']) {
      expect(container.querySelector(`#${id}`)).toBeInTheDocument();
    }
  });

  it('the dead padding line is retired from the Quests.css reload-button rule', async () => {
    const { readFileSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'Quests.css'),
      'utf-8'
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    const reloadBlock = css.match(/\.quests-error-reload-btn\s*{([^}]*)}/);
    expect(reloadBlock, 'placement rule must survive').not.toBeNull();
    expect(reloadBlock[1], 'kit .ct-btn-sm owns the sizing now').not.toContain('padding');
  });
});
