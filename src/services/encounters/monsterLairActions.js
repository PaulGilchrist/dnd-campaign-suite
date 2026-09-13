// MA-0024: minimal GM-clicked lair-action model, mirroring the landed
// legendary gated-row model (MA-0021/0022) — NOT an initiative-20 automation
// subsystem (that would be new state design; advisory residual). Structured
// lair_actions rows (monsters.json) route through the SAME interactive
// affordance pipeline as legendary rows: each click adjudicates exactly one
// effect —
//   - save_dc row   → existing save seam (handleSaveRoll): authored DC/type
//                     enforced, half-on-success damage math untouched
//                     (MV-20/MV-27), damageless failed-save conditions apply
//                     via the MA-0017 seam (Grasping Tide → Prone).
//   - advisory row  → spell-named ability_use log, GM-enforced (CLA-325
//                     precedent) — phantasmal force illusions, concentration
//                     exclusivity, 24h immunity, initiative-20 cadence and
//                     "different lair action each round" stay GM-adjudicated
//                     prose (no illusion engine / initiative lair seam).
//   - unresolvable  → refusal popup + lair_action_refused log, zero effect.
// Legacy plain-string rows (and nameless dicts, MV-24) never become
// clickable — isLairRowClickable returns false so ~600 other monsters keep
// rendering their lair rows statically.
import { canRollExpression } from '../dice/diceRoller.js';
import { addEntry } from '../ui/logService.js';

const LAIR_ADVISORY_NOTE = 'Lair actions are chosen on initiative 20 (GM-enforced — no initiative lair seam); 24-hour immunity and "a different lair action each round" are tracked by the GM.';

export function isLairRowClickable(row) {
  if (!row || typeof row !== 'object' || !row.name) return false;
  if (row.save_dc != null || row.attack_bonus != null || row.advisory) return true;
  return !!(row.damage_dice_primary && canRollExpression(row.damage_dice_primary));
}

// 'save' | 'attack' | 'damage' | 'advisory' | null (null = unresolvable).
// `advisory` is checked FIRST: a control spell's authored save stays a
// GM-adjudicated record (CLA-325) — no illusion-engine consumer exists.
export function lairRowAffordance(row) {
  if (!isLairRowClickable(row)) return null;
  if (row.advisory) return 'advisory';
  if (row.save_dc != null) return 'save';
  if (row.attack_bonus != null) return 'attack';
  if (row.damage_dice_primary && canRollExpression(row.damage_dice_primary)) return 'damage';
  return 'advisory';
}

export function buildLairRefusalPopup({ monsterName, actionName }) {
  return `<div class="mc-prerequisite-refusal"><h3>Lair Action Refused</h3><p>${monsterName} ${actionName}: no resolvable mechanic (no save, attack, or damage authored on this row). Nothing rolled. ${LAIR_ADVISORY_NOTE}</p></div>`;
}

export function buildLairRefusalLog({ monsterName, actionName }) {
  return {
    type: 'automation',
    automationType: 'lair_action_refused',
    characterName: monsterName,
    abilityName: actionName,
    description: `${monsterName} lair action ${actionName} refused — no resolvable mechanic. Zero effect. ${LAIR_ADVISORY_NOTE}`,
    timestamp: Date.now(),
  };
}

export function buildLairAdvisoryLog({ monsterName, action }) {
  const spell = String(action.advisory).replace(/_/g, ' ');
  const dcNote = action.save_dc != null ? ` (save DC ${action.save_dc} ${action.save_type || 'ability'})` : '';
  return {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: action.name,
    description: `${monsterName} lair action ${action.name}: casts ${spell}${dcNote} — advisory record: concentration/exclusivity and 24-hour immunity on a successful save or when the effect ends are GM-enforced (no illusion-engine consumer). ${LAIR_ADVISORY_NOTE}`,
    timestamp: Date.now(),
  };
}

export function buildLairAdvisoryPopup({ monsterName, action }) {
  const spell = String(action.advisory).replace(/_/g, ' ');
  const dcNote = action.save_dc != null ? ` (save DC ${action.save_dc} ${action.save_type || 'ability'})` : '';
  return `<div class="mc-prerequisite-refusal"><h3>Lair Action — ${action.name}</h3><p>${monsterName} casts ${spell}${dcNote}, no components required, concentration. ${LAIR_ADVISORY_NOTE}</p></div>`;
}

// One click = one adjudicated effect. Save rows resolve through the existing
// save seam untouched; advisory rows log the spell-named ability_use record.
export async function resolveLairRow({ action, monsterName, campaignName, setPopupHtml, handleSaveRoll, handleAttack, handleDamage, saveDamageFormula = null, saveConditions = [], deps = {} }) {
  const log = deps.addEntry || addEntry;
  const affordance = lairRowAffordance(action);
  if (!affordance) {
    setPopupHtml(buildLairRefusalPopup({ monsterName, actionName: action?.name || 'Lair Action' }));
    await log(campaignName, buildLairRefusalLog({ monsterName, actionName: action?.name || 'Lair Action' }));
    return { resolved: false, reason: 'unresolvable' };
  }
  if (affordance === 'save') {
    handleSaveRoll(action, saveDamageFormula, saveConditions);
    return { resolved: true, affordance };
  }
  if (affordance === 'attack') {
    handleAttack(action.name, action.attack_bonus, action);
    return { resolved: true, affordance };
  }
  if (affordance === 'damage') {
    handleDamage(action.name, action.damage_dice_primary, '', action);
    return { resolved: true, affordance };
  }
  setPopupHtml(buildLairAdvisoryPopup({ monsterName, action }));
  await log(campaignName, buildLairAdvisoryLog({ monsterName, action }));
  return { resolved: true, affordance };
}
