// @maintained-by-ai: 2026-10-18
// MA-1224: Nalfeshnee "Pursuit" reaction row — formerly prose-only with
// ZERO affordance (live fingerprint 2026-09-25: Reactions census 0 chips;
// getGatedMonsterReaction nulls the row for lack of automation.effect).
// Fix is DATA-only: advisory fields on reactions[0] arm the existing
// MA-1223 AdvisoryLink — reaction rows already ride the same MonsterAction
// row renderer with onAdvisoryRow threaded (MonsterCardBody generic branch).
// ZERO code. Advisory = §70 record-only: no condition stamps, no clocks.
// OWNERSHIP (per #467 canon): Pursuit disk row shape + isMonsterAction
// AdvisoryRow predicate + popup/log/resolver record-only contract are owned
// by services/encounters/monsterActionAdvisory.ma1224-nalfeshnee-pursuit
// .test.js :28-115; the full-card modal press seam (popup + ONE ability_use,
// zero rolls, refire) is owned by MonsterCardModal.ma1224-nalfeshnee-pursuit
// -advisory.test.jsx :92-139; AdvisoryLink press-pattern + both inert lanes
// (attackerCannotAct / no resolver) are owned by this component's MA-1223
// twin MonsterAction.ma1223-nalfeshnee-teleport-advisory-chip.test.jsx
// :54-78 (never restated here — the renderer path is row-independent,
// MonsterAction.jsx :360-368); te-channel gated press truth-table is owned
// by MonsterAction.gated-reaction.test.jsx :47-71 and the §37 detector-level
// twin inertness by the service ma1224 file :67-72; the MA-1232 nightmare
// Ethereal Stride pattern restatement is dropped (service owner :111-147).
// This file locks ONLY the DISTINCT MA-1224 lane: the advisory chip arming
// on the REACTION-category row (first-ever reaction-category advisory —
// no attack/save/dice siblings, "(At Will)" sentinel renders) and press
// payload identity with the gated-reaction lane fork (the row dispatches to
// onAdvisoryRow verbatim, never to onAttack/onGatedReaction).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const NALFESHNEE = monsters.find((m) => m.index === 'nalfeshnee');
const PURSUIT = NALFESHNEE.reactions.find((r) => r.name === 'Pursuit');

const renderRow = (extra = {}) => {
  const onAttack = vi.fn();
  const onAdvisoryRow = vi.fn();
  const onGatedReaction = vi.fn();
  const { container } = render(
    <MonsterAction
      action={PURSUIT}
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

describe('MA-1224 MonsterAction: advisory chip arms on the REACTION row, gated lane forked off', () => {
  it('Pursuit row: exactly ONE chip — labelled advisory, honest title, no gated/attack/save sibling; "(At Will)" usage renders', () => {
    const { container } = renderRow();
    const chip = container.querySelector('.mc-dice-link-advisory');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Pursuit');
    expect(chip.getAttribute('title')).toMatch(/GM-enforced gridless \(CLA-320\)/);
    // automation-less reaction row: the gated te chip never renders — the
    // advisory chip is the ONLY mc-dice-link on the row (§37 fork).
    expect(container.querySelectorAll('.mc-dice-link')).toHaveLength(1);
    expect(container.textContent).toContain('(At Will)');
  });

  it('press routes onAdvisoryRow with the row verbatim, never onAttack/onGatedReaction', () => {
    const { container, onAttack, onAdvisoryRow, onGatedReaction } = renderRow();
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).toHaveBeenCalledTimes(1);
    expect(onAdvisoryRow.mock.calls[0][0]).toBe(PURSUIT);
    expect(onAttack).not.toHaveBeenCalled();
    expect(onGatedReaction).not.toHaveBeenCalled();
  });
});
