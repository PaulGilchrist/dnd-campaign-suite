// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectAutomationFromFeatures } from './automationCollector.js';

// FT-036: the Grappler "Punch and Grab" benefit must route its attack_rider
// automation into automation.passives so the steps/features/grappler.js on-hit
// consumer can find it. Read the real 2024 feats.json and replay the exact
// feature shape parse2024OtherBenefit pushes for a type:'action' benefit.
function loadGrapplerPunchAndGrab() {
  const raw = readFileSync(resolve(process.cwd(), 'public/data/2024/feats.json'), 'utf8');
  const feats = JSON.parse(raw);
  const list = Array.isArray(feats) ? feats : feats.feats;
  const grappler = list.find(f => f.name === 'Grappler');
  return grappler.benefits.find(b => b.name === 'Punch and Grab');
}

describe('FT-036 — Punch and Grab routes to automation.passives', () => {
  it('feats.json authors attack_rider/unarmed_strike_hit/punch_and_grab', () => {
    const benefit = loadGrapplerPunchAndGrab();
    expect(benefit.automation).toMatchObject({
      type: 'attack_rider',
      trigger: 'unarmed_strike_hit',
      effect: 'punch_and_grab',
      oncePerTurn: true,
      casting_time: 'passive',
    });
  });

  it('routes the real rider into passives and nowhere else, verbatim markers intact', () => {
    const benefit = loadGrapplerPunchAndGrab();
    // parse2024OtherBenefit default push for type:'action': automation verbatim.
    const feature = { name: benefit.name, description: benefit.description, type: benefit.type, automation: benefit.automation };
    const playerStats = { name: 'Monk1', abilities: [], proficiency: 2 };
    const result = collectAutomationFromFeatures([feature], playerStats);
    // Set-exactness: exactly one occurrence across every bucket, in passives.
    const bucketsWithRider = Object.entries(result)
      .filter(([, items]) => Array.isArray(items) && items.some(item => item?.effect === 'punch_and_grab'))
      .map(([bucket]) => bucket);
    expect(bucketsWithRider).toEqual(['passives']);
    // Consumer (steps/features/grappler.js) gates on the collected rider keeping
    // the routing/load-bearing markers: trigger, oncePerTurn, casting_time passive.
    expect(result.passives.filter(p => p.effect === 'punch_and_grab')).toHaveLength(1);
    expect(result.passives.find(p => p.effect === 'punch_and_grab')).toMatchObject({
      type: 'attack_rider',
      trigger: 'unarmed_strike_hit',
      oncePerTurn: true,
      casting_time: 'passive',
    });
  });
});
