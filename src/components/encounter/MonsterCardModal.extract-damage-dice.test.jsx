// @maintained-by-ai
// Unit contract for extractDamageDiceFromDescription (MonsterCardModal.jsx:934-939) —
// the prose dice parser consumed by MonsterCardModal.jsx (:747/:754/:774/:1149/:1290/:1371)
// and MonsterAction.jsx (:211/:455). Called with falsy/unauthored damage_dice_primary so
// the regex leg actually runs (roarService.js:33-37 stage-swap relies on this fallback).
//
// Branches owned ELSEWHERE — not re-tested here:
//  - existingDamageDice short-circuit (truthy): ma0963-half-dragon-breath.test.js:47-48
//    ('8d6' real disk byte), ma0885-goat-ram-charge.test.jsx:201 ('1'),
//    monsterLairActions.test.js:4603-4605 ('3d6'), monsterLegendarySave.ma1952 (:31 note).
//  - regex NO-match (C-null): ma0963:50-53 real bytes ('Failure:</strong> 28 (8d6)' —
//    HTML breaks the anchor); ma1990-simurgh / dragon-turtle-steam-breath (no anchor).
//  - prose-parse smoke on real bytes: MonsterAction.ma0286-slam-suppression.test.js
//    census (20 primary-less disk rows parse via this helper).
// What remains below pins ONLY unpinned branches: falsy-description guard, keyword
// alternation × case-insensitivity × optional-sign modifier, whitespace normalization
// (real: 2 disk rows carry internal spaces), first-match (non-global) semantics, and
// digit-adjacency strictness inside the parens.

import { describe, it, expect } from 'vitest';
import { extractDamageDiceFromDescription } from './MonsterCardModal.jsx';

describe('extractDamageDiceFromDescription', () => {
  it.each([[null], [undefined], ['']])('falsy description %s → null (unguarded call sites pass action?.description)', (description) => {
    expect(extractDamageDiceFromDescription(description, null)).toBeNull();
  });

  it.each([
    ['Hit: 7 (1d6+3) piercing damage.', '1d6+3'],
    ['failure: 3 (1d4) poison damage.', '1d4'],
    ['SUCCESS: 5 (1d10-1) acid.', '1d10-1'],
    ['Hit: 7 (1d6  +  3) piercing damage.', '1d6 + 3'],
    ['Hit: 7 (1d6+3) fire, then 2d8+2 cold.', '1d6+3'],
  ])('%s → %s', (description, expected) => {
    expect(extractDamageDiceFromDescription(description)).toBe(expected);
  });

  it('does not match dice with spaces between die count and d', () => {
    expect(extractDamageDiceFromDescription('Hit: 7 ( 2 d6 + 1 ) damage.')).toBeNull();
  });
});
