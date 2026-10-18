// @maintained-by-ai
// MA-0882 component lane: GrantReactionLink chip in MonsterAction.jsx — automation
// {type:"monster_grant_reaction", effect:"incite_rampage", range_ft:60} (Gnoll Pack
// Lord "Incite Rampage") arms a clickable .mc-dice-link-grantreaction role=button
// routing to the modal's onGrantReactionRow seam. This file owns PRESS ROUTING ONLY:
// open arm → exactly-once dispatch of the exact authored row; closed arms (incapacitated
// attacker, missing handler seam) → chip renders, zero dispatch (#417 closed-gate canon
// — the source keeps the span with onClick undefined); spent recharge on the live
// MA-0031 monsterRecharge map → mc-dice-link-spell-spent class but spent≠disabled,
// the click still routes the honest "Not Recharged" refusal once (MA-0031/MA-0648
// precedent — refusal adjudication lives in the resolver). Gate COMPUTATION and the
// spend/te/clock/refusal economy are owned by monsterGrantReaction.test.js and the
// MonsterCardHelpers recharge/gated-reaction helper lanes — never restated here.
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import monsters from '../../../public/data/monsters.json';

const PACK_LORD = monsters.find(m => m.index === 'gnoll-pack-lord');
const INCITE_ROW = PACK_LORD.actions.find(a => a.name === 'Incite Rampage');

// Fresh vi.fn() seam per render (#362); omitHandler drops the grant seam entirely
// to exercise the handlerless closed arm without a vacuous no-op assertion.
function renderGrantRow({ action = INCITE_ROW, attackerCannotAct = false, rechargeState = {}, handler = vi.fn(), omitHandler = false } = {}) {
  const onGrantReactionRow = omitHandler ? undefined : handler;
  const utils = render(
    <MonsterAction
      action={action}
      index={0}
      attackerCannotAct={attackerCannotAct}
      onAttack={vi.fn()}
      onDamage={vi.fn()}
      onSaveRoll={vi.fn()}
      onSpellCast={vi.fn()}
      reactionUsesUsed={{}}
      onGatedReaction={vi.fn()}
      rechargeState={rechargeState}
      onGrantReactionRow={onGrantReactionRow}
    />
  );
  return { ...utils, onGrantReactionRow };
}

describe('MA-0882 Incite Rampage grant-reaction chip (MonsterAction press lane)', () => {
  it('open arm press: one dispatch of the exact row, chip armed unspent with data-verbatim title', () => {
    const { onGrantReactionRow } = renderGrantRow();
    const chip = screen.getByRole('button', { name: /Incite/ });
    expect(chip.className).toContain('mc-dice-link-grantreaction');
    expect(chip.className).not.toContain('mc-dice-link-spell-spent');
    // Title strings read verbatim off the authored monsters.json row (#387).
    expect(chip.getAttribute('title')).toContain(INCITE_ROW.automation.effect);
    expect(chip.getAttribute('title')).toContain(`${INCITE_ROW.automation.range_ft} ft`);
    expect(chip.getAttribute('title')).toContain(`Recharge ${INCITE_ROW.recharge}`);
    fireEvent.click(chip);
    expect(onGrantReactionRow).toHaveBeenCalledTimes(1);
    expect(onGrantReactionRow.mock.calls[0][0]).toBe(INCITE_ROW);
  });

  it('spent recharge: spent class armed but spent≠disabled — click still routes refusal once', () => {
    const { onGrantReactionRow } = renderGrantRow({ rechargeState: { [INCITE_ROW.name]: { recharged: false, threshold: 5 } } });
    const chip = screen.getByRole('button', { name: /Incite/ });
    expect(chip.className).toContain('mc-dice-link-spell-spent');
    fireEvent.click(chip);
    expect(onGrantReactionRow).toHaveBeenCalledTimes(1);
    expect(onGrantReactionRow.mock.calls[0][0]).toBe(INCITE_ROW);
  });

  it('closed arm (incapacitated attacker): chip renders but zero dispatch', () => {
    const { onGrantReactionRow } = renderGrantRow({ attackerCannotAct: true });
    const chip = screen.getByRole('button', { name: /Incite/ });
    fireEvent.click(chip);
    expect(onGrantReactionRow).not.toHaveBeenCalled();
  });

  it('closed arm (missing handler seam): chip renders, click never throws', () => {
    const { getByRole } = renderGrantRow({ omitHandler: true });
    expect(() => fireEvent.click(getByRole('button', { name: /Incite/ }))).not.toThrow();
  });

  it('non-grant rows arm zero grant-reaction affordance (Bone Whip)', () => {
    const whip = PACK_LORD.actions.find(a => a.name === 'Bone Whip');
    const { container } = renderGrantRow({ action: whip });
    expect(container.querySelector('.mc-dice-link-grantreaction')).toBeNull();
  });
});
