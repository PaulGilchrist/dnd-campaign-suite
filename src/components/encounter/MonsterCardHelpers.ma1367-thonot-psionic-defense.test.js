// @maintained-by-ai: 2026-10-18 — MA-1367 OWNER: quaggoth-thonot Psionic Defense disk-row lock (shield byte-twin of MA-1170 — gate/press legs cite-skip owner per #422/#522)
// MA-1367: Quaggoth Thonot Psionic Defense — FAIL(b) zero affordance fixed with
// the MA-1170 Shield byte-shape (mind-flayer-arcanist / noble-prodigy verbatim).
// RAW: reaction to a spell trigger → casts Feather Fall OR Shield; the Shield leg
// rides the LIVE gated shield channel (registry effect 'shield' arms the chip,
// shieldGate requires a pending spell-origin lastAttack targeting the Thonot);
// press stamps activeBuffs {effect:'shield',acBonus:5,oneShot:true} — +5 folds
// generically via getShieldAcBonus, consumed after one defended attack. The
// Feather Fall leg stays GM-adjudicated advisory (row description carries the
// OR clause; githzerai "Psionic Defense" precedent). At Will sentinel
// (usage:'At Will'+uses/maxUses:999, MA-1140 shape). Refusals log
// shield_refused, zero spend.
// #522-family trim (verified on disk by name): thonot automation/usage/uses are
// byte-IDENTICAL to the MA-1170 arcanist owner row (same effect+limit+usage) →
// #422 pure-lock precedent (ma0861). Gate/press/refusal legs are byte-identical
// behavior, pinned at the owner: shieldIdentityRefusal truth table + shieldGate
// accept/refuse faces + resolve press e2e (999→998, one-shot buff, AC fold stamp)
// + reason-coded refusals — ma1170-shield-reaction.test.js:94-160; plain-row→
// null / gate machinery — gated-reaction.test.js:66/:84 (#508); +5 fold —
// useLoggedDiceRollUtils.core.test.js:148. Dropped: shieldGate accept + 6-face
// refusal table + resolver trigger-refusal + success press (all owner byte-copies);
// prose-only→null (owner :66); noble-prodigy cross-pin (transitive via
// ma1170:86); vi deps-mock (no resolver leg remains). Kept ONLY this row's
// distinct existence: BY-name disk lock (#387) — 'Psionic Defense' name +
// OR-clause prose arming the live Shield chip, automation byte-twin identity vs
// the owner row, At Will 999 sentinel bytes.
import { describe, it, expect } from 'vitest';
import { getGatedMonsterReaction } from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const THONOT_ACTION = monsters.find(m => m.index === 'quaggoth-thonot').reactions[0];
const ARC_SHIELD_ACTION = monsters.find(m => m.index === 'mind-flayer-arcanist').reactions[0];

describe('MA-1367 Thonot Psionic Defense disk-row lock', () => {
  it('reactions[0] BY-name lock: name/trigger/OR-clause prose kept, automation byte-twin of MA-1170 arcanist block with At Will 999 sentinel; arms the live Shield chip', () => {
    expect(THONOT_ACTION.name).toBe('Psionic Defense');
    expect(THONOT_ACTION.trigger).toBe('Trigger of a spell');
    expect(THONOT_ACTION.description).toMatch(/casts <strong>Feather Fall<\/strong> or <strong>Shield<\/strong> in response/);
    expect(THONOT_ACTION.automation).toEqual({ type: 'reaction', trigger: 'targeted_by_spell', effect: 'shield', acBonus: 5 });
    expect(THONOT_ACTION.usage).toBe('At Will');
    expect(THONOT_ACTION.uses).toBe(999);
    expect(THONOT_ACTION.maxUses).toBe(999);
    // Byte-twin of the MA-1170 owner row → shieldGate faces, refusal table,
    // press economy 999→998 and AC fold are byte-identical behavior; pinned there.
    expect(THONOT_ACTION.automation).toEqual(ARC_SHIELD_ACTION.automation);
    // Distinct arm input: a row named 'Psionic Defense' (not 'Shield') whose
    // OR-clause prose still arms the live shield channel — the MA-1367 fix.
    expect(getGatedMonsterReaction(THONOT_ACTION)).toMatchObject({ effect: 'shield', trigger: 'targeted_by_spell', label: 'Shield', icon: 'fa-shield' });
  });
});
