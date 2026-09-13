// MA-0031: Recharge enforcement for monster breath-weapon rows ("Cold Breath
// (Recharge 6)"). Mirrors the finite-use tracking family (MA-0005
// monsterSpellUses / MA-0021 monsterLegendaryUses): runtime map
// `monsterRecharge` on the MONSTER-name store key, shaped
// `{ [actionKey]: { recharged: bool, threshold: n } }`. Fresh (key absent) =
// available. Fire → spent ({recharged:false}) + ability_use log; later clicks
// refuse with popup + `<action-slug>_refused (not recharged)` zero-prompt.
// At the monster's OWN turn start (turnStartEffects monster seam, MA-0021
// precedent) each spent entry rolls a real d6 via diceRoller: d6 >= threshold
// → recharged + `recharge` log "Cold Breath recharged (d6: N)"; else
// `recharge_failed` not-recharged log. Silent no-op for creatures without the
// map (no spam). No rest hooks touch monster keys (CLA-325 residual parity).
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { rollExpression } from '../dice/diceRoller.js';

export const MONSTER_RECHARGE_KEY = 'monsterRecharge';

export function rechargeActionKey(action) {
  return String(action?.name || '').replace(/\s*\(\s*recharge[^)]*\)\s*$/i, '').trim();
}

// "6" → 6, "5-6" → 5, "4-6" → 4. Unparseable → null (ungated, byte-legacy).
export function parseRechargeThreshold(recharge) {
  if (recharge == null) return null;
  const m = String(recharge).match(/(\d+)(?:\s*-\s*\d+)?/);
  return m ? Number(m[1]) : null;
}

// null for rows without a recharge value; otherwise { key, available, threshold }.
export function monsterRechargeGate(action, storedMap) {
  if (!action || action.recharge == null) return null;
  const threshold = parseRechargeThreshold(action.recharge);
  if (threshold == null) return null;
  const key = rechargeActionKey(action);
  const entry = storedMap?.[key] || null;
  return { key, threshold, available: !entry || entry.recharged !== false };
}

function refusalSlug(rechargeKey) {
  return String(rechargeKey || 'recharge').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function buildRechargeRefusalPopup({ monsterName, actionName, threshold }) {
  return `<div class="mc-recharge-refusal"><h3>Not Recharged</h3><p>${monsterName} cannot use ${actionName} — it is not recharged. Roll a d6 at the start of ${monsterName}'s next turn (${threshold || 6}+ to recharge). No save rolled, nothing spent.</p></div>`;
}

export function buildRechargeRefusalLog({ monsterName, actionName, rechargeKey, threshold }) {
  return {
    type: 'automation',
    automationType: `${refusalSlug(rechargeKey)}_refused`,
    characterName: monsterName,
    abilityName: actionName,
    description: `${monsterName} ${actionName} refused (not recharged) — requires a d6 ${threshold || 6}+ at the start of ${monsterName}'s turn. Zero spend, no save prompt.`,
    timestamp: Date.now(),
  };
}

// Fire-leg spend: stamp unavailable (single merged map write, new object —
// MA-0005 recipe) + ability_use log. Called by the caller AFTER all gates
// pass, at row click (picker-open convention, CLA-384).
export async function spendMonsterRecharge({ monsterName, action, campaignName, deps = {} }) {
  const getRV = deps.getRuntimeValue || getRuntimeValue;
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const log = deps.addEntry || addEntry;
  const gate = monsterRechargeGate(action, getRV(monsterName, MONSTER_RECHARGE_KEY) || {});
  if (!gate) return null;
  const stored = getRV(monsterName, MONSTER_RECHARGE_KEY) || {};
  await setRV(monsterName, MONSTER_RECHARGE_KEY, { ...stored, [gate.key]: { recharged: false, threshold: gate.threshold } }, campaignName);
  await log(campaignName, {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: action.name,
    description: `${monsterName} uses ${action.name} — Recharge ${action.recharge}; unavailable until a d6 ${gate.threshold}+ at the start of ${monsterName}'s next turn.`,
    timestamp: Date.now(),
  });
  return gate;
}

function spentRechargeEntries(stored) {
  if (!stored || typeof stored !== 'object') return [];
  return Object.entries(stored).filter(([, v]) => v && v.recharged === false);
}

function buildRechargeRegainLog({ monsterName, key, rolled, recharged }) {
  return {
    type: 'automation',
    automationType: recharged ? 'recharge' : 'recharge_failed',
    characterName: monsterName,
    abilityName: key,
    description: recharged
      ? `${monsterName}'s ${key} recharged (d6: ${rolled}).`
      : `${monsterName}'s ${key} not recharged (d6: ${rolled}) — rolls again at the start of ${monsterName}'s next turn.`,
    timestamp: Date.now(),
  };
}

// Turn-start recovery for the monster's own turn (turnStartEffects seam).
export async function rollMonsterRecharges({ monsterName, campaignName, deps = {} }) {
  const getRV = deps.getRuntimeValue || getRuntimeValue;
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const log = deps.addEntry || addEntry;
  const roll = deps.rollExpression || rollExpression;

  const stored = getRV(monsterName, MONSTER_RECHARGE_KEY, campaignName);
  const spent = spentRechargeEntries(stored);
  if (spent.length === 0) return { rolled: false };

  const next = { ...stored };
  const outcomes = [];
  for (const [key, entry] of spent) {
    const rolled = roll('1d6')?.total ?? null;
    if (rolled == null) {
      console.error(`[monsterRecharge] d6 roll failed for ${monsterName} ${key}`);
      continue;
    }
    const recharged = rolled >= (Number(entry.threshold) || 6);
    next[key] = { ...entry, recharged };
    outcomes.push({ key, rolled, recharged });
    await log(campaignName, buildRechargeRegainLog({ monsterName, key, rolled, recharged }));
  }
  await setRV(monsterName, MONSTER_RECHARGE_KEY, next, campaignName);
  return { rolled: true, outcomes };
}
