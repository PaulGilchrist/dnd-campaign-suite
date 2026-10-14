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

function makeAction(automation = {}) {
  return {
    name: 'Freezing Sphere',
    automation: {
      type: 'freezing_sphere',
      ...automation,
    },
    spell: {},
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('freezingSphereHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(16);
  });

  describe('return value structure', () => {
    it('returns a modal with type "modal" and modalName "saveAttackAoe"', async () => {
      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('saveAttackAoe');
    });

    it('includes all required payload fields', async () => {
      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload).toEqual(
        expect.objectContaining({
          action: expect.objectContaining({
            name: 'Freezing Sphere',
            automation: expect.any(Object),
            spell: expect.any(Object),
          }),
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
        }),
      );
    });
  });

  describe('damage calculation', () => {
    it('uses 10d6 for base level 6 spell', async () => {
      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.damage).toBe('10d6');
    });

    it('uses 10d6 when action.spell.level is 6', async () => {
      const result = await handle(
        { ...makeAction(), spell: { level: 6 } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.damage).toBe('10d6');
    });

    it('uses 10d6 when action.spell.baseLevel is 6', async () => {
      const result = await handle(
        { ...makeAction(), spell: { baseLevel: 6 } },
        makePlayerStats(),
      );

      expect(result.payload.damage).toBe('10d6');
    });

    it('prefers action.spell.level over action.spell.baseLevel', async () => {
      const result = await handle(
        { ...makeAction(), spell: { level: 9, baseLevel: 6 } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.damage).toBe('13d6');
    });

    it('uses 11d6 for level 7', async () => {
      const result = await handle(
        { ...makeAction(), spell: { level: 7 } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.damage).toBe('11d6');
    });

    it('uses 12d6 for level 8', async () => {
      const result = await handle(
        { ...makeAction(), spell: { level: 8 } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.damage).toBe('12d6');
    });

    it('uses 13d6 for level 9', async () => {
      const result = await handle(
        { ...makeAction(), spell: { level: 9 } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.damage).toBe('13d6');
    });

    it('uses highest defined level when slot level exceeds max (level 10)', async () => {
      const result = await handle(
        { ...makeAction(), spell: { level: 10 } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.damage).toBe('13d6');
    });

    it('uses 10d6 fallback when slot level is below minimum (level 1)', async () => {
      const result = await handle(
        { ...makeAction(), spell: { level: 1 } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.damage).toBe('10d6');
    });

    it('uses 10d6 fallback when slot level is 5 (below minimum 6)', async () => {
      const result = await handle(
        { ...makeAction(), spell: { level: 5 } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.damage).toBe('10d6');
    });

    it('uses 11d6 when baseLevel is 7', async () => {
      const result = await handle(
        { ...makeAction(), spell: { baseLevel: 7 } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.damage).toBe('11d6');
    });

    it('uses 12d6 when baseLevel is 8', async () => {
      const result = await handle(
        { ...makeAction(), spell: { baseLevel: 8 } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.damage).toBe('12d6');
    });

    it('uses 13d6 when baseLevel is 9', async () => {
      const result = await handle(
        { ...makeAction(), spell: { baseLevel: 9 } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.damage).toBe('13d6');
    });

    it('uses 10d6 when spell object is missing', async () => {
      const result = await handle(
        { ...makeAction(), spell: null },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.damage).toBe('10d6');
    });

    it('uses 10d6 when spell object is undefined', async () => {
      const action = { name: 'Freezing Sphere', automation: { type: 'freezing_sphere' } };
      const result = await handle(action, makePlayerStats(), campaignName, mapName);

      expect(result.payload.damage).toBe('10d6');
    });
  });

  describe('saveDC', () => {
    it('calls buildSaveDc with automation and playerStats', async () => {
      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(
        makeAction().automation,
        expect.any(Object),
      );
    });

    it('uses the return value of buildSaveDc as saveDc', async () => {
      savePrompt.buildSaveDc.mockReturnValue(15);

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.saveDc).toBe(15);
    });

    it('resolves saveDc from automation saveDc "spell_save_dc" via buildSaveDc', async () => {
      savePrompt.buildSaveDc.mockImplementation((auto, stats) =>
        auto.saveDc === 'spell_save_dc' ? stats.spellAbilities.saveDc : 10,
      );

      const result = await handle(
        makeAction({ saveDc: 'spell_save_dc' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(
        expect.objectContaining({ saveDc: 'spell_save_dc' }),
        expect.any(Object),
      );
      expect(result.payload.saveDc).toBe(16);
    });
  });

  describe('caster spell save DC lock (SP-082)', () => {
    it('2024 spells.json automation declares saveDc "spell_save_dc" for Freezing Sphere', async () => {
      const spells = (await import('../../../../../public/data/2024/spells.json')).default;
      const spell = spells.find((s) => s.name === "Otiluke's Freezing Sphere");

      expect(spell.automation.saveDc).toBe('spell_save_dc');
    });

    it('payload saveDc equals playerStats.spellAbilities.saveDc with real buildSaveDc', async () => {
      vi.resetModules();
      vi.doMock('../../common/savePrompt.js', async () =>
        vi.importActual('../../common/savePrompt.js'),
      );
      const { handle: realHandle } = await import('./freezingSphereHandler.js');
      const spells = (await import('../../../../../public/data/2024/spells.json')).default;
      const spell = spells.find((s) => s.name === "Otiluke's Freezing Sphere");

      const result = await realHandle(
        { name: spell.name, automation: spell.automation, spell: { level: 6 } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.saveDc).toBe(16);
      vi.doUnmock('../../common/savePrompt.js');
      vi.resetModules();
    });
  });

  describe('payload fields', () => {
    it('passes action through in payload.action', async () => {
      const customAction = {
        name: 'My Freezing Sphere',
        automation: { type: 'freezing_sphere', customField: 'value' },
        spell: { level: 7 },
      };

      const result = await handle(
        customAction,
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.action.name).toBe('My Freezing Sphere');
      expect(result.payload.action.automation.customField).toBe('value');
      expect(result.payload.action.spell.level).toBe(7);
    });

    it('passes playerStats through in payload.playerStats', async () => {
      const customStats = makePlayerStats({ name: 'OtherCaster' });

      const result = await handle(
        makeAction(),
        customStats,
        campaignName,
        mapName,
      );

      expect(result.payload.playerStats).toBe(customStats);
    });

    it('passes campaignName through in payload.campaignName', async () => {
      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.campaignName).toBe(campaignName);
    });

    it('always sets shape to sphere', async () => {
      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.shape).toBe('sphere');
    });

    it('always sets range to 300', async () => {
      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.range).toBe(300);
    });

    it('always sets damageType to Cold', async () => {
      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.damageType).toBe('Cold');
    });

    it('always sets saveType to CON', async () => {
      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.saveType).toBe('CON');
    });

    it('always sets dcSuccess to half', async () => {
      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.dcSuccess).toBe('half');
    });

    it('always sets activeOverlay to null', async () => {
      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.activeOverlay).toBeNull();
    });

    it('uses action name in payload.action', async () => {
      const result = await handle(
        { name: 'Custom Name', automation: { type: 'freezing_sphere' } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.action.name).toBe('Custom Name');
    });
  });

  describe('action passthrough', () => {
    it('passes automation object through in payload.action.automation', async () => {
      const customAutomation = {
        type: 'freezing_sphere',
        customField: 'customValue',
        anotherField: 42,
      };

      const result = await handle(
        {
          name: 'Freezing Sphere',
          automation: customAutomation,
          spell: {},
        },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.action.automation).toEqual(customAutomation);
    });

    it('passes spell object through in payload.action.spell', async () => {
      const customSpell = {
        level: 8,
        school: 'Evocation',
        castingTime: '1 action',
      };

      const result = await handle(
        {
          name: 'Freezing Sphere',
          automation: { type: 'freezing_sphere' },
          spell: customSpell,
        },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.action.spell).toEqual(customSpell);
    });
  });

  describe('edge cases', () => {
    it('handles empty automation object', async () => {
      savePrompt.buildSaveDc.mockReturnValue(10);

      const result = await handle(
        { name: 'Freezing Sphere', automation: {}, spell: {} },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.type).toBe('modal');
      expect(result.payload.damage).toBe('10d6');
      expect(result.payload.saveDc).toBe(10);
    });

    it('handles missing automation entirely', async () => {
      const result = await handle(
        { name: 'Freezing Sphere', spell: {} },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.type).toBe('modal');
      expect(result.payload.damage).toBe('10d6');
    });

    it('handles playerStats with no spellAbilities', async () => {
      const stats = makePlayerStats({ spellAbilities: undefined });
      savePrompt.buildSaveDc.mockReturnValue(10);

      const result = await handle(
        makeAction(),
        stats,
        campaignName,
        mapName,
      );

      expect(result.payload.saveDc).toBe(10);
    });

    it('handles playerStats with no proficiency', async () => {
      const stats = makePlayerStats({ proficiency: 0, abilities: [] });
      savePrompt.buildSaveDc.mockReturnValue(8);

      const result = await handle(
        makeAction(),
        stats,
        campaignName,
        mapName,
      );

      expect(result.payload.saveDc).toBe(8);
    });

    it('handles numeric saveDc from automation', async () => {
      savePrompt.buildSaveDc.mockReturnValue(18);

      const result = await handle(
        { name: 'Freezing Sphere', automation: { saveDc: 18, type: 'freezing_sphere' }, spell: {} },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.saveDc).toBe(18);
    });
  });
});
