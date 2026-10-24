// @maintained-by-ai
// MA-1212/1217/1220: Myconid rapport family (Adult actions[2] / Sovereign
// actions[4] / Sprout actions[1]) — save-less telepathy-grant zone rows.
// Authored junk attack_bonus:0 rolled bogus "+0" to-hit attacks (live
// fingerprint 2026-09-25: Bandit vs Rapport Spores → two roll/attack
// bonus:0 log entries, one HIT zero damage, ZERO te). Fix = attack_bonus:
// null (MA-1071 gate) + save-less zone dict {radius_ft,no_save,effect_key,
// noun,advisory} arming the ACTION-category zone chip (.mc-dice-link-zone →
// onZonePickerRow → modal zoneOnly picker, te on picker-SELECTED creatures,
// no save/roll/damage). §165: "1 hour" stays advisory GM-enforced text —
// seam-scoped, never a clock.
// OWNERS OUTSIDE THIS FILE (trimmed, cited):
//  - zoneTe payload + zoneOnly picker dispatch (save_dc null, excludeNames,
//    zero roll seams) + sovereign/sprout twin runs incl. attackChips==[]
//    → MonsterCardModal.ma1212-rapport-spores-zone-picker.test.jsx
//  - picker-confirm te grant + caster tracking →
//    ../char-sheet/modals/shared/SaveAttackAoeModal.ma1212-rapport-zone-grant.test.jsx
//  - breathAoeShape save_dc:0 → null → MonsterCardModal.save-variant-shape.test.jsx:59-61
//  - rapport_spores te registry → services/combat/conditions/targetEffectDefinitions.test.js:124
//  - sovereign Animating Spores summon lane → services/encounters/monsterSummon.test.js:716
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { isZonePickerRow } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const ADULT = monsters.find((m) => m.name === 'Myconid Adult');
const RAPPORT = ADULT.actions[2];
const SOVEREIGN = monsters.find((m) => m.name === 'Myconid Sovereign');
const SOV_RAPPORT = SOVEREIGN.actions[4];
const SPROUT = monsters.find((m) => m.name === 'Myconid Sprout');
const SPR_RAPPORT = SPROUT.actions[1];
const DARKMANTLE_AURA = monsters.find((m) => m.name === 'Darkmantle').actions[1];
const DJINNI_WHIRLWIND = monsters.find((m) => m.name === 'Djinni').actions[3];

const renderRow = (action, extra = {}) => {
  const onAttack = vi.fn();
  const onSaveRoll = vi.fn();
  const onZonePickerRow = vi.fn();
  const { container } = render(
    <MonsterAction
      action={action}
      index={2}
      attackerCannotAct={false}
      onAttack={onAttack}
      onDamage={vi.fn()}
      onSaveRoll={onSaveRoll}
      onSpellCast={vi.fn()}
      reactionUsesUsed={{}}
      onGatedReaction={vi.fn()}
      onZonePickerRow={onZonePickerRow}
      {...extra}
    />
  );
  return { container, onAttack, onSaveRoll, onZonePickerRow };
};

describe('MA-1212 disk lock: junk to-hit stripped, save-less zone dict authored (owner cited by ma1071:14)', () => {
  it('adult Rapport Spores byte-row: attack_bonus:null (no to-hit lane), save_dc:0 decoy KEPT (MA-1071 pin), range stays empty (MA-181 range field never carries emanation prose), zone dict demilich-byte-shape + duration 1 hour advisory', () => {
    expect(RAPPORT.name).toBe('Rapport Spores');
    expect(RAPPORT.attack_bonus).toBeNull();
    expect(RAPPORT.save_dc).toBe(0);
    expect(RAPPORT.range).toBe('');
    expect(RAPPORT.zone.radius_ft).toBe(30);
    expect(RAPPORT.zone.no_save).toBe(true);
    expect(RAPPORT.zone.effect_key).toBe('rapport_spores');
    expect(RAPPORT.zone.noun).toBe('rapport spores');
    expect(RAPPORT.zone.advisory).toMatch(/GM-enforced/);
    expect(RAPPORT.duration).toBe('1 hour');
  });

  // §216 STALE-PIN INVERSION (MA-1217/MA-1220): sovereign+sprout twins
  // formerly byte-dirty (attack_bonus:0, zone:undefined); both fixes landed
  // — the whole rapport family is byte-equal at the zone-picker seam.
  it('MA-1217/1220 sovereign+sprout rapport twins byte-mirror the adult fix (attack_bonus:null, save_dc:0, byte-equal zone dict, emanation wording the gate needs)', () => {
    [SOV_RAPPORT, SPR_RAPPORT].forEach((twin) => {
      expect(twin.name).toBe('Rapport Spores');
      expect(twin.attack_bonus).toBeNull();
      expect(twin.save_dc).toBe(0);
      expect(twin.range).toBe('');
      expect(twin.zone).toEqual(RAPPORT.zone);
      expect(twin.duration).toBe('1 hour');
      expect(twin.description).toMatch(/emanation/i);
    });
    expect(SPROUT.actions[0].attack_bonus).toBe(1); // Slam untouched (attack lane)
  });
});

describe('MA-1212 isZonePickerRow: narrowly arms the zone picker chip', () => {
  it('arms adult rapport only — disk negatives (self-aura/save-lane/automation/attack rows) and synthetic guard edits all stay inert', () => {
    expect(isZonePickerRow(RAPPORT)).toBe(true);
    // Disk-derived negatives (twin rows render-tested at modal owner):
    expect(isZonePickerRow(DARKMANTLE_AURA)).toBe(false); // self:true aura, MA-0554
    expect(isZonePickerRow(DJINNI_WHIRLWIND)).toBe(false); // save_dc armed — save lane owns it
    expect(isZonePickerRow(SOVEREIGN.actions[2])).toBe(false); // Animating Spores (automation)
    expect(isZonePickerRow(SOVEREIGN.actions[3])).toBe(false); // Pacifying Spores (save lane)
    expect(isZonePickerRow(SPROUT.actions[0])).toBe(false); // Slam (attack lane)
    // Synthetic guard matrix (no disk row exercises these forks):
    expect(isZonePickerRow({ name: 'x', description: '30-foot Emanation.' })).toBe(false); // no zone
    expect(isZonePickerRow({ ...RAPPORT, zone: { ...RAPPORT.zone, no_save: false } })).toBe(false);
    expect(isZonePickerRow({ ...RAPPORT, save_dc: 13 })).toBe(false);
    expect(isZonePickerRow({ ...RAPPORT, automation: { type: 'monster_self_buff' } })).toBe(false);
    expect(isZonePickerRow({ ...RAPPORT, attack_bonus: 0 })).toBe(false); // the #423-#465 junk-bonus regression shape
    expect(isZonePickerRow({ ...RAPPORT, description: 'The myconid hums.' })).toBe(false); // no emanation wording
  });
});

describe('MA-1212 render: zone picker chip arms, bogus attack chip is gone', () => {
  it('rapport row: NO "+0" attack chip, exactly one "30-ft Zone" chip; press dispatches the raw disk row to onZonePickerRow, zero attack/save calls', () => {
    const { container, onAttack, onSaveRoll, onZonePickerRow } = renderRow(RAPPORT);
    expect(container.textContent).not.toContain('+0');
    const zoneChips = container.querySelectorAll('.mc-dice-link-zone');
    expect(zoneChips.length).toBe(1);
    expect(zoneChips[0].textContent).toContain('30-ft Zone');
    fireEvent.click(zoneChips[0]);
    expect(onZonePickerRow).toHaveBeenCalledTimes(1);
    // Exact dispatch payload: the untouched disk row rides through unchanged.
    expect(onZonePickerRow.mock.calls[0][0]).toBe(RAPPORT);
    expect(onAttack).not.toHaveBeenCalled();
    expect(onSaveRoll).not.toHaveBeenCalled();
  });

  it('darkmantle self-aura + djinni save-zone twins gain NO zone picker chip — their own lanes byte-intact (MA-0554 aura chip, save shell)', () => {
    const dark = renderRow(DARKMANTLE_AURA);
    expect(dark.container.querySelectorAll('.mc-dice-link-zone').length).toBe(0);
    expect(dark.container.querySelectorAll('.mc-dice-link-aura').length).toBe(1);
    fireEvent.click(dark.container.querySelector('.mc-dice-link-aura'));
    expect(dark.onZonePickerRow).not.toHaveBeenCalled();
    const djinni = renderRow(DJINNI_WHIRLWIND);
    expect(djinni.container.querySelectorAll('.mc-dice-link-zone').length).toBe(0);
  });

  it('incapacitated attacker: zone chip renders inert (no click route)', () => {
    const { container, onZonePickerRow } = renderRow(RAPPORT, { attackerCannotAct: true });
    fireEvent.click(container.querySelector('.mc-dice-link-zone'));
    expect(onZonePickerRow).not.toHaveBeenCalled();
  });
});
