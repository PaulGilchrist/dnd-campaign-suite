import { rollD20 } from '../dice/diceRoller.js'
import { getMonsterData } from '../npcs/monsterUtils.js'
import { getMonsterSaveBonuses } from './encounterToInitiative.js'

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
            conditions: [],
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
        conditions: [],
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

async function applyNpcMonsterData(combatSummary, creatureIndex, monster, campaignNpcs) {
    const creature = combatSummary.creatures[creatureIndex]
    if (!creature) return
    creature.ac = typeof monster.armor_class === 'number'
        ? monster.armor_class
        : (console.error(`[AC] Monster "${creature.name}" has no armor_class defined. Defaulting to 10.`), 10)
    creature.resistances = monster.damage_resistances || []
    creature.immunities = monster.damage_immunities || []
    creature.initiativeBonus = monster.initiative_details ? parseInt(monster.initiative_details) || 0 : 0
    creature.maxHp = monster.hit_points || 10
    creature.currentHp = monster.hit_points || 10
    creature.saveBonuses = getMonsterSaveBonuses(monster)
    const matchedNpc = campaignNpcs.find(n => n.name?.toLowerCase() === creature.name.toLowerCase())
    if (matchedNpc?.imagePath) {
        creature.imagePath = matchedNpc.imagePath
    }
}

async function renameNpc(combatSummary, oldName, newName, campaignNpcs, setNpcImages) {
    const idx = combatSummary.creatures.findIndex(c => c.name === oldName)
    if (idx === -1) return
    combatSummary.creatures[idx].name = newName
    const monster = await getMonsterData(newName, campaignNpcs)
    if (monster) {
        await applyNpcMonsterData(combatSummary, idx, monster, campaignNpcs)
    }
    if (setNpcImages) {
        setNpcImages(prev => ({ ...prev, [newName]: null }))
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
    const characterNameSet = new Set(characters.map(c => getName(c.name)))
    const mergedCreatures = initialSummary.creatures.map(c => {
        if (c.type === 'player' && characterNameSet.has(c.name)) {
            return { ...c, initiative: c.initiative ?? '', targetName: c.targetName ?? null, concentration: c.concentration ?? null }
        }
        return { ...c, conditions: c.conditions || [], concentration: c.concentration ?? null, currentHp: c.currentHp ?? c.maxHp ?? 10, maxHp: c.maxHp ?? 10, saveBonuses: c.saveBonuses || {} }
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
