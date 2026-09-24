// MA-1014: Ice Devil "Ice Wall" — the spell_save_dc-only zone/utility row
// (spell_save_dc 17, Intelligence, recharge "6", no save_dc/range/damage
// fields) rendered ZERO affordance: chip path name-gated to "Spellcasting"
// (isSpellcastingRow), ActionSaveRoll save_dc-only gate, cosmetic <em>
// (6)</em>. Fix lane A (code only, data byte-unchanged): isUtilitySpellCastRow
// arms SpellCastLinks with the <strong>-marked spell name ONLY when it
// resolves in the modal's spells.json name index (§158/§161 fake-chip
// guard), routing to the recharge-gated advisory cast (MA-0031/MA-0633).
// Legendary-gated rows never arm the chip (MA-0694 single-economy precedent);
// rows covered by existing branches (save_dc → Doppelganger Read Thoughts,
// name "Spellcasting" → Dao) stay byte-inert.
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import { isUtilitySpellCastRow, extractSpellNamesFromSpellcasting } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const ICE_DEVIL = monsters.find(m => m.index === 'ice-devil');
const ICE_WALL_ROW = ICE_DEVIL.actions[3];
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
  it('row carries spell_save_dc 17 / Intelligence / recharge "6" and NO affordance fields', () => {
    expect(ICE_WALL_ROW.name).toBe('Ice Wall');
    expect(ICE_WALL_ROW.spell_save_dc).toBe(17);
    expect(ICE_WALL_ROW.spellcasting_ability).toBe('Intelligence');
    expect(ICE_WALL_ROW.recharge).toBe('6');
    expect(ICE_WALL_ROW.save_dc ?? null).toBeNull();
    expect(ICE_WALL_ROW.attack_bonus ?? null).toBeNull();
    expect(ICE_WALL_ROW.damage_dice_primary ?? null).toBeNull();
    expect(ICE_WALL_ROW.description).toContain('<strong>Wall of Ice</strong>');
    expect(extractSpellNamesFromSpellcasting(ICE_WALL_ROW.description)).toEqual(['Wall of Ice']);
    expect(SPELL_INDEX.has('Wall of Ice')).toBe(true);
  });

  // MA-1016 census re-run: the predicate widened to (spell_save_dc || spellcasting_ability)
  // arms EXACTLY two rows more — ice-mephit/Fog Cloud (CHA, 1/Day numeric uses) and
  // imp/Invisibility (byte-identical innate self-cast twin, at will). Rows with bold
  // NON-spell words (fake-chip §161) and every save_dc/attack/dice/automation row
  // stay out — the resolvable-name check is the discriminator.
  // MA-1019: imp/Invisibility now authors automation:{type:"monster_self_buff",
  // effect:"invisible",rounds:600} (MA-0658/MA-0919 seam normalization) → the
  // automation exclusion drops it from this census (§216 stale-pin inversion —
  // utility census returns EXACTLY the two remaining rows).
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

  it('covered rows stay byte-inert: Doppelganger Read Thoughts (save_dc) and Dao Spellcasting (name)', () => {
    const readThoughts = monsters.find(m => m.index === 'doppelganger').actions.find(a => a.name === 'Read Thoughts');
    expect(readThoughts.save_dc).toBe(12);
    expect(isUtilitySpellCastRow(readThoughts)).toBe(false);
    const daoRow = monsters.find(m => m.index === 'dao').actions.find(a => a.name === 'Spellcasting');
    expect(isUtilitySpellCastRow(daoRow)).toBe(false);
    expect(isUtilitySpellCastRow(ICE_DEVIL.actions.find(a => a.name === 'Ice Spear'))).toBe(false);
  });
});

describe('MA-1014 Ice Wall spell chip', () => {
  it('mounts chip "Wall of Ice" when the spell resolves — click routes onSpellCast(action, name)', () => {
    const { container, onSpellCast } = renderRow(ICE_WALL_ROW, { spellNameIndex: SPELL_INDEX });
    const chips = [...container.querySelectorAll('.mc-dice-link-spell')];
    expect(chips.length).toBe(1);
    expect(chips[0].textContent.trim()).toBe('Wall of Ice');
    expect(chips[0].getAttribute('role')).toBe('button');
    fireEvent.click(chips[0]);
    expect(onSpellCast).toHaveBeenCalledTimes(1);
    expect(onSpellCast.mock.calls[0]).toEqual([ICE_WALL_ROW, 'Wall of Ice']);
  });

  it('no index / unresolved names / missing spell_save_dc / mid-prose emphasis → zero chips', () => {
    expect(renderRow(ICE_WALL_ROW).container.querySelectorAll('.mc-dice-link-spell').length).toBe(0);
    expect(renderRow(ICE_WALL_ROW, { spellNameIndex: new Set(['Fireball']) }).container.querySelectorAll('.mc-dice-link-spell').length).toBe(0);
    const noDc = { name: 'Frost Breath', description: 'The devil exhales <strong>Cone of Cold</strong>.', recharge: '6' };
    expect(renderRow(noDc, { spellNameIndex: SPELL_INDEX }).container.querySelectorAll('.mc-dice-link-spell').length).toBe(0);
    const emphasis = { name: 'Charm', description: 'The devil casts a spell. It maintains <strong>Concentration</strong> on the victim.', spell_save_dc: 17 };
    // Field predicate is TRUE (spell_save_dc-only), but the renderer arms ZERO
    // chips because "Concentration" is mid-prose emphasis that never resolves
    // in spells.json (§158 fake-chip guard lives in the name resolution).
    expect(renderRow(emphasis, { spellNameIndex: SPELL_INDEX }).container.querySelectorAll('.mc-dice-link-spell').length).toBe(0);
    expect(isUtilitySpellCastRow(emphasis)).toBe(true);
    expect(extractSpellNamesFromSpellcasting(emphasis.description).some(n => SPELL_INDEX.has(n))).toBe(false);
  });

  it('spent recharge: spent class + honest refusal click still routes, row reads "(Recharge 6 — unavailable)"', () => {
    const { container, onSpellCast } = renderRow(ICE_WALL_ROW, {
      spellNameIndex: SPELL_INDEX,
      rechargeState: { 'Ice Wall': { recharged: false, threshold: 6 } },
    });
    const chip = container.querySelector('.mc-dice-link-spell');
    expect(chip.className).toContain('mc-dice-link-spell-spent');
    fireEvent.click(chip);
    expect(onSpellCast).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('(Recharge 6 — unavailable)');
  });

  it('fresh recharge: no spent class; recharge note renders "(6)"', () => {
    const { container } = renderRow(ICE_WALL_ROW, { spellNameIndex: SPELL_INDEX });
    expect(container.querySelector('.mc-dice-link-spell').className).not.toContain('mc-dice-link-spell-spent');
    expect(container.textContent).toContain('(6)');
  });

  it('incapacitated attacker: chip visible, click inert', () => {
    const { container, onSpellCast } = renderRow(ICE_WALL_ROW, { spellNameIndex: SPELL_INDEX, attackerCannotAct: true });
    const chip = container.querySelector('.mc-dice-link-spell');
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    expect(onSpellCast).not.toHaveBeenCalled();
  });

  it('legendary-gated row never arms the utility chip (single economy)', () => {
    const { container } = renderRow(ICE_WALL_ROW, { spellNameIndex: SPELL_INDEX, legendaryGate: vi.fn() });
    expect(container.querySelectorAll('.mc-dice-link-spell').length).toBe(0);
  });

  it('Spellcasting rows render identically with AND without the index (byte-inert path)', () => {
    const daoRow = monsters.find(m => m.index === 'dao').actions.find(a => a.name === 'Spellcasting');
    const withIndex = renderRow(daoRow, { spellNameIndex: SPELL_INDEX });
    const withoutIndex = renderRow(daoRow);
    expect(withIndex.container.innerHTML).toBe(withoutIndex.container.innerHTML);
    expect(withIndex.container.querySelectorAll('.mc-dice-link-spell').length).toBeGreaterThan(0);
  });
});
