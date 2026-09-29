// MA-1546: Succubus "Charm" (Dominate Person lv8) — the row authored only
// save_dc/save_type, NO save_effect, so extractConditionsFromSaveEffect
// returned [] and applyDamagelessSaveConditions early-returned (saveProcessing
// .js:1048) — failed save applied NOTHING (§52/§1092 FAIL(b)/DATA). Fix:
// author save_effect byte-carrying the canonical word "charmed" after
// save_type (dryad Fey Charm MA-0654 / succubus-incubus twin byte-shape);
// the dominated-control layer stays GM-advisory in the save_effect copy
// (§70/§940). save_effect carries ONLY the canonical word "charmed" — any
// other canonical word would over-grant via the whole-string word scan
// (§793/§1105 discriminator). No fabricated numbers: row stays zero-damage
// (half-leak structurally impossible, §204). Description byte-unchanged.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import { extractConditionDurationNote } from '../../services/encounters/monsterAbilityUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SUCCUBUS = monsters.find((m) => m.index === 'succubus');
const CHARM = SUCCUBUS.actions.find((a) => a.name === 'Charm');
const KISS = SUCCUBUS.actions.find((a) => a.name === 'Draining Kiss');
const SI = monsters.find((m) => m.index === 'succubus-incubus');
const SI_CHARM = SI.actions.find((a) => a.name === 'Charm');

const CANONICAL = ['blinded', 'cursed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'];

describe('MA-1546 disk fingerprint: succubus Charm save_effect fix', () => {
  it('row keeps DC/type bytes unchanged and authors save_effect after save_type (twin placement)', () => {
    expect(CHARM.name).toBe('Charm');
    expect(CHARM.save_dc).toBe(15);
    expect(CHARM.save_type).toBe('Charisma');
    expect(typeof CHARM.save_effect).toBe('string');
    const keys = Object.keys(CHARM);
    expect(keys.indexOf('save_effect')).toBe(keys.indexOf('save_type') + 1);
  });

  it('description byte-unchanged (RAW Dominate Person cast copy)', () => {
    expect(CHARM.description).toBe('The succubus casts Dominate Person (level 8 version), requiring no spell components and using Charisma as the spellcasting ability (spell save DC 15).');
  });

  it('save_effect byte-carries ONLY the canonical word "charmed" — extractor yields exactly ["charmed"] (MV-31; no over-grant spray §793)', () => {
    expect(extractConditionsFromSaveEffect(CHARM.save_effect)).toEqual(['charmed']);
    for (const word of CANONICAL) {
      expect(CHARM.save_effect).not.toMatch(new RegExp(`\\b${word}\\b`, 'i'));
    }
  });

  it('duration note rides RAW "until the spell ends" — GM-enforced per §52/MA-0063 shape', () => {
    expect(extractConditionDurationNote(CHARM.save_effect)).toBe('until the spell ends (GM-enforced)');
  });

  it('dominated-control clause stays GM-advisory in save_effect copy', () => {
    expect(CHARM.save_effect).toMatch(/GM-enforced/);
  });

  it('no fabricated numerics: zero-damage row, no damage/automation/threshold fields', () => {
    expect(CHARM.damage_dice_primary).toBeUndefined();
    expect(CHARM.damage_type_primary).toBeUndefined();
    expect(CHARM.automation).toBeUndefined();
    expect(CHARM.hit_conditions).toBeUndefined();
    expect(CHARM.hp_threshold_kill).toBeUndefined();
    expect(CHARM.save_margin).toBeUndefined();
  });

  it('card renders one "DC 15 Charisma" clickable save chip; press threads saveConditions ["charmed"]', () => {
    const onSaveRoll = vi.fn();
    const { container } = render(
      <MonsterAction
        action={CHARM}
        index={2}
        attackerCannotAct={false}
        onAttack={vi.fn()}
        onDamage={vi.fn()}
        onSaveRoll={onSaveRoll}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
      />
    );
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['DC 15 Charisma']);
    fireEvent.click(container.querySelector('.mc-dice-link-save-clickable'));
    expect(onSaveRoll).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Charm' }),
      null,
      ['charmed'],
    );
  });

  it('Draining Kiss row byte-unchanged (separate MA-1547 axis): own save_effect kept', () => {
    expect(KISS.save_effect).toBe("13 (3d8) Psychic damage. Success: Half damage. Failure or Success: The target's Hit Point maximum decreases by an amount equal to the damage taken");
    expect(KISS.save_dc).toBe(15);
    expect(KISS.save_type).toBe('Constitution');
  });

  it('succubus-incubus twin Charm byte-unchanged (Wisdom DC 15, own save_effect)', () => {
    expect(SI_CHARM.save_type).toBe('Wisdom');
    expect(SI_CHARM.save_effect).toBe('The target is magically charmed for 1 day. Success: The target is immune to this effect for the next 24 hours.');
  });
});
