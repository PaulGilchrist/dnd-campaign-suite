import { npcHasStatBlock, npcHasAttacks, resolveNPCHitPoints } from '../encounters/npcStatBlockUtils.js';
import { rollD20 } from '../dice/diceRoller.js';
import { loadCombatSummary } from '../encounters/combatData.js';
import utils from '../ui/utils.js';
import storage from '../ui/storage.js';

// Returns 'added' | 'already' | 'needs-weapon'. Throws if the NPC lacks the
// combat stats (AC + HP) the tracker needs to run them.
export async function addNPCToInitiative(campaignName, npc, onViewInitiative) {
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

  if (!npcHasAttacks(npc)) {
    const provideWeapon = window.confirm(
      `${npc.name} has no weapons or attacks. Give them at least one weapon before adding them to initiative?\n\n` +
      'Choose Cancel to add them anyway — they will fight with an Unarmed Strike.'
    );
    if (provideWeapon) return 'needs-weapon';
  }

  const roll = rollD20();
  const total = roll + initBonus;
  // Dice-formatted HP ("9 (2d8)") joins at its resolved total, never NaN.
  const maxHp = resolveNPCHitPoints(npc.hitPoints);

  combatSummary.creatures.push({
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
  });

  combatSummary.creatures.sort((a, b) => b.initiative - a.initiative);
  storage.set('combatSummary', combatSummary, campaignName);
  window.dispatchEvent(new CustomEvent('initiative-rolled'));

  logInitiativeRoll(campaignName, npc.name, roll, initBonus);

  if (onViewInitiative) onViewInitiative();
  return 'added';
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
      timestamp: Date.now(),
      id: utils.guid(),
    }),
  }).catch((e) => { console.error("[npcCombatService] Error:", e); });
}
