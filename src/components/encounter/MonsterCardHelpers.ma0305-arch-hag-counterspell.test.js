// @maintained-by-ai 2026-11-28
// MA-0305: Arch-hag "Tongue Twister" reaction was prose-only inert (no
// automation metadata → getGatedMonsterReaction null → zero affordance).
// DATA fix byte-mirrors the live MA-0300 Arcanaloth template. RAW note:
// the arch-hag statblock prose carries NO per-day limit (unlimited
// reaction), but the seam's reactionMaxUses defaults to 1 when uses are
// absent — a usage-less row would fabricate a "1/Day uses already spent"
// refusal after a single counter. Honest sentinel: usage "At Will" (display
// truth) + 999 maxUses (finite number required by the seam; reset is
// GM-enforced advisory per CLA-325, same as all monster uses).
// Ownership map (cites refreshed to describe-blocks/functions this pass):
// BY-name disk lock for this row is the ONLY leg here — arch-hag is the
// only monster with a cursed-clause counterspell row, so the verbatim row
// is the unique coverage. All generic counterspell mechanics live at owners:
//  - monsterReactionUsesRemaining arithmetic → gated-reaction.test.js
//    describe 'MA-0006 gated monster reaction registry'
//  - usage "At Will" formatActionUsage passthrough → usage.test.js
//    describe 'MA-0049 formatActionUsage — owner truth table' (usage string
//    is also pinned verbatim inside the disk lock below)
//  - cantrip auto + fresh-round second counter (press ladder) →
//    ma0300-arcanaloth describe 'MA-0300 arcanaloth Counterspell — disk
//    lock + RAW-unlimited sentinel' (self-claims the ladder) +
//    gated-reaction describe 'MA-0013 resolveMonsterGatedReaction —
//    Counterspell'
//  - d20+ability vs DC 10+level check → gated-reaction describe
//    'MA-0013 Counterspell registry + pure check' (resolveCounterspellCheck
//    arm; #508 self-ref precedent — this file injected its own
//    spellAbilityMod)
//  - no-spell trigger refusal + same-round latch → gated-reaction describe
//    'MA-0013 resolveMonsterGatedReaction — Counterspell' (refusals arm) +
//    describe 'MA-0006 monsterReactionGate truth table' (latch row)
//  - 999-sentinel ARITHMETIC twins: gate-level limit-999 admit for this
//    row-shape is owned once by the shared-gate arm in gated-reaction
//    describe 'MA-0341 Parry owner — registry + gate truth tables'
//    (parryGate limit-999 admit), plus the live counterspell press
//    resolveMonsterCounterspell→counterspellGate (MonsterCardHelpers.js)
//    driven end-to-end by the ma0300 ladder; arch-hag and arcanaloth are
//    gate-input twins (byte-identical maxUses:999/effect:'counterspell'
//    fields — the gate reads neither monster name), so both row types are
//    covered by that sweep.
//  - usage-less "fabricates a 1/Day cap" seam leg → relocated to
//    gated-reaction describe 'MA-0013 usage-less-row seam — fabricated
//    1/Day cap (relocated from ma0305)', where it cites the default bytes
//    reactionMaxUses + the refusal render counterspellGate (both
//    MonsterCardHelpers.js functions) — fabrication legs belong at the
//    owner where the default is implemented, not re-simulated per-monster.
import { describe, it, expect } from 'vitest';
import { getGatedMonsterReaction } from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

describe('MA-0305 arch-hag Tongue Twister data-lock', () => {
  it('monsters.json arch-hag reactions[0] is disk-verbatim (MA-0013/MA-0300 shape, honest "At Will" + 999 sentinel), arms the gate', () => {
    const action = monsters.find(m => m.index === 'arch-hag').reactions[0];
    expect(action).toEqual({
      name: 'Tongue Twister',
      description: "The hag casts <em>Counterspell</em> in response to that spell's trigger, using the same spellcasting ability as Spellcasting. If the target fails its saving throw, it is <strong>cursed</strong> until the end of its next turn. Until the curse ends, the target can't cast spells with a Verbal component, and when it speaks, it says the opposite of what it means.",
      usage: 'At Will',
      uses: 999,
      maxUses: 999,
      automation: { type: 'reaction', trigger: 'enemy_spell_cast', effect: 'counterspell' },
    });
    expect(getGatedMonsterReaction(action)?.effect).toBe('counterspell');
  });
});
