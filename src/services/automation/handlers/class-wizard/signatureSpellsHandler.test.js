// @maintained-by-ai
// signatureSpellsHandler unit tests — class-wizard lane.
// Deterministic contract tests over handle/onSignatureSpellsSelected (both live: automation/index.js
// dispatch + CharSpecialActions.jsx confirm handler). Runtime access is routed by exact key (never
// positional chains). DEAD-LANE advisory (2026-10-15): `onSignatureSpellsCast` export has zero
// production callers — the real cast flow stamps SignatureSpells_<spell>_used via
// spellPreparationService.js (covered by its own suites). Export flagged for source deletion;
// its test block was removed here.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
  loadSpells: vi.fn(),
  loadWildMagicSurgeTable: vi.fn(async () => []),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, onSignatureSpellsSelected } from './signatureSpellsHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as dataLoader from '../../../ui/dataLoader.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 10,
    rules: '2024',
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Signature Spells',
    description: 'Cast two level 3 spells for free.',
    automation: { type: 'signature_spells' },
    ...overrides,
  };
}

const level3SpellData = [
  { name: 'Fireball', level: 3, casting_time: '1 action', range: '150 ft', description: 'A bright flare', damage: '8d6 fire' },
  { name: 'Counterspell', level: 3, casting_time: '1 reaction', range: '60 ft', description: 'Interrupt a spell', damage: null },
  { name: 'Haste', level: 3, casting_time: '1 action', range: '30 ft', description: 'Increase speed', damage: null },
];

// Route getRuntimeValue by exact key so call order can never mask key-format regressions.
function routeRuntime(map) {
  useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => map[key]);
}

// ── Tests ──────────────────────────────────────────────────────

describe('signatureSpellsHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('no selection yet', () => {
    it('returns modal with level 3 spell options', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      routeRuntime({ SignatureSpells_selection: undefined });
      dataLoader.loadSpells.mockResolvedValue(level3SpellData);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('signatureSpells');
      expect(result.payload.level3Options).toEqual(['Fireball', 'Counterspell', 'Haste']);
      expect(result.payload.selectedSpells).toEqual([]);
      expect(result.payload.optionDetails).toEqual({
        Fireball: { name: 'Fireball', level: 3, casting_time: '1 action', range: '150 ft', description: 'A bright flare', damage: '8d6 fire' },
        Counterspell: { name: 'Counterspell', level: 3, casting_time: '1 reaction', range: '60 ft', description: 'Interrupt a spell', damage: null },
        Haste: { name: 'Haste', level: 3, casting_time: '1 action', range: '30 ft', description: 'Increase speed', damage: null },
      });
      expect(result.payload.action).toBe(action);
      expect(result.payload.playerStats).toBe(ps);
      expect(result.payload.campaignName).toBe(campaignName);
    });

    it('returns info popup when no level 3 spells available', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      routeRuntime({ SignatureSpells_selection: undefined });
      dataLoader.loadSpells.mockResolvedValue([
        { name: 'Magic Missile', level: 1 },
        { name: 'Levitate', level: 2 },
      ]);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Signature Spells');
      expect(result.payload.description).toBe('No level 3 spells available.');
    });

    it.each([
      ['5e', '5e'],
      [undefined, '2024'],
      [null, '2024'],
    ])('loads spells for ruleset "%s" → expects "%s"', async (rules, expectedRuleset) => {
      const action = makeAction();
      const ps = makePlayerStats({ rules });

      routeRuntime({ SignatureSpells_selection: undefined });
      dataLoader.loadSpells.mockResolvedValue([]);

      await handle(action, ps, campaignName, null);

      expect(dataLoader.loadSpells).toHaveBeenCalledWith(expectedRuleset);
    });

    it('rejects when loadSpells rejects', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      routeRuntime({ SignatureSpells_selection: undefined });
      dataLoader.loadSpells.mockRejectedValueOnce(new Error('Network error'));

      await expect(handle(action, ps, campaignName, null)).rejects.toThrow('Network error');
    });

    it.each([
      [],
      null,
    ])('treats %j selection the same as no selection', async (selectionValue) => {
      const action = makeAction();
      const ps = makePlayerStats();

      routeRuntime({ SignatureSpells_selection: selectionValue });
      dataLoader.loadSpells.mockResolvedValue(level3SpellData);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('signatureSpells');
      expect(result.payload.selectedSpells).toEqual([]);
    });
  });

  describe('spells already selected', () => {
    it('returns info popup when all spells have been used', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      routeRuntime({
        'SignatureSpells_selection': ['Fireball', 'Counterspell'],
        'SignatureSpells_Fireball_used': true,
        'SignatureSpells_Counterspell_used': true,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('All signature spells have been used. Finish a Short or Long Rest to regain them.');
      expect(result.payload.automation).toBe(action.automation);
      expect(dataLoader.loadSpells).not.toHaveBeenCalled();
    });

    it('returns modal with full payload when at least one spell is still available', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      routeRuntime({
        'SignatureSpells_selection': ['Fireball', 'Counterspell'],
        'SignatureSpells_Fireball_used': true,
        'SignatureSpells_Counterspell_used': undefined,
      });
      dataLoader.loadSpells.mockResolvedValue(level3SpellData);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('signatureSpells');
      expect(result.payload.selectedSpells).toEqual(['Fireball', 'Counterspell']);
      expect(result.payload.level3Options).toEqual(['Fireball', 'Counterspell', 'Haste']);
      expect(result.payload.optionDetails).toEqual({});
      expect(result.payload.action).toBe(action);
      expect(result.payload.playerStats).toBe(ps);
      expect(result.payload.campaignName).toBe(campaignName);
    });

    it('queries used-key with spaces normalized to underscores', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      routeRuntime({
        'SignatureSpells_selection': ['Vicious Mockery', 'Shield'],
        'SignatureSpells_Vicious_Mockery_used': true,
        'SignatureSpells_Shield_used': undefined,
      });
      dataLoader.loadSpells.mockResolvedValue(level3SpellData);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.selectedSpells).toEqual(['Vicious Mockery', 'Shield']);
      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('TestWizard', 'SignatureSpells_Vicious_Mockery_used', campaignName);
      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('TestWizard', 'SignatureSpells_Shield_used', campaignName);
    });
  });
});

describe('signatureSpellsHandler.onSignatureSpellsSelected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves two different spells and returns confirmation', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    const result = await onSignatureSpellsSelected(action, ps, campaignName, 'Fireball', 'Counterspell');

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe(
      'Signature Spells: You can now cast <b>Fireball</b> and <b>Counterspell</b> once at level 3 without expending a spell slot. Recharges on a Short or Long Rest.'
    );
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', 'SignatureSpells_selection', ['Fireball', 'Counterspell'], campaignName, true,
    );
    expect(result.payload.automation).toBe(action.automation);
  });

  it.each([
    [null, null],
    ['', ''],
  ])('clears selection when both spells are %j', async (spell1, spell2) => {
    const action = makeAction();
    const ps = makePlayerStats();

    const result = await onSignatureSpellsSelected(action, ps, campaignName, spell1, spell2);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe('Signature Spells selection cleared.');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', 'SignatureSpells_selection', null, campaignName, true,
    );
  });

  it.each([
    [null, 'Counterspell'],
    ['', 'Counterspell'],
    ['Fireball', null],
    ['Fireball', ''],
    ['Fireball', 'Fireball'],
  ])('rejects when spell1="%s" and spell2="%s"', async (spell1, spell2) => {
    const action = makeAction();
    const ps = makePlayerStats();

    const result = await onSignatureSpellsSelected(action, ps, campaignName, spell1, spell2);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Two different level 3 spells must be selected.');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });
});
