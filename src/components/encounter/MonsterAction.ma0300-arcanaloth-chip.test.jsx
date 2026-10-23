// @maintained-by-ai
// MA-0300 component lane: the Counterspell reaction rows (REAL monsters.json
// "At Will" + uses:999 sentinel shape) must expose exactly one gated-reaction chip whose
// counter reads maxUses−spends honestly and NEVER marks spent pre-sentinel (RAW-unlimited,
// unlinked to 1/Day). Press truth-table (open/consumed/closed attackerCannotAct #289) is
// owned by MonsterAction.gated-reaction.test.jsx; data shape is data-locked by
// MonsterCardHelpers.ma{0300,0305,1120}-counterspell.test.js — never restated here.
// Trigger identity, round latch and spend arithmetic live in the helper lanes.
// Folded #421-rec: ex-twins MonsterAction.ma0305-arch-hag-chip +
// MonsterAction.ma1120-mage-chip (byte-twins modulo monster/spend tokens;
// retired #422) — one it.each now spans all 3 disk rows here. Chip label/icon
// come from the registry per row (getGatedMonsterReaction keys off
// automation.effect only), so per-monster renders are registry-identical.
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

function renderRow(action, overrides = {}) {
  const onGatedReaction = vi.fn();
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
      onGatedReaction={onGatedReaction}
      {...overrides}
    />
  );
  return { ...utils, onGatedReaction };
}

describe('MA-0300 MonsterAction Counterspell chip — At Will sentinel (3 disk rows)', () => {
  it.each(
    DISK_ROWS.flatMap(({ index, action, def }) => [
      [index, 'fresh row shows the 999 sentinel and the honest "At Will" echo', action, def, {}, '(999 left)'],
      [index, 'partial spends count the sentinel down, never spent-class the chip', action, def, { reactionUsesUsed: { counterspell: 3 } }, '(996 left)'],
    ])
  )('%s %s — one chip, click dispatches the disk row once', (_index, _case, action, def, overrides, counter) => {
    const { onGatedReaction } = renderRow(action, overrides);
    // getByRole single-match pins exactly one press surface (MA-1488 sole-press).
    const chip = screen.getByRole('button', { name: new RegExp(`^${def.label}`) });
    expect(chip.textContent).toContain(counter);
    expect(chip.querySelector(`.${def.icon}`)).toBeTruthy();
    expect(screen.getByText(`(${action.usage})`)).toBeTruthy();
    expect(chip.className.includes('mc-dice-link-spell-spent')).toBe(false);
    fireEvent.click(chip);
    expect(onGatedReaction).toHaveBeenCalledTimes(1);
    expect(onGatedReaction).toHaveBeenCalledWith(action);
  });
});
