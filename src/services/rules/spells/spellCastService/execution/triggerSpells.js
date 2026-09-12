import { triggerFalseLife } from '../../../features/falseLifeService.js';
import { triggerSeeInvisibility } from '../../../features/seeInvisibilityService.js';
import { triggerFleshToStone } from '../../../features/fleshToStoneService.js';
import { triggerHoldMonster } from '../../../features/holdMonsterService.js';
import { triggerBanishment } from '../../../features/banishmentService.js';
import { triggerConfusion } from '../../../features/confusionService.js';
import { triggerMaze } from '../../../features/mazeService.js';
import { triggerPowerWordStun } from '../../../features/powerWordStunService.js';
import { triggerHypnoticPattern } from '../../../features/hypnoticPatternService.js';
import { triggerSlow } from '../../../features/slowService.js';
import { triggerBaneSpell } from '../../../features/baneService.js';
import { triggerBlessSpell } from '../../../features/blessService.js';
import { triggerBeaconOfHope } from '../../../features/beaconOfHopeService.js';
import { triggerMassSuggestion } from '../../../features/massSuggestionService.js';
import { triggerSuggestion } from '../../../features/suggestionService.js';
import { triggerOttoDance } from '../../../features/ottoDanceService.js';
import { triggerResilientSphere } from '../../../features/resilientSphereService.js';
import { triggerBlur } from '../../../features/blurService.js';
import { triggerExpeditiousRetreat } from '../../../features/expeditiousRetreatService.js';
import { triggerFriends } from '../../../features/friendsService.js';
import { triggerCrownOfMadness } from '../../../features/crownOfMadnessService.js';
import { triggerAnimalFriendship } from '../../../features/animalFriendshipService.js';
import { triggerDominateBeast } from '../../../features/dominateBeastService.js';
import { triggerDominateMonster } from '../../../features/dominateMonsterService.js';
import { triggerDominatePerson } from '../../../features/dominatePersonService.js';
import { triggerRayOfEnfeeblement } from '../../../features/rayOfEnfeeblementService.js';
import { triggerCompelledDuel } from '../../../features/compelledDuelService.js';
import { triggerGlobeOfInvulnerability } from '../../../features/globeOfInvulnerabilityService.js';
import { triggerForcecage } from '../../../features/forcecageService.js';
import { triggerStinkingCloud } from '../../../features/stinkingCloudService.js';
import { triggerSleetStorm } from '../../../features/sleetStormService.js';
import { triggerFaerieFire } from '../../../features/faerieFireService.js';
import { triggerTashasHideousLaughter } from '../../../features/tashasHideousLaughterService.js';
import { triggerImprisonment } from '../../../features/imprisonmentService.js';
import { triggerHolyAura } from '../../../features/holyAuraService.js';
import { triggerMassCureWounds } from '../../../features/massCureWoundsService.js';
import { triggerMassHealingWord } from '../../../features/massHealingWordService.js';
import { triggerPrayerOfHealing } from '../../../features/prayerOfHealingService.js';
import { triggerRemoveCurse } from '../../../features/removeCurseService.js';
import { checkCompelledDuelAttackExpiry } from '../../../../automation/index.js';

const SERVICE_HANDLED_SPELLS = new Set([
    "otto's irresistible dance", 'irresistible dance',
    "otiluke's resilient sphere", 'resilient sphere',
    'blur',
    'expeditious retreat',
    'friends',
    'crown of madness',
    'animal friendship',
    'dominate beast',
    'dominate monster',
    'dominate person',
    'tasha\'s hideous laughter', 'hideous laughter',
    'ray of enfeeblement',
    'hex',
    'command',
]);

async function handleRegenerate(spell, getTargetInfo, applyRegenerateSpell, playerStats, campaignName) {
    if (spell.name && spell.name.toLowerCase() === 'regenerate') {
        const target = await getTargetInfo();
        if (target?.name) {
            return { handled: true, result: await applyRegenerateSpell(spell, target, playerStats, campaignName) };
        }
        return { handled: true, result: null };
    }
    return { handled: false };
}

async function handleSeeInvisibility(spell, metaCtx, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'see invisibility') {
        await triggerSeeInvisibility(spell, metaCtx, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleFleshToStone(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'flesh to stone') {
        await triggerFleshToStone(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleHoldMonster(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && (spell.name.toLowerCase() === 'hold monster' || spell.name.toLowerCase() === 'hold person')) {
        await triggerHoldMonster(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleBanishment(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'banishment') {
        await triggerBanishment(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleConfusion(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'confusion') {
        await triggerConfusion(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleMaze(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'maze') {
        await triggerMaze(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handlePowerWordStun(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'power word stun') {
        const pwsResult = await triggerPowerWordStun(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        if (pwsResult) {
            return { handled: true, result: { automationPopup: pwsResult } };
        }
        return { handled: true };
    }
    return { handled: false };
}

async function handleHypnoticPattern(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'hypnotic pattern') {
        await triggerHypnoticPattern(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleSlow(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'slow') {
        await triggerSlow(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleBane(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'bane') {
        await triggerBaneSpell(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleBless(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'bless') {
        await triggerBlessSpell(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleBeaconOfHope(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'beacon of hope') {
        await triggerBeaconOfHope(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleMassSuggestion(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'mass suggestion') {
        await triggerMassSuggestion(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleSuggestion(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'suggestion') {
        await triggerSuggestion(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleCommand(spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'command') {
        const commandTarget = await getTargetInfo();
        return {
            handled: true,
            result: {
                automationPopup: {
                    type: 'modal',
                    modalName: 'commandChoice',
                    payload: {
                        spell,
                        metaCtx: { ...metaCtx, spellSaveDc },
                        targetName: commandTarget?.name,
                        playerStats,
                        campaignName,
                        mapName,
                    },
                },
            },
        };
    }
    return { handled: false };
}

async function handleOttoDance(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && (spell.name.toLowerCase() === "otto's irresistible dance" || spell.name.toLowerCase() === 'irresistible dance')) {
        await triggerOttoDance(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleResilientSphere(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && (spell.name.toLowerCase() === "otiluke's resilient sphere" || spell.name.toLowerCase() === 'resilient sphere')) {
        await triggerResilientSphere(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleBlur(spell, metaCtx, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'blur') {
        await triggerBlur(spell, metaCtx, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleExpeditiousRetreat(spell, metaCtx, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'expeditious retreat') {
        await triggerExpeditiousRetreat(spell, metaCtx, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleFriends(spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'friends') {
        const friendsTarget = await getTargetInfo();
        const friendsMetaCtx = { ...metaCtx, spellSaveDc, targetName: friendsTarget?.name };
        const friendsResult = await triggerFriends(spell, friendsMetaCtx, playerStats, campaignName, mapName);
        if (friendsResult) {
            return { handled: true, result: { automationPopup: friendsResult } };
        }
        return { handled: true };
    }
    return { handled: false };
}

async function handleCrownOfMadness(spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'crown of madness') {
        const crownTarget = await getTargetInfo();
        const crownResult = await triggerCrownOfMadness(spell, { ...metaCtx, spellSaveDc, targetName: crownTarget?.name }, playerStats, campaignName, mapName);
        if (crownResult) {
            return { handled: true, result: { automationPopup: crownResult } };
        }
        return { handled: true };
    }
    return { handled: false };
}

async function handleAnimalFriendship(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'animal friendship') {
        const animalFriendshipResult = await triggerAnimalFriendship(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        if (animalFriendshipResult) {
            return { handled: true, result: { automationPopup: animalFriendshipResult } };
        }
        return { handled: true };
    }
    return { handled: false };
}

async function handleDominateBeast(spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'dominate beast') {
        const dominateBeastTarget = await getTargetInfo();
        const dominateBeastResult = await triggerDominateBeast(spell, { ...metaCtx, spellSaveDc, targetName: dominateBeastTarget?.name }, playerStats, campaignName, mapName);
        if (dominateBeastResult) {
            return { handled: true, result: { automationPopup: dominateBeastResult } };
        }
        return { handled: true };
    }
    return { handled: false };
}

async function handleDominateMonster(spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'dominate monster') {
        const dominateMonsterTarget = await getTargetInfo();
        checkCompelledDuelAttackExpiry(playerStats.name, dominateMonsterTarget?.name, campaignName);
        const dominateMonsterResult = await triggerDominateMonster(spell, { ...metaCtx, spellSaveDc, targetName: dominateMonsterTarget?.name }, playerStats, campaignName, mapName);
        if (dominateMonsterResult) {
            return { handled: true, result: { automationPopup: dominateMonsterResult } };
        }
        return { handled: true };
    }
    return { handled: false };
}

async function handleDominatePerson(spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'dominate person') {
        const dominatePersonTarget = await getTargetInfo();
        checkCompelledDuelAttackExpiry(playerStats.name, dominatePersonTarget?.name, campaignName);
        const dominatePersonResult = await triggerDominatePerson(spell, { ...metaCtx, spellSaveDc, targetName: dominatePersonTarget?.name }, playerStats, campaignName, mapName);
        if (dominatePersonResult) {
            return { handled: true, result: { automationPopup: dominatePersonResult } };
        }
        return { handled: true };
    }
    return { handled: false };
}

async function handleRayOfEnfeeblement(spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'ray of enfeeblement') {
        const rayTarget = await getTargetInfo();
        checkCompelledDuelAttackExpiry(playerStats.name, rayTarget?.name, campaignName);
        await triggerRayOfEnfeeblement(spell, { ...metaCtx, spellSaveDc, targetName: rayTarget?.name }, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleCompelledDuel(spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'compelled duel') {
        const duelTarget = await getTargetInfo();
        const duelResult = await triggerCompelledDuel(spell, { ...metaCtx, spellSaveDc, targetName: duelTarget?.name }, playerStats, campaignName, mapName);
        if (duelResult) {
            return { handled: true, result: { automationPopup: duelResult } };
        }
        return { handled: true };
    }
    return { handled: false };
}

async function handleGlobeOfInvulnerability(spell, metaCtx, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'globe of invulnerability') {
        const result = await triggerGlobeOfInvulnerability(spell, metaCtx, playerStats, campaignName, mapName);
        if (result) {
            return { handled: true, result: { automationPopup: result } };
        }
        return { handled: true };
    }
    return { handled: false };
}

async function handleForcecage(spell, metaCtx, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'forcecage') {
        const result = await triggerForcecage(spell, metaCtx, playerStats, campaignName, mapName);
        if (result) {
            return { handled: true, result: { automationPopup: result } };
        }
        return { handled: true };
    }
    return { handled: false };
}

async function handleStinkingCloud(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'stinking cloud') {
        await triggerStinkingCloud(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleSleetStorm(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'sleet storm') {
        await triggerSleetStorm(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleFaerieFire(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'faerie fire') {
        const ffResult = await triggerFaerieFire(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        if (ffResult) {
            return { handled: true, result: { automationPopup: ffResult } };
        }
        return { handled: true };
    }
    return { handled: false };
}

async function handleTashasHideousLaughter(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === "tasha's hideous laughter") {
        const result = await triggerTashasHideousLaughter(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        return { handled: true, result };
    }
    return { handled: false };
}

async function handleImprisonment(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'imprisonment') {
        const result = await triggerImprisonment(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
        if (result) {
            return { handled: true, result: { automationPopup: result } };
        }
        return { handled: true };
    }
    return { handled: false };
}

async function handleHolyAura(spell, metaCtx, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'holy aura') {
        await triggerHolyAura(spell, metaCtx, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleMassCureWounds(spell, metaCtx, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'mass cure wounds') {
        await triggerMassCureWounds(spell, metaCtx, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleMassHealingWord(spell, metaCtx, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'mass healing word') {
        await triggerMassHealingWord(spell, metaCtx, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handlePrayerOfHealing(spell, metaCtx, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'prayer of healing') {
        await triggerPrayerOfHealing(spell, metaCtx, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleFalseLife(spell, metaCtx, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'false life') {
        await triggerFalseLife(spell, metaCtx, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleRemoveCurse(spell, metaCtx, playerStats, campaignName, mapName) {
    if (spell.name && spell.name.toLowerCase() === 'remove curse') {
        await triggerRemoveCurse(spell, metaCtx, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleGenericAutomation({ spell, executeHandler, playerStats, campaignName, mapName, characters, metaCtx }) {
    const spellNameLower = (spell.name || '').toLowerCase();
    if (spell.automation?.type && !spell.automation?.effects?.fail && !spell.automation?.effects?.success && !SERVICE_HANDLED_SPELLS.has(spellNameLower)) {
        const action = {
            name: spell.name,
            spell: spell,
            automation: spell.automation,
            metaCtx: { ...metaCtx },
        };
        const handlerResult = await executeHandler(action, playerStats, campaignName, mapName, characters);
        if (handlerResult) {
            return { handled: true, result: { automationPopup: handlerResult } };
        }
        return { handled: true };
    }
    return { handled: false };
}

async function handleHeroism(spell, playerStats, campaignName, mapName, characters, executeHandler) {
    if (spell.name && spell.name.toLowerCase() === 'heroism') {
        const action = {
            name: spell.name,
            spell: spell,
            automation: spell.automation || { type: 'heroism' },
        };
        const heroismResult = await executeHandler(action, playerStats, campaignName, mapName, characters);
        if (heroismResult) {
            return { handled: true, result: { automationPopup: heroismResult } };
        }
        return { handled: true };
    }
    return { handled: false };
}

async function handleLongstrider(spell, playerStats, campaignName, mapName, executeHandler) {
    if (spell.name && spell.name.toLowerCase() === 'longstrider') {
        const action = {
            name: 'Longstrider',
            spell: spell,
            automation: { type: 'longstrider' },
        };
        const longstriderResult = await executeHandler(action, playerStats, campaignName, mapName);
        if (longstriderResult) {
            return { handled: true, result: { automationPopup: longstriderResult } };
        }
        return { handled: true };
    }
    return { handled: false };
}

async function handleSpareTheDying(spell, playerStats, campaignName, mapName, characters, executeHandler) {
    if (spell.name && spell.name.toLowerCase() === 'spare the dying') {
        const action = {
            name: 'Spare the Dying',
            spell: spell,
            automation: spell.automation || { type: 'spare_the_dying' },
        };
        const spareResult = await executeHandler(action, playerStats, campaignName, mapName, characters);
        if (spareResult) {
            return { handled: true, result: { automationPopup: spareResult } };
        }
        return { handled: true };
    }
    return { handled: false };
}

async function handleEnhanceAbility(spell, metaCtx, playerStats, campaignName, mapName, characters, executeHandler) {
    if (spell.name && spell.name.toLowerCase() === 'enhance ability') {
        const action = {
            name: spell.name,
            spell: spell,
            automation: spell.automation || { type: 'enhance_ability', range: 'Touch' },
            metaCtx,
        };
        const enhanceResult = await executeHandler(action, playerStats, campaignName, mapName, characters);
        if (enhanceResult) {
            return { handled: true, result: { automationPopup: enhanceResult } };
        }
        return { handled: true };
    }
    return { handled: false };
}

async function handleProtectionFromEnergy(spell, playerStats, campaignName, mapName, executeHandler) {
    if (spell.name && spell.name.toLowerCase() === 'protection from energy') {
        const action = {
            name: 'Protection from Energy',
            spell: spell,
            automation: spell.automation ?? {},
        };
        await executeHandler(action, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleProtectionFromPoison(spell, playerStats, campaignName, mapName, executeHandler) {
    if (spell.name && spell.name.toLowerCase() === 'protection from poison') {
        const action = {
            name: 'Protection from Poison',
            spell: spell,
            automation: spell.automation ?? {},
        };
        await executeHandler(action, playerStats, campaignName, mapName);
        return { handled: true };
    }
    return { handled: false };
}

async function handleResistance(spell, playerStats, campaignName, mapName, characters, executeHandler, metaCtx) {
    if (spell.name && spell.name.toLowerCase() === 'resistance') {
        const action = {
            name: 'Resistance',
            spell: spell,
            automation: spell.automation ?? {},
            metaCtx,
        };
        await executeHandler(action, playerStats, campaignName, mapName, characters);
        return { handled: true };
    }
    return { handled: false };
}

export {
    handleRegenerate,
    handleSeeInvisibility,
    handleFleshToStone,
    handleHoldMonster,
    handleBanishment,
    handleConfusion,
    handleMaze,
    handlePowerWordStun,
    handleHypnoticPattern,
    handleSlow,
    handleBane,
    handleBless,
    handleBeaconOfHope,
    handleMassSuggestion,
    handleSuggestion,
    handleCommand,
    handleOttoDance,
    handleResilientSphere,
    handleBlur,
    handleExpeditiousRetreat,
    handleFriends,
    handleCrownOfMadness,
    handleAnimalFriendship,
    handleDominateBeast,
    handleDominateMonster,
    handleDominatePerson,
    handleRayOfEnfeeblement,
    handleCompelledDuel,
    handleGlobeOfInvulnerability,
    handleForcecage,
    handleStinkingCloud,
    handleSleetStorm,
    handleFaerieFire,
    handleTashasHideousLaughter,
    handleImprisonment,
    handleHolyAura,
    handleMassCureWounds,
    handleMassHealingWord,
    handlePrayerOfHealing,
    handleFalseLife,
    handleRemoveCurse,
    handleHeroism,
    handleLongstrider,
    handleSpareTheDying,
    handleEnhanceAbility,
    handleProtectionFromEnergy,
    handleProtectionFromPoison,
    handleResistance,
    handleGenericAutomation,
    SERVICE_HANDLED_SPELLS,
};
