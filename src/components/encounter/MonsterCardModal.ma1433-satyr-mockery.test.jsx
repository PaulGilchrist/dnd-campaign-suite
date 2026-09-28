// MA-1433: Satyr Mockery (monsters.json actions[1]) — save row carried the
// attack_bonus:0 decoy (household authoring noise, MA-1427 twin) AND no
// authored dc_success, so dc_success ?? 'half' (MV-20, MonsterCardModal.jsx
// :255/:1032/:2017) paid HALF of "1d6 + 2" Psychic on SAVE SUCCESS (live
// proof: nat13/12/20 vs DC 12 paid 2/3/2, hp_change rode every success
// leg). Disk description is truth: "Wisdom Saving Throw: DC 12, one
// creature the satyr can see within 90 feet. Failure: 5 (1d6 + 2) Psychic
// damage." — NO success clause ⇒ success pays ZERO.
// DATA fix (zero code, MA-1427 Salamander Constrict byte-twin): drop
// attack_bonus:0 so the row classifies pure-save (removes the "+0" decoy
// chip) and author dc_success:"none" (last key). Byte-inert for every
// other row.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, fireEvent } from '@testing-library/react';
import {
  buildAbilitySaveRollContext,
  isCompositeAttackSaveRow,
  saveLegCarriesSecondaryDamage,
  saveLegIsConditionRider,
  saveChipPlan,
} from './MonsterCardModal.jsx';
import { MonsterAction } from './MonsterAction.jsx';
import { computeDamageAfterSave } from '../../services/rules/combat/applyDamage.js';

const getDamageTypesForAction = (action) => [action?.damage_type_primary || 'Psychic'];

const row = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'))
  .find((m) => m.index === 'satyr').actions[1];

describe('MA-1433 Satyr Mockery — DATA lock: pure-save failure-only row', () => {
  it('is the DC 12 Wisdom save row with the primary Psychic dice authored', () => {
    expect(row.name).toBe('Mockery');
    expect(row.save_dc).toBe(12);
    expect(row.save_type).toBe('Wisdom');
    expect(row.damage_dice_primary).toBe('1d6 + 2');
    expect(row.damage_type_primary).toBe('Psychic');
  });

  it('attack_bonus:0 decoy REMOVED — row classifies pure-save (MA-1427 Salamander twin)', () => {
    expect(row.attack_bonus).toBeUndefined();
    expect(isCompositeAttackSaveRow(row)).toBe(false);
    expect(saveLegCarriesSecondaryDamage(row)).toBe(false);
    expect(saveLegIsConditionRider(row)).toBe(false);
  });

  it('canonical prose carries NO half-on-success clause; dc_success authored "none" (MV-20 half-leak guard)', () => {
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    expect(row.description).toMatch(/Failure:\s*5 \(1d6 \+ 2\) Psychic damage/);
    expect(row.dc_success).toBe('none');
  });

  it('save chip stays clickable adjudicating the primary formula', () => {
    const plan = saveChipPlan(row, false);
    expect(plan.riderOnly).toBe(false);
    expect(plan.formula).toBe('1d6 + 2');
    expect(plan.clickable).toBe(true);
  });

  it('no "+0" junk attack chip post-fix — row renders the dice + DC save chip pair only', () => {
    const onSaveRoll = vi.fn();
    const { container } = render(
      <MonsterAction
        action={row}
        index={1}
        attackerCannotAct={false}
        onAttack={vi.fn()}
        onDamage={vi.fn()}
        onSaveRoll={onSaveRoll}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
      />
    );
    const chips = [...container.querySelectorAll('.mc-dice-link')];
    expect(chips.length).toBe(2);
    expect(chips.some(el => el.textContent.trim() === '+0')).toBe(false);
    expect(chips.map(el => el.textContent.trim())).toEqual(['1d6 + 2', 'DC 12 Wisdom']);
    const dcChip = chips.find(el => el.className.includes('mc-dice-link-save-clickable'));
    fireEvent.click(dcChip);
    expect(onSaveRoll).toHaveBeenCalled();
  });
});

describe('MA-1433 save context rides dc_success "none" on the primary leg', () => {
  const ctx = buildAbilitySaveRollContext({
    monsterName: 'Satyr 1',
    target: { name: 'Bandit 1', type: 'npc' },
    spellName: null,
    action: row,
    saveType: 'WIS',
    dcSuccess: row.dc_success,
    saveDamageFormula: '1d6 + 2',
    saveConditions: [],
    usesGate: null,
    prerequisite: null,
    getDamageTypesForAction,
  });

  it('dcSuccess "none" threaded verbatim; primary "1d6 + 2" Psychic rides autoDamageFormula', () => {
    expect(ctx.dcSuccess).toBe('none');
    expect(ctx.autoDamageFormula).toBe('1d6 + 2');
    expect(ctx.autoDamageDamageType).toBe('Psychic');
  });
});

describe('MA-1433 dc_success "none" seam: full on fail, ZERO on success', () => {
  const dcSuccess = row.dc_success;

  it('computeDamageAfterSave: raw 7 full on fail, zero on success (half-leak closed)', () => {
    expect(computeDamageAfterSave(7, false, dcSuccess)).toBe(7);
    expect(computeDamageAfterSave(7, true, dcSuccess)).toBe(0);
  });

  it('computeDamageAfterSave: raw 4 full on fail, zero on success (live nat13/20 dice)', () => {
    expect(computeDamageAfterSave(4, false, dcSuccess)).toBe(4);
    expect(computeDamageAfterSave(4, true, dcSuccess)).toBe(0);
  });

  it('broken-state contrast: the pre-fix "half" default still leaks half on success', () => {
    expect(computeDamageAfterSave(7, true, 'half')).toBe(3);
    expect(computeDamageAfterSave(4, true, 'half')).toBe(2);
  });
});
