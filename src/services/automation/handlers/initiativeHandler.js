import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { rollExpression } from '../../dice/diceRoller.js';
import { logHealingToSSE } from '../common/healingRoll.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    if (auto.effect !== 'regain_focus_points_and_heal') {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: action.description || '',
              },
          };
        }

    const resourceKey = auto.resourceKey || action.name.toLowerCase().replace(/\s+/g, '') + 'Uses';
    const usesUsed = Number(getRuntimeValue(playerStats.name, resourceKey, campaignName) ?? 0);
    if (usesUsed >= (auto.usesMax || auto.uses || 1)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} has been used and cannot be used again until a long rest.` +
                        (auto.recharge === 'long_rest' ? '' : ` Recharges on ${auto.recharge || 'short rest'}.`),
                },
              };
            }

    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    const martialArtsDie = classLevel?.martial_arts_die || 4;
    const monkLevel = playerStats.level;

    const rollResult = rollExpression(`1d${martialArtsDie}`);
    if (!rollResult) return null;

    const healAmount = monkLevel + rollResult.total;

    const currentHp = Number(getRuntimeValue(playerStats.name, 'currentHitPoints', campaignName)) || 0;
    const maxHp = playerStats.hitPoints;
    const newHp = Math.min(maxHp, currentHp + healAmount);

    setRuntimeValue(playerStats.name, 'currentHitPoints', newHp, campaignName);
    logHealingToSSE(campaignName, {
        targetName: playerStats.name,
        sourceName: action.name,
        actualHeal: newHp - currentHp,
        newHp,
        maxHp,
        });
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    setRuntimeValue(playerStats.name, resourceKey, usesUsed + 1, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'healing',
            name: action.name,
            formula: `1d${martialArtsDie} + ${monkLevel}`,
            rolls: rollResult.rolls,
            bonus: monkLevel,
            modifier: 0,
            healAmount,
            description: `${action.name}: Rolled ${rollResult.total} (1d${martialArtsDie}) + ${monkLevel} (Monk level) = <strong>${healAmount}</strong> HP`,
            targetName: playerStats.name,
            targetCurrentHp: newHp,
            targetMaxHp: maxHp,
            damageApplied: true,
             },
            };
          }
