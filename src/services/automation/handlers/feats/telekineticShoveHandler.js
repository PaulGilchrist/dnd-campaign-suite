import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getEffectDefinition, registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';
import { resolveFeatChosenAbility } from '../../../shared/abilityLookup.js';

const LATCH_KEY = '_Telekinetic_Shove_usedRound';
const FEAT_NAME = 'Telekinesis';

// FT-094: Telekinetic Shove (2024 Telekinesis feat) — "As a Bonus Action" once per
// turn. Latch `_Telekinetic_Shove_usedRound` on playerStats.name (round from fresh
// getCombatContext, cleared at round-wrap in initiative.jsx + navigationHandlers.js).
// DC ability derives from the ASI actually chosen (featAbilityChoices "Telekinesis-<idx>"),
// falling back to the feats.json saveAbility when no ASI choice exists. Failed save
// writes the verified CLA-357 `telekinetic_movement` te mirror (value+movedDistanceFt).
export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const pushDistance = auto.pushDistance || 5;
    const playerName = playerStats.name;

    const cs = await getCombatContext(campaignName);
    const round = cs?.round ?? 1;

    const refusal = (reason) => ({
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: ${reason}`,
            automation: auto,
        },
    });

    const latch = getRuntimeValue(playerName, LATCH_KEY, campaignName);
    if (latch && (latch.round ?? 0) >= round) {
        const reason = 'You have already used your telekinetic shove this turn.';
        await addEntry(campaignName, {
            type: 'automation',
            characterName: playerName,
            automationType: 'telekinetic_shove_refused',
            name: action.name,
            description: `${action.name} refused — ${reason}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[telekineticShove:log-error]", e); });
        return refusal(reason);
    }

    // Derive DC ability from the ASI chosen for this feat, not the hardcoded data value.
    const saveAbility = resolveFeatChosenAbility(FEAT_NAME, playerStats.featAbilityChoices)
        || auto.saveAbility
        || 'INT';
    const saveDc = buildSaveDc({ ...auto, saveAbility }, playerStats);

    // Stamp the latch at trigger — the bonus action is spent even if the target saves.
    await setRuntimeValue(playerName, LATCH_KEY, { round, activeCreature: playerName }, campaignName);

    const targetInfo = await resolveTarget(campaignName, playerName);
    const targetName = targetInfo?.target?.name || playerName;

    const saveType = auto.saveType || 'STR';

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        attackerName: playerName,
        saveType,
        saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${action.name} triggered — target ${targetName} must make ${saveType} save (DC ${saveDc}) or be pushed ${pushDistance} feet`,
        promptId,
    }).catch((e) => { console.error("[telekineticShove] Error:", e); });

    const saveResult = await promise;
    const success = saveResult.success;

    if (!success) {
        if (!getEffectDefinition('telekinetic_movement')) {
            console.error('[telekineticShove] Missing telekinetic_movement entry in targetEffectDefinitions registry');
        }
        registerTargetEffect(campaignName, targetName, 'telekinetic_movement', action.name, {
            value: pushDistance,
            movedDistanceFt: pushDistance,
            duration: 'instant',
        });

        addEntry(campaignName, {
            type: 'save_result',
            characterName: playerName,
            rollType: `save-${auto.type}`,
            targetName,
            saveDc,
            saveType,
            success: false,
            description: `${targetName} failed ${saveType} save. Pushed ${pushDistance} feet.`,
        }).catch((e) => { console.error("[telekineticShove] Error:", e); });
    } else {
        addEntry(campaignName, {
            type: 'save_result',
            characterName: playerName,
            rollType: `save-${auto.type}`,
            targetName,
            saveDc,
            saveType,
            success: true,
            description: `${targetName} succeeded on ${saveType} save. No effect.`,
        }).catch((e) => { console.error("[telekineticShove] Error:", e); });
    }

    const popupDescription = success
        ? `${targetName} succeeded on the ${saveType} saving throw (DC ${saveDc}). No effect.`
        : `${targetName} failed the ${saveType} saving throw (DC ${saveDc}). Pushed ${pushDistance} feet toward or away from you.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            targetName,
            description: popupDescription,
            automation: auto,
        },
    };
}
