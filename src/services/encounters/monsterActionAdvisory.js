// MA-1223: normal-ACTION-category advisory affordance (Nalfeshnee "Teleport" —
// RAW pure self-relocation: no attack, no save, no dice; formerly junk
// attack_bonus:0 armed a "+0" chip that adjudicated bogus to-hit rolls vs the
// armed target and polluted lastAttack with a fabricated weaponType:"ranged").
// Generalizes the legendary advisory seam (monsterLegendaryUses.js MA-0058/
// MA-0270/0271) and the lair advisory seam (monsterLairActions.js MA-0024)
// to normal actions[] rows carrying a top-level `advisory` field: chip press =
// record-only ability_use adjudication (popup + log), ZERO rolls, ZERO
// lastAttack writes, ZERO change-data writes beyond the log entry itself —
// relocation to an unoccupied visible space ≤120 ft stays GM-enforced
// (CLA-320: no grid-position consumer app-wide). Legendary rows keep riding
// the single gated "Expend Legendary" chip (MA-0021 economy) — the chip arms
// only when no legendaryGate is present, so every existing row is byte-inert
// (§37): the only disk row in scope is nalfeshnee actions[2].
import { addEntry } from '../ui/logService.js';

export function isMonsterActionAdvisoryRow(row) {
  return !!row?.advisory;
}

export function buildMonsterActionAdvisoryPopup({ monsterName, action }) {
  const message = action?.advisory_message || `${action?.name || 'this action'} is GM-enforced (no engine consumer for this mechanic).`;
  return `<div class="mc-prerequisite-refusal"><h3>Action — ${action?.name || 'Advisory'}</h3><p>${monsterName} ${message}</p></div>`;
}

export function buildMonsterActionAdvisoryLog({ monsterName, action }) {
  const message = action?.advisory_message || `${action?.name || 'this action'} is GM-enforced (no engine consumer for this mechanic).`;
  return {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: action?.name,
    description: `${monsterName} uses ${action?.name}: ${monsterName} ${message}`,
    timestamp: Date.now(),
  };
}

// One press = one honest record. No spends, no gates to burn (the row authors
// no uses/recharge economy), no picker, no rolls.
export async function resolveMonsterActionAdvisoryRow({ action, monsterName, campaignName, setPopupHtml, deps = {} }) {
  const log = deps.addEntry || addEntry;
  setPopupHtml(buildMonsterActionAdvisoryPopup({ monsterName, action }));
  await log(campaignName, buildMonsterActionAdvisoryLog({ monsterName, action }));
  return { resolved: true };
}
