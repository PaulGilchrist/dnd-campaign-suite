import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';


export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);
    const targetName = auto.targetName || 'Unknown';

    // Track active Friends for early-end conditions
    const activeKey = `_activeFriends_${playerStats.name}`;
    setRuntimeValue(campaignName, activeKey, targetName, campaignName);

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        attackerName: playerStats.name,
        saveType: 'WIS',
        saveDc: dc,
        dcSuccess: 'none',
        disadvantage: !!action.metaCtx?.metamagicHeighten,
        condition: 'charmed',
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Friends',
        description: `${playerStats.name} casts Friends on ${targetName}. ${targetName} must make a WIS save (DC ${dc}) or be Charmed.`,
        promptId,
    }).catch((e) => { console.error("[friends] Error:", e); });

    const saveResult = await promise;

    if (saveResult.success) {
        addEntry(campaignName, {
            type: 'save_result',
            characterName: playerStats.name,
            rollType: 'save-friends',
            targetName,
            saveDc: dc,
            saveType: 'WIS',
            success: true,
            description: `${targetName} succeeded on WIS save against Friends.`,
        }).catch((e) => { console.error("[friends] Error:", e); });

        // Clear active Friends tracking since spell had no effect
        setRuntimeValue(campaignName, activeKey, null, campaignName);

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Friends',
                description: `${targetName} succeeded on the Wisdom save. Friends has no effect.`,
            },
        };
    }

    // ── Failed save: apply Charmed ──

    const condKey = 'charmed';
    const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== condKey);
    setRuntimeValue(targetName, 'activeConditions', [...filtered, condKey], campaignName);

    // Apply expiration (2 rounds = 12 seconds minimum; concentration handles the rest)
    addExpiration(playerStats.name, targetName, [
        { type: 'condition', condition: condKey },
    ], campaignName, 2);

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Charmed',
        reason: 'Friends cantrip',
        note: `${targetName} is Charmed by ${playerStats.name} (Concentration, up to 1 minute). Spell ends if ${playerStats.name} makes an attack roll, deals damage, or forces a save.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[friends] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Friends',
            targetName,
            description: `${targetName} failed the WIS save and is Charmed (Concentration, up to 1 min). The spell ends early if you make an attack roll, deal damage, or force a saving throw. When the spell ends, ${targetName} will know it was Charmed by you.`,
            automation: auto,
        },
    };
}
