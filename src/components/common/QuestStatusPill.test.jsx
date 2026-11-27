// @maintained-by-ai 2026-11-26
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import QuestStatusPill from './QuestStatusPill.jsx';

// The display canon itself (QUEST_STATUSES / normalizeQuestStatus /
// questStatusLabel) is pinned at its strongest site in
// src/components/quest-board/questBoardData.test.js; these tests cover only
// what the pill uniquely owns: the shared chip markup and questStatusClass.

describe('QuestStatusPill', () => {
  it('renders the shared chip for a known status: base + tier class, status text, title', () => {
    render(<QuestStatusPill status="completed" />);
    const pill = screen.getByTitle('completed');
    expect(pill).toHaveClass('quest-status-pill', 'quest-status-pill--completed');
    expect(pill).toHaveTextContent(/^completed$/);
  });

  it('falls back to the active chip and never leaks an unknown or missing raw status', () => {
    const { rerender } = render(<QuestStatusPill status="archived" />);
    const pill = screen.getByTitle('active');
    expect(pill).toHaveClass('quest-status-pill', 'quest-status-pill--active');
    expect(pill).toHaveTextContent(/^active$/);
    expect(screen.queryByText('archived')).toBeNull();

    rerender(<QuestStatusPill />);
    expect(screen.getByTitle('active')).toHaveClass('quest-status-pill--active');
    expect(screen.getByText('active')).toBeInTheDocument();
  });
});
