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
// Ownership map after #517 trim: BY-name disk lock for this row (#387;
// chip twin ma0305-chip deleted #422, so this disk lock is the monster-
// specific coverage). Cut legs + owners: monsterReactionUsesRemaining twin
// → gated-reaction.test.js:62-69 (#517); usage "At Will" formatActionUsage
// passthrough → ma1120:71-74 (usage string folded into the disk lock);
// cantrip auto + fresh-round second counter (press ladder) → ma0300:77-101
// (self-claims the ladder) + gated-reaction MA-0013:219-242; d20+CHA vs
// DC check → resolveCounterspellCheck owner gated-reaction:198-208 (#508
// self-ref precedent — this file injected its own spellAbilityMod);
// no-spell trigger refusal → gated-reaction:244-259; same-round latch →
// monsterReactionGate truth table gated-reaction:89 + MA-0013:246.
// KEPT besides the disk lock: the usage-less "fabricates a 1/Day cap" seam
// leg — verified sole pin suite-wide (only usage-less counterspellGate call;
// ma0314/ma1120 pin authored rows, gated-reaction:213 is the trigger lane,
// :248 a true 2/Day exhaustion; helpers seam at MonsterCardHelpers.js
// reactionMaxUses :2226 / refusal message :2246). RECOMMEND relocating this
// leg to the counterspell owner (gated-reaction MA-0013 lane) — it pins the
// generic seam default, not an arch-hag-specific value.
import { describe, it, expect } from 'vitest';
import {
  getGatedMonsterReaction,
  counterspellGate,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const HAG = 'Arch-hag 1';
const PC = 'DivinationWizard';

const HAG_ACTION = monsters.find(m => m.index === 'arch-hag').reactions[0];

function pcSpellAttack(overrides = {}) {
  return { attackerName: PC, targetName: HAG, attackName: 'Fire Bolt', rollType: 'attack', damageSchool: 'Evocation', isCantrip: true, ...overrides };
}

describe('MA-0305 arch-hag Tongue Twister data-lock', () => {
  it('monsters.json arch-hag reactions[0] carries the MA-0013/MA-0300 automation shape, honest "At Will" + 999 sentinel, arms the gate', () => {
    expect(HAG_ACTION.name).toBe('Tongue Twister');
    expect(HAG_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'enemy_spell_cast', effect: 'counterspell' });
    expect(HAG_ACTION.usage).toBe('At Will');
    expect(HAG_ACTION.maxUses).toBe(999);
    expect(HAG_ACTION.uses).toBe(999);
    expect(getGatedMonsterReaction(HAG_ACTION)?.effect).toBe('counterspell');
  });

  it('usage-less row would fabricate a 1/Day cap; the authored sentinel row stays open (sole seam pin — relocate to counterspell owner)', () => {
    // reactionMaxUses defaults to 1 with no uses/maxUses authored — this
    // documents the seam constraint that forces the finite sentinel.
    const usageless = { name: 'Tongue Twister', automation: { type: 'reaction', trigger: 'enemy_spell_cast', effect: 'counterspell' } };
    const g = counterspellGate({ lastAttack: pcSpellAttack(), attackerIsPC: true, monsterName: HAG, currentRound: 1, storedUses: { counterspell: 1 }, usedRound: 0, action: usageless });
    expect(g.ok).toBe(false);
    expect(g.reason).toBe('uses');
    expect(g.message).toMatch(/1\/Day uses already spent/);
    // The authored sentinel row stays open at 1 spent (RAW-unlimited behavior):
    const sentinel = counterspellGate({ lastAttack: pcSpellAttack(), attackerIsPC: true, monsterName: HAG, currentRound: 1, storedUses: { counterspell: 1 }, usedRound: 0, action: HAG_ACTION });
    expect(sentinel.ok).toBe(true);
    expect(sentinel.limit).toBe(999);
  });
});
