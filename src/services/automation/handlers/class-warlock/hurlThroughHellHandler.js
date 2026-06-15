import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

const USES_KEY = 'hurlThroughHellUses';
const TURN_USED_KEY = 'hurlThroughHellTurnUsed';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Hurl Through Hell';

    // Check once-per-turn
    const turnUsed = getRuntimeValue(playerName, TURN_USED_KEY, campaignName);
    if (turnUsed) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: Already used this turn. Once per turn.`,
                automation: auto,
            },
        };
    }

    // Check uses remaining (1 per Long Rest)
    let currentUses = Number(getRuntimeValue(playerName, USES_KEY, campaignName) ?? 0);
    const maxUses = auto.uses || 1;

    if (currentUses >= maxUses) {
        // Check if Pact Magic slot can be spent to restore a use
        if (auto.pactMagicRecharge) {
            const pactSlotKey = 'warlockPactMagic';
            const currentPactSlots = Number(getRuntimeValue(playerName, pactSlotKey, campaignName) ?? 0);
            if (currentPactSlots > 0) {
                await setRuntimeValue(playerName, pactSlotKey, currentPactSlots - 1, campaignName);
                await setRuntimeValue(playerName, USES_KEY, 0, campaignName);
                currentUses = 0;

                await addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: featureName,
                    description: `${playerName} expended a Pact Magic spell slot to restore a use of ${featureName}.`,
                    timestamp: Date.now(),
                }).catch(() => {});
            } else {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: featureName,
                        description: `${featureName}: No uses remaining. Recharges on a Long Rest, or expend a Pact Magic spell slot to restore a use. No Pact Magic slots available.`,
                        automation: auto,
                    },
                };
            }
        } else {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${featureName}: No uses remaining. Recharges on a Long Rest.`,
                    automation: auto,
                },
            };
        }
    }

    // Increment use counter
    await setRuntimeValue(playerName, USES_KEY, currentUses + 1, campaignName);

    // Mark as used this turn
    const currentTurn = getRuntimeValue(playerName, 'currentTurn', campaignName) || 'unknown';
    await setRuntimeValue(playerName, TURN_USED_KEY, currentTurn, campaignName);

    // Get the target from combat context
    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerName) : null;
    const targetName = target?.name || null;

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: No target selected — effect noted for manual application.`,
                automation: auto,
            },
        };
    }

    // Build save DC
    const saveDc = buildSaveDc(auto, playerStats);
    const saveType = auto.saveType || 'CHA';

    // Resolve damage expression with scaling
    const damageExpression = auto.damageExpression || '8d10';
    const damageType = auto.damageType || 'Psychic';
    const dieRoll = rollExpression(damageExpression);
    const damageTotal = dieRoll?.total || 0;

    // Set the condition and teleport effects via targetEffects
    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const newEffect = {
        target: targetName,
        source: featureName,
        effect: 'incapacitated',
        condition: 'incapacitated',
        duration: 'until_end_of_next_turn',
        saveType,
        saveDc,
        saveAbility: auto.saveAbility || 'CHA',
        damageType,
        damageTotal,
        damageExpression,
        teleport: true,
        returnToSpace: true,
    };
    const updatedEffects = [...storedEffects, newEffect];
    setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);

    // Create save listener
    const { promptId } = createSaveListener(campaignName, {
        targetName,
        saveType,
        saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${featureName} triggered — ${targetName} must make ${saveType} save (DC ${saveDc}) or be hurled through the lower planes.`,
        targetName,
        promptId,
        timestamp: Date.now(),
    }).catch(() => {});

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;

        if (!event.detail.success) {
            // Target failed the save — apply Incapacitated condition
            const storedConds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
            const newConds = Array.isArray(storedConds) ? [...storedConds, 'incapacitated'] : ['incapacitated'];
            setRuntimeValue(targetName, 'activeConditions', newConds, campaignName);

            // Check if target is a fiend (fiends don't take the psychic damage)
            const cs = await getCombatContext(campaignName);
            const targetCreature = cs?.creatures?.find(c => c.name === targetName);
            const isFiend = targetCreature?.type === 'fiend';

            if (!isFiend) {
                addEntry(campaignName, {
                    type: 'save_result',
                    characterName: playerName,
                    targetName,
                    saveDc,
                    saveType,
                    success: false,
                    description: `${targetName} failed ${saveType} save — hurled through the lower planes.`,
                    timestamp: Date.now(),
                }).catch(() => {});

                addEntry(campaignName, {
                    type: 'damage_roll',
                    characterName: playerName,
                    targetName,
                    damageType: damageType,
                    formula: damageExpression,
                    description: `${targetName} takes ${damageTotal} ${damageType} damage from Hurl Through Hell.`,
                    timestamp: Date.now(),
                }).catch(() => {});
            } else {
                addEntry(campaignName, {
                    type: 'save_result',
                    characterName: playerName,
                    targetName,
                    saveDc,
                    saveType,
                    success: false,
                    description: `${targetName} (Fiend) failed ${saveType} save — hurled through the lower planes but takes no Psychic damage.`,
                    timestamp: Date.now(),
                }).catch(() => {});
            }
        } else {
            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerName,
                targetName,
                saveDc,
                saveType,
                success: true,
                description: `${targetName} succeeded on ${saveType} save — not hurled through the lower planes.`,
                timestamp: Date.now(),
            }).catch(() => {});
        }

        window.removeEventListener('save-result', handleSaveResult);
    };

    window.addEventListener('save-result', handleSaveResult);

    // Build description
    let description = `<b>${featureName}</b><br/><br/>`;
    description += `Target: <b>${targetName}</b><br/><br/>`;
    description += `<b>Disappearance:</b> ${targetName} disappears and hurtles through a nightmare landscape.<br/><br/>`;
    description += `<b>Save:</b> ${targetName} must make a <b>${saveType}</b> saving throw (DC ${saveDc}).<br/><br/>`;
    description += `<b>On a Failed Save:</b> ${targetName} takes <b>${damageTotal} ${damageType} damage</b> (if not a Fiend) and has the <b>Incapacitated</b> condition until the end of your next turn.<br/><br/>`;
    description += `<b>Return:</b> At the end of your next turn, ${targetName} returns to the space it previously occupied, or the nearest unoccupied space.<br/><br/>`;
    description += `<em>Uses remaining: ${maxUses - currentUses - 1} / ${maxUses} (Long Rest).</em>`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description,
            automation: auto,
            saveType,
            saveDc,
            damageType,
            damageTotal,
            targetName,
        },
    };
}
