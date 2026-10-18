// @maintained-by-ai
// MA-0300 component lane: the arcanaloth Counterspell reaction row (REAL monsters.json
// "At Will" + uses:999 sentinel shape) must expose exactly one gated-reaction chip whose
// counter reads maxUses−spends honestly and NEVER marks spent pre-sentinel (RAW-unlimited,
// unlinked to 1/Day). Press truth-table (open/consumed/closed attackerCannotAct #289) is
// owned by MonsterAction.gated-reaction.test.jsx; data shape is data-locked by
// MonsterCardHelpers.ma0300-arcanaloth-counterspell.test.js — never restated here.
// Trigger identity, round latch and spend arithmetic live in the helper lanes.
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import { getGatedMonsterReaction } from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const ARCANA_ACTION = monsters.find(m => m.index === 'arcanaloth').reactions[0];

// Registry label/icon read verbatim via the same helper the component uses — never
// hand-authored (#387).
const def = getGatedMonsterReaction(ARCANA_ACTION);

function renderRow(overrides = {}) {
  const onGatedReaction = vi.fn();
  const utils = render(
    <MonsterAction
      action={ARCANA_ACTION}
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

describe('MA-0300 MonsterAction arcanaloth Counterspell chip — At Will sentinel', () => {
  it.each([
    ['fresh row shows the 999 sentinel and the honest "At Will" echo', {}, '(999 left)'],
    ['partial spends count the sentinel down, never spent-class the chip', { reactionUsesUsed: { counterspell: 3 } }, '(996 left)'],
  ])('%s — one chip, click dispatches the disk row once', (_case, overrides, counter) => {
    const { onGatedReaction } = renderRow(overrides);
    // getByRole single-match pins exactly one press surface (MA-1488 sole-press).
    const chip = screen.getByRole('button', { name: new RegExp(`^${def.label}`) });
    expect(chip.textContent).toContain(counter);
    expect(chip.querySelector(`.${def.icon}`)).toBeTruthy();
    expect(screen.getByText(`(${ARCANA_ACTION.usage})`)).toBeTruthy();
    expect(chip.className.includes('mc-dice-link-spell-spent')).toBe(false);
    fireEvent.click(chip);
    expect(onGatedReaction).toHaveBeenCalledTimes(1);
    expect(onGatedReaction).toHaveBeenCalledWith(ARCANA_ACTION);
  });
});
