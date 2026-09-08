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

export function getAvailableAttackRiderManeuversByTrigger(playerStats, campaignName, attackInfo) {
    const knownNames = getKnownManeuvers(playerStats, campaignName);
    if (knownNames.length === 0) return [];

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    if (superiorityDice <= 0) return [];

    const allManeuvers = getManeuversByType(playerStats, campaignName, knownNames, 'attack_rider', attackInfo);

    const isWeaponAttack = attackInfo?.weaponType === 'melee' || attackInfo?.weaponType === 'ranged' || attackInfo?.isUnarmedStrike;
    const isMeleeAttack = attackInfo?.weaponType === 'melee' || attackInfo?.isUnarmedStrike;

    return allManeuvers.filter(m => {
        if (!m.trigger || m.trigger === 'any') return true;
        if (m.trigger === 'weapon_attack_hit') {
            return isWeaponAttack;
        }
        if (m.trigger === 'melee_weapon_attack_hit') {
            return isMeleeAttack;
        }
        if (m.trigger === 'attack_roll_miss') {
            return attackInfo?.hit === false;
        }
        if (m.trigger === 'melee_attack_miss') {
            return isMeleeAttack && attackInfo?.hit === false;
        }
        if (m.trigger === 'melee_damage_taken') {
            return isMeleeAttack;
        }
        if (m.trigger === 'melee_attack_straight_line') {
            return isMeleeAttack;
        }
        if (m.trigger === 'replace_attack') {
            return attackInfo?.replacingAttack === true;
        }
        return true;
    });
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
                },
            },
            playerStats,
            campaignName,
            knownManeuvers: available.map(m => m.name),
            availableManeuvers: available,
            maxOptions: available.length,
            selectionMode: false,
            attackContext,
            saveDc: attackContext?.saveDc || null,
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
