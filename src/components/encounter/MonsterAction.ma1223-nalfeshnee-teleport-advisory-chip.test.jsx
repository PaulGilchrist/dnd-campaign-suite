// @maintained-by-ai: 2026-10-18
// MA-1223: Nalfeshnee "Teleport" — junk "+0" chip adjudicated bogus to-hit
// rolls for a RAW pure self-relocation action (live fingerprint 2026-09-25:
// 2× press → roll/attack bonus:0 hit/miss vs armed Bandit AC 12, lastAttack
// polluted with attackName:"Teleport" + fabricated weaponType:"ranged"). Fix
// = attack_bonus:null (MA-1212 family convention) + advisory fields arming
// AdvisoryLink (.mc-dice-link-advisory → onAdvisoryRow, zero rolls).
// OWNERSHIP: disk row shape (name/attack_bonus:null/save_dc:0 decoy/advisory
// key/CLA-320 copy) + isMonsterActionAdvisoryRow predicate + popup/log/resolver
// record-only contract are owned by services/encounters/monsterActionAdvisory
// .test.js :27-108; the full-card modal press seam (popup + ONE ability_use,
// zero rolls, refire) is owned by MonsterCardModal.ma1223-nalfeshnee-teleport
// -advisory.test.jsx. This file locks ONLY the MonsterAction AdvisoryLink
// lane: chip arms + labels + press payload routes the row verbatim, both inert
// lanes, legendaryGate suppression (:360-368 of MonsterAction.jsx), and §37
// byte-inert siblings (the chip arms ONLY on the top-level advisory field and
// ONLY when no legendaryGate is present).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const NALFESHNEE = monsters.find((m) => m.index === 'nalfeshnee');
const TELEPORT = NALFESHNEE.actions.find((a) => a.name === 'Teleport');
const REND = NALFESHNEE.actions.find((a) => a.name === 'Rend');
const MULTIATTACK = NALFESHNEE.actions.find((a) => a.name === 'Multiattack');
const SPHINX_TELEPORT = monsters.find((m) => m.index === 'androsphinx').legendary_actions.find((a) => a.name === 'Teleport (Costs 2 Actions)');

const renderRow = (action, extra = {}) => {
  const onAttack = vi.fn();
  const onAdvisoryRow = vi.fn();
  const onSaveRoll = vi.fn();
  const onDamage = vi.fn();
  const { container } = render(
    <MonsterAction
      action={action}
      index={2}
      attackerCannotAct={false}
      onAttack={onAttack}
      onDamage={onDamage}
      onSaveRoll={onSaveRoll}
      onSpellCast={vi.fn()}
      reactionUsesUsed={{}}
      onGatedReaction={vi.fn()}
      onAdvisoryRow={onAdvisoryRow}
      {...extra}
    />
  );
  return { container, onAttack, onAdvisoryRow, onSaveRoll, onDamage };
};

describe('MA-1223 MonsterAction AdvisoryLink: advisory chip replaces the junk "+0"', () => {
  it('Teleport row: exactly ONE chip — labelled advisory, honest title, no junk "+0"/save/damage sibling; press routes onAdvisoryRow with the row, never attack/save/damage legs', () => {
    const { container, onAttack, onAdvisoryRow, onSaveRoll, onDamage } = renderRow(TELEPORT);
    const chip = container.querySelector('.mc-dice-link-advisory');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Teleport');
    expect(chip.getAttribute('title')).toMatch(/GM-enforced/);
    // the junk "+0" to-hit chip (and any save/damage affordance) is dead —
    // the advisory chip is the ONLY mc-dice-link on the row.
    expect(Array.from(container.querySelectorAll('.mc-dice-link')).filter((c) => c !== chip)).toHaveLength(0);
    expect(container.textContent).not.toContain('+0');
    fireEvent.click(chip);
    expect(onAdvisoryRow).toHaveBeenCalledTimes(1);
    expect(onAdvisoryRow.mock.calls[0][0]).toBe(TELEPORT);
    expect(onAttack).not.toHaveBeenCalled();
    expect(onSaveRoll).not.toHaveBeenCalled();
    expect(onDamage).not.toHaveBeenCalled();
  });

  it('chip is inert when the adviser cannot act, and inert (no crash) with no resolver wired', () => {
    const { container, onAdvisoryRow } = renderRow(TELEPORT, { attackerCannotAct: true });
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).not.toHaveBeenCalled();
    const bare = renderRow(TELEPORT, { onAdvisoryRow: undefined });
    fireEvent.click(bare.container.querySelector('.mc-dice-link-advisory'));
  });
});

describe('MA-1223 byte-inert discipline (§37): non-advisory + legendary-gated rows unchanged', () => {
  it('Rend and Multiattack keep ONLY their "+10" attack chips — no advisory chip', () => {
    for (const action of [REND, MULTIATTACK]) {
      const { container } = renderRow(action);
      expect(container.querySelector('.mc-dice-link-advisory')).toBe(null);
      expect(Array.from(container.querySelectorAll('.mc-dice-link')).some((l) => l.textContent.includes('+10'))).toBe(true);
    }
  });

  it('legendary advisory row under a legendaryGate arms NO second chip — rides "Expend Legendary" byte-identical', () => {
    expect(SPHINX_TELEPORT.advisory).toBe('sphinx_teleport');
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
