import { createPipeline } from '../actionPipeline.js';
import { buildWeaponDamageSteps } from './weaponDamageSteps.js';
import { createObservers } from './observers.js';

/**
 * Build an action pipeline for the given action type.
 *
 * @param {object} action - The action being executed (attack, spell, etc.)
 * @param {object} playerStats - The acting character's computed stats
 * @returns {object} pipeline - A configured pipeline (call pipeline.run() to execute)
 */
export function buildPipelineForAction(action, _playerStats) {
  const pipeline = createPipeline();

  // Register observers
  const observers = createObservers();
  for (const obs of observers) {
    pipeline.observe(obs.event, obs.handler);
  }

  // Register steps based on action type
  const hasDamage = action?.damage || action?.hasDamage || action?.damageExpression;
  const isWeaponAttack = action?.type === 'weapon_attack' || action?.weaponType || hasDamage;

  if (isWeaponAttack) {
    const steps = buildWeaponDamageSteps();
    for (const step of steps) {
      pipeline.step(step);
    }
  }

  return pipeline;
}
