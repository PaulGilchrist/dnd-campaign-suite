// @maintained-by-ai
// Lane: step-BODY behavior of all four attack-roll chooser riders in attackRollRiders.js —
// CLA-188 Cunning Strike chooser, FT-022/023 Charger chooser, Superiority maneuver
// hit/miss chooser, and Bardic Inspiration offense chooser. Gates, suppression, prompt
// issuance, and passthrough bytes only — nothing else.
//
// Ownership split (cited, never re-pinned here — see each file's lane header):
//   names/subscribe/emit/order/step-keys golden census .. attackRollDamageSteps.test.js (#1039)
//   oncePerTurn.js latch internals (number/object stamps, popup text) .. real collaborator
//                                    running here against mocked stores; only "skip signal →
//                                    inert passthrough" is asserted at this seam
//   chooser filtering / MN-014 formatter bytes ........... combatSuperiorityQueries.mn014.test.js,
//                                    combatSuperiorityHandlerQuery.test.js
//   hook-side dispatch/resume/ledger/pause-strand ........ useAttackDamageResolution.maneuvers/
//                                    .skipManeuver/.cunningStrikeResume/.mn014/.mn015/.maneuveringAlly.test.js
//   BI prompt util itself .................................. combat/prompts/bardicInspirationPromptUtils.test.js
//   BI popup passthrough + bonus folding ................. useLoggedDiceRollDamage.popup-data,
//                                    handlePlainDamage.popupData, attackRollDamageSteps-bonuses-basic (#1030)
//   Charger consumer reaction gate ....................... useAttackDamageResolution.opportunity-transport.test.js
//
// These steps roll no dice — they only offer choices and pass bytes through, so no dice
// stub exists here (inert-or-faithful, #1026). Zero wall-clock waits: the BI chooser is
// settled ONLY by dispatched player events; accept AND decline are both real choices
// (T2 no-timers plan) and the never-answered case is pinned as a genuine pending race.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

// executeAttackRiderManeuver purged — attackRollRiders.js only imports the two getters.
vi.mock('../../automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  getAttackRiderOptions: vi.fn(),
  getAttackRiderOptionsByContext: vi.fn(),
}));

vi.mock('../../combat/prompts/bardicInspirationPromptUtils.js', () => ({
  sendBardicInspirationOffensePrompt: vi.fn(),
}));

vi.mock('../../combat/auras/bardicInspirationState.js', () => ({
  hasBardicInspirationOffense: vi.fn(),
  getBardicInspirationDieSize: vi.fn(),
}));

vi.mock('../../automation/common/resourceCheck.js', () => ({
  spendResource: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({
  default: { guid: () => 'test-guid-123' },
}));

import {
  buildAttackRiderManeuversStep,
  buildCunningStrikeStep,
  buildChargerStep,
  buildBardicInspirationOffenseStep,
} from './attackRollRiders.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue, setRuntimeObject } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../rules/combat/damageUtils.js';
import {
  getAttackRiderOptions,
  getAttackRiderOptionsByContext,
} from '../../automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { sendBardicInspirationOffensePrompt } from '../../combat/prompts/bardicInspirationPromptUtils.js';
import { hasBardicInspirationOffense, getBardicInspirationDieSize } from '../../combat/auras/bardicInspirationState.js';
import { spendResource } from '../../automation/common/resourceCheck.js';
import { addEntry } from '../../ui/logService.js';
import { createPipeline } from '../actionPipeline.js';

const CAMPAIGN = 'test-campaign';
const HOLDER = 'AasimarTest';
const TARGET = 'Animated Rug of Smothering 1';
const BI_PID = 'bi-offense-test-guid-123';

// Byte-distinct fixtures (#1022): hit-channel, miss-channel, and wrong-channel
// canary options are all distinguishable, so any channel cross-wiring fails loudly.
const HIT_OPTIONS = [{ name: 'Precision Strike', effect: 'attack_bonus' }];
const MISS_OPTIONS = [{ name: 'Evasive Reactions', effect: 'miss_save_bonus' }];
const CANARY_OPTIONS = [{ name: 'WRONG-CHANNEL CANARY', effect: 'canary' }];

const csPassive = { name: 'Devious Strikes', type: 'attack_rider' };

const chargerPassive = {
  name: 'Charge Attack',
  type: 'attack_rider',
  trigger: 'melee_hit_after_10ft_charge',
  chooseOne: true,
  oncePerTurn: true,
  options: [
    { name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d8' },
    { name: 'Push 10 ft', effect: 'push', value: 10, sizeLimit: 'one_size_larger' },
  ],
};

const csStep = buildCunningStrikeStep();
const chargerStep = buildChargerStep();
const maneuversStep = buildAttackRiderManeuversStep();
const biStep = buildBardicInspirationOffenseStep();

function makeCtx(overrides = {}) {
  return {
    hit: true,
    attack: { name: 'Shortsword', damage: '1d6+2', damageType: 'Piercing' },
    playerStats: {
      name: HOLDER,
      level: 14,
      automation: { actions: [], passives: [csPassive] },
    },
    campaignName: CAMPAIGN,
    mapName: null,
    buildCtxSync: vi.fn(() => Promise.resolve({ sneakAttackDice: 7 })),
    setAttackRiderModal: vi.fn(),
    ...overrides,
  };
}

function runtimeValues(values = {}) {
  getRuntimeValue.mockImplementation((key, prop) => values[prop] ?? null);
}

beforeEach(() => {
  vi.resetAllMocks();
  getCombatContext.mockResolvedValue({ round: 1, creatures: [] });
  getTargetFromAttacker.mockReturnValue({ name: TARGET });
  getCurrentCombatRound.mockReturnValue(1);
  getAttackRiderOptions.mockResolvedValue([]);
  getAttackRiderOptionsByContext.mockResolvedValue([]);
  addEntry.mockResolvedValue({});
  runtimeValues({ lastAttack: { hit: true, attackerName: HOLDER } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('condition gates — all four riders', () => {
  const chargerStats = { name: HOLDER, automation: { passives: [chargerPassive] } };

  it.each([
    ['cunningStrike: hit', csStep, { hit: true }, true],
    ['cunningStrike: miss', csStep, { hit: false }, false],
    ['charger: miss', chargerStep, { hit: false, attack: { weaponType: 'melee' }, playerStats: chargerStats }, false],
    ['charger: reaction/opportunity attack (FT-103)', chargerStep, { hit: true, isOpportunityAttack: true, attack: { weaponType: 'melee' }, playerStats: chargerStats }, false],
    ['charger: ranged weapon', chargerStep, { hit: true, attack: { weaponType: 'ranged' }, playerStats: chargerStats }, false],
    ['charger: no automation object', chargerStep, { hit: true, attack: { weaponType: 'melee' }, playerStats: { name: HOLDER } }, false],
    ['charger: unarmed hit', chargerStep, { hit: true, attack: { weaponType: 'unarmed' }, playerStats: chargerStats }, true],
    ['charger: melee hit', chargerStep, { hit: true, attack: { weaponType: 'melee' }, playerStats: chargerStats }, true],
    ['attackRiderManeuvers: no prompt sink', maneuversStep, { popupHtml: { hit: true } }, false],
    ['attackRiderManeuvers: prompt sink present', maneuversStep, { popupHtml: { hit: true }, setAttackRiderManeuverPrompt: () => {} }, true],
    ['bardicInspirationOffense: hit', biStep, { hit: true }, true],
    ['bardicInspirationOffense: miss', biStep, { hit: false }, false],
  ])('%s → %s', (_label, step, ctx, expected) => {
    expect(step.condition(ctx)).toBe(expected);
  });
});

describe('buildAttackRiderManeuversStep — chooser channel routing', () => {
  // Step-body routing the hook lane delegates here (#1039 lane table: rider application).
  // Which choices exist per channel is owned by the query lane (mn014) — never re-driven.
  it.each([
    { label: 'hit with maneuvers → hit chooser, modal + prompt bytes', popup: { hit: true }, channel: 'hit', options: HIT_OPTIONS, infoHit: true },
    { label: 'crit-only popup → hit chooser', popup: { hit: false, isCrit: true }, channel: 'hit', options: HIT_OPTIONS, infoHit: true },
    { label: 'hit without maneuvers → inert {data:{}}', popup: { hit: true }, channel: 'hit', options: [], infoHit: true },
    { label: 'miss with miss-maneuvers → miss chooser, isMiss:true bytes', popup: { hit: false }, channel: 'miss', options: MISS_OPTIONS, infoHit: false },
    { label: 'miss without miss-maneuvers → inert {data:{}}', popup: { hit: false }, channel: 'miss', options: [], infoHit: false },
  ])('$label', async ({ popup, channel, options, infoHit }) => {
    if (channel === 'hit') {
      getAttackRiderOptions.mockResolvedValue(options);
      getAttackRiderOptionsByContext.mockResolvedValue(CANARY_OPTIONS);
    } else {
      getAttackRiderOptionsByContext.mockResolvedValue(options);
      getAttackRiderOptions.mockResolvedValue(CANARY_OPTIONS);
    }
    const setPrompt = vi.fn();
    const ctx = makeCtx({
      popupHtml: popup,
      attack: { name: 'Shortsword', weaponType: 'melee' },
      targetName: 'Goblin',
      setAttackRiderManeuverPrompt: setPrompt,
    });
    const result = await maneuversStep.handler(ctx);

    const info = { weaponType: 'melee', isUnarmedStrike: false, targetName: 'Goblin', hit: infoHit };
    if (channel === 'hit') {
      expect(getAttackRiderOptions).toHaveBeenCalledWith(ctx.playerStats, CAMPAIGN, info);
      expect(getAttackRiderOptionsByContext).not.toHaveBeenCalled();
    } else {
      expect(getAttackRiderOptionsByContext).toHaveBeenCalledWith(ctx.playerStats, CAMPAIGN, info, 'miss');
      expect(getAttackRiderOptions).not.toHaveBeenCalled();
    }

    if (options.length === 0) {
      expect(result).toEqual({ data: {} });
      expect(setPrompt).not.toHaveBeenCalled();
    } else {
      expect(result.modal.type).toBe('attackRiderManeuver');
      expect(result.modal.props).toEqual({
        maneuvers: options,
        attack: ctx.attack,
        popupHtml: popup,
        ...(channel === 'miss' ? { isMiss: true } : {}),
      });
      expect(setPrompt).toHaveBeenCalledWith(result.modal.props);
    }
  });
});

describe('buildCunningStrikeStep (CLA-188)', () => {
  it('qualifying hit → exact modal/data/sink bytes, campaign-keyed reads', async () => {
    const ctx = makeCtx();
    const result = await csStep.handler(ctx);
    expect(result.data).toEqual({ _cunningStrike: true, sneakDice: 7 });
    expect(result.modal.type).toBe('cunningStrike');
    expect(result.modal.props).toEqual({
      action: csPassive,
      playerStats: ctx.playerStats,
      campaignName: CAMPAIGN,
      targetName: TARGET,
    });
    expect(ctx.setAttackRiderModal).toHaveBeenCalledWith(result.modal.props);
    expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack', CAMPAIGN);
    expect(getRuntimeValue).toHaveBeenCalledWith(HOLDER, '_CunningStrike_usedRound', CAMPAIGN);
    expect(getRuntimeValue).toHaveBeenCalledWith(HOLDER, '_cunningStrikeSkippedRound', CAMPAIGN);
    expect(getCurrentCombatRound).toHaveBeenCalledWith(CAMPAIGN);
    expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
  });

  it.each([
    ['no map → buildCtxSync only', null, 7],
    ['map present → buildCtx only', 'greypaw-forest', 4],
  ])('%s — WM-008: never consume one-shot attack te', async (_label, mapName, sneakDice) => {
    // Builder-distinct dice bytes: buildCtx=4 vs buildCtxSync=7 prove by the
    // returned sneakDice alone which builder actually ran.
    const buildCtx = vi.fn(() => Promise.resolve({ sneakAttackDice: 4 }));
    const ctx = makeCtx({ mapName, buildCtx });
    const result = await csStep.handler(ctx);
    expect(result.data).toEqual({ _cunningStrike: true, sneakDice });
    const used = mapName ? buildCtx : ctx.buildCtxSync;
    const idle = mapName ? ctx.buildCtxSync : buildCtx;
    expect(used).toHaveBeenCalledWith(ctx.attack, { consumeAttackTe: false });
    expect(idle).not.toHaveBeenCalled();
  });

  it.each([
    ['used stamp, object form', { round: 1, activeCreature: HOLDER }],
    ['used stamp, legacy number form', 1],
  ])('%s in current round → suppressed, sneak dice pass through, zero store side effects', async (_label, stamp) => {
    runtimeValues({ lastAttack: { hit: true }, _CunningStrike_usedRound: stamp });
    const ctx = makeCtx();
    const result = await csStep.handler(ctx);
    expect(result).toEqual({ data: { sneakDice: 7 } });
    expect(ctx.setAttackRiderModal).not.toHaveBeenCalled();
    expect(getCombatContext).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('skipped stamp in current round → suppressed AND one-shot skip cleared', async () => {
    runtimeValues({ lastAttack: { hit: true }, _cunningStrikeSkippedRound: { round: 1, activeCreature: HOLDER } });
    const ctx = makeCtx();
    const result = await csStep.handler(ctx);
    expect(result).toEqual({ data: { sneakDice: 7 } });
    expect(ctx.setAttackRiderModal).not.toHaveBeenCalled();
    expect(setRuntimeValue).toHaveBeenCalledWith(HOLDER, '_cunningStrikeSkippedRound', null, CAMPAIGN);
  });

  it('used in an earlier round → re-armed (round 2 vs stamp round 1)', async () => {
    runtimeValues({ lastAttack: { hit: true }, _CunningStrike_usedRound: { round: 1, activeCreature: HOLDER } });
    getCurrentCombatRound.mockReturnValue(2);
    const ctx = makeCtx();
    const result = await csStep.handler(ctx);
    expect(result.modal?.type).toBe('cunningStrike');
  });

  it.each([
    ['no Cunning Strike passive', [], 7],
    ['sneak dice unavailable', [csPassive], 0],
  ])('%s → no prompt, sneak dice pass through unchanged', async (_label, passives, sneakAttackDice) => {
    const ctx = makeCtx({
      playerStats: { name: HOLDER, level: 14, automation: { actions: [], passives } },
      buildCtxSync: vi.fn(() => Promise.resolve({ sneakAttackDice })),
    });
    const result = await csStep.handler(ctx);
    expect(result).toEqual({ data: { sneakDice: sneakAttackDice } });
    expect(ctx.setAttackRiderModal).not.toHaveBeenCalled();
  });

  it.each([
    ['miss', { hit: false }, null],
    ['crit-only lastAttack', { hit: false, isCrit: true }, 'cunningStrike'],
  ])('lastAttack outcome gates the rebuild — %s', async (_label, lastAttack, modalType) => {
    runtimeValues({ lastAttack });
    const ctx = makeCtx();
    const result = await csStep.handler(ctx);
    if (modalType) {
      expect(result.modal?.type).toBe('cunningStrike');
    } else {
      expect(result).toEqual({ data: { sneakDice: 0 } });
      expect(ctx.buildCtxSync).not.toHaveBeenCalled();
    }
  });
});

describe('buildChargerStep (FT-022/023)', () => {
  function chargerCtx(overrides = {}) {
    return makeCtx({
      attack: { name: 'Glaive', damage: '1d10+4', damageType: 'Slashing', weaponType: 'melee' },
      playerStats: { name: HOLDER, level: 8, automation: { actions: [], passives: [chargerPassive] } },
      ...overrides,
    });
  }

  it('melee hit → exact modal/data/sink bytes', async () => {
    const ctx = chargerCtx();
    const result = await chargerStep.handler(ctx);
    expect(result).toEqual({
      data: { _charger: true },
      modal: {
        type: 'charger',
        props: { action: chargerPassive, playerStats: ctx.playerStats, campaignName: CAMPAIGN, targetName: TARGET },
      },
    });
    expect(ctx.setAttackRiderModal).toHaveBeenCalledWith(result.modal.props);
    expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack', CAMPAIGN);
    expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
  });

  it.each([
    ['no charger passive', { name: HOLDER, level: 8, automation: { actions: [], passives: [] } }, { hit: true, attackerName: HOLDER }],
    ['passive does not match trigger/chooseOne', { name: HOLDER, level: 8, automation: { actions: [], passives: [{ name: 'Charge Attack', type: 'attack_rider', trigger: 'melee_hit_after_30ft_charge', chooseOne: false }] } }, { hit: true, attackerName: HOLDER }],
    ['lastAttack from another attacker', null, { hit: true, attackerName: 'Goblin' }],
    ['lastAttack was a miss', null, { hit: false, attackerName: HOLDER }],
  ])('%s → inert {data:{}}, no modal', async (_label, playerStats, lastAttack) => {
    runtimeValues({ lastAttack });
    const ctx = chargerCtx(playerStats ? { playerStats } : {});
    const result = await chargerStep.handler(ctx);
    expect(result).toEqual({ data: {} });
    expect(ctx.setAttackRiderModal).not.toHaveBeenCalled();
    expect(getCombatContext).not.toHaveBeenCalled();
  });

  it.each([
    ['used stamp, object form', '_Charge_Attack_usedRound', { round: 1, activeCreature: HOLDER }],
    ['used stamp, legacy number form', '_Charge_Attack_usedRound', 1],
    ['skipped stamp, object form', '_Charge_Attack_skippedRound', { round: 1, activeCreature: HOLDER }],
  ])('%s in current round suppresses the chooser — holder-scoped, campaign-keyed key bytes', async (_label, key, stamp) => {
    runtimeValues({ lastAttack: { hit: true, attackerName: HOLDER }, [key]: stamp });
    const ctx = chargerCtx();
    const result = await chargerStep.handler(ctx);
    expect(result).toEqual({ data: {} });
    expect(ctx.setAttackRiderModal).not.toHaveBeenCalled();
    expect(getRuntimeValue).toHaveBeenCalledWith(HOLDER, '_Charge_Attack_usedRound', CAMPAIGN);
    expect(getRuntimeValue).toHaveBeenCalledWith(HOLDER, '_Charge_Attack_skippedRound', CAMPAIGN);
  });

  it('re-arms in round 2 — latch round read from combat context, not getCurrentCombatRound', async () => {
    runtimeValues({ lastAttack: { hit: true, attackerName: HOLDER }, _Charge_Attack_usedRound: { round: 1, activeCreature: HOLDER } });
    getCombatContext.mockResolvedValue({ round: 2, creatures: [] });
    const ctx = chargerCtx();
    const result = await chargerStep.handler(ctx);
    expect(result.modal?.type).toBe('charger');
    expect(getCurrentCombatRound).not.toHaveBeenCalled();
  });
});

describe('buildBardicInspirationOffenseStep — offense chooser', () => {
  // Gate + ledger byte-path census. Prompt-firing rows are settled by an explicit
  // DECLINE event (still a real player choice) so nothing is left dangling.
  it.each([
    { label: 'offense unavailable → {data:{}}', offense: false, dieSize: 8, raw: { current: 2 }, tracked: null, prompt: false },
    { label: 'die size missing → {data:{}} (silent skip, never bare null — #1041), no prompt', offense: true, dieSize: null, raw: { current: 2 }, tracked: null, prompt: false },
    { label: 'uses 0, object ledger → {data:{}} (silent skip, never bare null — #1041), no prompt', offense: true, dieSize: 8, raw: { current: 0 }, tracked: null, prompt: false },
    { label: 'uses 0, legacy number ledger → {data:{}} (silent skip, never bare null — #1041), no prompt', offense: true, dieSize: 8, raw: 0, tracked: null, prompt: false },
    { label: 'no ledger anywhere → {data:{}} (silent skip, never bare null — #1041), no prompt', offense: true, dieSize: 8, raw: null, tracked: null, prompt: false },
    { label: 'object ledger current:2 → prompt fires', offense: true, dieSize: 8, raw: { current: 2 }, tracked: null, prompt: true },
    { label: 'legacy number ledger 3 → prompt fires', offense: true, dieSize: 8, raw: 3, tracked: null, prompt: true },
    { label: 'trackedResources fallback when raw null → prompt fires', offense: true, dieSize: 8, raw: null, tracked: 1, prompt: true },
  ])('$label', async ({ offense, dieSize, raw, tracked, prompt }) => {
    hasBardicInspirationOffense.mockReturnValue(offense);
    getBardicInspirationDieSize.mockReturnValue(dieSize);
    runtimeValues({ bardicInspirationUses: raw });
    const ctx = makeCtx({
      playerStats: {
        name: HOLDER,
        level: 14,
        automation: { actions: [], passives: [] },
        ...(tracked !== null ? { _trackedResources: { bardicInspirationUses: { current: tracked } } } : {}),
      },
      targetName: 'Goblin',
    });
    const pending = biStep.handler(ctx);
    if (prompt) {
      window.dispatchEvent(new CustomEvent('bardic-inspiration-offense-result', { detail: { promptId: BI_PID, used: false } }));
    }
    // Shape pin (#1041): EVERY no-prompt arm must be the exact {data:{}}
    // continue-token — bare null is the pipeline ABORT token (actionPipeline.js:36
    // `if (result === null) break;`) and would strand rollBaseDamage (subscribes
    // 'bi:checked') so a hit with exhausted BI rolled no base damage.
    const result = await pending;
    expect(result).toEqual({ data: {} });
    expect(hasBardicInspirationOffense).toHaveBeenCalledWith(HOLDER, CAMPAIGN);
    if (prompt) {
      expect(sendBardicInspirationOffensePrompt).toHaveBeenCalledWith(CAMPAIGN, HOLDER, 'Goblin', dieSize, BI_PID);
    } else {
      expect(sendBardicInspirationOffensePrompt).not.toHaveBeenCalled();
    }
    expect(spendResource).not.toHaveBeenCalled();
  });

  // The chooser waits indefinitely; only the player's event settles it.
  it.each([
    ['ACCEPT spends one use, stashes the die roll, and logs it', true, 5],
    ['DECLINE spends nothing and logs nothing', false, undefined],
  ])('%s', async (_label, used, biRoll) => {
    hasBardicInspirationOffense.mockReturnValue(true);
    getBardicInspirationDieSize.mockReturnValue(8);
    runtimeValues({ bardicInspirationUses: { current: 2 } });
    const ctx = makeCtx({ targetName: 'Goblin' });
    const pending = biStep.handler(ctx);

    // A foreign promptId must neither settle nor consume the chooser.
    window.dispatchEvent(new CustomEvent('bardic-inspiration-offense-result', { detail: { promptId: 'bi-offense-not-mine', used: true, biRoll: 99 } }));
    window.dispatchEvent(new CustomEvent('bardic-inspiration-offense-result', { detail: { promptId: BI_PID, used, biRoll } }));
    expect(await pending).toEqual({ data: {} });

    if (used) {
      expect(spendResource).toHaveBeenCalledWith(HOLDER, 'bardicInspirationUses', 1, CAMPAIGN);
      expect(setRuntimeObject).toHaveBeenCalledWith(HOLDER, { bardicInspirationOffenseValue: '5' }, CAMPAIGN, true);
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
        type: 'ability_use',
        characterName: HOLDER,
        abilityName: 'Combat Inspiration - Offense',
        description: `${HOLDER} used Combat Inspiration - Offense, rolling 5 (d8) bonus damage against Goblin.`,
        biDieRoll: 5,
        timestamp: expect.any(Number),
      });
    } else {
      expect(spendResource).not.toHaveBeenCalled();
      expect(setRuntimeObject).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    }
  });

  it('unanswered chooser stays pending forever — no clock ever settles it (T2 no-timers)', async () => {
    hasBardicInspirationOffense.mockReturnValue(true);
    getBardicInspirationDieSize.mockReturnValue(8);
    runtimeValues({ bardicInspirationUses: { current: 2 } });
    const ctx = makeCtx({ targetName: 'Goblin' });
    const pending = biStep.handler(ctx);
    // Race against an already-resolved sentinel: any auto-resolve timer added in
    // future would flip this to 'settled' and fail this falsifiable check.
    const raced = await Promise.race([pending.then(() => 'settled'), Promise.resolve('pending')]);
    expect(raced).toBe('pending');
    expect(spendResource).not.toHaveBeenCalled();
    window.dispatchEvent(new CustomEvent('bardic-inspiration-offense-result', { detail: { promptId: BI_PID, used: false } }));
    await pending;
  });

  // #1041 consumer-relay pin: the no-die/no-uses arms must RELAY the chain on to
  // 'bi:checked' (real createPipeline, real biStep, stand-in for rollBaseDamage —
  // its own lane owns its body, this only pins the seam). Documented outcome shift:
  // PRE-fix these arms returned bare null, which actionPipeline.js:36
  // (`if (result === null) break;`) treats as chain ABORT — a BI-exhausted bard's
  // hit never reached rollBaseDamage. The {data:{}} shape restores the INTENDED
  // silent-skip parity with the :168 no-offense arm; prompt/accept/decline rows
  // above are byte-identical pre/post.
  it.each([
    ['die size missing', { dieSize: null, raw: { current: 2 } }],
    ['uses 0', { dieSize: 8, raw: { current: 0 } }],
  ])('#1041 relay — %s: chain continues past bi:checked to the damage step', async (_label, { dieSize, raw }) => {
    hasBardicInspirationOffense.mockReturnValue(true);
    getBardicInspirationDieSize.mockReturnValue(dieSize);
    runtimeValues({ bardicInspirationUses: raw });
    const reached = [];
    const pipeline = createPipeline();
    pipeline.step(biStep);
    pipeline.step({
      name: 'rollBaseDamageStandIn',
      subscribe: 'bi:checked',
      emit: 'damage:rolled',
      handler: () => { reached.push('bi:checked'); return { data: {} }; },
    });
    const resumeRef = { current: { existingProp: 'keep' } };
    await pipeline.run('charger:checked', makeCtx({ targetName: 'Goblin' }), resumeRef);
    expect(reached).toEqual(['bi:checked']);
    expect(sendBardicInspirationOffensePrompt).not.toHaveBeenCalled();
    expect(spendResource).not.toHaveBeenCalled();
    // Clean terminal exit: no pause envelope left behind, pre-existing state intact.
    expect(resumeRef.current).toBeNull();
  });
});

describe('#1348 return-shape census — every skip/continue arm of all four riders', () => {
  // Contract (actionPipeline.js:10): handler result is { data?, modal?, popup?, nextEvent? } | null,
  // and null ABORTS the chain (:36, pinned by actionPipeline.test.js "aborts the chain").
  // Rider steps must never emit bare null on inert paths — exact-bytes pins below.
  it.each([
    {
      label: 'attackRiderManeuvers: hit, no rider options → :51',
      run: async () => {
        getAttackRiderOptions.mockResolvedValue([]);
        return maneuversStep.handler(makeCtx({ popupHtml: { hit: true } }));
      },
      expected: { data: {} },
    },
    {
      label: 'attackRiderManeuvers: miss, no miss riders → :51',
      run: async () => {
        getAttackRiderOptionsByContext.mockResolvedValue([]);
        return maneuversStep.handler(makeCtx({ popupHtml: { hit: false } }));
      },
      expected: { data: {} },
    },
    {
      label: 'cunningStrike: lastAttack miss → :100',
      run: async () => {
        runtimeValues({ lastAttack: { hit: false } });
        return csStep.handler(makeCtx());
      },
      expected: { data: { sneakDice: 0 } },
    },
    {
      label: 'cunningStrike: hit, no cunning passive → :113',
      run: async () => csStep.handler(makeCtx({ playerStats: { name: HOLDER, level: 14, automation: { actions: [], passives: [] } } })),
      expected: { data: { sneakDice: 7 } },
    },
    {
      label: 'charger: no charge passive → :131',
      run: async () => chargerStep.handler(makeCtx({ attack: { weaponType: 'melee' }, playerStats: { name: HOLDER, automation: { passives: [] } } })),
      expected: { data: {} },
    },
    {
      label: 'bardicInspirationOffense: no offense feature → :168',
      run: async () => {
        hasBardicInspirationOffense.mockReturnValue(false);
        return biStep.handler(makeCtx());
      },
      expected: { data: {} },
    },
    {
      label: 'bardicInspirationOffense: die missing → :174 (#1041 was bare null)',
      run: async () => {
        hasBardicInspirationOffense.mockReturnValue(true);
        getBardicInspirationDieSize.mockReturnValue(null);
        runtimeValues({ bardicInspirationUses: { current: 2 } });
        return biStep.handler(makeCtx());
      },
      expected: { data: {} },
    },
    {
      label: 'bardicInspirationOffense: uses 0 → :174 (#1041 was bare null)',
      run: async () => {
        hasBardicInspirationOffense.mockReturnValue(true);
        getBardicInspirationDieSize.mockReturnValue(8);
        runtimeValues({ bardicInspirationUses: { current: 0 } });
        return biStep.handler(makeCtx());
      },
      expected: { data: {} },
    },
  ])('$label', async ({ run, expected }) => {
    const result = await run();
    expect(result, 'no rider skip-arm may return bare null (abort token)').not.toBeNull();
    expect(result).toEqual(expected);
  });
});
