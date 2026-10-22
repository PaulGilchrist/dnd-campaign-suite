import { createPipeline } from '../actionPipeline.js';
import { buildAttackRollDamageSteps } from './attackRollDamageSteps.js';
import { buildDirectSpellDamageSteps } from './directSpellDamageSteps.js';
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

function actionHasDamage(action) {
  return action?.damage || action?.hasDamage || action?.damageExpression;
}

function isDirectSpellAction(action) {
  return action?.type === 'spell' || action?.spellType || action?.autoDamageSchool;
}

function isAttackRollAction(action, hasDamage) {
  if (action?.type === 'weapon_attack' || action?.weaponType) return true;
  // Attack roll: damage that is not spell damage
  return !!hasDamage && !action?.autoDamageSchool && !action?.spellType;
}

function selectStepBuilders(action) {
  const hasDamage = actionHasDamage(action);
  if (isAttackRollAction(action, hasDamage)) return buildAttackRollDamageSteps;
  if (isDirectSpellAction(action)) return buildDirectSpellDamageSteps;
  // Census #1063/#1064: the generic lane (buildGenericSteps) was aspirational-from-birth —
  // wired in the SAME commit that added it (9447923a2, Phase 2.1.2) yet unreachable at every
  // predicate since: this arm required hasDamage && ¬attack && ¬spell, but bare damage is
  // claimed by :isAttackRollAction and any spellType/autoDamageSchool escape is captured by
  // isDirectSpellAction (empty set), and the lane's chain starts at 'generic:do' which no
  // production caller ever runs (call sites run 'housekeeping:do' only —
  // useAttackDamageResolution.js:102/:447). Its contract (roll autoFormulaOverride ||
  // attack.damage → proceedWithDamage) is absorbed verbatim by the attack lane
  // (attackRollDamageCalc.js:62-67) and the spell lane (directSpellDamageSteps.js:126/:142).
  // Nothing routes here: non-damage actions get a zero-step pipeline (silent no-op, pinned).
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
