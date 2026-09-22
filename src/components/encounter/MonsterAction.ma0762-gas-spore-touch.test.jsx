// MA-0762: Gas Spore "Touch" — prose carries "Melee Weapon Attack: + 0 to hit"
// but the row shipped WITHOUT attack_bonus, so the attack half was structurally
// dead (MA-0286 attackRowMissingToHit suppression, composite fork never armed —
// only the "DC 10 Constitution" save chip rendered). Two-field DATA fix:
// attack_bonus:0 (MA-0647 twin placement, after description) + dc_success:"none"
// (MA-0481/0622/0781 family — save gates the disease rider ONLY; the flat 1
// belongs to the attack hit and MV-20 half-default must never adjudicate it).
// Locks: disk row shape, composite fork arms, save chip is rider-only
// (save_effect carries no "damage" clause, no damage_dice_secondary), two-chip
// render, attack chip pays FULL flat 1 (saveDc/saveType/dcSuccess nulled by the
// MA-0551 attack-chip fork), disease rider stays §70 advisory (no te authored).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { attackRowMissingToHit } from './MonsterCardHelpers.js';
import { isCompositeAttackSaveRow, saveLegIsConditionRider, saveChipPlan, buildSaveOptions } from './MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TOUCH = monsters.find((m) => m.index === 'gas-spore').actions[0];

function renderRow(action) {
  const onAttack = vi.fn();
  const onDamage = vi.fn();
  const onSaveRoll = vi.fn();
  const utils = render(
    <MonsterAction
      action={action}
      index={0}
      attackerCannotAct={false}
      onAttack={onAttack}
      onDamage={onDamage}
      onSaveRoll={onSaveRoll}
      onSpellCast={vi.fn()}
      reactionUsesUsed={{}}
      onGatedReaction={vi.fn()}
    />
  );
  return { ...utils, onAttack, onDamage, onSaveRoll };
}

describe('MA-0762 disk fingerprint: gas-spore Touch two-field fix', () => {
  it('arms the attack half: attack_bonus 0 after description (MA-0647 placement)', () => {
    expect(TOUCH.attack_bonus).toBe(0);
    expect(TOUCH.description).toMatch(/\+ 0 to hit/i);
    expect(attackRowMissingToHit(TOUCH)).toBe(false);
  });

  it('save gates the disease rider only: dc_success "none" (MV-20 half-leak guard)', () => {
    expect(TOUCH.dc_success).toBe('none');
    expect(TOUCH.save_dc).toBe(10);
    expect(TOUCH.save_type).toBe('Constitution');
    expect(TOUCH.damage_dice_primary).toBe('1');
    expect(TOUCH.damage_type_primary).toBe('Poison');
    expect(buildSaveOptions(TOUCH).dcSuccess).toBe('none');
  });

  it('composite attack+save fork arms; save chip is condition-rider-only (MA-0551/0560)', () => {
    expect(isCompositeAttackSaveRow(TOUCH)).toBe(true);
    expect(saveLegIsConditionRider(TOUCH)).toBe(true);
    const plan = saveChipPlan(TOUCH, false);
    expect(plan.riderOnly).toBe(true);
    expect(plan.formula).toBeNull();
    expect(plan.clickable).toBe(true);
  });

  it('disease rider stays §70 advisory: no te/condition word in save_effect — zero grants by design', () => {
    expect(TOUCH.save_effect).not.toMatch(/\bdamage\b/i);
    expect(TOUCH.hit_conditions).toBeUndefined();
    expect(TOUCH.save_effect).toMatch(/infected with the disease/i);
  });

  it('renders TWO chips: "+0" attack + "DC 10 Constitution" save; attack chip pays full flat 1', () => {
    const { container, onAttack, onDamage, onSaveRoll } = renderRow(TOUCH);
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['+0', 'DC 10 Constitution']);
    const attackChip = [...container.querySelectorAll('.mc-dice-link')][0];
    fireEvent.click(attackChip);
    expect(onAttack).toHaveBeenCalledWith('Touch', 0, expect.objectContaining({ name: 'Touch' }));
    expect(onAttack.mock.calls[0][2].attack_bonus).toBe(0);
    expect(onDamage).not.toHaveBeenCalled();
    const saveChip = [...container.querySelectorAll('.mc-dice-link-save-clickable')][0];
    fireEvent.click(saveChip);
    // rider-only plan forwards NO damage formula on the save leg (§242 fix ledger)
    expect(onSaveRoll).toHaveBeenCalledWith(TOUCH, null, []);
  });
});
