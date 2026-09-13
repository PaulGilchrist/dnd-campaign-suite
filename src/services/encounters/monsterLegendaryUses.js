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

export const MONSTER_LEGENDARY_USES_KEY = 'monsterLegendaryUses';
export const MONSTER_LEGENDARY_LATCH_KEY = '_legendaryUses_usedRound';

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

export function buildLegendaryRefusalPopup({ monsterName, actionName, reason }) {
  const why = reason === 'exhausted'
    ? `${monsterName} has no legendary uses left — they regain at the start of ${monsterName}'s turn.`
    : reason === 'turn'
      ? `Only one legendary action can be expended immediately after each creature's turn.`
      : reason === 'own-turn'
        ? `${monsterName} expends legendary uses after ANOTHER creature's turn, not its own.`
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
export async function expendLegendaryUse({ monsterName, monster, actionName, campaignName, deps = {} }) {
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

  const stored = getRV(monsterName, MONSTER_LEGENDARY_USES_KEY) || {};
  const used = (Number(stored.used) || 0) + 1;
  await setRV(monsterName, MONSTER_LEGENDARY_USES_KEY, { max: gate.max, used }, campaignName);
  await setRV(monsterName, MONSTER_LEGENDARY_LATCH_KEY, { round, activeCreature }, campaignName);
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
