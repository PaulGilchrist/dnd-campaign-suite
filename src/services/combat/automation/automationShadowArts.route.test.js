// CLA-308: Shadow Arts automation info + routing. buildAttackInfo must map the
// feature's shadow_arts automation to a passive info (freeCastSpells/usesMax/recharge/
// saveAbility forwarded) mirroring the phantasmal_creatures builder, and routeAutomation
// must collect it into passives (never an interactive specialAction row).
import { describe, it, expect } from 'vitest';
import { buildAttackInfo } from './automationInfoBuilder.js';
import { routeAutomation } from './automationRouter.js';

const FEATURE = {
  name: 'Shadow Arts',
  description: 'You can cast the Darkness, Darkvision, Pass Without Trace, and Silence spells without expending spell slots or preparing them, using Wisdom as your spellcasting ability. Each of these spells can be cast in this way once per Long Rest.',
  level: 3,
  automation: {
    type: 'shadow_arts',
    casting_time: 'passive',
    freeCastSpells: ['Darkness', 'Darkvision', 'Pass Without Trace', 'Silence'],
    usesMax: 1,
    recharge: 'long_rest',
    saveAbility: 'WIS',
  },
};

describe('automation info + routing — CLA-308 Shadow Arts', () => {
  it('builds the shadow_arts passive info with free-cast spell list and WIS save ability', () => {
    const info = buildAttackInfo(FEATURE, { name: 'Disciplined_Monk' });
    expect(info).toBeTruthy();
    expect(info.type).toBe('shadow_arts');
    expect(info.name).toBe('Shadow Arts');
    expect(info.freeCastSpells).toEqual(['Darkness', 'Darkvision', 'Pass Without Trace', 'Silence']);
    expect(info.usesMax).toBe(1);
    expect(info.recharge).toBe('long_rest');
    expect(info.saveAbility).toBe('WIS');
  });

  it('routes the info into passives only (no actions / specialActions)', () => {
    const info = buildAttackInfo(FEATURE, { name: 'Disciplined_Monk' });
    const result = { actions: [], bonusActions: [], reactions: [], specialActions: [], passives: [], autoEffects: [], saveModifiers: [], primalKnowledge: [], ritualSpells: [] };
    routeAutomation(info, FEATURE.automation, result);
    expect(result.passives.some(p => p.type === 'shadow_arts')).toBe(true);
    expect(result.actions).toHaveLength(0);
    expect(result.bonusActions).toHaveLength(0);
    expect(result.specialActions).toHaveLength(0);
  });
});
