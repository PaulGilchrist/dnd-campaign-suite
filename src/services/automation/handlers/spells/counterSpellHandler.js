import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Counterspell';
    const saveType = auto.saveType || 'CON';

    const cs = await getCombatContext(campaignName);
    if (!cs) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} requires an active combat. Select a creature in combat and try again.`,
                automation: auto,
            },
        };
    }

    const target = getTargetFromAttacker(cs, playerName);
    if (!target) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} requires a target. Select a creature in combat and try again.`,
                automation: auto,
            },
        };
    }

    const targetName = target.name;

    const saveDc = buildSaveDc(auto, playerStats);

    const { promptId } = createSaveListener(campaignName, {
        targetName,
        saveType,
        saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${featureName} triggered — ${targetName} must make ${saveType} save (DC ${saveDc})`,
        promptId,
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;

        if (!event.detail.success) {
            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerName,
                rollType: `save-${auto.type}`,
                targetName,
                saveDc,
                saveType,
                success: false,
                description: `${targetName} failed ${saveType} save. ${targetName}'s spell is countered and wasted.`,
            }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });
        } else {
            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerName,
                rollType: `save-${auto.type}`,
                targetName,
                saveDc,
                saveType,
                success: true,
                description: `${targetName} succeeded on ${saveType} save. ${featureName} fails to counter the spell.`,
            }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });
        }

        window.removeEventListener('save-result', handleSaveResult);
    };

    window.addEventListener('save-result', handleSaveResult);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            targetName,
            description: `${targetName} must make a ${saveType} saving throw (DC ${saveDc}).`,
            automation: auto,
        },
    };
}
