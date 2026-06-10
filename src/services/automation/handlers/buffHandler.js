import { toggleBuff } from '../common/buffToggle.js';
import { handle as handleTeleport } from './tempTeleportHandler.js';
import { getTargetFromAttacker } from '../../rules/damageUtils.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { evaluateAutoExpression } from '../../combat/automationService.js';
import { setRuntimeValue } from '../../../hooks/useRuntimeState.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    if (auto?.effect === 'teleport_on_rage' || auto?.effect === 'teleport_swap_with_illusion') {
        return handleTeleport(action, playerStats, campaignName, _mapName);
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

    if (!wasActive && auto?.tempHpExpression) {
        const amount = evaluateAutoExpression(auto.tempHpExpression, playerStats);
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
