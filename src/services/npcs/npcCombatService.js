import { npcHasStatBlock } from '../encounters/npcStatBlockUtils.js';
import { rollD20 } from '../dice/diceRoller.js';
import { loadCombatSummary } from '../encounters/combatData.js';
import utils from '../ui/utils.js';
import storage from '../ui/storage.js';

export async function addNPCToInitiative(campaignName, npc, onViewInitiative) {
  if (!npcHasStatBlock(npc)) return;

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
    return;
  }

  const roll = rollD20();
  const total = roll + initBonus;

  combatSummary.creatures.push({
    name: npc.name,
    type: 'npc',
    initiative: String(total),
    targetName: null,
    ac: typeof npc.armorClass === 'number'
      ? npc.armorClass
      : (console.error(`[AC] NPC "${npc.name}" has no AC defined. Defaulting to 10.`), 10),
    resistances: npc.damageResistances || [],
    immunities: npc.damageImmunities || [],
    conditions: [],
    concentration: null,
    imagePath: npc.imagePath || npc.image || '',
    initiativeBonus: initBonus,
    maxHp: Number(npc.hitPoints) || 10,
    currentHp: Number(npc.hitPoints) || 10,
    saveBonuses: {},
  });

  combatSummary.creatures.sort((a, b) => b.initiative - a.initiative);
  storage.set('combatSummary', combatSummary, campaignName);
  window.dispatchEvent(new CustomEvent('initiative-rolled'));

  logInitiativeRoll(campaignName, npc.name, roll, initBonus);

  if (onViewInitiative) onViewInitiative();
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
  }).catch(() => {});
}
