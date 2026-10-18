// @maintained-by-ai
// MA-0927: Grell "Paralyzing Tentacles" three-field fix — disk prose governs
// (save_dc:11 = CON save DC; escape_dc:12 = GRAPPLE escape, ticket's "12" is
// the escape half). save_dc/save_type before save_effect (MA-0860/0918 byte-
// shape), hit_conditions ["grappled"] + escape_dc after save_effect (MA-0801/
// 0812 byte-shape). Row NOT absorbed: grep 'grell' hits no HIT_CLAUSE_ROWS
// entry (handlePlainDamage.hitClause.test.js:224-282) — disk bytes + clause
// arm owned here. Pruned re-derivations (owned elsewhere): saveChipPlan/
// buildSaveOptions (MA-1000 rider truth-table, MA-1867 rider sibling, MA-1563
// seam), saveLegIsConditionRider (MA-1000:39), extractConditionsFromSaveEffect
// (monsterLairActions family) — the component payload below byte-carries the
// riderOnly fork (formula null, MonsterAction.jsx:121) and the word-extracted
// ['paralyzed','poisoned'] (:122). UNIQUE leg: two-chip render + exact
// dispatch payloads. RESIDUALS (§70/§120 advisory): repeat-save-at-turn-end
// clock + 1-minute auto-success unarmed; word-spray over-grants Paralyzed
// alongside Poisoned on fail (ladder-not-armed); no save-leg damage authored
// so no half-leak possible (riderOnly, MA-0560).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TENTACLES = monsters.find((m) => m.index === 'grell').actions[2];

describe('MA-0927 grell Paralyzing Tentacles — disk fingerprint + live save-chip fork', () => {
  it('disk bytes: save_dc 11/save_type Constitution after damage_type_primary, hit_conditions ["grappled"] + escape_dc 12 after save_effect; attack half byte-unchanged; clause arms grappled/escapeDc 12 (was inert pre-fix)', () => {
    expect(TENTACLES.name).toBe('Paralyzing Tentacles');
    expect(TENTACLES.attack_bonus).toBe(4);
    expect(TENTACLES.reach).toBe('10 ft.');
    expect(TENTACLES.damage_dice_primary).toBe('1d10 + 2');
    expect(TENTACLES.damage_type_primary).toBe('Piercing');
    expect(TENTACLES.save_dc).toBe(11);
    expect(TENTACLES.save_type).toBe('Constitution');
    expect(TENTACLES.save_effect).toBe('The target has the Poisoned condition and repeats the save at the end of each of its turns, ending the effect on a success. After 1 minute, it succeeds automatically. While Poisoned, the target has the Paralyzed condition.');
    expect(TENTACLES.hit_conditions).toEqual(['grappled']);
    expect(TENTACLES.escape_dc).toBe(12);
    const keys = Object.keys(TENTACLES);
    expect(keys).toEqual(['name', 'description', 'attack_bonus', 'reach', 'damage_dice_primary', 'damage_type_primary', 'save_dc', 'save_type', 'save_effect', 'hit_conditions', 'escape_dc']);
    expect(buildHitConditionClause(TENTACLES)).toEqual({
      conditions: ['grappled'],
      escapeDc: 12,
      attackName: 'Paralyzing Tentacles',
      targetEffect: null,
    });
  });

  it('renders TWO chips "+4" + clickable "DC 11 Constitution" save chip (save half live, was zero-chip pre-fix) and dispatches both legs with exact payloads — riderOnly formula null, word-extracted ["paralyzed","poisoned"]', () => {
    const onAttack = vi.fn();
    const onSaveRoll = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TENTACLES}
        index={0}
        attackerCannotAct={false}
        onAttack={onAttack}
        onDamage={vi.fn()}
        onSaveRoll={onSaveRoll}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
      />
    );
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['+4', 'DC 11 Constitution']);
    fireEvent.click(container.querySelectorAll('.mc-dice-link')[0]);
    expect(onAttack).toHaveBeenCalledWith('Paralyzing Tentacles', 4, TENTACLES);
    const saveChips = container.querySelectorAll('.mc-dice-link-save-clickable');
    expect(saveChips).toHaveLength(1);
    fireEvent.click(saveChips[0]);
    expect(onSaveRoll).toHaveBeenCalledWith(TENTACLES, null, ['paralyzed', 'poisoned']);
  });
});
