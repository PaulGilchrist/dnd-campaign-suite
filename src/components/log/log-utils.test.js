// @maintained-by-ai
// Unit tests for the client-side log filter/window helpers in log-utils.js:
// filterLogEntries (AND-semantics facets), getEntrySearchText (recursive
// string harvest, ids skipped), formatEntryTypeLabel, LOG_WINDOW_SIZE.

import {
  filterLogEntries,
  formatEntryTypeLabel,
  getEntrySearchText,
  getRollTypeOptions,
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

  describe('filterLogEntries rollType sub-facet', () => {
    const rollEntries = [
      entry({ id: 'ra', type: 'roll', noteText: undefined, name: 'Attack', rollType: 'attack' }),
      entry({ id: 'rd', type: 'roll', noteText: undefined, name: 'Damage', rollType: 'damage' }),
      entry({ id: 'rs', type: 'roll', noteText: undefined, name: 'Save', rollType: 'save-fireball' }),
      entry({ id: 'rn', type: 'roll', noteText: undefined, name: 'Legacy roll' }), // no rollType field
      entry({ id: 'rb', type: 'note', noteText: 'A note', rollType: 'attack' }),  // rollType on a non-roll
    ];

    it('passes everything when no rollType filter is set (default)', () => {
      expect(filterLogEntries(rollEntries)).toHaveLength(5);
      expect(filterLogEntries(rollEntries, { rollType: '' })).toHaveLength(5);
    });

    it('keeps only matching type:roll entries (other types pass unconditionally)', () => {
      // 'rb' is a note carrying rollType:'attack' — notes pass under any rollType
      // selection by spec ("other types pass regardless").
      expect(filterLogEntries(rollEntries, { rollType: 'attack' }).map(e => e.id)).toEqual(['ra', 'rb']);
      expect(filterLogEntries(rollEntries, { rollType: 'save-fireball' }).map(e => e.id)).toEqual(['rs', 'rb']);
      // Narrowing among rolls is achieved by pairing with the type facet.
      expect(filterLogEntries(rollEntries, { type: 'roll', rollType: 'attack' }).map(e => e.id)).toEqual(['ra']);
    });

    it('rolls without a rollType field are dropped under a specific rollType', () => {
      expect(filterLogEntries(rollEntries, { rollType: 'damage' }).map(e => e.id)).not.toContain('rn');
      // ...but pass under "All roll types" (empty selection)
      expect(filterLogEntries(rollEntries, { type: 'roll' }).map(e => e.id))
        .toEqual(['ra', 'rd', 'rs', 'rn']);
    });

    it('non-roll entries pass regardless of the rollType selection', () => {
      const result = filterLogEntries(rollEntries, { rollType: 'damage' });
      // the note 'rb' survives even a rollType it does not carry
      expect(result.map(e => e.id)).toEqual(['rd', 'rb']);
    });

    it('AND-combines with the text/type/character facets', () => {
      expect(filterLogEntries(rollEntries, { type: 'roll', rollType: 'attack' }).map(e => e.id)).toEqual(['ra']);
      expect(filterLogEntries(rollEntries, { type: 'note', rollType: 'attack' }).map(e => e.id)).toEqual(['rb']);
      expect(filterLogEntries(rollEntries, { rollType: 'attack', character: 'Frodo' }).map(e => e.id)).toEqual(['ra', 'rb']);
      expect(filterLogEntries(rollEntries, { rollType: 'attack', character: 'Aragorn' })).toEqual([]);
      expect(filterLogEntries(rollEntries, { rollType: 'attack', text: 'attack' }).map(e => e.id)).toEqual(['ra', 'rb']);
      expect(filterLogEntries(rollEntries, { rollType: 'damage', character: 'Aragorn' })).toEqual([]);
    });
  });

  describe('getRollTypeOptions', () => {
    it('derives distinct sorted rollTypes from type:roll entries only', () => {
      const entries = [
        entry({ type: 'roll', noteText: undefined, rollType: 'save' }),
        entry({ type: 'roll', noteText: undefined, rollType: 'attack' }),
        entry({ type: 'roll', noteText: undefined, rollType: 'save' }), // dupe
        entry({ type: 'roll', noteText: undefined }),                   // no rollType
        entry({ type: 'note', rollType: 'initiative' }),                // non-roll — ignored
      ];
      expect(getRollTypeOptions(entries)).toEqual(['attack', 'save']);
    });

    it('includes dynamic save-<spell-slug> values present in the data', () => {
      const entries = [
        entry({ type: 'roll', noteText: undefined, rollType: 'save-ottos-dance' }),
        entry({ type: 'roll', noteText: undefined, rollType: 'initiative' }),
      ];
      expect(getRollTypeOptions(entries)).toEqual(['initiative', 'save-ottos-dance']);
    });

    it('returns an empty array when no roll entries carry rollType', () => {
      expect(getRollTypeOptions([entry()])).toEqual([]);
      expect(getRollTypeOptions([])).toEqual([]);
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
    it('splits hyphen/underscore types into per-word capitalised labels', () => {
      expect(formatEntryTypeLabel('gm-note')).toBe('GM Note');
      expect(formatEntryTypeLabel('hp_change')).toBe('Hp Change');
      expect(formatEntryTypeLabel('save_result')).toBe('Save Result');
      expect(formatEntryTypeLabel('death_save')).toBe('Death Save');
      expect(formatEntryTypeLabel('long_rest')).toBe('Long Rest');
    });

    it('uppercases known initialism words (GM, AI)', () => {
      expect(formatEntryTypeLabel('ai_designer')).toBe('AI Designer');
      expect(formatEntryTypeLabel('ai_dress')).toBe('AI Dress');
    });

    it('keeps single-word labels byte-identical (regression pins)', () => {
      expect(formatEntryTypeLabel('note')).toBe('Note');
      expect(formatEntryTypeLabel('roll')).toBe('Roll');
      expect(formatEntryTypeLabel('automation')).toBe('Automation');
      expect(formatEntryTypeLabel('unknown')).toBe('Unknown');
    });
  });

  it('exports a positive LOG_WINDOW_SIZE render cap', () => {
    expect(Number.isInteger(LOG_WINDOW_SIZE)).toBe(true);
    expect(LOG_WINDOW_SIZE).toBeGreaterThan(0);
  });
});
