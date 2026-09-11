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
function registerObservers(pipeline, campaignName) {
  // Register log observers
  for (const obs of createObservers()) {
    pipeline.observe(obs.event, obs.handler);
  }

  // Register SSE observers
  if (!campaignName) return;
  for (const obs of createSseObservers(campaignName)) {
    pipeline.observe(obs.event, obs.handler);
  }
}

function selectStepBuilders(action) {
  const hasDamage = action?.damage || action?.hasDamage || action?.damageExpression;
  const isAttackRoll = action?.type === 'weapon_attack' || action?.weaponType || (hasDamage && !action?.autoDamageSchool && !action?.spellType);
  const isDirectSpell = action?.type === 'spell' || action?.spellType || action?.autoDamageSchool;

  if (isAttackRoll) return buildAttackRollDamageSteps;
  if (isDirectSpell) return buildDirectSpellDamageSteps;
  // Generic: anything with damage that isn't weapon or spell
  if (hasDamage) return buildGenericSteps;
  return null;
}

export function buildPipelineForAction(action, playerStats) {
  const pipeline = createPipeline();

  registerObservers(pipeline, playerStats?.campaignName || '');

  // Register steps based on action type
  const buildSteps = selectStepBuilders(action);
  if (buildSteps) {
    for (const step of buildSteps()) {
      pipeline.step(step);
    }
  }

  return pipeline;
}
