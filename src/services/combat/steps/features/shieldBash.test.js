// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn((name) => ({ baseName: name, magicBonus: 0 })),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../automation/common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(() => 13),
  createSaveListener: vi.fn(() => ({ promise: Promise.resolve({ success: false, total: 7, roll: 7, saveBonus: 0 }) })),
}));

vi.mock('../../../automation/common/oncePerTurn.js', () => ({
  checkOncePerTurnWithSkip: vi.fn(() => null),
}));

vi.mock('../../../../services/combat/conditions/conditionSaveService.js', () => ({
  addCondition: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(() => Promise.resolve(true)),
}));

// ── Imports ──────────────────────────────────────────────────────

import { shieldBash, applyShieldBashEffect, restoreBaseAttackAfterBash } from './shieldBash.js';

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { parseMagicItemName } from '../../../rules/core/attackCalc.js';
import { addEntry } from '../../../ui/logService.js';
import { buildSaveDc, createSaveListener } from '../../../automation/common/savePrompt.js';
import { checkOncePerTurnWithSkip } from '../../../automation/common/oncePerTurn.js';
import { addCondition } from '../../../../services/combat/conditions/conditionSaveService.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    playerStats: { name: 'Fighter1' },
    ...overrides,
  };
}

function makeShieldPassive(options = {}) {
  return {
    type: 'attack_rider',
    trigger: 'melee_hit_with_shield_equipped',
    options: ['push', 'prone'],
    automation: { saveDc: 'ability', saveAbility: 'STR' },
    ...options,
  };
}

function makeNewStylePassive(options = {}) {
  return {
    type: 'attack_rider',
    effect: 'push_or_prone',
    oncePerTurn: true,
    automation: { saveDc: 'ability', saveAbility: 'STR' },
    ...options,
  };
}

function makeShieldCtx(extraPassives) {
  const passives = extraPassives || [makeShieldPassive()];
  return makeCtx({
    playerStats: {
      name: 'Fighter1',
      automation: { passives },
      inventory: { equipped: ['Shield'] },
      equipment: [{ name: 'Shield', armor_category: 'Shield' }],
    },
  });
}

const PREV_DATA = { formula: '1d8+3' };

// ── Tests ────────────────────────────────────────────────────────

describe('shieldBash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('condition', () => {
    it('returns true when automation.passives exists', () => {
      const ctx = makeCtx({ playerStats: { automation: { passives: [makeShieldPassive()] } } });
      expect(shieldBash.condition(ctx)).toBe(true);
    });

    it('returns false when automation.passives is missing', () => {
      expect(shieldBash.condition(makeCtx({ playerStats: { automation: {} } }))).toBe(false);
    });

    it('returns false when automation is missing', () => {
      expect(shieldBash.condition(makeCtx({ playerStats: {} }))).toBe(false);
    });

    it('throws when playerStats is null', () => {
      expect(() => shieldBash.condition(makeCtx({ playerStats: null }))).toThrow();
    });
  });

  describe('handler', () => {
    describe('early returns — no shield bash passive', () => {
      it('returns null when no passives exist', async () => {
        const ctx = makeCtx({ playerStats: { automation: { passives: [] } } });
        expect(await shieldBash.handler(ctx, PREV_DATA)).toBeNull();
      });

      it('returns null when no passive matches old-style', async () => {
        const ctx = makeCtx({ playerStats: { automation: { passives: [{ type: 'attack_rider', effect: 'other' }] } } });
        expect(await shieldBash.handler(ctx, PREV_DATA)).toBeNull();
      });

      it('returns null when no passive matches new-style', async () => {
        const ctx = makeCtx({ playerStats: { automation: { passives: [{ type: 'attack_rider', effect: 'other', oncePerTurn: true }] } } });
        expect(await shieldBash.handler(ctx, PREV_DATA)).toBeNull();
      });
    });

    describe('early returns — lastAttack checks', () => {
      function setupShieldCtx() {
        return makeShieldCtx();
      }

      it('returns { data: prevData } when lastAttack is null', async () => {
        getRuntimeValue.mockResolvedValue(null);
        expect(await shieldBash.handler(setupShieldCtx(), PREV_DATA)).toEqual({ data: PREV_DATA });
      });

      it('returns { data: prevData } when lastAttack.hit is false', async () => {
        getRuntimeValue.mockResolvedValue({ hit: false, targetName: 'Goblin1' });
        expect(await shieldBash.handler(setupShieldCtx(), PREV_DATA)).toEqual({ data: PREV_DATA });
      });

      it('returns { data: prevData } when attackerName does not match player', async () => {
        getRuntimeValue.mockResolvedValue({ hit: true, attackerName: 'Goblin1', weaponType: 'melee', targetName: 'Goblin2' });
        expect(await shieldBash.handler(setupShieldCtx(), PREV_DATA)).toEqual({ data: PREV_DATA });
      });

      it('returns { data: prevData } when weaponType is ranged', async () => {
        getRuntimeValue.mockResolvedValue({ hit: true, attackerName: 'Fighter1', weaponType: 'ranged', targetName: 'Goblin1' });
        expect(await shieldBash.handler(setupShieldCtx(), PREV_DATA)).toEqual({ data: PREV_DATA });
      });

      it('returns { data: prevData } when targetName is missing', async () => {
        getRuntimeValue.mockResolvedValue({ hit: true, attackerName: 'Fighter1', weaponType: 'melee' });
        expect(await shieldBash.handler(setupShieldCtx(), PREV_DATA)).toEqual({ data: PREV_DATA });
      });
    });

    describe('early returns — shield check', () => {
      it('returns { data: prevData } when no shield equipped', async () => {
        const ctx = makeCtx({
          playerStats: {
            name: 'Fighter1',
            automation: { passives: [makeShieldPassive()] },
            inventory: { equipped: ['Longsword'] },
            equipment: [{ name: 'Longsword', armor_category: 'Heavy', equipment_category: 'Weapon' }],
          },
        });
        getRuntimeValue.mockResolvedValue({ hit: true, attackerName: 'Fighter1', weaponType: 'melee', targetName: 'Goblin1' });
        checkOncePerTurnWithSkip.mockResolvedValue(null);
        expect(await shieldBash.handler(ctx, PREV_DATA)).toEqual({ data: PREV_DATA });
      });

      it('returns { data: prevData } when shield equipped but checkOncePerTurn skips (armor_category)', async () => {
        checkOncePerTurnWithSkip.mockResolvedValue({ type: 'popup' });
        parseMagicItemName.mockReturnValue({ baseName: 'Shield', magicBonus: 0 });
        const ctx = makeCtx({
          playerStats: {
            name: 'Fighter1',
            automation: { passives: [makeShieldPassive()] },
            inventory: { equipped: ['Shield'] },
            equipment: [{ name: 'Shield', armor_category: 'Shield' }],
          },
        });
        getRuntimeValue.mockResolvedValue({ hit: true, attackerName: 'Fighter1', weaponType: 'melee', targetName: 'Goblin1' });
        expect(await shieldBash.handler(ctx, PREV_DATA)).toEqual({ data: PREV_DATA });
      });

      it('returns { data: prevData } when shield equipped but checkOncePerTurn skips (equipment_category)', async () => {
        checkOncePerTurnWithSkip.mockResolvedValue({ type: 'popup' });
        parseMagicItemName.mockReturnValue({ baseName: 'Shield', magicBonus: 0 });
        const ctx = makeCtx({
          playerStats: {
            name: 'Fighter1',
            automation: { passives: [makeShieldPassive()] },
            inventory: { equipped: ['Shield'] },
            equipment: [{ name: 'Shield', equipment_category: 'Shield' }],
          },
        });
        getRuntimeValue.mockResolvedValue({ hit: true, attackerName: 'Fighter1', weaponType: 'melee', targetName: 'Goblin1' });
        expect(await shieldBash.handler(ctx, PREV_DATA)).toEqual({ data: PREV_DATA });
      });
    });

    describe('early returns — oncePerTurn skip', () => {
      it('returns { data: prevData } when checkOncePerTurnWithSkip returns truthy', async () => {
        checkOncePerTurnWithSkip.mockResolvedValue({ type: 'popup' });
        parseMagicItemName.mockReturnValue({ baseName: 'Shield', magicBonus: 0 });
        const ctx = makeCtx({
          playerStats: {
            name: 'Fighter1',
            automation: { passives: [makeShieldPassive()] },
            inventory: { equipped: ['Shield'] },
            equipment: [{ name: 'Shield', armor_category: 'Shield' }],
          },
        });
        getRuntimeValue.mockResolvedValue({ hit: true, attackerName: 'Fighter1', weaponType: 'melee', targetName: 'Goblin1' });
        expect(await shieldBash.handler(ctx, PREV_DATA)).toEqual({ data: PREV_DATA });
      });
    });

    describe('save prompt flow — failed save', () => {
      function setupSaveFlow(saveResult) {
        getRuntimeValue.mockResolvedValue({ hit: true, attackerName: 'Fighter1', weaponType: 'melee', targetName: 'Goblin1' });
        checkOncePerTurnWithSkip.mockResolvedValue(null);
        parseMagicItemName.mockReturnValue({ baseName: 'Shield', magicBonus: 0 });
        buildSaveDc.mockReturnValue(15);
        createSaveListener.mockReturnValue({ promise: Promise.resolve(saveResult) });
        return makeShieldCtx();
      }

      it('creates save listener and returns modal on failed save', async () => {
        const ctx = setupSaveFlow({ success: false, total: 5, roll: 5, saveBonus: 0 });
        const result = await shieldBash.handler(ctx, PREV_DATA);

        expect(createSaveListener).toHaveBeenCalledWith(
          'test-campaign',
          expect.objectContaining({ targetName: 'Goblin1', saveType: 'STR', saveDc: 15, dcSuccess: false, sourceName: 'Shield Bash' }),
        );
        expect(addEntry).toHaveBeenCalledTimes(2);
        expect(addEntry).toHaveBeenNthCalledWith(1, 'test-campaign', expect.objectContaining({
          type: 'roll', name: 'Shield Bash', targetName: 'Goblin1', saveDc: 15, saveType: 'STR',
        }));
        expect(result).toHaveProperty('modal');
        expect(result.modal.type).toBe('shieldBash');
        expect(result.modal.props.action.name).toBe('Shield Bash');
        expect(result.modal.props.targetName).toBe('Goblin1');
        expect(result.modal.props.saveDc).toBe(15);
      });

      it('returns { data: prevData } on successful save', async () => {
        const ctx = setupSaveFlow({ success: true, total: 18, roll: 13, saveBonus: 5 });
        const result = await shieldBash.handler(ctx, PREV_DATA);
        expect(result).toEqual({ data: PREV_DATA });
        expect(addEntry).toHaveBeenCalledTimes(2);
      });
    });

    describe('save prompt flow — log entries', () => {
      function setupLogFlow(saveResult) {
        getRuntimeValue.mockResolvedValue({ hit: true, attackerName: 'Fighter1', weaponType: 'melee', targetName: 'Orc1' });
        checkOncePerTurnWithSkip.mockResolvedValue(null);
        parseMagicItemName.mockReturnValue({ baseName: 'Shield', magicBonus: 0 });
        buildSaveDc.mockReturnValue(16);
        createSaveListener.mockReturnValue({ promise: Promise.resolve(saveResult) });
        return makeShieldCtx();
      }

      it('logs save result with correct fields on failure', async () => {
        const ctx = setupLogFlow({ success: false, total: 8, roll: 6, saveBonus: 2 });
        await shieldBash.handler(ctx, PREV_DATA);
        const entry = addEntry.mock.calls[1][1];
        expect(entry).toMatchObject({ type: 'roll', saveResult: 'failure', total: 8, rolls: [6], bonus: 2, formula: '1d20+2' });
        expect(entry.description).toContain('failed');
      });

      it('logs save result with correct fields on success', async () => {
        const ctx = setupLogFlow({ success: true, total: 20, roll: 15, saveBonus: 5 });
        await shieldBash.handler(ctx, PREV_DATA);
        const entry = addEntry.mock.calls[1][1];
        expect(entry).toMatchObject({ type: 'roll', saveResult: 'success', total: 20, rolls: [15], bonus: 5, formula: '1d20+5' });
        expect(entry.description).toContain('succeeded');
      });

      it('logs save result with zero bonus', async () => {
        buildSaveDc.mockReturnValue(13);
        createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false, total: 13, roll: 13, saveBonus: 0 }) });
        getRuntimeValue.mockResolvedValue({ hit: true, attackerName: 'Fighter1', weaponType: 'melee', targetName: 'Orc1' });
        checkOncePerTurnWithSkip.mockResolvedValue(null);
        parseMagicItemName.mockReturnValue({ baseName: 'Shield', magicBonus: 0 });
        const ctx = makeShieldCtx();
        await shieldBash.handler(ctx, PREV_DATA);
        const entry = addEntry.mock.calls[1][1];
        expect(entry.bonus).toBe(0);
        expect(entry.formula).toBe('1d20');
      });
    });

    describe('save DC calculation', () => {
      it('uses buildSaveDc when new-style passive has automation', async () => {
        buildSaveDc.mockReturnValue(17);
        createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false, total: 5, roll: 5, saveBonus: 0 }) });
        getRuntimeValue.mockResolvedValue({ hit: true, attackerName: 'Fighter1', weaponType: 'melee', targetName: 'Goblin1' });
        checkOncePerTurnWithSkip.mockResolvedValue(null);
        parseMagicItemName.mockReturnValue({ baseName: 'Shield', magicBonus: 0 });
        const ctx = makeCtx({
          playerStats: {
            name: 'Fighter1',
            automation: { passives: [makeNewStylePassive()] },
            inventory: { equipped: ['Shield'] },
            equipment: [{ name: 'Shield', armor_category: 'Shield' }],
          },
        });
        await shieldBash.handler(ctx, PREV_DATA);
        expect(buildSaveDc).toHaveBeenCalledWith(expect.objectContaining({ saveDc: 'ability', saveAbility: 'STR' }), expect.any(Object));
        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ saveDc: 17 }));
      });

      it('uses buildSaveDc when old-style passive has automation', async () => {
        buildSaveDc.mockReturnValue(14);
        createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false, total: 5, roll: 5, saveBonus: 0 }) });
        getRuntimeValue.mockResolvedValue({ hit: true, attackerName: 'Fighter1', weaponType: 'melee', targetName: 'Goblin1' });
        checkOncePerTurnWithSkip.mockResolvedValue(null);
        parseMagicItemName.mockReturnValue({ baseName: 'Shield', magicBonus: 0 });
        const ctx = makeShieldCtx();
        await shieldBash.handler(ctx, PREV_DATA);
        expect(buildSaveDc).toHaveBeenCalledWith(expect.objectContaining({ saveDc: 'ability', saveAbility: 'STR' }), expect.any(Object));
      });

      it('uses fallback DC calculation when passive has no automation', async () => {
        createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false, total: 5, roll: 5, saveBonus: 0 }) });
        getRuntimeValue.mockResolvedValue({ hit: true, attackerName: 'Fighter1', weaponType: 'melee', targetName: 'Goblin1' });
        checkOncePerTurnWithSkip.mockResolvedValue(null);
        parseMagicItemName.mockReturnValue({ baseName: 'Shield', magicBonus: 0 });
        const ctx = makeCtx({
          playerStats: {
            name: 'Fighter1',
            automation: { passives: [{ type: 'attack_rider', trigger: 'melee_hit_with_shield_equipped', options: ['push'] }] },
            inventory: { equipped: ['Shield'] },
            equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            abilities: [{ name: 'Strength', bonus: 4 }],
            proficiency: 2,
          },
        });
        await shieldBash.handler(ctx, PREV_DATA);
        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ saveDc: 14 }));
      });

      it('uses fallback DC with zero ability bonus when Strength not found', async () => {
        createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false, total: 5, roll: 5, saveBonus: 0 }) });
        getRuntimeValue.mockResolvedValue({ hit: true, attackerName: 'Fighter1', weaponType: 'melee', targetName: 'Goblin1' });
        checkOncePerTurnWithSkip.mockResolvedValue(null);
        parseMagicItemName.mockReturnValue({ baseName: 'Shield', magicBonus: 0 });
        const ctx = makeCtx({
          playerStats: {
            name: 'Fighter1',
            automation: { passives: [{ type: 'attack_rider', trigger: 'melee_hit_with_shield_equipped', options: ['push'] }] },
            inventory: { equipped: ['Shield'] },
            equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            abilities: [{ name: 'Dexterity', bonus: 3 }],
            proficiency: 2,
          },
        });
        await shieldBash.handler(ctx, PREV_DATA);
        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ saveDc: 10 }));
      });
    });

    describe('new-style passive', () => {
      it('finds new-style passive when both old and new style exist', async () => {
        getRuntimeValue.mockResolvedValue({ hit: true, attackerName: 'Fighter1', weaponType: 'melee', targetName: 'Goblin1' });
        checkOncePerTurnWithSkip.mockResolvedValue(null);
        parseMagicItemName.mockReturnValue({ baseName: 'Shield', magicBonus: 0 });
        buildSaveDc.mockReturnValue(15);
        createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false, total: 5, roll: 5, saveBonus: 0 }) });
        const ctx = makeCtx({
          playerStats: {
            name: 'Fighter1',
            automation: { passives: [makeShieldPassive(), makeNewStylePassive()] },
            inventory: { equipped: ['Shield'] },
            equipment: [{ name: 'Shield', armor_category: 'Shield' }],
          },
        });
        const result = await shieldBash.handler(ctx, PREV_DATA);
        expect(result.modal.type).toBe('shieldBash');
      });
    });

    describe('range gate (FT-074)', () => {
      it('returns { data: prevData } when target is beyond 5 ft', async () => {
        getRuntimeValue.mockResolvedValue({ hit: true, attackerName: 'Fighter1', weaponType: 'melee', targetName: 'Goblin1' });
        checkOncePerTurnWithSkip.mockResolvedValue(null);
        parseMagicItemName.mockReturnValue({ baseName: 'Shield', magicBonus: 0 });
        isWithinRange.mockResolvedValue(false);
        const ctx = makeShieldCtx();
        const result = await shieldBash.handler(ctx, PREV_DATA);
        expect(isWithinRange).toHaveBeenCalledWith('Fighter1', 'Goblin1', 5);
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(result).toEqual({ data: PREV_DATA });
        isWithinRange.mockResolvedValue(true);
      });

      it('proceeds when target is within 5 ft', async () => {
        getRuntimeValue.mockResolvedValue({ hit: true, attackerName: 'Fighter1', weaponType: 'melee', targetName: 'Goblin1' });
        checkOncePerTurnWithSkip.mockResolvedValue(null);
        parseMagicItemName.mockReturnValue({ baseName: 'Shield', magicBonus: 0 });
        buildSaveDc.mockReturnValue(15);
        createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false, total: 5, roll: 5, saveBonus: 0 }) });
        isWithinRange.mockResolvedValue(true);
        const ctx = makeShieldCtx();
        const result = await shieldBash.handler(ctx, PREV_DATA);
        expect(isWithinRange).toHaveBeenCalledWith('Fighter1', 'Goblin1', 5);
        expect(result.modal.type).toBe('shieldBash');
      });
    });

    describe('modal structure', () => {
      it('returns modal with correct options', async () => {
        getRuntimeValue.mockResolvedValue({ hit: true, attackerName: 'Fighter1', weaponType: 'melee', targetName: 'Dragon1' });
        checkOncePerTurnWithSkip.mockResolvedValue(null);
        parseMagicItemName.mockReturnValue({ baseName: 'Shield', magicBonus: 0 });
        buildSaveDc.mockReturnValue(18);
        createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false, total: 5, roll: 5, saveBonus: 0 }) });
        const ctx = makeShieldCtx();
        const result = await shieldBash.handler(ctx, PREV_DATA);

        expect(result.modal.type).toBe('shieldBash');
        expect(result.modal.props.action.name).toBe('Shield Bash');
        expect(result.modal.props.action.options).toEqual([
          { name: 'Push', effect: 'push', value: 5 },
          { name: 'Prone', effect: 'prone' },
        ]);
        expect(result.modal.props.targetName).toBe('Dragon1');
        expect(result.modal.props.saveDc).toBe(18);
        expect(result.modal.props.campaignName).toBe('test-campaign');
      });
    });
  });
});

// FT-082 collateral: the bash save resolution clobbers campaign lastAttack;
// the base weapon attack must be restored so Slasher Hamstring gating works
// on shield holders within the same turn.
describe('restoreBaseAttackAfterBash (FT-082 collateral)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const stats = { name: 'EvasiveFighter' };

  it('restores stashed base attack as campaign lastAttack and clears stash', async () => {
    const baseAttack = { attackName: 'Scimitar', hit: true, damageType: 'Slashing', attackerName: 'EvasiveFighter', targetName: 'Zombie 1' };
    getRuntimeValue.mockImplementation((name, key) => (key === '_shieldBashBaseAttack' ? baseAttack : null));

    await restoreBaseAttackAfterBash(stats, 'test-campaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack', baseAttack, 'test-campaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', '_shieldBashBaseAttack', null, 'test-campaign');
  });

  it('is a silent no-op when nothing was stashed', async () => {
    getRuntimeValue.mockReturnValue(null);
    await restoreBaseAttackAfterBash(stats, 'test-campaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('does not restore junk stashes (arrays / bash records)', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === '_shieldBashBaseAttack') return [{ junk: true }];
      return null;
    });
    await restoreBaseAttackAfterBash(stats, 'test-campaign');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'lastAttack', expect.anything(), 'test-campaign');
  });

  it('applyShieldBashEffect restores the base attack after Push (shield-holder hamstring gate)', async () => {
    const baseAttack = { attackName: 'Scimitar', hit: true, damageType: 'Slashing', attackerName: 'EvasiveFighter', targetName: 'Zombie 1' };
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === '_shieldBashBaseAttack') return baseAttack;
      if (key === 'targetEffects') return [];
      return null;
    });
    getCombatContext.mockResolvedValue({ round: 4, activeCreatureName: 'EvasiveFighter' });

    await applyShieldBashEffect({ automation: {} }, { name: 'EvasiveFighter' }, 'test-campaign', 'Zombie 1', 'Push', 15);

    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack', baseAttack, 'test-campaign');
  });
});

describe('applyShieldBashEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseAction = { automation: {} };
  const basePlayerStats = { name: 'Fighter1' };

  function setupApplyEffect(contextOverride) {
    getRuntimeValue.mockReturnValue([]);
    getCombatContext.mockResolvedValue(contextOverride || { round: 3, activeCreatureName: 'Fighter1' });
  }

  it('returns null and logs when chosenOption is skip', async () => {
    setupApplyEffect(null);
    const result = await applyShieldBashEffect(baseAction, basePlayerStats, 'test-campaign', 'Goblin1', 'skip', 15);
    expect(result).toBeNull();
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'ability_use', abilityName: 'Shield Bash', description: expect.stringContaining('skipped'),
    }));
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(getCombatContext).not.toHaveBeenCalled();
  });

  it('applies push effect and logs', async () => {
    setupApplyEffect(null);
    const result = await applyShieldBashEffect(baseAction, basePlayerStats, 'test-campaign', 'Goblin1', 'Push', 15);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign', 'targetEffects',
      expect.arrayContaining([expect.objectContaining({ target: 'Goblin1', source: 'Shield Bash', option: 'Push', effect: 'push', value: 5, duration: 'instant' })]),
      'test-campaign',
    );
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'ability_use', abilityName: 'Shield Bash', description: expect.stringContaining('pushed 5 ft'),
    }));
    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('pushed 5 ft');
  });

  it('applies prone effect, adds condition, and logs', async () => {
    setupApplyEffect({ round: 3, activeCreatureName: 'Fighter1' });
    const result = await applyShieldBashEffect(baseAction, basePlayerStats, 'test-campaign', 'Orc1', 'Prone', 16);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign', 'targetEffects',
      expect.arrayContaining([expect.objectContaining({ target: 'Orc1', source: 'Shield Bash', option: 'Prone', effect: 'prone_and_push', value: 5, duration: 'until_start_of_next_turn', saveType: 'STR', saveDc: 16, saveAbility: 'STR' })]),
      'test-campaign',
    );
    expect(addCondition).toHaveBeenCalledWith(
      expect.objectContaining({
        combatSummary: expect.any(Object), creatureName: 'Orc1', conditionDef: { key: 'prone', label: 'Prone' }, dc: 16, ability: 'STR',
        getRuntimeValue, setRuntimeValue, campaignName: 'test-campaign', playerStats: basePlayerStats,
      }),
    );
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'ability_use', abilityName: 'Shield Bash', description: expect.stringContaining('Prone condition'),
    }));
    expect(result.payload.description).toContain('Prone condition');
  });

  it('marks oncePerTurn as used after push', async () => {
    setupApplyEffect({ round: 5, activeCreatureName: 'Fighter1' });
    await applyShieldBashEffect(baseAction, basePlayerStats, 'test-campaign', 'Goblin1', 'Push', 15);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Fighter1', '_Shield_Bash_usedRound', { round: 5, activeCreature: 'Fighter1' }, 'test-campaign',
    );
  });

  it('marks oncePerTurn as used after prone', async () => {
    setupApplyEffect({ round: 2, activeCreatureName: 'Fighter1' });
    await applyShieldBashEffect(baseAction, basePlayerStats, 'test-campaign', 'Goblin1', 'Prone', 14);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Fighter1', '_Shield_Bash_usedRound', { round: 2, activeCreature: 'Fighter1' }, 'test-campaign',
    );
  });

  it('stamps the holder name (not the stale cs mirror) as latch owner (FT-074)', async () => {
    setupApplyEffect({ round: 1, activeCreatureName: 'AasimarTest' });
    await applyShieldBashEffect(baseAction, basePlayerStats, 'test-campaign', 'Goblin1', 'Prone', 15);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Fighter1', '_Shield_Bash_usedRound', { round: 1, activeCreature: 'Fighter1' }, 'test-campaign',
    );
  });

  it('handles existing targetEffects when applying push', async () => {
    getRuntimeValue.mockReturnValue([{ target: 'Goblin1', effect: 'slowed' }]);
    getCombatContext.mockResolvedValue(null);
    await applyShieldBashEffect(baseAction, basePlayerStats, 'test-campaign', 'Goblin1', 'Push', 15);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign', 'targetEffects',
      expect.arrayContaining([expect.objectContaining({ effect: 'slowed' }), expect.objectContaining({ effect: 'push' })]),
      'test-campaign',
    );
  });

  it('handles missing combat context gracefully for round tracking', async () => {
    getRuntimeValue.mockReturnValue([]);
    getCombatContext.mockResolvedValue(null);
    await applyShieldBashEffect(baseAction, basePlayerStats, 'test-campaign', 'Goblin1', 'Push', 15);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Fighter1', '_Shield_Bash_usedRound', { round: 1, activeCreature: 'Fighter1' }, 'test-campaign',
    );
  });

  it('preserves automation reference in popup result', async () => {
    getRuntimeValue.mockReturnValue([]);
    getCombatContext.mockResolvedValue(null);
    const action = { automation: { someKey: 'someValue' } };
    const result = await applyShieldBashEffect(action, basePlayerStats, 'test-campaign', 'Goblin1', 'Push', 15);
    expect(result.payload.automation).toEqual({ someKey: 'someValue' });
  });
});
