// @maintained-by-ai: 2026-10-18
// MA-1450: Seahorse "Bubble Dash" advisory chip lane in MonsterAction.jsx.
// Pre-fix disk row carried junk attack_bonus:0 → a clickable "+0" mc-dice-link
// routed a bogus to-hit. Fix was DATA-only with the FAMILY'S DISTINCT shape:
// attack_bonus key REMOVED entirely (Imp precedent, key-absent-not-null —
// nalfeshnee Teleport twin instead carries attack_bonus:null), while the
// save_dc:0/save_type:"" household noise stays on disk.
// OWNERSHIP (per #467 canon): disk row BY NAME "Bubble Dash" shape
// (key-absent attack_bonus, kept save_dc:0/save_type:"" noise, advisory/
// advisory_message copy) + isMonsterActionAdvisoryRow predicate + popup/log/
// resolver record-only contract are owned by services/encounters/
// monsterActionAdvisory.ma1450-seahorse-bubble-dash.test.js :26-115
// (general seam: monsterActionAdvisory.test.js :27-108); the full-card modal
// press seam is owned by the MonsterCardModal ma1450 twin. AdvisoryLink press
// pattern + both inert lanes on an attack_bonus:null row are owned by the
// MA-1223 twin MonsterAction.ma1223-nalfeshnee-teleport-advisory-chip.test
// .jsx :54-78; reaction-category fork by MA-1224 twin; legendaryGate
// suppression by the MA-1223 twin :90-101 — never restated here.
// This file locks ONLY the distinct MA-1450 fork (the #419-cited "ma1450
// chip lanes"): a KEY-ABSENT advisory row (plus save_dc:0 save-chip noise)
// arms exactly ONE mc-dice-link-advisory chip with component chrome title
// "Advisory — Bubble Dash:" and byte-suppresses every junk attack/save/+0
// sibling, press routing the row verbatim — plus both inert lanes on this
// key-absent shape.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SEAHORSE = monsters.find((m) => m.index === 'seahorse');
const BUBBLE_DASH = SEAHORSE.actions[0];

const renderRow = (action, extra = {}) => {
  const onAttack = vi.fn();
  const onAdvisoryRow = vi.fn();
  const onSaveRoll = vi.fn();
  const onDamage = vi.fn();
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
      onAdvisoryRow={onAdvisoryRow}
      {...extra}
    />
  );
  return { container, onAttack, onAdvisoryRow, onSaveRoll, onDamage };
};

describe('MA-1450 MonsterAction: key-absent advisory row suppresses junk chips, arms one advisory lane', () => {
  it('Bubble Dash row (attack_bonus key ABSENT, save_dc:0/save_type:"" disk noise): exactly ONE chip — advisory, chrome title, no "+0"/save sibling; press routes onAdvisoryRow with the row, never attack/save/damage legs', () => {
    const { container, onAttack, onAdvisoryRow, onSaveRoll, onDamage } = renderRow(BUBBLE_DASH);
    const chip = container.querySelector('.mc-dice-link-advisory');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Bubble Dash');
    expect(chip.getAttribute('title')).toMatch(/^Advisory — Bubble Dash:/);
    // key-absent attack_bonus AND save_dc:0 noise must NOT admit any junk
    // affordance — the advisory chip is the ONLY mc-dice-link on the row.
    expect(container.querySelectorAll('.mc-dice-link')).toHaveLength(1);
    expect(container.textContent).not.toContain('+0');
    fireEvent.click(chip);
    expect(onAdvisoryRow).toHaveBeenCalledTimes(1);
    expect(onAdvisoryRow.mock.calls[0][0]).toBe(BUBBLE_DASH);
    expect(onAttack).not.toHaveBeenCalled();
    expect(onSaveRoll).not.toHaveBeenCalled();
    expect(onDamage).not.toHaveBeenCalled();
  });

  it('chip is inert on this key-absent shape when the adviser cannot act, and inert (no crash) with no resolver wired', () => {
    const { container, onAdvisoryRow } = renderRow(BUBBLE_DASH, { attackerCannotAct: true });
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).not.toHaveBeenCalled();
    const bare = renderRow(BUBBLE_DASH, { onAdvisoryRow: undefined });
    fireEvent.click(bare.container.querySelector('.mc-dice-link-advisory'));
  });
});
