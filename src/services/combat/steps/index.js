import { createPipeline } from '../actionPipeline.js';
import { buildDamageSteps } from './weaponDamageSteps.js';
import { buildSpellDamageSteps } from './spellDamageSteps.js';
import { buildGenericSteps } from './genericSteps.js';
import { createObservers } from './observers.js';
import { createSseObservers } from './sseObservers.js';

/**
 * Build an action pipeline for the given action type.
 *
 * @param {object} action - The action being executed (attack, spell, etc.)
 * @param {object} playerStats - The acting character's computed stats
 * @returns {object} pipeline - A configured pipeline (call pipeline.run() to execute)
 */
export function buildPipelineForAction(action, playerStats) {
  const pipeline = createPipeline();

  // Register log observers
  const observers = createObservers();
  for (const obs of observers) {
    pipeline.observe(obs.event, obs.handler);
  }

  // Register SSE observers
  const campaignName = playerStats?.campaignName || '';
  if (campaignName) {
    const sseObservers = createSseObservers(campaignName);
    for (const obs of sseObservers) {
      pipeline.observe(obs.event, obs.handler);
    }
  }

  // Register steps based on action type
  const hasDamage = action?.damage || action?.hasDamage || action?.damageExpression;
  const isWeaponAttack = action?.type === 'weapon_attack' || action?.weaponType || (hasDamage && !action?.autoDamageSchool && !action?.spellType);
  const isSpell = action?.type === 'spell' || action?.spellType || action?.autoDamageSchool;

  if (isWeaponAttack) {
    const steps = buildDamageSteps();
    for (const step of steps) {
      pipeline.step(step);
    }
  } else if (isSpell) {
    const steps = buildSpellDamageSteps();
    for (const step of steps) {
      pipeline.step(step);
    }
  } else if (hasDamage) {
    // Generic: anything with damage that isn't weapon or spell
    const steps = buildGenericSteps();
    for (const step of steps) {
      pipeline.step(step);
    }
  }

  return pipeline;
}
