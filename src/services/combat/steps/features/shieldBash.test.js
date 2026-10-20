// @maintained-by-ai
// shieldBash step lane map (owner cites):
//  - THIS file owns src/services/combat/steps/features/shieldBash.js:
//    condition gate (FT-103), handler gate table, save-DC resolution
//    (new/old-style + fallback), STR save prompt + exact modal build,
//    Push/Prone/skip effects, oncePerTurn latch stamp (FT-074),
//    restoreBaseAttackAfterBash (FT-082).
//  - Rider dispatch → attackRiderHandler*.test.js · Modal UI →
//    modals/ShieldBashChoiceModal.test.jsx · Resume lane →
//    useAttackDamageResolution.shieldBashResume.test.js · mastery push →
//    weaponMasteryHandler.push.test.js · gladiator DC →
//    gladiator-shield-bash-dc-success.test.js.
// Old→new: 33 duplicated-setup tests → behavior tables; every former leg
// kept (each reaches a distinct source branch), modal/log/latch assertions
// tightened from toContain fragments to exact full objects.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (all 8 are imported by shieldBash.js — verified, no dead mocks) ──

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
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../automation/common/oncePerTurn.js', () => ({
  checkOncePerTurnWithSkip: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/conditionSaveService.js', () => ({
  addCondition: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
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

const CAMPAIGN = 'test-campaign';
const PREV_DATA = { formula: '1d8+3' };
const LAST_ATTACK = { attackName: 'Longsword', hit: true, attackerName: 'Fighter1', weaponType: 'melee', targetName: 'Goblin1' };
const BASE_ATTACK = { attackName: 'Scimitar', hit: true, damageType: 'Slashing', attackerName: 'Fighter1', targetName: 'Zombie 1' };

function oldPassive(options = {}) {
  return {
    type: 'attack_rider',
    trigger: 'melee_hit_with_shield_equipped',
    options: ['push', 'prone'],
    automation: { saveDc: 'ability', saveAbility: 'STR' },
    ...options,
  };
}

function newPassive(options = {}) {
  return {
    type: 'attack_rider',
    effect: 'push_or_prone',
    oncePerTurn: true,
    automation: { saveDc: 'ability', saveAbility: 'STR' },
    ...options,
  };
}

function makeCtx(passives = [oldPassive()], playerStatsOverrides = {}) {
  return {
    campaignName: CAMPAIGN,
    playerStats: {
      name: 'Fighter1',
      automation: { passives },
      inventory: { equipped: ['Shield'] },
      equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      ...playerStatsOverrides,
    },
  };
}

// Campaign/character-faithful store stub: any read off the correct lane
// returns a loud decoy so a wrong-campaign/character read fails assertions.
function stubStore(map = {}) {
  getRuntimeValue.mockImplementation((character, key, campaign) => {
    if (campaign && campaign !== CAMPAIGN) return { attackName: 'DECOY-WRONG-CAMPAIGN' };
    return map[`${character}.${key}`] ?? null;
  });
}

function withoutTimestamp(entry) {
  const { timestamp, ...rest } = entry;
  expect(typeof timestamp).toBe('number');
  return rest;
}

beforeEach(() => {
  vi.clearAllMocks();
  parseMagicItemName.mockImplementation((name) => ({ baseName: name, magicBonus: 0 }));
  isWithinRange.mockResolvedValue(true);
  checkOncePerTurnWithSkip.mockResolvedValue(null);
  getRuntimeValue.mockReturnValue(null);
  getCombatContext.mockResolvedValue({ round: 3, activeCreatureName: 'StaleMirrorName' });
});

// ── Tests ────────────────────────────────────────────────────────

describe('shieldBash', () => {
  it('step name contract', () => {
    expect(shieldBash.name).toBe('shieldBash');
  });

  describe('condition (FT-103: rides the Attack action, never a reaction)', () => {
    it.each([
      ['passives present, not an opportunity attack', { automation: { passives: [oldPassive()] } }, undefined, true],
      ['automation without passives', { automation: {} }, undefined, false],
      ['no automation at all', {}, undefined, false],
      ['opportunity attack', { automation: { passives: [oldPassive()] } }, true, false],
    ])('%s → %s', (_label, playerStats, isOpportunityAttack, expected) => {
      const ctx = { campaignName: CAMPAIGN, playerStats, ...(isOpportunityAttack ? { isOpportunityAttack } : {}) };
      expect(shieldBash.condition(ctx)).toBe(expected);
    });

    it('throws TypeError honestly when playerStats is null', () => {
      expect(() => shieldBash.condition({ campaignName: CAMPAIGN, playerStats: null })).toThrow(TypeError);
    });
  });

  describe('handler — no matching passive', () => {
    it.each([
      ['no passives', []],
      ['rider with unrelated effect', [{ type: 'attack_rider', effect: 'other' }]],
      ['old-style trigger with empty options', [{ type: 'attack_rider', trigger: 'melee_hit_with_shield_equipped', options: [] }]],
      ['new-style effect without oncePerTurn', [{ type: 'attack_rider', effect: 'push_or_prone' }]],
    ])('%s → null, bails before any store read', async (_label, passives) => {
      const ctx = makeCtx(passives);
      expect(await shieldBash.handler(ctx, PREV_DATA)).toBeNull();
      expect(getRuntimeValue).not.toHaveBeenCalled();
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('handler — gates return { data: prevData } with zero writes', () => {
    it.each([
      ['lastAttack is null', { lastAttack: null }],
      ['lastAttack missed', { lastAttack: { ...LAST_ATTACK, hit: false } }],
      ['attacker is not the player', { lastAttack: { ...LAST_ATTACK, attackerName: 'Goblin1' } }],
      ['ranged attack', { lastAttack: { ...LAST_ATTACK, weaponType: 'ranged' } }],
      ['target missing', { lastAttack: { ...LAST_ATTACK, targetName: undefined } }],
      ['target beyond 5 ft (FT-074)', { lastAttack: { ...LAST_ATTACK }, within: false }],
      ['no shield equipped', { noShield: true }],
      ['once-per-turn skip, armor_category shield', { skip: true }],
      ['once-per-turn skip, equipment_category shield', { skip: true, shieldByEquipmentCategory: true }],
    ])('%s', async (_label, cfg) => {
      stubStore({ 'campaign.lastAttack': cfg.lastAttack !== undefined ? cfg.lastAttack : { ...LAST_ATTACK } });
      if (cfg.within === false) isWithinRange.mockResolvedValue(false);
      if (cfg.skip) checkOncePerTurnWithSkip.mockResolvedValue({ type: 'popup' });
      const la = cfg.lastAttack !== undefined ? cfg.lastAttack : LAST_ATTACK;
      const reachesRange = !!(la && la.hit && la.attackerName === 'Fighter1' && la.weaponType === 'melee' && la.targetName);
      const overrides = cfg.noShield
        ? { inventory: { equipped: ['Longsword'] }, equipment: [{ name: 'Longsword', armor_category: 'Heavy', equipment_category: 'Weapon' }] }
        : cfg.shieldByEquipmentCategory
          ? { inventory: { equipped: ['Tower Shield'] }, equipment: [{ name: 'Tower Shield', equipment_category: 'Shield' }] }
          : {};
      const ctx = makeCtx([oldPassive()], overrides);

      expect(await shieldBash.handler(ctx, PREV_DATA)).toEqual({ data: PREV_DATA });

      expect(createSaveListener).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      // branch-reach pins: gate ordering must be observed, not assumed
      if (reachesRange) expect(isWithinRange).toHaveBeenCalledWith('Fighter1', LAST_ATTACK.targetName, 5);
      else expect(isWithinRange).not.toHaveBeenCalled();
      if (cfg.noShield) expect(checkOncePerTurnWithSkip).not.toHaveBeenCalled();
      if (cfg.skip) expect(checkOncePerTurnWithSkip).toHaveBeenCalledWith('Shield Bash', '_Shield_Bash_usedRound', '_Shield_Bash_skippedRound', ctx.playerStats, CAMPAIGN);
    });
  });

  describe('save DC resolution', () => {
    // byte-source-swap: distinguishable automation objects prove WHICH
    // passive was consulted, not just that a DC appeared.
    it('new-style passive wins when both styles exist; its automation computes the DC', async () => {
      const oldAuto = { saveDc: 'ability', saveAbility: 'STR' };
      const newAuto = { saveDc: 'spell', saveAbility: 'CON' };
      stubStore({ 'campaign.lastAttack': { ...LAST_ATTACK } });
      buildSaveDc.mockImplementation((auto) => (auto === newAuto ? 17 : 14));
      createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false, total: 5, roll: 5, saveBonus: 0 }) });
      const ctx = makeCtx([oldPassive({ automation: oldAuto }), newPassive({ automation: newAuto })]);

      const result = await shieldBash.handler(ctx, PREV_DATA);

      expect(buildSaveDc).toHaveBeenCalledTimes(1);
      expect(buildSaveDc.mock.calls[0][0]).toBe(newAuto);
      expect(result.modal.props.saveDc).toBe(17);
    });

    it('old-style automation computes the DC when it is the only style', async () => {
      const oldAuto = { saveDc: 'ability', saveAbility: 'STR' };
      stubStore({ 'campaign.lastAttack': { ...LAST_ATTACK } });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false, total: 5, roll: 5, saveBonus: 0 }) });
      const ctx = makeCtx([oldPassive({ automation: oldAuto })]);

      await shieldBash.handler(ctx, PREV_DATA);

      expect(buildSaveDc).toHaveBeenCalledWith(oldAuto, ctx.playerStats);
    });

    it.each([
      ['STR bonus + proficiency → 8+4+2', [{ name: 'Strength', bonus: 4 }], 2, 14],
      ['STR missing → bonus 0, 8+0+2', [{ name: 'Dexterity', bonus: 3 }], 2, 10],
      ['proficiency missing → 8+4+0', [{ name: 'Strength', bonus: 4 }], undefined, 12],
    ])('fallback DC without passive automation: %s', async (_label, abilities, proficiency, expectedDc) => {
      stubStore({ 'campaign.lastAttack': { ...LAST_ATTACK } });
      createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false, total: 5, roll: 5, saveBonus: 0 }) });
      const ctx = makeCtx(
        [{ type: 'attack_rider', trigger: 'melee_hit_with_shield_equipped', options: ['push'] }],
        { abilities, proficiency },
      );

      await shieldBash.handler(ctx, PREV_DATA);

      expect(buildSaveDc).not.toHaveBeenCalled();
      expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ saveDc: expectedDc }));
    });
  });

  describe('save prompt flow', () => {
    it('failed save → exact stash, exact prompt, exact log, exact full modal result', async () => {
      const target = 'Ogrillion';
      const lastAttack = { ...LAST_ATTACK, targetName: target };
      stubStore({ 'campaign.lastAttack': lastAttack });
      buildSaveDc.mockReturnValue(17);
      createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false, total: 8, roll: 6, saveBonus: 2 }) });
      const ctx = makeCtx();

      const result = await shieldBash.handler(ctx, PREV_DATA);

      // FT-082: base attack stashed verbatim BEFORE the save prompt
      expect(setRuntimeValue).toHaveBeenCalledWith('Fighter1', '_shieldBashBaseAttack', lastAttack, CAMPAIGN);
      expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, {
        targetName: target, saveType: 'STR', saveDc: 17, dcSuccess: false, sourceName: 'Shield Bash',
      });
      expect(withoutTimestamp(addEntry.mock.calls[0][1])).toEqual({
        type: 'roll', name: 'Shield Bash', characterName: 'Fighter1', rollType: 'save-damage',
        targetName: target, saveDc: 17, saveType: 'STR',
        description: `Shield Bash: ${target} must make a STR saving throw (DC 17).`,
      });
      expect(withoutTimestamp(addEntry.mock.calls[1][1])).toEqual({
        type: 'roll', name: 'Shield Bash', characterName: 'Fighter1', rollType: 'save-damage',
        targetName: target, saveDc: 17, saveType: 'STR', saveResult: 'failure',
        total: 8, rolls: [6], bonus: 2, formula: '1d20+2',
        description: `${target} failed the STR save (DC 17). Shield Bash effect applied.`,
      });
      expect(addEntry).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        modal: {
          type: 'shieldBash',
          props: {
            action: {
              name: 'Shield Bash',
              options: [
                { name: 'Push', effect: 'push', value: 5 },
                { name: 'Prone', effect: 'prone' },
              ],
            },
            playerStats: ctx.playerStats,
            campaignName: CAMPAIGN,
            targetName: target,
            saveDc: 17,
          },
        },
        data: PREV_DATA,
      });
      expect(result.modal.props.playerStats).toBe(ctx.playerStats);
    });

    it('successful save → { data: prevData } and FT-082 restore sequence (stash, restore, clear)', async () => {
      const lastAttack = { ...LAST_ATTACK };
      // model the stash write having landed: same reference under the stash key
      stubStore({ 'campaign.lastAttack': lastAttack, 'Fighter1._shieldBashBaseAttack': lastAttack });
      buildSaveDc.mockReturnValue(17);
      createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: true, total: 18, roll: 13, saveBonus: 5 }) });
      const ctx = makeCtx();

      const result = await shieldBash.handler(ctx, PREV_DATA);

      expect(result).toEqual({ data: PREV_DATA });
      expect(setRuntimeValue.mock.calls).toEqual([
        ['Fighter1', '_shieldBashBaseAttack', lastAttack, CAMPAIGN],
        ['campaign', 'lastAttack', lastAttack, CAMPAIGN],
        ['Fighter1', '_shieldBashBaseAttack', null, CAMPAIGN],
      ]);
    });

    it.each([
      ['success, +5 bonus', { success: true, total: 20, roll: 15, saveBonus: 5 }, '1d20+5', 'succeeded'],
      ['failure, zero bonus', { success: false, total: 13, roll: 13, saveBonus: 0 }, '1d20', 'failed'],
    ])('outcome log: %s → formula %s', async (_label, saveResult, formula, word) => {
      stubStore({ 'campaign.lastAttack': { ...LAST_ATTACK } });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promise: Promise.resolve(saveResult) });

      await shieldBash.handler(makeCtx(), PREV_DATA);

      expect(withoutTimestamp(addEntry.mock.calls[1][1])).toEqual({
        type: 'roll', name: 'Shield Bash', characterName: 'Fighter1', rollType: 'save-damage',
        targetName: 'Goblin1', saveDc: 15, saveType: 'STR',
        saveResult: saveResult.success ? 'success' : 'failure',
        total: saveResult.total, rolls: [saveResult.roll], bonus: saveResult.saveBonus, formula,
        description: `Goblin1 ${word} the STR save (DC 15).${saveResult.success ? '' : ' Shield Bash effect applied.'}`,
      });
    });
  });
});

// FT-082 collateral: the bash save resolution clobbers campaign lastAttack;
// the base weapon attack must be restored so Slasher Hamstring gating works
// on shield holders within the same turn.
describe('restoreBaseAttackAfterBash (FT-082 collateral)', () => {
  it.each([
    ['valid base attack → restore then clear', BASE_ATTACK, [
      ['campaign', 'lastAttack', BASE_ATTACK],
      ['Fighter1', '_shieldBashBaseAttack', null],
    ]],
    ['bash save record → clear only, never restored', { ...BASE_ATTACK, attackName: 'Shield Bash' }, [
      ['Fighter1', '_shieldBashBaseAttack', null],
    ]],
    ['nothing stashed → zero writes', null, []],
    ['array junk → zero writes', [{ junk: true }], []],
    ['object without attackName → zero writes', { hit: true }, []],
  ])('%s', async (_label, stash, expectedWrites) => {
    getRuntimeValue.mockImplementation((character, key, campaign) => {
      if (campaign !== CAMPAIGN || character !== 'Fighter1') return { attackName: 'DECOY-WRONG-LANE' };
      return key === '_shieldBashBaseAttack' ? stash : null;
    });

    await restoreBaseAttackAfterBash({ name: 'Fighter1' }, CAMPAIGN);

    expect(setRuntimeValue.mock.calls).toEqual(expectedWrites.map(([c, k, v]) => [c, k, v, CAMPAIGN]));
  });
});

describe('applyShieldBashEffect', () => {
  const basePlayerStats = { name: 'Fighter1' };

  function setup(chosenOption, { targetEffects = [], stash = BASE_ATTACK, cs = { round: 7, activeCreatureName: 'StaleMirrorName' }, saveDc = 15, targetName = 'Goblin1', action = { automation: { keep: 'me' } } } = {}) {
    stubStore({ 'campaign.targetEffects': targetEffects, 'Fighter1._shieldBashBaseAttack': stash });
    getCombatContext.mockResolvedValue(cs);
    return applyShieldBashEffect({ action, playerStats: basePlayerStats, campaignName: CAMPAIGN, targetName, chosenOption, saveDc });
  }

  it('skip → null, FT-082 restore still runs, no effects/latch, exact log', async () => {
    const result = await setup('skip');

    expect(result).toBeNull();
    expect(setRuntimeValue.mock.calls).toEqual([
      ['campaign', 'lastAttack', BASE_ATTACK, CAMPAIGN],
      ['Fighter1', '_shieldBashBaseAttack', null, CAMPAIGN],
    ]);
    expect(getCombatContext).not.toHaveBeenCalled();
    expect(addCondition).not.toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'ability_use', characterName: 'Fighter1', abilityName: 'Shield Bash',
      description: 'Shield Bash: skipped (no effect, use not consumed).',
    });
  });

  it('Push → exact te append, latch stamped round 7 with holder name, exact log + popup', async () => {
    const existing = { target: 'Other', effect: 'blessing' };
    const action = { automation: { keep: 'me' } };
    const result = await setup('Push', { targetEffects: [existing], action });

    const teWrite = setRuntimeValue.mock.calls.find(([c, k]) => c === 'campaign' && k === 'targetEffects');
    expect(teWrite).toEqual(['campaign', 'targetEffects', [
      existing,
      { target: 'Goblin1', source: 'Shield Bash', option: 'Push', effect: 'push', value: 5, duration: 'instant' },
    ], CAMPAIGN]);
    expect(teWrite[2][0]).toBe(existing); // existing entries kept by reference, appended not merged
    // FT-074: latch owner is the holder, not the stale cs mirror
    expect(setRuntimeValue).toHaveBeenCalledWith('Fighter1', '_Shield_Bash_usedRound', { round: 7, activeCreature: 'Fighter1' }, CAMPAIGN);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'ability_use', characterName: 'Fighter1', abilityName: 'Shield Bash',
      description: 'Shield Bash used against Goblin1: pushed 5 ft.',
    });
    expect(result).toEqual({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Shield Bash', description: 'Shield Bash: Goblin1 pushed 5 ft.', automation: { keep: 'me' } },
    });
    expect(result.payload.automation).toBe(action.automation);
  });

  it('Prone → exact te, addCondition wired to the resolved combat context, latch + log + popup', async () => {
    const cs = { round: 7, activeCreatureName: 'StaleMirrorName' };
    const result = await setup('Prone', { targetName: 'Orc1', saveDc: 16, cs });

    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
      { target: 'Orc1', source: 'Shield Bash', option: 'Prone', effect: 'prone_and_push', value: 5, duration: 'until_start_of_next_turn', saveType: 'STR', saveDc: 16, saveAbility: 'STR' },
    ], CAMPAIGN);
    expect(addCondition).toHaveBeenCalledTimes(1);
    expect(addCondition).toHaveBeenCalledWith({
      combatSummary: cs, creatureName: 'Orc1', conditionDef: { key: 'prone', label: 'Prone' },
      dc: 16, ability: 'STR', getRuntimeValue, setRuntimeValue, campaignName: CAMPAIGN, playerStats: basePlayerStats,
    });
    expect(setRuntimeValue).toHaveBeenCalledWith('Fighter1', '_Shield_Bash_usedRound', { round: 7, activeCreature: 'Fighter1' }, CAMPAIGN);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'ability_use', characterName: 'Fighter1', abilityName: 'Shield Bash',
      description: 'Shield Bash used against Orc1: target has Prone condition.',
    });
    expect(result.payload.description).toBe('Shield Bash: Orc1 has Prone condition.');
  });

  it('missing combat context → latch falls back to round 1, still stamped to holder', async () => {
    await setup('Push', { cs: null });

    expect(setRuntimeValue).toHaveBeenCalledWith('Fighter1', '_Shield_Bash_usedRound', { round: 1, activeCreature: 'Fighter1' }, CAMPAIGN);
  });
});
