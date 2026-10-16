/**
 * sessionPlannerUtils is a PURE data-shaping module (no fetch): GM session
 * drafts, link-bucket normalization (links.quests lives here per #2006),
 * auto-checklist id/label recipes, and AI prompt string builders.
 * Persistence is a separate lane: sessionsService.js → /api/campaigns/:name/sessions.
 * session.date is GM metadata passed through verbatim — the no-game-timers
 * rule governs game state, not planner metadata strings.
 */
import { describe, it, expect } from 'vitest';
import {
  getDefaultSessionData,
  emptyLinks,
  countLinks,
  slugify,
  newContingency,
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
  it('getDefaultSessionData returns the exact empty planned-session shape', () => {
    expect(getDefaultSessionData()).toEqual({
      name: '',
      date: '',
      status: 'planned',
      playedAt: null,
      summary: '',
      contingencies: [],
      checklist: [],
      links: { maps: [], encounters: [], npcs: [], quests: [], settlements: [], notes: [] },
    });
  });

  it('getDefaultSessionData merges overrides, fills every link bucket, and does not leak state between calls', () => {
    const s = getDefaultSessionData({ name: 'X', links: { maps: ['M'] } });
    expect(s.name).toBe('X');
    expect(s.links).toEqual({ ...emptyLinks(), maps: ['M'] });
    s.links.maps.push('M2');
    expect(getDefaultSessionData().links.maps).toEqual([]);
    expect(emptyLinks().maps).toEqual([]);
  });

  it('LINK_TYPES is the exact six-bucket registry in UI render order (SessionPlannerModal maps it directly)', () => {
    expect(LINK_TYPES).toEqual([
      { key: 'maps', label: 'Maps', icon: 'fa-map' },
      { key: 'encounters', label: 'Encounters', icon: 'fa-dragon' },
      { key: 'npcs', label: 'NPCs', icon: 'fa-users' },
      { key: 'quests', label: 'Quests', icon: 'fa-scroll' },
      { key: 'settlements', label: 'Settlements', icon: 'fa-city' },
      { key: 'notes', label: 'Notes', icon: 'fa-sticky-note' },
    ]);
  });
});

describe('slugify', () => {
  it('normalizes names into checklist-id fragments', () => {
    expect(slugify('Smugglers Cave')).toBe('smugglers-cave');
    expect(slugify('The Lost Artifact!')).toBe('the-lost-artifact');
    expect(slugify('Map 2: Endgame')).toBe('map-2-endgame');
    expect(slugify('  Fire & Ice  ')).toBe('fire-ice');
    expect(slugify('')).toBe('');
  });
});

describe('countLinks', () => {
  it('counts array entries across buckets; missing or non-array buckets count 0', () => {
    expect(countLinks({ maps: ['a'], npcs: ['b', 'c'] })).toBe(3);
    expect(countLinks()).toBe(0);
    expect(countLinks({})).toBe(0);
    expect(countLinks({ maps: 'not-an-array', quests: [] })).toBe(0);
  });
});

describe('buildAutoChecklist', () => {
  it('maps generate active-map + fog items with exact slugged ids', () => {
    const items = buildAutoChecklist({ maps: ['Smugglers Cave'] });
    expect(items.map(i => i.id)).toEqual([
      'auto-baseline-chars',
      'auto-baseline-init',
      'auto-map-smugglers-cave',
      'auto-map-smugglers-cave-fog',
    ]);
    expect(items.map(i => i.label)).toEqual([
      'Player characters up to date',
      'Initiative and dice ready',
      'Smugglers Cave set as active map',
      'Fog of war reset',
    ]);
  });

  it('emits baseline-only for empty links and one exact item per bucket in maps→encounters→quests→settlements→npcs order', () => {
    expect(buildAutoChecklist({}).map(i => i.id)).toEqual(['auto-baseline-chars', 'auto-baseline-init']);
    expect(buildAutoChecklist({ maps: ['M'], encounters: ['E'], npcs: ['N'], quests: ['Q'], settlements: ['S'] }).map(i => i.label)).toEqual([
      'Player characters up to date',
      'Initiative and dice ready',
      'M set as active map',
      'Fog of war reset',
      'E encounter saved and ready',
      'Q quest brief ready to share',
      'S ready to roleplay',
      'N notes on hand',
    ]);
  });
});

describe('mergeChecklist', () => {
  it('preserves done-state and custom items, drops stale auto items — exact output', () => {
    const existing = [
      { id: 'auto-baseline-chars', label: 'Player characters up to date', auto: true, done: true },
      { id: 'custom-1', label: 'Print handouts', auto: false, done: true },
      { id: 'auto-map-old', label: 'Old Map set as active map', auto: true, done: true },
    ];
    expect(mergeChecklist(existing, { maps: ['New Map'] })).toEqual([
      { id: 'auto-baseline-chars', label: 'Player characters up to date', auto: true, done: true },
      { id: 'auto-baseline-init', label: 'Initiative and dice ready', auto: true, done: false },
      { id: 'auto-map-new-map', label: 'New Map set as active map', auto: true, done: false },
      { id: 'auto-map-new-map-fog', label: 'Fog of war reset', auto: true, done: false },
      { id: 'custom-1', label: 'Print handouts', auto: false, done: true },
    ]);
  });

  it('treats a missing existing checklist as empty (all auto items fresh, none done)', () => {
    expect(mergeChecklist(undefined, { encounters: ['E'] })).toEqual([
      { id: 'auto-baseline-chars', label: 'Player characters up to date', auto: true, done: false },
      { id: 'auto-baseline-init', label: 'Initiative and dice ready', auto: true, done: false },
      { id: 'auto-enc-e', label: 'E encounter saved and ready', auto: true, done: false },
    ]);
  });
});

describe('checklistProgress', () => {
  it('reports done/total/pct, rounding and guarding degenerate input', () => {
    expect(checklistProgress([{ done: true }, { done: false }, { done: true }, { done: false }])).toEqual({ done: 2, total: 4, pct: 50 });
    expect(checklistProgress([{ done: true }, { done: false }, { done: false }])).toEqual({ done: 1, total: 3, pct: 33 });
    expect(checklistProgress([])).toEqual({ done: 0, total: 0, pct: 0 });
    expect(checklistProgress(null)).toEqual({ done: 0, total: 0, pct: 0 });
  });
});

describe('prompt builders', () => {
  const session = {
    name: 'Session 7',
    date: '2026-10-10',
    links: { quests: ['The Lost Artifact'], encounters: ['Cave Defenders'], npcs: ['Grixxa'], settlements: ['Riverwood'] },
  };

  it('buildXpBudgetPrompt renders the exact full prompt (party, avg level, encounters, quests, date)', () => {
    const text = buildXpBudgetPrompt(session, [{ level: 5 }, { level: 7 }, { level: 4 }]);
    expect(text).toBe([
      "You are a D&D 5e dungeon master's assistant. Suggest an XP budget and difficulty mix for an upcoming session.",
      'Campaign session: "Session 7" (2026-10-10).',
      'Party: 3 player characters, average level 5.',
      'Planned encounters: Cave Defenders.',
      'Active quests in play: The Lost Artifact.',
      'Give a per-encounter XP budget (easy/medium/hard/deadly thresholds) and one line of advice on pacing.',
    ].join('\n'));
  });

  it('buildXpBudgetPrompt on a bare session says so, omits avg level, and ignores non-numeric levels', () => {
    expect(buildXpBudgetPrompt({ name: 'One-shot' })).toBe([
      "You are a D&D 5e dungeon master's assistant. Suggest an XP budget and difficulty mix for an upcoming session.",
      'Campaign session: "One-shot".',
      'Party: 0 player characters.',
      'No encounters linked yet.',
      'Give a per-encounter XP budget (easy/medium/hard/deadly thresholds) and one line of advice on pacing.',
    ].join('\n'));
    expect(buildXpBudgetPrompt({ name: 'One-shot' }, [{ level: 5 }, { level: 'six' }])).toContain('Party: 1 player characters, average level 5.');
  });

  it('buildRumorPrompt renders the exact full prompt (campaign, settlements, npcs, quests)', () => {
    const text = buildRumorPrompt(session, 'Frostfall');
    expect(text).toBe([
      "You are a D&D 5e dungeon master's assistant. Generate 3 rumors the players might hear at the start of this session.",
      'Campaign: Frostfall. Session: "Session 7" (2026-10-10).',
      'Settlements in play: Riverwood.',
      'NPCs the party may meet: Grixxa.',
      'Active quests to weave in: The Lost Artifact.',
      'Each rumor: 1-2 sentences, clearly labeled true / false / half-true, with a hint at the hook behind it.',
    ].join('\n'));
  });
});

describe('contingency branches', () => {
  it('CONTINGENCY_BRANCHES is the exact three-branch registry in render order', () => {
    expect(CONTINGENCY_BRANCHES).toEqual([
      { value: 'negotiate', label: 'Negotiation', cls: 'session-branch-negotiate' },
      { value: 'alternate', label: 'Alternate route', cls: 'session-branch-alternate' },
      { value: 'failure', label: 'Failure / consequence', cls: 'session-branch-failure' },
    ]);
  });

  it('getBranchDef returns the exact match and falls back to negotiation for unknown', () => {
    expect(getBranchDef('failure')).toEqual({ value: 'failure', label: 'Failure / consequence', cls: 'session-branch-failure' });
    expect(getBranchDef('bogus')).toEqual(CONTINGENCY_BRANCHES[0]);
    expect(getBranchDef(undefined)).toBe(CONTINGENCY_BRANCHES[0]);
  });

  it('newContingency defaults to a blank negotiate branch (id is a random marker, not a game clock)', () => {
    const c = newContingency();
    expect(c.ifText).toBe('');
    expect(c.thenText).toBe('');
    expect(c.branch).toBe('negotiate');
    expect(c.id.startsWith('ctg-')).toBe(true);
  });
});

describe('moveLinkBetweenSessions', () => {
  it('moves a link, regenerates both auto checklists exactly, and leaves inputs unmutated', () => {
    const source = { name: 'A', links: { maps: ['Cave'] }, checklist: [] };
    const target = { name: 'B', links: {}, checklist: [] };
    const { source: s, target: t } = moveLinkBetweenSessions(source, target, 'maps', 'Cave');
    expect(s.links).toEqual(emptyLinks());
    expect(t.links).toEqual({ ...emptyLinks(), maps: ['Cave'] });
    expect(s.checklist.map(i => i.label)).toEqual(['Player characters up to date', 'Initiative and dice ready']);
    expect(t.checklist.map(i => i.label)).toEqual([
      'Player characters up to date',
      'Initiative and dice ready',
      'Cave set as active map',
      'Fog of war reset',
    ]);
    expect(source.links.maps).toEqual(['Cave']);
    expect(source.checklist).toEqual([]);
    expect(target.links).toEqual({});
  });

  it('does not duplicate a link already present on the target', () => {
    const source = { name: 'A', links: { npcs: ['Grixxa'] }, checklist: [] };
    const target = { name: 'B', links: { npcs: ['Grixxa'] }, checklist: [] };
    const { source: s, target: t } = moveLinkBetweenSessions(source, target, 'npcs', 'Grixxa');
    expect(t.links.npcs).toEqual(['Grixxa']);
    expect(s.links.npcs).toEqual([]);
    expect(t.checklist.filter(i => i.label === 'Grixxa notes on hand')).toHaveLength(1);
  });
});
