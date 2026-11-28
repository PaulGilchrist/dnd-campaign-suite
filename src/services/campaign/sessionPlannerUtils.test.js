// @maintained-by-ai 2026-11-27
/**
 * sessionPlannerUtils is a PURE data-shaping module (no fetch): GM session
 * drafts, link-bucket normalization, auto-checklist id/label recipes, the
 * shared session-played log-row derivation, the clipboard helper, and AI
 * prompt string builders. session.date is GM metadata passed through
 * verbatim — no Date math lives here, so no clock pinning is needed (the
 * no-game-timers rule is untested-by-default because the module touches no
 * wall-clock game state; newContingency's Date.now id is a random marker,
 * never value-pinned). Persistence is a separate lane: sessionsService.js.
 * projectSessionForRefine is pinned directly in
 * SessionPlannerModal.ai-refine.test.jsx (not duplicated here).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getDefaultSessionData,
  emptyLinks,
  countLinks,
  slugify,
  hasNotes,
  newContingency,
  buildAutoChecklist,
  mergeChecklist,
  checklistProgress,
  buildSessionPlayedLogText,
  buildXpBudgetPrompt,
  buildRumorPrompt,
  copyTextToClipboard,
  getBranchDef,
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
      notes: '',
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

describe('hasNotes', () => {
  it('is true only for a string with real content: trims whitespace, rejects non-strings', () => {
    expect(hasNotes('Secret DM hints')).toBe(true);
    expect(hasNotes('  spaced  ')).toBe(true);
    expect(hasNotes('')).toBe(false);
    expect(hasNotes('   ')).toBe(false);
    expect(hasNotes(undefined)).toBe(false);
    expect(hasNotes(null)).toBe(false);
    expect(hasNotes(42)).toBe(false);
  });
});

describe('buildAutoChecklist', () => {
  it('emits baseline + one exact item per linked name in maps→encounters→quests→settlements→npcs order (maps double with fog), and nothing for notes', () => {
    expect(buildAutoChecklist({
      maps: ['Smugglers Cave'],
      encounters: ['Cave Defenders'],
      quests: ['Lost Artifact'],
      settlements: ['Riverwood'],
      npcs: ['Grixxa'],
      notes: ['Loose thread'],
    })).toEqual([
      { id: 'auto-baseline-chars', label: 'Player characters up to date', auto: true },
      { id: 'auto-baseline-init', label: 'Initiative and dice ready', auto: true },
      { id: 'auto-map-smugglers-cave', label: 'Smugglers Cave set as active map', auto: true },
      { id: 'auto-map-smugglers-cave-fog', label: 'Fog of war reset', auto: true },
      { id: 'auto-enc-cave-defenders', label: 'Cave Defenders encounter saved and ready', auto: true },
      { id: 'auto-quest-lost-artifact', label: 'Lost Artifact quest brief ready to share', auto: true },
      { id: 'auto-settle-riverwood', label: 'Riverwood ready to roleplay', auto: true },
      { id: 'auto-npc-grixxa', label: 'Grixxa notes on hand', auto: true },
    ]);
    expect(buildAutoChecklist({}).map(i => i.id)).toEqual(['auto-baseline-chars', 'auto-baseline-init']);
    expect(buildAutoChecklist({ notes: ['Only a note'] }).map(i => i.id)).toEqual(['auto-baseline-chars', 'auto-baseline-init']);
  });
});

describe('mergeChecklist', () => {
  it('preserves done-state and custom items, drops stale auto items, and survives degenerate input — exact output', () => {
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
    // A missing checklist means every auto item starts fresh (none done).
    expect(mergeChecklist(undefined, { encounters: ['E'] })).toEqual([
      { id: 'auto-baseline-chars', label: 'Player characters up to date', auto: true, done: false },
      { id: 'auto-baseline-init', label: 'Initiative and dice ready', auto: true, done: false },
      { id: 'auto-enc-e', label: 'E encounter saved and ready', auto: true, done: false },
    ]);
  });
});

describe('checklistProgress', () => {
  it('reports done/total/pct, rounding both ways and guarding degenerate input', () => {
    expect(checklistProgress([{ done: true }, { done: false }, { done: true }, { done: false }])).toEqual({ done: 2, total: 4, pct: 50 });
    expect(checklistProgress([{ done: true }, { done: false }, { done: false }])).toEqual({ done: 1, total: 3, pct: 33 });
    expect(checklistProgress([{ done: true }, { done: true }, { done: false }])).toEqual({ done: 2, total: 3, pct: 67 });
    expect(checklistProgress([])).toEqual({ done: 0, total: 0, pct: 0 });
    expect(checklistProgress(null)).toEqual({ done: 0, total: 0, pct: 0 });
  });
});

describe('buildSessionPlayedLogText', () => {
  it('derives the exact log row: recap appended after an em-dash, blank/whitespace recap produces the plain row', () => {
    expect(buildSessionPlayedLogText('Cave Session', 'Great session recap')).toBe(
      'Session “Cave Session” marked as played — Great session recap'
    );
    expect(buildSessionPlayedLogText('Cave Session', '')).toBe('Session “Cave Session” marked as played');
    expect(buildSessionPlayedLogText('Cave Session', undefined)).toBe('Session “Cave Session” marked as played');
    expect(buildSessionPlayedLogText('Cave Session', '   ')).toBe('Session “Cave Session” marked as played');
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

  it('buildXpBudgetPrompt on a bare session says so, omits avg level, ignores non-numeric levels, and falls back to raw character count', () => {
    expect(buildXpBudgetPrompt({ name: 'One-shot' })).toBe([
      "You are a D&D 5e dungeon master's assistant. Suggest an XP budget and difficulty mix for an upcoming session.",
      'Campaign session: "One-shot".',
      'Party: 0 player characters.',
      'No encounters linked yet.',
      'Give a per-encounter XP budget (easy/medium/hard/deadly thresholds) and one line of advice on pacing.',
    ].join('\n'));
    // One finite level: counted party, avg derived only from the numeric levels.
    expect(buildXpBudgetPrompt({ name: 'One-shot' }, [{ level: 5 }, { level: 'six' }])).toContain('Party: 1 player characters, average level 5.');
    // No finite levels at all: partySize falls back to characters.length, no avg clause.
    expect(buildXpBudgetPrompt({ name: 'One-shot' }, [{ level: 'six' }, {}])).toContain('Party: 2 player characters.');
  });

  it('buildRumorPrompt renders the exact full prompt and drops every conditional line when bare', () => {
    const text = buildRumorPrompt(session, 'Frostfall');
    expect(text).toBe([
      "You are a D&D 5e dungeon master's assistant. Generate 3 rumors the players might hear at the start of this session.",
      'Campaign: Frostfall. Session: "Session 7" (2026-10-10).',
      'Settlements in play: Riverwood.',
      'NPCs the party may meet: Grixxa.',
      'Active quests to weave in: The Lost Artifact.',
      'Each rumor: 1-2 sentences, clearly labeled true / false / half-true, with a hint at the hook behind it.',
    ].join('\n'));
    expect(buildRumorPrompt({ name: 'One-shot' }, 'Test')).toBe([
      "You are a D&D 5e dungeon master's assistant. Generate 3 rumors the players might hear at the start of this session.",
      'Campaign: Test. Session: "One-shot".',
      'Each rumor: 1-2 sentences, clearly labeled true / false / half-true, with a hint at the hook behind it.',
    ].join('\n'));
  });
});

describe('contingency branches', () => {
  it('CONTINGENCY_BRANCHES is the exact three-branch registry and getBranchDef matches exactly or falls back to negotiate', () => {
    expect(CONTINGENCY_BRANCHES).toEqual([
      { value: 'negotiate', label: 'Negotiation', cls: 'session-branch-negotiate' },
      { value: 'alternate', label: 'Alternate route', cls: 'session-branch-alternate' },
      { value: 'failure', label: 'Failure / consequence', cls: 'session-branch-failure' },
    ]);
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

describe('copyTextToClipboard', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  afterEach(() => {
    if (original) {
      Object.defineProperty(navigator, 'clipboard', original);
    } else {
      delete navigator.clipboard;
    }
    vi.restoreAllMocks();
  });

  function stubClipboard(writeText) {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true, writable: true });
  }

  it('returns true after handing the exact text to writeText', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    await expect(copyTextToClipboard('copy me')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('copy me');
  });

  it('returns false and logs when the clipboard write rejects', async () => {
    const err = new Error('denied');
    stubClipboard(vi.fn().mockRejectedValue(err));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(copyTextToClipboard('copy me')).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalledWith('Failed to copy to clipboard:', err);
  });
});
