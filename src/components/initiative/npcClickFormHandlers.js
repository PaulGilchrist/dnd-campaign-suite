import { cloneDeep } from 'lodash'
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { loadMonsters, fetchRaceData } from '../../services/ui/dataLoader.js'

const ABILITY_INCREASE_KEYS = ['featIncrease', 'backgroundIncrease', 'racialIncrease', 'miscIncrease']
const ABILITY_ABBRS = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const MOON_CIRCLE = 'Circle of the Moon'

// CLA-391: raw character ability entries carry baseScore (+feat/background/... increases),
// never a computed `.score`. Prefer an explicit score, else derive from baseScore + increases.
export function getDruidAbilityScore(druidCharacter, abilityName) {
    const abilities = druidCharacter?.computedStats?.abilities || druidCharacter?.abilities || []
    const ability = abilities.find(a => a.name === abilityName)
    if (!ability) return null
    if (typeof ability.score === 'number') return ability.score
    if (typeof ability.baseScore === 'number') {
        const increases = ABILITY_INCREASE_KEYS.reduce((sum, k) => sum + (Number(ability[k]) || 0), 0)
        return ability.baseScore + increases
    }
    return null
}

// Retain the caster's INT/WIS/CHA scores, creature type, and languages on a
// merged beast stat block (CLA-391 canonical: "retain your creature type,
// Intelligence/Wisdom/Charisma scores, ... languages").
export function applyDruidRetainedTraits(merged, druidCharacter) {
    if (!druidCharacter) return
    const retained = { int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
    for (const [abbr, name] of Object.entries(retained)) {
        const score = getDruidAbilityScore(druidCharacter, name)
        if (score == null) continue
        merged.ability_scores[abbr] = score
        if (merged.ability_score_modifiers) {
            merged.ability_score_modifiers[abbr] = Math.floor((score - 10) / 2)
        }
    }
    const druidLanguages = druidCharacter.computedStats?.languages || druidCharacter.languages
    if (druidLanguages) merged.languages = Array.isArray(druidLanguages) ? druidLanguages.join(', ') : druidLanguages
}

// Wild Shape retains the caster's creature type (canonical: Humanoid, not the Beast's).
export async function applyDruidRetainedCreatureType(merged, druidCharacter, characterRules) {
    if (!druidCharacter?.race) return
    const raceName = druidCharacter.race?.name || druidCharacter.race
    const raceData = await fetchRaceData(raceName, characterRules || '2024')
    const creatureType = raceData?.creature_type
    if (creatureType) merged.type = creatureType
}

export function findCasterCharacter(characters, casterName) {
    return characters.find(c => c.name === casterName || c.name.startsWith(casterName + ' '))
}

function extractBeastSaves(baseMonster) {
    const beastSaves = {}
    for (const abbr of ABILITY_ABBRS) {
        if (baseMonster.saving_throws?.[abbr]?.modifier != null) {
            beastSaves[abbr] = baseMonster.saving_throws[abbr].modifier
        } else if (baseMonster.ability_score_modifiers?.[abbr] != null) {
            beastSaves[abbr] = baseMonster.ability_score_modifiers[abbr]
        }
    }
    return beastSaves
}

function applyBeastSaves(merged, beastSaves) {
    merged.saving_throws = {}
    for (const [abbr, mod] of Object.entries(beastSaves)) {
        merged.saving_throws[abbr] = { modifier: mod }
    }
}

function isCircleOfTheMoon(druidCharacter) {
    return [druidCharacter?.computedStats?.class, druidCharacter?.class]
        .some(cls => cls?.major?.name === MOON_CIRCLE || cls?.subclass?.name === MOON_CIRCLE)
}

function hasLunarRadiance(druidCharacter) {
    if (!isCircleOfTheMoon(druidCharacter)) return false
    return (druidCharacter.computedStats?.automation?.passives || druidCharacter.automation?.passives || [])
        .some(p => p.effect === 'lunar_radiance')
}

function applyLunarRadiance(merged) {
    for (const action of merged.actions || []) {
        if (action.attack_bonus != null) {
            const baseType = action.damage_type_primary || ''
            action.damage_type_choices = [...(baseType ? [baseType] : []), 'Radiant']
            if (action.description) {
                action.description = action.description.replace(/\b([A-Za-z]+) damage\b/gi, '$1 or Radiant damage')
            }
        }
    }
}

async function runWildShape({ creature, runtimeCreature, campaignName, characters, setViewingMonster, setViewingMonsterCreatureName }) {
    const monsters = await loadMonsters()
    const baseMonster = monsters.find(m => m.index === runtimeCreature.beastIndex)
    if (!baseMonster) return false
    const merged = cloneDeep(baseMonster)
    merged.name = runtimeCreature.beastName || baseMonster.name
    merged.hit_points = getRuntimeValue(creature.name, 'currentHitPoints', campaignName) ?? creature.currentHp
    const circleFormsAC = getRuntimeValue(creature.name, 'circleFormsAC') ?? null
    if (circleFormsAC != null) {
        merged.armor_class = circleFormsAC
    }
    const druidCharacter = findCasterCharacter(characters, runtimeCreature.wildShapeSource)
    applyDruidRetainedTraits(merged, druidCharacter)
    await applyDruidRetainedCreatureType(merged, druidCharacter, druidCharacter?.rules)
    const beastSaves = extractBeastSaves(baseMonster)
    applyBeastSaves(merged, beastSaves)
    if (isCircleOfTheMoon(druidCharacter) && druidCharacter) {
        const wisScore = getDruidAbilityScore(druidCharacter, 'Wisdom')
        const wisMod = Math.floor(((wisScore ?? 10) - 10) / 2)
        merged.saving_throws.con.modifier = beastSaves.con + wisMod
    }
    if (hasLunarRadiance(druidCharacter)) {
        applyLunarRadiance(merged)
    }
    if (runtimeCreature.lunarFormAction) {
        merged.actions = [...(merged.actions || []), runtimeCreature.lunarFormAction]
    }
    setViewingMonster(merged)
    setViewingMonsterCreatureName(creature.name)
    return true
}

async function runPolymorph({ creature, runtimeCreature, campaignName, characters, setViewingMonster, setViewingMonsterCreatureName }) {
    const monsters = await loadMonsters()
    const baseMonster = monsters.find(m => m.index === runtimeCreature.polymorphBeast.index)
    if (!baseMonster) return false
    const merged = cloneDeep(baseMonster)
    merged.name = runtimeCreature.beastName || baseMonster.name
    merged.hit_points = getRuntimeValue(creature.name, 'currentHitPoints', campaignName) ?? creature.currentHp
    merged.armor_class = runtimeCreature.ac
    merged.type = 'beast'
    merged.size = runtimeCreature.size || baseMonster.size
    merged.challenge_rating = runtimeCreature.polymorphBeast.challengeRating || baseMonster.challenge_rating
    if (runtimeCreature.speed) {
        merged.speed = runtimeCreature.speed
    }
    const polymorphTempHp = getRuntimeValue(creature.name, 'polymorphTempHp', campaignName)
    if (typeof polymorphTempHp === 'number' && polymorphTempHp > 0) {
        merged.hit_points_temp = polymorphTempHp
    }
    const druidCharacter = findCasterCharacter(characters, runtimeCreature.polymorphSource)
    applyDruidRetainedTraits(merged, druidCharacter)
    applyBeastSaves(merged, extractBeastSaves(baseMonster))
    setViewingMonster(merged)
    setViewingMonsterCreatureName(creature.name)
    return true
}

async function runShapechange({ creature, runtimeCreature, campaignName, characters, setViewingMonster, setViewingMonsterCreatureName }) {
    const monsters = await loadMonsters()
    const baseMonster = monsters.find(m => m.index === runtimeCreature.shapechangeForm.index)
    if (!baseMonster) return false
    const merged = cloneDeep(baseMonster)
    merged.name = runtimeCreature.formName || baseMonster.name
    merged.hit_points = getRuntimeValue(creature.name, 'currentHitPoints', campaignName) ?? creature.currentHp
    merged.armor_class = runtimeCreature.ac
    merged.size = runtimeCreature.size || baseMonster.size
    merged.challenge_rating = runtimeCreature.shapechangeForm.challengeRating || baseMonster.challenge_rating
    if (runtimeCreature.speed) {
        merged.speed = runtimeCreature.speed
    }
    const shapechangeTempHp = getRuntimeValue(creature.name, 'shapechangeTempHp', campaignName)
    if (typeof shapechangeTempHp === 'number' && shapechangeTempHp > 0) {
        merged.hit_points_temp = shapechangeTempHp
    }
    const druidCharacter = findCasterCharacter(characters, runtimeCreature.shapechangeSource)
    applyDruidRetainedTraits(merged, druidCharacter)
    applyBeastSaves(merged, extractBeastSaves(baseMonster))
    setViewingMonster(merged)
    setViewingMonsterCreatureName(creature.name)
    return true
}

async function runMonster({ creature, runtimeCreature, characters, setViewingMonster, setViewingMonsterCreatureName }) {
    const monsters = await loadMonsters()
    const baseMonster = monsters.find(m => m.index === runtimeCreature.monsterIndex)
    if (!baseMonster) return false
    const merged = cloneDeep(baseMonster)
    merged.name = runtimeCreature.name
    merged.armor_class = runtimeCreature.ac
    merged.hit_points = runtimeCreature.currentHp
    merged.size = runtimeCreature.size
    if (runtimeCreature.speed) {
        merged.speed = runtimeCreature.speed
    }
    if (runtimeCreature.saveBonuses && baseMonster.saving_throws) {
        for (const [abbr, bonus] of Object.entries(runtimeCreature.saveBonuses)) {
            if (merged.saving_throws?.[abbr]) {
                merged.saving_throws[abbr].modifier = bonus
            }
        }
    }
    if (runtimeCreature.resistances) {
        merged.damage_resistances = runtimeCreature.resistances
    }
    if (runtimeCreature.immunities) {
        merged.damage_immunities = runtimeCreature.immunities
    }
    if (runtimeCreature.actions) {
        merged.actions = runtimeCreature.actions
    }
    if (runtimeCreature.wildShapeSource) {
        const druidCharacter = findCasterCharacter(characters, runtimeCreature.wildShapeSource)
        applyDruidRetainedTraits(merged, druidCharacter)
        await applyDruidRetainedCreatureType(merged, druidCharacter, druidCharacter?.rules)
    }
    setViewingMonster(merged)
    setViewingMonsterCreatureName(creature.name)
    return true
}

export const NPC_FORM_HANDLERS = [
    { matches: rc => !!rc?.wildShapeSource && !!rc.beastIndex, run: runWildShape },
    { matches: rc => !!rc?.polymorphSource && !!rc.polymorphBeast?.index, run: runPolymorph },
    { matches: rc => !!rc?.shapechangeSource && !!rc.shapechangeForm?.index, run: runShapechange },
    { matches: rc => !!rc?.monsterIndex, run: runMonster },
]
