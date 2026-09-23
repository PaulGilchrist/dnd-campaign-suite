// MA-0927: Grell "Paralyzing Tentacles" — prose carries "Grappled condition
// (escape DC 12)" + "Constitution Saving Throw: DC 11" but the row shipped
// WITHOUT save_dc/hit_conditions/escape_dc, so the save half was wholly inert
// (ActionSaveRoll gates on save_dc != null — MonsterAction.jsx:91) and the
// grapple rider was live-but-unarmed (buildHitConditionClause reads
// hit_conditions/escape_dc keys ONLY, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions — MA-0909/MA-0801/MA-0812
// precedents). Three-field DATA fix, disk prose governing DCs (save_dc:11 —
// the ticket's 12 is the ESCAPE DC): save_dc:11 before save_type (MA-0860/
// MA-0918 save-chip byte-shape, 749/807 twins) + hit_conditions:["grappled"]
// + escape_dc:12 after save_effect (MA-0801/MA-0812 byte-shape). Locks:
// disk row shape + key placement, attack half byte-unchanged, save_type +
// save_effect byte-unchanged, clause arms grappled with escapeDc 12,
// composite attack+save fork arms rider-only save chip, two-chip render
// "+4" + "DC 11 Constitution". RESIDUALS (§70 advisory, MA-0904/§120
// extractor family): repeat-save-at-turn-end clock, 1-minute auto-success,
// Poisoned→Paralyzed while-chain — extractConditionsFromSaveEffect word-
// sprays Paralyzed alongside Poisoned on the fail leg (known over-grant
// family, ladder-not-armed acceptable); no damage authored on save leg so
// no half-leak possible.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit, extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import { isCompositeAttackSaveRow, saveLegIsConditionRider, saveChipPlan } from './MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TENTACLES = monsters.find((m) => m.index === 'grell').actions[2];

describe('MA-0927 disk fingerprint: grell Paralyzing Tentacles three-field fix', () => {
  it('save half armed: save_dc 11 before save_type Constitution, save_effect byte-unchanged (MA-0860/0918 byte-shape)', () => {
    expect(TENTACLES.name).toBe('Paralyzing Tentacles');
    expect(TENTACLES.save_dc).toBe(11);
    expect(TENTACLES.save_type).toBe('Constitution');
    const keys = Object.keys(TENTACLES);
    expect(keys.indexOf('save_dc')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.indexOf('save_type')).toBe(keys.indexOf('save_dc') + 1);
    expect(TENTACLES.save_effect).toBe('The target has the Poisoned condition and repeats the save at the end of each of its turns, ending the effect on a success. After 1 minute, it succeeds automatically. While Poisoned, the target has the Paralyzed condition.');
  });

  it('grapple rider armed: hit_conditions ["grappled"] + escape_dc 12 after save_effect (MA-0801/MA-0812 byte-shape)', () => {
    expect(TENTACLES.hit_conditions).toEqual(['grappled']);
    expect(TENTACLES.escape_dc).toBe(12);
    const keys = Object.keys(TENTACLES);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('save_effect') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
  });

  it('attack half byte-unchanged: +4 / 1d10 + 2 / Piercing / 10 ft.', () => {
    expect(TENTACLES.attack_bonus).toBe(4);
    expect(TENTACLES.reach).toBe('10 ft.');
    expect(TENTACLES.damage_dice_primary).toBe('1d10 + 2');
    expect(TENTACLES.damage_type_primary).toBe('Piercing');
    expect(attackRowMissingToHit(TENTACLES)).toBe(false);
  });

  it('buildHitConditionClause arms the Grappled rider with escapeDc 12 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(TENTACLES);
    expect(clause).toEqual({
      conditions: ['grappled'],
      escapeDc: 12,
      attackName: 'Paralyzing Tentacles',
      targetEffect: null,
    });
  });

  it('composite attack+save fork arms rider-only save chip; save leg carries NO damage (no half-leak possible)', () => {
    expect(isCompositeAttackSaveRow(TENTACLES)).toBe(true);
    expect(saveLegIsConditionRider(TENTACLES)).toBe(true);
    const plan = saveChipPlan(TENTACLES, false);
    expect(plan.riderOnly).toBe(true);
    expect(plan.formula).toBeNull();
    expect(plan.rollable).toBe(false);
    expect(plan.clickable).toBe(true);
  });

  it('extractConditionsFromSaveEffect word-extracts Paralyzed+Poisoned from fail prose (§120 extractor-family over-grant residual: minimal-correct is Poisoned; ladder not armed)', () => {
    expect(extractConditionsFromSaveEffect(TENTACLES.save_effect)).toEqual(['paralyzed', 'poisoned']);
  });

  it('renders TWO chips: "+4" attack + "DC 11 Constitution" save (save half live, was zero-chip pre-fix)', () => {
    const onAttack = vi.fn();
    const onSaveRoll = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TENTACLES}
        index={0}
        attackerCannotAct={false}
        onAttack={onAttack}
        onDamage={vi.fn()}
        onSaveRoll={onSaveRoll}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
      />
    );
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['+4', 'DC 11 Constitution']);
    fireEvent.click(container.querySelectorAll('.mc-dice-link')[0]);
    expect(onAttack).toHaveBeenCalledWith('Paralyzing Tentacles', 4, expect.objectContaining({ name: 'Paralyzing Tentacles' }));
    const saveChip = container.querySelector('.mc-dice-link-save-clickable');
    expect(saveChip).not.toBeNull();
    expect(saveChip.textContent.trim()).toBe('DC 11 Constitution');
    fireEvent.click(saveChip);
    expect(onSaveRoll).toHaveBeenCalledWith(TENTACLES, null, ['paralyzed', 'poisoned']);
  });
});
