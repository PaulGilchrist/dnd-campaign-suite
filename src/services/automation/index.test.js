import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { executeHandler } from './index.js';

// ── Module-level mocks ─

vi.mock('./handlers/combat/saveOnlyHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'save_only' }),
}));
vi.mock('./handlers/healing/healingHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'shared_healing' }),
}));
vi.mock('./handlers/combat/autoRerollHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'auto_reroll' }),
}));
vi.mock('./handlers/class-wizard/SavantHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'savant' }),
}));
vi.mock('./handlers/combat/damageReductionHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'damage_reduction' }),
}));
vi.mock('./handlers/class-sorcerer/protectiveFieldHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'protective_field' }),
}));
vi.mock('./handlers/spells/eyebiteHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({
    type: 'modal',
    modalName: 'eyebiteEffect',
    payload: { saveDc: 17 },
  }),
}));
vi.mock('./handlers/class-fighter-rogue/warMagicCantripHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'war_magic_cantrip' }),
}));
vi.mock('./handlers/class-fighter-rogue/warMagicSpellHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'war_magic_spell' }),
}));
vi.mock('../../../shared/popupResponse.js', () => ({
  automationInfoPopup: vi.fn().mockReturnValue({ type: 'popup', payload: { type: 'automation_info', description: 'test' } }),
}));

// ── Helpers ─────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 3,
    proficiencyBonus: 2,
    abilities: [{ name: 'Strength', bonus: 2 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return { name: 'Test Action', automation: { ...automation } };
}

// ── Tests ───────────────────────────────────────────────────────

describe('executeHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('null/early returns', () => {
    it.each([
      [null, 'null action'],
      [undefined, 'undefined action'],
      [{}, 'empty object'],
      [{ automation: null }, 'null automation'],
    ])('returns null for %s (%s)', async (action, _label) => {
      expect(await executeHandler(action, makePlayerStats(), campaignName, mapName)).toBeNull();
    });

    it('returns null when action.automation.type is not in HANDLER_MAP', async () => {
      const result = await executeHandler(
        makeAction({ type: 'nonexistent_type' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );
      expect(result).toBeNull();
    });
  });

  describe('handler routing', () => {
    it('routes a known handler type and returns its result', async () => {
      const { handle: saveOnlyHandle } = await import('./handlers/combat/saveOnlyHandler.js');
      saveOnlyHandle.mockResolvedValue({ result: 'save_only' });

      const action = makeAction({ type: 'save_only' });
      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(saveOnlyHandle).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ result: 'save_only' });
    });

    it('routes a shared handler (healing) used by multiple automation types', async () => {
      const { handle: healingHandle } = await import('./handlers/healing/healingHandler.js');
      healingHandle.mockResolvedValue({ result: 'shared_healing' });

      const action = makeAction({ type: 'healing' });
      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(healingHandle).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ result: 'shared_healing' });
    });

    it('routes a second type sharing the same handler (self_healing)', async () => {
      const { handle: healingHandle } = await import('./handlers/healing/healingHandler.js');
      healingHandle.mockResolvedValue({ result: 'shared_healing' });

      const action = makeAction({ type: 'self_healing' });
      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(healingHandle).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ result: 'shared_healing' });
    });
  });


  describe('error handling', () => {
    let originalConsoleError;

    beforeEach(() => {
      originalConsoleError = console.error;
      console.error = vi.fn();
    });

    afterEach(() => {
      console.error = originalConsoleError;
    });

    it('returns a popup with action.name when handler throws', async () => {
      const { handle: healingHandle } = await import('./handlers/healing/healingHandler.js');
      const action = makeAction({ type: 'healing' });
      action.name = 'Cure Wounds';
      healingHandle.mockRejectedValue(new Error('boom'));

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Failed to execute Cure Wounds');
    });
  });

  describe('spell_modifier handler', () => {
    it('returns automation_info popup for non-Metamagic types', async () => {
      const action = makeAction({ type: 'spell_modifier' });
      action.name = 'Quickened Spell';

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Quickened Spell');
    });

    it('returns null for Metamagic type', async () => {
      const action = makeAction({ type: 'spell_modifier' });
      action.name = 'Metamagic';

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toBeNull();
    });
  });

  describe('damage_reduction handler', () => {
    it('routes to protectiveField when automation.cost.resource is psionicEnergy', async () => {
      const action = makeAction({
        type: 'damage_reduction',
        cost: { resource: 'psionicEnergy' },
      });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result.result).toBe('protective_field');
    });

    it.each([
      [{ resource: 'something_else' }, 'other resource type'],
      [undefined, 'missing cost'],
      [{}],
    ])('routes to damageReduction when cost is %s', async (cost, _label) => {
      const action = makeAction({
        type: 'damage_reduction',
        cost,
      });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result.result).toBe('damage_reduction');
    });
  });

  describe('auto array handling', () => {
    it('selects passive_rule entry when it has a registered handler', async () => {
      const action = {
        name: 'Guarded Mind',
        automation: [
          { type: 'passive_rule', effect: 'abjuration_savant' },
          { type: 'auto_reroll' },
        ],
      };

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toEqual({ result: 'savant' });
    });

    it('selects first entry with a registered handler when no passive_rule present', async () => {
      const action = {
        name: 'Test',
        automation: [
          { type: 'auto_reroll', action: 'Bonus Action' },
          { type: 'auto_reroll' },
        ],
      };

      const { handle: autoRerollHandle } = await import('./handlers/combat/autoRerollHandler.js');
      autoRerollHandle.mockResolvedValue({ result: 'auto_reroll' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toEqual({ result: 'auto_reroll' });
    });

    it('returns null when auto array has no actionable entries', async () => {
      const action = {
        name: 'Test',
        automation: [
          { type: 'passive_rule', effect: 'unknown_savant' },
          { type: 'unknown_type' },
        ],
      };

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toBeNull();
    });

    it('returns null when auto array is empty or contains only null entries', async () => {
      const emptyAction = { name: 'Test', automation: [] };
      expect(await executeHandler(emptyAction, makePlayerStats(), campaignName, mapName)).toBeNull();

      const nullAction = { name: 'Test', automation: [null, null] };
      expect(await executeHandler(nullAction, makePlayerStats(), campaignName, mapName)).toBeNull();
    });

    // CLA-192 regression: Eldritch Knight lv18 Improved War Magic declares
    // automation [war_magic_cantrip, war_magic_spell(replacesWarMagic)].
    // The spell half must dispatch so the row offers level 1-2 spells;
    // previously automation[0] (the lv7 cantrip picker) always won.
    it('dispatches the replacesWarMagic spell half over the cantrip half (CLA-192)', async () => {
      const { handle: cantripHandle } = await import('./handlers/class-fighter-rogue/warMagicCantripHandler.js');
      const { handle: spellHandle } = await import('./handlers/class-fighter-rogue/warMagicSpellHandler.js');

      const action = {
        name: 'Improved War Magic',
        automation: [
          { type: 'war_magic_cantrip', spellList: 'wizard_cantrips', action: 'action', casting_time: '1 action' },
          { type: 'war_magic_spell', spellList: 'wizard_spells', maxSpellLevel: 2, action: 'action', casting_time: '1 action', replacesWarMagic: true },
        ],
      };

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toEqual({ result: 'war_magic_spell' });
      expect(spellHandle).toHaveBeenCalledTimes(1);
      expect(cantripHandle).not.toHaveBeenCalled();
    });

    it('still dispatches the cantrip half for base War Magic without replacesWarMagic', async () => {
      const { handle: cantripHandle } = await import('./handlers/class-fighter-rogue/warMagicCantripHandler.js');

      const action = {
        name: 'War Magic',
        automation: { type: 'war_magic_cantrip', spellList: 'wizard_cantrips', action: 'action', casting_time: '1 action' },
      };

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toEqual({ result: 'war_magic_cantrip' });
      expect(cantripHandle).toHaveBeenCalledTimes(1);
    });
  });

  describe('passive_rule handler', () => {
    it.each([
      'abjuration_savant',
      'divination_savant',
      'evocation_savant',
      'illusion_savant',
    ])('routes %s passive_rule to savant handler', async (effect) => {
      const action = makeAction({ type: 'passive_rule', effect });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toEqual({ result: 'savant' });
    });

    it.each([
      ['unknown_savant', 'unknown effect'],
      [undefined, 'no effect field'],
    ])('returns null for passive_rule with %s', async (effect, _label) => {
      const action = makeAction({ type: 'passive_rule', effect });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toBeNull();
    });
  });
});

// ── SP-042 Eyebite regression ─────────────────────────────────────
// Reported: casting Eyebite produced no effect (handler never invoked,
// an info popup shown instead of the effect modal). Separately, the spell
// data was missing saveDc, so the WIS save DC fell back to the default 10.

describe('SP-042 Eyebite regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes type:eyebite to the eyebite handler and returns the eyebiteEffect modal', async () => {
    const { handle: handleEyebite } = await import('./handlers/spells/eyebiteHandler.js');

    const action = makeAction({
      type: 'eyebite',
      saveType: 'WIS',
      saveDc: 'spell_save_dc',
      range: '60 ft',
      duration: '1_minute',
    });

    const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

    expect(handleEyebite).toHaveBeenCalledTimes(1);
    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('eyebiteEffect');
  });

  function readEyebiteAutomation(dataFile) {
    const spells = JSON.parse(readFileSync(resolve(process.cwd(), dataFile), 'utf8'));
    return spells.find((s) => s.index === 'eyebite')?.automation;
  }

  it.each([
    'public/data/spells.json',
    'public/data/2024/spells.json',
  ])('declares saveDc: spell_save_dc for Eyebite in %s', (dataFile) => {
    const automation = readEyebiteAutomation(dataFile);

    expect(automation).toBeDefined();
    expect(automation.saveType).toBe('WIS');
    expect(automation.saveDc).toBe('spell_save_dc');
  });
});

// ── SP-056 Grease regression ─────────────────────────────────────
// Bug: Grease could not be verified because no character had the spell
// in their spell list. The automation implementation was correct but
// the test campaign lacked a valid caster (Sorcerer/Wizard with Grease).
// Fix: Added Grease to DivinationWizard's spell list in test-campaign.
// Verified live via playwright-mcp: spell cast modal appeared with
// DEX save DC 17 and prone condition description, and the action was
// logged in the campaign log.

describe('SP-056 Grease regression', () => {
  function readGreaseAutomation(dataFile) {
    const spells = JSON.parse(readFileSync(resolve(process.cwd(), dataFile), 'utf8'));
    return spells.find((s) => s.index === 'grease');
  }

  it('has grease spell data in 2024 ruleset with save_only automation', () => {
    const spell = readGreaseAutomation('public/data/2024/spells.json');

    expect(spell).toBeDefined();
    expect(spell.name).toBe('Grease');
    expect(spell.level).toBe(1);
    expect(spell.automation).toBeDefined();
    expect(spell.automation.type).toBe('save_only');
    expect(spell.automation.saveType).toBe('DEX');
  });

  it('has grease spell data in 5e ruleset with save_attack automation array', () => {
    const spell = readGreaseAutomation('public/data/spells.json');

    expect(spell).toBeDefined();
    expect(spell.name).toBe('Grease');
    expect(spell.level).toBe(1);
    expect(Array.isArray(spell.automation)).toBe(true);
    expect(spell.automation.length).toBe(2);
    expect(spell.automation[0].type).toBe('save_attack');
    expect(spell.automation[1].type).toBe('grease_area_save');
  });

  it('has grease automation with prone fail effect in 2024 ruleset', () => {
    const spell = readGreaseAutomation('public/data/2024/spells.json');

    expect(spell.automation.effects).toBeDefined();
    expect(spell.automation.effects.fail).toBeDefined();
    expect(spell.automation.effects.fail[0].condition).toBe('prone');
  });

  it('has grease area_of_effect in 2024 ruleset', () => {
    const spell = readGreaseAutomation('public/data/2024/spells.json');

    expect(spell.area_of_effect).toBeDefined();
    expect(spell.area_of_effect.shape).toBe('square');
    expect(spell.area_of_effect.size).toBe('10-foot');
  });

  it('has grease area_of_effect in 5e ruleset (cube, numeric size)', () => {
    const spell = readGreaseAutomation('public/data/spells.json');

    expect(spell.area_of_effect).toBeDefined();
    expect(spell.area_of_effect.type).toBe('cube');
    expect(spell.area_of_effect.size).toBe(10);
  });

  it('grease is available to Wizard and Sorcerer classes in 2024 ruleset', () => {
    const spell = readGreaseAutomation('public/data/2024/spells.json');

    expect(spell.classes).toContain('Wizard');
    expect(spell.classes).toContain('Sorcerer');
  });

  it('grease is available to Wizard class in 5e ruleset', () => {
    const spell = readGreaseAutomation('public/data/spells.json');

    expect(spell.classes).toContain('Wizard');
  });

  it('grease has correct range and duration in 2024 ruleset', () => {
    const spell = readGreaseAutomation('public/data/2024/spells.json');

    expect(spell.range).toBe('60 feet');
    expect(spell.duration).toBe('1 minute');
  });

  it('grease has correct range and duration in 5e ruleset', () => {
    const spell = readGreaseAutomation('public/data/spells.json');

    expect(spell.range).toBe('60 feet');
    expect(spell.duration).toBe('1 minute');
  });
});
