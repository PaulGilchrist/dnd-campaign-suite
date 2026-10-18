// @maintained-by-ai
// MA-0909: Graveyard Revenant "Suffocate" grapple-rider fix — row shipped
// WITHOUT hit_conditions/escape_dc (prose carries "Grappled condition (escape
// DC 15)"), so the rider was structurally inert. Two-field DATA fix mirroring
// the MA-0801/MA-0812 byte-shape: hit_conditions:["grappled"] + escape_dc:15
// placed after damage_type_secondary.
// ABSORPTION: handlePlainDamage.hitClause.test.js:183-334 owns the generic
// buildHitConditionClause arm shapes (incl. grappled+escapeDc escapeDc threading)
// and the resolveHit grant lane — but graveyard-revenant is NOT in its
// HIT_CLAUSE_ROWS table (:224-282) and grep 'graveyard-revenant|suffocate'
// across tests lands only here → unowned row, so disk bytes stay here verbatim
// BY NAME (Object.keys exact + toEqual exact bytes, which subsumes the retired
// no-save-fields and key-placement indexOf legs). Helper-direct-call legs
// (buildHitConditionClause, attackRowMissingToHit) are settled prunings.
// Suffocating tick, two-target cap, grappler-death release are §70 advisory
// residuals (§69/MA-0287/0288/0354 precedent) — single grappled grant is the
// ceiling. UNIQUE delta: chip set + exact-row payload + toBe identity + call
// count for this row's onAttack dispatch, owned solely by this file.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SUFFOCATE = monsters
  .find((m) => m.index === 'graveyard-revenant')
  .actions.find((a) => a.name === 'Suffocate');

describe('MA-0909 graveyard-revenant Suffocate — verbatim disk row + component chip dispatch', () => {
  it('disk row is byte-exact with hit_conditions ["grappled"] + escape_dc 15 after damage_type_secondary, and renders one live "+8" chip dispatching onAttack with the exact disk row', () => {
    expect(Object.keys(SUFFOCATE)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'reach',
      'damage_dice_primary',
      'damage_type_primary',
      'damage_dice_secondary',
      'damage_type_secondary',
      'hit_conditions',
      'escape_dc',
    ]);
    expect(SUFFOCATE).toEqual({
      name: 'Suffocate',
      description: 'Melee Attack Roll: +8, reach 10 ft. Hit: 10 (1d10 + 5) Bludgeoning damage plus 10 (3d6) Necrotic damage. If the target is a Large or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 15). Until the grapple ends, the target is <strong>suffocating</strong>. The revenant can have up to two targets Grappled in this way at a time.',
      attack_bonus: 8,
      reach: '10 ft.',
      damage_dice_primary: '1d10 + 5',
      damage_type_primary: 'Bludgeoning',
      damage_dice_secondary: '3d6',
      damage_type_secondary: 'Necrotic',
      hit_conditions: ['grappled'],
      escape_dc: 15,
    });
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={SUFFOCATE}
        index={1}
        attackerCannotAct={false}
        onAttack={onAttack}
        onDamage={vi.fn()}
        onSaveRoll={vi.fn()}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
      />
    );
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['+8']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Suffocate', 8, SUFFOCATE);
    expect(onAttack.mock.calls[0][2]).toBe(SUFFOCATE);
  });
});
