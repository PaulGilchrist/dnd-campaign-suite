// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, applyInspiringMovement } from './reactionBonusHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

// ── Mocks (hoisted) ────────────────────────────────────────────

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

// ── Constants & Helpers ────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Bard',
    proficiency: 2,
    level: 3,
    speed: 30,
    abilities: [
      { name: 'Strength', bonus: 3 },
      { name: 'Dexterity', bonus: 1 },
      { name: 'Constitution', bonus: 2 },
      { name: 'Intelligence', bonus: 0 },
      { name: 'Wisdom', bonus: 1 },
      { name: 'Charisma', bonus: 3 },
    ],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Inspiring Movement',
    automation: {
      effect: 'self_and_ally_reactive_movement',
      duration: '',
      uses_expression: null,
      usesMax: null,
      uses: 0,
      resourceKey: null,
      allyRange: '30 ft',
      noOAs: true,
      ...automation,
    },
  };
}

function makeCombatSummary(creatures) {
  return { creatures };
}

// ── No map — no creatures — popup ──────────────────────────────

describe('handleInspiringMovement — no map, no creatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(3);
    damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([]));
  });

  it('returns popup with movement description when no map and no creatures', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('You may move up to 15 ft');
    expect(result.payload.description).toContain('does not provoke Opportunity Attacks');
  });

  it('uses player speed for half-speed calculation', async () => {
    const ps = makePlayerStats({ speed: 40 });
    const action = makeAction();

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain('20 ft');
  });

  it('defaults speed to 30 when playerStats.speed is falsy', async () => {
    const ps = makePlayerStats({ speed: undefined });
    const action = makeAction();

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain('15 ft');
  });
});

// ── No map — with creatures — modal ────────────────────────────

describe('handleInspiringMovement — with creatures, no map', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(3);
  });

  it('returns a modal when there are creatures in combat', async () => {
    const ps = makePlayerStats();
    const action = makeAction();
    damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Fighter', currentHp: 20, maxHp: 30, size: 'Medium', type: 'humanoid' },
      { name: 'Wizard', currentHp: 15, maxHp: 20, size: 'Small', type: 'humanoid' },
    ]));

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('inspiringMovementAlly');
    expect(result.payload.creatureTargets).toEqual([
      { name: 'Fighter', currentHp: 20, maxHp: 30, size: 'Medium', type: 'humanoid' },
      { name: 'Wizard', currentHp: 15, maxHp: 20, size: 'Small', type: 'humanoid' },
    ]);
    expect(result.payload.halfSpeed).toBe(15);
    expect(result.payload.noOAs).toBe(true);
  });

  it('excludes self from creature targets', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction();
    damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Bard', currentHp: 30, maxHp: 30, size: 'Medium', type: 'humanoid' },
      { name: 'Fighter', currentHp: 20, maxHp: 30, size: 'Medium', type: 'humanoid' },
    ]));

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.creatureTargets).toHaveLength(1);
    expect(result.payload.creatureTargets[0].name).toBe('Fighter');
  });

  it('passes noOAs and allyRange to modal payload', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ noOAs: false, allyRange: '50 ft' });
    damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Ally', currentHp: 10, maxHp: 20, size: 'Medium', type: 'humanoid' },
    ]));

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.noOAs).toBe(false);
    expect(result.payload.allyRange).toBe('50 ft');
  });
});

// ── Uses exhaustion ────────────────────────────────────────────

describe('handleInspiringMovement — uses exhaustion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns info popup when uses are exhausted (no modal)', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ usesMax: 3 });
    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Fighter', currentHp: 20, maxHp: 30, size: 'Medium', type: 'humanoid' },
    ]));

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('no uses remaining');
    expect(result.payload.description).toContain('Long Rest');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ── applyInspiringMovement ─────────────────────────────────────

describe('applyInspiringMovement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(3);
  });

  it('decrements uses when usesMax > 0', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ usesMax: 3 });

    const result = await applyInspiringMovement(action, ps, campaignName, 'Fighter', 15, true);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'bardicInspirationUses', 2, campaignName
    );
    expect(result.type).toBe('popup');
  });

  it('skips uses decrement when usesMax is 0', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ usesMax: 0 });

    await applyInspiringMovement(action, ps, campaignName, 'Fighter', 15, true);

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      expect.any(String), expect.stringMatching(/Uses$/i), expect.any(Number), expect.any(String)
    );
  });

  it('grants no-OA to self', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ noOAs: true });

    await applyInspiringMovement(action, ps, campaignName, 'Fighter', 15, true);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'inspiringMovementNoOA', true, campaignName
    );
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard', 'Bard', [{ type: 'inspiring_movement_no_oa' }], campaignName, 1
    );
  });

  it('grants no-OA and movement granted to ally', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ noOAs: true });

    await applyInspiringMovement(action, ps, campaignName, 'Fighter', 15, true);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Fighter', 'inspiringMovementGranted', true, campaignName
    );
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Fighter', 'inspiringMovementNoOA', true, campaignName
    );
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard', 'Fighter', [{ type: 'inspiring_movement_no_oa' }], campaignName, 1
    );
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard', 'Fighter', [{ type: 'inspiring_movement_granted' }], campaignName, 1
    );
  });

  it('does not set no-OA on ally when noOAs is false', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ noOAs: false });

    await applyInspiringMovement(action, ps, campaignName, 'Fighter', 15, false);

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      'Fighter', 'inspiringMovementNoOA', true, campaignName
    );
    expect(expirations.addExpiration).not.toHaveBeenCalledWith(
      'Bard', 'Fighter', [{ type: 'inspiring_movement_no_oa' }], campaignName, 1
    );
  });

  it('logs to campaign with ally', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ noOAs: true });

    await applyInspiringMovement(action, ps, campaignName, 'Fighter', 15, true);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Bard',
        abilityName: 'Inspiring Movement',
        description: expect.stringContaining('Ally: Fighter'),
      })
    );
  });

  it('logs to campaign without ally', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ noOAs: true });

    await applyInspiringMovement(action, ps, campaignName, null, 15, true);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Bard',
        abilityName: 'Inspiring Movement',
        description: expect.stringContaining('Movement does not provoke Opportunity Attacks'),
      })
    );
  });

  it('returns popup with correct description', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ noOAs: true });

    const result = await applyInspiringMovement(action, ps, campaignName, 'Fighter', 15, true);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Inspiring Movement');
    expect(result.payload.description).toContain('Bard used Inspiring Movement (Dance)');
    expect(result.payload.description).toContain('15 ft');
    expect(result.payload.description).toContain('Fighter');
    expect(result.payload.description).toContain('does not provoke Opportunity Attacks');
  });
});
