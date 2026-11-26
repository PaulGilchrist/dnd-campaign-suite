// @maintained-by-ai
// Chronicle compose model (backlog Item 2): the deliberate include/exclude
// entry-type set, session grouping, forward-time ordering, the unsessioned
// bucket, session section dating, and the Markdown export built from the SAME
// composed model. Pure logic — no DOM, no fetch.
import { describe, it, expect } from 'vitest';
import {
  chronicleBeatFor,
  composeChronicle,
  chronicleToMarkdown,
  chronicleFileName,
  formatChronicleDate,
  UNSESSIONED_TITLE,
} from './chronicleService.js';

const T = (day, minute = 0) => new Date(2026, 10, day, 10, minute).getTime();

// ── row factories mirroring real producer shapes (log.js stamps `session`) ──
const narrative = (o = {}) => ({
  id: 'n1', type: 'narrative', characterName: 'GM', timestamp: T(1),
  description: 'The gate groans open.', session: null, ...o,
});
const recap = (o = {}) => ({
  id: 'rc1', type: 'session_recap', characterName: 'GM', timestamp: T(1),
  description: '## The siege ends\nThe party **prevails**.', recapSession: 'Session 1', session: 'Session 1', ...o,
});
const played = (o = {}) => ({
  id: 'sp1', type: 'session-played', timestamp: T(1),
  text: 'Session “Session 1” marked as played — the dragon fled', session: 'Session 1', ...o,
});
const enc = (o = {}) => ({
  id: 'e1', type: 'encounter', action: 'started', encounterName: 'Orc Ambush',
  monsters: ['Goblin', 'Orc'], xpPerChar: 0, timestamp: T(1), session: null, ...o,
});
const loot = (o = {}) => ({
  id: 'l1', type: 'loot', xpPerChar: 1200, lootItems: ['Bag of Holding'], timestamp: T(1), session: null, ...o,
});
const rest = (o = {}) => ({
  id: 'r1', type: 'long_rest', message: 'The party rests at camp | HP restored', timestamp: T(1), session: null, ...o,
});
const travel = (o = {}) => ({
  id: 't1', type: 'travel', action: 'arrived', hex: { q: 3, r: -7 }, terrain: 'Hills',
  weather: 'Clear', timestamp: T(1), session: null, ...o,
});

describe('chronicleBeatFor — the include list', () => {
  it('narrative rows become prose beats carrying markdown + author', () => {
    const beat = chronicleBeatFor(narrative({ name: 'Veer', description: 'Rain lashes the **road**.' }));
    expect(beat).toMatchObject({ kind: 'prose', author: 'GM', speaker: 'Veer', isRecap: false });
    expect(beat.markdown).toBe('Rain lashes the **road**.');
  });

  it('session_recap rows become prose beats titled by recapSession (the SUBJECT)', () => {
    const beat = chronicleBeatFor(recap());
    expect(beat).toMatchObject({ kind: 'prose', isRecap: true, recapSession: 'Session 1' });
  });

  it('session-played rows become milestone beats read through the lane-local text field', () => {
    const beat = chronicleBeatFor(played());
    expect(beat).toMatchObject({ kind: 'milestone', label: 'Session Played' });
    expect(beat.text).toContain('marked as played');
  });

  it('encounter started/completed seams become beats; joined/loot_awarded do not', () => {
    expect(chronicleBeatFor(enc())).toMatchObject({ kind: 'encounter', action: 'started', encounterName: 'Orc Ambush', monsters: ['Goblin', 'Orc'] });
    expect(chronicleBeatFor(enc({ id: 'e2', action: 'completed', xpPerChar: 900 }))).toMatchObject({ action: 'completed', xpPerChar: 900 });
    expect(chronicleBeatFor(enc({ action: 'joined' }))).toBeNull();
    expect(chronicleBeatFor(enc({ action: 'loot_awarded' }))).toBeNull();
  });

  it('loot rows become beats; an award with neither items nor XP is noise', () => {
    expect(chronicleBeatFor(loot())).toMatchObject({ kind: 'loot', xpPerChar: 1200, lootItems: ['Bag of Holding'] });
    expect(chronicleBeatFor(loot({ xpPerChar: 0, lootItems: [] }))).toBeNull();
  });

  it('rests become beats with the long/short label', () => {
    expect(chronicleBeatFor(rest())).toMatchObject({ kind: 'rest', long: true, label: 'Long Rest' });
    expect(chronicleBeatFor(rest({ id: 'r2', type: 'short_rest' }))).toMatchObject({ long: false, label: 'Short Rest' });
  });

  it('story travel legs become beats; event-menu/cancel plumbing does not', () => {
    expect(chronicleBeatFor(travel())).toMatchObject({ kind: 'travel', label: 'Arrived at', hex: '(3, -7)', terrain: 'Hills', weather: 'Clear' });
    expect(chronicleBeatFor(travel({ id: 't2', action: 'advance_with_event', eventTitle: 'Bandar', eventType: 'ambush' }))).toMatchObject({ eventTitle: 'Bandar', eventType: 'ambush' });
    for (const action of ['event_accept', 'event_skip', 'event_reroll', 'cancel']) {
      expect(chronicleBeatFor(travel({ id: action, action }))).toBeNull();
    }
  });

  it('prose rows with no readable text never become beats', () => {
    expect(chronicleBeatFor(narrative({ description: '   ' }))).toBeNull();
    expect(chronicleBeatFor({ id: 'x', type: 'session-played', timestamp: T(1) })).toBeNull();
  });
});

describe('chronicleBeatFor — the exclude list (mechanics noise stays out)', () => {
  const NOISE = [
    { type: 'note', characterName: 'Frodo', noteText: 'I look for traps.' },
    { type: 'roll', rollType: 'attack', message: 'Frodo attacks: 20' },
    { type: 'hp_change', message: 'Gimli takes 5 damage' },
    { type: 'healing', message: 'Frodo heals 10' },
    { type: 'healing_pool', message: 'pool' },
    { type: 'death_save', message: 'save' },
    { type: 'condition', message: 'charmed applied' },
    { type: 'spell', message: 'Fireball cast' },
    { type: 'spell_effect', message: 'Bless on Party' },
    { type: 'buff', message: 'Blessing added' },
    { type: 'ability_use', message: 'Rage used' },
    { type: 'save_result', message: 'save passed' },
    { type: 'summons', message: 'Spider summoned' },
    { type: 'metamagic', message: 'Empowered' },
    { type: 'metamagic_use', message: 'Empowered' },
    { type: 'psionic_sorcery', message: 'psionic' },
    { type: 'automation', description: 'feat fired' },
    { type: 'automation_info', description: 'info' },
    { type: 'action_complete', message: 'done' },
    { type: 'concentration_lost', message: 'lost' },
    { type: 'material_consumed', message: 'used' },
    { type: 'ward_absorbed', message: 'absorbed' },
    { type: 'info', text: 'sidebar info' },
    { type: 'inventory_transfer', message: 'item moved' },
    { type: 'session_active', message: 'session started' },
    { type: 'session_phase', message: 'phase' },
    { type: 'music', message: 'mood' },
    { type: 'write_rejected', message: 'refused' },
    { type: 'enforcement_denied', message: 'denied' },
    { type: 'enforcement_clock_expired', message: 'expired' },
    { type: 'enforcement_cover', message: 'cover' },
    { type: 'enforcement_triggered', message: 'triggered' },
    { type: 'ai_world', message: 'AI proposed a thing' },
    { type: 'ai_world_applied', message: 'applied' },
    { type: 'ai_director', message: 'directed' },
    { type: 'ai_designer', message: 'designed' },
    { type: 'ai_refine', message: 'refined' },
    { type: 'ai_dress', message: 'dressed' },
    { type: 'ai_authoring', message: 'authored' },
    { type: 'ai_ruling', message: 'ruled' },
    { type: 'ai_ruling_applied', message: 'ruled' },
    { type: 'ai_director_applied', message: 'directed' },
    { type: 'ai_draft_approved', message: 'approved' },
    { type: 'ai_draft_rejected', message: 'rejected' },
    { type: 'adventure_regenerated', message: 'regen' },
    { type: 'map_regenerated', message: 'regen' },
    { type: 'something_else', message: 'future type defaults OUT' },
  ];
  it.each(NOISE)('$type rows never become beats', (row) => {
    expect(chronicleBeatFor({ id: 'x', timestamp: T(1), ...row })).toBeNull();
  });
});

describe('composeChronicle — grouping and ordering', () => {
  it('groups rows by the server session stamp, sections forward by first beat', () => {
    const { sections, beatCount } = composeChronicle([
      narrative({ id: 'a', timestamp: T(2, 30), session: 'Session 2' }),
      narrative({ id: 'b', timestamp: T(1, 5), session: 'Session 1' }),
      narrative({ id: 'c', timestamp: T(1, 1), session: 'Session 1' }),
    ]);
    expect(beatCount).toBe(3);
    expect(sections.map(s => s.name)).toEqual(['Session 1', 'Session 2']);
    expect(sections[0].startTimestamp).toBe(T(1, 1));
  });

  it('orders beats FORWARD in time inside a section even when the input is scrambled', () => {
    const { sections } = composeChronicle([
      loot({ id: 'l', timestamp: T(1, 3) }),
      narrative({ id: 'n', timestamp: T(1, 1), description: 'first' }),
      rest({ id: 'r', timestamp: T(1, 2) }),
    ]);
    expect(sections[0].beats.map(b => b.id)).toEqual(['n', 'r', 'l']);
  });

  it('unsessioned rows collect in a trailing Campaign-span section (name null)', () => {
    const { sections } = composeChronicle([
      narrative({ id: 'u', timestamp: T(9), session: null }),
      narrative({ id: 's', timestamp: T(1), session: 'Session 1' }),
      narrative({ id: 'u2', timestamp: T(10), session: undefined }),
    ]);
    expect(sections.map(s => s.name)).toEqual(['Session 1', null]);
    expect(sections[1].beats.map(b => b.id)).toEqual(['u', 'u2']);
  });

  it('whitespace-only session stamps count as unsessioned', () => {
    const { sections } = composeChronicle([narrative({ session: '   ' })]);
    expect(sections).toHaveLength(1);
    expect(sections[0].name).toBeNull();
  });

  it('an empty log (or a log of pure noise) composes no sections', () => {
    expect(composeChronicle([])).toEqual({ sections: [], beatCount: 0 });
    expect(composeChronicle([{ type: 'roll', message: 'nat 20', timestamp: T(1) }]).beatCount).toBe(0);
  });

  it('formatChronicleDate renders the section date with year, month and day', () => {
    const out = formatChronicleDate(T(25));
    expect(out).toContain('2026');
    expect(out).toContain('25');
  });
});

describe('chronicleToMarkdown — export from the same composed model', () => {
  const seeded = [
    narrative({ id: 'n1', timestamp: T(1, 1), description: 'The gate groans **open**.', session: 'Session 1' }),
    enc({ id: 'e1', timestamp: T(1, 2), session: 'Session 1' }),
    loot({ id: 'l1', timestamp: T(1, 3), xpPerChar: 1200, lootItems: ['Bag of Holding'], session: 'Session 1' }),
    { ...rest(), timestamp: T(1, 4), session: 'Session 1' },
    recap({ id: 'rc1', timestamp: T(1, 5) }),
    played({ id: 'sp1', timestamp: T(1, 6) }),
    travel({ id: 't1', timestamp: T(2, 0), session: null }),
    { type: 'roll', id: 'x', message: 'Frodo hits for 12', timestamp: T(1, 7), session: 'Session 1' },
  ];

  it('title, session header with date, forward-ordered beats, and noise exclusion', () => {
    const md = chronicleToMarkdown('test-campaign', composeChronicle(seeded));
    expect(md.startsWith('# test-campaign — Chronicle')).toBe(true);
    expect(md).toContain(`## Session 1 — ${formatChronicleDate(T(1))}`);
    expect(md).toContain(`## ${UNSESSIONED_TITLE}`);
    // prose markdown survives verbatim
    expect(md).toContain('The gate groans **open**.');
    // milestone/seam/loot/rest lines render
    expect(md).toContain('- **Encounter Started** — Orc Ambush (Goblin, Orc)');
    expect(md).toContain('- **Loot Awarded** — 1,200 XP per character\n  - Bag of Holding');
    expect(md).toContain('- **Long Rest** — The party rests at camp | HP restored');
    expect(md).toContain('- **Session Played** — Session “Session 1” marked as played — the dragon fled');
    // recap gets its titled section
    expect(md).toContain('### Session Recap — Session 1');
    expect(md).toContain('The party **prevails**.');
    // travel beat under Campaign-span
    expect(md).toContain('- **Arrived at** (3, -7) · Hills · Clear');
    // mechanics noise NEVER appears
    expect(md).not.toContain('Frodo hits for 12');
    // forward order: the gate prose precedes the encounter seam
    expect(md.indexOf('The gate groans')).toBeLessThan(md.indexOf('Encounter Started'));
  });

  it('an empty chronicle exports just the title (never a stray heading)', () => {
    const md = chronicleToMarkdown('test-campaign', composeChronicle([]));
    expect(md.trim()).toBe('# test-campaign — Chronicle');
  });
});

describe('chronicleFileName', () => {
  it('slugs the campaign into one .md filename per campaign export', () => {
    expect(chronicleFileName('test-campaign')).toBe('test-campaign-chronicle.md');
    expect(chronicleFileName('Frostfall: The Long Winter')).toBe('frostfall-the-long-winter-chronicle.md');
    expect(chronicleFileName('')).toBe('campaign-chronicle.md');
  });
});
