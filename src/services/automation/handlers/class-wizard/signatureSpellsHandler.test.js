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

import { handle, onSignatureSpellsSelected, onSignatureSpellsCast } from './signatureSpellsHandler.js';
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
    ...overrides,
  };
}

const level3SpellData = [
  { name: 'Fireball', level: 3, casting_time: '1 action', range: '150 ft', description: 'A bright flare', damage: '8d6 fire' },
  { name: 'Counterspell', level: 3, casting_time: '1 reaction', range: '60 ft', description: 'Interrupt a spell', damage: null },
  { name: 'Haste', level: 3, casting_time: '1 action', range: '30 ft', description: 'Increase speed', damage: null },
];

// ── Tests ──────────────────────────────────────────────────────

describe('signatureSpellsHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('no selection yet', () => {
    it('returns modal with level 3 spell options', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      dataLoader.loadSpells.mockResolvedValue(level3SpellData);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('signatureSpells');
      expect(result.payload.level3Options).toEqual(['Fireball', 'Counterspell', 'Haste']);
      expect(result.payload.selectedSpells).toEqual([]);
      expect(result.payload.optionDetails['Fireball'].damage).toBe('8d6 fire');
      expect(result.payload.optionDetails['Counterspell'].damage).toBe(null);
      expect(result.payload.optionDetails['Fireball'].casting_time).toBe('1 action');
      expect(result.payload.optionDetails['Haste'].range).toBe('30 ft');
      expect(result.payload.action).toBe(action);
      expect(result.payload.playerStats).toBe(ps);
      expect(result.payload.campaignName).toBe(campaignName);
    });

    it('returns info popup when no level 3 spells available', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      dataLoader.loadSpells.mockResolvedValue([
        { name: 'Magic Missile', level: 1 },
        { name: 'Levitate', level: 2 },
      ]);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No level 3 spells available.');
    });

    it.each([
      ['5e', '5e'],
      [undefined, '2024'],
      [null, '2024'],
    ])('loads spells for ruleset "%s" → expects "%s"', async (rules, expectedRuleset) => {
      const action = makeAction();
      const ps = makePlayerStats({ rules });

      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      dataLoader.loadSpells.mockResolvedValue([]);

      await handle(action, ps, campaignName, null);

      expect(dataLoader.loadSpells).toHaveBeenCalledWith(expectedRuleset);
    });

    it('rejects with popup when loadSpells throws', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      dataLoader.loadSpells.mockRejectedValue(new Error('Network error'));

      await expect(handle(action, ps, campaignName, null)).rejects.toThrow('Network error');
    });
  });

  describe('spells already selected', () => {
    it('returns info popup when all spells have been used', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(['Fireball', 'Counterspell']) // selection
        .mockReturnValueOnce(true) // Fireball used
        .mockReturnValueOnce(true); // Counterspell used

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('All signature spells have been used. Finish a Short or Long Rest to regain them.');
      expect(result.payload.automation).toBe(action.automation);
    });

    it('returns modal with full payload when at least one spell is still available', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(['Fireball', 'Counterspell']) // selection
        .mockReturnValueOnce(true) // Fireball used
        .mockReturnValueOnce(undefined); // Counterspell still available
      dataLoader.loadSpells.mockResolvedValue(level3SpellData);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('signatureSpells');
      expect(result.payload.selectedSpells).toEqual(['Fireball', 'Counterspell']);
      expect(result.payload.level3Options).toEqual(['Fireball', 'Counterspell', 'Haste']);
      expect(result.payload.action).toBe(action);
      expect(result.payload.playerStats).toBe(ps);
      expect(result.payload.campaignName).toBe(campaignName);
    });

    it.each([
      [],
      null,
    ])('treats %j selection the same as no selection', async (selectionValue) => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue.mockReturnValue(selectionValue);
      dataLoader.loadSpells.mockResolvedValue(level3SpellData);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('signatureSpells');
      expect(result.payload.selectedSpells).toEqual([]);
    });

    it('marks spells with spaces in names correctly as used', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(['Vicious Mockery', 'Shield']) // selection with spaces
        .mockReturnValueOnce(true) // Vicious Mockery used (key: SignatureSpells_Vicious_Mockery_used)
        .mockReturnValueOnce(undefined); // Shield still available

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.selectedSpells).toEqual(['Vicious Mockery', 'Shield']);
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
    expect(result.payload.description).toContain('Fireball');
    expect(result.payload.description).toContain('Counterspell');
    expect(result.payload.description).toContain('without expending a spell slot');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', 'SignatureSpells_selection', ['Fireball', 'Counterspell'], campaignName, true,
    );
    expect(result.payload.automation).toBe(action.automation);
  });

  it('clears selection when both spells are falsy', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    const result = await onSignatureSpellsSelected(action, ps, campaignName, null, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe('Signature Spells selection cleared.');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', 'SignatureSpells_selection', null, campaignName, true,
    );
  });

  it.each([
    [null, 'Counterspell'],
    ['Fireball', null],
    ['Fireball', ''],
    ['', 'Counterspell'],
    ['Fireball', 'Fireball'],
  ])('rejects when spell1="%s" and spell2="%s"', async (spell1, spell2) => {
    const action = makeAction();
    const ps = makePlayerStats();

    const result = await onSignatureSpellsSelected(action, ps, campaignName, spell1, spell2);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Two different level 3 spells must be selected.');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('clears selection when both spells are empty strings', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    const result = await onSignatureSpellsSelected(action, ps, campaignName, '', '');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Signature Spells selection cleared.');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', 'SignatureSpells_selection', null, campaignName, true,
    );
  });
});

describe('signatureSpellsHandler.onSignatureSpellsCast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks spell as used when valid', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue
      .mockReturnValueOnce(['Fireball', 'Counterspell']) // selection
      .mockReturnValueOnce(undefined); // Fireball not yet used

    const result = await onSignatureSpellsCast(action, ps, campaignName, 'Fireball');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('cast as a signature spell');
    expect(result.payload.description).toContain('no spell slot expended');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', expect.stringContaining('Fireball'), true, campaignName,
    );
    expect(result.payload.automation).toBe(action.automation);
  });

  it('rejects when spell is not in selection', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue.mockReturnValueOnce(['Fireball', 'Counterspell']);

    const result = await onSignatureSpellsCast(action, ps, campaignName, 'Haste');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Haste is not a selected signature spell.');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('rejects when spell already used', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue
      .mockReturnValueOnce(['Fireball', 'Counterspell']) // selection
      .mockReturnValueOnce(true); // Fireball already used

    const result = await onSignatureSpellsCast(action, ps, campaignName, 'Fireball');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('already been cast');
    expect(result.payload.description).toContain('Short or Long Rest');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it.each([
    ['Fireball'],
    [null],
    [[]],
  ])('rejects when selection is non-array "%s" (normalized to [])', async (selectionValue) => {
    const action = makeAction();
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue.mockReturnValueOnce(selectionValue);

    const result = await onSignatureSpellsCast(action, ps, campaignName, 'Fireball');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Fireball is not a selected signature spell.');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });
});
