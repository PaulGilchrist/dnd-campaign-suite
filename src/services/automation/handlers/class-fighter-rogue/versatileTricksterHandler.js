import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../../automation/common/savePrompt.js';

function buildTricksterPopup(action, auto, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name || 'Versatile Trickster',
            automationType: auto.type || 'versatile_trickster',
            description,
            automation: auto,
        },
    };
}

export async function applyVersatileTrickster(action, playerStats, campaignName, secondaryTargetName) {
    const auto = action.automation || {};

    if (!secondaryTargetName) {
        return buildTricksterPopup(action, auto, 'Versatile Trickster: No secondary target selected.');
    }

    // Validate size limit for Trip on secondary target
    const cs = await getCombatContext(campaignName);
    const secondaryTarget = cs?.creatures?.find(c => c.name === secondaryTargetName);

    if (secondaryTarget) {
        const sizeOrder = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
        const targetSizeIndex = sizeOrder.indexOf(secondaryTarget.size);
        if (targetSizeIndex !== -1 && targetSizeIndex > sizeOrder.indexOf('Large')) {
            return buildTricksterPopup(action, auto, `<b>Trip</b> cannot be used on ${secondaryTargetName}: Target is ${secondaryTarget.size} (too large for Trip — only Large or smaller affected).`);
        }
    }

    // Apply Trip effect to secondary target
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const newEffect = {
        target: secondaryTargetName,
        source: action.name || 'Versatile Trickster',
        option: 'Trip',
        effect: 'prone',
        value: null,
        noOpportunityAttacks: false,
        duration: 'until_start_of_next_turn',
        saveType: 'DEX',
        saveDc: 'ability',
        saveAbility: 'DEX',
        condition: 'prone',
        repeatingSave: false,
        requires: null,
        sizeLimit: 'large_or_smaller',
        movement: null,
        cost: null,
        ignoreResistance: false,
        restoreCost: null,
    };
    const updatedEffects = [...storedEffects, newEffect];
    await setRuntimeValue('campaign', 'targetEffects', updatedEffects, campaignName);

    // CLA-376: run a real DEX save for the secondary target, mirroring the
    // primary Trip leg in attackRiderHandler.applyRiderEffect (buildSaveDc +
    // createSaveListener) — save_result is logged by the save listener; prone
    // is applied to the target's activeConditions on a failed save.
    const tripOption = { name: 'Trip', saveDc: 'ability', saveAbility: 'DEX', condition: 'prone' };
    const saveDc = buildSaveDc(tripOption, playerStats);
    const { promise } = createSaveListener(campaignName, {
        targetName: secondaryTargetName,
        saveType: 'DEX',
        saveDc,
        dcSuccess: false,
        saveAbility: 'DEX',
        attackerName: playerStats.name,
        condition: 'prone',
    });

    const saveResult = await promise;
    const saveFailed = saveResult.success === false;

    if (saveFailed) {
        const conditions = getRuntimeValue(secondaryTargetName, 'activeConditions') || [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'prone');
        await setRuntimeValue(secondaryTargetName, 'activeConditions', [...filtered, 'prone'], campaignName);
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Versatile Trickster',
        description: `Trip applied to ${secondaryTargetName} (secondary target via Versatile Trickster) — ${secondaryTargetName} rolled ${saveResult.roll} on DEX save (DC ${saveDc}), ${saveResult.success ? 'succeeded — no effect' : 'failed — prone condition applied'}`,
    }).catch((e) => { console.error("[versatileTricksterHandler:log-error]", e); });

    return buildTricksterPopup(action, auto, saveFailed
        ? `Versatile Trickster: Trip also applied to ${secondaryTargetName} — failed its Dexterity save (DC ${saveDc}) and gained the Prone condition.`
        : `Versatile Trickster: Trip also applied to ${secondaryTargetName} — succeeded its Dexterity save (DC ${saveDc}) — no effect.`);
}
