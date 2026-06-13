import { toggleBuff } from '../common/buffToggle.js';
import { handle as handleTeleport } from './tempTeleportHandler.js';
import { handle as handleVowOfEnmity } from './vowOfEnmityHandler.js';
import { getTargetFromAttacker } from '../../rules/damageUtils.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { evaluateAutoExpression } from '../../combat/automationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    if (auto?.effect === 'teleport_on_rage' || auto?.effect === 'teleport_swap_with_illusion' || auto?.effect === 'shadow_step_teleport' || auto?.effect === 'moonlight_step_teleport') {
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
        const storedConditions = getRuntimeValue(playerStats.name, 'activeConditions') || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        if (!wasActive) {
            if (!conditions.some(c => String(c).toLowerCase() === 'invisible')) {
                setRuntimeValue(playerStats.name, 'activeConditions', [...conditions, 'invisible'], campaignName);
            }
        } else {
            const filtered = conditions.filter(c => String(c).toLowerCase() !== 'invisible');
            if (filtered.length !== conditions.length) {
                setRuntimeValue(playerStats.name, 'activeConditions', filtered, campaignName);
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
