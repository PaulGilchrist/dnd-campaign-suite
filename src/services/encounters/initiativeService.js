import { rollD20 } from '../dice/diceRoller.js'
import { getMonsterData, getMonsterImageUrl } from '../npcs/monsterUtils.js'
import { resolveMonsterIRV } from '../npcs/monsterIrvUtils.js'
import { getMonsterSaveBonuses } from './encounterToInitiative.js'
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { isCreaturePresent, sortCreaturesForBoard } from '../combat/creaturePresence.js'

function parseInitBonus(monster) {
    const initStr = monster.initiative_details
    if (!initStr) return 0
    const match = initStr.match(/^([+-]\d+)/)
    return match ? parseInt(match[1], 10) : 0
}

function setupCreatures(characters, npcCount, getName) {
    const creatureList = characters.map((character) => {
        return {
            name: getName(character.name),
            type: 'player',
            initiative: '',
            targetName: null,
            concentration: null,
        }
    })
    creatureList.sort((a, b) => a.name.localeCompare(b.name))
    for (let i = 0; i < npcCount; i++) {
        creatureList.push({
            name: `NPC ${i + 1}`,
            type: 'npc',
            initiative: '',
            targetName: null,
            ac: 10,
            resistances: [],
            immunities: [],
            concentration: null,
            maxHp: 10,
            currentHp: 10,
            saveBonuses: {},
        })
    }
    return creatureList
}

// bug-initiative-clear-monsters-become-npc-stubs: Clear must remove EVERY monster
// from the board (per its own confirm copy). Only untouched "+ NPC" placeholders —
// auto-named "NPC N" with no bestiary binding — may survive the reset. EB-joined
// monsters and summons carry monsterIndex (and/or a species name), so they never
// match here and can no longer resurrect as anonymous NPC stubs.
function isBareNpcPlaceholder(creature) {
    return creature.type === 'npc' && !creature.monsterIndex && /^NPC \d+$/.test(creature.name || '')
}

function addNpc(combatSummary) {
    const maxNpcNum = combatSummary.creatures
        .filter(c => c.type === 'npc')
        .reduce((max, c) => {
            const match = c.name.match(/^NPC (\d+)$/)
            return match ? Math.max(max, parseInt(match[1])) : max
        }, 0)
    const nextNum = maxNpcNum + 1
    combatSummary.creatures.push({
        name: `NPC ${nextNum}`,
        type: 'npc',
        initiative: '',
        targetName: null,
        ac: 10,
        resistances: [],
        immunities: [],
        concentration: null,
        maxHp: 10,
        currentHp: 10,
        saveBonuses: {},
    })
    return nextNum
}

function removeNpc(combatSummary, creatureName) {
    combatSummary.creatures = combatSummary.creatures.filter(c => c.name !== creatureName)
}

// ── Split-party presence ────────────────────────────────────────────────────
// The `away` flag semantics live in services/combat/creaturePresence.js
// (own module: component tests partial-mock this service, and consumers of
// the predicate must always get the real one). Navigation below skips away
// rows; the mount merge parks them at the back via sortCreaturesForBoard.

// Split-party law: navigation walks only PRESENT creatures. When the active
// creature itself is away or unknown (GM split mid-its-turn), the seam moves
// to its nearest present neighbour WITHOUT a round increment — the round was
// never completed. A fully degenerate board (nobody present) falls back to
// the legacy full-list walk so the tracker never stalls on `undefined`.
function getNextCreatureName(combatSummary, activeCreatureName) {
    const all = combatSummary.creatures
    const present = all.filter(isCreaturePresent)
    const list = present.length ? present : all
    const idx = list.findIndex(c => c.name === activeCreatureName)
    if (idx === -1) {
        const allIdx = all.findIndex(c => c.name === activeCreatureName)
        const neighbour = (allIdx >= 0 ? all.slice(allIdx + 1) : []).find(isCreaturePresent)
        return { newActiveName: (neighbour || list[0]).name, roundIncrement: false }
    }
    if (idx < list.length - 1) {
        return { newActiveName: list[idx + 1].name, roundIncrement: false }
    }
    return { newActiveName: list[0].name, roundIncrement: true }
}

function getPreviousCreatureName(combatSummary, activeCreatureName) {
    const all = combatSummary.creatures
    const present = all.filter(isCreaturePresent)
    const list = present.length ? present : all
    const idx = list.findIndex(c => c.name === activeCreatureName)
    if (idx === -1) {
        const allIdx = all.findIndex(c => c.name === activeCreatureName)
        const neighbour = (allIdx >= 0 ? all.slice(0, allIdx) : all).filter(isCreaturePresent).pop()
        return { newActiveName: (neighbour || list[list.length - 1]).name, roundDecrement: false }
    }
    if (idx > 0) {
        return { newActiveName: list[idx - 1].name, roundDecrement: false }
    }
    return { newActiveName: list[list.length - 1].name, roundDecrement: true }
}

function isPreviousDisabled(combatSummary, activeCreatureName) {
    if (!combatSummary) return false
    const firstPresent = combatSummary.creatures.find(isCreaturePresent)
    return activeCreatureName === firstPresent?.name && combatSummary.round === 1
}

// Stamp a GM-entered initiative onto the row and re-sort the board. Split-party
// law (creaturePresence.js): an away row holds no slot, so stamping one is
// refused outright (the card input is already disabled — this keeps the service
// honest for any caller, bug-away-card-initiative-input-resurrects-slot), and
// the re-sort goes through sortCreaturesForBoard (present-first, away-last)
// instead of the legacy raw initiative sort that could un-park an away row to
// mid-board (same law as the mount-merge lane below).
function setInitiative(combatSummary, creatureName, value) {
    const creature = combatSummary.creatures.find(c => c.name === creatureName)
    if (!creature || !isCreaturePresent(creature)) return
    creature.initiative = value
    sortCreaturesForBoard(combatSummary)
}

function rollNpcInitiative(combatSummary, creatureName) {
    const creature = combatSummary.creatures.find(c => c.name === creatureName)
    if (!creature || creature.type !== 'npc') return null
    const bonus = creature.initiativeBonus || 0
    const roll = rollD20()
    const total = roll + bonus
    creature.initiative = String(total)
    sortCreaturesForBoard(combatSummary)
    return { roll, bonus, total }
}

// Phantasmal Creatures: halve HP for Bestial Spirit and Fey Spirit when summoned via the feature
// Check all player creatures for phantasmal tracking
function resolvePhantasmalHp(combatSummary, creature, hp) {
    if (!['Bestial Spirit', 'Fey Spirit'].includes(creature.name)) return hp
    for (const pc of combatSummary.creatures) {
        if (pc.type !== 'player') continue
        const phantasmalList = getRuntimeValue(pc.name, '_phantasmalCreatures_list')
        if (Array.isArray(phantasmalList) && phantasmalList.includes(creature.name)) {
            return Math.floor(hp / 2)
        }
    }
    return hp
}

async function applyNpcMonsterData(combatSummary, creatureIndex, monster, campaignNpcs) {
    const creature = combatSummary.creatures[creatureIndex]
    if (!creature) return
    creature.ac = typeof monster.armor_class === 'number'
        ? monster.armor_class
        : (console.error(`[AC] Monster "${creature.name}" has no armor_class defined. Defaulting to 10.`), 10)
    const irv = resolveMonsterIRV(monster)
    creature.resistances = irv.resistances
    creature.immunities = irv.immunities
    creature.vulnerabilities = irv.vulnerabilities
    creature.initiativeBonus = monster.initiative_details ? parseInt(monster.initiative_details) || 0 : 0
    const hp = resolvePhantasmalHp(combatSummary, creature, monster.hit_points || 10)
    creature.maxHp = hp
    creature.currentHp = hp
    creature.saveBonuses = getMonsterSaveBonuses(monster)
    // MN-015: keep size in sync with monster data so maneuver size gates work on +NPC creatures.
    creature.size = monster.size || creature.size
    // CLA-303: keep monsterType in sync with monster data so Turn Undead
    // eligibility resolves without a client-side name lookup.
    creature.monsterType = monster.type || creature.monsterType
    const matchedNpc = campaignNpcs.find(n => n.name?.toLowerCase() === creature.name.toLowerCase())
    if (matchedNpc?.imagePath) {
        creature.imagePath = matchedNpc.imagePath
    }
}

async function renameNpc({ combatSummary, oldName, newName, campaignNpcs, setNpcImages, campaignName }) {
    const idx = combatSummary.creatures.findIndex(c => c.name === oldName)
    if (idx === -1) return
    combatSummary.creatures[idx].name = newName
    const monster = await getMonsterData(newName, campaignNpcs)
    if (monster) {
        await applyNpcMonsterData(combatSummary, idx, monster, campaignNpcs)
    }
    if (setNpcImages) {
        const url = await getMonsterImageUrl(newName, campaignNpcs, campaignName)
        setNpcImages(prev => {
            const next = { ...prev }
            delete next[oldName]
            next[newName] = url
            return next
        })
    }
}

function setTarget(combatSummary, creatureName, targetName) {
    const idx = combatSummary.creatures.findIndex(c => c.name === creatureName)
    if (idx === -1) return
    combatSummary.creatures[idx].targetName = targetName || null
}

function clearCombat(characters, npcCount, getName) {
    const creatures = setupCreatures(characters, npcCount, getName)
    return { round: 1, creatures }
}

function mergeCombatSummaryWithCharacters(initialSummary, characters, getName) {
    if (!initialSummary?.creatures) {
        const creatures = setupCreatures(characters, 0, getName)
        return { round: 1, creatures }
    }
    const creatureNameSet = new Set(initialSummary.creatures.map(c => c.name))
    const mergedCreatures = initialSummary.creatures
        .filter(c => c.type !== 'player' || characters.some(ch => getName(ch.name) === c.name))
        .map(c => {
        if (c.type === 'player') {
            const character = characters.find(ch => getName(ch.name) === c.name)
            if (character) {
                return { ...c, initiative: c.initiative ?? '', targetName: c.targetName ?? null, concentration: c.concentration ?? null }
            }
        }
        return { ...c, initiative: c.initiative ?? '', concentration: c.concentration ?? null, currentHp: c.currentHp ?? c.maxHp ?? 10, maxHp: c.maxHp ?? 10, saveBonuses: c.saveBonuses || {} }
    })
    const newPlayerCreatures = characters
        .filter(ch => !creatureNameSet.has(getName(ch.name)))
        .map(ch => ({
            name: getName(ch.name),
            type: 'player',
            initiative: '',
            targetName: null,
            concentration: null,
        }))
    mergedCreatures.push(...newPlayerCreatures)
    sortCreaturesForBoard({ creatures: mergedCreatures })
    return { round: initialSummary.round, creatures: mergedCreatures }
}

export {
    parseInitBonus,
    setupCreatures,
    isBareNpcPlaceholder,
    addNpc,
    removeNpc,
    getNextCreatureName,
    getPreviousCreatureName,
    isPreviousDisabled,
    setInitiative,
    rollNpcInitiative,
    applyNpcMonsterData,
    renameNpc,
    setTarget,
    clearCombat,
    mergeCombatSummaryWithCharacters,
}
