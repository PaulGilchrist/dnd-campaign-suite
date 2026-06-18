import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const STUNNING_STRIKE_EFFECTS = {
    success: [
        { type: 'speed_halved', condition: 'speed_halved' },
        { type: 'advantage_on_target' },
    ],
    fail: [
        { type: 'stunned', condition: 'stunned' },
    ],
};

function getDefaultEffects(automationName) {
    if (automationName === 'Stunning Strike') {
        return STUNNING_STRIKE_EFFECTS;
    }
    return { success: [], fail: [{ type: 'stunned', condition: 'stunned' }] };
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    const saveDc = buildSaveDc(auto, playerStats);
    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    const targetName = targetInfo?.target?.name || playerStats.name;

    const effects = auto.effects || getDefaultEffects(action.name);
    const { promptId } = createSaveListener(campaignName, {
        targetName,
        saveType: auto.saveType || 'CON',
        saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} triggered — target ${targetName} must make ${auto.saveType || 'CON'} save (DC ${saveDc})`,
        promptId,
    }).catch((e) => { console.error("[saveOnly] Error:", e); throw e; });

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;

        const storedConditions = getRuntimeValue(targetName, 'activeConditions') || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const isSuccessful = event.detail.success;

        if (isSuccessful) {
            applySuccessEffects(effects.success, targetName, playerStats.name, campaignName);

            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerStats.name,
                rollType: `save-${auto.type}`,
                targetName,
                saveDc,
                saveType: auto.saveType || 'CON',
                success: true,
                description: `${targetName} succeeded on ${auto.saveType || 'CON'} save. Speed halved until start of next turn.`,
            }).catch((e) => { console.error("[saveOnly] Error:", e); throw e; });

            addExpiration(playerStats.name, targetName, [
                { type: 'stunned', condition: 'speed_halved' },
                { type: 'advantage_on_target' }
            ], campaignName);
        } else {
            const newConditions = [...conditions, effects.fail?.[0]?.condition || 'stunned'];
            setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);

            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerStats.name,
                rollType: `save-${auto.type}`,
                targetName,
                saveDc,
                saveType: auto.saveType || 'CON',
                success: false,
                description: `${targetName} failed ${auto.saveType || 'CON'} save. Stunned until start of next turn.`,
            }).catch((e) => { console.error("[saveOnly] Error:", e); throw e; });

            addExpiration(playerStats.name, targetName, [
                { type: 'stunned', condition: 'stunned' }
            ], campaignName);
        }

        window.removeEventListener('save-result', handleSaveResult);
    };

    window.addEventListener('save-result', handleSaveResult);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            targetName,
            description: `Target ${targetName} must make a ${auto.saveType || 'CON'} saving throw (DC ${saveDc}).`,
            automation: auto,
        },
    };
}

function applySuccessEffects(effects, targetName, attackerName, campaignName) {
    for (const effect of effects) {
        switch (effect.type) {
            case 'speed_halved':
                setRuntimeValue(targetName, `${effect.condition}_${Date.now()}`, true, campaignName);
                break;
            case 'advantage_on_target': {
                const advKey = `_advantageOn_${targetName}`;
                const storedAdv = getRuntimeValue(attackerName, advKey) || [];
                if (!storedAdv.includes(targetName)) {
                    setRuntimeValue(attackerName, advKey, [...storedAdv, targetName], campaignName);
                  }
                break;
            }
          }
    }
}
