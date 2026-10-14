// CLA-277: shockwave CON save must use the Monk's Focus save DC (8 + WIS + PB),
// built data-driven via saveDc:'ability' + saveAbility:'WIS' in classes.json.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../automation/common/savePrompt.js', async (importOriginal) => ({
  ...(await importOriginal()),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 60, rolls: [6, 6, 6, 6, 6, 6, 6, 6, 6, 6], modifier: 0 })),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 60 })),
}));

// ── Imports ────────────────────────────────────────────────────

import { applyShockwave } from './quiveringPalmHandler.js';
import { addEntry } from '../../../ui/logService.js';
import { buildSaveDc, createSaveListener } from '../../../automation/common/savePrompt.js';
import { rollExpression } from '../../../dice/diceRoller.js';

// ── Fixtures ───────────────────────────────────────────────────

const campaignName = 'test-campaign';

const quiveringPalmAutomation = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../../public/data/2024/classes.json'), 'utf8')
)
  .find(c => c.name === 'Monk')
  .majors.find(m => m.name === 'Warrior of the Open Hand')
  .features.find(f => f.name === 'Quivering Palm').automation;

function makeMonkStats() {
  return {
    name: 'Disciplined_Monk',
    level: 17,
    proficiency: 6,
    abilities: [
      { name: 'Strength', bonus: -1 },
      { name: 'Dexterity', bonus: 3 },
      { name: 'Constitution', bonus: 2 },
      { name: 'Intelligence', bonus: 0 },
      { name: 'Wisdom', bonus: 4 },
      { name: 'Charisma', bonus: 0 },
    ],
    class: { class_levels: [{ level: 17, focus_points: 17 }] },
  };
}

const action = { name: 'Quivering Palm', automation: quiveringPalmAutomation };

// ── Tests ──────────────────────────────────────────────────────

describe('CLA-277 quiveringPalm shockwave save DC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSaveListener.mockReturnValue({
      promise: Promise.resolve({ success: false, roll: 5, saveBonus: 0 }),
    });
  });

  it('classes.json Quivering Palm automation declares data-driven ability save DC', () => {
    expect(quiveringPalmAutomation.saveDc).toBe('ability');
    expect(quiveringPalmAutomation.saveAbility).toBe('WIS');
  });

  it('buildSaveDc resolves the Focus save DC 18 (8 + WIS 4 + PB 6) from the data', () => {
    expect(buildSaveDc(quiveringPalmAutomation, makeMonkStats())).toBe(18);
  });

  it('applyShockwave threads DC 18 into the save prompt listener', async () => {
    await applyShockwave(action, makeMonkStats(), campaignName, 'Yuan-Ti Pureblood 1');

    expect(createSaveListener).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        targetName: 'Yuan-Ti Pureblood 1',
        saveType: 'CON',
        saveDc: 18,
      })
    );
  });

  it('applyShockwave logs DC 18 on both save-damage log entries', async () => {
    await applyShockwave(action, makeMonkStats(), campaignName, 'Yuan-Ti Pureblood 1');

    const logged = addEntry.mock.calls
      .map(c => c[1])
      .filter(e => e.rollType === 'save-damage');
    expect(logged.length).toBe(2);
    expect(logged.every(e => e.saveDc === 18)).toBe(true);
    expect(logged[0].description).toContain('DC 18');
  });

  it('applyShockwave returns result popup carrying DC 18 and half-on-save math intact', async () => {
    createSaveListener.mockReturnValue({
      promise: Promise.resolve({ success: true, roll: 19, saveBonus: 0 }),
    });
    rollExpression.mockReturnValue({ total: 82, rolls: [8, 8, 9, 9, 8, 8, 9, 9, 7, 7], modifier: 0 });

    const result = await applyShockwave(action, makeMonkStats(), campaignName, 'Cultist Fanatic 1');

    expect(result.payload.saveDc).toBe(18);
    expect(result.payload.rawDamage).toBe(82);
    expect(result.payload.finalDamage).toBe(41);
  });
});
