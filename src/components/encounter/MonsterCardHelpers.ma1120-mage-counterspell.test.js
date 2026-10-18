// @maintained-by-ai
// MA-1120: SRD Mage "Protective Magic" reaction was prose-only inert
// (name+trigger+description only → getGatedMonsterReaction null → zero
// affordance). DATA fix mirrors the MA-0300 Arcanaloth RAW-unlimited At
// Will sentinel: usage "At Will" + uses/maxUses 999 + automation
// {type:'reaction', trigger:'enemy_spell_cast', effect:'counterspell'}.
// RAW residual: the row prose offers a Counterspell-OR-Shield choice; the
// gated seam resolves Counterspell only (accepted per MA-0314 archmage).
// Ownership after REC #517 trim (mirrors ma0300 helper #517): this lane
// keeps ONLY the BY-name disk lock + registry arm for the mage row (#387;
// #457 deleted the CHIP component twin declaring this lane exhaustive).
// Deleted legs and their owners: formatActionUsage "At Will" passthrough →
// usage.test.js; monsterReactionUsesRemaining 999-spend arithmetic + 'uses'
// refusal → gated-reaction.test.js:62-69 + shared-gate limit-999 admits arm
// :330-334; counterspellGate 998/999 sentinel table → same owners plus the
// MA-0013 resolve ladder :219-242 (auto-counter spend/stamp, d20+mod check
// vs DC via resolveCounterspellCheck :198-208 — old d20+INT leg was
// self-ref, test injected its own spellAbilityMod) and zero-spend
// latch/trigger refusals :252-268; RAW-unlimited never-caps press →
// ma0300 helper #517 At-Will-spend ladder.
import { describe, it, expect } from 'vitest';
import { getGatedMonsterReaction } from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const MAGE_ACTION = monsters.find(m => m.index === 'mage').reactions[0];

describe('MA-1120 mage Protective Magic data-lock', () => {
  it('monsters.json mage reactions[0] BY-name disk lock: name/trigger/prose + honest "At Will" + 999 sentinel + automation arms the counterspell registry', () => {
    expect(MAGE_ACTION.name).toBe('Protective Magic');
    expect(MAGE_ACTION.trigger).toBe('The mage is targeted by a spell');
    expect(MAGE_ACTION.description).toMatch(/Counterspell<\/strong> or <strong>Shield/);
    expect(MAGE_ACTION.usage).toBe('At Will');
    expect(MAGE_ACTION.maxUses).toBe(999);
    expect(MAGE_ACTION.uses).toBe(999);
    expect(MAGE_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'enemy_spell_cast', effect: 'counterspell' });
    expect(getGatedMonsterReaction(MAGE_ACTION)?.effect).toBe('counterspell');
  });
});
