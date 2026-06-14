import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { buildSaveDc, createSaveListener } from '../common/savePrompt.js';
import { getCombatContext, getTargetFromAttacker } from '../../rules/combat/damageUtils.js';

const USES_KEY = 'clairvoyantCombatantUses';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Clairvoyant Combatant';

    // Check if already active against a target
    const activeKey = 'clairvoyantCombatantTarget';
    const activeTarget = getRuntimeValue(playerName, activeKey, campaignName);

    if (activeTarget) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} is already active against ${activeTarget}. Activate again to change target.`,
                automation: auto,
            },
        };
    }

    // Check uses remaining (1 per Short or Long Rest)
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
                        description: `${featureName}: No uses remaining. Recharges on a Short or Long Rest, or expend a Pact Magic spell slot to restore a use. No Pact Magic slots available.`,
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
                    description: `${featureName}: No uses remaining. Recharges on a Short or Long Rest.`,
                    automation: auto,
                },
            };
        }
    }

    // Increment use counter
    await setRuntimeValue(playerName, USES_KEY, currentUses + 1, campaignName);

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
    const saveType = auto.saveType || 'WIS';

    // Set the combat advantage/disadvantage effects via targetEffects
    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const newEffect = {
        target: targetName,
        source: featureName,
        effect: 'clairvoyant_combatant',
        duration: auto.duration || '1_minute',
        saveType,
        saveDc,
        saveAbility: auto.saveAbility || 'CHA',
        attackerAdvantage: true,
        defenderDisadvantage: true,
    };
    const updatedEffects = [...storedEffects, newEffect];
    setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);

    // Store the active target for contextBuilder
    await setRuntimeValue(playerName, activeKey, targetName, campaignName);

    // Also add to activeBuffs for contextBuilder to detect advantage
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const newBuffs = [...activeBuffs, {
        name: featureName,
        effect: 'clairvoyant_combatant',
        duration: auto.duration || '1_minute',
        target: targetName,
    }];
    setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

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
        description: `${featureName} triggered — ${targetName} must make ${saveType} save (DC ${saveDc}) or suffer combat disadvantage.`,
        targetName,
        promptId,
        timestamp: Date.now(),
    }).catch(() => {});

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;

        if (!event.detail.success) {
            // Target failed the save — effects already applied via targetEffects
            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerName,
                targetName,
                saveDc,
                saveType,
                success: false,
                description: `${targetName} failed ${saveType} save — Clairvoyant Combatant active. Target has Disadvantage on attacks against you, you have Advantage on attacks against target.`,
                timestamp: Date.now(),
            }).catch(() => {});
        } else {
            // Target succeeded — remove the effects
            const filteredEffects = (getRuntimeValue(campaignName, 'targetEffects', campaignName) || []).filter(
                e => !(e.target === targetName && e.source === featureName && e.effect === 'clairvoyant_combatant')
            );
            setRuntimeValue(campaignName, 'targetEffects', filteredEffects, campaignName);

            // Clear the active target
            await setRuntimeValue(playerName, activeKey, null, campaignName);

            // Remove from activeBuffs
            const storedBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
            const buffs = Array.isArray(storedBuffs) ? storedBuffs : [];
            const filteredBuffs = buffs.filter(b => !(b.effect === 'clairvoyant_combatant' && b.target === targetName));
            setRuntimeValue(playerName, 'activeBuffs', filteredBuffs, campaignName);

            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerName,
                targetName,
                saveDc,
                saveType,
                success: true,
                description: `${targetName} succeeded on ${saveType} save — Clairvoyant Combatant has no effect.`,
                timestamp: Date.now(),
            }).catch(() => {});
        }

        window.removeEventListener('save-result', handleSaveResult);
    };

    window.addEventListener('save-result', handleSaveResult);

    // Build description
    let description = `<b>${featureName}</b><br/><br/>`;
    description += `Target: <b>${targetName}</b><br/><br/>`;
    description += `<b>Save:</b> ${targetName} must make a <b>${saveType}</b> saving throw (DC ${saveDc}).<br/><br/>`;
    description += `<b>On a Failed Save:</b> ${targetName} has <b>Disadvantage on attack rolls against you</b>, and <b>you have Advantage on attack rolls against ${targetName}</b> for the duration.<br/><br/>`;
    description += `<em>Uses remaining: ${maxUses - currentUses - 1} / ${maxUses} (Short or Long Rest).</em>`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description,
            automation: auto,
            saveType,
            saveDc,
            targetName,
        },
    };
}
