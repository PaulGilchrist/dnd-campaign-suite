import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);
    const targetName = auto.targetName || 'Unknown';

    // Check target is in combat context (player or NPC)
    const cs = await getCombatContext(campaignName);
    const targetCreature = cs?.creatures?.find(c => c.name === targetName);
    const isPlayerTarget = targetCreature?.type === 'player';

    // Track active Friends for early-end conditions
    const activeKey = `_activeFriends_${playerStats.name}`;
    setRuntimeValue(campaignName, activeKey, targetName, campaignName);

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'WIS',
        saveDc: dc,
        dcSuccess: 'none',
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Friends',
        description: `${playerStats.name} casts Friends on ${targetName}. ${targetName} must make a WIS save (DC ${dc}) or be Charmed.`,
        promptId,
    }).catch(() => {});

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
        }).catch(() => {});

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

    if (isPlayerTarget) {
        const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== condKey);
        setRuntimeValue(targetName, 'activeConditions', [...filtered, condKey], campaignName);
    } else if (targetCreature) {
        targetCreature.conditions = (targetCreature.conditions || []).filter(c => c.key !== condKey);
        targetCreature.conditions.push({
            id: crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
            key: condKey,
            label: 'Charmed',
            dc: dc,
            ability: 'wis',
            endsOnDamage: true,
        });
    }

    // Apply expiration (2 rounds = 12 seconds minimum; concentration handles the rest)
    addExpiration(playerStats.name, targetName, [
        { type: 'condition', condition: condKey },
    ], campaignName, 2);

    postLogEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Charmed',
        reason: 'Friends cantrip',
        note: `${targetName} is Charmed by ${playerStats.name} (Concentration, up to 1 minute). Spell ends if ${playerStats.name} makes an attack roll, deals damage, or forces a save.`,
        timestamp: Date.now(),
    });

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
