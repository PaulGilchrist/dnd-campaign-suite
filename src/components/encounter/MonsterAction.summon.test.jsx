// @maintained-by-ai
// SummonLink chip lane (MonsterAction.jsx:256-268): one press pattern, once.
// Arms exactly ONE .mc-dice-link-summon per monster_summon row with the exact
// honest tooltip (options + chance %, constant count when authored, range,
// duration_minutes or 'GM-adjudicated' — never a fabricated "10 min", §70),
// the numeric uses counter when the MA-0020 gate arms (silent on the
// recharge-economy row), fa-hat-wizard icon, and routes the press to
// onSummonRow(action) with row identity, zero misroute (no "+0" junk chip on
// MA-1215's attack_bonus-less row). MA-0648/0651/0757/0759/1604/1215 folded
// into one it.each over distinct fixture shapes; galib-duhr is galeb-duhr's
// byte-twin whose chip renders identically — twin data + resolution owned by
// monsterSummon.test.js:520/646. Spent forks: exhausted-uses OR spent-recharge
// chips keep the spent class (rechargeOut fork) and stay clickable for the
// resolver's honest refusal; a met-recharge map entry de-spents; attackerCannotAct
// and handlerless render inert; non-summon rows arm zero chips. Disk shape,
// isMonsterSummonRow, coin-flip/spawn/self-damage resolution, gateSummonRecharge,
// and refusal copy/logs are owned by services/encounters/monsterSummon.test.js
// (+ siblings); counter arithmetic by services/encounters/monsterAbilityUses.test.js:33-35.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import monsters from '../../../public/data/monsters.json';

const drowMage = monsters.find(m => m.index === 'drow-mage');
const galebDuhr = monsters.find(m => m.index === 'galeb-duhr');
const treant = monsters.find(m => m.index === 'treant');
const sovereign = monsters.find(m => m.index === 'myconid-sovereign');

const SUMMON_ROW = drowMage.actions.find(a => a.name === 'Summon Demon');
const STAFF_ROW = drowMage.actions.find(a => a.name === 'Staff');
const PRIESTESS_ROW = monsters.find(m => m.index === 'drow-priestess-of-lolth').actions.find(a => a.name === 'Summon Demon');
const ANIMATE_ROW = galebDuhr.actions.find(a => a.name === 'Animate Boulders');
const AVALANCHE_ROW = galebDuhr.actions.find(a => a.name === 'Avalanche Slam');
const TREANT_ANIMATE_ROW = treant.actions.find(a => a.name === 'Animate Trees');
const ANIMATING_ROW = sovereign.actions.find(a => a.name === 'Animating Spores');

function renderRow(action, overrides = {}) {
  const onSummonRow = vi.fn();
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
      onSummonRow={onSummonRow}
      {...overrides}
    />
  );
  return { ...utils, onSummonRow };
}

describe('summon chip — armed + press', () => {
  // Distinct fixture shapes folded: multi-option coin-flip vs single chance
  // option vs constant-count self-summon (galeb byte-twin galib dropped) vs
  // recharge-economy ungated row; exact title proves count omission, chance
  // %, range default, honest 'GM-adjudicated' silence on unauthored clocks.
  it.each([
    { name: 'Drow Mage Summon Demon (coin-flip options)', row: SUMMON_ROW, counter: '(1/Day · 1 left)', title: 'Summon quasit or shadow-demon (50%) — 60 ft, 10 min' },
    { name: 'Priestess Summon Demon (single 30% chance, 3/Day)', row: PRIESTESS_ROW, counter: '(3/Day · 3 left)', title: 'Summon yochlol (30%) — 60 ft, 10 min' },
    { name: 'Galeb Duhr Animate Boulders (constant count)', row: ANIMATE_ROW, counter: '(1/Day · 1 left)', title: 'Summon galeb-duhr — count 2, 60 ft, 1 min' },
    { name: 'Treant Animate Trees (count + 1-day clock)', row: TREANT_ANIMATE_ROW, counter: '(1/Day · 1 left)', title: 'Summon treant — count 2, 60 ft, 1440 min' },
    { name: 'Myconid Sovereign Animating Spores (recharge economy)', row: ANIMATING_ROW, counter: null, title: 'Summon myconid-spore-servant — 5 ft, GM-adjudicated', rowNote: '(3)' },
  ])('arms ONE chip, exact honest tooltip, routes press with row identity: $name', ({ row, counter, title, rowNote }) => {
    const { container, onSummonRow } = renderRow(row);
    const chips = container.querySelectorAll('.mc-dice-link-summon');
    expect(chips).toHaveLength(1);
    const chip = chips[0];
    expect(chip.getAttribute('role')).toBe('button');
    expect(chip.getAttribute('title')).toBe(title);
    expect(chip.querySelector('i').className).toContain('fa-hat-wizard');
    if (counter) {
      expect(chip.textContent).toContain(counter);
    } else {
      expect(chip.textContent).not.toContain('/Day');
      expect(container.textContent).toContain(rowNote);
    }
    // no "+0" junk chip misrouted onto a summon row (MA-1215)
    expect([...container.querySelectorAll('span')].some(s => /^\+0/.test(s.textContent.trim()))).toBe(false);
    fireEvent.click(chip);
    expect(onSummonRow).toHaveBeenCalledTimes(1);
    expect(onSummonRow.mock.calls[0][0]).toBe(row);
  });

  // Both spent-class sources (MonsterAction.jsx:260): exhausted uses gate and
  // the live recharge map; spent ≠ disabled — the click routes the honest
  // refusal (zone-aura precedent). "1 left" partial arithmetic is gate-service
  // territory (monsterAbilityUses.test.js:34), not restated here.
  it.each([
    { name: 'uses gate exhausted (1/Day spent)', row: SUMMON_ROW, overrides: { spellUsesUsed: { 'Summon Demon': 1 } }, spent: true, chipNote: '0 left' },
    { name: 'recharge spent', row: ANIMATING_ROW, overrides: { rechargeState: { 'Animating Spores': { recharged: false, threshold: 3 } } }, spent: true, rowNote: 'Recharge 3 — unavailable' },
    { name: 'recharge met at own turn-start: de-spent', row: ANIMATING_ROW, overrides: { rechargeState: { 'Animating Spores': { recharged: true, threshold: 3 } } }, spent: false },
  ])('spent fork renders honestly, chip stays clickable for refusal: $name', ({ row, overrides, spent, chipNote, rowNote }) => {
    const { container, onSummonRow } = renderRow(row, overrides);
    const chip = container.querySelector('.mc-dice-link-summon');
    expect(chip.className.includes('mc-dice-link-spell-spent')).toBe(spent);
    if (chipNote) expect(chip.textContent).toContain(chipNote);
    if (rowNote) expect(container.textContent).toContain(rowNote);
    else expect(container.textContent).not.toContain('unavailable');
    fireEvent.click(chip);
    expect(onSummonRow).toHaveBeenCalledTimes(1);
    expect(onSummonRow.mock.calls[0][0]).toBe(row);
  });
});

describe('summon chip — gate forks', () => {
  it.each([
    { name: 'incapacitated attacker', overrides: { attackerCannotAct: true } },
    { name: 'handlerless row', overrides: { onSummonRow: undefined } },
  ])('chip renders but click dispatches nothing: $name', ({ overrides }) => {
    const { container, onSummonRow } = renderRow(SUMMON_ROW, overrides);
    const chip = container.querySelector('.mc-dice-link-summon');
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    expect(onSummonRow).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'Drow Mage Staff (STR weapon row)', row: STAFF_ROW },
    { name: 'Galeb Duhr Avalanche Slam (attack row)', row: AVALANCHE_ROW },
  ])('arms no summon chip: $name', ({ row }) => {
    const { container } = renderRow(row);
    expect(container.querySelectorAll('.mc-dice-link-summon')).toHaveLength(0);
  });
});
