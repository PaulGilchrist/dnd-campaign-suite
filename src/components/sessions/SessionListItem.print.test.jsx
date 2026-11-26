// @maintained-by-ai 2026-11-25
// Item 4: the Sessions planner row earns a labeled Print One-Pager verb.
// It hands the SAVED row to the container's handout state, never opens the
// editor (row click swallowed), and only renders when a print handler is
// wired (the view passes one; a host without the lane sees nothing).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SessionListItem from './SessionListItem.jsx';

const session = {
  name: 'Session 7: Smuggler’s Cave',
  date: '2026-11-30',
  status: 'planned',
  links: { maps: ['Cave'], encounters: [], npcs: [], quests: [], settlements: [], notes: [] },
  contingencies: [],
  checklist: [{ id: 'a', label: 'Ready?', auto: true, done: false }],
};

describe('SessionListItem — Print One-Pager button', () => {
  const renderItem = (props = {}) => render(
    <SessionListItem session={session} onEdit={vi.fn()} {...props} />
  );

  it('renders the labeled verb when a print handler is wired', () => {
    const onPrint = vi.fn();
    renderItem({ onPrint });
    const btn = screen.getByRole('button', { name: 'Print one-pager for Session 7: Smuggler’s Cave' });
    expect(btn.textContent).toContain('Print One-Pager');
    fireEvent.click(btn);
    expect(onPrint).toHaveBeenCalledWith(expect.objectContaining({ name: 'Session 7: Smuggler’s Cave' }));
  });

  it('printing does not open the planner (row click swallowed)', () => {
    const onEdit = vi.fn();
    const onPrint = vi.fn();
    renderItem({ onEdit, onPrint });
    fireEvent.click(screen.getByRole('button', { name: 'Print one-pager for Session 7: Smuggler’s Cave' }));
    expect(onPrint).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('a host without the handout lane renders no print verb', () => {
    renderItem();
    expect(screen.queryByRole('button', { name: /Print one-pager/i })).not.toBeInTheDocument();
  });
});
