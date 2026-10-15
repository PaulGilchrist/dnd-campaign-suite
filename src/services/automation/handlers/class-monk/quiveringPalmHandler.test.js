// @maintained-by-ai
// Main-lane contract for quiveringPalmHandler: handle() happy path (exact popup copy +
// targetEffects vibration-card write — the card shape pinned nowhere else in the cluster),
// existingTarget modal path (active target beats current selection), the lastAttack
// preconditions (not-by-you / not-Unarmed-Strike / did-not-hit refusals + the hit:true
// pass arm), applyShockwave failed-save popup copy + vibration-clear write, and
// half-damage-on-success math (owned here per saveDc.test.js header).
// Seam map siblings: no-target + insufficient-resource refusals and cost/resource default
// writes → handle.test.js; cs:null ternary arm → nullContext.test.js; exact
// applyDamageToTarget args and dice/rawDamage edges → shockwave.test.js; real DC-18
// resolution → saveDc.test.js; cleanup filter table → release.test.js; addEntry rejection
// catches → catchCoverage.test.js, successCatch.test.js, errorPaths.test.js.
// Fully mocked with fixed roll fixtures — deterministic, stable rules contract.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../automation/common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyShockwave, applyRelease } from './quiveringPalmHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../../automation/common/savePrompt.js';
import { rollExpression } from '../../../dice/diceRoller.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestMonk',
    level: 17,
    proficiencyBonus: 6,
    proficiency: 6,
    abilities: [
      { name: 'Strength', bonus: 2 },
      { name: 'Wisdom', bonus: 3 },
      { name: 'Dexterity', bonus: 2 },
    ],
    class: {
      class_levels: [{ level: 17, focus_points: 4 }],
    },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Quivering Palm',
    automation: {
      type: 'quivering_palm',
      casting_time: 'passive',
      cost: { amount: 3, resource: 'kiPoints' },
      trigger: 'action',
      damageExpression: '10d10',
      damageType: 'Necrotic',
      ...automation,
    },
  };
}

// Successful-preconditions router: no vibrations active, valid last Unarmed Strike hit,
// ki available. Anything else returns undefined (|| [] / ?? fallbacks engage upstream).
function okRuntime({ lastAttack } = {}) {
  return (_a, b, _c) => {
    if (_a === 'campaign' && b === 'quivering_palm') return null;
    if (_a === 'campaign' && b === 'lastAttack') return lastAttack ?? {
      attackerName: 'TestMonk',
      attackName: 'Unarmed Strike',
      saveResult: 'success',
    };
    if (b === 'kiPoints') return 5;
    return undefined;
  };
}

// ── Tests: handle() — first click, setting vibrations ─────────

describe('quiveringPalmHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets vibrations: success popup copy and targetEffects card are written', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation(okRuntime());

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    // Canonical success popup copy for the whole cluster (siblings toContain this).
    expect(result.payload.description).toBe('Quivering Palm set on Goblin. Use the feature again to release the vibrations or trigger a shockwave.');
    // The vibration targetEffect card — shape owned here (cleanup filter shape is
    // pinned in release.test.js; the card creation was unpinned until now).
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [{
      target: 'Goblin',
      source: 'Quivering Palm',
      option: 'Quivering Palm',
      effect: 'quivering_palm',
      value: null,
      duration: 'until_end',
      noOpportunityAttacks: false,
      saveType: null,
      condition: null,
    }], campaignName);
  });

  it('returns a modal when vibrations are already active, targeting the stored creature', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (_a === 'campaign' && b === 'quivering_palm') return 'Ogre';
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('quiveringPalm');
    // Stored vibration target (Ogre) beats the currently-selected target (Goblin).
    expect(result.payload.targetName).toBe('Ogre');
    expect(result.payload.isRelease).toBe(false);
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestMonk',
      description: 'Quivering Palm — Vibrations already active against Ogre. Use again to release or trigger shockwave.',
    }));
  });

  it('refuses when last attack was not made by the monk', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (_a === 'campaign' && b === 'quivering_palm') return null;
      if (_a === 'campaign' && b === 'lastAttack') return { attackerName: 'Goblin', attackName: 'Longsword' };
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Last attack was not made by you');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('refuses when last attack was not an Unarmed Strike', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation(okRuntime({
      lastAttack: {
        attackerName: 'TestMonk',
        attackName: 'Longsword',
        total: 15,
        targetAc: 12,
      },
    }));

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('not an Unarmed Strike');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('refuses when last Unarmed Strike did not hit', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation(okRuntime({
      lastAttack: {
        attackerName: 'TestMonk',
        attackName: 'Unarmed Strike',
        total: 8,
        targetAc: 15,
      },
    }));

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('did not hit');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('accepts an explicit hit:true even when total is below the AC', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    // didLastAttackHit's alternate arm: hit===true passes without saveResult/AC math.
    getRuntimeValue.mockImplementation(okRuntime({
      lastAttack: {
        attackerName: 'TestMonk',
        attackName: 'Unarmed Strike',
        hit: true,
        total: 5,
        targetAc: 15,
      },
    }));

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('set on Goblin');
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'quivering_palm', 'Goblin', campaignName);
  });
});

// ── Tests: applyShockwave() ────────────────────────────────────

describe('quiveringPalmHandler.applyShockwave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports full damage on failed save and clears the vibration marker', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({
      promise: Promise.resolve({
        roll: 8,
        saveBonus: 2,
        total: 10,
        success: false,
      }),
    });
    rollExpression.mockReturnValue({ total: 55, rolls: [10, 10, 10, 10, 10, 5, 0, 0, 0, 0], modifier: 0 });

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    // Popup copy lane: full-damage wording (exact applyDamageToTarget args and
    // rawDamage/finalDamage payload numbers are pinned in shockwave.test.js).
    expect(result.payload.description).toContain('CON save (DC 15)');
    expect(result.payload.description).toContain('<strong>Failure</strong>');
    expect(result.payload.description).toContain('Full damage');
    expect(result.payload.description).toContain('Force');
    // Vibration marker must be cleared when the shockwave fires.
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'quivering_palm', null, campaignName);
  });

  it('returns half damage on successful save', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({
      promise: Promise.resolve({
        roll: 18,
        saveBonus: 2,
        total: 20,
        success: true,
      }),
    });
    rollExpression.mockReturnValue({ total: 50, rolls: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5], modifier: 0 });

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    // Half-on-save math owned here (saveDc.test.js header assigns it to this file).
    expect(result.payload.description).toContain('<strong>Success</strong>');
    expect(result.payload.description).toContain('Half damage');
    expect(result.payload.rawDamage).toBe(50);
    expect(result.payload.finalDamage).toBe(25);
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'quivering_palm', null, campaignName);
  });
});

// ── Tests: applyRelease() ──────────────────────────────────────

describe('quiveringPalmHandler.applyRelease', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a popup confirming harmless release', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    const result = await applyRelease(action, ps, campaignName, 'Goblin');

    // Canonical release popup copy (release.test.js owns the cleanup filter table;
    // catchCoverage.test.js owns the L285 log catch).
    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe('Vibrations released harmlessly against Goblin.');
    expect(result.payload.isRelease).toBe(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'quivering_palm', null, campaignName);
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      description: expect.stringContaining('released the vibrations harmlessly'),
    }));
  });
});
