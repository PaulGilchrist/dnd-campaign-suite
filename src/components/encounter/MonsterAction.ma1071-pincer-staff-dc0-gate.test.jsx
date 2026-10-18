// @maintained-by-ai
// MA-1071: Kuo-toa Whip "Pincer Staff" — household save_dc:0/save_type:""/
// save_effect:"" empty-noise decoy (MA-1021 census family) previously ADMITTED
// the ActionSaveRoll save lane (gate tested save_dc == null, 0 ≠ null): every
// hit adjudicated vs a guaranteed-success DC 0 with dcSuccess:'half' and HALVED
// the flat "Hit: 9 (2d6 + 2) Piercing" damage (live fingerprint 2026-09-24).
// Fix = code gate Number(save_dc) > 0 (MonsterAction.jsx:116 — DC0 renders NO
// save chip at all, MA-0551 convention); DATA stays authored (not stripped).
// OWNERS OUTSIDE THIS FILE (trimmed, cited):
//  - isCompositeAttackSaveRow save_dc:0 false arm → MonsterCardModal.secondary-save-transport.test.js:115
//  - positive-DC clickable chip render + save-seam press → MonsterAction.ma1546-succubus-charm-save-effect.test.jsx / ma1847-apep-devour-the-boat-save.test.jsx
//  - buildSaveOptions dc>0 half-default → MonsterCardModal.cockatrice-bite.test.jsx:44, ma1971-wing-defense.test.jsx:95
//  - breathAoeShape save_dc:0 → null + prose-cone parse → MonsterCardModal.save-variant-shape.test.jsx:21/:29
//  - Rapport Spores DC0 disk pins/zone lane → MonsterAction.ma1212-rapport-spores-zone-chip.test.jsx:55
//  - Bone Whip (MA-1070) byte-twin gate = same fork as Pincer Staff row below — redundant arm, trimmed.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';
import { buildSaveOptions } from './MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const PINCER = monsters.find((m) => m.name === 'Kuo-toa Whip').actions[0];

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

describe('MA-1071 disk lock: DC0 decoy stays authored (code gate, not data strip)', () => {
  it('Pincer Staff disk shape byte-kept: +4 / 2d6 + 2 Piercing / save_dc:0 decoy NOT stripped; grapple rider prose-inert (§59 zero-producer grapple machine, escape DC 12 advisory)', () => {
    expect(PINCER.name).toBe('Pincer Staff');
    expect(PINCER.attack_bonus).toBe(4);
    expect(PINCER.damage_dice_primary).toBe('2d6 + 2');
    expect(PINCER.damage_type_primary).toBe('Piercing');
    expect(PINCER.save_dc).toBe(0);
    expect(PINCER.save_type).toBe('');
    expect(PINCER.save_effect).toBe('');
    expect(PINCER.hit_conditions).toBeUndefined();
    expect(PINCER.escape_dc).toBeUndefined();
    expect(buildHitConditionClause(PINCER)).toBeFalsy();
  });
});

describe('MA-1071 render gate: save_dc:0 boundary suppresses the save lane entirely', () => {
  it('DC0 row renders ONE "+4" chip only — no save dice chip, no "DC 0" chip (gate is `== null || Number() <= 0`, 0 suppressed); press routes onAttack ONLY, onSaveRoll/onDamage never armed', () => {
    const { container, onAttack, onDamage, onSaveRoll } = renderRow(PINCER);
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['+4']);
    expect(container.querySelector('.mc-dice-link-save, .mc-dice-link-save-clickable')).toBeNull();
    expect(container.textContent).not.toContain('DC 0');
    fireEvent.click(container.querySelectorAll('.mc-dice-link')[0]);
    expect(onAttack).toHaveBeenCalledWith('Pincer Staff', 4, expect.objectContaining({ name: 'Pincer Staff' }));
    expect(onSaveRoll).not.toHaveBeenCalled();
    expect(onDamage).not.toHaveBeenCalled();
  });
});

describe('MA-1071 save-transport gate: DC0 arms no saveDc AND no half-default dcSuccess', () => {
  // Unowned arm: no other suite feeds an INTEGER save_dc:0 to buildSaveOptions
  // (other toBeNull() hits are save_dc-absent rows; MA-1071 twin comment
  // MonsterCardModal.jsx:1330 marks this exact `|| null` / >0 collapse).
  it('buildSaveOptions: save_dc:0 decoy collapses saveDc to null and dcSuccess stays null (no half leak riding a null DC)', () => {
    const opts = buildSaveOptions(PINCER);
    expect(opts.saveDc).toBeNull();
    expect(opts.dcSuccess).toBeNull();
  });
});
