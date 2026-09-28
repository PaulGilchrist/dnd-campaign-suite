// MA-1520: Sprite "Enchanting Bow" — the row's OWN Hit clause carries the
// Charmed rider ("Hit: 1 Piercing damage, and the target has the Charmed
// condition until the start of the sprite's next turn") but the row authored
// NO hit_conditions (§59/§950 fingerprint — buildHitConditionClause reads
// hit_conditions / hit_target_effect / hit_condition_roll only, NEVER
// description prose on the attack-hit path), so the rider was inert
// zero-state FAIL(a). Fix: DATA one-field hit_conditions:["charmed"] after
// range (MA-0984 Trash Lob / MA-1274 otyugh byte-shape). Flat-damage row
// stays byte-unchanged: damage_dice_primary ABSENT → extractFlatHitDamage
// (:2739) supplies the constant "1" (MA-0322 lineage, flat never doubles on
// crit). §108 residual: engine-wide took-damage clears Charmed inside
// applyDamage BEFORE the hit clause re-grants (handlePlainDamage.js:1154 →
// :1181) — live ledger shows removed→applied pairs per hit; accepted.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SPRITE = monsters.find((m) => m.index === 'sprite');
const BOW = SPRITE.actions[1];

describe('MA-1520 disk fingerprint: sprite Enchanting Bow hit_conditions fix', () => {
  it('row authors hit_conditions ["charmed"] after range (MA-0984/MA-0010 byte-shape)', () => {
    expect(BOW.name).toBe('Enchanting Bow');
    expect(BOW.attack_bonus).toBe(6);
    expect(BOW.range).toBe('40/160 ft.');
    expect(BOW.hit_conditions).toEqual(['charmed']);
    const keys = Object.keys(BOW);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('range') + 1);
  });

  it('flat-damage row byte-unchanged: NO damage dice authored (extractFlatHitDamage supplies "1")', () => {
    expect(BOW.damage_dice_primary).toBeUndefined();
    expect(BOW.damage_type_primary).toBeUndefined();
  });

  it('no save/decoy fields: only hit_conditions arms the hit grant path (§118)', () => {
    expect(BOW.save_dc).toBeUndefined();
    expect(BOW.save_type).toBeUndefined();
    expect(BOW.save_effect).toBeUndefined();
    expect(BOW.escape_dc).toBeUndefined();
    expect(BOW.hit_target_effect).toBeUndefined();
    expect(BOW.hit_condition_roll).toBeUndefined();
  });

  it('Hit clause prose still carries the canonical Charmed word (rider belongs to HIT)', () => {
    expect(BOW.description).toMatch(/Hit:.*Charmed/s);
  });

  it('buildHitConditionClause arms the Charmed rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(BOW);
    expect(clause).toEqual({
      conditions: ['charmed'],
      escapeDc: null,
      attackName: 'Enchanting Bow',
      targetEffect: null,
    });
  });

  it('Needle Sword twin byte-unchanged: still no rider of its own', () => {
    const sword = SPRITE.actions[0];
    expect(sword.name).toBe('Needle Sword');
    expect(sword.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(sword)).toBeNull();
  });

  it('attack half stays live: one "+6" chip, no save/DC decoy chip', () => {
    expect(attackRowMissingToHit(BOW)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={BOW}
        index={1}
        attackerCannotAct={false}
        onAttack={onAttack}
        onDamage={vi.fn()}
        onSaveRoll={vi.fn()}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
      />
    );
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['+6']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Enchanting Bow', 6, expect.objectContaining({ name: 'Enchanting Bow' }));
  });
});
