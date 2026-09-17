// MA-0022: a non-numeric legendary row ("The aboleth makes one Tentacle
// attack") delegates its mechanic to another named action row on the SAME
// monster (`delegates_to:"Tentacle"`). Lookup spans actions +
// legendary_actions (never self); the caller resolves the delegate via the
// same attack-roll seam the delegated row's own link uses.
export function legendaryDelegateAction(monster, action) {
  if (!action?.delegates_to) return null;
  const rows = [...(monster?.actions || []), ...(monster?.legendary_actions || [])];
  return rows.find(r => r && r !== action && r.name === action.delegates_to) || null;
}

export function legendaryDelegateAttackName(action, delegate) {
  const kind = delegate?.save_dc != null ? 'save' : 'attack';
  return `${action.name} (${delegate.name} ${kind})`;
}

// MA-0023: Psychic Drain — "If the aboleth has at least one creature
// Charmed or Grappled, it uses Consume Memories and regains 5 (1d10) HP."
// The any-ally prerequisite is NOT the MA-0019 per-armed-target gate: it
// scans the whole roster for ANY creature bearing one of the conditions
// with provenance `activeConditionMeta[cond].source === monsterName`
// (MA-0019 provenance; MA-0018 tentacle-grapple hit-clause stamps the
// same source). Unmet → refusal popup + `<action>_refused` log, zero
// legendary spend. Met → spend + delegated save + self-heal roll.
export function parseLegendaryAllyPrerequisite(action) {
  const tp = action?.target_prerequisite;
  if (!tp || tp.any_ally_of_attacker !== true || !Array.isArray(tp.conditions) || tp.conditions.length === 0) return null;
  return { conditions: tp.conditions.map(c => String(c).toLowerCase()) };
}

export function legendaryAllyPrerequisiteSatisfied({ prerequisite, creatures, monsterName, getRuntimeValue }) {
  if (!prerequisite) return { satisfied: true };
  for (const c of creatures || []) {
    if (!c || c.name === monsterName) continue;
    const conditions = getRuntimeValue(c.name, 'activeConditions') || [];
    const conditionMeta = getRuntimeValue(c.name, 'activeConditionMeta') || {};
    for (const cond of prerequisite.conditions) {
      if (!conditions.some(x => String(x).toLowerCase() === cond)) continue;
      if ((conditionMeta?.[cond]?.source || null) === monsterName) {
        return { satisfied: true, targetName: c.name, condition: cond };
      }
    }
  }
  return { satisfied: false };
}

function allyConditionLabels(prerequisite) {
  return prerequisite.conditions.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' or ');
}

export function buildLegendaryPrerequisiteRefusalPopup({ monsterName, actionName, prerequisite }) {
  return `<div class="mc-prerequisite-refusal"><h3>Prerequisite Not Met</h3><p>${monsterName} can't use ${actionName} — no creature is currently ${allyConditionLabels(prerequisite)} by ${monsterName}. No legendary use spent, no roll, no healing.</p></div>`;
}

export function buildLegendaryPrerequisiteRefusalLog({ monsterName, actionName, prerequisite }) {
  const slug = String(actionName || 'action').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return {
    type: 'automation',
    automationType: `${slug}_refused`,
    characterName: monsterName,
    abilityName: actionName,
    description: `${monsterName} ${actionName} refused — no creature is ${allyConditionLabels(prerequisite)} by ${monsterName}. Zero spend, no roll, no healing.`,
    timestamp: Date.now(),
  };
}

// MA-0023: self-heal leg — roll the authored formula (1d10) and route
// through the canonical combatSummary heal helper (applyHealingToTarget,
// MA-0016 choke point: 'no_healing' te refusals land there with a
// healing_blocked log). Logs hp_change (isHealing) naming the row.
export async function applyLegendarySelfHeal({ monsterName, actionName, formula, campaignName, deps = {} }) {
  const roll = deps.rollExpression || rollExpression;
  const getCC = deps.getCombatContext || getCombatContext;
  const applyHeal = deps.applyHealingToTarget || applyHealingToTarget;
  const log = deps.addEntry || addEntry;

  const result = roll(formula);
  if (!result) {
    console.error(`[monsterLegendaryUses] self_heal formula "${formula}" unparseable for ${monsterName} ${actionName}`);
    return null;
  }
  const cs = await getCC(campaignName);
  const heal = applyHeal(cs, monsterName, result.total, campaignName);
  if (!heal) {
    console.error(`[monsterLegendaryUses] self_heal target "${monsterName}" not in combatSummary for ${actionName}`);
    return null;
  }
  await log(campaignName, {
    type: 'hp_change',
    targetName: monsterName,
    sourceName: monsterName,
    delta: heal.actualHeal,
    currentHp: heal.newHp,
    maxHp: heal.maxHp,
    isHealing: true,
    isUnconscious: false,
    rollInfo: `${formula}: ${result.total}`,
    description: `${monsterName} ${actionName} self-heal: ${formula} rolled ${result.total} — ${heal.actualHeal} HP regained (${heal.newHp}/${heal.maxHp}).`,
  });
  return { rolled: result.total, applied: heal.actualHeal, newHp: heal.newHp, maxHp: heal.maxHp };
}

// MA-0021: minimal legendary-uses economy for the "Legendary Action Uses"
// header row (Aboleth 3 / 4-in-Lair). Mirrors the established finite-uses
// tracking (MA-0005 monsterSpellUses / MA-0006 monsterReactionUses) with a
// runtime map on the MONSTER-name store key (`monsterLegendaryUses`,
// `{max, used}`) plus a round+turn latch (`_legendaryUses_usedRound`,
// `{round, activeCreature}`) enforcing RAW "immediately after ANOTHER
// creature's turn, max one expend per turn". Exhausted click = refusal popup +
// `legendary_use_refused` log, zero spend. All uses regain at the START of
// the aboleth's own turn via the existing turn-start seam (turnStartEffects
// pre-guard monster path) with an `ability_use` regain log — the seam knows
// nothing about stat blocks, so the map carries its own `max` (stamped at
// expend). "4 in Lair" stays advisory — no lair-flag consumer (CLA-325).
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { rollExpression } from '../dice/diceRoller.js';
import { applyHealingToTarget } from '../rules/combat/applyHealing.js';

export const MONSTER_LEGENDARY_USES_KEY = 'monsterLegendaryUses';
export const MONSTER_LEGENDARY_LATCH_KEY = '_legendaryUses_usedRound';
// MA-0073: per-ACTION cooldown (Scorching Sands "can't take this action
// again until the start of its next turn"). The MA-0070 turn-latch is
// one-expend-per-BOUNDARY, not the row's own gate — an action-keyed map
// on the monster store keeps each named legendary row unusable across
// every boundary until the monster's own turn-start regain clears it.
export const MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY = 'monsterLegendaryActionCooldowns';

export function legendaryActionSlug(actionName) {
  return String(actionName || 'action').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function hasLegendaryCooldownClause(action) {
  return /(?:can'?t|cannot) take this action again until the start of its next turn/i.test(action?.description || '');
}

export function buildLegendaryCooldownRefusalPopup({ monsterName, actionName }) {
  return `<div class="mc-prerequisite-refusal"><h3>Legendary Action Refused</h3><p>${monsterName} can't take ${actionName} again until the start of its next turn. Nothing spent, no roll.</p></div>`;
}

export function buildLegendaryCooldownRefusalLog({ monsterName, actionName }) {
  return {
    type: 'automation',
    automationType: `${legendaryActionSlug(actionName)}_refused (once per turn)`,
    characterName: monsterName,
    abilityName: actionName,
    description: `${monsterName} ${actionName} refused (once per turn) — can't take this action again until the start of its next turn. Zero spend, no save rolled.`,
    timestamp: Date.now(),
  };
}

export function legendaryHeaderAction(monster) {
  const rows = monster?.legendary_actions;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0]?.uses != null ? rows[0] : null;
}

export function legendaryMaxUses(header, storedUses) {
  const authored = header?.uses != null ? Number(header.uses) : null;
  if (authored != null && Number.isFinite(authored) && authored > 0) return authored;
  const stamped = Number(storedUses?.max);
  return Number.isFinite(stamped) && stamped > 0 ? stamped : null;
}

export function legendaryUsesRemaining(header, storedUses) {
  const max = legendaryMaxUses(header, storedUses);
  if (max == null) return null;
  return Math.max(0, max - (Number(storedUses?.used) || 0));
}

// Gate for a legendary-row click. Refusal reasons: exhausted / own-turn /
// turn (one expend per other-creature-turn latch).
export function legendaryExpendGate({ header, storedUses, round, activeCreatureName, monsterName, latch }) {
  const max = legendaryMaxUses(header, storedUses);
  if (max == null) return { allowed: false, reason: 'no-uses' };
  if (legendaryUsesRemaining(header, storedUses) === 0) return { allowed: false, reason: 'exhausted', max };
  if (activeCreatureName === monsterName) return { allowed: false, reason: 'own-turn', max };
  if (latch && Number(latch.round) === Number(round) && latch.activeCreature === activeCreatureName) {
    return { allowed: false, reason: 'turn', max };
  }
  return { allowed: true, remaining: legendaryUsesRemaining(header, storedUses), max };
}

// MA-0051: authored skill-check legendary rows (Adult Blue Dracolich
// "Detect" → ability_check {ability:"wisdom", skill:"perception"}). The
// bonus resolves from the stat block truth: monster.skills (case-insensitive
// skill lookup — the authored +14 beats the divergent ability_score_modifiers
// wis entry, and passive 24 = 10 + 14 confirms the skill mod) with the
// ability_score_modifiers entry as the skill-less fallback. Null bonus =
// unresolvable → the caller refuses BEFORE the legendary spend.
export function legendaryCheckRow(action) {
  const ac = action?.ability_check;
  return ac && ac.ability ? ac : null;
}

export function legendaryCheckBonus(monster, action) {
  const ac = legendaryCheckRow(action);
  if (!ac) return null;
  const skills = monster?.skills || {};
  const skillKey = ac.skill
    ? Object.keys(skills).find(k => k.toLowerCase() === String(ac.skill).toLowerCase())
    : null;
  if (skillKey != null) return Number(skills[skillKey]?.modifier) || 0;
  // ability_score_modifiers are keyed by 3-letter abbr (wis/dex/…).
  const abbr = String(ac.ability).toLowerCase().slice(0, 3);
  const mod = Number(monster?.ability_score_modifiers?.[abbr]);
  return Number.isFinite(mod) ? mod : null;
}

export function legendaryCheckLabel(action) {
  const ac = legendaryCheckRow(action);
  if (!ac) return null;
  const titleCase = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase();
  return ac.skill ? `${titleCase(ac.ability)} (${titleCase(ac.skill)})` : `${titleCase(ac.ability)} check`;
}

export function buildLegendaryRefusalPopup({ monsterName, actionName, reason }) {
  const why = reason === 'exhausted'
    ? `${monsterName} has no legendary uses left — they regain at the start of ${monsterName}'s turn.`
    : reason === 'turn'
      ? `Only one legendary action can be expended immediately after each creature's turn.`
      : reason === 'own-turn'
        ? `${monsterName} expends legendary uses after ANOTHER creature's turn, not its own.`
        : reason === 'no-delegate'
          ? `${actionName} delegates to an attack that could not be found on ${monsterName}. Check the stat block.`
          : reason === 'no-check-bonus'
            ? `${actionName} declares an ability check but no skill or ability modifier could be resolved on ${monsterName}. Check the stat block.`
            : `${monsterName} has no legendary uses to expend.`;
  return `<div class="mc-prerequisite-refusal"><h3>Legendary Action Refused</h3><p>${actionName}: ${why} Nothing spent, no roll.</p></div>`;
}

export function buildLegendaryRefusalLog({ monsterName, actionName, reason }) {
  return {
    type: 'automation',
    automationType: 'legendary_use_refused',
    characterName: monsterName,
    abilityName: actionName,
    description: `${monsterName} ${actionName} legendary action refused (${reason}) — zero spend, no roll.`,
    timestamp: Date.now(),
  };
}

// MA-0058: advisory legendary rows with no rollable mechanic (Adult Blue
// Dragon "Cloaked Flight" — self Invisibility + half-Fly-Speed movement).
// Mirrors the lair advisory model (MA-0024/CLA-325): the spend is already
// logged by expendLegendaryUse; the click lands a spell-named adjudication
// record (popup + ability_use log) instead of a console.error dead-end —
// invisibility/movement-distance have no engine consumer (GM-enforced).
export function buildLegendaryAdvisoryPopup({ monsterName, action }) {
  // MA-0270/0271: rows may carry their own honest advisory copy
  // (`advisory_message`) — e.g. sphinx teleport has no position consumer
  // (CLA-320) and "Cast a Spell" has no authored spell list. Rows without
  // the field keep the MA-0058 invisibility fly-speed copy byte-identical.
  if (action?.advisory_message) {
    return `<div class="mc-prerequisite-refusal"><h3>Legendary Action — ${action.name}</h3><p>${monsterName} ${action.advisory_message}</p></div>`;
  }
  const spell = String(action.advisory).replace(/_/g, ' ');
  return `<div class="mc-prerequisite-refusal"><h3>Legendary Action — ${action.name}</h3><p>${monsterName} casts ${spell} on itself via Spellcasting. Advisory record: the invisibility and half-Fly-Speed movement are GM-enforced (no invisibility/movement-distance consumer). ${monsterName} can't take this action again until the start of its next turn.</p></div>`;
}

export function buildLegendaryAdvisoryLog({ monsterName, action }) {
  const spell = String(action.advisory).replace(/_/g, ' ');
  const record = action?.advisory_message
    ? `${monsterName} legendary action ${action.name}: ${monsterName} ${action.advisory_message}`
    : `${monsterName} legendary action ${action.name}: casts ${spell} on itself — advisory record: invisibility and half-Fly-Speed movement are GM-enforced (no invisibility/movement-distance consumer, CLA-325).`;
  return {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: action.name,
    description: record,
    timestamp: Date.now(),
  };
}

function combatRound(cs) { return Number(cs?.round ?? 1) || 0; }
function combatActive(cs) { return cs?.activeCreatureName || ''; }

function buildLegendarySpendLog({ monsterName, actionName, activeCreature, remaining, max }) {
  return {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: actionName,
    description: `${monsterName} expends a legendary use for ${actionName} after ${activeCreature || 'another creature'}'s turn — ${remaining} of ${max} left (regain at the start of ${monsterName}'s turn; 4 in lair advisory).`,
    timestamp: Date.now(),
  };
}

function refuseLegendary({ log, campaignName, monsterName, actionName, reason }) {
  return Promise.resolve(log(campaignName, buildLegendaryRefusalLog({ monsterName, actionName, reason })))
    .then(() => ({ spent: false, remaining: null, reason, popupHtml: buildLegendaryRefusalPopup({ monsterName, actionName, reason }) }));
}

// Row-click expend: gate → spend 1 (awaited, new-object spread, MA-0005
// recipe) → round+turn latch → `ability_use` spend log. The caller then
// resolves the row's own mechanic (numeric chips roll as today, MA-0014).
// MA-0073: per-action cooldown refusal leg (complexity off expendLegendaryUse).
async function legendaryCooldownRefusal({ action, actionName, monsterName, campaignName, getRV, log }) {
  if (!action || !hasLegendaryCooldownClause(action)) return null;
  const slug = legendaryActionSlug(action.name || actionName);
  const cooldowns = getRV(monsterName, MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY) || {};
  if (!cooldowns[slug]) return null;
  await log(campaignName, buildLegendaryCooldownRefusalLog({ monsterName, actionName: action.name || actionName }));
  return { spent: false, remaining: null, reason: 'cooldown', popupHtml: buildLegendaryCooldownRefusalPopup({ monsterName, actionName: action.name || actionName }) };
}

async function stampLegendaryCooldown({ action, actionName, monsterName, campaignName, round, used, getRV, setRV }) {
  if (!action || !hasLegendaryCooldownClause(action)) return;
  const slug = legendaryActionSlug(action.name || actionName);
  const cooldowns = getRV(monsterName, MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY) || {};
  await setRV(monsterName, MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY, { ...cooldowns, [slug]: { round, usedBefore: used - 1 } }, campaignName);
}

export async function expendLegendaryUse({ monsterName, monster, actionName, campaignName, action = null, deps = {} }) {
  const getRV = deps.getRuntimeValue || getRuntimeValue;
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const log = deps.addEntry || addEntry;
  const cs = await (deps.getCombatContext || getCombatContext)(campaignName);
  const round = combatRound(cs);
  const activeCreature = combatActive(cs);

  const gate = legendaryExpendGate({
    header: legendaryHeaderAction(monster),
    storedUses: getRV(monsterName, MONSTER_LEGENDARY_USES_KEY) || {},
    round,
    activeCreatureName: activeCreature,
    monsterName,
    latch: getRV(monsterName, MONSTER_LEGENDARY_LATCH_KEY) || null,
  });
  if (!gate.allowed) return refuseLegendary({ log, campaignName, monsterName, actionName, reason: gate.reason });

  // MA-0073: per-action once-per-turn gate (after the uses/boundary economy
  // gates so the MA-0021 refusal vocabulary stays intact) — a row whose own
  // text says "can't take this action again until the start of its next
  // turn" refuses on every LATER boundary until the monster's own turn-start
  // regain clears the cooldown map.
  const cooldownRefusal = await legendaryCooldownRefusal({ action, actionName, monsterName, campaignName, getRV, log });
  if (cooldownRefusal) return cooldownRefusal;

  const stored = getRV(monsterName, MONSTER_LEGENDARY_USES_KEY) || {};
  const used = (Number(stored.used) || 0) + 1;
  await setRV(monsterName, MONSTER_LEGENDARY_USES_KEY, { max: gate.max, used }, campaignName);
  await setRV(monsterName, MONSTER_LEGENDARY_LATCH_KEY, { round, activeCreature }, campaignName);
  await stampLegendaryCooldown({ action, actionName, monsterName, campaignName, round, used, getRV, setRV });
  const remaining = Math.max(0, gate.max - used);
  await log(campaignName, buildLegendarySpendLog({ monsterName, actionName, activeCreature, remaining, max: gate.max }));
  return { spent: true, remaining, max: gate.max };
}

// Turn-start regain (monster path of the existing turnStartEffects seam —
// no stat block available there, so `max` rides the map). Resets all uses,
// clears the latch, logs `ability_use`. Silent no-op when nothing is spent.
export async function regainLegendaryUses({ monsterName, campaignName, deps = {} }) {
  const getRV = deps.getRuntimeValue || getRuntimeValue;
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const log = deps.addEntry || addEntry;

  // MA-0073: the monster's own turn-start clears per-action cooldowns even
  // when no uses are outstanding (clear only when something is stamped —
  // no spurious writes).
  const cooldowns = getRV(monsterName, MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY, campaignName);
  if (cooldowns && Object.keys(cooldowns).length > 0) {
    await setRV(monsterName, MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY, null, campaignName);
  }

  const storedUses = getRV(monsterName, MONSTER_LEGENDARY_USES_KEY, campaignName);
  const used = Number(storedUses?.used) || 0;
  const max = Number(storedUses?.max) || 0;
  if (!storedUses || used === 0) return { regained: false };

  await setRV(monsterName, MONSTER_LEGENDARY_USES_KEY, { ...storedUses, used: 0 }, campaignName);
  await setRV(monsterName, MONSTER_LEGENDARY_LATCH_KEY, null, campaignName);
  await log(campaignName, {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: 'Legendary Action Uses',
    description: `${monsterName} regains all expended legendary action uses at the start of its turn — ${max} available.`,
    timestamp: Date.now(),
  });
  return { regained: true, max };
}
