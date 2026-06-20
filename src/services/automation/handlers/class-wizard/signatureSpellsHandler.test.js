import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
  loadSpells: vi.fn(),
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

// ── Tests ──────────────────────────────────────────────────────

describe('signatureSpellsHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('no selection yet', () => {
    it('returns modal when no spells selected', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      dataLoader.loadSpells.mockResolvedValue([
        { name: 'Fireball', level: 3, casting_time: '1 action', range: '150 ft', description: 'A bright flare', damage: '8d6 fire' },
        { name: 'Counterspell', level: 3, casting_time: '1 reaction', range: '60 ft', description: 'Interupt a spell', damage: null },
        { name: 'Haste', level: 3, casting_time: '1 action', range: '30 ft', description: 'Increase speed', damage: null },
        { name: 'Levitate', level: 2, casting_time: '1 action', range: '60 ft', description: 'Rise into the air', damage: null },
      ]);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('signatureSpells');
      expect(result.payload.level3Options).toEqual(['Fireball', 'Counterspell', 'Haste']);
      expect(result.payload.selectedSpells).toEqual([]);
      expect(result.payload.optionDetails['Fireball'].damage).toBe('8d6 fire');
      expect(result.payload.optionDetails['Counterspell'].damage).toBe(null);
    });

    it('returns popup when no level 3 spells available', async () => {
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

    it('loads spells for the ruleset specified in playerStats', async () => {
      const action = makeAction();
      const ps = makePlayerStats({ rules: '5e' });

      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      dataLoader.loadSpells.mockResolvedValue([]);

      await handle(action, ps, campaignName, null);

      expect(dataLoader.loadSpells).toHaveBeenCalledWith('5e');
    });

    it('defaults to 2024 ruleset when not specified', async () => {
      const action = makeAction();
      const ps = makePlayerStats({ rules: undefined });

      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      dataLoader.loadSpells.mockResolvedValue([]);

      await handle(action, ps, campaignName, null);

      expect(dataLoader.loadSpells).toHaveBeenCalledWith('2024');
    });
  });

  describe('spells already selected', () => {
    it('returns modal with current selection', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(['Fireball', 'Counterspell']) // selection
        .mockReturnValueOnce(undefined) // Fireball not used
        .mockReturnValueOnce(undefined); // Counterspell not used;

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('signatureSpells');
      expect(result.payload.selectedSpells).toEqual(['Fireball', 'Counterspell']);
    });

    it('returns modal even when all spells used (with clear option)', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(['Fireball', 'Counterspell']) // selection
        .mockReturnValueOnce(true) // Fireball used
        .mockReturnValueOnce(true); // Counterspell used

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('All signature spells have been used');
    });

    it('returns info popup when all spells used', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(['Fireball', 'Counterspell']) // selection
        .mockReturnValueOnce(true) // Fireball used
        .mockReturnValueOnce(true); // Counterspell used

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('All signature spells have been used');
      expect(result.payload.description).toContain('Short or Long Rest');
      expect(result.payload.automation).toBe(action.automation);
    });

    it('uses action.name for the tracking key', async () => {
      const action = { name: 'My Signature Spells', automation: { type: 'signature_spells' } };
      const ps = makePlayerStats();

      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(['Fireball'])
        .mockReturnValueOnce(true);

      await handle(action, ps, campaignName, null);

      // The key should use SignatureSpells_ prefix with spell name
      const calls = useRuntimeState.getRuntimeValue.mock.calls;
      const usedKeyCall = calls.find(c => c[1].includes('SignatureSpells_'));
      expect(usedKeyCall).toBeDefined();
    });
  });
});

describe('signatureSpellsHandler.onSignatureSpellsSelected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success popup with two different spells', async () => {
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

  it('returns error when spell1 is missing', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    const result = await onSignatureSpellsSelected(action, ps, campaignName, null, 'Counterspell');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Two different level 3 spells must be selected.');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns error when spell2 is missing', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    const result = await onSignatureSpellsSelected(action, ps, campaignName, 'Fireball', null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Two different level 3 spells must be selected.');
  });

  it('returns error when both spells are the same', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    const result = await onSignatureSpellsSelected(action, ps, campaignName, 'Fireball', 'Fireball');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Two different level 3 spells must be selected.');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
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

  it('returns error when spell is not in selection', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue.mockReturnValueOnce(['Fireball', 'Counterspell']);

    const result = await onSignatureSpellsCast(action, ps, campaignName, 'Haste');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Haste is not a selected signature spell.');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns error when spell already used', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue
      .mockReturnValueOnce(['Fireball', 'Counterspell']) // selection
      .mockReturnValueOnce(true); // Fireball already used

    const result = await onSignatureSpellsCast(action, ps, campaignName, 'Fireball');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('already been cast');
    expect(result.payload.description).toContain('Short or Long Rest');
  });

  it('uses action.name for the tracking key', async () => {
    const action = { name: 'My Signature Spells', automation: { type: 'signature_spells' } };
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue
      .mockReturnValueOnce(['Fireball'])
      .mockReturnValueOnce(undefined);

    await onSignatureSpellsCast(action, ps, campaignName, 'Fireball');

    const calls = useRuntimeState.setRuntimeValue.mock.calls;
    const usedKeyCall = calls.find(c => c[1].includes('SignatureSpells_'));
    expect(usedKeyCall).toBeDefined();
  });
});
