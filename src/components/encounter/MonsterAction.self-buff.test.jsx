// @maintained-by-ai
// Self-buff CHIP component lane (SelfBuffLink, MonsterAction.jsx:280-293):
// one press pattern, once. Arms exactly one .mc-dice-link-selfbuff per
// monster_self_buff row (icon per effect, uses counter or honest At Will
// silence, tooltip carries te + rounds) and routes the press to
// onSelfBuffRow(action) with row identity + zero misroute junk chips
// (MA-0655/0658/0780/1449 folded into one it.each over distinct fixture
// shapes). Gate forks: exhausted chip stays clickable for the resolver's
// honest refusal; attackerCannotAct / handlerless render inert; non-self-buff
// and legendary-gated rows arm zero chips (MA-0694 — economy rides the
// single "Expend Legendary" chip). Disk data shape, predicates, resolver,
// enders, and log/popup copy are owned by services/encounters/
// monsterSelfBuff.test.js + per-monster monsterSelfBuff.* siblings.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import monsters from '../../../public/data/monsters.json';

const duergar = monsters.find(m => m.index === 'duergar');
const ghost = monsters.find(m => m.index === 'ghost');
const seaHag = monsters.find(m => m.index === 'sea-hag');
const empyrean = monsters.find(m => m.index === 'empyrean');

const ENLARGE_ROW = duergar.actions.find(a => a.name === 'Enlarge');
const WAR_PICK = duergar.actions.find(a => a.name === 'War Pick');
const INVIS_ROW = duergar.actions.find(a => a.name === 'Invisibility');
const ETHEREALITY_ROW = ghost.actions.find(a => a.name === 'Ethereality');
const ILLUSORY_ROW = seaHag.actions.find(a => a.name === 'Illusory Appearance');
const BOLSTER_ROW = empyrean.legendary_actions.find(a => a.name === 'Bolster');

function renderRow(action, overrides = {}) {
  const onSelfBuffRow = vi.fn();
  const utils = render(
    <MonsterAction
      action={action}
      index={0}
      attackerCannotAct={false}
      onAttack={vi.fn()}
      onDamage={vi.fn()}
      onSaveRoll={vi.fn()}
      onSpellCast={vi.fn()}
      reactionUsesUsed={{}}
      onGatedReaction={vi.fn()}
      onSelfBuffRow={onSelfBuffRow}
      {...overrides}
    />
  );
  return { ...utils, onSelfBuffRow };
}

describe('self-buff chip — armed + press', () => {
  // Distinct fixture shapes folded: uses-gated (Enlarge, Invisibility) vs
  // At Will ungated (Ethereality, Illusory Appearance); default vs
  // effect-mapped icons (invisible/ethereal/disguised).
  it.each([
    { name: 'Duergar Enlarge (gated)', row: ENLARGE_ROW, icon: 'fa-up-right-and-down-left-from-center', counter: '(1/Day · 1 left)', titleNote: 'te enlarged on self, 10 rounds' },
    { name: 'Duergar Invisibility (gated)', row: INVIS_ROW, icon: 'fa-eye-slash', counter: '(1/Day · 1 left)', titleNote: 'te invisible on self, 600 rounds' },
    { name: 'Ghost Ethereality (At Will)', row: ETHEREALITY_ROW, icon: 'fa-ghost', counter: null, titleNote: 'te ethereal on self, 4800 rounds' },
    { name: 'Sea Hag Illusory Appearance (At Will)', row: ILLUSORY_ROW, icon: 'fa-user-secret', counter: null, titleNote: 'te disguised on self, 14400 rounds' },
  ])('arms ONE chip and routes press with row identity: $name', ({ row, icon, counter, titleNote }) => {
    const { container, onSelfBuffRow } = renderRow(row);
    const chips = container.querySelectorAll('.mc-dice-link-selfbuff');
    expect(chips).toHaveLength(1);
    const chip = chips[0];
    expect(chip.getAttribute('role')).toBe('button');
    expect(chip.textContent).toContain(row.name);
    if (counter) {
      expect(chip.textContent).toContain(counter);
    } else {
      expect(chip.textContent).not.toContain('/Day');
    }
    expect(chip.querySelector('i').className).toContain(icon);
    expect(chip.getAttribute('title')).toContain(titleNote);
    // no misroute/forced-save junk chip on a self-buff row (MA-1449/§490)
    expect(container.querySelector('.mc-dice-link-save-clickable')).toBeNull();
    fireEvent.click(chip);
    expect(onSelfBuffRow).toHaveBeenCalledTimes(1);
    expect(onSelfBuffRow.mock.calls[0][0]).toBe(row);
  });

  it('exhausted chip: spent class + 0 left, stays clickable for honest refusal', () => {
    const { container, onSelfBuffRow } = renderRow(ENLARGE_ROW, { spellUsesUsed: { Enlarge: 1 } });
    const chip = container.querySelector('.mc-dice-link-selfbuff');
    expect(chip.className).toContain('mc-dice-link-spell-spent');
    expect(chip.textContent).toContain('0 left');
    fireEvent.click(chip);
    expect(onSelfBuffRow).toHaveBeenCalledTimes(1);
    expect(onSelfBuffRow.mock.calls[0][0]).toBe(ENLARGE_ROW);
  });
});

describe('self-buff chip — gate forks', () => {
  it.each([
    { name: 'incapacitated attacker', overrides: { attackerCannotAct: true } },
    { name: 'handlerless row', overrides: { onSelfBuffRow: undefined } },
  ])('chip renders but click dispatches nothing: $name', ({ overrides }) => {
    const { container, onSelfBuffRow } = renderRow(ENLARGE_ROW, overrides);
    const chip = container.querySelector('.mc-dice-link-selfbuff');
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    expect(onSelfBuffRow).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'non-self-buff STR weapon row', row: WAR_PICK, overrides: {} },
    // MA-0694: legendary gated child rides the single "Expend Legendary"
    // chip — the ungated self-buff chip must NOT double-arm.
    { name: 'legendary gated self-buff row', row: BOLSTER_ROW, overrides: { legendaryGate: () => {} } },
  ])('arms no self-buff chip: $name', ({ row, overrides }) => {
    const { container } = renderRow(row, overrides);
    expect(container.querySelectorAll('.mc-dice-link-selfbuff')).toHaveLength(0);
  });
});
