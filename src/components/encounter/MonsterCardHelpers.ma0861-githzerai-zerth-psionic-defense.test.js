// @maintained-by-ai: 2026-10-18 — MA-0861 OWNER: githzerai-zerth Psionic Defense disk-row lock (byte-twin of MA-0853 — press legs cite-skipped to #520)
// MA-0861 regression: Githzerai Zerth "Psionic Defense" (2/Day) — disk row was the
// broken MA-0853 twin (prose-only name/description/spellcasting_ability/uses-string
// = gate-null inert, zero affordance). Fix authors the MA-0006 feather_fall byte-shape
// onto the existing live seam: automation {type,trigger:'falling',effect:'feather_fall'}
// + numeric uses/maxUses 2 + usage "2/Day". Shield half stays GM-adjudicated advisory
// in automation.description.
// #520 trim (verified on disk by name): zerth reactions[0] is byte-IDENTICAL to the
// fixed githzerai-monk row — byte-twin, so the press/economy legs are shape-owned by
// MA-0853 (chip-arm + limit-2 arithmetic ma0853:63-71; sequential 2/Day spend-then-
// refusal ma0853:77-110) and gate mechanics by gated-reaction.test.js (#508 owner:
// plain-row→null, no-falling refusal). Per #422 byte-twin precedent the press leg is
// skipped entirely. This file pins ONLY this row's distinct existence as a monster row:
// direct field locks on zerth's own bytes + byte-twin identity against the owner row.
import { describe, it, expect } from 'vitest';
import monsters from '../../../public/data/monsters.json';

const ROW = monsters.find(m => m.index === 'githzerai-zerth').reactions[0];

describe('MA-0861 Zerth Psionic Defense disk row lock', () => {
  it('reactions[0] carries the MA-0006 feather_fall byte-shape 2/Day and is byte-twin of fixed MA-0853 githzerai-monk row', () => {
    expect(ROW.name).toBe('Psionic Defense');
    expect(ROW.description).toContain('<strong>Feather Fall</strong> or <strong>Shield</strong>');
    expect(ROW.spellcasting_ability).toBe('Wisdom');
    expect(ROW.automation).toMatchObject({ type: 'reaction', trigger: 'falling', effect: 'feather_fall' });
    expect(ROW.automation.description).toMatch(/GM adjudicates.*Shield.*no mechanical consumer/);
    expect(ROW.usage).toBe('2/Day');
    expect(ROW.uses).toBe(2);
    expect(ROW.maxUses).toBe(2);
    // Byte-twin of the #520 owner row → gate arming, uses arithmetic, sequential
    // 2/Day spend-then-refusal are byte-identical behavior; pinned there (#508).
    const monk = monsters.find(m => m.index === 'githzerai-monk').reactions[0];
    expect(JSON.stringify(ROW, Object.keys(ROW).sort())).toBe(JSON.stringify(monk, Object.keys(monk).sort()));
  });
});
