// MA-1224: Nalfeshnee "Pursuit" reaction row — formerly prose-only with
// ZERO affordance (live fingerprint 2026-09-25: Reactions census 0 chips;
// getGatedMonsterReaction nulls the row for lack of automation.effect).
// Fix is DATA-only: advisory fields on reactions[0] arm the existing
// MA-1223 AdvisoryLink — reaction rows already ride the same MonsterAction
// row renderer with onAdvisoryRow threaded (MonsterCardBody generic branch).
// ZERO code. Locks: advisory chip present on the Pursuit reaction row, press
// routes onAdvisoryRow never onAttack, "(At Will)" usage renders, and the
// te-channel reaction twins (feather_fall/parry) stay byte-inert on the
// gated chip with NO advisory chip (§37).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const NALFESHNEE = monsters.find((m) => m.index === 'nalfeshnee');
const PURSUIT = NALFESHNEE.reactions[0];
const FEATHER_FALL = monsters.find((m) => m.index === 'aarakocra-aeromancer').reactions[0];
const PARRY = monsters.find((m) => m.index === 'bandit-captain').reactions[0];
const NIGHTMARE = monsters.find((m) => m.index === 'nightmare');
const ETHEREAL_STRIDE = NIGHTMARE.actions[1];

const renderRow = (action, extra = {}) => {
  const onAttack = vi.fn();
  const onAdvisoryRow = vi.fn();
  const onGatedReaction = vi.fn();
  const { container } = render(
    <MonsterAction
      action={action}
      index={0}
      attackerCannotAct={false}
      onAttack={onAttack}
      onDamage={vi.fn()}
      onSaveRoll={vi.fn()}
      onSpellCast={vi.fn()}
      reactionUsesUsed={{}}
      onGatedReaction={onGatedReaction}
      onAdvisoryRow={onAdvisoryRow}
      {...extra}
    />
  );
  return { container, onAttack, onAdvisoryRow, onGatedReaction };
};

describe('MA-1224 disk lock: Pursuit reaction row carries the advisory fields', () => {
  it('advisory:monster_teleport (MA-1223 key) + At Will sentinel on reactions[0]', () => {
    expect(PURSUIT.advisory).toBe('monster_teleport');
    expect(PURSUIT.usage).toBe('At Will');
    expect(PURSUIT.uses).toBe(999);
    expect(PURSUIT.maxUses).toBe(999);
    expect(PURSUIT.automation).toBeUndefined();
  });
});

describe('MA-1224 MonsterAction render: advisory chip arms on the REACTION row', () => {
  it('Pursuit row: advisory chip present, labelled, honest title', () => {
    const { container } = renderRow(PURSUIT);
    const chip = container.querySelector('.mc-dice-link-advisory');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Pursuit');
    expect(chip.getAttribute('title')).toMatch(/move-end producer app-wide/);
    expect(chip.getAttribute('title')).toMatch(/GM-enforced gridless \(CLA-320\)/);
  });

  it('no attack/save/te chips on the inert-by-data row; "(At Will)" usage renders', () => {
    const { container } = renderRow(PURSUIT);
    expect(container.querySelector('.mc-dice-link-advisory')).not.toBe(null);
    expect(Array.from(container.querySelectorAll('.mc-dice-link')).filter((c) => c !== container.querySelector('.mc-dice-link-advisory'))).toHaveLength(0);
    expect(container.textContent).toContain('(At Will)');
  });

  it('advisory chip press routes onAdvisoryRow with the row, never onAttack/onGatedReaction', () => {
    const { container, onAttack, onAdvisoryRow, onGatedReaction } = renderRow(PURSUIT);
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).toHaveBeenCalledTimes(1);
    expect(onAdvisoryRow.mock.calls[0][0]).toBe(PURSUIT);
    expect(onAttack).not.toHaveBeenCalled();
    expect(onGatedReaction).not.toHaveBeenCalled();
  });

  it('incapacitated adviser chip is inert (no click route)', () => {
    const { container, onAdvisoryRow } = renderRow(PURSUIT, { attackerCannotAct: true });
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).not.toHaveBeenCalled();
  });

  it('without a resolver wired the chip is inert (no crash, no route)', () => {
    const { container } = renderRow(PURSUIT, { onAdvisoryRow: undefined });
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
  });
});

describe('MA-1224 byte-inert discipline (§37): te-channel reaction twins unchanged', () => {
  it('Feather Fall reaction keeps ONLY its gated te chip — no advisory chip', () => {
    const { container, onGatedReaction } = renderRow(FEATHER_FALL);
    expect(container.querySelector('.mc-dice-link-advisory')).toBe(null);
    const gated = Array.from(container.querySelectorAll('.mc-dice-link')).find((l) => l.textContent.includes('Feather Fall'));
    expect(gated).toBeTruthy();
    fireEvent.click(gated);
    expect(onGatedReaction).toHaveBeenCalledTimes(1);
  });

  it('Parry reaction keeps ONLY its gated te chip — no advisory chip', () => {
    const { container, onGatedReaction } = renderRow(PARRY);
    expect(container.querySelector('.mc-dice-link-advisory')).toBe(null);
    const gated = Array.from(container.querySelectorAll('.mc-dice-link')).find((l) => l.textContent.includes('Parry'));
    expect(gated).toBeTruthy();
    fireEvent.click(gated);
    expect(onGatedReaction).toHaveBeenCalledTimes(1);
  });
});

describe('MA-1232 MonsterAction render: advisory chip arms on the nightmare Ethereal Stride action row', () => {
  it('advisory chip present labelled "Ethereal Stride", honest title, NO junk "+0" attack chip', () => {
    const { container } = renderRow(ETHEREAL_STRIDE);
    const chip = container.querySelector('.mc-dice-link-advisory');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Ethereal Stride');
    expect(chip.getAttribute('title')).toMatch(/planar travel is GM-enforced/);
    expect(chip.getAttribute('title')).toMatch(/No attack roll, no saving throw, no dice\./);
    expect(Array.from(container.querySelectorAll('.mc-dice-link')).filter((c) => c !== chip)).toHaveLength(0);
  });

  it('advisory chip press routes onAdvisoryRow with the row, never onAttack', () => {
    const { container, onAttack, onAdvisoryRow } = renderRow(ETHEREAL_STRIDE);
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).toHaveBeenCalledTimes(1);
    expect(onAdvisoryRow.mock.calls[0][0]).toBe(ETHEREAL_STRIDE);
    expect(onAttack).not.toHaveBeenCalled();
  });
});
