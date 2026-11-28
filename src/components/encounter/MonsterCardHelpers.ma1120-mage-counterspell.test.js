// @maintained-by-ai 2026-11-28
// MA-1120: SRD Mage "Protective Magic" reaction was prose-only inert
// (name+trigger+description only → getGatedMonsterReaction null → zero
// affordance). DATA fix mirrors the MA-0300 Arcanaloth RAW-unlimited At
// Will sentinel: usage "At Will" + uses/maxUses 999 + automation
// {type:'reaction', trigger:'enemy_spell_cast', effect:'counterspell'}.
// RAW residual: the row prose offers a Counterspell-OR-Shield choice; the
// gated seam resolves Counterspell only (accepted per MA-0314 archmage).
// Ownership (cross-file cites are describe-block references, never line
// numbers): this lane keeps ONLY the BY-name verbatim disk lock + registry
// arm for the mage row (#387; #457 deleted the CHIP component twin
// declaring this lane exhaustive). Cut legs + owners: formatActionUsage
// "At Will" passthrough → MonsterCardHelpers.usage.test.js; generic
// counterspell mechanics (uses arithmetic, plain-row null-negative) →
// gated-reaction 'MA-0006 gated monster reaction registry'; gate limit-999
// admit → 'MA-0341 Parry owner — registry + gate truth tables'; counterspell
// check arithmetic → 'MA-0013 Counterspell registry + pure check' (the old
// d20+INT leg here was self-ref, the test injected its own spellAbilityMod);
// auto-counter spend/stamp + zero-spend latch/trigger refusals → 'MA-0013
// resolveMonsterGatedReaction — Counterspell'; usage-less fabricated-1/Day
// seam (family fabrication leg) → 'MA-0013 usage-less-row seam — fabricated
// 1/Day cap (relocated from ma0305)'; 999-sentinel sequential-spend ladder
// → ma0300 helper (At-Will press ladder).
import { describe, it, expect } from 'vitest';
import { getGatedMonsterReaction } from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const MAGE_ACTION = monsters.find(m => m.index === 'mage').reactions[0];

describe('MA-1120 mage Protective Magic data-lock', () => {
  it('monsters.json mage reactions[0] BY-name verbatim disk lock + automation arms the counterspell registry', () => {
    expect(MAGE_ACTION).toEqual({
      name: 'Protective Magic',
      trigger: 'The mage is targeted by a spell',
      description: "The mage casts <strong>Counterspell</strong> or <strong>Shield</strong> in response to the spell's trigger, using the same spellcasting ability as Spellcasting.",
      usage: 'At Will',
      uses: 999,
      maxUses: 999,
      automation: { type: 'reaction', trigger: 'enemy_spell_cast', effect: 'counterspell' },
    });
    expect(getGatedMonsterReaction(MAGE_ACTION)?.effect).toBe('counterspell');
  });
});
