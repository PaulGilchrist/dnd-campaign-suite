// @maintained-by-ai 2026-11-28
// MA-1020: monster Shape-Shift chip — COMPONENT lane FOLD HOST over the FOUR
// live disk rows that resolve to ONE registry def. ShapeShiftLink (the
// component the describe below exercises) arms one .mc-dice-link-shapeshift
// chip off the disk row's automation via isMonsterShapeShiftRow
// (services/encounters/monsterShapeShift.js: automation.type ===
// 'monster_shape_shift' && forms.length > 0 — the chip keys off the SAME
// predicate; formsText is action.automation.forms.map(f => f.name).join(' / ')).
// Disk census (live, this run): exactly FOUR monster_shape_shift rows exist —
// imp "Shape-Shift", lizardfolk-shaman "Change Shape (Recharges after a Short
// or Long Rest)", oni "Shape-Shift", quasit "Shape-Shift" — so this host spans
// the complete affordance surface; nothing hand-authored (#387/fix#269
// recipe: registry-def + disk-verbatim, nothing invented). None of the four
// rows rides the handlePlainDamage.hitClause HIT_CLAUSE_ROWS mega-table
// (verified absent there — they carry no hit clause), so this file is sole
// component-lane owner of these rows' chip surface.
// Folded chip-twin-fold-class (fix#269 census queue): retired twins
// MonsterAction.ma1113-shape-shift-chip.test.jsx (#455, lizardfolk formsText
// "Crocodile / True Form" + recharge-name no-counter + Bite mount gate),
// MonsterAction.ma1260-shape-shift-chip.test.jsx (#469, Oni junk "+0"
// suppression), MonsterAction.ma1371-shape-shift-chip.test.jsx (Quasit
// sole-link + Rend gate) — every retired assertion family re-homed here,
// consolidated to one execution path per behavior:
// - arms-one-chip test (per disk row): chip arm/title/prose/At-Will + the
//   junk "+0" anti-cross-wire census (every mc-dice-link IS the shapeshift
//   chip, onAttack never arms) + click routes the exact disk row BY REFERENCE
//   (deep-equal would miss a row copy) — one render, one click, all four
//   claims (imp native + ma1113 no-counter + ma1260/ma1371 junk-bonus legs).
// - clickable guard test (imp row only): the guard
//   (clickable = !attackerCannotAct && !!onShapeShiftRow) is row-INdependent
//   — it only ever runs behind the per-row predicate arm pinned above — so
//   incapacitated + missing-handler are tested once, not x4 per monster.
// - sibling mount-gate test (pruned by automation SHAPE, since MonsterAction
//   renders one row in isolation and per-monster context cannot change the
//   output): imp Invisibility = adjacent monster_self_buff automation (zero
//   shapeshift chips, keeps its OWN selfbuff affordance — retired ma1020
//   native leg) and quasit Rend = plain attack row (automation undefined).
//   imp Sting and shaman Bite share Rend's exact shape and were dropped.
// Owned elsewhere — NOT restated here:
// - predicate true/false, forms list, Speed dict, apply/refusals/modal seam:
//   services/encounters/monsterShapeShift.{ma1020-imp,ma1113-lizardfolk,
//   ma1260-oni,ma1371-quasit}.test.js
// - self-buff lane discrimination (isMonsterSelfBuffRow mechanics): services/
//   encounters/monsterSelfBuff.imp-invisibility.test.js and the self-buff
//   chip mechanics in MonsterAction.self-buff.test.jsx (duergar fixture)
// - chooser UI: ShapeShiftModal.test.jsx
// - data-kind stamp census: MonsterCardModal.data-kind.test.jsx
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
// (never typed forms).
const DISK_ROWS = ['imp', 'lizardfolk-shaman', 'oni', 'quasit'].map((index) => {
  const monster = monsters.find((m) => m.index === index);
  const action = monster.actions.find(isMonsterShapeShiftRow);
  return {
    index,
    action,
    formsText: action.automation.forms.map((f) => f.name).join(' / '),
    proseAnchor: action.description.replace(/<[^>]+>/g, '').slice(0, 20),
  };
});

// The two automation SHAPES a non-shapeshift sibling can take at the component
// edge, fetched live from disk (retired-twin legs; nothing invented).
const SIBLING_ROWS = [
  { label: 'imp Invisibility (adjacent monster_self_buff automation)', monster: 'imp', name: 'Invisibility', ownChip: '.mc-dice-link-selfbuff' },
  { label: 'quasit Rend (plain attack row, automation undefined)', monster: 'quasit', name: 'Rend', ownChip: null },
].map(({ label, monster, name, ownChip }) => ({
  label,
  action: monsters.find((m) => m.index === monster).actions.find((a) => a.name === name),
  ownChip,
}));

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
  it.each(DISK_ROWS)('$index: arms exactly one chip beside the prose (title renders disk formsText, no counter/spent class, every mc-dice-link IS the chip — junk "+0" never again); click routes the exact disk row and never the attack lane', ({ action, formsText, proseAnchor }) => {
    const { container, onShapeShiftRow, onAttack } = renderRow(action);
    const links = [...container.querySelectorAll('.mc-dice-link')];
    // Anti-cross-wire census: the shapeshift chip is the ONLY dice-link on
    // the row — no junk "+0" attack chip, no other lane leaking in.
    expect(links.length).toBe(1);
    const [chip] = links;
    expect(chip.classList.contains('mc-dice-link-shapeshift')).toBe(true);
    expect(chip.textContent.trim()).toBe('Shape-Shift');
    expect(chip.getAttribute('role')).toBe('button');
    expect(chip.getAttribute('title')).toContain(formsText);
    expect(container.textContent).not.toContain('+0');
    // prose stays rendered beside the chip; no uses counter, no spent class —
    // At Will rows, and the shaman's "(Recharges…)" rest-rearm name stays
    // cosmetic (§70) despite living in the action name.
    expect(container.textContent).toContain(proseAnchor);
    expect(container.textContent).not.toContain('left)');
    expect(chip.className).not.toContain('mc-dice-link-spell-spent');
    // One click routes the EXACT disk row object (reference identity —
    // deep-equal would miss a re-read copy) and never arms the attack lane.
    fireEvent.click(chip);
    expect(onShapeShiftRow).toHaveBeenCalledTimes(1);
    expect(onShapeShiftRow.mock.calls[0][0]).toBe(action);
    expect(onAttack).not.toHaveBeenCalled();
  });

  it('clickable guard — incapacitated or missing handler: chip still visible, click inert, no throw', () => {
    // Row-INdependent branch (guarded behind the per-row arm above); one
    // representative row is full coverage.
    const { action } = DISK_ROWS[0];
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

  it.each(SIBLING_ROWS)('$label mount-gate: zero shape-shift chips', ({ action, ownChip }) => {
    // Predicate internals owned by services/encounters/monsterShapeShift.* lanes.
    const { container } = renderRow(action);
    expect(container.querySelectorAll('.mc-dice-link-shapeshift').length).toBe(0);
    if (ownChip) {
      // The imp self-buff row keeps its OWN affordance (retired ma1020 leg):
      // lanes stay byte-inert to each other in both directions.
      expect(container.querySelectorAll(ownChip).length).toBe(1);
    }
  });
});
