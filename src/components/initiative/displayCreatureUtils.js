import utils from '../../services/ui/utils.js'
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'

export function buildRuntimeConditions(creature, lookupName) {
    const runtimeConditions = getRuntimeValue(lookupName, 'activeConditions') || []
    const conditionMeta = getRuntimeValue(lookupName, 'activeConditionMeta') || {}
    const csConditions = creature.conditions || []
    return runtimeConditions.map((key, i) => {
        const condKey = String(key).toLowerCase()
        const meta = conditionMeta[condKey]
        const csMatch = csConditions.find(cs => String(cs.key).toLowerCase() === condKey)
        return {
            id: `runtime-${key}-${i}`,
            key,
            label: csMatch?.label || (key === 'speed_zero' ? 'Speed 0' : key.charAt(0).toUpperCase() + key.slice(1)),
            dc: (meta?.dc ?? csMatch?.dc) || 0,
            ability: (meta?.ability ?? csMatch?.ability) || 'con',
        }
    })
}

export function computePlayerAc(creature, stats, lookupName) {
    const activeBuffs = getRuntimeValue(lookupName, 'activeBuffs') || []
    const shieldOfFaithBonus = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'shield_of_faith') ? 2 : 0
    const wardingBondBuff = Array.isArray(activeBuffs) ? activeBuffs.find(b => b.effect === 'warding_bond' && b.acBonus) : null
    const wardingBondBonus = wardingBondBuff ? Number(wardingBondBuff.acBonus) || 0 : 0
    const barkskinActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'barkskin')
    const circleFormsAC = creature.wildShapeSource ? (getRuntimeValue(creature.name, 'circleFormsAC') ?? null) : null
    return circleFormsAC ?? (barkskinActive ? 17 : (stats?.armorClass ?? 10) + shieldOfFaithBonus + wardingBondBonus)
}

export function buildPlayerDisplayFields(creature, lookupName, characters) {
    const character = characters.find(ch => utils.getName(ch.name) === lookupName)
    const stats = character?.computedStats || character
    const maxHp = getRuntimeValue(lookupName, 'hitPoints') ?? stats?.hitPoints ?? 0
    const currentHp = getRuntimeValue(lookupName, 'currentHitPoints') ?? maxHp
    return {
        imagePath: character?.imagePath || '',
        ac: computePlayerAc(creature, stats, lookupName),
        resistances: stats?.resistances || [],
        immunities: stats?.immunities || [],
        currentHp,
        maxHp,
    }
}

// CLA-360: structural second-turn entries resolve live state via the holder's real name.
export function buildDisplayCreature(creature, characters) {
    const lookupName = creature.holderName || creature.name
    const conditions = buildRuntimeConditions(creature, lookupName)
    if (creature.type !== 'player') {
        return { ...creature, conditions }
    }
    return { ...creature, ...buildPlayerDisplayFields(creature, lookupName, characters), conditions }
}
