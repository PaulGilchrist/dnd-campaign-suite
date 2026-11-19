import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import QuestStatusPill from './QuestStatusPill.jsx';
import {
  QUEST_STATUSES,
  normalizeQuestStatus,
  questStatusLabel,
  questStatusClass,
} from '../../services/campaign/questStatusDisplay.js';

describe('quest status display canon', () => {
  it('authors exactly the three planner statuses', () => {
    expect(QUEST_STATUSES).toEqual(['active', 'completed', 'failed']);
  });

  it('normalizes known statuses unchanged and everything else to active', () => {
    QUEST_STATUSES.forEach(status => {
      expect(normalizeQuestStatus(status)).toBe(status);
    });
    expect(normalizeQuestStatus('cancelled')).toBe('active');
    expect(normalizeQuestStatus(undefined)).toBe('active');
  });

  it('labels with a capital first letter', () => {
    expect(questStatusLabel('active')).toBe('Active');
    expect(questStatusLabel('completed')).toBe('Completed');
    expect(questStatusLabel('failed')).toBe('Failed');
    expect(questStatusLabel('bogus')).toBe('Active');
  });

  it('publishes the pill modifier class', () => {
    expect(questStatusClass('failed')).toBe('quest-status-pill--failed');
    expect(questStatusClass('bogus')).toBe('quest-status-pill--active');
  });
});

describe('QuestStatusPill', () => {
  it('renders the shared chip: base + tier class + raw status text + title', () => {
    render(<QuestStatusPill status="completed" />);
    const pill = screen.getByTitle('completed');
    expect(pill).toHaveClass('quest-status-pill', 'quest-status-pill--completed');
    expect(pill).toHaveTextContent('completed');
  });

  it('falls back to the active tone for an unknown status', () => {
    render(<QuestStatusPill status="archived" />);
    expect(screen.getByTitle('active')).toHaveClass('quest-status-pill--active');
  });
});
