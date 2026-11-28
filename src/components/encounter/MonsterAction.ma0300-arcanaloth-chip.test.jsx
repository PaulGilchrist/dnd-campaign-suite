// @maintained-by-ai 2026-11-28
// MA-0300 component lane: the three REAL monsters.json Counterspell reaction rows
// ("At Will" + uses:999 sentinel) must each arm exactly one gated-reaction chip whose
// label is registry-exact and carries NO counter (sentinel → monsterReactionUsesRemaining
// null, improve `at-will-reaction-chip-999`), while the row keeps the honest "(At Will)"
// usage echo and clicking forwards THAT row's action object once.
// Owned elsewhere, never restated: press truth-table (open/consumed/closed
// attackerCannotAct #289) → MonsterAction.gated-reaction.test.jsx; the at-will
// partial-spend non-revival branch (sentinel short-circuits BEFORE the ledger read, so
// per-monster ledger keys add no branch) → MonsterAction.at-will-chip.test.jsx; data
// shape → MonsterCardHelpers.ma{0300,0305,1120}-counterspell.test.js; trigger identity,
// round latch and spend arithmetic → the helper lanes.
// Folded #421-rec: ex-twins MonsterAction.ma0305-arch-hag-chip +
// MonsterAction.ma1120-mage-chip (retired #422) — one it.each spans all 3 disk rows.
// Chip label/icon come from the registry per row (getGatedMonsterReaction keys off
// automation.effect only), so per-monster renders are registry-identical; the sweep's
// unique value is the per-row ARMING wiring + correct-action dispatch.
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import { getGatedMonsterReaction } from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

// The three disk rows, each fetched live from monsters.json (never inlined).
const DISK_ROWS = ['arcanaloth', 'arch-hag', 'mage'].map(index => {
  const action = monsters.find(m => m.index === index).reactions[0];
  // Registry label/icon read verbatim via the same helper the component uses —
  // never hand-authored (#387).
  return { index, action, def: getGatedMonsterReaction(action) };
});

describe('MA-0300 MonsterAction Counterspell chip — At Will sentinel (3 disk rows)', () => {
  it.each(DISK_ROWS)('$index — one counter-free chip, click dispatches the disk row once', ({ action, def }) => {
    const onGatedReaction = vi.fn();
    render(
      <MonsterAction
        action={action}
        index={0}
        attackerCannotAct={false}
        onAttack={vi.fn()}
        onDamage={vi.fn()}
        onSaveRoll={vi.fn()}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={onGatedReaction}
      />
    );
    // getByRole single-match pins exactly one press surface (MA-1488 sole-press);
    // a broken sentinel would print "(999 left)" and trip both the exact-label and
    // no-digit pins here, so the spent/ledger legs need no per-row restatement.
    const chip = screen.getByRole('button', { name: new RegExp(`^${def.label}`) });
    expect(chip.textContent.trim()).toBe(def.label);
    expect(chip.textContent).not.toMatch(/left|\d/);
    expect(chip.querySelector(`.${def.icon}`)).toBeTruthy();
    expect(screen.getByText(`(${action.usage})`)).toBeTruthy();
    expect(chip.className.includes('mc-dice-link-spell-spent')).toBe(false);
    fireEvent.click(chip);
    expect(onGatedReaction).toHaveBeenCalledTimes(1);
    expect(onGatedReaction).toHaveBeenCalledWith(action);
  });
});
