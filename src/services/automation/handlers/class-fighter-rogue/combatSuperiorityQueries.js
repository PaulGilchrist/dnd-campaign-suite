import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { loadManeuvers } from '../../../ui/dataLoader.js';
import { getKnownManeuvers, getSuperiorityDice } from './combatSuperiorityUtils.js';

const allManeuversCache = new Map();

export async function getManeuversForRules(rules) {
    const key = rules || '2024';
    if (!allManeuversCache.has(key)) {
        const maneuvers = await loadManeuvers(key);
        allManeuversCache.set(key, maneuvers);
    }
    return allManeuversCache.get(key);
}

export function getManeuversByType(playerStats, campaignName, knownNames, actionType, attackInfo) {
    const allManeuvers = allManeuversCache.get(`${playerStats.rules || '2024'}`) || [];
    return allManeuvers.filter(m => {
        if (!knownNames.includes(m.name)) return false;
        if (actionType && m.actionType !== actionType) return false;
        if (attackInfo && m.trigger && m.trigger !== 'any') {
            const isWeaponAttack = attackInfo.weaponType === 'melee' || attackInfo.weaponType === 'ranged' || attackInfo.isUnarmedStrike;
            const isMeleeAttack = attackInfo.weaponType === 'melee' || attackInfo.isUnarmedStrike;
            if (m.trigger === 'weapon_attack_hit' && !isWeaponAttack) return false;
            if (m.trigger === 'melee_weapon_attack_hit' && !isMeleeAttack) return false;
        }
        return true;
    });
}

export function getAvailableAttackRiderManeuvers(playerStats, campaignName, attackInfo) {
    const knownNames = getKnownManeuvers(playerStats, campaignName);
    if (knownNames.length === 0) return [];

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    if (superiorityDice <= 0) return [];

    return getManeuversByType(playerStats, campaignName, knownNames, 'attack_rider', attackInfo);
}

const TRIGGER_MATCHERS = {
    // MN-018: HIT-triggered riders must ALSO require the attack to have hit.
    // Previously these branches only checked weapon/melee type, so a melee
    // MISS still offered Sweeping Attack / the weapon_attack_hit riders.
    weapon_attack_hit: (ctx) => ctx.isWeaponAttack && ctx.attackInfo?.hit === true,
    melee_weapon_attack_hit: (ctx) => ctx.isMeleeAttack && ctx.attackInfo?.hit === true,
    attack_roll_miss: (ctx) => ctx.attackInfo?.hit === false,
    melee_attack_miss: (ctx) => ctx.isMeleeAttack && ctx.attackInfo?.hit === false,
    melee_damage_taken: (ctx) => ctx.isMeleeAttack,
    melee_attack_straight_line: (ctx) => ctx.isMeleeAttack,
    replace_attack: (ctx) => ctx.attackInfo?.replacingAttack === true,
};

function matchesManeuverTrigger(m, ctx) {
    if (!m.trigger || m.trigger === 'any') return true;
    // MN-018: default must be FALSE. A trigger we don't recognise must not
    // be offered generically (this default-true is what failed open on misses).
    const matcher = TRIGGER_MATCHERS[m.trigger];
    return matcher ? matcher(ctx) : false;
}

export function getAvailableAttackRiderManeuversByTrigger(playerStats, campaignName, attackInfo) {
    const knownNames = getKnownManeuvers(playerStats, campaignName);
    if (knownNames.length === 0) return [];

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    if (superiorityDice <= 0) return [];

    const allManeuvers = getManeuversByType(playerStats, campaignName, knownNames, 'attack_rider', attackInfo);

    const ctx = {
        attackInfo,
        isWeaponAttack: attackInfo?.weaponType === 'melee' || attackInfo?.weaponType === 'ranged' || attackInfo?.isUnarmedStrike,
        isMeleeAttack: attackInfo?.weaponType === 'melee' || attackInfo?.isUnarmedStrike,
    };

    return allManeuvers.filter(m => matchesManeuverTrigger(m, ctx));
}

export function getAvailableSkillCheckManeuvers(playerStats, campaignName, skillName, isInitiative) {
    const knownNames = getKnownManeuvers(playerStats, campaignName);
    if (knownNames.length === 0) return [];

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    if (superiorityDice <= 0) return [];

    const allManeuvers = allManeuversCache.get(`${playerStats.rules || '2024'}`) || [];

    return allManeuvers.filter(m => {
        if (!knownNames.includes(m.name)) return false;
        if (m.actionType !== 'skill_check') return false;
        if (m.initiativeBonus && isInitiative) return true;
        if (m.skills && m.skills.length > 0) {
            const skillLower = skillName?.toLowerCase() || '';
            return m.skills.some(s => s.toLowerCase().includes(skillLower) || skillLower.includes(s.toLowerCase()));
        }
        return false;
    });
}

export function getSkillCheckManeuversForSkill(playerStats, campaignName, skillName, isInitiative) {
    const maneuvers = getAvailableSkillCheckManeuvers(playerStats, campaignName, skillName, isInitiative);
    return maneuvers.map(m => ({
        name: m.name,
        dieExpression: m.dieExpression || 'superiority_die',
        skills: m.skills || [],
        isInitiative: !!m.initiativeBonus,
    }));
}

// FS-010: prompt payloads must carry the character's OWN superiority die
// expression — the Superior Technique style grants a concrete 'd6'
// (rules-fightingStyles.js), while the Battle Master row keeps the
// level-table-driven 'superiority_die' token.
function characterSuperiorityDieExpression(playerStats) {
    const specialAction = (playerStats?.specialActions || []).find(a => a.type === 'combat_superiority');
    return specialAction?.automation?.dieExpression || 'superiority_die';
}

// MN-020: mirror the die-expression passthrough for the SAVE spec — poller legs
// rebuild their own action, so the raw 'ability' token + STR/DEX saveAbility must
// survive the trip to executeAttackRiderManeuver/buildSaveDc (never a baked number).
function characterSuperioritySaveSpec(playerStats) {
    const specialAction = (playerStats?.specialActions || []).find(a => a.type === 'combat_superiority');
    return {
        saveDc: specialAction?.automation?.saveDc || 'ability',
        saveAbility: specialAction?.automation?.saveAbility || ['STR', 'DEX'],
    };
}

export async function handleAttackRiderPrompt(action, playerStats, campaignName, _mapName) {
    const pending = getRuntimeValue(playerStats.name, 'pendingCombatSuperiorityPrompt', campaignName);
    if (!pending || !pending.attackContext) { return null; }

    const attackContext = pending.attackContext;
    const knownNames = getKnownManeuvers(playerStats, campaignName);
    if (knownNames.length === 0) {
        setRuntimeValue(playerStats.name, 'pendingCombatSuperiorityPrompt', null, campaignName);
        return null;
    }

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    if (superiorityDice <= 0) {
        setRuntimeValue(playerStats.name, 'pendingCombatSuperiorityPrompt', null, campaignName);
        return null;
    }

    await getManeuversForRules(playerStats.rules || '2024');

    const available = getAvailableAttackRiderManeuversByTrigger(playerStats, campaignName, attackContext);
    if (available.length === 0) {
        setRuntimeValue(playerStats.name, 'pendingCombatSuperiorityPrompt', null, campaignName);
        return null;
    }

    return {
        type: 'modal',
        modalName: 'combatSuperiority',
        payload: {
            action: {
                automation: {
                    type: 'combat_superiority',
                    dieExpression: characterSuperiorityDieExpression(playerStats),
                    ...characterSuperioritySaveSpec(playerStats),
                },
            },
            playerStats,
            campaignName,
            knownManeuvers: available.map(m => m.name),
            availableManeuvers: available,
            maxOptions: available.length,
            selectionMode: false,
            attackContext,
            saveDc: attackContext?.saveDc || characterSuperioritySaveSpec(playerStats).saveDc,
            saveType: attackContext?.saveType || null,
        },
    };
}

export async function handleSkillCheckPrompt(action, playerStats, campaignName, _mapName) {
    const pending = getRuntimeValue(playerStats.name, 'pendingCombatSuperiorityPrompt', campaignName);
    if (!pending || !pending.skillContext) return null;

    const skillContext = pending.skillContext;
    const knownNames = getKnownManeuvers(playerStats, campaignName);
    if (knownNames.length === 0) return null;

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    if (superiorityDice <= 0) return null;

    await getManeuversForRules(playerStats.rules || '2024');

    const available = getAvailableSkillCheckManeuvers(playerStats, campaignName, skillContext?.skillName, skillContext?.isInitiative);
    if (available.length === 0) return null;

    return {
        type: 'modal',
        modalName: 'combatSuperiority',
        payload: {
            action: {
                automation: {
                    type: 'combat_superiority',
                    dieExpression: characterSuperiorityDieExpression(playerStats),
                },
            },
            playerStats,
            campaignName,
            knownManeuvers: available.map(m => m.name),
            availableManeuvers: available,
            maxOptions: available.length,
            selectionMode: false,
            skillContext,
            saveDc: null,
            saveType: null,
        },
    };
}
