// CLA-299 regression: Ritual Adept (2024 Wizard lv1) spellbook-ritual channel.
// isFreeCastAuthorized authorizes an UNPREPARED Ritual-tagged spellbook spell (RAW:
// ritual-only, unlimited, slotless) even with ZERO spell slots. prepareSpellCast must
// NOT consume a slot for it and must log the ritual resolution (ability_use
// 'Ritual Casting'). A PREPARED wizard ritual keeps its byte-identical slot payment;
// the popup's "Cast as Ritual" tick (spell.ritualCast, FT-068 popup-payment pattern)
// casts it slotless instead. 5e stays byte-identical (prepared-only RAW).
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Static mocks
// ---------------------------------------------------------------------------

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const setRuntimeValue = vi.fn();
  const getRuntimeValue = vi.fn(() => undefined);
  const clearRuntimeState = vi.fn();
  return { setRuntimeValue, getRuntimeValue, clearRuntimeState };
});

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
  breakConcentration: vi.fn(),
  addConcentration: vi.fn(),
  cleanupConcentrationEffects: vi.fn(),
}));

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { isFreeCastAuthorized, prepareSpellCast } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

// ---------------------------------------------------------------------------
// Fixtures — lv20 2024 Wizard Abjurer (subclass irrelevant; Ritual Adept is the base
// Wizard lv1 passive_rule/ritual_spells feature). Identify UNPREPARED ritual,
// Detect Magic PREPARED ritual, Sleep unprepared non-ritual control.
// ---------------------------------------------------------------------------

function makeWizardStats({ rules = '2024', className = 'Wizard', identifyPrepared = '', detectPrepared = 'Prepared' } = {}) {
  return {
    name: 'DivinationWizard',
    level: 20,
    rules,
    proficiency: 6,
    class: { name: className, spell_casting_ability: 'Intelligence' },
    abilities: [{ name: 'Intelligence', bonus: 7 }],
    spellAbilities: {
      spellCastingAbility: 'Intelligence',
      toHit: 13,
      saveDc: 21,
      modifier: 7,
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
      spells: [
        { name: 'Identify', level: 1, casting_time: '1 minute or Ritual', ritual: true, prepared: identifyPrepared },
        { name: 'Detect Magic', level: 1, casting_time: '1 minute or Ritual', ritual: true, prepared: detectPrepared },
        { name: 'Sleep', level: 1, casting_time: 'Action', ritual: false, prepared: '' },
      ],
    },
    automation: { actions: [], bonusActions: [], specialActions: [], passives: [] },
  };
}

const identifyUnprepared = { name: 'Identify', level: 1, casting_time: '1 minute or Ritual', ritual: true, prepared: '' };
const identifyPrepared = { name: 'Identify', level: 1, casting_time: '1 minute or Ritual', ritual: true, prepared: 'Prepared' };

describe('spellPreparationService — Ritual Adept wizard spellbook rituals (CLA-299)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  describe('isFreeCastAuthorized', () => {
    it('authorizes an UNPREPARED spellbook ritual with ZERO runtime slots', () => {
      getRuntimeValue.mockImplementation((_n, key) => (key === 'spell_slots_level_1' ? 0 : undefined));
      const stats = makeWizardStats();
      expect(isFreeCastAuthorized('DivinationWizard', 'Identify', 1, stats, 'test-campaign')).toBe(true);
    });

    it('authorizes unlimited ritual casts (no uses counter exists on the feature)', () => {
      const stats = makeWizardStats();
      expect(isFreeCastAuthorized('DivinationWizard', 'Identify', 1, stats, 'test-campaign')).toBe(true);
      expect(isFreeCastAuthorized('DivinationWizard', 'Identify', 1, stats, 'test-campaign')).toBe(true);
    });

    it('does NOT authorize a PREPARED spellbook ritual (slot payment lane unchanged)', () => {
      const stats = makeWizardStats();
      expect(isFreeCastAuthorized('DivinationWizard', 'Detect Magic', 1, stats, 'test-campaign')).toBe(false);
    });

    it('does NOT authorize an unprepared NON-ritual spell', () => {
      const stats = makeWizardStats();
      expect(isFreeCastAuthorized('DivinationWizard', 'Sleep', 1, stats, 'test-campaign')).toBe(false);
    });

    it('does NOT authorize a ritual cast UPCAST above its base level', () => {
      const stats = makeWizardStats();
      expect(isFreeCastAuthorized('DivinationWizard', 'Identify', 2, stats, 'test-campaign')).toBe(false);
    });

    it('does NOT authorize the channel for a 5e wizard (prepared-only RAW)', () => {
      const stats = makeWizardStats({ rules: '5e' });
      expect(isFreeCastAuthorized('DivinationWizard', 'Identify', 1, stats, 'test-campaign')).toBe(false);
    });

    it('does NOT authorize the channel for non-Wizard classes', () => {
      const stats = makeWizardStats({ className: 'Sorcerer' });
      expect(isFreeCastAuthorized('DivinationWizard', 'Identify', 1, stats, 'test-campaign')).toBe(false);
    });

    it('does NOT authorize a ritual spell that is NOT in the spellbook', () => {
      const stats = makeWizardStats();
      expect(isFreeCastAuthorized('DivinationWizard', 'Gentle Repose', 2, stats, 'test-campaign')).toBe(false);
    });

    it('does not throw when spellAbilities is missing', () => {
      const stats = { name: 'Someone', rules: '2024', class: { name: 'Wizard' }, automation: {} };
      expect(() => isFreeCastAuthorized('Someone', 'Identify', 1, stats, 'test-campaign')).not.toThrow();
      expect(isFreeCastAuthorized('Someone', 'Identify', 1, stats, 'test-campaign')).toBe(false);
    });
  });

  describe('prepareSpellCast — auto ritual face (unprepared)', () => {
    it('consumes NO spell slot even when slots ARE available, marks freeCastUsed', async () => {
      getRuntimeValue.mockImplementation((_n, key) => (key === 'spell_slots_level_1' ? 4 : undefined));
      const stats = makeWizardStats();

      const result = await prepareSpellCast(identifyUnprepared, {}, {
        playerName: 'DivinationWizard',
        playerStats: stats,
        campaignName: 'test-campaign',
        isUpcast: false,
        freeCastAuthorized: true,
      });

      expect(result.freeCastUsed).toBe(true);
      expect(result.slotConsumed).toBe(false);
      const slotWrites = setRuntimeValue.mock.calls.filter(c => String(c[1]).startsWith('spell_slots_level_'));
      expect(slotWrites).toHaveLength(0);
    });

    it('logs an ability_use Ritual Casting entry naming the spellbook and +10 minutes', async () => {
      const stats = makeWizardStats();

      await prepareSpellCast(identifyUnprepared, {}, {
        playerName: 'DivinationWizard',
        playerStats: stats,
        campaignName: 'test-campaign',
        isUpcast: false,
        freeCastAuthorized: true,
      });

      const ritualLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && e.abilityName === 'Ritual Casting');
      expect(ritualLog).toBeTruthy();
      expect(ritualLog.spellName).toBe('Identify');
      expect(ritualLog.note).toContain('as a Ritual');
      expect(ritualLog.note).toContain('read from your spellbook');
      expect(ritualLog.note).toContain('+10 minutes');
      expect(ritualLog.note).toContain('no spell slot consumed');
    });
  });

  describe('prepareSpellCast — ticked "Cast as Ritual" (prepared)', () => {
    it('pays NO spell slot and logs the ritual when the checkbox flag is carried', async () => {
      getRuntimeValue.mockImplementation((_n, key) => (key === 'spell_slots_level_1' ? 3 : undefined));
      const stats = makeWizardStats();

      const result = await prepareSpellCast({ ...identifyPrepared, ritualCast: true }, {}, {
        playerName: 'DivinationWizard',
        playerStats: stats,
        campaignName: 'test-campaign',
        isUpcast: false,
        freeCastAuthorized: false,
      });

      expect(result.freeCastUsed).toBe(true);
      expect(result.slotConsumed).toBe(false);
      expect(result.metaCtx.ritualCastUsed).toBe(true);
      const slotWrites = setRuntimeValue.mock.calls.filter(c => String(c[1]).startsWith('spell_slots_level_'));
      expect(slotWrites).toHaveLength(0);
      const ritualLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && e.abilityName === 'Ritual Casting');
      expect(ritualLog).toBeTruthy();
      expect(ritualLog.spellName).toBe('Identify');
    });

    it('UPCAST + ticked checkbox does NOT ride the ritual channel — the upcast slot is paid', async () => {
      getRuntimeValue.mockImplementation((_n, key) => (key === 'spell_slots_level_2' ? 1 : undefined));
      const stats = makeWizardStats();
      const spell = { ...identifyPrepared, damage: { damage_at_slot_level: { 1: '1d6', 2: '2d6' }, damage_type: 'Force' } };

      const result = await prepareSpellCast({ ...spell, ritualCast: true }, {}, {
        playerName: 'DivinationWizard',
        playerStats: stats,
        campaignName: 'test-campaign',
        isUpcast: true,
        upcastLevel: 2,
        freeCastAuthorized: false,
      });

      expect(result.freeCastUsed).toBe(false);
      expect(result.slotConsumed).toBe(true);
      expect(result.metaCtx.ritualCastUsed).toBeUndefined();
      const lv2Write = setRuntimeValue.mock.calls.find(c => c[1] === 'spell_slots_level_2');
      expect(lv2Write && lv2Write[2]).toBe(0);
      const ritualLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && e.abilityName === 'Ritual Casting');
      expect(ritualLog).toBeUndefined();
    });
  });

  describe('prepareSpellCast — prepared unticked cast pays its slot (byte-identical)', () => {
    it('consumes the base spell slot and logs NO ritual entry', async () => {
      getRuntimeValue.mockImplementation((_n, key) => (key === 'spell_slots_level_1' ? 3 : undefined));
      const stats = makeWizardStats();

      const result = await prepareSpellCast(identifyPrepared, {}, {
        playerName: 'DivinationWizard',
        playerStats: stats,
        campaignName: 'test-campaign',
        isUpcast: false,
        freeCastAuthorized: false,
      });

      expect(result.freeCastUsed).toBe(false);
      expect(result.slotConsumed).toBe(true);
      const lv1Write = setRuntimeValue.mock.calls.find(c => c[1] === 'spell_slots_level_1');
      expect(lv1Write && lv1Write[2]).toBe(2);
      const ritualLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && e.abilityName === 'Ritual Casting');
      expect(ritualLog).toBeUndefined();
    });
  });
});
