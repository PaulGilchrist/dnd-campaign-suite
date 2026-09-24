// MA-1016: Ice Mephit "Fog Cloud" — innate utility row (spellcasting_ability
// Charisma, NO spell_save_dc, 1/Day) formerly rendered ZERO affordance (the
// MA-1014 predicate required spell_save_dc != null). Fix lane: predicate
// widened minimally to (spell_save_dc != null || spellcasting_ability != null)
// and the row DATA-gated with MA-0633 numerics (usage:"1/Day" cosmetic +
// uses:1 + maxUses:1 — the old uses:"1/Day" STRING reads Number() NaN = no
// gate, §169). Chip rides the MA-1014 SpellCastLinks fork with the MA-0020
// row-level counter; fake-chip guard (§161) lives in utilitySpellNamesFor —
// bold NON-spell words never arm. imp/Invisibility is the named RAW-honest
// innate twin (self-cast, at will, ungated by design §230).
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import { isUtilitySpellCastRow, extractSpellNamesFromSpellcasting } from './MonsterCardHelpers.js';
import { abilitySaveMaxUses } from '../../services/encounters/monsterAbilityUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const ICE_MEPHIT = monsters.find(m => m.index === 'ice-mephit');
const FOG_ROW = ICE_MEPHIT.actions[1];
const IMP_ROW = monsters.find(m => m.index === 'imp').actions.find(a => a.name === 'Invisibility');
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

describe('MA-1016 disk fingerprint — Ice Mephit Fog Cloud', () => {
  it('row arms on Charisma alone and the 1/Day gate is NUMERIC (MA-0633 byte-shape)', () => {
    expect(FOG_ROW.name).toBe('Fog Cloud');
    expect(FOG_ROW.spellcasting_ability).toBe('Charisma');
    expect(FOG_ROW.spell_save_dc ?? null).toBeNull();
    expect(FOG_ROW.save_dc ?? null).toBeNull();
    expect(FOG_ROW.attack_bonus ?? null).toBeNull();
    expect(FOG_ROW.usage).toBe('1/Day');
    expect(FOG_ROW.uses).toBe(1);
    expect(FOG_ROW.maxUses).toBe(1);
    expect(abilitySaveMaxUses(FOG_ROW)).toBe(1);
    // The old string would NaN-gate (abilitySaveMaxUses reads maxUses first).
    expect(Number.isNaN(Number('1/Day'))).toBe(true);
    expect(extractSpellNamesFromSpellcasting(FOG_ROW.description)).toEqual(['Fog Cloud']);
    expect(SPELL_INDEX.has('Fog Cloud')).toBe(true);
    expect(isUtilitySpellCastRow(FOG_ROW)).toBe(true);
  });

  // MA-1019 (§216 stale-pin inversion): imp/Invisibility was the named innate
  // UTILITY twin while the predicate was widened. It now authors
  // automation:{type:"monster_self_buff",effect:"invisible",rounds:600}
  // (MA-0658/MA-0919 seam normalization), so the automation exclusion drops it
  // from isUtilitySpellCastRow: the SpellCastLinks chip is GONE, replaced by
  // the live SelfBuffLink .mc-dice-link-selfbuff chip (te invisible on self).
  // At Will stays honest: no uses/maxUses, no uses counter (§230).
  it('imp/Invisibility migrated OFF the utility lane onto the MA-0658 self-buff seam', () => {
    expect(IMP_ROW.spellcasting_ability).toBe('Charisma');
    expect(IMP_ROW.spell_save_dc ?? null).toBeNull();
    expect(IMP_ROW.uses ?? null).toBeNull();
    expect(IMP_ROW.maxUses ?? null).toBeNull();
    expect(isUtilitySpellCastRow(IMP_ROW)).toBe(false);
    const onSelfBuffRow = vi.fn();
    const { container } = renderRow(IMP_ROW, { spellNameIndex: SPELL_INDEX, onSelfBuffRow });
    expect(container.querySelectorAll('.mc-dice-link-spell').length).toBe(0);
    const chip = container.querySelector('.mc-dice-link-selfbuff');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('Invisibility');
    expect(chip.textContent).not.toMatch(/\/Day/);
    fireEvent.click(chip);
    expect(onSelfBuffRow).toHaveBeenCalledWith(IMP_ROW);
  });
});

describe('MA-1016 Fog Cloud spell chip + 1/Day counter', () => {
  it('fresh row: chip "Fog Cloud (1/Day · 1 left)", click routes onSpellCast(action, name)', () => {
    const { container, onSpellCast } = renderRow(FOG_ROW, { spellNameIndex: SPELL_INDEX });
    const chips = [...container.querySelectorAll('.mc-dice-link-spell')];
    expect(chips.length).toBe(1);
    expect(chips[0].textContent.trim()).toBe('Fog Cloud (1/Day · 1 left)');
    expect(chips[0].className).not.toContain('mc-dice-link-spell-spent');
    fireEvent.click(chips[0]);
    expect(onSpellCast).toHaveBeenCalledTimes(1);
    expect(onSpellCast.mock.calls[0]).toEqual([FOG_ROW, 'Fog Cloud']);
    expect(container.textContent).toContain('(1/Day)');
  });

  it('spent row: 0 left + spent class, chip stays clickable and routes the honest refusal', () => {
    const { container, onSpellCast } = renderRow(FOG_ROW, {
      spellNameIndex: SPELL_INDEX,
      spellUsesUsed: { 'Fog Cloud': 1 },
    });
    const chip = container.querySelector('.mc-dice-link-spell');
    expect(chip.textContent.trim()).toBe('Fog Cloud (1/Day · 0 left)');
    expect(chip.className).toContain('mc-dice-link-spell-spent');
    fireEvent.click(chip);
    expect(onSpellCast).toHaveBeenCalledTimes(1);
  });

  it('no index / unresolved names / bold NON-spell words / no ability+no DC → zero chips', () => {
    expect(renderRow(FOG_ROW).container.querySelectorAll('.mc-dice-link-spell').length).toBe(0);
    expect(renderRow(FOG_ROW, { spellNameIndex: new Set(['Fireball']) }).container.querySelectorAll('.mc-dice-link-spell').length).toBe(0);
    const fake = { name: 'Misty Veil', description: 'The mephit shivers, maintaining <strong>Concentration</strong> as mist curls out.', spellcasting_ability: 'Charisma' };
    expect(isUtilitySpellCastRow(fake)).toBe(true);
    expect(extractSpellNamesFromSpellcasting(fake.description).some(n => SPELL_INDEX.has(n))).toBe(false);
    expect(renderRow(fake, { spellNameIndex: SPELL_INDEX }).container.querySelectorAll('.mc-dice-link-spell').length).toBe(0);
    const bare = { name: 'Fog Cloud', description: 'The mephit casts <strong>Fog Cloud</strong>.', recharge: '6' };
    expect(isUtilitySpellCastRow(bare)).toBe(false);
    expect(renderRow(bare, { spellNameIndex: SPELL_INDEX }).container.querySelectorAll('.mc-dice-link-spell').length).toBe(0);
  });

  it('legendary-gated and incapacitated variants match MA-1014 precedents', () => {
    expect(renderRow(FOG_ROW, { spellNameIndex: SPELL_INDEX, legendaryGate: vi.fn() }).container.querySelectorAll('.mc-dice-link-spell').length).toBe(0);
    const { container, onSpellCast } = renderRow(FOG_ROW, { spellNameIndex: SPELL_INDEX, attackerCannotAct: true });
    const chip = container.querySelector('.mc-dice-link-spell');
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    expect(onSpellCast).not.toHaveBeenCalled();
  });
});
