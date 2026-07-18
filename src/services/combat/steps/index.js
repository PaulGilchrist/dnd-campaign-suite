import { createPipeline } from '../actionPipeline.js';
import { buildAttackRollDamageSteps } from './attackRollDamageSteps.js';
import { buildDirectSpellDamageSteps } from './directSpellDamageSteps.js';
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
  const isAttackRoll = action?.type === 'weapon_attack' || action?.weaponType || (hasDamage && !action?.autoDamageSchool && !action?.spellType);
  const isDirectSpell = action?.type === 'spell' || action?.spellType || action?.autoDamageSchool;

  if (isAttackRoll) {
    const steps = buildAttackRollDamageSteps();
    for (const step of steps) {
      pipeline.step(step);
    }
  } else if (isDirectSpell) {
    const steps = buildDirectSpellDamageSteps();
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
