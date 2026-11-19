import { describe, it, expect } from 'vitest';
import { QUEST_BOARD_GROUPS, groupQuestsForBoard } from './questBoardData.js';

const quest = (overrides = {}) => ({
  id: 'q1',
  name: 'Quest',
  status: 'active',
  description: '',
  rewards: '',
  ...overrides,
});

describe('questBoardData', () => {
  it('groups in ladder order Active → Completed → Failed', () => {
    expect(QUEST_BOARD_GROUPS).toEqual(['active', 'completed', 'failed']);
  });

  it('buckets rows by authored status, preserving storage order per group', () => {
    const groups = groupQuestsForBoard([
      quest({ id: 'a', name: 'A', status: 'completed' }),
      quest({ id: 'b', name: 'B', status: 'active' }),
      quest({ id: 'c', name: 'C', status: 'failed' }),
      quest({ id: 'd', name: 'D', status: 'active' }),
    ]);
    expect(groups.map(g => g.status)).toEqual(['active', 'completed', 'failed']);
    expect(groups.map(g => g.label)).toEqual(['Active', 'Completed', 'Failed']);
    expect(groups[0].quests.map(q => q.id)).toEqual(['b', 'd']);
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

  it('an unknown status lands in Active (shared canon fallback, never dropped)', () => {
    const groups = groupQuestsForBoard([quest({ id: 'x', status: 'retired' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].quests.map(q => q.id)).toEqual(['x']);
  });
});
