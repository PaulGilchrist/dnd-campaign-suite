// @maintained-by-ai
// MA-1400: Roper "Tentacle" — prose carries "Hit: The target has the
// Grappled condition (escape DC 14) … and the target has the Poisoned
// condition until the grapple ends" but the row shipped WITHOUT
// hit_conditions/escape_dc, so the rider was inert (buildHitConditionClause
// reads hit_conditions/escape_dc keys only, NEVER description). Two-field
// DATA fix (MA-1274 otyugh / MA-0010 byte-shape, escape_dc 14 = exact
// aberrant-cultist/chain-devil DC-14 co-key). UNIQUE to this row: it
// authors ZERO damage — buildAutoDamageOptions (MonsterCardModal.jsx:1167)
// must arm a dice-less constant '0' ONLY when a hit-clause stands without a
// formula (MA-0322 flat lineage), else the damageless row never reaches
// handlePlainDamage.maybeApplyHitClause (all 76 pre-fix hit_conditions rows
// carry damage dice — the seam was never proven damageless). roper is NOT in
// handlePlainDamage.hitClause HIT_CLAUSE_ROWS :224-282 (grep-verified), so
// THIS file is the sole byte-owner: fused test 1 locks disk row keys BY NAME
// in transport order + exact bytes (exact toEqual absorbs name/reach/
// attack_bonus, the zero-damage key absence, save-decoy 0/"" and
// hit_target_effect absence), then the "+7" chip press delivers that exact
// row through onAttack (identity — payload IS the disk object,
// MonsterAction.jsx:480 passthrough). Fused test 2 owns the dispatch arm the
// consumer file delegates here (handlePlainDamage.ma1400-roper-tentacle-zero
// -damage.test.js:12-13): opts ride '0' + exact clause; byte-inert guard's
// false branch twin ma1402:72-81, consumer zero-tolerance consumer-owned
// there, generic clause arm/suppression census hitClause.test.js:284+/
// ma0286:95-121 — no local buildHitConditionClause/attackRowMissingToHit
// re-derivation (per-census #419, cf. ma1357/1389/1397); Bite verbatim
// dice formula owned MA-0322-lineage ma0747:70.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildAutoDamageOptions } from './MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const ROPER = monsters.find((m) => m.index === 'roper');
const TENTACLE = ROPER.actions[2];

const TENTACLE_EXACT = {
  name: 'Tentacle',
  description: 'Melee Attack Roll: +7, reach 60 ft. Hit: The target has the <strong>Grappled</strong> condition (escape DC 14) from one of six tentacles, and the target has the <strong>Poisoned</strong> condition until the grapple ends. The tentacle can be damaged, freeing a creature it has Grappled when destroyed (AC 20, HP 10, Immunity to Poison and Psychic damage). Damaging the tentacle deals no damage to the roper, and a destroyed tentacle regrows at the start of the roper\'s next turn.',
  attack_bonus: 7,
  save_dc: 0,
  save_type: '',
  save_effect: '',
  range: '',
  reach: '60 ft.',
  recharge: '',
  hit_conditions: ['grappled', 'poisoned'],
  escape_dc: 14,
};

describe('MA-1400 disk fingerprint: roper Tentacle grapple+poison rider fix', () => {
  it('sole-owner row fingerprint + live "+7" chip presses exact row through onAttack', () => {
    // Byte-shape: keys BY NAME in transport order, hit_conditions + escape_dc
    // sit immediately after recharge (MA-0010 trailing byte-shape); NO
    // damage_* keys authored (zero-damage row), no save/hit_target_effect leg.
    expect(Object.keys(TENTACLE)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'save_dc',
      'save_type',
      'save_effect',
      'range',
      'reach',
      'recharge',
      'hit_conditions',
      'escape_dc',
    ]);
    // Exact bytes: any drifted numeric, save decoy, prose DC, or added/
    // dropped key breaks this one assertion (absorbs field-absence checks).
    expect(TENTACLE).toEqual(TENTACLE_EXACT);

    // Chip-level dispatch: exactly one "+7" attack chip (no damage chip —
    // zero damage authored; no DC chip — save decoys stay 0/""), press
    // routes name/bonus/row once.
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TENTACLE}
        index={2}
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
    expect(chips).toEqual(['+7']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Tentacle', 7, TENTACLE_EXACT);
    // Identity: the payload IS the disk row — hit_conditions/escape_dc bytes
    // ride the attack lane untouched (no copy/strip) into the clause consumer.
    expect(onAttack.mock.calls[0][2]).toBe(TENTACLE);
  });

  it('MA-1400 dispatch arm: damageless clause row rides dice-less "0" so the resolved hit reaches maybeApplyHitClause', () => {
    const opts = buildAutoDamageOptions(TENTACLE, 'Tentacle');
    expect(opts.autoDamageFormula).toBe('0');
    // Exact clause (buildHitConditionClause re-derivation inside
    // MonsterCardModal.jsx:1156 absorbs the former standalone call).
    expect(opts.hitClause).toEqual({
      conditions: ['grappled', 'poisoned'],
      escapeDc: 14,
      attackName: 'Tentacle',
      targetEffect: null,
    });
    // Byte-inert guard (the || arm's false branch): damageless row WITHOUT a
    // clause stays null — zero affordance unchanged.
    expect(buildAutoDamageOptions(ROPER.actions[3], 'Reel').autoDamageFormula).toBeNull();
  });
});
