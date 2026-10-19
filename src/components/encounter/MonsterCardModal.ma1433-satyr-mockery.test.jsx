// @maintained-by-ai
// MA-1433: Satyr Mockery (monsters.json actions[1]) — the attack_bonus:0 decoy
// (household authoring noise, MA-1427 Salamander twin) AND absent dc_success made
// dc_success ?? 'half' (MV-20, MonsterCardModal.jsx :1332/:2443) pay HALF of
// "1d6 + 2" Psychic on SAVE SUCCESS (live proof: nat13/12/20 vs DC 12 paid
// 2/3/2). Disk description is truth: failure-only damage ⇒ success pays ZERO.
// DATA fix (zero code): drop attack_bonus:0 so the row classifies pure-save
// (removes the "+0" decoy chip) and author dc_success:"none" — byte-inert for
// every other row.
// Owners cited, not re-asserted: computeDamageAfterSave 'none'/'half' math
// (full on fail / zero on success, half-leak contrast): applyDamage.save-full.test.js
// MA-0218; save-context dcSuccess verbatim threading (pure pass-through,
// MonsterCardModal.jsx :1805): MonsterCardModal.ma1427-salamander-constrict.test.js.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, fireEvent } from '@testing-library/react';
import {
  isCompositeAttackSaveRow,
  saveLegCarriesSecondaryDamage,
  saveLegIsConditionRider,
  saveChipPlan,
} from './MonsterCardModal.jsx';
import { MonsterAction } from './MonsterAction.jsx';

const row = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'))
  .find((m) => m.index === 'satyr').actions[1];

describe('MA-1433 Satyr Mockery — pure-save failure-only row (dc_success "none")', () => {
  it('disk row BYTES: DC 12 Wisdom save, "1d6 + 2" Psychic, dc_success "none" — no attack_bonus:0 decoy, no half-on-success prose', () => {
    expect(row).toEqual({
      name: 'Mockery',
      description: 'Wisdom Saving Throw: DC 12, one creature the satyr can see within 90 feet. Failure: 5 (1d6 + 2) Psychic damage.',
      save_dc: 12,
      save_type: 'Wisdom',
      save_effect: 'Failure: 5 (1d6 + 2) Psychic damage.',
      range: '',
      reach: '',
      recharge: '',
      damage_dice_primary: '1d6 + 2',
      damage_type_primary: 'Psychic',
      dc_success: 'none',
    });
  });

  it('classifies pure-save — decoy removal forks no composite lane; save chip stays clickable adjudicating the primary formula', () => {
    expect(isCompositeAttackSaveRow(row)).toBe(false);
    expect(saveLegCarriesSecondaryDamage(row)).toBe(false);
    expect(saveLegIsConditionRider(row)).toBe(false);
    expect(saveChipPlan(row, false)).toEqual({
      riderOnly: false,
      formula: '1d6 + 2',
      rollable: true,
      clickable: true,
    });
  });

  it('renders dice + DC save chip pair with no "+0" junk attack chip — clicking the DC chip adjudicates the save once', () => {
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
    expect(chips.map(el => el.textContent.trim())).toEqual(['1d6 + 2', 'DC 12 Wisdom']);
    const dcChip = chips.find(el => el.className.includes('mc-dice-link-save-clickable'));
    fireEvent.click(dcChip);
    expect(onSaveRoll).toHaveBeenCalledTimes(1);
  });
});
