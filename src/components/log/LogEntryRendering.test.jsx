// @maintained-by-ai
// CONTAINER DISPATCH lane — owns type→component routing for Log.jsx ENTRY_COMPONENTS.
// This lane proves WHICH component each entry type resolves to (root-class marker
// bytes only), never WHAT the leaf says. Leaf content is owned by the leaf lanes:
//   condition #876 (LogCondition.test.jsx), death_save #877 (LogDeathSave.test.jsx),
//   encounter #878 (LogEncounter.test.jsx), roll (LogRoll.test.jsx), loot (LogLoot.test.jsx),
//   hp/healing (LogHpChange/LogHpHealing.test.jsx), spell (LogSpell.test.jsx),
//   metamagic pool (LogMetamagicPool.test.jsx), rest/misc (LogMiscEntries.test.jsx),
//   travel (LogTravel.test.jsx), note CONTENT census (LogNotes.test.jsx — canonical
//   home since #885 absorbed the ex-#879 retained pin; the duplicate content test was
//   dropped here fix#336S, this lane keeps only the .log-note routing marker byte :100).
//
// type → component → root-class marker (newest-first batch below pins all of these):
//   roll→RollEntry .log-roll          note→NoteEntry .log-note
//   travel→TravelEntry .log-travel    loot→LootEntry .log-loot
//   condition→ConditionEntry          encounter→EncounterEntry
//   hp_change→HpChangeEntry           healing→HealingEntry .log-healing+i.fa-heart
//   death_save→DeathSaveEntry        spell→SpellEntry .log-spell
//   metamagic/metamagic_use→MetamagicEntry .log-metamagic (same component, both legs)
//   healing_pool→HealingPoolEntry .log-healing+i.fa-hand-holding-heart (root class is
//     shared with HealingEntry; icon is the cheapest distinguishing byte)
//   ability_use→AbilityUseEntry       short_rest/long_rest→RestEntry (same component)
//   automation→AutomationEntry        save_result→SaveResultEntry
//   psionic_sorcery→PsionicSorceryEntry  summons→SummonsEntry
//   spell_effect→SpellEffectEntry     buff→BuffEntry   music→MusicEntry
//
// old->new map: "reverse chronological order" folded into batch order pins (#864:
// authored order, test never re-sorts); "skips unknown" → exact empty-wrapper bytes;
// "empty log"/"loading" → exact authored placeholder strings (#829); two NoteEntry
// content tests consolidated into one with custom values (same legs, distinct strings).

import { screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
import {
  roll, note, travel, loot, cond, enc, hp, heal, ds, spell, meta,
  automation, saveResult, psionic, summons, spellEffect, buff, rest,
  q, setup, beforeEachSetup,
} from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('Log container dispatch', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('routes every authored entry type to its leaf component, rendered newest-first', () => {
    // One entry per type key in ENTRY_COMPONENTS, authored chronological (oldest first).
    setup(Log, [
      roll({ id: 'd-roll' }),
      note({ id: 'd-note' }),
      travel({ id: 'd-travel' }),
      loot({ id: 'd-loot' }),
      cond({ id: 'd-cond' }),
      enc({ id: 'd-enc' }),
      hp({ id: 'd-hp' }),
      heal({ id: 'd-heal' }),
      ds({ id: 'd-ds' }),
      spell({ id: 'd-spell' }),
      meta({ id: 'd-meta' }),
      meta({ id: 'd-meta-use', type: 'metamagic_use' }),
      { id: 'd-pool', type: 'healing_pool', sourceName: 'Cleric', featureName: 'Healing Pool',
        targetName: 'Frodo', amount: 5, poolAfter: 3, timestamp: 1700000000000 },
      { id: 'd-ability', type: 'ability_use', characterName: 'Frodo', abilityName: 'Rage',
        timestamp: 1700000000000 },
      rest({ id: 'd-short', type: 'short_rest', message: 'Short rest | Minor recovery' }),
      rest({ id: 'd-long' }),
      automation({ id: 'd-auto' }),
      saveResult({ id: 'd-save' }),
      psionic({ id: 'd-psionic' }),
      summons({ id: 'd-summons' }),
      spellEffect({ id: 'd-spell-effect' }),
      buff({ id: 'd-buff' }),
      { id: 'd-music', type: 'music', mood: 'calm', timestamp: 1700000000000 },
    ]);

    // Authored pin: expected leaf roots in rendered order (newest first — pins
    // reverse-order rendering too). [root className, distinguishing marker or null]
    const expected = [
      ['log-entry log-music', null],
      ['log-entry log-buff log-buff-added', null],
      ['log-entry log-spell-effect', null],
      ['log-entry log-summons', null],
      ['log-entry log-psionic-sorcery', null],
      ['log-entry log-save-result-entry log-save-result-success', null],
      ['log-entry log-automation', null],
      ['log-entry log-rest log-rest-long', null],
      ['log-entry log-rest log-rest-short', null],
      ['log-entry log-ability-use', null],
      ['log-entry log-healing', 'i.fa-hand-holding-heart'],
      ['log-entry log-metamagic', null],
      ['log-entry log-metamagic', null],
      ['log-entry log-spell', null],
      ['log-entry log-death-save log-death-save-success', null],
      ['log-entry log-healing', 'i.fa-heart'],
      ['log-entry log-hp-change log-hp-damage', null],
      ['log-entry log-encounter log-encounter-start', null],
      ['log-entry log-condition log-condition-applied', null],
      ['log-entry log-loot', null],
      ['log-entry log-travel', null],
      ['log-entry log-note', null],
      ['log-entry log-roll', null],
    ];

    const wrappers = Array.from(q('.log-entries').children);
    expect(wrappers.length).toBe(expected.length);
    expected.forEach(([root, marker], i) => {
      expect(wrappers[i].firstElementChild.className).toBe(root);
      if (marker) expect(wrappers[i].querySelector(marker)).toBeInTheDocument();
    });
  });

  it('renders unknown entry types as an honest blank wrapper (no entry markup, no text)', () => {
    setup(Log, [
      note({ id: 'a', noteText: 'Valid' }),
      { id: '?', type: 'unknown' },
      note({ id: 'b', noteText: 'Also valid' }),
    ]);
    // Authored fallback: LogEntryRenderer emits a wrapper <div> per entry, but an
    // unknown type gets no children at all — pin the exact blank, not just absence.
    const wrappers = Array.from(q('.log-entries').children);
    expect(wrappers.map(w => w.children.length)).toEqual([1, 0, 1]);
    expect(wrappers[1].textContent).toBe('');
    expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument();
  });

  it('shows the exact loading placeholder when not initialized', () => {
    setup(Log, [note({ noteText: 'hi' })], false);
    expect(q('.log-loading')).toHaveTextContent('Loading log...');
    expect(document.querySelectorAll('.log-entry').length).toBe(0);
  });

  it('shows the exact empty placeholder when initialized with no entries', () => {
    setup(Log, []);
    expect(q('.log-empty')).toHaveTextContent('No entries yet. Roll dice or add a note to get started.');
    expect(document.querySelectorAll('.log-entry').length).toBe(0);
  });

  // NoteEntry content bytes are owned by LogNotes.test.jsx (canonical home, #885
  // census absorbed here fix#336S); routing marker retained at :100 above.
});
