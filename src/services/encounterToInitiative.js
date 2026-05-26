import utils from './utils.js'
import storage from './storage.js';
import { cloneDeep } from 'lodash';

export function expandMonstersToCreatures(selectedMonsters, characters) {
    const creatureList = [];

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
          creatureList.push({ id: utils.guid(), name, type: 'npc', initiative: '' });
        }
    });

    return creatureList;
}

export function loadEncounterToInitiative(selectedMonsters, characters, campaignName) {
    const creatures = expandMonstersToCreatures(selectedMonsters, characters);
    const combatSummary = { round: 1, creatures };

    storage.set('combatSummary', cloneDeep(combatSummary), campaignName);

    const firstId = creatures[0]?.id;
    storage.set('activeCreatureId', firstId, campaignName);

    return { combatSummary, firstId };
}
