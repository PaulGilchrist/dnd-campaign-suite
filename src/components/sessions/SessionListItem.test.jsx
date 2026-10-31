// @maintained-by-ai: 2026-10-27
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import SessionListItem from './SessionListItem.jsx';
import { emptyLinks } from '../../services/campaign/sessionPlannerUtils.js';

const makeSession = (overrides = {}) => ({
  name: 'Cave Raid',
  date: '',
  status: 'planned',
  summary: '',
  notes: '',
  links: emptyLinks(),
  contingencies: [],
  checklist: [],
  ...overrides,
});

function renderRow(session) {
  const onEdit = vi.fn();
  const { container } = render(<SessionListItem session={session} onEdit={onEdit} />);
  return { container, onEdit };
}

describe('SessionListItem — notes indicator dot', () => {
  it('renders the fa-note-sticky indicator when notes is non-empty', () => {
    const { container } = renderRow(makeSession({ notes: 'Secret DM hints' }));
    const dot = container.querySelector('.sessions-list-notes i');
    expect(dot).not.toBeNull();
    expect(dot.className).toContain('fa-note-sticky');
  });

  it('exposes an accessible "Has notes" affordance without adding a button', () => {
    const { container } = renderRow(makeSession({ notes: 'Secret DM hints' }));
    const dot = container.querySelector('.sessions-list-notes');
    expect(dot).toHaveAttribute('title', 'Has notes');
    expect(dot).toHaveAttribute('aria-label', 'Has notes');
    expect(dot.tagName).not.toBe('BUTTON');
    // The row itself remains the only interactive element
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('renders no indicator for an empty notes string', () => {
    const { container } = renderRow(makeSession({ notes: '' }));
    expect(container.querySelector('.sessions-list-notes')).toBeNull();
  });

  it('renders no indicator for whitespace-only notes', () => {
    const { container } = renderRow(makeSession({ notes: '   \n\t ' }));
    expect(container.querySelector('.sessions-list-notes')).toBeNull();
  });

  it('renders no indicator for a legacy row missing the notes key', () => {
    const session = makeSession();
    delete session.notes;
    const { container } = renderRow(session);
    expect(container.querySelector('.sessions-list-notes')).toBeNull();
  });

  it('keeps the summary preview unchanged alongside the indicator', () => {
    const { container } = renderRow(makeSession({
      summary: 'The party delves deep',
      notes: 'Secret DM hints',
    }));
    expect(container.querySelector('.ct-list-preview').textContent).toBe('The party delves deep');
    expect(container.textContent).not.toContain('Secret DM hints');
    expect(container.querySelector('.sessions-list-notes')).not.toBeNull();
  });

  it('clicking a dotted row still opens the editor', () => {
    const { container, onEdit } = renderRow(makeSession({ notes: 'Secret DM hints' }));
    fireEvent.click(container.querySelector('.sessions-list-notes'));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Cave Raid' }));
  });
});

describe('SessionListItem — AI draft badge (campaign-authoring Phase 3)', () => {
  it('badges draft rows for the GM and never badge approved ones', () => {
    const { container: drafted } = renderRow(makeSession({ draft: true }));
    const flag = drafted.querySelector('.ct-draft-flag');
    expect(flag).not.toBeNull();
    expect(flag.textContent).toBe('draft');

    const { container: live } = renderRow(makeSession());
    expect(live.querySelector('.ct-draft-flag')).toBeNull();
  });
});
