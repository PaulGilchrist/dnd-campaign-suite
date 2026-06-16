import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './reactionBonusHandler.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';

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

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'DungeonMap';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Paladin',
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
    name: 'Test Reaction',
    automation: {
      effect: '',
      duration: '',
      uses_expression: null,
      usesMax: null,
      uses: 0,
      resourceKey: null,
      allyRange: '30 ft',
      noOAs: false,
      ...automation,
    },
  };
}

function resetMocks() {
  useRuntimeState.getRuntimeValue.mockClear().mockReset();
  useRuntimeState.setRuntimeValue.mockClear().mockResolvedValue(undefined);
  targetResolver.resolveTarget.mockClear().mockReset();
  targetResolver.resolveMapPositions.mockClear().mockReset();
  rangeValidation.getDistanceFeet.mockClear().mockReset();
  rangeValidation.rangeToFeet.mockClear().mockReturnValue(30);
  expirations.addExpiration.mockClear().mockReset();
  logService.addEntry.mockClear().mockResolvedValue({});
}

// ── handle() entry point — dispatch routing ────────────────────

describe('handle — dispatch routing', () => {
  beforeEach(() => resetMocks());

  it('routes to Unbreakable Majesty when effect is miss_on_failed_save', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('activated');
  });

  it('routes to Inspiring Movement for any other effect value', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('half your Speed');
  });

  it('routes to Inspiring Movement when effect is empty string', async () => {
    const ps = makePlayerStats({ speed: 30 });
    const action = makeAction({ effect: '' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('half your Speed');
  });

  it('routes to Inspiring Movement when effect is undefined', async () => {
    const ps = makePlayerStats({ speed: 30 });
    const action = makeAction({ effect: undefined });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('half your Speed');
  });

  it('passes mapName to Inspiring Movement handler', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue(null);

    await handle(action, ps, campaignName, mapName);

    expect(targetResolver.resolveMapPositions).toHaveBeenCalledWith(
      campaignName, mapName, 'Paladin'
    );
  });

  it('does not pass mapName when routing to Unbreakable Majesty', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, mapName);

    expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
  });
});

// ── handle() — return value structure ──────────────────────────

describe('handle — return value structure', () => {
  beforeEach(() => resetMocks());

  it('returns a popup with automation_info payload for Unbreakable Majesty activation', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result).toEqual({
      type: 'popup',
      payload: expect.objectContaining({
        type: 'automation_info',
        name: 'Test Reaction',
        automation: action.automation,
      }),
    });
  });

  it('returns a popup with automation_info payload for Inspiring Movement', async () => {
    const ps = makePlayerStats({ speed: 30 });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result).toEqual({
      type: 'popup',
      payload: expect.objectContaining({
        type: 'automation_info',
        name: 'Test Reaction',
        automation: action.automation,
      }),
    });
  });

  it('returns a popup with no uses remaining when uses exhausted', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 3 });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('no uses remaining');
  });
});

// ── Unbreakable Majesty — activation/deactivation toggle ───────

describe('handle — Unbreakable Majesty toggle behavior', () => {
  beforeEach(() => resetMocks());

  it('activates on first call (wasActive=false)', async () => {
    const ps = makePlayerStats({ name: 'Paladin' });
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('activated');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestyActive', true, campaignName
    );
  });

  it('deactivates on second call (wasActive=true)', async () => {
    const ps = makePlayerStats({ name: 'Paladin' });
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(true);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('ended');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestyActive', null, campaignName
    );
  });

  it('treats non-true return (string "yes") as not active (uses === comparison)', async () => {
    const ps = makePlayerStats({ name: 'Paladin' });
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue('yes');

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('activated');
  });

  it('treats null/undefined return as not active', async () => {
    const ps = makePlayerStats({ name: 'Paladin' });
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(null);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('activated');
  });
});

// ── Inspiring Movement — noOAs behavior ────────────────────────

describe('handle — Inspiring Movement noOAs', () => {
  beforeEach(() => resetMocks());

  it('sets noOA expiration on self when noOAs true', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', noOAs: true });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'inspiringMovementNoOA', true, campaignName
    );
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard', 'Bard', [{ type: 'inspiring_movement_no_oa' }], campaignName, 1
    );
  });

  it('does not set noOA on self when noOAs false', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', noOAs: false });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, mapName);

    const selfNoOACall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[0] === 'Bard' && c[1] === 'inspiringMovementNoOA'
    );
    expect(selfNoOACall).toBeUndefined();
  });
});

// ── Inspiring Movement — uses tracking ─────────────────────────

describe('handle — Inspiring Movement uses tracking', () => {
  beforeEach(() => resetMocks());

  it('does not decrement uses when usesMax is 0', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 0 });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, mapName);

    const usesCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'bardicInspirationUses' || c[1]?.includes('Uses')
    );
    expect(usesCall).toBeUndefined();
  });

  it('decrements uses when usesMax > 0', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 3 });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce(2);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'bardicInspirationUses', 1, campaignName
    );
  });

  it('uses custom resourceKey when provided', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 3, resourceKey: 'customResource' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce(1);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'customResource', 0, campaignName
    );
  });

  it('exits early with no uses message when all uses consumed', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 1 });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('no uses remaining');
  });
});

// ── Inspiring Movement — ally granting ─────────────────────────

describe('handle — Inspiring Movement ally granting', () => {
  beforeEach(() => resetMocks());

  it('grants inspiring movement to ally when in range', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 2, gridY: 0 },
    });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally1' } });
    rangeValidation.getDistanceFeet.mockReturnValue(15);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Ally1', 'inspiringMovementGranted', true, campaignName
    );
  });

  it('grants noOA to ally when both noOAs and ally in range', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', noOAs: true });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 2, gridY: 0 },
    });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally1' } });
    rangeValidation.getDistanceFeet.mockReturnValue(15);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Ally1', 'inspiringMovementNoOA', true, campaignName
    );
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard', 'Ally1', [{ type: 'inspiring_movement_no_oa' }], campaignName, 1
    );
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard', 'Ally1', [{ type: 'inspiring_movement_granted' }], campaignName, 1
    );
  });

  it('does not grant to ally when out of range', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', allyRange: '10 ft' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(10);
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 10, gridY: 0 },
    });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally1' } });
    rangeValidation.getDistanceFeet.mockReturnValue(50);

    await handle(action, ps, campaignName, mapName);

    const grantCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'inspiringMovementGranted'
    );
    expect(grantCall).toBeUndefined();
  });
});

// ── Null safety ────────────────────────────────────────────────

describe('handle — null safety', () => {
  beforeEach(() => resetMocks());

  it('does not crash when playerStats.name is undefined', async () => {
    const ps = makePlayerStats({});
    delete ps.name;
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await expect(handle(action, ps, campaignName, mapName)).resolves.toBeDefined();
  });

  it('does not crash when playerStats.speed is undefined', async () => {
    const ps = makePlayerStats({});
    delete ps.speed;
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('half your Speed');
  });

  it('does not crash when campaignName is undefined', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await expect(handle(action, ps, undefined, mapName)).resolves.toBeDefined();
  });

  it('does not crash when mapName is undefined', async () => {
    const ps = makePlayerStats({ speed: 30 });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, undefined);

    expect(result.type).toBe('popup');
  });

  it('does not crash when logService.addEntry rejects', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    logService.addEntry.mockRejectedValue(new Error('fail'));

    await expect(handle(action, ps, campaignName, mapName)).resolves.toBeDefined();
  });
});
