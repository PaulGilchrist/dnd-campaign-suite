// @maintained-by-ai
// MA-0791: Giant Axe Beak "Talons" — prose carries "If the target is a
// Large or smaller creature, it has the Prone condition" but the row shipped
// WITHOUT hit_conditions, so the condition rider was structurally inert
// (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions with isLargeOrSmallerTarget
// gate). One-field DATA fix: hit_conditions:["prone"] (MA-0621/MA-0756/
// MA-0775 byte-shape, placed after damage_type_primary). Sole lock (canon
// #425 self-own: giant-axe-beak is absent from the
// handlePlainDamage.hitClause.test.js HIT_CLAUSE_ROWS table :224-282 —
// unique leg here is the TWO-WEAPON Multiattack distinction: Sharpened Beak
// and Talons share "+8", only their row bytes separate them, so both
// weapon rows get full Object.keys fingerprints + per-chip exact payloads).
// Pruned (owners, all green): clause-output re-derivation (generic arms/
// empties handlePlainDamage.hitClause.test.js:183-216 + data-lock arm via
// the same helper :284-301; identical ['prone']/escapeDc-null clause from a
// hit_conditions row owned by mega-lane twins ankylosaurus/Tail :228 and
// winter-wolf/Bite :280 — row INPUT byte-pinned here); attackRowMissingToHit
// false (this row ESCAPES the MA-0286 suppression census — attack_bonus
// != null rows skipped at ma0286:109; armed-bonus-stays-live truth-table arm
// owned :93, exact-payload precedent :74-86; derives from attack_bonus:8
// byte-pinned below); 3-arg onAttack dispatch shape (#420 canon;
// MonsterAction.jsx:480 onAttack(name, bonus, row)); consumer prone grant +
// size gate (handlePlainDamage.hitClause.test.js:304+ resolveHit arm,
// generic over clause rows). No timers 🔴.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const AXE_BEAK = monsters.find((m) => m.index === 'giant-axe-beak');
const TALONS = AXE_BEAK.actions.find((a) => a.name === 'Talons');
const BEAK = AXE_BEAK.actions.find((a) => a.name === 'Sharpened Beak');

describe('MA-0791 giant-axe-beak Talons hit_conditions fix', () => {
  it('disk byte-shape: Talons carries hit_conditions ["prone"] after damage_type_primary; Sharpened Beak twin stays rider-free (two-weapon Multiattack distinction)', () => {
    // Both +8 weapons come from one Multiattack — the two full key lists
    // (hit_conditions ONLY on Talons) are the row-distinction byte-lock.
    expect(AXE_BEAK.actions.map((a) => a.name)).toEqual(['Multiattack', 'Sharpened Beak', 'Talons']);
    expect(Object.keys(TALONS)).toEqual([
      'name', 'description', 'attack_bonus', 'reach', 'damage_dice_primary', 'damage_type_primary',
      'hit_conditions',
    ]);
    expect(TALONS.attack_bonus).toBe(8);
    expect(TALONS.reach).toBe('5 ft.');
    expect(TALONS.damage_dice_primary).toBe('2d8 + 5');
    expect(TALONS.damage_type_primary).toBe('Piercing');
    expect(TALONS.hit_conditions).toEqual(['prone']);
    expect(TALONS.description).toContain('<strong>Prone</strong>');

    expect(Object.keys(BEAK)).toEqual([
      'name', 'description', 'attack_bonus', 'reach', 'damage_dice_primary', 'damage_type_primary',
    ]);
    expect(BEAK.attack_bonus).toBe(8);
    expect(BEAK.reach).toBe('10 ft.');
    expect(BEAK.damage_dice_primary).toBe('2d12 + 5');
    expect(BEAK.damage_type_primary).toBe('Slashing');
  });

  it.each([
    ['Talons', TALONS, 2],
    ['Sharpened Beak', BEAK, 1],
  ])('%s: one "+8" chip dispatches the exact row, rider fields intact', (_leg, row, index) => {
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={row}
        index={index}
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
    // Exact-row payload carries hit_conditions (or their absence) to the attack seam.
    expect(onAttack).toHaveBeenCalledWith(row.name, 8, row);
  });
});
