// @maintained-by-ai
// twinklingConstellationHandler: CLA-368 chooser lane (distinct from
// starryFormHandler's assume-form modal and starryFormArrowHandler's attack_roll seam).
// Deterministic seam: handle() → level gate → Starry Form prerequisite gate (buff stamp OR
// campaign target-effect) → turn-owner gate → once-per-turn press latch → chooser modal;
// applyConstellationOption() → validation, buff replacement (exact array pin), te mirror
// (skipSync), one merged rounds:10 expiration clock, exactly one ability_use log.
// targetEffectDefinitions.test.js owns registry internals; automationService.interactive.
// twinkling.test.js owns isInteractive dispatch; component suites mock this handler.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  getActiveCreatureName: vi.fn(() => null),
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../rules/effects/expirationQueue.js', () => ({
  addExpiration: vi.fn(),
}));

import { handle, applyConstellationOption } from './twinklingConstellationHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import { getCombatSummary, getActiveCreatureName, getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addExpiration } from '../../../rules/effects/expirationQueue.js';

const campaignName = 'TestCampaign';
const playerName = 'TestSorcerer';

function starryBuff(constellation = 'Archer') {
  return { name: 'Starry Form', effect: 'starry_form', constellation };
}

// Key-aware runtime router: handle()'s gates read activeBuffs, campaign
// targetEffects, top-level activeCreatureName and the CLA-368 press latch.
function runtimeWith({ buffs, targetEffects, activeCreature, latch } = {}) {
  getRuntimeValue.mockImplementation((store, key) => {
    if (key === 'activeBuffs') return buffs !== undefined ? buffs : [];
    if (key === 'targetEffects') return targetEffects !== undefined ? targetEffects : [];
    if (key === 'activeCreatureName') return activeCreature !== undefined ? activeCreature : null;
    if (key === '_Twinkling_Constellations_usedRound') return latch !== undefined ? latch : null;
    return [];
  });
}

function makePlayerStats(overrides = {}) {
  return {
    name: playerName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Wisdom', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Twinkling Constellations',
    automation: { type: 'twinkling_constellation', ...automation },
  };
}

// Full popup-payload pin (own composition — the refusal() helper is this handler's).
function expectRefusalPopup(result, action, reason) {
  expect(result).toEqual({
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: action.name,
      automationType: action.automation.type,
      description: `${action.name}: ${reason}`,
      automation: action.automation,
    },
  });
}

function expectRefusalLogged(reason) {
  expect(logService.addEntry).toHaveBeenCalledTimes(1);
  const entry = logService.addEntry.mock.calls[0][1];
  expect(entry.type).toBe('automation');
  expect(entry.automationType).toBe('twinkling_constellations_refused');
  expect(entry.description).toBe(`Twinkling Constellations refused — ${reason}`);
}

describe('twinklingConstellationHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
    getCombatSummary.mockReturnValue(null);
    getActiveCreatureName.mockReturnValue(null);
    getCurrentCombatRound.mockReturnValue(1);
  });

  describe('handle', () => {
    it('returns automation_info popup when player is below level 10', async () => {
      const action = makeAction({ customField: 'test' });

      const result = await handle(action, makePlayerStats({ level: 9 }), campaignName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Twinkling Constellations',
          description: 'Twinkling Constellations requires level 10.',
          automation: action.automation,
        },
      });
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    // CLA-368: pressing with no active Starry Form must never open the
    // chooser (previously it bootstrapped the constellation benefit for free).
    it('refuses with zero state when Starry Form is not active', async () => {
      runtimeWith({ buffs: null, targetEffects: [] });

      const result = await handle(makeAction(), makePlayerStats({ level: 20 }), campaignName);

      expectRefusalPopup(result, makeAction(), 'Starry Form is not active. Assume Starry Form first.');
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expectRefusalLogged('Starry Form is not active. Assume Starry Form first.');
    });

    it('accepts an active starry_form campaign target-effect as the prerequisite', async () => {
      runtimeWith({
        buffs: [],
        targetEffects: [{ effect: 'starry_form', source: playerName, target: playerName }],
      });

      const result = await handle(makeAction(), makePlayerStats({ level: 20 }), campaignName);

      expect(result.type).toBe('modal');
    });

    it('opens the chooser outside initiative with an advisory note and no writes', async () => {
      runtimeWith({ buffs: [starryBuff()] });

      const playerStats = makePlayerStats({ level: 20 });
      const action = makeAction();
      const result = await handle(action, playerStats, campaignName);

      expect(result).toEqual({
        type: 'modal',
        modalName: 'twinklingConstellation',
        payload: { action, playerStats, campaignName },
      });
      expect(logService.addEntry).toHaveBeenCalledTimes(1);
      expect(logService.addEntry.mock.calls[0][1].automationType).toBe('twinkling_constellations_advisory');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses when it is another creature\'s turn', async () => {
      runtimeWith({ buffs: [starryBuff()], activeCreature: 'Goblin 1' });
      getCombatSummary.mockReturnValue({ round: 3, activeCreatureName: 'Goblin 1' });
      getActiveCreatureName.mockReturnValue('Goblin 1');

      const action = makeAction();
      const result = await handle(action, makePlayerStats({ level: 20 }), campaignName);

      const reason = 'You can only change constellation at the start of your turn — it is Goblin 1\'s turn.';
      expectRefusalPopup(result, action, reason);
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expectRefusalLogged(reason);
    });

    it('refuses a second press in the same round (turn latch)', async () => {
      runtimeWith({ buffs: [starryBuff()], activeCreature: playerName, latch: 3 });
      getCombatSummary.mockReturnValue({ round: 3, activeCreatureName: playerName });
      getCurrentCombatRound.mockReturnValue(3);

      const action = makeAction();
      const result = await handle(action, makePlayerStats({ level: 20 }), campaignName);

      expectRefusalPopup(result, action, 'You have already changed constellation this turn.');
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expectRefusalLogged('You have already changed constellation this turn.');
    });

    it('stamps the press latch at the current round when allowed', async () => {
      runtimeWith({ buffs: [starryBuff()], activeCreature: playerName, latch: null });
      getCombatSummary.mockReturnValue({ round: 4, activeCreatureName: playerName });
      getCurrentCombatRound.mockReturnValue(4);

      const result = await handle(makeAction(), makePlayerStats({ level: 20 }), campaignName);

      expect(result.type).toBe('modal');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        '_Twinkling_Constellations_usedRound',
        4,
        campaignName,
      );
    });

    it('re-arms on a later round (latch < round) and re-stamps the latch', async () => {
      runtimeWith({ buffs: [starryBuff()], activeCreature: playerName, latch: 3 });
      getCombatSummary.mockReturnValue({ round: 4, activeCreatureName: playerName });
      getCurrentCombatRound.mockReturnValue(4);

      const result = await handle(makeAction(), makePlayerStats({ level: 20 }), campaignName);

      expect(result.type).toBe('modal');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        '_Twinkling_Constellations_usedRound',
        4,
        campaignName,
      );
    });
  });

  describe('applyConstellationOption', () => {
    // Invalid option is inert: popup only, zero state writes, zero logs, zero clocks.
    it('returns error popup for invalid constellation names without writing, logging, or clocking', async () => {
      for (const name of ['Invalid', null, '']) {
        const action = makeAction();

        const result = await applyConstellationOption(action, makePlayerStats({ level: 10 }), campaignName, name);

        expect(result).toEqual({
          type: 'popup',
          payload: {
            type: 'automation_info',
            name: 'Twinkling Constellations',
            automationType: 'twinkling_constellation',
            description: `Invalid constellation: ${name}`,
            automation: action.automation,
          },
        });
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
      }
    });

    it('describes Archer damage 1d8 below level 10 and 2d8 at level 10+ (full-string)', async () => {
      const low = await applyConstellationOption(makeAction(), makePlayerStats({ level: 9 }), campaignName, 'Archer');
      expect(low.payload.description).toBe('Archer constellation chosen (Twinkling Constellations). Ranged Spell Attack: 1d8 + Wisdom Modifier Radiant damage.');

      const high = await applyConstellationOption(makeAction(), makePlayerStats({ level: 10 }), campaignName, 'Archer');
      expect(high.payload.description).toBe('Archer constellation chosen (Twinkling Constellations). Ranged Spell Attack: 2d8 + Wisdom Modifier Radiant damage.');
    });

    it('describes Chalice healing 1d8 below level 10 and 2d8 at level 10+ (full-string)', async () => {
      const low = await applyConstellationOption(makeAction(), makePlayerStats({ level: 9 }), campaignName, 'Chalice');
      expect(low.payload.description).toBe('Chalice constellation chosen (Twinkling Constellations). Healing Spell Ally Buff: 1d8 + Wisdom Modifier HP to ally within 30 feet.');

      const high = await applyConstellationOption(makeAction(), makePlayerStats({ level: 10 }), campaignName, 'Chalice');
      expect(high.payload.description).toBe('Chalice constellation chosen (Twinkling Constellations). Healing Spell Ally Buff: 2d8 + Wisdom Modifier HP to ally within 30 feet.');
    });

    it('gives Dragon the concentration benefit only below level 10, plus fly speed at level 10+ (full-string + buff stamp)', async () => {
      const low = await applyConstellationOption(makeAction(), makePlayerStats({ level: 9 }), campaignName, 'Dragon');
      expect(low.payload.description).toBe('Dragon constellation chosen (Twinkling Constellations). Concentration Benefit: Treat d20 rolls of 9 or lower on Concentration checks/saves as 10.');

      const high = await applyConstellationOption(makeAction(), makePlayerStats({ level: 10 }), campaignName, 'Dragon');
      expect(high.payload.description).toBe('Dragon constellation chosen (Twinkling Constellations). Concentration Benefit: Treat d20 rolls of 9 or lower on Concentration checks/saves as 10. Fly Speed 20 feet (hover).');
      // CLA-368: at level 10+ the buff entry itself carries the fly stamp.
      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Starry Form',
            constellation: 'Dragon',
            effect: 'fly_speed_20_hover',
            flySpeed: 20,
          }),
        ]),
        campaignName,
      );
    });

    it('replaces the Starry Form buff exactly: preserves unrelated buffs, writes the full new entry', async () => {
      const otherBuff = { name: 'Other Buff', effect: 'other' };
      runtimeWith({ buffs: [starryBuff('Archer'), otherBuff] });

      await applyConstellationOption(makeAction(), makePlayerStats({ level: 10 }), campaignName, 'Chalice');

      // Exact-array pin: stale Starry Form removed, unrelated buff preserved,
      // new entry carries the full shape (never splice the store's reference).
      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'activeBuffs',
        [
          otherBuff,
          {
            name: 'Starry Form',
            effect: 'starry_form',
            constellation: 'Chalice',
            duration: '1_minute',
            hasAutomation: true,
            resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
          },
        ],
        campaignName,
      );
    });

    it('mirrors the starry_form target-effect on campaign with skipSync, replacing only this source\'s entries', async () => {
      const selfStale = { effect: 'starry_form', source: playerName, target: playerName, constellation: 'Archer', duration: '1_minute' };
      const otherStarry = { effect: 'starry_form', source: 'OtherSorcerer', target: 'OtherSorcerer', constellation: 'Dragon', duration: '1_minute' };
      runtimeWith({ buffs: [starryBuff('Archer')], targetEffects: [selfStale, otherStarry] });

      await applyConstellationOption(makeAction(), makePlayerStats({ level: 10 }), campaignName, 'Chalice');

      // Exact pin: self-stale replaced, other sources preserved, skipSync=true
      // (SSE-echoed data must never re-POST — see AGENTS.md gotcha).
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [
          otherStarry,
          {
            effect: 'starry_form',
            source: playerName,
            target: playerName,
            constellation: 'Chalice',
            duration: '1_minute',
          },
        ],
        campaignName,
        true,
      );
    });

    // CLA-368: one Choose = exactly one ability_use entry (the modal/lane
    // double-apply previously wrote two 13ms apart).
    it('writes exactly one ability_use log with the full description on successful apply', async () => {
      await applyConstellationOption(makeAction(), makePlayerStats({ level: 10 }), campaignName, 'Archer');

      expect(logService.addEntry).toHaveBeenCalledTimes(1);
      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: playerName,
          abilityName: 'Twinkling Constellations',
          description: 'TestSorcerer changed Starry Form constellation to Archer with Twinkling Constellations. Ranged Spell Attack: 2d8 + Wisdom Modifier Radiant damage.',
          timestamp: expect.any(Number),
        }),
      );
    });

    // CLA-368: the '1_minute' stamp gets a rounds:10 expiry clock.
    it('registers one merged rounds:10 expiration clock matching the stamps', async () => {
      await applyConstellationOption(makeAction(), makePlayerStats({ level: 10 }), campaignName, 'Dragon');

      expect(addExpiration).toHaveBeenCalledTimes(1);
      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: playerName,
        targetName: playerName,
        effects: [
          { type: 'remove_active_buff', buffName: 'Starry Form' },
          { type: 'remove_target_effect', effectKey: 'starry_form', source: playerName, target: playerName },
        ],
        campaignName,
        rounds: 10,
      });
    });

    it('handles null, undefined, or non-array runtime storage gracefully', async () => {
      for (const val of [null, undefined, 'not-an-array']) {
        getRuntimeValue.mockReturnValue(val);

        const action = makeAction();
        const result = await applyConstellationOption(action, makePlayerStats({ level: 10 }), campaignName, 'Archer');

        expect(result.payload.description).toBe('Archer constellation chosen (Twinkling Constellations). Ranged Spell Attack: 2d8 + Wisdom Modifier Radiant damage.');
        expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'activeBuffs', [
          expect.objectContaining({ name: 'Starry Form', constellation: 'Archer' }),
        ], campaignName);
        vi.clearAllMocks();
      }
    });
  });
});
