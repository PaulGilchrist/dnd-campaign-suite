import utils from '../ui/utils.js'
import storage from '../ui/storage.js';
import { cloneDeep } from 'lodash';
import { rollD20 } from '../dice/diceRoller.js';
import { addEntry } from '../ui/logService.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

export function getMonsterSaveBonuses(monster) {
  const map = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
  const bonuses = {};
  for (const [abbr] of Object.entries(map)) {
    if (monster.saving_throws?.[abbr]?.modifier != null) {
      bonuses[abbr] = monster.saving_throws[abbr].modifier;
    } else if (monster.ability_score_modifiers?.[abbr] != null) {
      bonuses[abbr] = monster.ability_score_modifiers[abbr];
    } else {
      bonuses[abbr] = 0;
    }
  }
  return bonuses;
}

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
    addEntry(campaignName, {
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
     }).catch((e) => { console.error("[encounterToInitiative] Error:", e); });
}

export async function expandMonstersToCreatures(selectedMonsters, characters, _campaignName) {
    const creatureList = [];
    const npcRollResults = [];

    // Player creatures in combatSummary are minimal by design.
    // Single source of truth for player stats (AC, HP, resistances, etc.) is
    // character.computedStats (playerStats), resolved at read time — NOT stored here.
    const playerChars = await Promise.all(characters.map(async (character) => {
      return {
        name: utils.getName(character.name),
        type: 'player',
        initiative: '',
        targetName: null,
        concentration: null,
      };
      }));
    playerChars.sort((a, b) => a.name.localeCompare(b.name));
    creatureList.push(...playerChars);

    selectedMonsters.forEach(monster => {
      const baseName = monster.name || 'Unnamed';
      const qty = monster.qty || 1;
      let npcHp = monster.hit_points || 10;
      // Phantasmal Creatures: halve HP for Bestial Spirit and Fey Spirit
      const isPhantasmalSummon = ['Bestial Spirit', 'Fey Spirit'].includes(baseName);
      if (isPhantasmalSummon) {
        for (const character of characters) {
          const phantasmalList = getRuntimeValue(character.name, '_phantasmalCreatures_list');
          if (phantasmalList && Array.isArray(phantasmalList) && phantasmalList.includes(baseName)) {
            npcHp = Math.floor(npcHp / 2);
            break;
          }
        }
      }
      for (let i = 0; i < qty; i++) {
          const name = qty === 1 ? baseName : `${baseName} ${i + 1}`;
          const rollResult = rollNpcInitiative(monster);
          creatureList.push({
            name,
            type: 'npc',
            initiative: String(rollResult.total),
            targetName: null,
            ac: typeof monster.armor_class === 'number' ? monster.armor_class : (console.error(`[AC] Monster "${name}" has no armor_class defined. Defaulting to 10.`), 10),
            resistances: monster.damage_resistances || [],
            immunities: monster.damage_immunities || [],
            concentration: null,
            maxHp: npcHp,
            currentHp: npcHp,
            saveBonuses: getMonsterSaveBonuses(monster),
          });
          npcRollResults.push({ name, rollResult });
          }
      });

    return { creatures: creatureList, npcRollResults };
}

export async function loadEncounterToInitiative(selectedMonsters, characters, campaignName) {
    const { creatures, npcRollResults } = await expandMonstersToCreatures(selectedMonsters, characters, campaignName);
    creatures.sort((a, b) => b.initiative - a.initiative);

    for (const { name, rollResult } of npcRollResults) {
        logRoll(campaignName, name, rollResult);
     }

    const combatSummary = { round: 1, creatures };

    storage.set('combatSummary', cloneDeep(combatSummary), campaignName);

    const firstName = creatures[0]?.name;
    storage.set('activeCreatureName', firstName, campaignName);

    window.dispatchEvent(new CustomEvent('initiative-rolled'));

    return { combatSummary, firstName };
}
