// @maintained-by-ai: 2026-10-18
// MA-1847 fused-2 save lane: Apep "Devour the Boat (Costs 2 Actions)" legendary
// child shipped as a delegates_to:"Constrict" prose row — DC 26 never enforced,
// grapple prerequisite ungated, no-heal clause inert. DATA fix: the row stops
// delegating and authors its own save mechanic (Mind Flayer Tentacle Bite
// grappled-save byte-shape, RAW targets the grappled creature itself — no
// by_attacker/any_ally) + save_target_effect:"no_healing" (MA-1847 sanctioned
// save-lane rider, MA-0016 hit-lane twin). "Costs 2 Actions" stays name-text
// advisory in this lane; the engine spends its parsed RAW cost (MA-1883).
// OWNED HERE: the verbatim disk row (fingerprint+clause) + the MonsterAction
// chip set with the exact onSaveRoll byte payload (identity, count, formula).
// OWNED ELSEWHERE (pruned): spend/refusal/turn-latch + live ctx payload →
// MonsterCardModal.ma1847-devour-the-boat.test.jsx:116-171 (chips-on-card
// :115-120, pre-spend refusal :122-134, spend+save payload :136-159, latch
// :161-173); no_healing grant + choke points → saveProcessing.ma1847-apep-
// devour-no-healing.test.js; evaluateTargetPrerequisiteGate/parseTarget-
// Prerequisite/parseSaveTargetEffect/saveChipPlan direct calls → MA-0019 gate
// family + MA-1000/MA-1867 save-plan owners. Absorption grep: apep is ABSENT
// from HIT_CLAUSE_ROWS (handlePlainDamage.hitClause.test.js:224-282, grep-
// verified) — this save row never rides the hit lane. No timers.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const runtimeStore = {};
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
  setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const APEP = monsters.find((m) => m.index === 'apep');
const BOAT = APEP.legendary_actions.find((a) => a.name === 'Devour the Boat (Costs 2 Actions)');
const DARKNESS = APEP.actions.find((a) => a.name === 'Venomous Darkness (Recharge 5-6)');

describe('MA-1847 Apep Devour the Boat — self-resolving save row', () => {
  it('disk bytes verbatim: DC 26 Constitution, 6d10 Piercing half-on-success, grappled prerequisite, no_healing rider last; delegates_to/attack keys REMOVED (§225 hijack dead); clauseless sibling byte-inert', () => {
    expect(BOAT).toEqual({
      name: 'Devour the Boat (Costs 2 Actions)',
      description:
        "Apep's coils lunge for one Grappled creature. The target must succeed on a DC 26 Constitution saving throw or take 33 (6d10) Piercing damage and be unable to regain Hit Points until the start of Apep's next turn.",
      save_dc: 26,
      save_type: 'Constitution',
      damage_dice_primary: '6d10',
      damage_type_primary: 'Piercing',
      dc_success: 'half',
      target_prerequisite: { conditions: ['grappled'] },
      save_target_effect: 'no_healing',
    });
    // Key ORDER pinned (MA-1547 placement: structured keys after description,
    // rider last) and the exact set proves delegates_to/attack_bonus/reach
    // are gone and no numeric was fabricated.
    expect(Object.keys(BOAT)).toEqual([
      'name',
      'description',
      'save_dc',
      'save_type',
      'damage_dice_primary',
      'damage_type_primary',
      'dc_success',
      'target_prerequisite',
      'save_target_effect',
    ]);
    expect(DARKNESS.save_target_effect).toBeUndefined();
  });

  it('renders exactly TWO chips — "6d10" + "DC 26 Constitution" (no Expend chip, MA-1842/MA-1071 self-suppress) — and the DC chip dispatches onSaveRoll(BOAT, "6d10", [])', () => {
    const onSaveRoll = vi.fn();
    const { container } = render(
      <MonsterAction
        action={BOAT}
        index={0}
        attackerCannotAct={false}
        onAttack={vi.fn()}
        onDamage={vi.fn()}
        onSaveRoll={onSaveRoll}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
        legendaryGate={vi.fn()}
      />
    );
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['6d10', 'DC 26 Constitution']);
    const saveChips = container.querySelectorAll('.mc-dice-link-save-clickable');
    expect(saveChips).toHaveLength(1);
    fireEvent.click(saveChips[0]);
    expect(onSaveRoll).toHaveBeenCalledTimes(1);
    expect(onSaveRoll).toHaveBeenCalledWith(BOAT, '6d10', []);
    expect(onSaveRoll.mock.calls[0][0]).toBe(BOAT);
  });
});
