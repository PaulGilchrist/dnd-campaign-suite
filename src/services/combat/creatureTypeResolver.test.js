// @maintained-by-ai
// Lane: services/combat/creatureTypeResolver.js — resolveCreatureType(creature) (CLA-173/SP-094)
// Contract (pure resolver → zero mocks, #952): no creature → undefined; else creature.monsterType || creature.type.
//   • Precedence (#967): runtime monsterType beats CONTRADICTING declared type — EB-joined monsters carry
//     type:'npc' with the real type in monsterType; the SP-094 bug was consumers resolving the carrier byte 'npc'.
//   • `||` not `??` falsifier (#842): empty-string monsterType falls through to type.
//   • NO case/trim normalization: bytes pass through verbatim — monsters.json itself ships both 'Undead'
//     and 'aberration' (verified census below), so consumers own any case folding, the resolver never does.
// Consumers (feed combatSummary creature bytes; their own lanes cover downstream gating — don't duplicate here):
//   saveProcessing.js:1276 (+ saveProcessing.pfeg-charm-immunity.test.js lane), handleNpcSaveDamage.js:245, handlePlainDamage.js:630,
//   contextBuilder-sync.js:201 (isCreatureWarded), useLoggedDiceRollEventHandlers.js:102, MonsterCardModal.jsx:1003.
// Split note: automationPassives kind-gate (#970 WM-008) gates WEAPON kind, NOT creature type — distinct lane.
// Data (#820): fixtures are verbatim monsters.json rows (byte-exact, never transcribed shapes); carrier bytes
//   ('npc' + monsterType) are assembled exactly as encounterToInitiative.js:97 / npcCombatService.js:42 build them.
// Old→new map: 'returns the real monsterType...' + 'falls through to type for PCs' + 'returns undefined when no
//   creature' → one falsifiable it.each truth table (guards folded full-zero, #936) + monsters.json byte census.
import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';
import { resolveCreatureType } from './creatureTypeResolver.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));

describe('resolveCreatureType (SP-094)', () => {
  it.each([
    // Precedence falsifier: contradicting bytes — a resolver reading type (or ??-style lookup) returns 'npc'.
    ['monsterType wins over contradicting declared type', { name: 'Zombie 1', type: 'npc', monsterType: 'Undead' }, 'Undead'],
    // || falsifier: empty-string monsterType is falsy so the ladder falls through to type ('??' would return '').
    ['empty-string monsterType falls through to type', { name: 'Succubus 1', type: 'npc', monsterType: '' }, 'npc'],
    // No-normalization falsifier: verbatim monsters.json row (name+type) with authored lowercase byte.
    ['lowercase byte returned verbatim', { name: 'Aberrant Spirit (Beholderkin)', type: 'npc', monsterType: 'aberration' }, 'aberration'],
    // Fallback legs: PCs/custom NPCs carry no usable monsterType — declared byte passes through unchanged.
    ['player byte passes through', { name: 'Cleric', type: 'player' }, 'player'],
    ['pc byte passes through', { name: 'Thorin', type: 'pc' }, 'pc'],
    // Guards folded full-zero (#936): no monsterType and no type — undefined, no fabricated default.
    ['empty object', {}, undefined],
    ['undefined creature', undefined, undefined],
    ['null creature', null, undefined],
  ])('%s', (_label, creature, expected) => {
    expect(resolveCreatureType(creature)).toBe(expected);
  });

  it('monsters.json byte census: every bestiary row resolves to its own authored type, never the carrier byte "npc"', () => {
    expect(monsters.length).toBeGreaterThan(0);
    // Carrier creature built exactly like encounterToInitiative.js:97 (type:'npc', monsterType:monster.type).
    const mismatches = monsters
      .map((m) => ({ name: m.name, authored: m.type, resolved: resolveCreatureType({ name: m.name, type: 'npc', monsterType: m.type }) }))
      .filter(({ authored, resolved }) => resolved !== authored || resolved === 'npc');
    expect(mismatches).toEqual([]);
  });
});
