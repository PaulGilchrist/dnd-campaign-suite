// @maintained-by-ai
// MA-0762: Gas Spore "Touch" — prose carries "Melee Weapon Attack: + 0 to hit"
// but the row shipped WITHOUT attack_bonus, so the attack half was structurally
// dead (MA-0286 attackRowMissingToHit suppression — this row is NOT in that
// census: the fix arms attack_bonus:0, and MA-0286's census skips rows with
// attack_bonus != null). Two-field DATA fix: attack_bonus:0 (MA-0647 twin
// placement, after description) + dc_success:"none" (MA-0481/0622/0781 family —
// save gates the disease rider ONLY; the flat 1 belongs to the attack hit and
// the MV-20 half-default must never adjudicate it). Single lane: full disk
// byte-shape (keys + placement) + two-chip render with exact click payloads —
// the observable output of the MA-0551 composite fork and rider-only plan.
// Helper-fork semantics owned elsewhere (isCompositeAttackSaveRow/
// saveLegIsConditionRider/saveChipPlan: MA-0927 grell, MA-1867 Cthulhu,
// MA-1433 negative; 3-arg onAttack dispatch: MA-0294; suppression census:
// MA-0286; Touch twin cross-lock: MA-0763:61-66). Disease rider stays §70
// advisory — save_effect carries no "damage" clause and no canonical condition
// word, so the save leg forwards NO formula and ZERO conditions by design.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TOUCH = monsters.find((m) => m.index === 'gas-spore').actions[0];

describe('MA-0762 gas-spore Touch two-field fix', () => {
  it('disk byte-shape and two-chip render: "+0" attack pays flat 1, "DC 10 Constitution" save is rider-only advisory', () => {
    // Fix fields present, placement byte-exact (MA-0647 after description).
    expect(Object.keys(TOUCH)).toEqual([
      'name', 'description', 'attack_bonus', 'reach', 'save_dc', 'save_type',
      'dc_success', 'save_effect', 'damage_dice_primary', 'damage_type_primary',
    ]);
    expect(TOUCH.description).toBe('Melee Weapon Attack: + 0 to hit, reach 5 ft., one creature. Hit: 1 poison damage, and the creature must succeed on a DC 10 Constitution saving throw or become infected with the disease described in the Death Burst trait.');
    expect(TOUCH.attack_bonus).toBe(0);
    expect(TOUCH.save_dc).toBe(10);
    expect(TOUCH.save_type).toBe('Constitution');
    expect(TOUCH.dc_success).toBe('none');
    expect(TOUCH.save_effect).toBe('The target becomes infected with the disease described in the Death Burst trait.');
    expect(TOUCH.damage_dice_primary).toBe('1');
    expect(TOUCH.damage_type_primary).toBe('Poison');

    const onAttack = vi.fn();
    const onDamage = vi.fn();
    const onSaveRoll = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TOUCH}
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
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['+0', 'DC 10 Constitution']);

    fireEvent.click(container.querySelectorAll('.mc-dice-link')[0]);
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Touch', 0, TOUCH);
    expect(onDamage).not.toHaveBeenCalled();

    fireEvent.click(container.querySelector('.mc-dice-link-save-clickable'));
    // rider-only plan: NO damage formula on the save leg (§242 fix ledger);
    // non-canonical "infected with the disease" prose extracts ZERO conditions
    // — §70 advisory, no te authored by design.
    expect(onSaveRoll).toHaveBeenCalledTimes(1);
    expect(onSaveRoll).toHaveBeenCalledWith(TOUCH, null, []);
  });
});
