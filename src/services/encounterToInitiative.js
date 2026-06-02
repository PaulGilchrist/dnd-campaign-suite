import utils from './utils.js'
import { getRuntimeValue } from '../hooks/useRuntimeState.js';
import storage from './storage.js';
import { cloneDeep } from 'lodash';
import { rollD20 } from './diceRoller.js';
import { computePlayerAc } from './damageUtils.js';

function getCharacterSaveBonuses(character) {
  const abilities = character.abilities || [];
  const getBonus = (name) => {
    const ab = abilities.find(a => a.name === name);
    return ab?.save ?? ab?.bonus ?? 0;
  };
  return {
    str: getBonus('Strength'),
    dex: getBonus('Dexterity'),
    con: getBonus('Constitution'),
    int: getBonus('Intelligence'),
    wis: getBonus('Wisdom'),
    cha: getBonus('Charisma'),
  };
}

function getMonsterSaveBonuses(monster) {
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

export async function expandMonstersToCreatures(selectedMonsters, characters, _campaignName) {
    const creatureList = [];
    const npcRollResults = [];

    const playerChars = await Promise.all(characters.map(async (character) => {
      const maxHp = character.hitPoints || 0;
      const currentHp = getRuntimeValue(character.name, 'currentHitPoints') ?? maxHp;
      const storedMaxHp = getRuntimeValue(character.name, 'hitPoints');
      return {
        name: utils.getName(character.name),
        type: 'player',
        imagePath: character.imagePath || '',
        initiative: '',
        targetName: null,
        ac: await computePlayerAc(character),
        resistances: character.resistances || [],
        immunities: character.immunities || [],
        concentration: null,
        maxHp: storedMaxHp ?? maxHp,
        currentHp: currentHp,
        saveBonuses: getCharacterSaveBonuses(character),
      };
      }));
    playerChars.sort((a, b) => a.name.localeCompare(b.name));
    creatureList.push(...playerChars);

    selectedMonsters.forEach(monster => {
      const baseName = monster.name || 'Unnamed';
      const qty = monster.qty || 1;
      const npcHp = monster.hit_points || 10;
      for (let i = 0; i < qty; i++) {
          const name = qty === 1 ? baseName : `${baseName} ${i + 1}`;
          const rollResult = rollNpcInitiative(monster);
          creatureList.push({
            name,
            type: 'npc',
            initiative: String(rollResult.total),
            targetName: null,
            ac: monster.armor_class || 10,
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
