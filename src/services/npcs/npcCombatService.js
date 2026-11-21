import { npcHasStatBlock, npcHasAttacks, resolveNPCHitPoints } from '../encounters/npcStatBlockUtils.js';
import { rollD20 } from '../dice/diceRoller.js';
import { loadCombatSummary } from '../encounters/combatData.js';
import { clearAllPendingOas } from '../combat/pendingOpportunityAttacks.js';
import utils from '../ui/utils.js';
import storage from '../ui/storage.js';

// Returns 'added' | 'already' | 'needs-weapon'. Throws if the NPC lacks the
// combat stats (AC + HP) the tracker needs to run them.
//
// 'needs-weapon' is a ZERO-WRITE refusal: an attack-less NPC never joins
// silently and never pays a native window.confirm (backlog 2026-11-17 EG —
// the old OK/Cancel prompt had INVERTED semantics against the button labels).
// The refusal routes to the HOST, which arms the in-app
// NpcUnarmedConfirmModal (shared DeleteConfirmModal tier, honest `Add anyway`
// / `Cancel` buttons); "Add anyway" re-invokes this function with
// { addUnarmed: true } and the join proceeds exactly as the old proceed path
// did (Unarmed Strike fallback — the creature record and log row are
// unchanged). Cancel closes the modal inert: this service is never re-run.
export async function addNPCToInitiative(campaignName, npc, onViewInitiative, { addUnarmed = false } = {}) {
  if (!npcHasStatBlock(npc)) {
    throw new Error(`"${npc?.name}" needs AC and HP filled in (Stats tab) before joining initiative.`);
  }

  const initBonus = parseInt(npc.initiativeBonus) || 0;
  let combatSummary = await loadCombatSummary(campaignName);
  if (!combatSummary) {
    combatSummary = { round: 1, creatures: [] };
  }

  const alreadyAdded = combatSummary.creatures.some(
    c => c.type === 'npc' && c.name === npc.name
  );
  if (alreadyAdded) {
    if (onViewInitiative) onViewInitiative();
    return 'already';
  }

  if (!npcHasAttacks(npc) && !addUnarmed) {
    return 'needs-weapon';
  }

  const roll = rollD20();
  const total = roll + initBonus;
  // Dice-formatted HP ("9 (2d8)") joins at its resolved total, never NaN.
  const maxHp = resolveNPCHitPoints(npc.hitPoints);

  combatSummary.creatures.push(buildNPCCreature(npc, total, maxHp, initBonus));

  combatSummary.creatures.sort((a, b) => b.initiative - a.initiative);
  storage.set('combatSummary', combatSummary, campaignName);
  // Pending-OA drop law: joining an NPC re-rolls initiative and re-sorts the
  // board, so every pending trigger marker retires here. Written at the PRODUCER
  // because this lane dispatches `initiative-rolled` from the NPCs page while the
  // Initiative view — the event's only listener — is unmounted
  // (bug-new-initiative-roll-pendingoa-drop-never-fires). It is a shared
  // runtime-store DELETE, so the null echo evicts the bucket in every tab.
  // Zero writes when nothing is pending.
  clearAllPendingOas(campaignName);
  window.dispatchEvent(new CustomEvent('initiative-rolled'));

  logInitiativeRoll(campaignName, npc.name, roll, initBonus);

  if (onViewInitiative) onViewInitiative();
  return 'added';
}

// The canonical initiative creature record (exact-bytes pinned by
// npcCombatService.test.js) — hoisted so the join lane stays under the
// complexity cap.
function buildNPCCreature(npc, total, maxHp, initBonus) {
  return {
    name: npc.name,
    type: 'npc',
    monsterType: npc.type,
    initiative: String(total),
    targetName: null,
    ac: npc.armorClass,
    resistances: npc.damageResistances || [],
    immunities: npc.damageImmunities || [],
    concentration: null,
    imagePath: npc.imagePath || npc.image || '',
    initiativeBonus: initBonus,
    maxHp,
    currentHp: maxHp,
    saveBonuses: {},
  };
}

function logInitiativeRoll(campaignName, characterName, roll, initBonus) {
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'roll',
      characterName,
      rollType: 'initiative',
      name: 'Initiative',
      rolls: [roll],
      total: roll,
      bonus: initBonus,
      mode: 'normal',
      isNatural20: roll === 20,
      isNatural1: roll === 1,
      // POST-lane gate (server/routes/log.js) requires readable text; this lane
      // bypasses logService.addEntry, so it stamps its own audit message.
      message: `${characterName} rolls initiative: ${roll} (${initBonus >= 0 ? '+' : ''}${initBonus})`,
      timestamp: Date.now(),
      id: utils.guid(),
    }),
  }).catch((e) => { console.error("[npcCombatService] Error:", e); });
}
