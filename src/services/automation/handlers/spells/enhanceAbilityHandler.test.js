import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [{ name: 'TestCaster' }, { name: 'Wolf' }] })),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { set: vi.fn(), get: vi.fn() },
}));

import { handle, applyEnhanceAbility, ENHANCE_ABILITY_ABILITIES } from './enhanceAbilityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addEntry } from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 5,
    proficiency: 3,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Enhance Ability',
    spell: { name: 'Enhance Ability', level: 2, casting_time: 'Action' },
    automation: { type: 'enhance_ability', range: 'Touch', ...automation },
  };
}

describe('enhanceAbilityHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addEntry.mockResolvedValue({});
  });

  describe('ENHANCE_ABILITY_ABILITIES', () => {
    it('exposes the five eligible abilities without Constitution', () => {
      const values = ENHANCE_ABILITY_ABILITIES.map(a => a.value);
      expect(values).toEqual(['STR', 'DEX', 'INT', 'WIS', 'CHA']);
      expect(values).not.toContain('CON');
    });
  });

  describe('handle', () => {
    // SP-039: 'enhance_ability_target_selection' had zero renderer consumers —
    // the dead popup type is dropped; the lane reports via rendered automation_info.
    it('returns rendered automation_info popup listing creatures (no dead popup type)', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestCaster' },
          { name: 'Goblin' },
          { name: 'Wolf' },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('TestCaster');
      expect(result.payload.description).toContain('Goblin');
    });

    it('returns popup when no combat context', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No combat context');
    });

    it('passes automation metadata through on the info popup', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'TestCaster' }] });

      const result = await handle(makeAction({ range: '30 feet' }), makePlayerStats(), campaignName, null);

      expect(result.payload.automation.range).toBe('30 feet');
    });
  });

  describe('applyEnhanceAbility', () => {
    it('returns null when no targets or ability provided', async () => {
      const result = await applyEnhanceAbility({
    action: makeAction(),
    playerStats: makePlayerStats(),
    campaignName,
    mapName: null,
    targetNames: [],
    ability: 'STR',
});
      expect(result).toBeNull();

      const result2 = await applyEnhanceAbility({
    action: makeAction(),
    playerStats: makePlayerStats(),
    campaignName,
    mapName: null,
    targetNames: ['Wolf'],
    ability: null,
});
      expect(result2).toBeNull();
    });

    it('adds enhance_ability targetEffect with concentration duration and returns outcome popup', async () => {
      getRuntimeValue.mockReturnValue([]);

      const result = await applyEnhanceAbility({
    action: makeAction(),
    playerStats: makePlayerStats(),
    campaignName,
    mapName: null,
    targetNames: ['Wolf'],
    ability: 'STR',
});

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [expect.objectContaining({
          target: 'Wolf',
          effect: 'enhance_ability',
          source: 'TestCaster',
          ability: 'STR',
          duration: 'concentration',
        })],
        campaignName,
      );

      // Full-string own-composition pin (outcome description)
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'TestCaster cast Enhance Ability on Wolf: Advantage on Strength ability checks for up to 1 hour (concentration).'
      );
    });

    it('replaces existing enhance_ability effect for the same target/source', async () => {
      getRuntimeValue.mockReturnValue([
        { target: 'Wolf', effect: 'enhance_ability', source: 'TestCaster', ability: 'DEX', duration: 'concentration' },
      ]);

      await applyEnhanceAbility({
    action: makeAction(),
    playerStats: makePlayerStats(),
    campaignName,
    mapName: null,
    targetNames: ['Wolf'],
    ability: 'WIS',
});

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [expect.objectContaining({ ability: 'WIS' })],
        campaignName,
      );
    });

    it('preserves unrelated targetEffects', async () => {
      const existing = [
        { target: 'Goblin', effect: 'bane_penalty', source: 'TestCaster' },
      ];
      getRuntimeValue.mockReturnValue(existing);

      await applyEnhanceAbility({
    action: makeAction(),
    playerStats: makePlayerStats(),
    campaignName,
    mapName: null,
    targetNames: ['Wolf'],
    ability: 'INT',
});

      const effects = setRuntimeValue.mock.calls[0][2];
      // Literal pins — effects[] aliases the mutated `existing` array, so
      // comparing against existing[i] would be trivially true.
      expect(effects).toHaveLength(2);
      expect(effects[0]).toEqual({ target: 'Goblin', effect: 'bane_penalty', source: 'TestCaster' });
      expect(effects[1]).toEqual(expect.objectContaining({ target: 'Wolf', effect: 'enhance_ability', ability: 'INT' }));
    });

    it('logs exactly one ability_use entry with ability label', async () => {
      getRuntimeValue.mockReturnValue([]);

      await applyEnhanceAbility({
    action: makeAction(),
    playerStats: makePlayerStats(),
    campaignName,
    mapName: null,
    targetNames: ['Wolf'],
    ability: 'CHA',
});

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: 'Enhance Ability',
          targetName: 'Wolf',
          description: expect.stringContaining('Charisma'),
        }),
      );
      const abilityUseCalls = addEntry.mock.calls.filter(([, e]) => e.type === 'ability_use');
      expect(abilityUseCalls).toHaveLength(1);
    });

    // SP-039: concentration must be registered on the caster and the summary persisted
    // (protectionFromEnergyHandler SP-093/CLA-170 pattern) — te alone never breaks cleanly.
    it('registers caster concentration and persists the combat summary', async () => {
      getRuntimeValue.mockReturnValue([]);
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      await applyEnhanceAbility({
        action: makeAction(),
        playerStats: makePlayerStats({ spellAbilities: { saveDc: 17 } }),
        campaignName,
        mapName: null,
        targetNames: ['Wolf'],
        ability: 'CHA',
      });

      expect(getCombatSummary).toHaveBeenCalledWith(campaignName);
      expect(addConcentration).toHaveBeenCalledWith(
        expect.objectContaining({ creatures: expect.any(Array) }),
        'TestCaster',
        'Enhance Ability',
        17,
        'Wolf',
      );
      expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.objectContaining({ creatures: expect.any(Array) }), campaignName);
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
      dispatchSpy.mockRestore();
    });
  });

  // CLA-113 lesson: positional-vs-object call-shape pin for the object-destructure
  // signature — a positional call silently yields undefined keys and returns null.
  describe('call-shape contract (CLA-113 family)', () => {
    it('a positional call shape returns null without stamping anything', async () => {
      getRuntimeValue.mockReturnValue([]);

      const result = await applyEnhanceAbility(makeAction(), makePlayerStats(), campaignName, null, ['Wolf'], 'CHA');

      expect(result).toBeNull();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addConcentration).not.toHaveBeenCalled();
    });
    // Positive control for the object shape lives in 'applyEnhanceAbility'
    // above ('adds enhance_ability targetEffect...', 'registers caster
    // concentration...') — both drive the object call shape with exact pins,
    // so a weak not.toBeNull()/toHaveBeenCalled() twin here was redundant.
  });
});
