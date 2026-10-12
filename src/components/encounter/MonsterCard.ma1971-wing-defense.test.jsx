// MA-1971: Quetzalcoatl "Wing Defense" reactions[0] — FAIL(a)/FAIL(b) hybrid.
// DEFECT 2 FIX (DATA, shipped): `dc_success: "none"` — RAW "succeed … or take
// 7 (2d6) Thunder damage" ⇒ success = ZERO damage; without the field the
// app-wide 'half' default (resolveBlockSaveDcSuccess MonsterCardModal.jsx:286,
// buildSaveOptions :1332) half-leaked on every save-success face. Twins:
// cockatrice-regent Magical Backlash (exact REACTION save-chip twin),
// abominable-yeti Chilling Gaze (MA-0030 family).
// DEFECT 1 ADJUDICATION (residual, automation deliberately NOT authored): the
// brief's parry byte-shape {effect:'parry', acBonus:5} is a proven NET
// REGRESSION for this row —
//   (a) MA-1488 sole-press mandate (MonsterAction.jsx:416, landed 2026-09-28):
//       ANY gated row suppresses the generic save shell → the LIVE, byte-exact
//       DC 25 Dexterity / 2d6 Thunder adjudication (credited in the repro,
//       5/5 presses) would be DELETED, and resolveMonsterParry rolls NO save.
//   (b) parryIdentityRefusal (:1739) refuses every RANGED lastAttack
//       (weaponType !== 'melee' → 'melee') — the Wing Defense RAW trigger is
//       "targeted by a ranged weapon attack", so the lane would refuse the
//       only RAW-legal trigger (§224 codifies ranged → honest parry_refused).
//   (c) no verified ranged-trigger twin exists in monsters.json (census 2026-10-12:
//       zero automation triggers containing 'ranged'), and MA-1843 (playbook :503)
//       forbids flat `advisory` on save-chip rows (duplicate affordance).
// Fix option for a future ticket: a dedicated wing_defense gated lane (ranged
// pending-window gate + acBonus fold + inline attacker save, spell_reflection
// MA-1488 service shape). The +5 AC rider stays GM-enforced advisory — the RAW
// text renders verbatim on the card press surface.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import monsters from '../../../public/data/monsters.json';
import { MonsterAction } from './MonsterAction.jsx';
import { saveChipPlan, buildSaveOptions } from './MonsterCardModal.jsx';
import {
  getGatedMonsterReaction,
  parryGate,
  parryIdentityRefusal,
  resolveMonsterParry,
  MONSTER_REACTION_USES_KEY,
} from './MonsterCardHelpers.js';

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const ROW = monsters.find((m) => m.index === 'quetzalcoatl').reactions[0];
const QUETZ = 'Quetzalcoatl 1';
const ARCHER = 'Bandit 1';
const CAMPAIGN = 'test-campaign';

describe('MA-1971 disk lock: Wing Defense dc_success none + save core byte-pin', () => {
  it('name/trigger/description byte-identical to the RAW row', () => {
    expect(ROW.name).toBe('Wing Defense');
    expect(ROW.trigger).toBe('When it is targeted by a ranged weapon attack.');
    expect(ROW.description).toBe('It flares its feathered wings and gains +5 to AC against the attack, and the attacker must succeed on a DC 25 Dexterity saving throw or take 7 (2d6) Thunder damage.');
  });

  it('save core byte-pin: DC 25 Dexterity, 2d6 Thunder, avg 7', () => {
    expect(ROW.save_dc).toBe(25);
    expect(ROW.save_type).toBe('Dexterity');
    expect(ROW.damage_dice_primary).toBe('2d6');
    expect(ROW.damage_type_primary).toBe('Thunder');
  });

  it('MA-0481-family fix: dc_success "none" authored (success = ZERO damage, cockatrice-regent twin)', () => {
    expect(ROW.dc_success).toBe('none');
    const twin = monsters.find((m) => m.index === 'cockatrice-regent').reactions[0];
    expect(twin.dc_success).toBe('none');
  });

  it('adjudicated shape: NO automation, NO advisory, NO usage (see file-header adjudication)', () => {
    expect(ROW.automation).toBeUndefined();
    expect(ROW.advisory).toBeUndefined();
    expect(ROW.usage).toBeUndefined();
    expect(getGatedMonsterReaction(ROW)).toBeNull();
  });

  it('placement pin: dc_success sits after save_type on this monster-unique block', () => {
    const shape = '"description": "It flares its feathered wings and gains +5 to AC against the attack, and the attacker must succeed on a DC 25 Dexterity saving throw or take 7 (2d6) Thunder damage.",\n        "save_dc": 25,\n        "save_type": "Dexterity",\n        "dc_success": "none"';
    expect(RAW.split(shape).length - 1).toBe(1);
  });
});

describe('MA-1971 save transport: dc_success none rides the save payload', () => {
  it('saveChipPlan arms the LIVE clickable DC chip (2d6 rollable, no attack_bonus)', () => {
    const plan = saveChipPlan(ROW, false);
    expect(plan.riderOnly).toBe(false);
    expect(plan.formula).toBe('2d6');
    expect(plan.rollable).toBe(true);
    expect(plan.clickable).toBe(true);
  });

  it('buildSaveOptions carries saveDc 25 / DEX / dcSuccess "none" (override beats half default)', () => {
    const opts = buildSaveOptions(ROW);
    expect(opts.saveDc).toBe(25);
    expect(opts.dcSuccess).toBe('none');
    // counterfactual twin: an identical row WITHOUT the authored field still
    // half-defaults — pinning that "none" is the authored override, not a
    // changed global default.
    expect(buildSaveOptions({ save_dc: 25, save_type: 'Dexterity' }).dcSuccess).toBe('half');
  });
});

describe('MA-1971 render: save chips LIVE, no gated/advisory affordance', () => {
  const renderRow = (action, extra = {}) => {
    const onSaveRoll = vi.fn();
    const onGatedReaction = vi.fn();
    const { container } = render(
      <MonsterAction
        action={action}
        index={0}
        attackerCannotAct={false}
        onAttack={vi.fn()}
        onDamage={vi.fn()}
        onSaveRoll={onSaveRoll}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={onGatedReaction}
        {...extra}
      />
    );
    return { container, onSaveRoll, onGatedReaction };
  };

  it('row renders 2d6 + clickable DC 25 Dexterity chips; press routes onSaveRoll with formula 2d6', () => {
    const { container, onSaveRoll } = renderRow(ROW);
    const dcChip = container.querySelector('.mc-dice-link-save-clickable');
    expect(dcChip).not.toBe(null);
    expect(dcChip.textContent).toBe('DC 25 Dexterity');
    fireEvent.click(dcChip);
    expect(onSaveRoll).toHaveBeenCalledTimes(1);
    expect(onSaveRoll.mock.calls[0][0]).toBe(ROW);
    expect(onSaveRoll.mock.calls[0][1]).toBe('2d6');
  });

  it('counterfactual MA-1140 byte-shape proof: authoring effect parry DELETES the credited save chip (MA-1488 :416) and arms a Parry-labeled gated chip instead', () => {
    const prescribed = {
      ...ROW,
      automation: { type: 'reaction', trigger: 'ranged-weapon-target', effect: 'parry', acBonus: 5 },
    };
    expect(getGatedMonsterReaction(prescribed)?.effect).toBe('parry');
    const { container, onSaveRoll } = renderRow(prescribed);
    expect(container.querySelector('.mc-dice-link-save-clickable')).toBeNull();
    expect(container.querySelector('.mc-dice-link-advisory')).toBe(null);
    const gated = container.querySelectorAll('.mc-dice-link');
    expect(Array.from(gated).every((c) => !c.textContent.includes('DC 25'))).toBe(true);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onSaveRoll).not.toHaveBeenCalled();
  });
});

describe('MA-1971 parry-gate adjudication: ranged trigger refused; lane mechanics on melee only', () => {
  function rangedHitOnQuetz(overrides = {}) {
    return { attackerName: ARCHER, targetName: QUETZ, attackName: 'Shortbow', rollType: 'attack', weaponType: 'ranged', hit: true, d20: 14, bonus: 4, total: 18, targetAc: 22, effectiveAc: 22, ...overrides };
  }

  it('parry identity REFUSES the RAW-legal ranged trigger (§224 codified)', () => {
    expect(parryIdentityRefusal(rangedHitOnQuetz(), QUETZ)).toBe('melee');
    const g = parryGate({ lastAttack: rangedHitOnQuetz(), monsterName: QUETZ, currentRound: 1, storedUses: {}, usedRound: 0, action: ROW });
    expect(g.ok).toBe(false);
    expect(g.reason).toBe('melee');
  });

  it('acBonus 5 threads ONLY on a (non-RAW) melee hit: resolveMonsterParry stamps AC 22 → 27, At Will never spends uses', async () => {
    const melee = rangedHitOnQuetz({ weaponType: 'melee', attackName: 'Scimitar' });
    const synth = { ...ROW, usage: 'At Will', uses: 999, maxUses: 999, automation: { type: 'reaction', trigger: 'melee_hit', effect: 'parry', acBonus: 5 } };
    const state = {};
    const logs = [];
    const campaignWrites = [];
    const deps = {
      getCombatContext: vi.fn(async () => ({ round: 1 })),
      getRuntimeValue: vi.fn((key, prop) => state[`${key}.${prop}`] ?? null),
      setRuntimeValue: vi.fn(async (key, prop, value) => {
        if (key === 'campaign' && prop === 'lastAttack') campaignWrites.push(value);
        state[`${key}.${prop}`] = value;
      }),
      addEntry: vi.fn(async (c, e) => { logs.push(e); }),
    };
    const result = await resolveMonsterParry({ action: synth, monsterName: QUETZ, campaignName: CAMPAIGN, lastAttack: melee, currentRound: 1, storedUses: {}, usedRound: 0, latchKey: '_parry_usedRound', deps });
    expect(result.ok).toBe(true);
    expect(result.acBonus).toBe(5);
    expect(result.newAc).toBe(27);
    expect(state[`${QUETZ}.activeBuffs`].some((b) => b.effect === 'parry' && b.acBonus === 5)).toBe(true);
    expect(state[`${QUETZ}._parry_usedRound`]).toBe(1);
    expect(campaignWrites[0]).toMatchObject({ parryResolved: true, parriedBy: QUETZ, parryAcBonus: 5 });
    expect(state[`${QUETZ}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
    // vsAttack mislabel residual: buildParryBuff source stays 'Parry' even on
    // this row named Wing Defense — recorded honestly.
    expect(state[`${QUETZ}.activeBuffs`][0].source).toBe('Parry');
    expect(logs.find((l) => l.type === 'ability_use').description).toMatch(/AC 22 → 27/);
  });
});
