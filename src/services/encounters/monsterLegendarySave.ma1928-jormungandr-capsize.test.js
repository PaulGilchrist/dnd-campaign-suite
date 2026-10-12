// MA-1928: Jormungandr legendary "Capsize (Costs 2 Actions)" shipped as a
// save-prose row delegating to Tail — the press adjudicated the delegated
// ATTACK pool (+19 vs AC, 4d12 + 9 Bludgeoning, live smoking gun
// lastAttack.saveDc:null) while the RAW DC 25 Strength save never ran and
// Prone rode the hit lane instead of the save lane (MA-1847 Apep Devour the
// Boat fingerprint, second live instance). DATA fix (this file's lock): the
// row stops delegating and self-resolves its own save mechanic —
// save_dc/save_type/damage_dice_primary/damage_type_primary/dc_success:"none"
// + save_effect byte-carrying canonical "Prone" (§346 word-scan is
// save_effect-only; description never read). Key order mirrors the MA-1847 /
// Cthulhu Madness Whisper twin byte-shape. The row renders its own
// "DC 25 Strength" chip riding the section-wrapped legendary gate, spend-
// then-save (§204/§507); shapeless "within 30 ft." range degrades to inline
// single-target save adjudication, advisory residual (§211/MA-1843/MA-1924).
// "(Costs 2 Actions)" stays name-text — cost token consumed live by the
// MA-1883 lane (spends 2 honestly). Header uses:3 intact (MA-1925 PASS).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';
import { canRollExpression } from '../../services/dice/diceRoller.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const JORMUNGANDR = monsters.find((m) => m.index === 'jormungandr');
const CAPSIZE = JORMUNGANDR.legendary_actions[3];

describe('MA-1928 disk fingerprint: Jormungandr Capsize self-resolving save row', () => {
  it('authors the full RAW save mechanic — DC 25 STR, 4d8 Bludgeoning, nothing on success', () => {
    expect(JORMUNGANDR.name).toBe('Jormungandr');
    expect(CAPSIZE.name).toBe('Capsize (Costs 2 Actions)');
    expect(CAPSIZE.save_dc).toBe(25);
    expect(CAPSIZE.save_type).toBe('Strength');
    expect(CAPSIZE.damage_dice_primary).toBe('4d8');
    expect(CAPSIZE.damage_type_primary).toBe('Bludgeoning');
    expect(CAPSIZE.dc_success).toBe('none');
    expect(canRollExpression(CAPSIZE.damage_dice_primary)).toBe(true);
  });

  it('delegates_to is REMOVED — the Tail attack-pool hijack is dead (§225)', () => {
    expect(CAPSIZE.delegates_to).toBeUndefined();
    expect(CAPSIZE.attack_bonus).toBeUndefined();
    expect(CAPSIZE.reach).toBeUndefined();
  });

  it('name/description byte-unchanged; structured keys after description (MA-1847 twin placement)', () => {
    expect(CAPSIZE.description).toBe(
      'Jormungandr thrashes the water beneath a vehicle or structure. Each creature within 30 ft. of it must succeed on a DC 25 Strength saving throw or fall Prone and take 18 (4d8) Bludgeoning damage.'
    );
    const keys = Object.keys(CAPSIZE);
    expect(keys).toEqual([
      'name',
      'description',
      'save_dc',
      'save_type',
      'damage_dice_primary',
      'damage_type_primary',
      'dc_success',
      'save_effect',
    ]);
  });

  it('save_effect byte-carries canonical "Prone"; word-scan yields the save-fail grant', () => {
    expect(CAPSIZE.save_effect).toBe('The target falls Prone and takes 18 (4d8) Bludgeoning damage.');
    expect(extractConditionsFromSaveEffect(CAPSIZE.save_effect)).toEqual(['prone']);
  });

  it('siblings byte-inert: header uses:3 (MA-1925), Bite delegate, Venom Drip hit-clause row unchanged', () => {
    const [header, bite, drip] = JORMUNGANDR.legendary_actions;
    expect(header.name).toBe('Legendary Action Uses: 3');
    expect(header.uses).toBe(3);
    expect(header.save_dc).toBeUndefined();
    expect(bite.delegates_to).toBe('Bite');
    expect(bite.save_dc).toBeUndefined();
    expect(drip.attack_bonus).toBe(17);
    expect(drip.hit_conditions).toEqual(['poisoned']);
    // Capsize stays clause-less on the ATTACK lane — Prone rides the SAVE lane only.
    expect(CAPSIZE.hit_conditions).toBeUndefined();
  });
});
