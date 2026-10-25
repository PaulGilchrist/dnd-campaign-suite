// @maintained-by-ai
// Unit tests for the client-side log filter/window helpers in log-utils.js:
// filterLogEntries (AND-semantics facets), getEntrySearchText (recursive
// string harvest, ids skipped), formatEntryTypeLabel, LOG_WINDOW_SIZE.

import {
  filterLogEntries,
  formatEntryTypeLabel,
  getEntrySearchText,
  LOG_WINDOW_SIZE
} from './log-utils.js';

const entry = (o = {}) => ({
  id: 'x1',
  type: 'note',
  characterName: 'Frodo',
  timestamp: 1700000000000,
  noteText: 'Quest begins.',
  ...o
});

describe('log-utils filter helpers', () => {
  describe('filterLogEntries', () => {
    const entries = [
      entry({ id: 'a', noteText: 'Quest begins.' }),
      entry({ id: 'b', characterName: 'Aragorn', noteText: 'Ambush at dawn' }),
      entry({ id: 'c', type: 'roll', characterName: 'Frodo', noteText: undefined, name: 'Longsword Attack', rolls: [19] }),
      entry({ id: 'd', type: 'spell', characterName: 'Gandalf', noteText: undefined, spellName: 'Fireball' }),
    ];

    it('returns all entries when no facets are set', () => {
      expect(filterLogEntries(entries)).toHaveLength(4);
      expect(filterLogEntries(entries, {})).toHaveLength(4);
      expect(filterLogEntries(entries, { text: '', type: '', character: '' })).toHaveLength(4);
    });

    it('type facet keeps only entries of that type', () => {
      const result = filterLogEntries(entries, { type: 'note' });
      expect(result.map(e => e.id)).toEqual(['a', 'b']);
    });

    it('character facet keeps only that character\'s entries', () => {
      const result = filterLogEntries(entries, { character: 'Frodo' });
      expect(result.map(e => e.id)).toEqual(['a', 'c']);
    });

    it('text facet is case-insensitive and trimmed', () => {
      expect(filterLogEntries(entries, { text: 'QUEST' }).map(e => e.id)).toEqual(['a']);
      expect(filterLogEntries(entries, { text: '  quest BegIns  ' }).map(e => e.id)).toEqual(['a']);
    });

    it('text searches per-type content fields, not just notes', () => {
      expect(filterLogEntries(entries, { text: 'fireball' }).map(e => e.id)).toEqual(['d']);
      expect(filterLogEntries(entries, { text: 'longsword' }).map(e => e.id)).toEqual(['c']);
    });

    it('facets combine with AND semantics', () => {
      expect(filterLogEntries(entries, { character: 'Frodo', type: 'note' }).map(e => e.id)).toEqual(['a']);
      expect(filterLogEntries(entries, { character: 'Frodo', type: 'note', text: 'ambush' })).toEqual([]);
      expect(filterLogEntries(entries, { character: 'Aragorn', type: 'note', text: 'ambush' }).map(e => e.id)).toEqual(['b']);
    });

    it('returns an empty array when nothing matches', () => {
      expect(filterLogEntries(entries, { text: 'zzz-no-match' })).toEqual([]);
      expect(filterLogEntries(entries, { type: 'loot' })).toEqual([]);
    });
  });

  describe('getEntrySearchText', () => {
    it('lowercases and joins nested string values', () => {
      const text = getEntrySearchText({
        id: 'abc123',
        type: 'summons',
        characterName: 'Wizard',
        summonedCreatures: ['Small Spider', 'Weasel'],
        nested: { deep: 'Hollow Bytes' },
      });
      expect(text).toContain('wizard');
      expect(text).toContain('small spider');
      expect(text).toContain('hollow bytes');
    });

    it('skips the entry id so ids are never searchable', () => {
      expect(getEntrySearchText(entry({ id: 'abc123' }))).not.toContain('abc123');
    });

    it('ignores numeric values (timestamps are not text)', () => {
      expect(getEntrySearchText(entry())).not.toContain('1700000000000');
    });
  });

  describe('formatEntryTypeLabel', () => {
    it('humanises snake_case type keys', () => {
      expect(formatEntryTypeLabel('death_save')).toBe('Death save');
      expect(formatEntryTypeLabel('long_rest')).toBe('Long rest');
      expect(formatEntryTypeLabel('note')).toBe('Note');
    });
  });

  it('exports a positive LOG_WINDOW_SIZE render cap', () => {
    expect(Number.isInteger(LOG_WINDOW_SIZE)).toBe(true);
    expect(LOG_WINDOW_SIZE).toBeGreaterThan(0);
  });
});
