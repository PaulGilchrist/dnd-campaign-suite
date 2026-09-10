// SP-126: Web zone persistence legs — the pre-fix handler never produced
// `_web_<caster>` tracking, never wrote the `web` zone te, and registered
// two racing condition expirations. Locked here.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  getCurrentCombatRound: vi.fn().mockReturnValue(1),
}));

vi.mock('../../../ui/storage.js', () => ({
  __esModule: true,
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn().mockResolvedValue({}),
}));

import { handle } from './webAreaSaveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../encounters/combatData.js';
import { getEffectDefinition } from '../../../combat/conditions/targetEffectDefinitions.js';

const KEY = 'pendingExpirations';
const campaignName = 'test-campaign';

function makePlayerStats() {
  return { name: 'TestCaster', level: 20, proficiency: 6, spellAbilities: { saveDc: 19 } };
}

function makeAction(automation = {}) {
  return {
    name: 'Web',
    spell: { name: 'Web', level: 2, duration: 'Concentration, up to 1 hour' },
    automation: { type: 'web_area_save', saveType: 'DEX', saveDc: 19, ...automation },
    metaCtx: { targets: ['Zombie 1', 'Thug 1'] },
  };
}

const cs = {
  creatures: [
    { name: 'TestCaster', type: 'player' },
    { name: 'Zombie 1', type: 'monster' },
    { name: 'Thug 1', type: 'monster' },
  ],
};

function stubFailingDex(listenerIndexFail = () => true) {
  savePrompt.createSaveListener.mockImplementation((_campaign, cfg) => ({
    promptId: `p-${cfg.targetName}`,
    promise: Promise.resolve(
      listenerIndexFail(cfg.targetName)
        ? { success: false, roll: 5, total: 3 }
        : { success: true, roll: 14, total: 14 }
    ),
  }));
}

describe('webAreaSaveHandler.handle — SP-126 zone persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    damageUtils.getCombatContext.mockResolvedValue(cs);
    savePrompt.buildSaveDc.mockReturnValue(19);
    combatData.getCombatSummary.mockReturnValue({});
    stubFailingDex();
  });

  it('produces the _web_<caster> zone tracking key', async () => {
    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestCaster',
      '_web_TestCaster',
      expect.objectContaining({
        caster: 'TestCaster',
        saveDc: 19,
        saveType: 'DEX',
        radius: 20,
        mapName: null,
      }),
      campaignName,
    );
  });

  it('writes the web zone te for EVERY target in the area (fail and success legs)', async () => {
    await handle(makeAction(), makePlayerStats(), campaignName, null);

    const teWrite = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[0] === 'campaign' && c[1] === 'targetEffects' && Array.isArray(c[2]),
    );
    expect(teWrite).toBeDefined();
    const webTes = teWrite[2].filter(te => te.effect === 'web' && te.source === 'TestCaster');
    expect(webTes.map(te => te.target).sort()).toEqual(['Thug 1', 'Zombie 1']);
    expect(webTes.every(te => te.duration === 'concentration' && te.dc === 19)).toBe(true);
  });

  it('applies Restrained on the failed DEX leg only and logs ability_use/save_result/condition', async () => {
    stubFailingDex((target) => target === 'Zombie 1');

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Zombie 1',
      'activeConditions',
      expect.arrayContaining(['restrained']),
      campaignName,
    );
    const zombieCondWrites = useRuntimeState.setRuntimeValue.mock.calls.filter(
      c => c[0] === 'Zombie 1' && c[1] === 'activeConditions',
    );
    const thugCondWrites = useRuntimeState.setRuntimeValue.mock.calls.filter(
      c => c[0] === 'Thug 1' && c[1] === 'activeConditions',
    );
    expect(zombieCondWrites.length).toBeGreaterThanOrEqual(1);
    expect(thugCondWrites).toHaveLength(0);

    const { addEntry } = await import('../../../ui/logService.js');
    const types = addEntry.mock.calls.map(c => c[1].type);
    expect(types).toContain('ability_use');
    expect(types.filter(t => t === 'save_result')).toHaveLength(2);
    expect(types).toContain('condition');
  });

  it('registers ONE merged zone expiration (tracking clear + web te removal) at 600 rounds', async () => {
    await handle(makeAction(), makePlayerStats(), campaignName, null);

    const zoneEntry = useRuntimeState.setRuntimeValue.mock.calls
      .filter(c => c[0] === 'TestCaster' && c[1] === KEY)
      .map(c => c[2])
      .flat()
      .find(entry => (entry.effects || []).some(e => e.type === 'remove_target_effect' && e.effectKey === 'web'));
    expect(zoneEntry).toBeDefined();
    expect(zoneEntry.expiryRounds).toBe(600);
    expect((zoneEntry.effects || []).some(
      e => e.type === 'clear_runtime_value' && e.key === '_web_TestCaster',
    )).toBe(true);
  });

  it('registers ONE Restrained condition expiration per failed target (no racing double write)', async () => {
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'p-1',
      promise: Promise.resolve({ success: false, roll: 5, total: 3 }),
    });

    await handle(
      { ...makeAction(), metaCtx: { targets: ['Zombie 1'] } },
      makePlayerStats(),
      campaignName,
      null,
    );

    const restrainedEntries = useRuntimeState.setRuntimeValue.mock.calls
      .filter(c => c[0] === 'TestCaster' && c[1] === KEY)
      .map(c => c[2])
      .flat()
      .filter(entry => (entry.effects || []).some(e => e.type === 'condition' && e.condition === 'restrained'));
    expect(restrainedEntries).toHaveLength(1);
    expect(restrainedEntries[0].target).toBe('Zombie 1');
    expect(restrainedEntries[0].expiryRounds).toBe(600);
  });

  it('registers the web effect key in the targetEffectDefinitions registry', () => {
    const def = getEffectDefinition('web');
    expect(def).toBeDefined();
    expect(def.label).toBe('Web');
    expect(def.cls).toBe('effect-debuff');
    expect(def.group).toBe('Spells');
  });
});
