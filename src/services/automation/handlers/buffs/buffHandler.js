import { toggleBuff } from '../../common/buffToggle.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { handle as handleTeleport } from '../class-warlock/tempTeleportHandler.js';
import { handle as handleVowOfEnmity } from '../class-cleric-paladin/vowOfEnmityHandler.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { evaluateAutoExpression } from '../../../combat/automationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

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
        const combatSummary = getCombatSummary();
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
