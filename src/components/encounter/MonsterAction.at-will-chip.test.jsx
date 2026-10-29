// @maintained-by-ai
// Backlog improve `at-will-reaction-chip-999`: an At Will reaction authored with
// the uses/maxUses:999 sentinel (Goblin Boss "Redirect Attack" — live repro of the
// chip that printed "(999 left)") renders its gated-reaction chip WITHOUT any
// "(N left)" counter — monsterReactionUsesRemaining returns null via the
// centralized isAtWillUsesLimit helper and GatedReactionLink hides the em at
// null. The row keeps its honest "(At Will)" usage echo. The real-limit leg
// (githzerai-monk "Psionic Defense" 2/Day disk row) keeps printing its live
// counter and decrements after spends — the usage-economy display is unchanged
// for genuine limits. Sentinel arithmetic pins for the helper lane live at
// services/encounters/monsterAbilityUses.at-will-sentinel.test.js; press
// truth-tables stay at MonsterAction.gated-reaction.test.jsx.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import { getGatedMonsterReaction } from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

// Disk rows fetched live (never inlined): the ticket's offender + a real-limit sibling.
const REDIRECT_ROW = monsters.find(m => m.index === 'goblin-boss').reactions.find(a => a.name === 'Redirect Attack');
const LIMITED_ROW = monsters.find(m => m.index === 'githzerai-monk').reactions[0];

function renderRow(action, overrides = {}) {
  return render(
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
      {...overrides}
    />
  );
}

describe('at-will reaction chip — 999 sentinel prints no counter', () => {
  it('Goblin Boss Redirect Attack (uses:999) chip reads bare "Redirect Attack" — no raw 999, no "(N left)"', () => {
    expect(REDIRECT_ROW).toMatchObject({ usage: 'At Will', uses: 999, maxUses: 999 });
    const def = getGatedMonsterReaction(REDIRECT_ROW);
    expect(def?.label).toBe('Redirect Attack');
    renderRow(REDIRECT_ROW);
    const chip = screen.getByRole('button', { name: /^Redirect Attack/ });
    expect(chip.textContent.trim()).toBe('Redirect Attack');
    expect(chip.textContent).not.toMatch(/999|left|\(/);
    // The row-level honest usage echo stays (outside the chip label).
    expect(screen.getByText('(At Will)')).toBeTruthy();
  });

  it('at-will partial spend never revives a counter or the spent class', () => {
    renderRow(REDIRECT_ROW, { reactionUsesUsed: { redirect_attack: 3 } });
    const chip = screen.getByRole('button', { name: /^Redirect Attack/ });
    expect(chip.textContent.trim()).toBe('Redirect Attack');
    expect(chip.className.includes('mc-dice-link-spell-spent')).toBe(false);
  });
});

describe('at-will reaction chip — real limits keep their counter', () => {
  it('githzerai-monk Psionic Defense (uses:2) prints "(2 left)" fresh', () => {
    expect(LIMITED_ROW).toMatchObject({ uses: 2, maxUses: 2 });
    renderRow(LIMITED_ROW);
    const chip = screen.getByRole('button', { name: /^Feather Fall/ });
    expect(chip.textContent).toContain('(2 left)');
    expect(chip.className.includes('mc-dice-link-spell-spent')).toBe(false);
  });

  it('counter decrements after spends and marks spent at 0', () => {
    const { rerender } = renderRow(LIMITED_ROW);
    rerender(
      <MonsterAction
        action={LIMITED_ROW}
        index={0}
        attackerCannotAct={false}
        onAttack={vi.fn()}
        onDamage={vi.fn()}
        onSaveRoll={vi.fn()}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{ feather_fall: 1 }}
        onGatedReaction={vi.fn()}
      />
    );
    const chip = screen.getByRole('button', { name: /^Feather Fall/ });
    expect(chip.textContent).toContain('(1 left)');
    expect(chip.className.includes('mc-dice-link-spell-spent')).toBe(false);
  });
});
