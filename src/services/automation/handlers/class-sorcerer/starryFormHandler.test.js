// @maintained-by-ai
// starryFormHandler: modal gate + constellation application lane.
// Deterministic seam: handle() → wildShapeUses consumption gate (level 10+ with a
// constellation already active skips consume) → constellation modal;
// applyConstellationOption() → buff replacement + campaign targetEffect registration
// (skipSync) + ability_use log. Owns modal/apply only; starryFormArrowHandler.test.js
// owns the Archer attack_roll seam, starryFormDamage.test.js owns attack construction,
// targetEffectDefinitions.test.js owns registry internals.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyConstellationOption } from './starryFormHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';
const playerName = 'TestSorcerer';

const archerBuff = { name: 'Starry Form', effect: 'starry_form', constellation: 'Archer' };

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
    name: 'Starry Form',
    automation: { type: 'starry_form', uses: 2, duration: '1_minute', ...automation },
  };
}

// Keyed runtime router: activeBuffs, wildShapeUses, and targetEffects resolved independently.
function mockRuntime({ buffs = [], uses = 2, targetEffects = [] } = {}) {
  getRuntimeValue.mockImplementation((caster, key) => {
    if (key === 'activeBuffs') return buffs;
    if (key === 'targetEffects') return targetEffects;
    return uses;
  });
}

describe('starryFormHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle - constellation modal and consume gate', () => {
    it('opens constellation modal without consuming or logging when starry form is already active at level 10+', async () => {
      mockRuntime({ buffs: [archerBuff] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result).toEqual({
        type: 'modal',
        modalName: 'starryFormConstellation',
        payload: expect.objectContaining({ campaignName }),
      });
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('consumes a Wild Shape use when starry form is already active but player is below level 10', async () => {
      mockRuntime({ buffs: [archerBuff] });

      const result = await handle(makeAction(), makePlayerStats({ level: 5 }), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('starryFormConstellation');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'wildShapeUses',
        1,
        campaignName,
      );
    });

    it('consumes a Wild Shape use and opens the modal when starry form is not active even at level 10+', async () => {
      mockRuntime();

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('starryFormConstellation');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'wildShapeUses',
        1,
        campaignName,
      );
    });

    it('blocks with popup and touches nothing when wildShapeUses is exhausted', async () => {
      mockRuntime({ uses: 0 });
      const action = makeAction();

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Starry Form',
          automationType: 'starry_form',
          description: 'Starry Form has no uses remaining.',
          automation: action.automation,
        },
      });
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('always decrements wildShapeUses even when a custom resourceKey is present', async () => {
      mockRuntime({ uses: 3 });

      const result = await handle(
        makeAction({ resourceKey: 'starryFormUses', uses: 5 }),
        makePlayerStats(),
        campaignName,
      );

      expect(result.type).toBe('modal');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'wildShapeUses',
        2,
        campaignName,
      );
    });
  });

  describe('handle - uses: 0 reads the wild shape resource directly', () => {
    it('decrements the resource when uses is 0 and the resource is available', async () => {
      mockRuntime({ uses: 1 });

      const result = await handle(makeAction({ uses: 0 }), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'wildShapeUses',
        0,
        campaignName,
      );
    });

    it('blocks when the resource is zero and uses is 0', async () => {
      mockRuntime({ uses: 0 });
      const action = makeAction({ uses: 0 });

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Starry Form',
          automationType: 'starry_form',
          description: 'Starry Form has no uses remaining.',
          automation: action.automation,
        },
      });
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('applyConstellationOption', () => {
    it('returns error popup for invalid constellation name without writing or logging', async () => {
      const action = makeAction();

      const result = await applyConstellationOption(action, makePlayerStats(), campaignName, 'Invalid');

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Starry Form',
          automationType: 'starry_form',
          description: 'Invalid constellation: Invalid',
          automation: action.automation,
        },
      });
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('replaces an existing Starry Form buff and preserves unrelated buffs', async () => {
      const mageArmor = { name: 'Mage Armor', effect: 'mage_armor' };
      mockRuntime({ buffs: [{ ...archerBuff }, mageArmor] });

      const result = await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Chalice');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Chalice');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ effect: 'starry_form', constellation: 'Chalice' }),
        ]),
        campaignName,
      );
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        playerName,
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ constellation: 'Archer' }),
        ]),
        campaignName,
      );
    });

    it('registers the constellation targetEffect on campaign with skipSync, replacing only prior entries from this source', async () => {
      const selfStale = { ...archerBuff, effect: 'starry_form', source: playerName, target: playerName, constellation: 'Archer', duration: '1_minute' };
      const otherStarry = { effect: 'starry_form', source: 'OtherSorcerer', target: 'OtherSorcerer', constellation: 'Dragon', duration: '1_minute' };
      const unrelated = { effect: 'bless', source: 'OtherSorcerer', target: playerName };
      mockRuntime({ targetEffects: [selfStale, otherStarry, unrelated] });

      await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Chalice');

      // Exact pin: self-stale removed, other sources preserved, new entry appended,
      // skipSync=true (SSE-echoed data must never re-POST — see AGENTS.md gotcha).
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [
          otherStarry,
          unrelated,
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

    it('applies Archer buff at level 10+ (2d8) and logs the ability use', async () => {
      mockRuntime();

      const result = await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Archer');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Archer');
      expect(result.payload.description).toContain('2d8');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            effect: 'starry_form',
            constellation: 'Archer',
            resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
          }),
        ]),
        campaignName,
      );
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: playerName,
          abilityName: 'Starry Form',
          description: 'TestSorcerer assumed Starry Form with the Archer constellation. Ranged Spell Attack: 2d8 + Wisdom Modifier Radiant damage. Wild Shape use consumed.',
          timestamp: expect.any(Number),
        }),
      );
    });

    it('describes Archer damage as 1d8 below level 10', async () => {
      mockRuntime();

      const result = await applyConstellationOption(makeAction(), makePlayerStats({ level: 5 }), campaignName, 'Archer');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Archer');
      expect(result.payload.description).toContain('1d8');
      expect(result.payload.description).not.toContain('2d8');
    });

    it('applies Chalice buff (2d8 healing scaling)', async () => {
      mockRuntime();

      const result = await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Chalice');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Chalice');
      expect(result.payload.description).toContain('2d8');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            effect: 'starry_form',
            constellation: 'Chalice',
            resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
          }),
        ]),
        campaignName,
      );
    });

    it('applies Dragon buff with concentration benefit but no fly speed below level 10', async () => {
      mockRuntime();

      const result = await applyConstellationOption(makeAction(), makePlayerStats({ level: 5 }), campaignName, 'Dragon');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Dragon');
      expect(result.payload.description).toContain('Concentration Benefit');
      expect(result.payload.description).not.toContain('Fly Speed');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ constellation: 'Dragon', resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'] }),
        ]),
        campaignName,
      );
    });

    it('applies Dragon buff with fly speed at level 10+', async () => {
      mockRuntime();

      const result = await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Dragon');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Concentration Benefit');
      expect(result.payload.description).toContain('Fly Speed 20 feet (hover)');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            effect: 'fly_speed_20_hover',
            constellation: 'Dragon',
            flySpeed: 20,
            resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
          }),
        ]),
        campaignName,
      );
    });
  });
});
