import utils from '../ui/utils.js'
import storage from '../ui/storage.js';
import { cloneDeep } from 'lodash';
import { rollD20 } from '../dice/diceRoller.js';
import { addEntry } from '../ui/logService.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { loadCombatSummary, setCombatSummaryCache } from './combatData.js';
import { resolveMonsterIRV } from '../npcs/monsterIrvUtils.js';
import { monsterSpeedToFeet } from '../combat/turnState.js';
import { clearAllPendingOas } from '../combat/pendingOpportunityAttacks.js';
import { sweepNewCombatClocks } from '../rules/effects/zoneDurationClock.js';

export function getMonsterSaveBonuses(monster) {
  const map = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
  const bonuses = {};
  // OUTPUT contract: exactly six lowercase-abbreviation keys (CLA-303) —
  // hardcoded readers (applyDamage, sleepHandler, npcStatBlockUtils,
  // npcClickFormHandlers round-trip) all key off this shape; saveType
  // callers normalize to it via normalizeSaveType(). INPUT saving_throws
  // rows are split-shape on disk (58 rows 'dex', 16 rows 'dexterity' —
  // e.g. Adult Blue Dracolich): read both so a real save modifier is never
  // silently replaced by the raw ability modifier.
  for (const [abbr, full] of Object.entries(map)) {
    const saves = monster.saving_throws?.[abbr] ?? monster.saving_throws?.[full.toLowerCase()];
    if (saves?.modifier != null) {
      bonuses[abbr] = saves.modifier;
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

// EB join fan-out disclosure (party-alive model): joining an encounter seeds
// EVERY saved PC onto the initiative board as a type:player combatant (the
// campaign-select seed plus the Initiative mount merge keep the whole party
// present). The board silently growing by a dozen rows confused GMs — write
// ONE automation row naming the fan-out and its size. Counted off the
// accepted board (PC entries matching a saved character), so a failed join
// logs nothing (same post-ack contract as the initiative-roll rows) and a
// join with no saved party writes no row at all.
function logPartyFanOut(campaignName, combatSummary, characters) {
    const boardPlayers = new Set(
        combatSummary.creatures.filter(c => c.type === 'player').map(c => c.name));
    const memberCount = characters.reduce(
        (count, character) => count + (boardPlayers.has(utils.getName(character.name)) ? 1 : 0),
        0);
    if (memberCount === 0) return;
    addEntry(campaignName, {
        type: 'automation',
        automationType: 'party_joined_initiative',
        characterName: 'Party',
        description: `Party joined initiative (${memberCount} members) — the saved PC party is seeded onto the tracker with the encounter.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[encounterToInitiative] Error:', e); });
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
              // Movement-budget parity: the authored walk speed (feet) rides
              // onto the row so the economy strip denominator and any budget
              // consumer read the creature's real speed, not the 30 ft default.
              speed: monsterSpeedToFeet(monster),
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
    // off ⇒ zero writes).
    await sweepNewCombatClocks(campaignName)
        .catch((e) => { console.error('[loadEncounterToInitiative:new-combat-sweep]', e); });

    const firstName = creatures[0]?.name;
    storage.set('activeCreatureName', firstName, campaignName);

    // Pending-OA drop law: a new initiative roll retires every pending trigger
    // marker (the old provocation no longer stands; the spent reaction is NOT
    // refunded). Written at the PRODUCER because this lane dispatches
    // `initiative-rolled` from the Encounters page while the Initiative view —
    // the event's only listener — is unmounted (bug-new-initiative-roll-
    // pendingoa-drop-never-fires), so the event alone could never reach it. Same
    // new-combat seam as the sweepNewCombatClocks call above; it is a shared
    // runtime-store DELETE, so the null echo evicts the bucket in every tab.
    // Zero writes when nothing is pending.
    clearAllPendingOas(campaignName);

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

// Series renumbering law (owner decision 2026-11-09): once a SECOND creature of
// the same species joins, the whole series must be numbered — a plain row may
// never coexist with suffixed rows after a join ('Kobold' next to 'Kobold 1'
// made cards/log rows ambiguous about which was which). This renames a legacy
// plain row to the lowest free number in its series BEFORE new instances draw
// their names, so the join's getNextUniqueMonsterName calls naturally land on
// 'Kobold 2', 'Kobold 3', … and a third-or-later join that finds a re-appeared
// plain row re-normalizes it the same way.
// Renaming changes ONLY `name`: initiative/HP/AC/controller/away/monsterIndex/
// size and array position are row-local and survive untouched (the join's
// existing initiative sort stays the only reorderer). PC rows are never
// renamed (player rows are skipped), and '+NPC' placeholders are safe: their
// names are always 'NPC N', never the plain base name a candidate needs.
export function normalizeMonsterSeries(baseName, creatures) {
    const plainRow = creatures.find(c => c.type !== 'player' && c.name === baseName);
    if (!plainRow) return false;
    const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const seriesNumber = new RegExp(`^${escaped} (\\d+)$`);
    const used = new Set(creatures
        .filter(c => c !== plainRow)
        .map(c => c.name.match(seriesNumber)?.[1])
        .filter(Boolean));
    let next = 1;
    while (used.has(String(next))) next += 1;
    plainRow.name = `${baseName} ${next}`;
    return true;
}

export async function addMonstersToInitiative(selectedMonsters, characters, campaignName) {
    // Strict read (bug-eb-join-swallowed-network-fail-phantom-row): a failed
    // READ must surface as an error, never be conflated with "no combat" —
    // otherwise a GET blip + successful POST would silently REPLACE a live
    // initiative board with just the joining monsters for every player.
    let combatSummary = await loadCombatSummary(campaignName, { strict: true });
    // A missing OR creature-less summary (e.g. a corrupted `{}` in the store)
    // is exactly a new combat — same self-heal seam as the Initiative mount
    // guard (Initiative.jsx `initialSummary && initialSummary.creatures`).
    // Without the Array check a `{}` store crashed below at
    // `combatSummary.creatures.some(...)` (TypeError reading 'some').
    if (!combatSummary || !Array.isArray(combatSummary.creatures)) {
        combatSummary = { round: 1, creatures: [] };
        // no-timers T4: no prior initiative = new combat — sweep stale
        // combat-scoped clocks any earlier encounter left behind.
        await sweepNewCombatClocks(campaignName)
            .catch((e) => { console.error('[addMonstersToInitiative:new-combat-sweep]', e); });
    } else {
        // Join onto a COPY: loadCombatSummary cached the shared object for
        // sync readers (getCombatSummary). Mutating it in place left a
        // phantom joined row in every reader's view when the board write
        // below later failed. The cache is refreshed only on ack (below).
        combatSummary = cloneDeep(combatSummary);
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
        // Series-renumber law (owner 2026-11-09): a plain row may never
        // coexist with suffixed rows after a join, so rename a legacy plain
        // row ('Kobold' → 'Kobold 1') BEFORE the new instances draw their
        // names below. Unconditional is equivalent to gating on
        // needsNumbering: the helper only acts when the plain row exists,
        // which already forces needsNumbering true.
        normalizeMonsterSeries(baseName, combatSummary.creatures);
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
                 // Movement-budget parity (see expandMonstersToCreatures): the
                 // authored walk speed rides onto the joined row.
                 speed: monsterSpeedToFeet(monster),
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

    // Authoritative board write (bug-eb-join-swallowed-network-fail-phantom-row):
    // storage.set('combatSummary') resolves TRUE only when the server acked.
    // A rejected write must THROW before the rolls/event below, so
    // handleJoinEncounter's catch shows the failure toast, suppresses the
    // `joined` log row, and keeps the draft — no log/board divergence.
    // (`false` is the honest-failure signal; legacy mocks resolving
    // undefined keep the historical success semantics.)
    const saved = await storage.set('combatSummary', cloneDeep(combatSummary), campaignName);
    if (saved === false) {
        throw new Error('combatSummary board write failed — the server never received the joined creatures');
    }
    // Board accepted — publish the joined truth to sync cache readers.
    setCombatSummaryCache(combatSummary, campaignName);

    // Initiative rolls join the durable log only AFTER the board accepted
    // (same contract as the `joined` row above — a failed join must leave
    // zero phantom rows behind).
    for (const { name, rollResult } of npcRollResults) {
        logRoll(campaignName, name, rollResult);
    }

    // One disclosure row for the silent PC-party fan-out (see helper).
    logPartyFanOut(campaignName, combatSummary, characters);

    const firstName = combatSummary.creatures[0]?.name;
    await storage.set('activeCreatureName', firstName, campaignName);

    // Pending-OA drop law (see loadEncounterToInitiative): the join re-rolls
    // initiative and re-anchors the active creature, so every pending trigger
    // marker retires here. Producer-side because the Initiative listener is
    // unmounted on this lane. Unconditional, matching the dispatch below (the
    // mounted listener dropped markers on a mid-round join too) — NOT gated on
    // the new-board branch the clock sweep above uses.
    clearAllPendingOas(campaignName);

    window.dispatchEvent(new CustomEvent('initiative-rolled'));

    return combatSummary;
}
