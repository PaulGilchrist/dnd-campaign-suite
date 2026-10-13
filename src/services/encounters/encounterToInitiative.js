import utils from '../ui/utils.js'
import storage from '../ui/storage.js';
import { cloneDeep } from 'lodash';
import { rollD20 } from '../dice/diceRoller.js';
import { addEntry } from '../ui/logService.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { loadCombatSummary } from './combatData.js';
import { resolveMonsterIRV } from '../npcs/monsterIrvUtils.js';

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
          const irv = resolveMonsterIRV(monster);
           creatureList.push({
              name,
              type: 'npc',
              monsterType: monster.type,
              // MN-015: size rides onto combatSummary so maneuver size gates
              // (validateSizeLimit) can enforce large_or_smaller etc.
              size: monster.size || null,
             initiative: String(rollResult.total),
             targetName: null,
             ac: typeof monster.armor_class === 'number' ? monster.armor_class : (console.error(`[AC] Monster "${name}" has no armor_class defined. Defaulting to 10.`), 10),
             resistances: irv.resistances,
             immunities: irv.immunities,
             vulnerabilities: irv.vulnerabilities,
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

    // no-timers plan T4: a new initiative roll IS a new combat — every
    // combat-scoped effect of the previous combat ends here (enforcement
    // off ⇒ zero writes). Dynamic import keeps this module graph light.
    await import('../rules/effects/zoneDurationClock.js')
        .then((m) => m.sweepNewCombatClocks(campaignName))
        .catch((e) => { console.error('[loadEncounterToInitiative:new-combat-sweep]', e); });

    const firstName = creatures[0]?.name;
    storage.set('activeCreatureName', firstName, campaignName);

    window.dispatchEvent(new CustomEvent('initiative-rolled'));

    return { combatSummary, firstName };
}

export function hasMonsterVariant(baseName, creatures) {
    const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escaped}( \\d+)?$`);
    return creatures.some(c => pattern.test(c.name));
}

export function getNextUniqueMonsterName(baseName, creatures) {
    const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactMatch = new RegExp(`^${escaped}$`).test(baseName);
    const numberedPattern = new RegExp(`^${escaped} (\\d+)$`);
    let maxNum = 0;
    let hasExact = false;
    for (const creature of creatures) {
        if (exactMatch && creature.name === baseName) {
            hasExact = true;
        }
        const match = creature.name.match(numberedPattern);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
        }
    }
    if (hasExact && maxNum === 0) {
        return `${baseName} 1`;
    }
    return `${baseName} ${maxNum + 1}`;
}

export async function addMonstersToInitiative(selectedMonsters, characters, campaignName) {
    let combatSummary = await loadCombatSummary(campaignName);
    if (!combatSummary) {
        combatSummary = { round: 1, creatures: [] };
        // no-timers T4: no prior initiative = new combat — sweep stale
        // combat-scoped clocks any earlier encounter left behind.
        await import('../rules/effects/zoneDurationClock.js')
            .then((m) => m.sweepNewCombatClocks(campaignName))
            .catch((e) => { console.error('[addMonstersToInitiative:new-combat-sweep]', e); });
    }

    const npcRollResults = [];

    selectedMonsters.forEach(monster => {
        const baseName = monster.name || 'Unnamed';
        const qty = monster.qty || 1;
        let npcHp = monster.hit_points || 10;
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
        // Number instances only when there are 2+ of this monster or the
        // tracker already carries this monster's name/series (e.g. a later
        // join continues 'Goblin 1, Goblin 2' → 'Goblin 3'). A lone monster
        // joining a tracker where its name is new keeps its plain name.
        const needsNumbering = qty > 1 || hasMonsterVariant(baseName, combatSummary.creatures);
        for (let i = 0; i < qty; i++) {
            const name = needsNumbering
                ? getNextUniqueMonsterName(baseName, combatSummary.creatures)
                : baseName;
            const rollResult = rollNpcInitiative(monster);
            const irv = resolveMonsterIRV(monster);
             combatSummary.creatures.push({
                 name,
                 type: 'npc',
                 monsterType: monster.type,
                 // MN-015: size rides onto combatSummary so maneuver size gates
                 // (validateSizeLimit) can enforce large_or_smaller etc.
                 size: monster.size || null,
                 initiative: String(rollResult.total),
                 targetName: null,
                 ac: typeof monster.armor_class === 'number' ? monster.armor_class : (console.error(`[AC] Monster "${name}" has no armor_class defined. Defaulting to 10.`), 10),
                 resistances: irv.resistances,
                 immunities: irv.immunities,
                 vulnerabilities: irv.vulnerabilities,
                 concentration: null,
                 maxHp: npcHp,
                 currentHp: npcHp,
                 saveBonuses: getMonsterSaveBonuses(monster),
                 monsterIndex: monster.index || null,
             });
            npcRollResults.push({ name, rollResult });
        }
    });

    combatSummary.creatures.sort((a, b) => b.initiative - a.initiative);

    for (const { name, rollResult } of npcRollResults) {
        logRoll(campaignName, name, rollResult);
    }

    storage.set('combatSummary', cloneDeep(combatSummary), campaignName);

    const firstName = combatSummary.creatures[0]?.name;
    storage.set('activeCreatureName', firstName, campaignName);

    window.dispatchEvent(new CustomEvent('initiative-rolled'));

    return combatSummary;
}
