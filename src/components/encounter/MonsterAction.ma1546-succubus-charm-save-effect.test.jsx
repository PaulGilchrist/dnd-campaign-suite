// @maintained-by-ai: 2026-10-18
// MA-1546: Succubus "Charm" (Dominate Person lv8) — the row authored only
// save_dc/save_type, NO save_effect, so extractConditionsFromSaveEffect
// returned [] and applyDamagelessSaveConditions early-returned (saveProcessing
// .js:1048) — failed save applied NOTHING (§52/§1092 FAIL(b)/DATA). Fix:
// author save_effect byte-carrying the canonical word "charmed" after
// save_type (dryad Fey Charm MA-0654 / succubus-incubus twin byte-shape);
// the dominated-control layer stays GM-advisory in the save_effect copy
// (§70/§940). save_effect carries ONLY the canonical word "charmed" — any
// other canonical word would over-grant via the whole-string word scan
// (§793/§1105); the verbatim byte lock below subsumes the CANONICAL-word
// spray check (byte-exact ⇒ no other canonical word can ride in). Pure-save
// row: zero-damage, no attack_bonus — half-leak structurally impossible
// (§204) and no attack-chip lane exists, so the onAttack identity leg does
// not apply (the exact single-chip list proves the attack/damage lanes
// stay dark). Absorption grep: HIT_CLAUSE_ROWS carries NO succubus tuple
// (handlePlainDamage.hitClause.test.js:224-282) and no other test reads
// index==='succubus' Charm — verbatim disk row owned HERE.
// OWNED ELSEWHERE (direct calls pruned): saveChipPlan/buildSaveOptions/
// extractConditionsFromSaveEffect computation → MA-1000/MA-1867 save-plan
// owners + monsterLairActions extractConditions family (ma0927 precedent) —
// the component payload below byte-carries the riderOnly fork (formula null,
// MonsterAction.jsx:121-127) and the word-extracted ['charmed'];
// extractConditionDurationNote → monsterAbilityUses.test.js:104 dedicated
// lane (+ ma1665:178 twin pins the same "until the spell ends" note shape)
// — its prose bytes ride the verbatim save_effect lock above; Draining Kiss
// bytes → MA-1547 (MonsterCardHelpers.ma1547-draining-kiss.test.js:48-50
// byte-locks save_effect/dc/type); succubus-incubus twin row → MA-1551
// sibling lane (monsterSelfBuff.succubus-incubus-etherealness.test.js:77-82).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const CHARM = monsters.find((m) => m.index === 'succubus').actions.find((a) => a.name === 'Charm');

describe('MA-1546 succubus Charm — disk fingerprint + live save-chip fork', () => {
  it('disk bytes verbatim: DC 15 Charisma with save_effect authored immediately after save_type; description byte-unchanged RAW cast copy; key set proves zero fabricated numerics', () => {
    expect(Object.keys(CHARM)).toEqual(['name', 'description', 'save_dc', 'save_type', 'save_effect']);
    expect(CHARM).toEqual({
      name: 'Charm',
      description: 'The succubus casts Dominate Person (level 8 version), requiring no spell components and using Charisma as the spellcasting ability (spell save DC 15).',
      save_dc: 15,
      save_type: 'Charisma',
      save_effect: 'The target is charmed until the spell ends. The charmed target regards the succubus as a trusted ally; domination and command-control are GM-enforced (charmed is the mechanical marker; no automatic-control subsystem).',
    });
  });

  it('renders ONE clickable "DC 15 Charisma" chip and dispatches the exact onSaveRoll payload — row identity, riderOnly formula null, conditions ["charmed"]', () => {
    const onSaveRoll = vi.fn();
    const { container } = render(
      <MonsterAction
        action={CHARM}
        index={2}
        attackerCannotAct={false}
        onAttack={vi.fn()}
        onDamage={vi.fn()}
        onSaveRoll={onSaveRoll}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
      />
    );
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['DC 15 Charisma']);
    const saveChips = container.querySelectorAll('.mc-dice-link-save-clickable');
    expect(saveChips).toHaveLength(1);
    fireEvent.click(saveChips[0]);
    expect(onSaveRoll).toHaveBeenCalledTimes(1);
    expect(onSaveRoll).toHaveBeenCalledWith(CHARM, null, ['charmed']);
    expect(onSaveRoll.mock.calls[0][0]).toBe(CHARM);
  });
});
