import { rollD20 } from '../dice/diceRoller.js'
import { getMonsterData, getMonsterImageUrl } from '../npcs/monsterUtils.js'
import { resolveMonsterIRV } from '../npcs/monsterIrvUtils.js'
import { getMonsterSaveBonuses } from './encounterToInitiative.js'
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'

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

function getNextCreatureName(combatSummary, activeCreatureName) {
    const currentIndex = combatSummary.creatures.findIndex(c => c.name === activeCreatureName)
    const isLast = currentIndex >= combatSummary.creatures.length - 1
    if (!isLast) {
        return { newActiveName: combatSummary.creatures[currentIndex + 1].name, roundIncrement: false }
    }
    return { newActiveName: combatSummary.creatures[0].name, roundIncrement: true }
}

function getPreviousCreatureName(combatSummary, activeCreatureName) {
    const currentIndex = combatSummary.creatures.findIndex(c => c.name === activeCreatureName)
    if (currentIndex > 0) {
        return { newActiveName: combatSummary.creatures[currentIndex - 1].name, roundDecrement: false }
    }
    return { newActiveName: combatSummary.creatures[combatSummary.creatures.length - 1].name, roundDecrement: true }
}

function isPreviousDisabled(combatSummary, activeCreatureName) {
    if (!combatSummary) return false
    return activeCreatureName === combatSummary.creatures[0]?.name && combatSummary.round === 1
}

function setInitiative(combatSummary, creatureName, value) {
    const index = combatSummary.creatures.findIndex(c => c.name === creatureName)
    if (index === -1) return
    combatSummary.creatures[index].initiative = value
    combatSummary.creatures.sort((a, b) => b.initiative - a.initiative)
}

function rollNpcInitiative(combatSummary, creatureName) {
    const creature = combatSummary.creatures.find(c => c.name === creatureName)
    if (!creature || creature.type !== 'npc') return null
    const bonus = creature.initiativeBonus || 0
    const roll = rollD20()
    const total = roll + bonus
    creature.initiative = String(total)
    combatSummary.creatures.sort((a, b) => b.initiative - a.initiative)
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
    mergedCreatures.sort((a, b) => {
        const aInit = Number(a.initiative) || -1
        const bInit = Number(b.initiative) || -1
        if (bInit !== aInit) return bInit - aInit
        return a.name.localeCompare(b.name)
    })
    return { round: initialSummary.round, creatures: mergedCreatures }
}

export {
    parseInitBonus,
    setupCreatures,
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
