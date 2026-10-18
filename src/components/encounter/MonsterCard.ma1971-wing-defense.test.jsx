// @maintained-by-ai
// MA-1971: Quetzalcoatl "Wing Defense" reactions[0] — DATA-fix lane (disk is
// unique to this row; no sibling lane touches it). Defect 2 FIX (shipped):
// dc_success:"none" — RAW "succeed … or take 7 (2d6) Thunder damage" ⇒
// success = ZERO damage; without the field the app-wide 'half' default
// (buildSaveOptions MonsterCardModal.jsx:1332) half-leaked on save-success.
// Transport semantics owners (dc_success honored / half default):
// MonsterCardModal.whirlwind-zone.test.jsx:72,
// MonsterCardModal.secondary-save-transport.test.js:159,
// MonsterCardModal.banish-success-damage.test.jsx:212 (Magical Backlash twin).
// Sole-press render owner: MonsterAction.ma0300-arcanaloth-chip.test.jsx:46.
// ADJUDICATION (automation deliberately NOT authored): the brief's parry
// byte-shape {effect:'parry', acBonus:5} is a proven NET REGRESSION here —
// MA-1488 sole-press (MonsterAction.jsx:416) would DELETE the live DC 25
// save chip, and parryIdentityRefusal (:1739) refuses the only RAW-legal
// trigger (ranged → 'melee'; ranged refusal already owned by
// MonsterCardHelpers.ma1203-mummy-lord-whirlwind.test.js:188/:255). MA-1843
// forbids flat advisory on save-chip rows. The +5 AC rider stays GM-enforced
// — the RAW text renders verbatim on the card press surface. A future
// wing_defense gated lane (ranged pending-window gate + inline attacker save,
// spell_reflection shape) is the only non-regressive automation.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import monsters from '../../../public/data/monsters.json';
import { MonsterAction } from './MonsterAction.jsx';
import { buildSaveOptions } from './MonsterCardModal.jsx';
import { getGatedMonsterReaction } from './MonsterCardHelpers.js';

const ROW = monsters.find((m) => m.index === 'quetzalcoatl').reactions.find((r) => r.name === 'Wing Defense');

describe('MA-1971 Quetzalcoatl Wing Defense: RAW row verbatim, adjudication pinned', () => {
  it('disk reactions Wing Defense is the exact RAW block — dc_success "none" authored, NO automation/advisory/usage (never gated)', () => {
    expect(ROW).toEqual({
      name: 'Wing Defense',
      trigger: 'When it is targeted by a ranged weapon attack.',
      description: 'It flares its feathered wings and gains +5 to AC against the attack, and the attacker must succeed on a DC 25 Dexterity saving throw or take 7 (2d6) Thunder damage.',
      save_dc: 25,
      save_type: 'Dexterity',
      dc_success: 'none',
      damage_dice_primary: '2d6',
      damage_type_primary: 'Thunder',
    });
    expect(getGatedMonsterReaction(ROW)).toBeNull();
  });

  it('row renders the LIVE clickable DC 25 Dexterity chip; press routes onSaveRoll with formula 2d6; no advisory affordance; save transport carries dcSuccess "none" (half-default counterfactual)', () => {
    const onSaveRoll = vi.fn();
    const { container } = render(
      <MonsterAction
        action={ROW}
        index={0}
        attackerCannotAct={false}
        onAttack={vi.fn()}
        onDamage={vi.fn()}
        onSaveRoll={onSaveRoll}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
      />
    );
    const dcChip = container.querySelector('.mc-dice-link-save-clickable');
    expect(dcChip.textContent).toBe('DC 25 Dexterity');
    expect(container.querySelector('.mc-dice-link-advisory')).toBe(null);
    fireEvent.click(dcChip);
    expect(onSaveRoll).toHaveBeenCalledTimes(1);
    expect(onSaveRoll.mock.calls[0][0]).toBe(ROW);
    expect(onSaveRoll.mock.calls[0][1]).toBe('2d6');
    expect(buildSaveOptions(ROW).dcSuccess).toBe('none');
    // counterfactual: an identical row WITHOUT the authored field still
    // half-defaults — "none" is the authored override, not a changed default.
    expect(buildSaveOptions({ save_dc: 25, save_type: 'Dexterity' }).dcSuccess).toBe('half');
  });
});
