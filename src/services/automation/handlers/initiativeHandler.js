import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { rollExpression } from '../../dice/diceRoller.js';
import { logHealingToSSE } from '../common/healingRoll.js';
import { getCombatContext } from '../../rules/damageUtils.js';
import storage from '../../ui/storage.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    if (auto.effect === 'bonus_initiative_allies') {
        const activeConditions = getRuntimeValue(playerStats.name, 'activeConditions', campaignName) || [];
        if (activeConditions.includes('incapacitated')) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name} cannot be used while Incapacitated.`,
                },
            };
        }

        const bardicMax = playerStats?.class?.class_levels?.[(playerStats.level || 1) - 1]?.bardic_inspiration_uses
            || playerStats?.proficiency || 0;
        const currentBI = Number(getRuntimeValue(playerStats.name, 'bardicInspirationUses', campaignName) ?? bardicMax);
        if (currentBI <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name} requires a use of Bardic Inspiration, but you have no uses remaining.`,
                },
            };
        }

        await setRuntimeValue(playerStats.name, 'bardicInspirationUses', currentBI - 1, campaignName);

        const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
        const bardicDie = classLevel?.bardic_die || 6;
        const rollResult = rollExpression(`1d${bardicDie}`);
        if (!rollResult) return null;

        const bonusValue = rollResult.total;

        const combatSummary = await getCombatContext(campaignName);
        if (combatSummary?.creatures) {
            const affected = [];
            for (const creature of combatSummary.creatures) {
                if (creature.type !== 'player') continue;
                const currentInit = creature.initiative !== '' ? Number(creature.initiative) : null;
                if (currentInit !== null) {
                    creature.initiative = String(currentInit + bonusValue);
                } else {
                    const existingBonus = Number(getRuntimeValue(creature.name, 'tandemFootworkBonus', campaignName) ?? 0);
                    await setRuntimeValue(creature.name, 'tandemFootworkBonus', existingBonus + bonusValue, campaignName);
                }
                affected.push(creature.name);
            }
            combatSummary.creatures.sort((a, b) => {
                const aVal = Number(a.initiative) || 0;
                const bVal = Number(b.initiative) || 0;
                return bVal - aVal;
            });
            await storage.set('combatSummary', combatSummary, campaignName);
            window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        }

        return {
            type: 'popup',
            payload: {
                type: 'initiative_buff',
                name: action.name,
                formula: `1d${bardicDie}`,
                rolls: rollResult.rolls,
                bonus: 0,
                modifier: 0,
                description: `${action.name}: Rolled ${rollResult.total} (1d${bardicDie}). You and allies within 30 feet gain +${rollResult.total} to Initiative.`,
                automationType: auto.type,
            },
        };
     }

    if (auto.effect === 'wild_shape_regen_on_initiative') {
        const resourceKey = auto.resourceKey || 'wildShapeUses';
        const maxWS = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.wild_shape || 0;
        if (maxWS === 0) return null;

        const currentWS = Number(getRuntimeValue(playerStats.name, resourceKey, campaignName) ?? 0);
        if (currentWS > 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name}: You have ${currentWS} Wild Shape use(s) remaining. No need to regain.`,
                   },
               };
          }

        await setRuntimeValue(playerStats.name, resourceKey, 1, campaignName);

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name}: You regained 1 use of Wild Shape.`,
               },
          };
     }

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
    const maxUses = auto.usesMax || auto.uses || 1;
    const currentUses = Number(getRuntimeValue(playerStats.name, resourceKey, campaignName) ?? maxUses);
    if (currentUses <= 0) {
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

    setRuntimeValue(playerStats.name, resourceKey, currentUses - 1, campaignName);

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
