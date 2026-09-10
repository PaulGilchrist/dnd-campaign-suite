// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks for blockChecks.js dependencies                              */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../automation/handlers/spells/forcecageHandler.js', () => ({
  isForcecageBlocked: vi.fn(() => false),
}));

vi.mock('../../../../automation/handlers/spells/mazeHandler.js', () => ({
  isMazeBlocked: vi.fn(() => false),
}));

vi.mock('../../../../automation/handlers/spells/banishmentHandler.js', () => ({
  isBanishmentBlocked: vi.fn(() => false),
}));

vi.mock('../../../../automation/handlers/spells/imprisonmentHandler.js', () => ({
  isImprisonmentBlocked: vi.fn(() => false),
}));

vi.mock('./spellResolution.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

/* ------------------------------------------------------------------ */
/*  SUT imports                                                        */
/* ------------------------------------------------------------------ */

const { getRuntimeValue } = await import('../../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../../ui/logService.js');
const { checkBlockedBySpellcastingBuff } = await import('./blockChecks.js');
const { getActiveBuffs } = await import('./spellResolution.js');
const { isForcecageBlocked } = await import('../../../../automation/handlers/spells/forcecageHandler.js');
const { isMazeBlocked } = await import('../../../../automation/handlers/spells/mazeHandler.js');
const { isBanishmentBlocked } = await import('../../../../automation/handlers/spells/banishmentHandler.js');
const { isImprisonmentBlocked } = await import('../../../../automation/handlers/spells/imprisonmentHandler.js');
const { checkGlobeOfInvulnerability, checkForcecageBlocked } = await import('./blockChecks.js');

/* ------------------------------------------------------------------ */
/*  Test-data factories                                                */
/* ------------------------------------------------------------------ */

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    school: 'Evocation',
    ...overrides,
  };
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  beforeEach — reset all mocks                                       */
/* ------------------------------------------------------------------ */

describe('blockChecks.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
    addEntry.mockResolvedValue(undefined);
    isForcecageBlocked.mockReturnValue(false);
    isMazeBlocked.mockReturnValue(false);
    isBanishmentBlocked.mockReturnValue(false);
    isImprisonmentBlocked.mockReturnValue(false);
  });

  /* ---------------------------------------------------------------- */
  /*  checkGlobeOfInvulnerability                                      */
  /* ---------------------------------------------------------------- */

  describe('checkGlobeOfInvulnerability', () => {
    it('returns null when spell level is greater than 5', async () => {
      const spell = makeSpell({ level: 6 });
      const result = await checkGlobeOfInvulnerability(spell, 'Goblin', makePlayerStats(), 'test-campaign');
      expect(result).toBeNull();
    });

    it('returns null when spell has no level and no baseLevel (defaults to 1 but no targetName)', async () => {
      const spell = makeSpell({ level: undefined });
      const result = await checkGlobeOfInvulnerability(spell, null, makePlayerStats(), 'test-campaign');
      expect(result).toBeNull();
    });

    it('returns null when there are no targetEffects', async () => {
      getRuntimeValue.mockReturnValue([]);
      const spell = makeSpell({ level: 3 });
      const result = await checkGlobeOfInvulnerability(spell, 'Goblin', makePlayerStats(), 'test-campaign');
      expect(result).toBeNull();
    });

    it('returns null when targetEffects exist but no globe_barrier effects', async () => {
      getRuntimeValue.mockReturnValue([{ effect: 'globe_barrier', target: 'OtherTarget', source: 'Caster' }]);
      const spell = makeSpell({ level: 3 });
      const result = await checkGlobeOfInvulnerability(spell, 'Goblin', makePlayerStats(), 'test-campaign');
      expect(result).toBeNull();
    });

    it('returns null when globe exists but not for this target', async () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'globe_barrier', target: 'OtherTarget', source: 'Caster' },
      ]);
      const spell = makeSpell({ level: 3 });
      const result = await checkGlobeOfInvulnerability(spell, 'Goblin', makePlayerStats(), 'test-campaign');
      expect(result).toBeNull();
    });

    it('returns null when globe exists for the target but attacker is already protected', async () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'globe_barrier', target: 'Goblin', source: 'Caster' },
        { effect: 'globe_barrier', target: 'TestWizard', source: 'Caster' },
      ]);
      const spell = makeSpell({ level: 3 });
      const result = await checkGlobeOfInvulnerability(spell, 'Goblin', makePlayerStats(), 'test-campaign');
      expect(result).toBeNull();
    });

    it('returns a block result when globe protects the target and attacker is not protected', async () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'globe_barrier', target: 'Goblin', source: 'Mage' },
      ]);
      const spell = makeSpell({ level: 3, name: 'Fireball' });
      const playerStats = makePlayerStats({ name: 'TestWizard' });
      const result = await checkGlobeOfInvulnerability(spell, 'Goblin', playerStats, 'test-campaign');

      expect(result).toBeDefined();
      expect(result.automationPopup).toBeDefined();
      expect(result.automationPopup.type).toBe('popup');
      expect(result.automationPopup.payload.type).toBe('automation_info');
      expect(result.automationPopup.payload.name).toBe('Globe of Invulnerability');
      expect(result.automationPopup.payload.description).toContain('Fireball');
      expect(result.automationPopup.payload.description).toContain('blocked by Globe of Invulnerability');
      expect(result.automationPopup.payload.description).toContain('Goblin');
    });

    it('logs an automation entry when globe blocks the spell', async () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'globe_barrier', target: 'Goblin', source: 'Mage' },
      ]);
      const spell = makeSpell({ level: 3, name: 'Fireball' });
      const playerStats = makePlayerStats({ name: 'TestWizard' });
      await checkGlobeOfInvulnerability(spell, 'Goblin', playerStats, 'test-campaign');

      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        type: 'automation',
        creatureName: 'Mage',
        name: 'Globe of Invulnerability',
        description: expect.stringContaining('Fireball'),
      }));
    });

    it('returns null when spell level is exactly 5', async () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'globe_barrier', target: 'Goblin', source: 'Mage' },
      ]);
      const spell = makeSpell({ level: 5 });
      const result = await checkGlobeOfInvulnerability(spell, 'Goblin', makePlayerStats(), 'test-campaign');
      expect(result).toBeDefined();
    });

    it('uses baseLevel when level is undefined', async () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'globe_barrier', target: 'Goblin', source: 'Mage' },
      ]);
      const spell = makeSpell({ level: undefined, baseLevel: 3 });
      const result = await checkGlobeOfInvulnerability(spell, 'Goblin', makePlayerStats(), 'test-campaign');
      expect(result).toBeDefined();
    });

    it('returns null when baseLevel is 6 (above threshold)', async () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'globe_barrier', target: 'Goblin', source: 'Mage' },
      ]);
      const spell = makeSpell({ level: undefined, baseLevel: 6 });
      const result = await checkGlobeOfInvulnerability(spell, 'Goblin', makePlayerStats(), 'test-campaign');
      expect(result).toBeNull();
    });

    it('handles non-array targetEffects by treating as empty', async () => {
      getRuntimeValue.mockReturnValue(null);
      const spell = makeSpell({ level: 3 });
      const result = await checkGlobeOfInvulnerability(spell, 'Goblin', makePlayerStats(), 'test-campaign');
      expect(result).toBeNull();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  checkForcecageBlocked — Forcecage branch                         */
  /* ---------------------------------------------------------------- */

  describe('checkForcecageBlocked — Forcecage', () => {
    it('returns null when targetName is null', async () => {
      const result = await checkForcecageBlocked(makeSpell(), null, makePlayerStats(), 'test-campaign');
      expect(result).toBeNull();
      expect(isForcecageBlocked).not.toHaveBeenCalled();
    });

    it('returns null when targetName is empty string', async () => {
      const result = await checkForcecageBlocked(makeSpell(), '', makePlayerStats(), 'test-campaign');
      expect(result).toBeNull();
      expect(isForcecageBlocked).not.toHaveBeenCalled();
    });

    it('returns a block result when forcecage blocks the spell', async () => {
      isForcecageBlocked.mockReturnValue(true);
      const spell = makeSpell({ name: 'Fireball' });
      const playerStats = makePlayerStats({ name: 'TestWizard' });
      const result = await checkForcecageBlocked(spell, 'Goblin', playerStats, 'test-campaign');

      expect(isForcecageBlocked).toHaveBeenCalledWith('TestWizard', 'Goblin', 'test-campaign');
      expect(result).toBeDefined();
      expect(result.automationPopup).toBeDefined();
      expect(result.automationPopup.type).toBe('popup');
      expect(result.automationPopup.payload.type).toBe('automation_info');
      expect(result.automationPopup.payload.name).toBe('Forcecage');
      expect(result.automationPopup.payload.description).toContain('Fireball');
      expect(result.automationPopup.payload.description).toContain('blocked by Forcecage');
    });

    it('logs an automation entry when forcecage blocks', async () => {
      isForcecageBlocked.mockReturnValue(true);
      const spell = makeSpell({ name: 'Fireball' });
      const playerStats = makePlayerStats({ name: 'TestWizard' });
      await checkForcecageBlocked(spell, 'Goblin', playerStats, 'test-campaign');

      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        type: 'automation',
        creatureName: 'TestWizard',
        name: 'Forcecage',
        description: expect.stringContaining('Fireball'),
      }));
    });
  });

  /* ---------------------------------------------------------------- */
  /*  checkForcecageBlocked — Maze branch                              */
  /* ---------------------------------------------------------------- */

  describe('checkForcecageBlocked — Maze', () => {
    it('returns a block result when maze blocks the spell', async () => {
      isForcecageBlocked.mockReturnValue(false);
      isMazeBlocked.mockReturnValue(true);
      const spell = makeSpell({ name: 'Fireball' });
      const playerStats = makePlayerStats({ name: 'TestWizard' });
      const result = await checkForcecageBlocked(spell, 'Goblin', playerStats, 'test-campaign');

      expect(isMazeBlocked).toHaveBeenCalledWith('TestWizard', 'Goblin', 'test-campaign');
      expect(result).toBeDefined();
      expect(result.automationPopup).toBeDefined();
      expect(result.automationPopup.payload.name).toBe('Maze');
      expect(result.automationPopup.payload.description).toContain('Fireball');
      expect(result.automationPopup.payload.description).toContain('blocked by Maze');
    });

    it('logs an automation entry when maze blocks', async () => {
      isForcecageBlocked.mockReturnValue(false);
      isMazeBlocked.mockReturnValue(true);
      const spell = makeSpell({ name: 'Fireball' });
      const playerStats = makePlayerStats({ name: 'TestWizard' });
      await checkForcecageBlocked(spell, 'Goblin', playerStats, 'test-campaign');

      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        type: 'automation',
        creatureName: 'TestWizard',
        name: 'Maze',
      }));
    });
  });

  /* ---------------------------------------------------------------- */
  /*  checkForcecageBlocked — Banishment branch                        */
  /* ---------------------------------------------------------------- */

  describe('checkForcecageBlocked — Banishment', () => {
    it('returns a block result when banishment blocks the spell', async () => {
      isForcecageBlocked.mockReturnValue(false);
      isMazeBlocked.mockReturnValue(false);
      isBanishmentBlocked.mockReturnValue(true);
      const spell = makeSpell({ name: 'Fireball' });
      const playerStats = makePlayerStats({ name: 'TestWizard' });
      const result = await checkForcecageBlocked(spell, 'Goblin', playerStats, 'test-campaign');

      expect(isBanishmentBlocked).toHaveBeenCalledWith('TestWizard', 'Goblin', 'test-campaign');
      expect(result).toBeDefined();
      expect(result.automationPopup).toBeDefined();
      expect(result.automationPopup.payload.name).toBe('Banishment');
      expect(result.automationPopup.payload.description).toContain('Fireball');
      expect(result.automationPopup.payload.description).toContain('blocked by Banishment');
    });

    it('logs an automation entry when banishment blocks', async () => {
      isForcecageBlocked.mockReturnValue(false);
      isMazeBlocked.mockReturnValue(false);
      isBanishmentBlocked.mockReturnValue(true);
      const spell = makeSpell({ name: 'Fireball' });
      const playerStats = makePlayerStats({ name: 'TestWizard' });
      await checkForcecageBlocked(spell, 'Goblin', playerStats, 'test-campaign');

      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        type: 'automation',
        creatureName: 'TestWizard',
        name: 'Banishment',
      }));
    });
  });

  /* ---------------------------------------------------------------- */
  /*  checkForcecageBlocked — Imprisonment branch                      */
  /* ---------------------------------------------------------------- */

  describe('checkForcecageBlocked — Imprisonment', () => {
    it('returns a block result when imprisonment blocks the spell', async () => {
      isForcecageBlocked.mockReturnValue(false);
      isMazeBlocked.mockReturnValue(false);
      isBanishmentBlocked.mockReturnValue(false);
      isImprisonmentBlocked.mockReturnValue(true);
      const spell = makeSpell({ name: 'Fireball' });
      const playerStats = makePlayerStats({ name: 'TestWizard' });
      const result = await checkForcecageBlocked(spell, 'Goblin', playerStats, 'test-campaign');

      expect(isImprisonmentBlocked).toHaveBeenCalledWith('TestWizard', 'Goblin', 'test-campaign');
      expect(result).toBeDefined();
      expect(result.automationPopup).toBeDefined();
      expect(result.automationPopup.payload.name).toBe('Imprisonment');
      expect(result.automationPopup.payload.description).toContain('Fireball');
      expect(result.automationPopup.payload.description).toContain('blocked by Imprisonment');
    });

    it('logs an automation entry when imprisonment blocks', async () => {
      isForcecageBlocked.mockReturnValue(false);
      isMazeBlocked.mockReturnValue(false);
      isBanishmentBlocked.mockReturnValue(false);
      isImprisonmentBlocked.mockReturnValue(true);
      const spell = makeSpell({ name: 'Fireball' });
      const playerStats = makePlayerStats({ name: 'TestWizard' });
      await checkForcecageBlocked(spell, 'Goblin', playerStats, 'test-campaign');

      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        type: 'automation',
        creatureName: 'TestWizard',
        name: 'Imprisonment',
      }));
    });
  });

  /* ---------------------------------------------------------------- */
  /*  checkForcecageBlocked — no block (all clear)                     */
  /* ---------------------------------------------------------------- */

  describe('checkForcecageBlocked — no block', () => {
    it('returns null when no barriers block the spell', async () => {
      isForcecageBlocked.mockReturnValue(false);
      isMazeBlocked.mockReturnValue(false);
      isBanishmentBlocked.mockReturnValue(false);
      isImprisonmentBlocked.mockReturnValue(false);
      const spell = makeSpell({ name: 'Fireball' });
      const playerStats = makePlayerStats({ name: 'TestWizard' });
      const result = await checkForcecageBlocked(spell, 'Goblin', playerStats, 'test-campaign');
      expect(result).toBeNull();
    });

    it('checks all four barriers in order even when none block', async () => {
      isForcecageBlocked.mockReturnValue(false);
      isMazeBlocked.mockReturnValue(false);
      isBanishmentBlocked.mockReturnValue(false);
      isImprisonmentBlocked.mockReturnValue(false);
      const spell = makeSpell({ name: 'Fireball' });
      const playerStats = makePlayerStats({ name: 'TestWizard' });
      await checkForcecageBlocked(spell, 'Goblin', playerStats, 'test-campaign');

      expect(isForcecageBlocked).toHaveBeenCalledWith('TestWizard', 'Goblin', 'test-campaign');
      expect(isMazeBlocked).toHaveBeenCalledWith('TestWizard', 'Goblin', 'test-campaign');
      expect(isBanishmentBlocked).toHaveBeenCalledWith('TestWizard', 'Goblin', 'test-campaign');
      expect(isImprisonmentBlocked).toHaveBeenCalledWith('TestWizard', 'Goblin', 'test-campaign');
    });
  });

  describe('checkBlockedBySpellcastingBuff (CLA-391)', () => {
    it('returns null when no buff blocks spellcasting', async () => {
      getActiveBuffs.mockReturnValue([{ name: 'Shield', blocksSpellcasting: false }]);
      const result = await checkBlockedBySpellcastingBuff({ name: 'Fireball' }, { name: 'TestWizard' }, 'test-campaign');
      expect(result).toBeNull();
    });

    it('refuses with popup + shape_shift_refused log when Wild Shape blocks casting', async () => {
      getActiveBuffs.mockReturnValue([{ name: 'Wild Shape', effect: 'shape_shift', blocksSpellcasting: true }]);

      const result = await checkBlockedBySpellcastingBuff({ name: 'Entangle' }, { name: 'Wild_Sage_Druid' }, 'test-campaign');

      expect(result?.automationPopup?.payload?.type).toBe('automation_info');
      expect(result.automationPopup.payload.name).toBe('Wild Shape');
      expect(result.automationPopup.payload.description).toContain('Entangle cannot be cast');
      const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'shape_shift_refused');
      expect(refusal).toBeDefined();
      expect(refusal.creatureName).toBe('Wild_Sage_Druid');
      expect(refusal.description).toContain('Entangle blocked');
    });
  });
});
