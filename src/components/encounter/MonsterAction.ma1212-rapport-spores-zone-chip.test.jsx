// MA-1212: Myconid Adult "Rapport Spores" — narrative telepathy-grant row
// (30-ft Emanation, no save, no damage, INT≥2 exclusion, 1 hour) previously
// authored junk attack_bonus:0: the "+0" chip rolled bogus to-hit attacks vs
// the armed target (live fingerprint 2026-09-25: Bandit vs Rapport Spores →
// two roll/attack bonus:0 log entries, one HIT with zero damage; ZERO te —
// the telepathy itself stayed inert). Fix = attack_bonus:null (no to-hit
// lane, MA-1071 gate already handles null) + authored save-less zone dict
// (demilich Stifling Mortality byte-twin shape) arming the NEW
// ACTION-category zone picker chip (.mc-dice-link-zone → handleLairZone
// zoneOnly picker → armZoneTargets registers rapport_spores te on each
// picker-SELECTED creature, no save/roll/damage). Sovereign/sprout sibling
// rows untouched (separate tickets MA-1217/MA-1220).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { isZonePickerRow } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const ADULT = monsters.find((m) => m.name === 'Myconid Adult');
const RAPPORT = ADULT.actions[2];
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

describe('MA-1212 disk lock: junk to-hit stripped, save-less zone dict authored', () => {
  it('Rapport Spores byte-row: attack_bonus:null (no to-hit lane), save_dc:0 decoy KEPT (MA-1071 pin), range stays empty (MA-181 range field never carries emanation prose)', () => {
    expect(RAPPORT.name).toBe('Rapport Spores');
    expect(RAPPORT.attack_bonus).toBeNull();
    expect(RAPPORT.save_dc).toBe(0);
    expect(RAPPORT.range).toBe('');
  });

  it('zone dict mirrors the demilich Stifling Mortality byte-shape + duration 1 hour', () => {
    expect(RAPPORT.zone.radius_ft).toBe(30);
    expect(RAPPORT.zone.no_save).toBe(true);
    expect(RAPPORT.zone.effect_key).toBe('rapport_spores');
    expect(RAPPORT.zone.noun).toBe('rapport spores');
    expect(RAPPORT.zone.advisory).toMatch(/GM-enforced/);
    expect(RAPPORT.duration).toBe('1 hour');
  });

  it('sovereign/sprout Rapport Spores siblings stay byte-identical (attack_bonus:0, no zone — MA-1217/MA-1220 sovereign territory)', () => {
    for (const name of ['Myconid Sovereign', 'Myconid Sprout']) {
      const row = monsters.find((m) => m.name === name)?.actions?.find(a => a.name === 'Rapport Spores');
      if (!row) continue;
      expect(row.attack_bonus).toBe(0);
      expect(row.zone).toBeUndefined();
    }
  });
});

describe('MA-1212 isZonePickerRow: narrowly arms the zone picker chip', () => {
  it('arms the save-less adult rapport row only among these twins', () => {
    expect(isZonePickerRow(RAPPORT)).toBe(true);
    expect(isZonePickerRow(DARKMANTLE_AURA)).toBe(false);
    expect(isZonePickerRow(DJINNI_WHIRLWIND)).toBe(false);
  });

  it('inert guards: no zone / no_save absent / save_dc armed / automation / attack bonus / no emanation wording', () => {
    expect(isZonePickerRow({ name: 'x', description: '30-foot Emanation.' })).toBe(false);
    expect(isZonePickerRow({ ...RAPPORT, zone: { ...RAPPORT.zone, no_save: false } })).toBe(false);
    expect(isZonePickerRow({ ...RAPPORT, save_dc: 13 })).toBe(false);
    expect(isZonePickerRow({ ...RAPPORT, automation: { type: 'monster_self_buff' } })).toBe(false);
    expect(isZonePickerRow({ ...RAPPORT, attack_bonus: 0 })).toBe(false);
    expect(isZonePickerRow({ ...RAPPORT, description: 'The myconid hums.' })).toBe(false);
  });
});

describe('MA-1212 render: zone picker chip arms, bogus attack chip is gone', () => {
  it('rapport row: NO "+0" attack chip, exactly one "30-ft Zone" chip; press routes onZonePickerRow with the row, zero attack/save calls', () => {
    const { container, onAttack, onSaveRoll, onZonePickerRow } = renderRow(RAPPORT);
    expect(container.textContent).not.toContain('+0');
    const zoneChips = container.querySelectorAll('.mc-dice-link-zone');
    expect(zoneChips.length).toBe(1);
    expect(zoneChips[0].textContent).toContain('30-ft Zone');
    fireEvent.click(zoneChips[0]);
    expect(onZonePickerRow).toHaveBeenCalledTimes(1);
    expect(onZonePickerRow.mock.calls[0][0].name).toBe('Rapport Spores');
    expect(onAttack).not.toHaveBeenCalled();
    expect(onSaveRoll).not.toHaveBeenCalled();
  });

  it('darkmantle self-aura twin keeps its aura chip and gains NO zone picker chip (self:true excluded, MA-0554)', () => {
    const { container, onZonePickerRow } = renderRow(DARKMANTLE_AURA);
    expect(container.querySelectorAll('.mc-dice-link-zone').length).toBe(0);
    expect(container.querySelectorAll('.mc-dice-link-aura').length).toBe(1);
    fireEvent.click(container.querySelector('.mc-dice-link-aura'));
    expect(onZonePickerRow).not.toHaveBeenCalled();
  });

  it('djinni save-zone twin gains NO zone picker chip (no_save absent — save lane owns it)', () => {
    const { container } = renderRow(DJINNI_WHIRLWIND);
    expect(container.querySelectorAll('.mc-dice-link-zone').length).toBe(0);
  });

  it('incapacitated attacker: zone chip renders inert (no click route)', () => {
    const { container, onZonePickerRow } = renderRow(RAPPORT, { attackerCannotAct: true });
    fireEvent.click(container.querySelector('.mc-dice-link-zone'));
    expect(onZonePickerRow).not.toHaveBeenCalled();
  });
});
