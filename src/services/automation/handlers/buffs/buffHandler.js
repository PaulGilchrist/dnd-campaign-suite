import { toggleBuff } from '../../common/buffToggle.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { handle as handleTeleport } from '../class-warlock/tempTeleportHandler.js';
import { handle as handleVowOfEnmity } from '../class-cleric-paladin/vowOfEnmityHandler.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const ADRENALINE_RUSH_USES_KEY = 'adrenalineRushUses';
const ADRENALINE_RUSH_REST_KEY = 'adrenalineRushRestTimestamp';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    // Handle Adrenaline Rush: bonus action dash with temp HP, uses = proficiency_bonus, short_rest recharge
    if (auto?.effect === 'bonus_action_dash') {
        return handleBonusActionDash(action, playerStats, campaignName, _mapName);
    }

    // Handle dash_action trigger: apply speed bonus temporarily
    if (auto?.trigger === 'dash_action' && auto?.effect === 'speed_bonus') {
        const bonusMatch = String(auto.bonus || '0 ft').match(/(\d+)/);
        const bonusAmount = bonusMatch ? parseInt(bonusMatch[1], 10) : 0;
        if (bonusAmount > 0) {
            const storedBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
            const buffs = Array.isArray(storedBuffs) ? storedBuffs : [];
            const dashBuff = buffs.find(b => b.name === action.name && b.tempBuff);
            if (!dashBuff) {
                setRuntimeValue(playerStats.name, 'activeBuffs', [
                    ...buffs,
                    { name: action.name, tempBuff: true, speedBonus: bonusAmount, duration: auto.duration || 'same_action' },
                ], campaignName);
            }
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name}: +${bonusAmount} ft Speed for this Dash action.`,
                    automation: auto,
                },
            };
        }
    }

    // Check requiredLevel before allowing the buff (e.g., Draconic Flight at level 5)
    if (auto?.requiredLevel && playerStats.level < auto.requiredLevel) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} requires character level ${auto.requiredLevel}. You are level ${playerStats.level}.`,
                automation: auto,
            },
        };
    }

    // Check long rest recharge for traits with no explicit uses field
    if (auto?.recharge === 'long_rest' && !auto?.uses) {
        const restKey = playerStats.name.toLowerCase().replace(/\s+/g, '') + '_buffRestTimestamp';
        const lastRest = getRuntimeValue(playerStats.name, restKey, campaignName);
        const now = Date.now();
        if (lastRest && (now - lastRest) < 86400000) {
            const stored = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
            const activeBuffs = Array.isArray(stored) ? stored : [];
            const isActive = activeBuffs.some(b => b.name === action.name);
            if (!isActive) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        description: `${action.name} has been used and cannot be used again until a Long Rest.`,
                        automation: auto,
                    },
                };
            }
        }
    }

    if (auto?.effect === 'teleport_on_rage' || auto?.effect === 'teleport_swap_with_illusion' || auto?.effect === 'shadow_step_teleport' || auto?.effect === 'moonlight_step_teleport' || auto?.effect === 'bonus_teleport') {
        return handleTeleport(action, playerStats, campaignName, _mapName);
    }

    if (auto?.effect === 'vow_of_enmity') {
        return handleVowOfEnmity(action, playerStats, campaignName, _mapName);
    }

    let targetName = playerStats.name;
    if (auto?.target === 'willing_creature') {
        const combatSummary = getCombatSummary(campaignName);
        if (combatSummary) {
            const target = getTargetFromAttacker(combatSummary, playerStats.name);
            if (target) {
                targetName = target.name;
            }
        }
    }

    const { wasActive } = toggleBuff(
        playerStats.name,
        action.name,
        auto,
        campaignName,
        targetName
    );

    if (auto?.effect === 'invisible') {
        const storedConditions = getRuntimeValue(targetName, 'activeConditions') || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        if (!wasActive) {
            if (!conditions.some(c => String(c).toLowerCase() === 'invisible')) {
                setRuntimeValue(targetName, 'activeConditions', [...conditions, 'invisible'], campaignName);
            }
        } else {
            const filtered = conditions.filter(c => String(c).toLowerCase() !== 'invisible');
            if (filtered.length !== conditions.length) {
                setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
            }
        }
        if (!wasActive) {
            const invisKey = `_activeInvisibility_${targetName}`;
            setRuntimeValue(campaignName, invisKey, playerStats.name, campaignName);
        } else {
            const invisKey = `_activeInvisibility_${targetName}`;
            setRuntimeValue(campaignName, invisKey, null, campaignName);
        }
    }

    if (auto?.effect === 'see_invisibility') {
        if (!wasActive) {
            addExpiration(playerStats.name, targetName, [
                { type: 'remove_active_buff', buffName: action.name }
            ], campaignName);
        }
    }

    if (auto?.effect === 'fly_speed_equals_walk_speed' && wasActive) {
        const restKey = playerStats.name.toLowerCase().replace(/\s+/g, '') + '_buffRestTimestamp';
        await setRuntimeValue(playerStats.name, restKey, Date.now(), campaignName);
    }

    if (auto?.effect === 'haste') {
        if (!wasActive) {
            addExpiration(playerStats.name, targetName, [
                { type: 'remove_active_buff', buffName: action.name }
            ], campaignName);
        } else {
            const storedConditions = getRuntimeValue(targetName, 'activeConditions') || [];
            const conditions = Array.isArray(storedConditions) ? storedConditions : [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== 'speed_zero');
            if (filtered.length !== conditions.length) {
                await setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
            }
        }
    }

    if (!wasActive && auto?.tempHpExpression) {
        let amount = evaluateAutoExpression(auto.tempHpExpression, playerStats);
        // Circle of the Moon: Circle Forms overrides temp HP to 3 × Druid level
        const isMoonDruid = playerStats.class?.major?.name === 'Moon' || playerStats.class?.subclass?.name === 'Moon';
        if (isMoonDruid && auto?.effect === 'shape_shift') {
            amount = 3 * (playerStats.level || 1);
        }
        if (typeof amount === 'number' && amount > 0) {
            setRuntimeValue(playerStats.name, 'tempHp', amount, campaignName);
        }
    }

    const displayTarget = targetName === playerStats.name ? 'yourself' : targetName;
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: wasActive
                ? `${action.name} toggled OFF`
                : `${action.name} activated on ${displayTarget} (${auto.duration || '10 min'})`,
            automation: auto,
        },
    };
}

async function handleBonusActionDash(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Adrenaline Rush';

    const usesKey = `${playerName.toLowerCase().replace(/\s+/g, '')}_${ADRENALINE_RUSH_USES_KEY}`;
    const restKey = `${playerName.toLowerCase().replace(/\s+/g, '')}_${ADRENALINE_RUSH_REST_KEY}`;

    const now = Date.now();
    const lastRest = getRuntimeValue(playerName, restKey, campaignName);

    let usesMax;
    if (auto.uses === 'proficiency_bonus') {
        usesMax = playerStats.proficiency || 0;
    } else if (typeof auto.uses === 'number') {
        usesMax = auto.uses;
    } else {
        usesMax = auto.usesMax != null ? auto.usesMax : 1;
    }

    let usesRemaining = 0;
    let canUse = false;

    if (lastRest && (now - lastRest) < 43200000) {
        const stored = getRuntimeValue(playerName, usesKey, campaignName);
        usesRemaining = stored != null ? Number(stored) : usesMax;
        canUse = usesRemaining > 0;
    } else {
        usesRemaining = usesMax;
        canUse = true;
    }

    if (!canUse) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                automationType: auto.type,
                description: `${featureName} has no uses remaining. Recharges on a Short or Long Rest.`,
                automation: auto,
            },
        };
    }

    if (auto?.bonusEffect === 'temp_hp' && auto?.bonusExpression) {
        const tempHpAmount = evaluateAutoExpression(auto.bonusExpression, playerStats);
        if (typeof tempHpAmount === 'number' && tempHpAmount > 0) {
            setRuntimeValue(playerName, 'tempHp', tempHpAmount, campaignName);
        }
    }

    const newUses = usesRemaining - 1;
    await setRuntimeValue(playerName, usesKey, newUses, campaignName);

    const tempHpDesc = auto?.bonusEffect === 'temp_hp' && auto?.bonusExpression
        ? ` Gained ${evaluateAutoExpression(auto.bonusExpression, playerStats)} temporary hit points.`
        : '';

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            automationType: auto.type,
            description: `${featureName}: You take the Dash action as a Bonus Action.${tempHpDesc} (${newUses} use${newUses !== 1 ? 's' : ''} remaining).`,
            automation: auto,
        },
    };
}

export function restoreAdrenalineRushUses(playerName, campaignName) {
    const usesKey = `${playerName.toLowerCase().replace(/\s+/g, '')}_${ADRENALINE_RUSH_USES_KEY}`;
    const restKey = `${playerName.toLowerCase().replace(/\s+/g, '')}_${ADRENALINE_RUSH_REST_KEY}`;

    setRuntimeValue(playerName, restKey, Date.now(), campaignName);
    setRuntimeValue(playerName, usesKey, null, campaignName);
}
