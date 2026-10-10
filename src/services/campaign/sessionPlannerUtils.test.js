import { describe, it, expect } from 'vitest';
import {
  getDefaultSessionData,
  emptyLinks,
  countLinks,
  buildAutoChecklist,
  mergeChecklist,
  checklistProgress,
  buildXpBudgetPrompt,
  buildRumorPrompt,
  getBranchDef,
  moveLinkBetweenSessions,
  CONTINGENCY_BRANCHES,
  LINK_TYPES,
} from './sessionPlannerUtils.js';

describe('sessionPlannerUtils — defaults', () => {
  it('getDefaultSessionData returns an empty planned session with all link buckets', () => {
    const s = getDefaultSessionData();
    expect(s.name).toBe('');
    expect(s.status).toBe('planned');
    expect(s.links).toEqual(emptyLinks());
    expect(s.contingencies).toEqual([]);
    expect(s.checklist).toEqual([]);
  });

  it('getDefaultSessionData deep-merges provided links without mutating defaults', () => {
    const s = getDefaultSessionData({ name: 'X', links: { maps: ['M'] } });
    expect(s.name).toBe('X');
    expect(s.links.maps).toEqual(['M']);
    expect(s.links.npcs).toEqual([]);
    expect(emptyLinks().maps).toEqual([]);
  });

  it('LINK_TYPES covers all six resource buckets', () => {
    expect(LINK_TYPES.map(t => t.key).sort()).toEqual(
      ['encounters', 'maps', 'notes', 'npcs', 'quests', 'settlements']
    );
  });
});

describe('countLinks', () => {
  it('counts all linked resources', () => {
    expect(countLinks({ maps: ['a'], npcs: ['b', 'c'] })).toBe(3);
  });
  it('handles missing links', () => {
    expect(countLinks()).toBe(0);
  });
});

describe('buildAutoChecklist / mergeChecklist', () => {
  it('auto-generates map activation + fog reset items', () => {
    const items = buildAutoChecklist({ maps: ['Smugglers Cave'] });
    const labels = items.map(i => i.label);
    expect(labels).toContain('Smugglers Cave set as active map');
    expect(labels).toContain('Fog of war reset');
  });

  it('auto-generates encounter-ready items', () => {
    const labels = buildAutoChecklist({ encounters: ['Cave Defenders'] }).map(i => i.label);
    expect(labels).toContain('Cave Defenders encounter saved and ready');
  });

  it('always includes the baseline items', () => {
    const labels = buildAutoChecklist({}).map(i => i.label);
    expect(labels).toContain('Player characters up to date');
    expect(labels).toContain('Initiative and dice ready');
  });

  it('mergeChecklist preserves done-state and custom items, drops stale auto items', () => {
    const existing = [
      { id: 'auto-baseline-chars', label: 'Player characters up to date', auto: true, done: true },
      { id: 'custom-1', label: 'Print handouts', auto: false, done: true },
      { id: 'auto-map-old', label: 'Old Map set as active map', auto: true, done: true },
    ];
    const merged = mergeChecklist(existing, { maps: ['New Map'] });
    const byId = Object.fromEntries(merged.map(i => [i.id, i]));
    expect(byId['auto-baseline-chars'].done).toBe(true);
    expect(byId['custom-1']).toBeTruthy();
    expect(byId['custom-1'].done).toBe(true);
    expect(byId['auto-map-old']).toBeUndefined();
    expect(byId['auto-map-new-map']).toBeTruthy();
    expect(byId['auto-map-new-map'].done).toBe(false);
  });

  it('checklistProgress reports done/total/pct', () => {
    const p = checklistProgress([{ done: true }, { done: false }, { done: true }, { done: false }]);
    expect(p).toEqual({ done: 2, total: 4, pct: 50 });
  });

  it('checklistProgress of empty is 0/0/0', () => {
    expect(checklistProgress([])).toEqual({ done: 0, total: 0, pct: 0 });
  });
});

describe('prompt builders', () => {
  const session = {
    name: 'Session 7',
    date: '2026-10-10',
    links: { quests: ['The Lost Artifact'], encounters: ['Cave Defenders'], npcs: ['Grixxa'], settlements: ['Riverwood'] },
  };

  it('XP prompt includes party size, average level, quests and encounters', () => {
    const text = buildXpBudgetPrompt(session, [{ level: 5 }, { level: 7 }, { level: 4 }]);
    expect(text).toContain('Session 7');
    expect(text).toContain('Party: 3');
    expect(text).toContain('average level 5');
    expect(text).toContain('Cave Defenders');
    expect(text).toContain('The Lost Artifact');
  });

  it('rumor prompt includes campaign, settlements, npcs and quests', () => {
    const text = buildRumorPrompt(session, 'Frostfall');
    expect(text).toContain('Frostfall');
    expect(text).toContain('Riverwood');
    expect(text).toContain('Grixxa');
    expect(text).toContain('The Lost Artifact');
  });
});

describe('getBranchDef', () => {
  it('returns matching branch definition', () => {
    expect(getBranchDef('failure').cls).toBe('session-branch-failure');
  });
  it('falls back to negotiation for unknown', () => {
    expect(getBranchDef('bogus').value).toBe('negotiate');
  });
  it('has three branches with green/blue/amber order', () => {
    expect(CONTINGENCY_BRANCHES.map(b => b.value)).toEqual(['negotiate', 'alternate', 'failure']);
  });
});

describe('moveLinkBetweenSessions', () => {
  it('moves a link to the target and regenerates both auto checklists', () => {
    const source = { name: 'A', links: { maps: ['Cave'] }, checklist: [] };
    const target = { name: 'B', links: {}, checklist: [] };
    const { source: s, target: t } = moveLinkBetweenSessions(source, target, 'maps', 'Cave');
    expect(s.links.maps).toEqual([]);
    expect(t.links.maps).toEqual(['Cave']);
    expect(t.checklist.map(i => i.label)).toContain('Cave set as active map');
    expect(s.checklist.map(i => i.label)).not.toContain('Cave set as active map');
  });

  it('does not duplicate a link already present on the target', () => {
    const source = { name: 'A', links: { npcs: ['Grixxa'] }, checklist: [] };
    const target = { name: 'B', links: { npcs: ['Grixxa'] }, checklist: [] };
    const { target: t } = moveLinkBetweenSessions(source, target, 'npcs', 'Grixxa');
    expect(t.links.npcs).toEqual(['Grixxa']);
  });
});
