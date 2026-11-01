/**
 * Referee ask actor-stats projection (backlog 2026-10-31: referee dice rulings
 * are stat-blind). The AI referee prompt used to carry only the actor's NAME,
 * so dice rulings rolled bare ("1d20 — no proficiency modifier available").
 * This helper compacts the chosen character's REAL modifiers into the small
 * flat payload the ask body sends, so the model can author correct formulas
 * ("Arcana check for Marta = 1d20+11"). Proposal lanes are untouched —
 * this only changes what the model sees.
 *
 * Data source: the raw character summary (the server-served character JSON
 * that flows through props/runtime — never localStorage). Scores derive from
 * baseScore + increases (CLA-391 canonical, cf. npcClickFormHandlers.js),
 * clamped like rules/core/abilityCalc*.js do (level-20 Barbarian/Monk epic
 * boons raise the relevant scores and the cap).
 */

const ABILITY_SHORT = {
    Strength: 'str',
    Dexterity: 'dex',
    Constitution: 'con',
    Intelligence: 'int',
    Wisdom: 'wis',
    Charisma: 'cha',
}
const INCREASE_KEYS = ['featIncrease', 'backgroundIncrease', 'racialIncrease', 'miscIncrease']
const SKILL_CAP = 25

/** Level-20 epic boons (both rulesets): the named class/ability pair gets +4, cap 25. */
function abilityCap(name, className, level) {
    const boon = level > 19 && (
        (className === 'Barbarian' && (name === 'Strength' || name === 'Constitution')) ||
        (className === 'Monk' && (name === 'Dexterity' || name === 'Wisdom'))
    )
    return { bonus: boon ? 4 : 0, cap: boon ? 25 : 20 }
}

function abilityMod(entry, className, level) {
    const total = entry.baseScore + INCREASE_KEYS.reduce((sum, k) => sum + (Number(entry[k]) || 0), 0)
    const { bonus, cap } = abilityCap(entry.name, className, level)
    const score = Math.min(total + bonus, cap)
    return Math.floor((score - 10) / 2)
}

function skillList(value) {
    if (!Array.isArray(value)) return []
    return value.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim().slice(0, 40)).slice(0, SKILL_CAP)
}

/**
 * Project one character into the compact actorStats payload.
 * Returns null when the character carries no ability data at all (fixtures,
 * half-loaded rosters) — the ask body then stays exactly what it was before.
 * @param {{name?: string, level?: number, rules?: string, class?: {name?: string}, abilities?: Array, skillProficiencies?: Array, expertSkills?: Array}|null} character
 */
export function projectActorStats(character) {
    if (!character || !Array.isArray(character.abilities) || character.abilities.length === 0) return null
    const level = Number(character.level) || 1
    const className = character.class?.name || ''
    const abilityMods = {}
    for (const entry of character.abilities) {
        const key = entry && ABILITY_SHORT[entry.name]
        if (!key || typeof entry.baseScore !== 'number') continue
        abilityMods[key] = abilityMod(entry, className, level)
    }
    if (Object.keys(abilityMods).length === 0) return null
    const stats = { name: String(character.name || ''), abilityMods, proficiencyBonus: Math.floor((level - 1) / 4) + 2 }
    const skills = skillList(character.skillProficiencies)
    const experts = skillList(character.expertSkills)
    if (skills.length) stats.skillProficiencies = skills
    if (experts.length) stats.expertSkills = experts
    return stats
}
