import utils from '../../services/ui/utils.js'
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'

export function buildRuntimeConditions(creature, lookupName) {
    const rawConditions = getRuntimeValue(lookupName, 'activeConditions')
    // Defensive shape guard (improvement 2026-11-10): one malformed row used to
    // freeze the ENTIRE Initiative view to zero cards in every tab.
    const runtimeConditions = Array.isArray(rawConditions) ? rawConditions : []
    const conditionMeta = getRuntimeValue(lookupName, 'activeConditionMeta') || {}
    const csConditions = creature.conditions || []
    return runtimeConditions.map((rawKey, i) => {
        // Defensive String() (mirrors the cs.key idiom below, improvement
        // 2026-11-10): a stray object/number entry renders a sanitized label
        // instead of throwing key.charAt and killing the whole board render.
        const key = String(rawKey)
        const condKey = key.toLowerCase()
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
    const runtimeMaxHp = getRuntimeValue(lookupName, 'hitPoints')
    const runtimeCurrentHp = getRuntimeValue(lookupName, 'currentHitPoints')
    // Fresh-mount settle gate (improvement 2026-11-16 XB): a player row's HP
    // truth is the per-character runtime bucket or the roster's own stats —
    // neither exists yet when an SSE-replayed/stored board paints before the
    // rules-engine enrichment resolves, so the `?? 0` below is a FABRICATED
    // value. Flag the row as still settling (presentational only — merge logic
    // and store writes untouched) and let CreatureHp render a disabled
    // placeholder input instead of a misleading live 0. Data-derived: the flag
    // flips exactly when the bake lands real numbers; never a timer. A baked
    // 1/1 creation placeholder IS data (runtime hitPoints=1) and stays
    // enabled normally (pitfall 37 lane unchanged).
    const hpPending = runtimeMaxHp == null && stats?.hitPoints == null
    const maxHp = runtimeMaxHp ?? stats?.hitPoints ?? 0
    const currentHp = runtimeCurrentHp ?? maxHp
    return {
        imagePath: character?.imagePath || '',
        ac: computePlayerAc(creature, stats, lookupName),
        resistances: stats?.resistances || [],
        immunities: stats?.immunities || [],
        currentHp,
        maxHp,
        hpPending,
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
