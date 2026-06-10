import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../rules/expirations.js', () => ({
  addExpiration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../rules/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(),
}));

// ── Imports (Vite returns mocked versions) ─────────────────────

import { handle } from './reactionBonusHandler.js';
import * as targetResolver from '../common/targetResolver.js';
import * as useRuntimeState from '../../../hooks/useRuntimeState.js';
import * as expirations from '../../rules/expirations.js';
import * as logService from '../../ui/logService.js';
import * as rangeValidation from '../../rules/rangeValidation.js';

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

// ────────────────────────────────────────────────────────────────
// handle() — dispatch routing
// ────────────────────────────────────────────────────────────────

describe('handle — dispatch routing', () => {
  beforeEach(() => resetMocks());

  it('routes to Unbreakable Majesty when effect is miss_on_failed_save', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false); // not active - will activate

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('activated');
  });

  it('routes to Inspiring Movement when effect is miss_on_failed_save for toggle-off path', async () => {
    const action = makeAction({ effect: 'miss_on_failed_save' });
    const ps = makePlayerStats();

    // Already active — deactivation path
    useRuntimeState.getRuntimeValue.mockReturnValue(true);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('ended');
  });

  it('routes to Inspiring Movement for any non-miss_on_failed_save effect', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'inspiring_movement' });

    // usesMax defaults to null - evaluateUses(null) = 0, no uses check
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Test Reaction');
    expect(result.payload.description).toContain('You move up to 15 ft');
  });
});

// ────────────────────────────────────────────────────────────────
// handleUnbreakableMajesty — Deactivation path (wasActive)
// ────────────────────────────────────────────────────────────────

describe('handleUnbreakableMajesty — deactivation', () => {
  beforeEach(() => resetMocks());

  it('ends the ability when already active', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(true); // wasActive

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('ended');
  });

  it('sets unbreakableMajestyActive to null on deactivation', async () => {
    const ps = makePlayerStats({ name: 'Tyrion' });
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(true); // wasActive

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Tyrion', 'unbreakableMajestyActive', null, campaignName
    );
  });

  it('does NOT set duration or DC runtime values on deactivation', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(true); // wasActive

    await handle(action, ps, campaignName, mapName);

    const saveDcCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'unbreakableMajestySaveDc'
    );
    expect(saveDcCall).toBeUndefined();

    // No addExpiration call either — deactivation path returns early
    expect(expirations.addExpiration).not.toHaveBeenCalled();
  });

  it('adds a log entry on deactivation', async () => {
    const ps = makePlayerStats({ name: 'Paladin' });
    const action = makeAction({ effect: 'miss_on_failed_save' });
    action.name = 'Unbreakable Majesty';

    useRuntimeState.getRuntimeValue.mockReturnValue(true); // wasActive

    await handle(action, ps, campaignName, mapName);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Paladin',
        abilityName: 'Unbreakable Majesty',
      })
    );
  });

  it('log entry description contains "ended" on deactivation', async () => {
    const ps = makePlayerStats({ name: 'Jaina' });
    const action = makeAction({ effect: 'miss_on_failed_save' });
    action.name = 'Unbreakable Majesty';

    useRuntimeState.getRuntimeValue.mockReturnValue(true); // wasActive

    await handle(action, ps, campaignName, mapName);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        description: 'Jaina ended Unbreakable Majesty.',
      })
    );
  });

  it('popup payload name matches action.name', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });
    action.name = 'Divine Shield';

    useRuntimeState.getRuntimeValue.mockReturnValue(true); // wasActive

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.name).toBe('Divine Shield');
    expect(result.payload.description).toBe('Divine Shield ended.');
  });

  it('popup payload contains automation object', async () => {
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(true); // wasActive

    const result = await handle(action, campaignName, mapName);

    expect(result.payload.automation).toBe(action.automation);
  });

  it('catches and swallows addEntry errors on deactivation', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(true); // wasActive
    logService.addEntry.mockRejectedValue(new Error('network fail'));

    await expect(handle(action, ps, campaignName, mapName)).resolves.toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────
// handleUnbreakableMajesty — Activation path (not yet active)
// ────────────────────────────────────────────────────────────────

describe('handleUnbreakableMajesty — activation', () => {
  beforeEach(() => resetMocks());

  it('activates when not yet active', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false); // not active

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('activated');
  });

  it('sets unbreakableMajestyActive to true on activation', async () => {
    const ps = makePlayerStats({ name: 'Tyrion' });
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false); // not active

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Tyrion', 'unbreakableMajestyActive', true, campaignName
    );
  });

  it('calculates save DC from CHA bonus + proficiency', async () => {
    // Cha bonus=3, prof=2 - DC = 8 + 3 + 2 = 13
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false); // not active

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestySaveDc', 13, campaignName
    );
  });

  it('uses DC containing CHA bonus from abilities', async () => {
    const ps = makePlayerStats({
      abilities: [{ name: 'Charisma', bonus: 5 }],
      proficiency: 3, // DC = 8 + 5 + 3 = 16
    });
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestySaveDc', 16, campaignName
    );
  });

  it('defaults Cha bonus to 0 when ability not found', async () => {
    const ps = makePlayerStats({ abilities: [{ name: 'Strength', bonus: 3 }] }); // no Cha
    const action = makeAction({ effect: 'miss_on_failed_save' });
     // prof=2 - DC = 8 + 0 + 2 = 10

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestySaveDc', 10, campaignName
    );
  });

  it('defaults proficiency to 0 when missing', async () => {
    const ps = makePlayerStats({ abilities: [{ name: 'Charisma', bonus: 3 }], proficiency: undefined }); // no prof
    const action = makeAction({ effect: 'miss_on_failed_save' });
     // DC = 8 + 3 + 0 = 11

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Paladin', 'unbreakableMajestySaveDc', 11, campaignName
      );
  });

  it('includes DC in activation popup description', async () => {
    const ps = makePlayerStats(); // Cha=3, prof=2 - DC=13
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('DC 13');
  });

  it('adds expiration with unbreakable_majesty type', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, mapName);

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Paladin', 'Paladin', [{ type: 'unbreakable_majesty' }], campaignName, 10
    );
  });

  it('parses duration from auto.duration for expiration rounds', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '5_round' }); // 5 rounds

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, mapName);

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Paladin', 'Paladin', [{ type: 'unbreakable_majesty' }], campaignName, 5
    );
  });

  it('defaults duration rounds to 10 when parseDurationRounds returns undefined', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '' }); // empty - undefined

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, mapName);

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Paladin', 'Paladin', [{ type: 'unbreakable_majesty' }], campaignName, 10
    );
  });

  it('adds activation log entry with correct info', async () => {
    const ps = makePlayerStats({ name: 'Jaina' }); // DC=8+3+2=13 (default Cha)
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, mapName);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Jaina',
        abilityName: 'Test Reaction',
      })
    );
  });

  it('activation log description includes DC', async () => {
    const ps = makePlayerStats(); // DC=13 (Cha=3, prof=2)
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, mapName);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        description: expect.stringContaining('DC 13'),
        })
    );
  });

  it('activation popup description mentions duration', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('For 1_minute');
  });

  it('uses default duration text "1 minute" when auto.duration missing', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' }); // no duration

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('For 1 minute');
  });

  it('activation popup mentions Incapacitated as early end condition', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('Incapacitated');
  });

  it('activation does not set unbreakableMajestyActive to null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, mapName);

    // setRuntimeValue for unbreakableMajestyActive should be true, NOT null
    const activeCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'unbreakableMajestyActive'
    );
    expect(activeCall).toBeDefined();
    expect(activeCall[2]).toBe(true);
  });

  it('catches and swallows addEntry errors on activation', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);
    logService.addEntry.mockRejectedValue(new Error('fail'));

    await expect(handle(action, ps, campaignName, mapName)).resolves.toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────
// parseDurationRounds edge cases (tested via Unbreakable Majesty activation)
// ────────────────────────────────────────────────────────────────

describe('parseDurationRounds via handleUnbreakableMajesty', () => {
  beforeEach(() => resetMocks());

  it('parses "10_round" as 10 rounds', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '10_round' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, mapName);

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Paladin', 'Paladin', [{ type: 'unbreakable_majesty' }], campaignName, 10
    );
  });

  it('parses "1_round" as 1 round (case-insensitive)', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_Round' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, mapName);

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Paladin', 'Paladin', [{ type: 'unbreakable_majesty' }], campaignName, 1
    );
  });

  it('does NOT parse "5_minutes" — defaults to 10 rounds', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '5_minutes' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, mapName);

     // 5_minutes doesn't start with "1_minute" and doesn't match X_round - undefined - defaults to 10
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Paladin', 'Paladin', [{ type: 'unbreakable_majesty' }], campaignName, 10
    );
  });

  it('parses "1_minute" as 10 rounds (exact match)', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, mapName);

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Paladin', 'Paladin', [{ type: 'unbreakable_majesty' }], campaignName, 10
    );
  });
});

// ────────────────────────────────────────────────────────────────
// handleInspiringMovement — no map / no ally
// ────────────────────────────────────────────────────────────────

describe('handleInspiringMovement — no map or ally', () => {
  beforeEach(() => resetMocks());

  it('does not call resolveMapPositions when mapName is falsy', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'inspiring_movement' }); // routing to inspiring movement

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, null);

    expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
  });

  it('describes movement but no ally when mapName is falsy', async () => {
    const ps = makePlayerStats({ speed: 30 });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain('You move up to 15 ft');
    // Should mention selecting an ally since range is set but no map
    expect(result.payload.description).toContain('Select an ally within 30 ft');
  });

  it('does not call resolveMapPositions when allyRangeFt is null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'inspiring_movement' });
    rangeValidation.rangeToFeet.mockReturnValue(null); // allyRange resolves to null

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, mapName);

    expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
  });

  it('does not grant inspiring movement to self when noOAs is false', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'inspiring_movement', noOAs: false });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, mapName);

    // No inspiringMovementNoOA set on self when noOAs is false
    const noOACall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'inspiringMovementNoOA'
    );
    expect(noOACall).toBeUndefined();
  });

  it('sets inspiringMovementNoOA on self when noOAs is true', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', noOAs: true });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'inspiringMovementNoOA', true, campaignName
    );

    // Should also add an expiration for no_oa on self
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard', 'Bard', [{ type: 'inspiring_movement_no_oa' }], campaignName, 1
    );
  });

  it('description mentions Opportunity Attacks when noOAs is true', async () => {
    const ps = makePlayerStats({ speed: 30 });
    const action = makeAction({ effect: 'inspiring_movement', noOAs: true });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('This movement does not provoke Opportunity Attacks.');
  });

  it('description does NOT mention Opportunity Attacks when noOAs is false', async () => {
    const ps = makePlayerStats({ speed: 30 });
    const action = makeAction({ effect: 'inspiring_movement', noOAs: false });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).not.toContain('Opportunity Attacks');
  });

  it('uses player speed for half-speed calculation', async () => {
    const ps = makePlayerStats({ speed: 40 }); // half = 20
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('You move up to 20 ft');
  });

  it('defaults speed to 30 when playerStats.speed is missing', async () => {
    const ps = makePlayerStats({});
    delete ps.speed; // no speed - defaults to 30, half=15
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('You move up to 15 ft');
  });

  it('defaults speed to 30 when playerStats.speed is 0', async () => {
    const ps = makePlayerStats({ speed: 0 }); // falsy - defaults to 30
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('You move up to 15 ft');
  });
});

// ────────────────────────────────────────────────────────────────
// handleInspiringMovement — ally resolution via map
// ────────────────────────────────────────────────────────────────

describe('handleInspiringMovement — ally resolution', () => {
  beforeEach(() => resetMocks());

  it('resolves an in-range ally and grants inspiring movement', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0); // no uses to check
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 2, gridY: 0 }, // nearby
    });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally1' } });
    rangeValidation.getDistanceFeet.mockReturnValue(15); // within allyRange 30

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('Ally1 can also move');
  });

  it('sets inspiringMovementGranted on the ally', async () => {
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

  it('sets inspiringMovementNoOA on ally when noOAs is true', async () => {
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

    // Two addExpiration calls: one for self no_oa, one for ally granted + no_oa
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard', 'Ally1', [{ type: 'inspiring_movement_granted' }], campaignName, 1
    );
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard', 'Ally1', [{ type: 'inspiring_movement_no_oa' }], campaignName, 1
    );
  });

  it('does NOT set inspiringMovementNoOA on ally when noOAs is false', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', noOAs: false });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 2, gridY: 0 },
    });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally1' } });
    rangeValidation.getDistanceFeet.mockReturnValue(15);

    await handle(action, ps, campaignName, mapName);

    const allyNoOACall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[0] === 'Ally1' && c[1] === 'inspiringMovementNoOA'
    );
    expect(allyNoOACall).toBeUndefined();
  });

  it('does not grant ally movement when target is out of allyRange', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', allyRange: '10 ft' });
    rangeValidation.rangeToFeet.mockReturnValue(10);

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 10, gridY: 0 },
    });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally1' } });
    rangeValidation.getDistanceFeet.mockReturnValue(50); // out of range

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).not.toContain('Ally1 can also move');
    // Should mention selecting an ally since range check failed
    expect(result.payload.description).toContain('Select an ally within 10 ft');
  });

  it('does not resolve map positions when no target found', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 0, gridY: 0 } });
    targetResolver.resolveTarget.mockResolvedValue(null); // no target

    await handle(action, ps, campaignName, mapName);

    // No inspiringMovementGranted set since no ally resolved
    const grantCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'inspiringMovementGranted'
    );
    expect(grantCall).toBeUndefined();
  });

  it('does not resolve map positions when targetPos is missing from map', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 0, gridY: 0 } }); // no targetPos
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally1' } });

    await handle(action, ps, campaignName, mapName);

    const grantCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'inspiringMovementGranted'
    );
    expect(grantCall).toBeUndefined();
  });

  it('does not resolve positions when getDistanceFeet returns null', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 2, gridY: 0 },
    });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally1' } });
    rangeValidation.getDistanceFeet.mockReturnValue(null); // distance unknown

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).not.toContain('Ally1 can also move');
  });

  it('handles resolveMapPositions returning null', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue(null);

    await handle(action, ps, campaignName, mapName);

    // No ally grant should happen
    const grantCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'inspiringMovementGranted'
    );
    expect(grantCall).toBeUndefined();
  });

  it('handles resolveTarget returning null', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 0, gridY: 0 } });
    targetResolver.resolveTarget.mockResolvedValue(null);

    await handle(action, ps, campaignName, mapName);

    const grantCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'inspiringMovementGranted'
    );
    expect(grantCall).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────
// handleInspiringMovement — uses tracking
// ────────────────────────────────────────────────────────────────

describe('handleInspiringMovement — uses tracking', () => {
  beforeEach(() => resetMocks());

  it('returns early when all uses are exhausted (usesMax)', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 3 });

    useRuntimeState.getRuntimeValue.mockReturnValue(3); // usesUsed=3 >= usesMax=3

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('no uses remaining');
    expect(result.payload.description).toContain('Long Rest');
  });

  it('returns early when uses (numeric) matches used count', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ effect: 'inspiring_movement', uses: 2, usesMax: null }); // falls back to auto.uses

    useRuntimeState.getRuntimeValue.mockReturnValue(2); // >= 2

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('no uses remaining');
  });

  it('increments uses count when not exhausted (usesMax)', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 3, resourceKey: 'customUses' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce(1); // used=1 < max=3 - proceed

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'customUses', 2, campaignName
    );
  });

  it('defaults resourceKey to bardicInspirationUses when not provided', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 3, resourceKey: null });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce(0); // used=0 < max=3

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'bardicInspirationUses', 1, campaignName
    );
  });

  it('treats null getRuntimeValue as 0 uses used', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 3 });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce(null); // → Number(null ?? 0) = 0 < 3

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'bardicInspirationUses', 1, campaignName
    );
  });

  it('does NOT increment uses when usesMax is 0 (no tracking)', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 0 }); // 0 means no limit

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, mapName);

    // No setRuntimeValue for uses — the `if (usesMax > 0)` block is skipped
    const usesCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'bardicInspirationUses' || c[1].includes('Uses')
    );
    // There may be other setRuntimeValue calls (like inspiringMovementNoOA), but not for tracking
    expect(usesCall).toBeUndefined(); // no uses tracking when usesMax=0
  });

  it('evaluates string expression for usesMax', async () => {
    const ps = makePlayerStats({ proficiency: 2, level: 3 });
    // evaluateUses: 'proficiency_bonus' → replaces with prof=2 → evaluates to 2
    const action = makeAction({ effect: 'inspiring_movement', uses_expression: 'proficiency_bonus' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce(1); // used=1 < max=2

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalled();
  });

  it('uses level placeholder in expression', async () => {
    const ps = makePlayerStats({ proficiency: 4, level: 8 });
    // evaluateUses: 'level / 2' → 8/2 = 4
    const action = makeAction({ effect: 'inspiring_movement', uses_expression: 'level / 2' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce(3); // used=3 < max=4

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalled();
  });

  it('treats invalid expression as 0 uses (no tracking)', async () => {
    const ps = makePlayerStats({});
    // evaluateUses: 'INVALID_EXPR' → Function throws → returns 0
    const action = makeAction({ effect: 'inspiring_movement', uses_expression: 'INVALID_EXPR' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, mapName);

    // evaluateUses returns 0, so usesMax=0 → skips tracking block
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      'Paladin', 'bardicInspirationUses', expect.any(Number), campaignName
    );
  });




  it('does not call setRuntimeValue for uses on early exit', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 2 });

    useRuntimeState.getRuntimeValue.mockReturnValue(2); // used=2 >= max=2 → early return

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────
// handleInspiringMovement — log entry and payload
// ────────────────────────────────────────────────────────────────

describe('handleInspiringMovement — log and payload', () => {
  beforeEach(() => resetMocks());

  it('adds log entry without ally when no ally resolved', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    // No map — ally not resolved
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue(null);

    await handle(action, ps, campaignName, null); // no map

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Bard',
        abilityName: 'Test Reaction',
        description: 'Bard used Test Reaction.',
      })
    );
  });

  it('adds log entry with ally name when ally is resolved', async () => {
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

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        description: 'Bard used Test Reaction. Ally: Ally1.',
      })
    );
  });

  it('catches and swallows addEntry errors on Inspiring Movement', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    logService.addEntry.mockRejectedValue(new Error('fail'));

    await expect(handle(action, ps, campaignName, mapName)).resolves.toBeDefined();
  });

  it('returns popup with correct payload structure', async () => {
    const ps = makePlayerStats({ speed: 30 });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Test Reaction');
    expect(result.payload.automation).toBe(action.automation);
  });

  it('uses allyRange from auto in "select an ally" description', async () => {
    const ps = makePlayerStats({ speed: 30 });
    const action = makeAction({ effect: 'inspiring_movement', allyRange: '50 ft' });
    rangeValidation.rangeToFeet.mockReturnValue(50);

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    targetResolver.resolveMapPositions.mockResolvedValue(null); // can't resolve

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain('Select an ally within 50 ft');
  });

  it('uses default "30 ft" in description when auto.allyRange is not custom', async () => {
    const ps = makePlayerStats({ speed: 30 });
    const action = makeAction({ effect: 'inspiring_movement' }); // allyRange defaults to '30 ft'

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain('Select an ally within 30 ft');
  });
});

// ────────────────────────────────────────────────────────────────
// evaluateUses edge cases
// ────────────────────────────────────────────────────────────────

describe('evaluateUses edge cases', () => {
  beforeEach(() => resetMocks());

  it('treats null expression as 0 uses', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ effect: 'inspiring_movement' }); // no uses_expression → null in auto
      // uses falls back to (auto.usesMax ?? auto.uses ?? 0) = 0

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, mapName);
     // evaluateUses returns 0 for null expression, usesMax=0 → skips tracking
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      'Paladin', 'bardicInspirationUses', expect.any(Number), campaignName
    );
  });

  it('handles proficiency_bonus in expression correctly', async () => {
    const ps = makePlayerStats({ proficiency: 3, level: 5 });
    // evaluateUses('proficiency_bonus + 1') → 3+1=4
    const action = makeAction({ effect: 'inspiring_movement', uses_expression: 'proficiency_bonus + 1' });

    useRuntimeState.getRuntimeValue.mockReturnValue(2); // used=2 < max=4

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────
// Null safety — edge cases for all paths
// ────────────────────────────────────────────────────────────────

describe('null safety', () => {
  beforeEach(() => resetMocks());

  it('handles missing abilities array on playerStats (Majesty)', async () => {
    const ps = makePlayerStats({});
    delete ps.abilities; // no abilities → .find() returns undefined → bonus defaults to 0
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await expect(handle(action, ps, campaignName, mapName)).resolves.toBeDefined();
  });

  it('handles missing proficiency on playerStats', async () => {
    const ps = makePlayerStats({});
    delete ps.proficiency; // undefined → defaults to 0
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await expect(handle(action, ps, campaignName, mapName)).resolves.toBeDefined();
  });

  it('handles missing level on playerStats for evaluateUses', async () => {
    const ps = makePlayerStats({});
    delete ps.level; // undefined → defaults to 1 in evaluateUses (level || 1)
    const action = makeAction({ effect: 'inspiring_movement', uses_expression: 'level * 2' }); // 1*2=2

    useRuntimeState.getRuntimeValue.mockReturnValue(0); // used=0 < max=2 → proceed

    await expect(handle(action, ps, campaignName, mapName)).resolves.toBeDefined();
  });

  it('handles missing name on playerStats for getRuntimeValue calls', async () => {
    const ps = makePlayerStats({});
    delete ps.name; // undefined
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await expect(handle(action, ps, campaignName, mapName)).resolves.toBeDefined();
  });

  it('handles undefined getRuntimeValue return when not active (Majesty)', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(undefined); // === true → false, so activates

    await expect(handle(action, ps, campaignName, mapName)).resolves.toBeDefined();
  });

  it('handles getRuntimeValue returning non-boolean value for wasActive', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue('truthy'); // === true → false, activates

    await handle(action, ps, campaignName, mapName);

    // Should activate since 'truthy' !== true
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestyActive', true, campaignName
    );
  });

  it('handles resolveMapPositions returning empty object', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({}); // no attackerPos

    await handle(action, ps, campaignName, mapName);

    const grantCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'inspiringMovementGranted'
    );
    expect(grantCall).toBeUndefined();
  });

  it('handles targetInfo without target property', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 0, gridY: 0 } });
    targetResolver.resolveTarget.mockResolvedValue({}); // no .target property

    await handle(action, ps, campaignName, mapName);

    const grantCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'inspiringMovementGranted'
    );
    expect(grantCall).toBeUndefined();
  });

  it('handles targetInfo.target without name property', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 2, gridY: 0 },
    });
    targetResolver.resolveTarget.mockResolvedValue({ target: {} }); // no .name

    await handle(action, ps, campaignName, mapName);

    const grantCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'inspiringMovementGranted'
    );
    expect(grantCall).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────
// Activation cycle — toggle on then off for Unbreakable Majesty
// ────────────────────────────────────────────────────────────────

describe('Unbreakable Majesty activation cycle', () => {
  beforeEach(() => resetMocks());

  it('first call activates (wasActive=false)', async () => {
    const ps = makePlayerStats({ name: 'Paladin' });
    const action = makeAction({ effect: 'miss_on_failed_save', duration: '1_minute' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false); // not active yet

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('activated');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestyActive', true, campaignName
    );
  });

  it('second call deactivates (wasActive=true)', async () => {
    const ps = makePlayerStats({ name: 'Paladin' });
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(true); // already active

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toBe('Test Reaction ended.');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestyActive', null, campaignName
    );
  });
});

// ────────────────────────────────────────────────────────────────
// Unbreakable Majesty — DC calculation edge cases
// ────────────────────────────────────────────────────────────────

describe('Unbreakable Majesty DC calculation', () => {
  beforeEach(() => resetMocks());

  it('DC = 8 + Cha bonus (0) + prof (0) when all missing', async () => {
    const ps = makePlayerStats({
      abilities: [], // no Cha ability
    });
    delete ps.proficiency;
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestySaveDc', 8, campaignName
    ); // DC = 8 + 0 + 0
  });

  it('Cha bonus from ability with no name field uses 0', async () => {
    const ps = makePlayerStats({ abilities: [{ bonus: 5 }] }); // no .name → find fails → 0
    const action = makeAction({ effect: 'miss_on_failed_save' });

    useRuntimeState.getRuntimeValue.mockReturnValue(false);

    await handle(action, ps, campaignName, mapName);

    // prof=2, Cha bonus=0 (no name match) → DC = 8 + 0 + 2 = 10
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin', 'unbreakableMajestySaveDc', 10, campaignName
    );
  });
});
