// MA-1071: Kuo-toa Whip "Pincer Staff" — household save_dc:0/save_type:""/
// save_effect:"" empty-noise decoy (MA-1021 census family) previously ADMITTED
// the ActionSaveRoll save lane (gate tested save_dc == null, 0 ≠ null): the
// rollable-dice branch rendered "2d6 + 2" + "DC 0" both wired to handleSaveRoll,
// so every hit adjudicated vs a guaranteed-success DC 0 with dcSuccess:'half'
// and HALVED the flat "Hit: 9 (2d6 + 2) Piercing" damage (live fingerprint
// 2026-09-24: Bandit 1 d20 [14] vs saveDc 0 → save-damage [3,4]+2=9 → fd 4).
// Fix = gate save_dc<=0 inert, mirroring the MA-0551 Number(save_dc) > 0
// convention (isCompositeAttackSaveRow already). DATA stays as-is: save_dc:0 is
// the disk authoring convention across ~200 attack rows (MA-1070 Monitor Bone
// Whip identical shape paid flat = code gate, not data strip). Attack lane
// unchanged (+4, MA-1070 byte-twin); grapple rider stays prose-inert (§59
// zero-producer grapple machine — no fabricated machinery, escape DC 12 advisory).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';
import { isCompositeAttackSaveRow, breathAoeShape, buildSaveOptions } from './MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const WHIP = monsters.find((m) => m.name === 'Kuo-toa Whip');
const PINCER = WHIP.actions[0];
const BONE_WHIP = monsters.find((m) => m.name === 'Kuo-toa Monitor').actions[1];

const renderRow = (action) => {
  const onAttack = vi.fn();
  const onDamage = vi.fn();
  const onSaveRoll = vi.fn();
  const { container } = render(
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
  return { container, onAttack, onDamage, onSaveRoll };
};

describe('MA-1071 disk lock: DC0 decoy stays authored, save lane never arms', () => {
  it('Pincer Staff disk shape byte-kept: +4 / 2d6 + 2 Piercing / save_dc:0 decoy NOT stripped (household MA-1021 convention, MA-1070 twin)', () => {
    expect(PINCER.name).toBe('Pincer Staff');
    expect(PINCER.attack_bonus).toBe(4);
    expect(PINCER.damage_dice_primary).toBe('2d6 + 2');
    expect(PINCER.damage_type_primary).toBe('Piercing');
    expect(PINCER.save_dc).toBe(0);
    expect(PINCER.save_type).toBe('');
    expect(PINCER.save_effect).toBe('');
  });

  it('grapple rider stays prose-inert: no hit_conditions/escape_dc authored, clause unarmed (escape DC 12 advisory, §59 grapple-machine zero-producer residual)', () => {
    expect(PINCER.hit_conditions).toBeUndefined();
    expect(PINCER.escape_dc).toBeUndefined();
    expect(buildHitConditionClause(PINCER)).toBeFalsy();
  });
});

describe('MA-1071 render gate: DC0 row pays flat via attack lane only', () => {
  it('renders ONE "+4" chip only — no "2d6 + 2" save dice chip, no "DC 0" chip', () => {
    const { container } = renderRow(PINCER);
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['+4']);
    expect(container.querySelector('.mc-dice-link-save')).toBeNull();
    expect(container.textContent).not.toContain('DC 0');
  });

  it('chip press routes onAttack ONLY — onSaveRoll/onDamage never armed (no save adjudication possible)', () => {
    const { container, onAttack, onDamage, onSaveRoll } = renderRow(PINCER);
    fireEvent.click(container.querySelectorAll('.mc-dice-link')[0]);
    expect(onAttack).toHaveBeenCalledWith('Pincer Staff', 4, expect.objectContaining({ name: 'Pincer Staff' }));
    expect(onSaveRoll).not.toHaveBeenCalled();
    expect(onDamage).not.toHaveBeenCalled();
  });

  it('MA-1070 byte-twin Kuo-toa Monitor "Bone Whip" (identical save_dc:0 shape) also renders zero save chips', () => {
    expect(BONE_WHIP.name).toBe('Bone Whip');
    expect(BONE_WHIP.attack_bonus).toBe(5);
    expect(BONE_WHIP.save_dc).toBe(0);
    const { container } = renderRow(BONE_WHIP);
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['+5']);
    expect(container.querySelector('.mc-dice-link-save')).toBeNull();
  });
});

describe('MA-1071 gate sweep: DC0 inert, DC>0 boundary arms', () => {
  it('isCompositeAttackSaveRow: DC0 decoy false, DC23 twin true (MA-0551 convention)', () => {
    expect(isCompositeAttackSaveRow(PINCER)).toBe(false);
    expect(isCompositeAttackSaveRow({ ...PINCER, save_dc: 23, save_type: 'Constitution' })).toBe(true);
  });

  it('buildSaveOptions: DC0 decoy arms no saveDc AND no half-default dcSuccess', () => {
    const opts = buildSaveOptions(PINCER);
    expect(opts.saveDc).toBeNull();
    expect(opts.dcSuccess).toBeNull();
    const armed = buildSaveOptions({ ...PINCER, save_dc: 23, save_type: 'Constitution' });
    expect(armed.saveDc).toBe(23);
    expect(armed.dcSuccess).toBe('half');
  });

  it('boundary render: save_dc:23 twin arms the clickable save chip through the same fork', () => {
    const twin = { ...PINCER, save_dc: 23, save_type: 'Constitution' };
    const { container, onSaveRoll } = renderRow(twin);
    const saveChip = container.querySelector('.mc-dice-link-save-clickable');
    expect(saveChip).not.toBeNull();
    expect(saveChip.textContent.trim()).toBe('DC 23 Constitution');
    fireEvent.click(saveChip);
    expect(onSaveRoll).toHaveBeenCalled();
  });

  it('breathAoeShape: DC0 decoy + radius prose (Myconid Rapport Spores twin) never opens the DC0 picker', () => {
    const rapport = monsters.find((m) => m.name === 'Myconid Adult').actions[2];
    expect(rapport.save_dc).toBe(0);
    expect(breathAoeShape(rapport, null)).toBeNull();
    // DC>0 boundary twin must still parse (cone wording; the emanation-in-
    // description never parsed — MA-0590 reads the range field only).
    expect(breathAoeShape({ ...rapport, save_dc: 13, description: 'A 30-foot Cone of spores.' }, null)).toEqual({ shape: 'Cone', feet: 30, rangeGateFt: 30 });
  });
});
