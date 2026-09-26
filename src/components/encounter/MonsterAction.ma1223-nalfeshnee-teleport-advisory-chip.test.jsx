// MA-1223: Nalfeshnee "Teleport" — junk "+0" chip adjudicated bogus to-hit
// rolls for a RAW pure self-relocation action (live fingerprint 2026-09-25:
// 2× press → roll/attack bonus:0 hit/miss vs armed Bandit AC 12, lastAttack
// polluted with attackName:"Teleport" + fabricated weaponType:"ranged"). Fix
// = attack_bonus:null (MA-1212 family convention) + advisory fields arming a
// NEW advisory chip (.mc-dice-link-advisory → resolveMonsterActionAdvisoryRow
// record-only popup + ability_use log, zero rolls). The chip arms ONLY on
// rows carrying the top-level advisory field and ONLY when no legendaryGate
// is present — every non-advisory row byte-identical (§37 byte-inert).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const NALFESHNEE = monsters.find((m) => m.index === 'nalfeshnee');
const TELEPORT = NALFESHNEE.actions[2];
const REND = NALFESHNEE.actions[1];
const MULTIATTACK = NALFESHNEE.actions[0];
const SPHINX = monsters.find((m) => m.index === 'androsphinx');
const SPHINX_TELEPORT = SPHINX.legendary_actions.find((a) => a.advisory === 'sphinx_teleport');

const renderRow = (action, extra = {}) => {
  const onAttack = vi.fn();
  const onAdvisoryRow = vi.fn();
  const { container } = render(
    <MonsterAction
      action={action}
      index={2}
      attackerCannotAct={false}
      onAttack={onAttack}
      onDamage={vi.fn()}
      onSaveRoll={vi.fn()}
      onSpellCast={vi.fn()}
      reactionUsesUsed={{}}
      onGatedReaction={vi.fn()}
      onAdvisoryRow={onAdvisoryRow}
      {...extra}
    />
  );
  return { container, onAttack, onAdvisoryRow };
};

describe('MA-1223 disk lock: junk to-hit stripped, advisory fields authored', () => {
  it('Teleport attack_bonus:null + advisory:monster_teleport + honest CLA-320 copy', () => {
    expect(TELEPORT.attack_bonus).toBeNull();
    expect(TELEPORT.advisory).toBe('monster_teleport');
    expect(TELEPORT.advisory_message).toMatch(/relocation to an unoccupied visible space ≤120 ft is GM-enforced/);
    expect(TELEPORT.advisory_message).toMatch(/no grid-position consumer app-wide \(CLA-320\)/);
  });
});

describe('MA-1223 MonsterAction render: advisory chip replaces the junk "+0"', () => {
  it('Teleport row: NO "+0" chip; advisory chip present and labelled', () => {
    const { container } = renderRow(TELEPORT);
    expect(container.textContent).not.toMatch(/\+0/);
    const chip = container.querySelector('.mc-dice-link-advisory');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Teleport');
    expect(chip.getAttribute('title')).toMatch(/GM-enforced/);
  });

  it('advisory chip press routes onAdvisoryRow with the row, never onAttack', () => {
    const { container, onAttack, onAdvisoryRow } = renderRow(TELEPORT);
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).toHaveBeenCalledTimes(1);
    expect(onAdvisoryRow.mock.calls[0][0]).toBe(TELEPORT);
    expect(onAttack).not.toHaveBeenCalled();
  });

  it('incapacitated adviser chip is inert (no click route)', () => {
    const { container, onAdvisoryRow } = renderRow(TELEPORT, { attackerCannotAct: true });
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).not.toHaveBeenCalled();
  });

  it('without a resolver wired the chip is inert (no crash, no route)', () => {
    const { container } = renderRow(TELEPORT, { onAdvisoryRow: undefined });
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
  });
});

describe('MA-1223 byte-inert discipline (§37): non-advisory rows unchanged', () => {
  it('Rend keeps ONLY its "+10" attack chip — no advisory chip', () => {
    const { container } = renderRow(REND);
    const links = Array.from(container.querySelectorAll('.mc-dice-link'));
    expect(links.some((l) => l.textContent.includes('+10'))).toBe(true);
    expect(container.querySelector('.mc-dice-link-advisory')).toBe(null);
  });

  it('Multiattack keeps ONLY its "+10" attack chip — no advisory chip', () => {
    const { container } = renderRow(MULTIATTACK);
    expect(container.querySelector('.mc-dice-link-advisory')).toBe(null);
    expect(Array.from(container.querySelectorAll('.mc-dice-link')).some((l) => l.textContent.includes('+10'))).toBe(true);
  });

  it('legendary advisory row under a legendaryGate arms NO second chip — rides "Expend Legendary" byte-identical', () => {
    const legendaryGate = vi.fn();
    const { container, onAdvisoryRow } = renderRow(SPHINX_TELEPORT, { legendaryGate });
    expect(container.querySelector('.mc-dice-link-advisory')).toBe(null);
    const chip = container.querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
    fireEvent.click(chip);
    expect(legendaryGate).toHaveBeenCalledTimes(1);
    expect(onAdvisoryRow).not.toHaveBeenCalled();
  });
});
