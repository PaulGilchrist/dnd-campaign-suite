// @maintained-by-ai
// MA-1014: Ice Devil "Ice Wall" — the spell_save_dc-only zone/utility row
// (spell_save_dc 17, Intelligence, recharge "6", no save_dc/range/damage
// fields) rendered ZERO affordance. Fix lane A (code only, data byte-unchanged):
// isUtilitySpellCastRow arms SpellCastLinks with the <strong>-marked spell name
// ONLY when it resolves in the modal's spells.json name index (§158/§161
// fake-chip guard), routing to the recharge-gated advisory cast (MA-0031).
// OWNED here (component-on-disk-row only): disk fingerprint BY NAME, the
// app-wide isUtilitySpellCastRow census (exact set — the sole pin of the
// save_dc/name exclusion arms incl. Doppelganger Read Thoughts), chip-mount
// iff index-resolvable + exact click payload, recharge spent/fresh chip shape,
// and the rollability legs (legendary-gate / incapacitated — the precedents
// MA-1016 cites).
// OWNED elsewhere (never re-run here): adjudication fresh-spend/refused
// (services/encounters/monsterUtilitySpellCast.ma1014-ice-wall.test.js),
// exhausted/bare/fake-emphasis + imp self-buff migration
// (MonsterAction.ma1016-fog-cloud-chip.test.jsx), modal seam press→cast→refuse
// (MonsterCardModal.ma1014-ice-wall-spellcast.test.jsx), Read Thoughts data
// lock (MA-0614), dao Spellcasting chip (MA-0552).
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import { isUtilitySpellCastRow, extractSpellNamesFromSpellcasting } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const ICE_DEVIL = monsters.find(m => m.index === 'ice-devil');
const ICE_WALL_ROW = ICE_DEVIL.actions.find(a => a.name === 'Ice Wall');
const SPELL_INDEX = new Set([...spells5e.map(s => s.name), ...spells2024.map(s => s.name)]);

function renderRow(action, overrides = {}) {
  const onSpellCast = vi.fn();
  const utils = render(
    <MonsterAction
      action={action}
      index={0}
      attackerCannotAct={false}
      onAttack={vi.fn()}
      onDamage={vi.fn()}
      onSaveRoll={vi.fn()}
      onSpellCast={onSpellCast}
      reactionUsesUsed={{}}
      onGatedReaction={vi.fn()}
      rechargeState={{}}
      {...overrides}
    />
  );
  return { ...utils, onSpellCast };
}

describe('MA-1014 disk fingerprint — Ice Devil Ice Wall (data byte-unchanged)', () => {
  it('row carries spell_save_dc 17 / Intelligence / recharge "6", NO affordance fields, and arms the predicate', () => {
    expect(ICE_WALL_ROW.name).toBe('Ice Wall');
    expect(ICE_WALL_ROW.spell_save_dc).toBe(17);
    expect(ICE_WALL_ROW.spellcasting_ability).toBe('Intelligence');
    expect(ICE_WALL_ROW.recharge).toBe('6');
    expect(ICE_WALL_ROW.save_dc ?? null).toBeNull();
    expect(ICE_WALL_ROW.attack_bonus ?? null).toBeNull();
    expect(ICE_WALL_ROW.damage_dice_primary ?? null).toBeNull();
    expect(extractSpellNamesFromSpellcasting(ICE_WALL_ROW.description)).toEqual(['Wall of Ice']);
    expect(SPELL_INDEX.has('Wall of Ice')).toBe(true);
    expect(isUtilitySpellCastRow(ICE_WALL_ROW)).toBe(true);
  });

  // The exact-set census is the ONLY discriminator for the predicate's
  // exclusion arms: name "Spellcasting" (dao would arm via save_dc 16 +
  // resolvable names if the name XOR fell), save_dc (Read Thoughts — real
  // spells.json name, data lock owned by MA-0614), and automation
  // (MA-1019: imp/Invisibility migrated to monster_self_buff §216).
  it('isUtilitySpellCastRow arms only the MA-1014/MA-1016 set app-wide (whole-database scan)', () => {
    const armed = [];
    for (const mo of monsters) {
      for (const key of ['actions', 'legendary_actions', 'reactions']) {
        for (const a of Array.isArray(mo[key]) ? mo[key] : []) {
          if (!a || typeof a !== 'object') continue;
          if (!isUtilitySpellCastRow(a)) continue;
          if (extractSpellNamesFromSpellcasting(a.description).some(n => SPELL_INDEX.has(n))) {
            armed.push(`${mo.index}/${a.name}`);
          }
        }
      }
    }
    expect(armed).toEqual(['ice-devil/Ice Wall', 'ice-mephit/Fog Cloud']);
  });
});

describe('MA-1014 Ice Wall spell chip', () => {
  it('fresh row: chip "Wall of Ice" mounts only with the index and routes onSpellCast(action, name); recharge note "(6)"', () => {
    // Null index (default prop / not yet loaded) = zero chips (§158 guard —
    // unresolved/fake-name negatives owned by MA-1016 fog-cloud-chip).
    expect(renderRow(ICE_WALL_ROW).container.querySelectorAll('.mc-dice-link-spell').length).toBe(0);
    const { container, onSpellCast } = renderRow(ICE_WALL_ROW, { spellNameIndex: SPELL_INDEX });
    const chips = [...container.querySelectorAll('.mc-dice-link-spell')];
    expect(chips.length).toBe(1);
    expect(chips[0].textContent.trim()).toBe('Wall of Ice');
    expect(chips[0].getAttribute('role')).toBe('button');
    expect(chips[0].className).not.toContain('mc-dice-link-spell-spent');
    expect(container.textContent).toContain('(6)');
    fireEvent.click(chips[0]);
    expect(onSpellCast).toHaveBeenCalledTimes(1);
    expect(onSpellCast.mock.calls[0]).toEqual([ICE_WALL_ROW, 'Wall of Ice']);
  });

  it('spent recharge: spent class + "(Recharge 6 — unavailable)"; click still routes the honest refusal', () => {
    const { container, onSpellCast } = renderRow(ICE_WALL_ROW, {
      spellNameIndex: SPELL_INDEX,
      rechargeState: { 'Ice Wall': { recharged: false, threshold: 6 } },
    });
    const chip = container.querySelector('.mc-dice-link-spell');
    expect(chip.className).toContain('mc-dice-link-spell-spent');
    fireEvent.click(chip);
    expect(onSpellCast).toHaveBeenCalledTimes(1);
    expect(onSpellCast.mock.calls[0]).toEqual([ICE_WALL_ROW, 'Wall of Ice']);
    expect(container.textContent).toContain('(Recharge 6 — unavailable)');
  });

  it('never-rollable rows: legendary-gated arms zero chips (single economy); incapacitated chip stays visible, click inert', () => {
    expect(renderRow(ICE_WALL_ROW, { spellNameIndex: SPELL_INDEX, legendaryGate: vi.fn() }).container.querySelectorAll('.mc-dice-link-spell').length).toBe(0);
    const { container, onSpellCast } = renderRow(ICE_WALL_ROW, { spellNameIndex: SPELL_INDEX, attackerCannotAct: true });
    const chip = container.querySelector('.mc-dice-link-spell');
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    expect(onSpellCast).not.toHaveBeenCalled();
  });
});
