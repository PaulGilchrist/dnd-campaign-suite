import utils from './utils.js'
import storage from './storage.js';
import { cloneDeep } from 'lodash';
import { rollD20 } from './diceRoller.js';

function parseInitBonus(monster) {
    const initStr = monster.initiative_details;
    if (!initStr) return 0;
    const match = initStr.match(/^([+-]\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

function rollNpcInitiative(monster) {
    const bonus = parseInitBonus(monster);
    const r1 = rollD20();
    const r2 = rollD20();
    const total = r1 + bonus;
    return { roll: r1, total, rolls: [r1, r2], bonus };
}

function logRoll(campaignName, name, rollResult) {
    fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'roll',
            characterName: name,
            rollType: 'initiative',
            name: 'Initiative',
            rolls: rollResult.rolls,
            total: rollResult.roll,
            bonus: rollResult.bonus,
            mode: 'normal',
            isNatural20: rollResult.roll === 20,
            isNatural1: rollResult.roll === 1
         })
     }).catch(() => {});
}

export function expandMonstersToCreatures(selectedMonsters, characters) {
    const creatureList = [];
    const npcRollResults = [];

    const playerChars = characters.map((character) => {
      return { id: utils.guid(), name: utils.getFirstName(character.name), type: 'player', imagePath: character.imagePath || '', initiative: '' };
      });
    playerChars.sort((a, b) => a.name.localeCompare(b.name));
    creatureList.push(...playerChars);

    selectedMonsters.forEach(monster => {
      const baseName = monster.name || 'Unnamed';
      const qty = monster.qty || 1;
      for (let i = 0; i < qty; i++) {
          const name = qty === 1 ? baseName : `${baseName} ${i + 1}`;
          const rollResult = rollNpcInitiative(monster);
          creatureList.push({ id: utils.guid(), name, type: 'npc', initiative: String(rollResult.total) });
          npcRollResults.push({ name, rollResult });
          }
      });

    return { creatures: creatureList, npcRollResults };
}

export function loadEncounterToInitiative(selectedMonsters, characters, campaignName) {
    const { creatures, npcRollResults } = expandMonstersToCreatures(selectedMonsters, characters);
    creatures.sort((a, b) => b.initiative - a.initiative);

    for (const { name, rollResult } of npcRollResults) {
        logRoll(campaignName, name, rollResult);
     }

    const combatSummary = { round: 1, creatures };

    storage.set('combatSummary', cloneDeep(combatSummary), campaignName);

    const firstId = creatures[0]?.id;
    storage.set('activeCreatureId', firstId, campaignName);

    window.dispatchEvent(new CustomEvent('initiative-rolled'));

    return { combatSummary, firstId };
}
