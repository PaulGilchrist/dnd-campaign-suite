// @maintained-by-ai 2026-11-26
import { describe, it, expect } from 'vitest';
import {
  QUEST_STATUSES,
  normalizeQuestStatus,
  questStatusLabel,
} from '../../services/campaign/questStatusDisplay.js';
import { QUEST_BOARD_GROUPS, groupQuestsForBoard } from './questBoardData.js';

// Strongest home for the quest-status display canon (QuestStatusPill.test.jsx
// defers here by design) plus the board's pure grouping derivation.

const quest = (overrides = {}) => ({
  id: 'q1',
  name: 'Quest',
  status: 'active',
  description: '',
  rewards: '',
  ...overrides,
});

describe('quest status canon', () => {
  it('is exactly the three authored statuses: known ones normalize to themselves, anything else falls back to active', () => {
    expect(QUEST_STATUSES).toEqual(['active', 'completed', 'failed']);
    for (const status of QUEST_STATUSES) {
      expect(normalizeQuestStatus(status)).toBe(status);
    }
    expect(normalizeQuestStatus('retired')).toBe('active');
    expect(normalizeQuestStatus(undefined)).toBe('active');
    expect(questStatusLabel('active')).toBe('Active');
    expect(questStatusLabel('completed')).toBe('Completed');
    expect(questStatusLabel('failed')).toBe('Failed');
    expect(questStatusLabel('retired')).toBe('Active');
  });
});

describe('questBoardData', () => {
  it('buckets rows in ladder order Active → Completed → Failed, preserving storage order, with unknown statuses joining Active (never dropped)', () => {
    expect(QUEST_BOARD_GROUPS).toEqual(['active', 'completed', 'failed']);
    const groups = groupQuestsForBoard([
      quest({ id: 'a', name: 'A', status: 'completed' }),
      quest({ id: 'b', name: 'B', status: 'active' }),
      quest({ id: 'c', name: 'C', status: 'failed' }),
      quest({ id: 'd', name: 'D', status: 'active' }),
      quest({ id: 'x', name: 'X', status: 'retired' }),
    ]);
    expect(groups.map(g => g.status)).toEqual(QUEST_BOARD_GROUPS);
    expect(groups.map(g => g.label)).toEqual(['Active', 'Completed', 'Failed']);
    expect(groups[0].quests.map(q => q.id)).toEqual(['b', 'd', 'x']);
    expect(groups[1].quests.map(q => q.id)).toEqual(['a']);
    expect(groups[2].quests.map(q => q.id)).toEqual(['c']);
  });

  it('drops empty groups so a bare board renders no empty theatre', () => {
    const groups = groupQuestsForBoard([quest({ status: 'completed' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].status).toBe('completed');
    expect(groupQuestsForBoard([])).toEqual([]);
    expect(groupQuestsForBoard(null)).toEqual([]);
  });
});
