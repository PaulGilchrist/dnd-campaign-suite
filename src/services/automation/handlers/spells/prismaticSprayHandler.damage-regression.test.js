// SP-092 regression: 2024 canonical Prismatic Spray damage rays roll 12d6,
// half on a successful DEX save. 5e twin stays 10d6 (RAW, unautomated).
//
// ── prismaticSpray SEXTET seam map (shared subject: prismaticSprayHandler.js) ──
// Fix SP-092 (commit 2dec3eff3): damage rays rolled 10d6 instead of canonical
// 12d6. Three fix sites: ① PRISMATIC_RAYS table, ② `auto.damage || '12d6'`
// fallback in queueRaySave, ③ public/data/2024/spells.json. This lane locks all
// three plus ray→damage-type routing and save-half semantics (12d6 in payload,
// log, AND rolled formula; never 10d6).
//   #1940 .handle   — core flow: combat-context popups, target selection,
//                     storeSpellLastAttack, ray-roll dispatch counts (no formula pins)
//   #1941 .helpers  — isPrismaticSprayBlocked pure function (attackBlockers.js)
//   #1942 .rays     — per-ray save payloads (all 7 rays incl. indigo/violet),
//                     status application, targetEffects registry writes, expirations
//   #1943 .save-results — immunity skip, disadvantage, save_result/addTargetResult
//                     log plumbing, zero-damage guards, ability_use entries
//   #1944 .summaries    — summary popup text, mixed outcomes, custom-damage passthrough
//   lane (this) — .damage-regression: 12d6 fix locks only (queue continues: rayOfEnfeeblement)
// Handoff:
//   • summaries "falls back to 12d6 when damage is not in automation" duplicates
//     this lane's "falls back to 12d6 when automation omits damage" — fix-site ②
//     pin lives HERE; that sibling is a trim candidate.
//   • save-results "applies half/full damage…" stub computeDamageAfterSave to canned
//     totals; this lane pins its exact args + real half semantics + options object —
//     siblings now cover the options-object lane only, keep for that.
//   • abilities-ARRAY class (holdMonster/polymorph precedents): NOT applicable here —
//     buildSaveDc is mocked and the handler only reads playerStats.name; verified at
//     source, no prod-shape mismatch to pin.
// ──────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => Promise.resolve()),
  computeDamageAfterSave: vi.fn((raw, success) => (success ? Math.floor(raw / 2) : raw)),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

import { handle } from './prismaticSprayHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as applyDamage from '../../../rules/combat/applyDamage.js';
import * as logService from '../../../ui/logService.js';

const campaignName = 'TestCampaign';
const casterName = 'AberrantSorcerer';

const DAMAGE_RAYS = [
  { roll: 1, name: 'Red', type: 'fire' },
  { roll: 2, name: 'Orange', type: 'acid' },
  { roll: 3, name: 'Yellow', type: 'lightning' },
  { roll: 4, name: 'Green', type: 'poison' },
  { roll: 5, name: 'Blue', type: 'cold' },
];

const combatContext = {
  creatures: [
    { name: 'Thug 1', type: 'monster', weaknessesAndResistivities: { immunities: [] } },
    { name: casterName, gridX: 5, gridY: 10 },
  ],
  players: [{ name: casterName, gridX: 5, gridY: 10 }],
  placedItems: [],
};

const originalRandom = Math.random;

function forceRoll(dieValue, sides) {
  Math.random = () => (dieValue - 0.5) / sides;
}

function makeAction() {
  return {
    name: 'Prismatic Spray',
    automation: { type: 'prismatic_spray', saveType: 'DEX', damage: '12d6', saveDc: 'spell_save_dc' },
  };
}

function makePlayerStats() {
  return { name: casterName, level: 20, proficiency: 6, abilities: [{ name: 'Charisma', bonus: 5 }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  useRuntimeState.getRuntimeValue.mockReturnValue(null);
  damageUtils.getCombatContext.mockResolvedValue(combatContext);
  savePrompt.buildSaveDc.mockReturnValue(13);
});

afterEach(() => {
  Math.random = originalRandom;
});

describe('SP-092 rule data is truth', () => {
  const spells2024 = JSON.parse(readFileSync(join(process.cwd(), 'public/data/2024/spells.json'), 'utf8'));
  const spells5e = JSON.parse(readFileSync(join(process.cwd(), 'public/data/spells.json'), 'utf8'));

  it('2024 prismatic-spray automation.damage is 12d6 matching its prose', () => {
    const spell = spells2024.find(s => s.index === 'prismatic-spray');
    expect(spell.automation.damage).toBe('12d6');
    const prose = spell.description.join(' ');
    for (const ray of ['Red', 'Orange', 'Yellow', 'Green', 'Blue']) {
      expect(prose).toMatch(new RegExp(`${ray}\\.</b> Failed Save: 12d6`));
    }
    expect(prose).not.toMatch(/Failed Save: 10d6/);
  });

  it('5e twin stays 10d6 per RAW and carries no 2024 automation block', () => {
    const spell = spells5e.find(s => s.index === 'prismatic-spray');
    expect(spell.automation).toBeFalsy();
    expect(spell.damage.damage_at_slot_level['7']).toBe('10d6');
    expect(spell.description.join(' ')).toMatch(/10d6 fire damage/);
  });
});

describe('SP-092 handler dispatches 12d6 per damage ray (2024 lane)', () => {
  it.each(DAMAGE_RAYS)('$name ray queues save with damageFormula 12d6', async ({ roll, name, type }) => {
    forceRoll(roll, 8);
    savePrompt.createSaveListener.mockReturnValue({
      promptId: `p${roll}`,
      promise: Promise.resolve({ success: false, roll: 1, total: 1 }),
    });
    diceRoller.rollExpression.mockReturnValue({ total: 30 });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({ damageFormula: '12d6', damageType: type }),
    );
    const entryCalls = logServiceCalls();
    expect(entryCalls.some(d => d.includes(`${name} ray`) && d.includes('12d6'))).toBe(true);
    expect(entryCalls.some(d => d.includes('10d6'))).toBe(false);
  });

  it('failed save applies full 12d6 roll, successful save applies exactly half', async () => {
    // Ray 1 (Red), single target Thug 1; roll 35 raw → fail 35, half 17.
    diceRoller.rollExpression.mockReturnValue({ total: 35 });
    forceRoll(1, 8);
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'p1',
      promise: Promise.resolve({ success: true, roll: 15, total: 20 }),
    });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    // Fix-site threading: the rolled formula must be 12d6, rolled exactly once.
    expect(diceRoller.rollExpression).toHaveBeenCalledTimes(1);
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('12d6');
    expect(applyDamage.computeDamageAfterSave).toHaveBeenCalledTimes(1);
    expect(applyDamage.computeDamageAfterSave).toHaveBeenCalledWith(35, true, 'half');
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
      combatContext, 'Thug 1', 17, ['fire'],
      { campaignName, characters: expect.any(Array), ignoreResistance: false, attackerName: casterName },
    );

    applyDamage.applyDamageToTarget.mockClear();
    applyDamage.computeDamageAfterSave.mockClear();
    diceRoller.rollExpression.mockClear();
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'p1',
      promise: Promise.resolve({ success: false, roll: 3, total: 3 }),
    });
    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(diceRoller.rollExpression).toHaveBeenCalledWith('12d6');
    expect(applyDamage.computeDamageAfterSave).toHaveBeenCalledTimes(1);
    expect(applyDamage.computeDamageAfterSave).toHaveBeenCalledWith(35, false, 'half');
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
      combatContext, 'Thug 1', 35, ['fire'],
      { campaignName, characters: expect.any(Array), ignoreResistance: false, attackerName: casterName },
    );
  });

  it('falls back to 12d6 when automation omits damage', async () => {
    forceRoll(1, 8);
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'p1',
      promise: Promise.resolve({ success: false, roll: 1, total: 1 }),
    });
    diceRoller.rollExpression.mockReturnValue({ total: 20 });

    await handle(
      { name: 'Prismatic Spray', automation: { type: 'prismatic_spray', saveType: 'DEX', saveDc: 13 } },
      makePlayerStats(), campaignName, null,
    );

    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({ damageFormula: '12d6' }),
    );
    // The fallback must reach the actual roll too, not just the prompt payload.
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('12d6');
  });
});

function logServiceCalls() {
  return logService.addEntry.mock.calls.map(c => c[1].description || '');
}
