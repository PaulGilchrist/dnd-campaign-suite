// @maintained-by-ai
// CLA-048 lane: owns attackRollBonuses.js `buildCelestialRevelationStep`'s PROFICIENCY_BONUS
// resolution — the bug itself: rollExpression('proficiency_bonus') is null (diceRoller NdM
// constants-only), so the pre-fix step silently returned {} on every hit. This is the ONLY
// lane driving the REAL collaborators end-to-end: real resolveDiceExpression token table
// ('proficiency_bonus' → '6'), real rollExpression (returns null for '6' — spied, real impl,
// zero RNG in this file), real parseConstant ('6' → 6). Exact bytes hand-derived (#829).
//
// Lane split (no re-drive, #936): dice-expression rider application, latch-inert/round
// consumption, targetless/riderless/buffless guards, and the bonusValue<=0 zero-guard are
// CANON in sibling attackRollDamageSteps-automationBonuses.test.js and
// attackRollDamageSteps-natural20-celestial.test.js — both run THIS SAME step as
// steps[14] via buildAttackRollDamageSteps (attackRollDamageSteps.js:23 imports the builder).
// The step never logs (celestialRevelationHandler owns the single ability_use entry —
// negative-pinned in t1) and never touches targetEffects/addExpiration: speed_reduction te
// + addExpiration clock is the CLA-044 twin / brutalStrike branch (applyBrutalStrikeTarget-
// Effects, :197-224), CANON attackRollBonuses-brutalStrike.test.js #1022 (distinct rider
// branch, cite-split honored — carried-rec premise verified FALSE against this branch).
//
// old->new map: old t1 (formula flat) + old t2 (latch stamp) → t1; old t4 (Necrotic Shroud
// flat) → t2; old t3/t5/t6/t7/t8 (latch-inert, range-assert dice rider, null-safe guards)
// → dropped, sibling-owned (see split above); old data-lock t1+t2 (weak cross-compare) →
// single exact-byte disk pin (t3), damage_aura assertion dropped (not consumed by this
// attack_rider-filtered step — aura lane's lock).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Spy-only mock: REAL diceRoller behavior preserved (parseConstant untouched), calls pinned.
vi.mock('../../dice/diceRoller.js', async (importOriginal) => ({
  ...(await importOriginal()),
  rollExpression: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../automation/common/buffToggle.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

// Hermetic guards — the celestial lane never calls these (negative-pinned in t1);
// real logService/addExpiration/brutalStrikeSelection/automationService graphs are heavy + networked (#841).
vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));
vi.mock('../brutalStrikeSelection.js', () => ({
  selectBrutalStrikeRiders: vi.fn(() => []),
}));
vi.mock('../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));
vi.mock('../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => expr),
}));

import { buildCelestialRevelationStep } from './attackRollBonuses.js';
import { rollExpression } from '../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { getActiveBuffs } from '../../automation/common/buffToggle.js';
import { addEntry } from '../../ui/logService.js';
import { addExpiration } from '../../rules/effects/expirations.js';

const step = buildCelestialRevelationStep();

function rider(overrides = {}) {
  return {
    type: 'attack_rider',
    name: 'Heavenly Wings',
    damageExpression: 'proficiency_bonus',
    damageType: 'Radiant',
    trigger: 'hit',
    oncePerTurn: true,
    ...overrides,
  };
}

function makeCtx(overrides = {}) {
  return {
    playerStats: {
      name: 'AasimarTest',
      level: 20,
      proficiency: 6,
      abilities: [],
      automation: { actions: [], passives: [rider()] },
    },
    targetName: 'Bandit 1',
    campaignName: 'test-campaign',
    formula: '1d6+2',
    total: 8,
    rolls: [4],
    ...overrides,
  };
}

describe('CLA-048 buildCelestialRevelationStep — proficiency_bonus resolve-first', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Faithful to real diceRoller: NdM/constants-only — '6' is UNROLLABLE (null),
    // the CLA-048 crux that forces the parseConstant fallback. NdM never occurs in
    // this lane (dice riders are sibling-owned) — throw loudly if this step drifts.
    rollExpression.mockImplementation((expr) => {
      const base = String(expr).replace(/\s*\[.*?\]\s*/g, '').trim();
      if (/^[+-]?\d+$/.test(base)) return null;
      throw new Error(`celestial lane must not roll NdM "${expr}" — dice riders are sibling-owned`);
    });
    getRuntimeValue.mockReturnValue(null);
    getCurrentCombatRound.mockReturnValue(1);
    getActiveBuffs.mockReturnValue([{ name: 'Heavenly Wings' }]);
  });

  it('resolves proficiency_bonus to a flat +6 [radiant] term for Heavenly Wings and stamps the once-per-turn latch', async () => {
    getCurrentCombatRound.mockReturnValue(4);
    const result = await step.handler(makeCtx());

    // Resolve-first chain, exact bytes: token → '6' once; diceRoller cannot roll '6' (null),
    // so the flat parseConstant(6) lands in the formula. rolls stay untouched [4] — no dice
    // were rolled (pre-fix this leg returned {} entirely).
    expect(rollExpression).toHaveBeenCalledTimes(1);
    expect(rollExpression).toHaveBeenCalledWith('6');
    expect(result.data).toEqual({
      formula: '1d6+2 + 6 [radiant]',
      total: 14,
      rolls: [4],
    });

    // Sticky consumption stamp, exact call bytes, campaign-keyed (#1019/#1021).
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('AasimarTest', '_Heavenly_Wings_usedRound', 4, 'test-campaign');

    // This lane stamps NO targetEffects, schedules NO expiration, writes NO log
    // (CLA-044/brutalStrike owns te+clock; celestialRevelationHandler owns the log).
    expect(setRuntimeValue.mock.calls.filter((c) => c[1] === 'targetEffects')).toEqual([]);
    expect(addExpiration).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('pairs the active Necrotic Shroud buff to its rider: + 6 [necrotic] with the latch keyed by rider name', async () => {
    getActiveBuffs.mockReturnValue([{ name: 'Necrotic Shroud' }]);
    const ctx = makeCtx({
      playerStats: {
        name: 'AasimarTest',
        level: 20,
        proficiency: 6,
        abilities: [],
        automation: { actions: [], passives: [rider({ name: 'Necrotic Shroud', damageType: 'Necrotic' })] },
      },
    });
    const result = await step.handler(ctx);

    expect(result.data).toEqual({
      formula: '1d6+2 + 6 [necrotic]',
      total: 14,
      rolls: [4],
    });
    expect(setRuntimeValue).toHaveBeenCalledWith('AasimarTest', '_Necrotic_Shroud_usedRound', 1, 'test-campaign');
  });
});

describe('CLA-048 races.json data lock', () => {
  const data = JSON.parse(readFileSync(resolve(__dirname, '../../../../public/data/2024/races.json'), 'utf8'));

  function findAasimar(node) {
    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = findAasimar(item);
        if (hit) return hit;
      }
      return null;
    }
    if (node && typeof node === 'object') {
      if (node.name === 'Aasimar' && Array.isArray(node.traits)) return node;
      for (const value of Object.values(node)) {
        const hit = findAasimar(value);
        if (hit) return hit;
      }
    }
    return null;
  }

  it('all three Celestial Revelation options carry the exact attack_rider block this step consumes', () => {
    const aasimar = findAasimar(data);
    const riderOf = (name) => aasimar.traits.find((t) => t.name === name).automation
      .flatMap((a) => (Array.isArray(a) ? a : [a]))
      .find((a) => a.type === 'attack_rider');

    // Verbatim disk bytes — buff names must stay exactly these (the step hardcodes them),
    // damageExpression is the proficiency_bonus token CLA-048 resolves, type matches rules text.
    expect([riderOf('Heavenly Wings'), riderOf('Inner Radiance'), riderOf('Necrotic Shroud')]).toEqual([
      { type: 'attack_rider', damageExpression: 'proficiency_bonus', damageType: 'Radiant', trigger: 'hit', oncePerTurn: true, casting_time: 'passive' },
      { type: 'attack_rider', damageExpression: 'proficiency_bonus', damageType: 'Radiant', trigger: 'hit', oncePerTurn: true, casting_time: 'passive' },
      { type: 'attack_rider', damageExpression: 'proficiency_bonus', damageType: 'Necrotic', trigger: 'hit', oncePerTurn: true, casting_time: 'passive' },
    ]);
  });
});
