import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
}));

import { handle } from './freezingSphereHandler.js';
import * as savePrompt from '../../common/savePrompt.js';

// ── Constants & Helpers ────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'test-map';
const casterName = 'TestWizard';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    spellAbilities: { saveDc: 16 },
    ...overrides,
  };
}

// Merges overrides: automation is spread over the defaults; spell replaces wholesale
// (null/undefined spell are meaningful inputs for the slot-level fallback ladder).
function makeAction({ automation, spell, name, ...rest } = {}) {
  const action = {
    name: name ?? 'Freezing Sphere',
    automation: { type: 'freezing_sphere', ...(automation || {}) },
    ...rest,
  };
  if (spell !== undefined) action.spell = spell;
  else action.spell = {};
  return action;
}

async function run(action = makeAction(), stats = makePlayerStats()) {
  return handle(action, stats, campaignName, mapName);
}

// ── Tests ──────────────────────────────────────────────────────

describe('freezingSphereHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(16);
  });

  it('returns the full saveAttackAoe modal payload with exact spec literals', async () => {
    const result = await run();

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('saveAttackAoe');
    expect(result.payload).toEqual({
      action: {
        name: 'Freezing Sphere',
        automation: { type: 'freezing_sphere' },
        spell: {},
      },
      playerStats: expect.any(Object),
      campaignName,
      shape: 'sphere',
      range: 300,
      damage: '10d6',
      damageType: 'Cold',
      saveType: 'CON',
      saveDc: 16,
      dcSuccess: 'half',
      activeOverlay: null,
    });
  });

  it('passes action, playerStats and campaignName through by reference', async () => {
    const customAutomation = { type: 'freezing_sphere', customField: 'value' };
    const customSpell = { level: 8, school: 'Evocation' };
    const stats = makePlayerStats({ name: 'OtherCaster' });
    const action = makeAction({
      name: 'Custom Name',
      automation: customAutomation,
      spell: customSpell,
    });

    const result = await run(action, stats);

    expect(result.payload.action.name).toBe('Custom Name');
    // Automation identity preserved — no clone/mutate on the way through.
    expect(result.payload.action.automation).toBe(action.automation);
    expect(result.payload.action.automation.customField).toBe('value');
    expect(result.payload.action.spell).toBe(customSpell);
    expect(result.payload.playerStats).toBe(stats);
    expect(result.payload.campaignName).toBe(campaignName);
    // spell.level flows into the damage table too.
    expect(result.payload.damage).toBe('12d6');
  });

  describe('damage from slot level', () => {
    const slotCases = [
      { spell: {}, damage: '10d6' },
      { spell: { level: 6 }, damage: '10d6' },
      { spell: { level: 7 }, damage: '11d6' },
      { spell: { level: 8 }, damage: '12d6' },
      { spell: { level: 9 }, damage: '13d6' },
      { spell: { level: 10 }, damage: '13d6' }, // clamps to highest defined
      { spell: { level: 5 }, damage: '10d6' }, // below minimum → base
      { spell: { level: 1 }, damage: '10d6' },
      { spell: { level: 9, baseLevel: 6 }, damage: '13d6' }, // level wins over baseLevel
      { spell: null, damage: '10d6' },
    ];

    for (const { spell, damage } of slotCases) {
      it(`spell ${JSON.stringify(spell)} → ${damage}`, async () => {
        const result = await run(makeAction({ spell }));
        expect(result.payload.damage).toBe(damage);
      });
    }

    it('falls back to baseLevel when level is absent', async () => {
      const result = await run(makeAction({ spell: { baseLevel: 7 } }));
      expect(result.payload.damage).toBe('11d6');
    });

    it('defaults to base 10d6 when spell key is missing entirely', async () => {
      const result = await run(makeAction({ spell: undefined }));
      expect(result.payload.damage).toBe('10d6');
    });
  });

  describe('range (real unmocked rangeToFeet)', () => {
    const rangeCases = [
      { range: undefined, feet: 300 }, // default when automation omits range
      { range: '300 feet', feet: 300 }, // production 2024 spells.json string form
      { range: 600, feet: 600 }, // numeric passthrough
    ];

    for (const { range, feet } of rangeCases) {
      it(`automation range ${JSON.stringify(range)} → payload range ${feet}`, async () => {
        const result = await run(makeAction({ automation: { range } }));
        expect(result.payload.range).toBe(feet);
      });
    }
  });

  describe('saveDc', () => {
    it('delegates to buildSaveDc(automation, playerStats) and uses its return value', async () => {
      savePrompt.buildSaveDc.mockReturnValue(15);
      const stats = makePlayerStats();
      const action = makeAction();

      const result = await run(action, stats);

      expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(action.automation, stats);
      expect(result.payload.saveDc).toBe(15);
    });

    it('SP-082 caster DC lock: real data declares spell_save_dc and real buildSaveDc resolves it', async () => {
      const spells = (await import('../../../../../public/data/2024/spells.json')).default;
      const spell = spells.find((s) => s.name === "Otiluke's Freezing Sphere");
      expect(spell.automation.saveDc).toBe('spell_save_dc');

      vi.resetModules();
      vi.doMock('../../common/savePrompt.js', async () =>
        vi.importActual('../../common/savePrompt.js'),
      );
      const { handle: realHandle } = await import('./freezingSphereHandler.js');

      const result = await realHandle(
        makeAction({ name: spell.name, automation: spell.automation, spell: { level: 6 } }),
        makePlayerStats(),
      );

      expect(result.payload.saveDc).toBe(16); // playerStats.spellAbilities.saveDc
      expect(result.payload.range).toBe(300); // '300 feet' through real rangeToFeet

      vi.doUnmock('../../common/savePrompt.js');
      vi.resetModules();
    });
  });

  it('handles missing automation via {} fallback without throwing', async () => {
    const result = await run({ name: 'Freezing Sphere', spell: {} });

    expect(result.type).toBe('modal');
    expect(result.payload.action.automation).toEqual({});
    expect(result.payload.damage).toBe('10d6');
  });
});
