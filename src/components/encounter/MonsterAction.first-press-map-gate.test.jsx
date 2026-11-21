// @maintained-by-ai
// Component unit lane for the 2026-11-20 CCC backlog improvement "Modal
// first-press mapData race": while the modal's active-map fetch is pending
// (spatialGatePending), the ATTACK-roll chip renders as an inert busy
// affordance — spent styling + aria-busy/aria-disabled, dice glyph swapped
// for the fa-spinner fa-spin loading face, NO onClick — and a
// press routes nothing to onAttack. Settled (false or default prop) the chip
// is byte-identical to its pre-fix shape and routes the exact payload (the
// ma0294 byte pins). Integration lanes (fetch tracking, settle-on-reject,
// mapless leniency) live in MonsterCardModal.first-press-map-gate.test.jsx.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';

const SHORTBOW = {
  name: 'Shortbow',
  attack_bonus: 4,
  range: '30/120 ft.',
  description: 'Ranged Weapon Attack: +4 to hit, range 30/120 ft., one target. Hit: 1d6 + 2 piercing damage.',
  damage_dice_primary: '1d6 + 2',
  damage_type_primary: 'Piercing',
};

function renderChip(passGate) {
  const onAttack = vi.fn();
  const utils = render(
    <MonsterAction
      action={SHORTBOW}
      index={0}
      attackerCannotAct={false}
      {...passGate}
      onAttack={onAttack}
      onDamage={vi.fn()}
      onSaveRoll={vi.fn()}
      onSpellCast={vi.fn()}
      reactionUsesUsed={{}}
      onGatedReaction={vi.fn()}
    />
  );
  return { ...utils, onAttack };
}

function chip(container) {
  const el = container.querySelector('.mc-dice-link[data-kind="attack"]');
  expect(el, 'the attack chip stays present in every face').toBeTruthy();
  return el;
}

describe('first-press map-measure gate on the attack chip', () => {
  it('pending face: inert busy affordance — spent styling + aria-busy/aria-disabled, spinner glyph replaces the dice, click routes NOTHING', () => {
    const { container, onAttack } = renderChip({ spatialGatePending: true });
    const el = chip(container);
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.className).toBe('mc-dice-link mc-dice-link-spell-spent');
    expect(el.getAttribute('onClick')).toBeNull();
    expect(el.textContent).toContain('+4');
    // 2026-11-21 DDD backlog: the muted color alone surfaced the pending
    // window nowhere visually — the dice glyph must swap to the app-wide
    // spinner idiom while the map fetch is in flight.
    expect(el.querySelector('i.fa-dice-d20'), 'dice glyph is replaced while pending').toBeNull();
    expect(el.querySelector('i.fa-spinner.fa-spin'), 'spinner face explains the inert press').toBeTruthy();
    fireEvent.click(el);
    expect(onAttack).not.toHaveBeenCalled();
  });

  it('settled face (explicit false): byte-identical plain chip routes the exact attack payload once', () => {
    const { container, onAttack } = renderChip({ spatialGatePending: false });
    const el = chip(container);
    expect(el.className).toBe('mc-dice-link');
    expect(el.hasAttribute('aria-busy')).toBe(false);
    expect(el.querySelector('i.fa-spinner'), 'spinner face is gone once settled').toBeNull();
    expect(el.querySelector('i.fa-dice-d20'), 'normal dice glyph restores').toBeTruthy();
    fireEvent.click(el);
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Shortbow', 4, SHORTBOW);
  });

  it('default prop (hosts without the map lane): chip stays byte-identical plain and live', () => {
    const { container, onAttack } = renderChip({});
    const el = chip(container);
    expect(el.className).toBe('mc-dice-link');
    expect(el.hasAttribute('aria-busy')).toBe(false);
    expect(el.querySelector('i.fa-dice-d20'), 'dice glyph on ungated hosts').toBeTruthy();
    fireEvent.click(el);
    expect(onAttack).toHaveBeenCalledTimes(1);
  });
});
