// @maintained-by-ai
// MA-0305: Arch-hag "Tongue Twister" reaction was prose-only inert (no
// automation metadata → getGatedMonsterReaction null → zero affordance).
// DATA fix byte-mirrors the live MA-0300 Arcanaloth template. RAW note:
// the arch-hag statblock prose carries NO per-day limit (unlimited
// reaction), but the seam's reactionMaxUses defaults to 1 when uses are
// absent — a usage-less row would fabricate a "1/Day uses already spent"
// refusal after a single counter. Honest sentinel: usage "At Will" (display
// truth) + 999 maxUses (finite number required by the seam; reset is
// GM-enforced advisory per CLA-325, same as all monster uses).
// Ownership map after #517 trim + this pass's fold/relocate: BY-name disk
// lock for this row is the ONLY leg (#387; chip twin ma0305-chip deleted
// #422, chip twins folded fix#269 — helper lane distinct, now folded too).
// Cut legs + owners: monsterReactionUsesRemaining twin → gated-reaction
// .test.js:62-69 (#517); usage "At Will" formatActionUsage passthrough →
// usage.test.js (usage string folded into the disk lock); cantrip auto +
// fresh-round second counter (press ladder) → ma0300:77-101 (self-claims
// the ladder) + gated-reaction MA-0013:219-242; d20+CHA vs DC check →
// resolveCounterspellCheck owner gated-reaction:198-208 (#508 self-ref
// precedent — this file injected its own spellAbilityMod); no-spell
// trigger refusal → gated-reaction:244-259; same-round latch →
// monsterReactionGate truth table gated-reaction:89 + MA-0013:246.
// 999-sentinel ARITHMETIC twins (rec #517 :93-96-era): fold CONFIRMED
// already landed at the #517 execution — the gate-level limit-999 admit
// for this exact row-shape is owned once by the shared-gate arm
// gated-reaction:330-334 plus the live counterspell press
// resolveMonsterCounterspell→counterspellGate (MonsterCardHelpers.js
// :2672) driven end-to-end by ma0300:77-101; arch-hag and arcanaloth are
// gate-input twins (byte-identical maxUses:999/effect:'counterspell'
// fields — the gate reads neither monster name), so both row types are
// covered by that sweep. RELOCATED this pass: the usage-less "fabricates a
// 1/Day cap" seam leg moved to the counterspell owner gated-reaction
// MA-0013:603-611, where it cites the default bytes reactionMaxUses
// MonsterCardHelpers.js:2226-2229 + the refusal render counterspellGate
// :1553-1556 (rec #517/#518: fabrication legs belong at the owner where
// the default is implemented, not re-simulated per-monster).
import { describe, it, expect } from 'vitest';
import { getGatedMonsterReaction } from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const HAG_ACTION = monsters.find(m => m.index === 'arch-hag').reactions[0];

describe('MA-0305 arch-hag Tongue Twister data-lock', () => {
  it('monsters.json arch-hag reactions[0] carries the MA-0013/MA-0300 automation shape, honest "At Will" + 999 sentinel, arms the gate', () => {
    expect(HAG_ACTION.name).toBe('Tongue Twister');
    expect(HAG_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'enemy_spell_cast', effect: 'counterspell' });
    expect(HAG_ACTION.usage).toBe('At Will');
    expect(HAG_ACTION.maxUses).toBe(999);
    expect(HAG_ACTION.uses).toBe(999);
    expect(getGatedMonsterReaction(HAG_ACTION)?.effect).toBe('counterspell');
  });
});
