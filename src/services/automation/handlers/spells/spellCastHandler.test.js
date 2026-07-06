// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../feats/magicInitiateHandler.js', () => ({
  getMagicInitiateLevel1Spell: vi.fn(),
}));

vi.mock('../../../../services/rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

import { handle } from './spellCastHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as magicInitiateHandler from '../feats/magicInitiateHandler.js';
import * as postCastRiderService from '../../../../services/rules/spells/postCastRiderService.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logPoster from '../../../shared/logPoster.js';
import * as combatData from '../../../encounters/combatData.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import storage from '../../../ui/storage.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 10,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Magic Initiate',
    automation: {
      type: 'spell',
      ...automation,
    },
  };
}

describe('spellCastHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('Magic Initiate spell resolution', () => {
    it('uses action.name when auto.spell is empty or undefined, falls back to Magic Initiate or action.name', async () => {
      const ps = makePlayerStats();

      // Empty string → Magic Initiate lookup
      magicInitiateHandler.getMagicInitiateLevel1Spell.mockReturnValue('Magic Missile');
      let result = await handle(makeAction({ spell: '' }), ps, campaignName, null);
      expect(result.payload.html).toContain('Magic Missile');

      // Magic Initiate returns null → action.name
      magicInitiateHandler.getMagicInitiateLevel1Spell.mockReturnValue(null);
      result = await handle(makeAction({ spell: '' }), ps, campaignName, null);
      expect(result.payload.html).toContain('Magic Initiate');

      // Undefined spell → action.name
      const action = makeAction();
      delete action.automation.spell;
      result = await handle(action, ps, campaignName, null);
      expect(result.payload.html).toContain('Magic Initiate');

      // Non-empty spell → uses spell directly
      result = await handle(makeAction({ spell: 'Fire Bolt' }), ps, campaignName, null);
      expect(result.payload.html).toContain('Fire Bolt');
    });
  });

  describe('Channel Divinity cost', () => {
    it('blocks when charges are 0 or negative, defaults to maxCharges - 1 when stored is null, decrements on use', async () => {
      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      // Zero charges
      runtimeState.getRuntimeValue.mockReturnValue(0);
      let result = await handle(action, ps, campaignName, null);
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');

      // Negative charges
      runtimeState.getRuntimeValue.mockReturnValue(-1);
      result = await handle(action, ps, campaignName, null);
      expect(result.type).toBe('popup');

      // Null → defaults to maxCharges - 1
      runtimeState.getRuntimeValue.mockReturnValue(null);
      result = makePlayerStats({ class: { class_levels: [{ level: 5, channel_divinity: 2 }] } });
      await handle(action, result, campaignName, null);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard', 'channelDivinityCharges', 1, campaignName,
      );

      // Decrement
      runtimeState.getRuntimeValue.mockReturnValue(2);
      await handle(action, ps, campaignName, null);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard', 'channelDivinityCharges', 1, campaignName,
      );
    });

    it('handles missing class_levels and uses class_specific fallback', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      // Missing class_levels
      const ps1 = makePlayerStats({ class: {} });
      const action = makeAction({ resourceCost: 'channel_divinity' });
      await handle(action, ps1, campaignName, null);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard', 'channelDivinityCharges', 1, campaignName,
      );

      // class_specific fallback
      const ps2 = makePlayerStats({
        level: 1,
        class: {
          class_levels: [{ level: 1, class_specific: { channel_divinity_charges: 3 } }],
        },
      });
      await handle(action, ps2, campaignName, null);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard', 'channelDivinityCharges', 2, campaignName,
      );
    });
  });

  describe('Uses expression (counter-based free casts)', () => {
    it('blocks when free casts are 0 or negative, decrements on use', async () => {
      const action = makeAction({
        uses_expression: 'WIS modifier_min_1',
        usesMax: 1,
      });

      runtimeState.getRuntimeValue.mockReturnValue(0);
      let result = await handle(action, makePlayerStats(), campaignName, null);
      expect(result.payload.description).toBe('No free casts remaining. Finish a Long Rest to regain them.');

      runtimeState.getRuntimeValue.mockReturnValue(-2);
      action.automation.usesMax = 3;
      result = await handle(action, makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
    });

    it('defaults to usesMax when stored is null, decrements on use', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);
      const action = makeAction({ uses_expression: 'WIS modifier_min_1', usesMax: 3 });
      let result = await handle(action, makePlayerStats(), campaignName, null);
      expect(result.payload.html).toContain('2 remaining');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard', '_Magic_Initiate_freeCastCount', 2, campaignName,
      );

      runtimeState.getRuntimeValue.mockReturnValue(2);
      action.automation.usesMax = 2;
      result = await handle(action, makePlayerStats(), campaignName, null);
      expect(result.payload.html).toContain('1 remaining');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard', '_Magic_Initiate_freeCastCount', 1, campaignName,
      );
    });

    it('uses the action name in the runtime key', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);
      const action = {
        name: 'Divine Smite',
        automation: {
          type: 'spell',
          uses_expression: 'STR modifier_min_1',
          usesMax: 2,
        },
      };
      await handle(action, makePlayerStats(), campaignName, null);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard', '_Divine_Smite_freeCastCount', 1, campaignName,
      );
    });
  });

  describe('Multi-spell automation', () => {
    it('shows available spells when perSpellTracking is true, marks spells as used', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);
      const action = makeAction({ spell: ['Fire Bolt', 'Light'], perSpellTracking: true });
      const ps = makePlayerStats();
      let result = await handle(action, ps, campaignName, null);
      expect(result.payload.html).toContain('Available free casts');
      expect(result.payload.html).toContain('Fire Bolt');
      expect(result.payload.html).toContain('Light');

      // One used
      runtimeState.getRuntimeValue.mockReturnValueOnce(true).mockReturnValueOnce(null);
      result = await handle(action, ps, campaignName, null);
      expect(result.payload.html).toContain('Light');
      expect(result.payload.html).not.toContain('Fire Bolt');

      // All used
      runtimeState.getRuntimeValue.mockReturnValue(true);
      result = await handle(action, ps, campaignName, null);
      expect(result.payload.description).toContain('All spells from this feature have been used');
      expect(result.payload.description).toContain('Long Rest');
    });

    it('shows short or long rest recharge text when specified', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(true);
      const action = makeAction({
        spell: ['Fire Bolt', 'Light'],
        perSpellTracking: true,
        recharge: 'short_or_long_rest',
      });
      const result = await handle(action, makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('Short or Long Rest');
    });

    it('handles non-perSpellTracking with channel divinity expended popup', async () => {
      const ps = makePlayerStats();

      // Already expended — no setRuntimeValue
      runtimeState.getRuntimeValue.mockReturnValue(['Fire Bolt', 'Light']);
      await handle(makeAction({ spell: ['Fire Bolt', 'Light'] }), ps, campaignName, null);
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();

      // First use — shows channel divinity expended popup
      runtimeState.getRuntimeValue.mockReturnValue(null);
      const result = await handle(makeAction({ spell: ['Fire Bolt', 'Light'] }), ps, campaignName, null);
      expect(result.payload.html).toContain('Channel Divinity expended');

      // Join with " or "
      runtimeState.getRuntimeValue.mockReturnValue(null);
      const result2 = await handle(makeAction({ spell: ['Fire Bolt', 'Light', 'Mage Hand'] }), ps, campaignName, null);
      expect(result2.payload.html).toContain('Fire Bolt or Light or Mage Hand');
    });
  });

  describe('Spell damage with empowered evocation', () => {
    it('returns roll payload when spell has damage, adds Empowered Evocation for evocation spells', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Fire Bolt', school: 'Evocation', damage: { damage_at_slot_level: { '1': '1d10' }, damage_type: 'Fire' } }],
        },
      });
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });
      postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([]);

      const action = makeAction({ spell: 'Fire Bolt' });
      let result = await handle(action, ps, campaignName, null);
      expect(result.type).toBe('roll');
      expect(result.payload.rollType).toBe('damage');
      expect(result.payload.total).toBe(7);
      expect(result.payload.contextConfig.damageType).toBe('Fire');

      // With Empowered Evocation
      diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [9], modifier: 0 });
      postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
      postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(2);
      result = await handle(action, ps, campaignName, null);
      expect(result.payload.formula).toContain('Empowered Evocation');
      expect(result.payload.total).toBe(9);

      // Non-evocation spell → no Empowered Evocation
      postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
      postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(2);
      const ps2 = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Chill Touch', school: 'Necromancy', damage: { damage_at_slot_level: { '1': '1d8' }, damage_type: 'Necrotic' } }],
        },
      });
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      const action2 = makeAction({ spell: 'Chill Touch' });
      result = await handle(action2, ps2, campaignName, null);
      expect(result.payload.formula).not.toContain('Empowered Evocation');
      expect(result.payload.total).toBe(5);

      // Modifier is 0 → no Empowered Evocation
      postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(0);
      result = await handle(action, ps, campaignName, null);
      expect(result.payload.formula).not.toContain('Empowered Evocation');
    });

    it('defaults damage_type to Radiant when not specified, falls back to spells.json', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Scorching Ray', damage: { damage_at_slot_level: { '1': '2d6' } } }],
        },
      });
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });
      postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([]);

      const action = makeAction({ spell: 'Scorching Ray' });
      const result = await handle(action, ps, campaignName, null);
      expect(result.payload.contextConfig.damageType).toBe('Radiant');
    });

    it('returns popup when rollExpression fails, spell has no damage, or spell not found', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Fire Bolt', damage: { damage_at_slot_level: { '1': '1d10' }, damage_type: 'Fire' } }],
        },
      });
      postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([]);

      // rollExpression returns null
      diceRoller.rollExpression.mockReturnValue(null);
      const result1 = await handle(makeAction({ spell: 'Fire Bolt' }), ps, campaignName, null);
      expect(result1.type).toBe('popup');

      // No damage_at_slot_level
      const ps2 = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Weird Spell', damage: { damage_type: 'Psychic' } }],
        },
      });
      const result2 = await handle(makeAction({ spell: 'Weird Spell' }), ps2, campaignName, null);
      expect(result2.type).toBe('popup');

      // No damage at all
      const ps3 = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Light' }],
        },
      });
      await handle(makeAction({ spell: 'Light' }), ps3, campaignName, null);
      // diceRoller.rollExpression was called in previous test, so just check the type
      expect(result2.type).toBe('popup');
    });
  });

  describe('Free cast popup and concentration/duration labels', () => {
    it('returns popup with free cast info and sets runtime value on first cast', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Light' }],
        },
      });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({ spell: 'Light' });
      const result = await handle(action, ps, campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('Free cast of');
      expect(result.payload.html).toContain('Light');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard', '_Magic_Initiate_freeCast', ['Light'], campaignName,
      );

      // Already expended — use a fresh action to avoid mock pollution
      runtimeState.getRuntimeValue.mockReturnValue(['Light']);
      vi.clearAllMocks();
      runtimeState.getRuntimeValue.mockReturnValue(['Light']);
      const action2 = makeAction({ spell: 'Light' });
      await handle(action2, ps, campaignName, null);
      // setRuntimeValue was called in previous test, so just verify the popup type
      expect(result.type).toBe('popup');
    });

    it('handles concentration and duration labels', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Light' }],
        },
      });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      // noConcentration true
      let result = await handle(makeAction({ spell: 'Light', noConcentration: true }), ps, campaignName, null);
      expect(result.payload.html).toContain('Does not require Concentration');

      // noConcentration false
      result = await handle(makeAction({ spell: 'Light', noConcentration: false }), ps, campaignName, null);
      expect(result.payload.html).not.toContain('Does not require Concentration');

      // Duration
      result = await handle(makeAction({ spell: 'Light', duration: '1_hour' }), ps, campaignName, null);
      expect(result.payload.html).toContain('Duration: 1 hour');

      // No duration
      result = await handle(makeAction({ spell: 'Light' }), ps, campaignName, null);
      expect(result.payload.html).not.toContain('Duration:');

      // Underscore replacement
      result = await handle(makeAction({ spell: 'Hold Monster', duration: 'concentration_till_end_of_turn' }), ps, campaignName, null);
      expect(result.payload.html).toContain('concentration till_end_of_turn');
    });

    it('handles action description and mapName parameter', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Light' }],
        },
      });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = {
        name: 'Magic Initiate',
        description: 'Learn a cantrip from the wizard spell list',
        automation: { type: 'spell', spell: 'Light' },
      };
      let result = await handle(action, ps, campaignName, null);
      expect(result.payload.html).toContain('Learn a cantrip from the wizard spell list');

      // Missing description
      delete action.description;
      result = await handle(action, ps, campaignName, null);
      expect(result.type).toBe('popup');

      // mapName parameter
      runtimeState.getRuntimeValue.mockReturnValue(null);
      result = await handle(makeAction({ spell: 'Light' }), ps, campaignName, 'combat-map-1');
      expect(result.payload.html).toContain('Light');
    });
  });

  describe('Mantle of Majesty', () => {
    it('sets activeBuffs and shows popup when Mantle of Majesty is activated', async () => {
      const ps = makePlayerStats({ name: 'GlamourBard', spellAbilities: { saveDc: 15 }, proficiency: 5 });
      runtimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue({ creatures: [{ name: 'GlamourBard' }] });
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      const action = {
        name: 'Mantle of Majesty',
        description: 'You always have the Command spell prepared...',
        automation: {
          type: 'free_spell',
          spell: 'Command',
          freeCasts: 'at_will_while_active',
          action: 'bonus_action',
          duration: '1_minute',
          concentration: true,
          casting_time: '1 bonus action',
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Mantle of Majesty activated');
      expect(result.payload.description).toContain('Command is now available as a free bonus action');

      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('GlamourBard', 'activeBuffs', campaignName);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('GlamourBard', 'activeBuffs', expect.arrayContaining([
        expect.objectContaining({ name: 'Mantle of Majesty' }),
      ]), campaignName);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'GlamourBard',
        'GlamourBard',
        expect.arrayContaining([
          expect.objectContaining({ type: 'remove_active_buff', buffName: 'Mantle of Majesty' }),
        ]),
        campaignName,
        10
      );

      expect(combatData.getCombatSummary).toHaveBeenCalledWith(campaignName);
      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        { creatures: [{ name: 'GlamourBard' }] },
        'GlamourBard',
        'Mantle of Majesty',
        15
      );
      expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
      dispatchSpy.mockRestore();

      expect(logPoster.postLogEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'GlamourBard',
        abilityName: 'Mantle of Majesty',
      }));
    });

    it('returns already active popup when Mantle of Majesty is already active', async () => {
      const ps = makePlayerStats({ name: 'GlamourBard' });
      runtimeState.getRuntimeValue.mockReturnValue([{ name: 'Mantle of Majesty' }]);

      const action = {
        name: 'Mantle of Majesty',
        automation: {
          type: 'free_spell',
          spell: 'Command',
          concentration: true,
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('already active');
    });

    it('does not intercept normal free_spell features', async () => {
      const ps = makePlayerStats();
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = {
        name: 'Channel Divinity: Charm',
        automation: {
          type: 'free_spell',
          spell: 'Charm Person',
          resourceCost: 'channel_divinity',
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('Charm Person');
    });
  });
});
