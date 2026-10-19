// @maintained-by-ai
// SPELL CAST ENTRY lane — owns every byte SpellEntry (LogSpellEntry.jsx) renders for a
// type:'spell' CAST event: header (wand icon, caster, exact 'Cast {spellName}', the
// targetName and targets targeting legs, timestamp) and details (authored spell-level
// format is exactly 'Level {n}' — no ordinals; casting time; damage AND-gated on
// formula && type; 'Save DC {n}'; the Concentration log-entry marker; the metamagic
// list vs 'No Metamagic' ternary with '{n} SP' cost; description injected as HTML).
// spell vs spellEffect split (from Log.jsx ENTRY_COMPONENTS, both directions):
//   type:'spell'        → SpellEntry        = cast-event entry  (THIS lane)
//   type:'spell_effect' → SpellEffectEntry  = effect-applied entry (target + effects
//     list bytes) → LogMiscEntries.test.jsx (#884)
// CUT (owner cited): type→component routing incl .log-spell root → LogEntryRendering
// (#879); standalone MetamagicEntry content ('Metamagic Applied', empowered) →
// LogMetamagicPool (#883 — its header assigns spell.metamagic option lists to this lane);
// condition-entry DC/ability legs ('condition') → LogCondition (#876); generic roll
// bytes → LogRoll (#886) — SpellEntry embeds no roll display, so no roll bytes are
// queued here; the creature-card concentration BADGE lane (#820) is distinct from this
// log-entry marker.
// old->new map (8 -> 2):
//   header core + both targeting legs + damage + save DC + concentration + description
//     HTML + metamagic list/cost/count(8,9) -> T1 one fully populated entry, exact
//     bytes, fixed TS (#829/#876)
//   target omit('' and []) + damage halves (formula-only AND type-only) + saveDC null +
//     concentration false + description '' + 'No Metamagic'(7) + ternary both branches +
//     spCost-0 hide(8) + 'Level 0' cantrip (zero not falsy-suppressed) -> T2 two-entry
//     falsy matrix in one render

import { beforeEach } from 'vitest';
import { spell, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

const TS = 1700000000000; // fixed epoch — never assert against Date.now() output

const textsOf = (sel) => [...document.querySelectorAll(sel)].map((n) => n.textContent.trim());

describe('Log > SpellEntry', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('renders a fully populated cast entry with exact bytes', () => {
    setup(Log, [spell({
      characterName: 'Zarmina', spellName: 'Cone of Cold', spellLevel: 5,
      castingTime: 'Bonus Action', targetName: 'Frost Troll',
      targets: ['Orc', 'Hobgoblin', 'Winter Wolf'],
      damageFormula: '8d6', damageType: 'cold', saveDC: 15, concentration: true,
      metamagic: ['Empowered Spell', 'Quickened Spell'], spCost: 2,
      description: '<p>A <b>frigid</b> arc bursts outward.</p>', timestamp: TS,
    })]);

    expect(q('.log-entry.log-spell')).toBeInTheDocument();
    expect(q('.log-spell i.fa-wand-magic-sparkles')).toBeInTheDocument();
    expect(q('.log-character').textContent).toBe('Zarmina');
    expect(q('.log-name').textContent).toBe('Cast Cone of Cold');
    expect(q('.log-target').textContent).toBe('→ Frost Troll');
    expect(q('.log-targets').textContent).toBe('→ Orc, Hobgoblin, Winter Wolf');
    expect(q('.log-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(q('.log-spell-level').textContent).toBe('Level 5');
    expect(q('.log-spell-casting-time').textContent).toBe('Bonus Action');
    expect(q('.log-damage').textContent).toBe('8d6 cold');
    expect(q('.log-save-dc').textContent).toBe('Save DC 15');
    expect(q('.log-concentration i.fa-link')).toBeInTheDocument();
    expect(q('.log-concentration').textContent.trim()).toBe('Concentration');
    expect(textsOf('.log-metamagic-option')).toEqual(['Empowered Spell', 'Quickened Spell']);
    expect(q('.log-metamagic-cost').textContent).toBe('2 SP');
    expect(q('.log-no-metamagic')).not.toBeInTheDocument();
    // description is injected as HTML, not escaped text
    expect(q('.log-spell-description b')).toBeInTheDocument();
    expect(q('.log-spell-description').textContent).toBe('A frigid arc bursts outward.');
  });

  it('suppresses every falsy optional leg, AND-gates damage on formula+type, and switches the metamagic ternary', () => {
    // oldest first; Log renders newest-first, so s-min is the first .log-spell
    setup(Log, [
      spell({
        id: 's-falsy', spellLevel: 0, targetName: '', targets: [],
        damageFormula: '8d6', damageType: '', saveDC: null, concentration: false,
        description: '', metamagic: ['Quickened Spell'], spCost: 0, timestamp: TS,
      }),
      spell({ id: 's-min', damageFormula: '', damageType: 'fire', timestamp: TS }),
    ]);

    expect(document.querySelectorAll('.log-spell').length).toBe(2);
    // damage is authored as formula && type — neither half alone renders
    expect(q('.log-damage')).not.toBeInTheDocument();
    expect(q('.log-target')).not.toBeInTheDocument();
    expect(q('.log-targets')).not.toBeInTheDocument();
    expect(q('.log-save-dc')).not.toBeInTheDocument();
    expect(q('.log-concentration')).not.toBeInTheDocument();
    expect(q('.log-spell-description')).not.toBeInTheDocument();
    // spellLevel 0 renders honestly ('Level 0'), never falsy-suppressed
    expect(textsOf('.log-spell-level')).toEqual(['Level 3', 'Level 0']);
    // ternary: empty metamagic -> 'No Metamagic'; non-empty -> list, cost hidden at 0
    expect(textsOf('.log-no-metamagic')).toEqual(['No Metamagic']);
    expect(textsOf('.log-metamagic-list')).toHaveLength(1);
    expect(textsOf('.log-metamagic-option')).toEqual(['Quickened Spell']);
    expect(q('.log-metamagic-cost')).not.toBeInTheDocument();
  });
});
