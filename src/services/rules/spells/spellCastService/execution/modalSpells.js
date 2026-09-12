import { handle as handleShapechangeHandler } from '../../../../automation/handlers/spells/shapechangeHandler.js';
import { getCombatContext } from '../../../combat/damageUtils.js';

// CLA-392: Words of Creation spread — the spell ALWAYS affects the resolved
// first target, plus the optional second creature in metaCtx.multiTarget.
// The old if/else applied to multiTarget OR first target, silently skipping
// the first when a second was chosen. The 10-ft second-target gate has no
// live position seam on this chooser path (gridless lenient pass — adjudicated).
async function handlePowerWordHeal(spell, metaCtx, getTargetInfo, playerStats, campaignName, applyPowerWordHealToTarget) {
    if (spell.name.toLowerCase() === 'power word heal') {
        const target = await getTargetInfo();
        const firstTargetName = target?.name || null;
        const sharedCombatSummary = (firstTargetName || metaCtx?.multiTarget) ? await getCombatContext(campaignName) : null;
        if (firstTargetName) {
            await applyPowerWordHealToTarget(firstTargetName, playerStats, campaignName, sharedCombatSummary);
        }
        if (metaCtx?.multiTarget && metaCtx.multiTarget !== firstTargetName) {
            await applyPowerWordHealToTarget(metaCtx.multiTarget, playerStats, campaignName, sharedCombatSummary);
        }
        return { handled: true };
    }
    return { handled: false };
}

async function handlePowerWordKill(spell, metaCtx, getTargetInfo, playerStats, campaignName, applyPowerWordKillToTarget) {
    if (spell.name && spell.name.toLowerCase() === 'power word kill') {
        const target = await getTargetInfo();
        const firstTargetName = target?.name || null;
        const sharedCombatSummary = (firstTargetName || metaCtx?.multiTarget) ? await getCombatContext(campaignName) : null;
        if (firstTargetName) {
            await applyPowerWordKillToTarget(firstTargetName, playerStats, campaignName, sharedCombatSummary);
        }
        if (metaCtx?.multiTarget && metaCtx.multiTarget !== firstTargetName) {
            await applyPowerWordKillToTarget(metaCtx.multiTarget, playerStats, campaignName, sharedCombatSummary);
        }
        return { handled: true };
    }
    return { handled: false };
}

function handleMassSuggestion(spell, spellSaveDc, playerStats, campaignName) {
    if (spell.name && spell.name.toLowerCase() === 'mass suggestion' && spellSaveDc) {
        return {
            handled: true,
            result: {
                automationPopup: {
                    type: 'modal',
                    modalName: 'massSuggestion',
                    payload: {
                        action: { name: 'Mass Suggestion', automation: { type: 'mass_suggestion' } },
                        playerStats,
                        campaignName,
                        saveType: 'WIS',
                        saveDc: spellSaveDc,
                    },
                },
            },
        };
    }
    return { handled: false };
}

function handleCalmEmotions(fullSpell, spellSaveDc, playerStats, campaignName, metaCtx) {
    if (fullSpell.name && fullSpell.name.toLowerCase() === 'calm emotions' && fullSpell.dc) {
        const calmEmotionsModalPayload = {
            action: { name: 'Calm Emotions', automation: { type: 'calm_emotions' } },
            playerStats,
            campaignName,
            saveType: 'CHA',
            saveDc: spellSaveDc,
            activeOverlay: null,
            metamagicCareful: metaCtx?.metamagicCareful || false,
            metamagicHeighten: metaCtx?.metamagicHeighten,
        };
        return {
            handled: true,
            result: {
                automationPopup: {
                    type: 'modal',
                    modalName: 'calmEmotions',
                    payload: calmEmotionsModalPayload,
                },
            },
        };
    }
    return { handled: false };
}

function handleHypnoticPatternEarly(fullSpell, spellSaveDc, playerStats, campaignName, metaCtx, innateSorceryActive) {
    if (fullSpell.name && fullSpell.name.toLowerCase() === 'hypnotic pattern' && fullSpell.dc) {
        const hypnoticInnateBonus = innateSorceryActive ? 1 : 0;
        const hypnoticModalPayload = {
            action: { name: 'Hypnotic Pattern', automation: { type: 'hypnotic_pattern' } },
            playerStats,
            campaignName,
            saveType: 'WIS',
            saveDc: spellSaveDc + hypnoticInnateBonus,
            activeOverlay: null,
            metamagicCareful: metaCtx?.metamagicCareful || false,
            metamagicHeighten: metaCtx?.metamagicHeighten,
        };
        return {
            handled: true,
            result: {
                automationPopup: {
                    type: 'modal',
                    modalName: 'hypnoticPattern',
                    payload: hypnoticModalPayload,
                },
            },
        };
    }
    return { handled: false };
}

function handleSleep(fullSpell, spellSaveDc, playerStats, campaignName, metaCtx, characters) {
    if (fullSpell.name && fullSpell.name.toLowerCase() === 'sleep' && fullSpell.dc) {
        const sleepModalPayload = {
            action: { name: 'Sleep', automation: { type: 'sleep' } },
            spell: fullSpell,
            playerStats,
            campaignName,
            saveType: 'WIS',
            saveDc: spellSaveDc,
            characters: characters || null,
            metamagicCareful: metaCtx?.metamagicCareful || false,
            metamagicHeighten: metaCtx?.metamagicHeighten,
        };
        return {
            handled: true,
            result: {
                automationPopup: {
                    type: 'modal',
                    modalName: 'sleep',
                    payload: sleepModalPayload,
                },
            },
        };
    }
    return { handled: false };
}

function handleConfusionEarly({ fullSpell, spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName, triggerConfusion }) {
    if (fullSpell.name && fullSpell.name.toLowerCase() === 'confusion' && fullSpell.dc) {
        return {
            handled: true,
            result: (async () => {
                await triggerConfusion(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
                return { handled: true };
            })(),
        };
    }
    return { handled: false };
}

function handleShapechange(fullSpell, metaCtx, playerStats, campaignName, mapName, characters) {
    if (fullSpell.name && fullSpell.name.toLowerCase() === 'shapechange') {
        const action = {
            name: fullSpell.name,
            spell: fullSpell,
            automation: { type: 'shapechange' },
            metaCtx: { ...metaCtx, characters },
        };
        return {
            handled: true,
            result: (async () => {
                const popup = await handleShapechangeHandler(action, playerStats, campaignName, mapName, characters);
                if (popup) {
                    return { automationPopup: popup };
                }
                return null;
            })(),
        };
    }
    return { handled: false };
}

function handleFear(spell, spellSaveDc, playerStats, campaignName, metaCtx, innateSorceryActive) {
    if (spell.name && spell.name.toLowerCase() === 'fear' && spell.dc) {
        const fearInnateBonus = innateSorceryActive ? 1 : 0;
        const fearModalPayload = {
            action: { name: 'Fear', automation: { type: 'fear' } },
            playerStats,
            campaignName,
            saveType: 'WIS',
            saveDc: spellSaveDc + fearInnateBonus,
            activeOverlay: null,
            metamagicCareful: metaCtx?.metamagicCareful || false,
            metamagicHeighten: metaCtx?.metamagicHeighten,
        };
        return {
            handled: true,
            result: {
                automationPopup: {
                    type: 'modal',
                    modalName: 'fear',
                    payload: fearModalPayload,
                },
            },
        };
    }
    return { handled: false };
}

function handleConjureVolley(spell, fullSpell) {
    if (spell.name && spell.name.toLowerCase() === 'conjure volley') {
        const description = fullSpell.description ? fullSpell.description.join(' ') : '';
        return {
            handled: true,
            result: {
                automationPopup: {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Conjure Volley',
                        description: description,
                    },
                },
            },
        };
    }
    return { handled: false };
}

function handleSilence({ spell, metaCtx, playerStats, campaignName, getCombatSummary }) {
    if (spell.name && spell.name.toLowerCase() === 'silence') {
        const rangeFeet = (() => {
            const match = String(spell.range || '120 feet').match(/(\d+)-?foot/);
            return match ? parseInt(match[1], 10) : 120;
        })();
        const aoeSize = spell.area_of_effect?.size || '20-foot-radius';
        const aoeMatch = aoeSize.match(/(\d+)-foot-radius/);
        const aoeRadius = aoeMatch ? parseInt(aoeMatch[1], 10) : 20;
        const slotLevel = metaCtx?.slotLevel || spell.level || 2;

        const combatSummary = getCombatSummary(campaignName) || { creatures: [], players: [] };
        const allCreatures = [
            ...combatSummary.players?.map(p => ({ name: p.name, type: 'player' })) || [],
            ...combatSummary.creatures?.map(c => ({ name: c.name, type: 'creature' })) || [],
        ];

        return {
            handled: true,
            result: {
                automationPopup: {
                    type: 'modal',
                    modalName: 'silenceTargetSelection',
                    payload: {
                        action: { name: 'Silence', automation: { type: 'silence', aoeRadius, range: rangeFeet } },
                        playerStats,
                        campaignName,
                        aoeRadius,
                        slotLevel,
                        activeOverlay: null,
                        creatureTargets: allCreatures,
                    },
                },
            },
        };
    }
    return { handled: false };
}

export {
    handlePowerWordHeal,
    handlePowerWordKill,
    handleMassSuggestion,
    handleCalmEmotions,
    handleHypnoticPatternEarly,
    handleConfusionEarly,
    handleShapechange,
    handleFear,
    handleConjureVolley,
    handleSilence,
    handleSleep,
};
