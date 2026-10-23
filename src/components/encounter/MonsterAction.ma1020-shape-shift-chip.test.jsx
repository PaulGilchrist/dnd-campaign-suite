// @maintained-by-ai
// MA-1020: monster Shape-Shift chip — COMPONENT lane FOLD HOST over the FOUR
// live disk rows that resolve to ONE registry def. ShapeShiftLink
// (MonsterAction.jsx:321) arms one .mc-dice-link-shapeshift chip off the
// disk row's automation via isMonsterShapeShiftRow (monsterShapeShift.js:29-32:
// automation.type === 'monster_shape_shift' && forms.length > 0 — the chip
// itself keys off the SAME predicate, MonsterAction.jsx:322; formsText is
// action.automation.forms.map(f => f.name).join(' / '), :324). Disk census
// (live, this run): exactly FOUR monster_shape_shift rows exist — imp
// "Shape-Shift", lizardfolk-shaman "Change Shape (Recharges after a Short or
// Long Rest)", oni "Shape-Shift", quasit "Shape-Shift" — so this host spans
// the complete affordance surface; nothing hand-authored (#387/fix#269
// recipe: registry-def + disk-verbatim, nothing invented).
// Folded chip-twin-fold-class (fix#269 census queue): retired twins
// MonsterAction.ma1113-shape-shift-chip.test.jsx (#455, lizardfolk formsText
// "Crocodile / True Form" + recharge-name no-counter + Bite mount gate),
// MonsterAction.ma1260-shape-shift-chip.test.jsx (#469, Oni junk "+0"
// suppression), MonsterAction.ma1371-shape-shift-chip.test.jsx (Quasit
// sole-link + Rend gate) — every retired assertion family re-homed here:
// - ma1020 native: chip arm/title/prose/At-Will + click route → rows 1/4;
//   clickable guard (MonsterAction.jsx:323) incapacitated + missing-handler →
//   rows 3/4; imp Invisibility self-buff discrimination (0 shapeshift,
//   1 selfbuff) + Sting prose gate → sibling legs.
// - ma1113: formsText from disk per row, no-counter despite "(Recharges
//   after a Short or Long Rest)" name (§70 cosmetic), Bite zero-chip →
//   sibling leg.
// - ma1260 + ma1371: junk attack_bonus "+0" suppression — row carries NO
//   attack_bonus (disk-verified), so every mc-dice-link IS the shapeshift
//   chip and onAttack never arms → rows 2/4 across all four monsters.
// Owned elsewhere — NOT restated here:
// - predicate true/false, forms list, Speed dict, apply/refusals/modal seam:
//   services/encounters/monsterShapeShift.{ma1020-imp,ma1113-lizardfolk,
//   ma1260-oni,ma1371-quasit}.test.js
// - self-buff lane discrimination (imp Invisibility, isMonsterSelfBuffRow):
//   services/encounters/monsterSelfBuff.imp-invisibility.test.js :96/:113
//   and its chip affordance in MonsterAction.self-buff.test.jsx
// - chooser UI: ShapeShiftModal.test.jsx
// At Will: no uses counter, no spent class (none of the four disk rows
// carries `usage`; the shaman's recharge wording lives in its NAME only).
// No timers.
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import { isMonsterShapeShiftRow } from '../../services/encounters/monsterShapeShift.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));

// The four shape-shift disk rows, fetched live via the registry predicate the
// component itself uses. formsText + proseAnchor derive from the disk bytes
// (never typed forms). siblings: the byte-inert rows the retired twin lanes
// pinned (Oni's retired lane pinned none — none invented here).
const DISK_ROWS = ['imp', 'lizardfolk-shaman', 'oni', 'quasit'].map((index) => {
  const monster = monsters.find((m) => m.index === index);
  const action = monster.actions.find(isMonsterShapeShiftRow);
  const siblingNames = { imp: ['Invisibility', 'Sting'], 'lizardfolk-shaman': ['Bite'], quasit: ['Rend'] }[index] || [];
  return {
    index,
    action,
    formsText: action.automation.forms.map((f) => f.name).join(' / '),
    proseAnchor: action.description.replace(/<[^>]+>/g, '').slice(0, 20),
    siblings: siblingNames.map((name) => monster.actions.find((a) => a.name === name)),
  };
});

function renderRow(action, overrides = {}) {
  const onShapeShiftRow = vi.fn();
  const onAttack = vi.fn();
  const utils = render(
    <MonsterAction
      action={action}
      index={0}
      attackerCannotAct={false}
      onAttack={onAttack}
      onDamage={vi.fn()}
      onSaveRoll={vi.fn()}
      onSpellCast={vi.fn()}
      reactionUsesUsed={{}}
      onGatedReaction={vi.fn()}
      rechargeState={{}}
      onShapeShiftRow={onShapeShiftRow}
      {...overrides}
    />
  );
  return { ...utils, onShapeShiftRow, onAttack };
}

describe('MA-1020 Shape-Shift chip fold host (4 disk rows, one registry def)', () => {
  it.each(DISK_ROWS)('$index: arms one chip beside the prose, title renders disk formsText, no counter/spent class; click routes exact disk row', ({ action, formsText, proseAnchor }) => {
    const { container, onShapeShiftRow } = renderRow(action);
    const chips = [...container.querySelectorAll('.mc-dice-link-shapeshift')];
    expect(chips.length).toBe(1);
    expect(chips[0].textContent.trim()).toBe('Shape-Shift');
    expect(chips[0].getAttribute('role')).toBe('button');
    expect(chips[0].getAttribute('title')).toContain(formsText);
    // prose stays rendered beside the chip; no uses counter, no spent class —
    // At Will rows, and the shaman's "(Recharges…)" rest-rearm name stays
    // cosmetic (§70) despite living in the action name.
    expect(container.textContent).toContain(proseAnchor);
    expect(container.textContent).not.toContain('left)');
    expect(chips[0].className).not.toContain('mc-dice-link-spell-spent');
    fireEvent.click(chips[0]);
    expect(onShapeShiftRow).toHaveBeenCalledTimes(1);
    expect(onShapeShiftRow.mock.calls[0][0]).toBe(action);
  });

  it.each(DISK_ROWS)('$index: junk "+0" attack chip never again — every mc-dice-link on the disk row IS the shapeshift chip; onAttack never armed', ({ action }) => {
    const { container, onAttack } = renderRow(action);
    const links = [...container.querySelectorAll('.mc-dice-link')];
    expect(links.length).toBe(1);
    expect(links[0].classList.contains('mc-dice-link-shapeshift')).toBe(true);
    expect(container.textContent).not.toContain('+0');
    fireEvent.click(links[0]);
    expect(onAttack).not.toHaveBeenCalled();
  });

  it.each(DISK_ROWS)('$index: clickable guard (:323) — incapacitated or missing handler: chip visible, click inert, no throw', ({ action }) => {
    const { container, onShapeShiftRow } = renderRow(action, { attackerCannotAct: true });
    const chip = container.querySelector('.mc-dice-link-shapeshift');
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    expect(onShapeShiftRow).not.toHaveBeenCalled();

    const unhandled = renderRow(action, { onShapeShiftRow: undefined });
    const chip2 = unhandled.container.querySelector('.mc-dice-link-shapeshift');
    expect(chip2).toBeTruthy();
    expect(() => fireEvent.click(chip2)).not.toThrow();
  });

  it.each(DISK_ROWS.flatMap(({ index, siblings }) => siblings.map((sib) => [index, sib])))('%s sibling "%s" mount-gate: zero shape-shift chips', (_index, sib) => {
    // predicate internals owned by services/encounters/monsterShapeShift.* lanes.
    const { container } = renderRow(sib);
    expect(container.querySelectorAll('.mc-dice-link-shapeshift').length).toBe(0);
    if (sib.name === 'Invisibility') {
      // imp self-buff row keeps its OWN affordance (retired ma1020 byte).
      expect(container.querySelectorAll('.mc-dice-link-selfbuff').length).toBe(1);
    }
  });
});
