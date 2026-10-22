import { handle as handleShapechangeHandler } from '../../../../automation/handlers/spells/shapechangeHandler.js';
import { getCombatContext } from '../../../combat/damageUtils.js';

// CLA-392: Words of Creation spread — the spell ALWAYS affects the resolved
// first target, plus the optional second creature in metaCtx.multiTarget.
// The old if/else applied to multiTarget OR first target, silently skipping
// the first when a second was chosen. The 10-ft second-target gate has no
// live position seam on this chooser path (gridless lenient pass — adjudicated).
async function handlePowerWordHeal({ spell, metaCtx, getTargetInfo, playerStats, campaignName, applyPowerWordHealToTarget }) {
    // #1471 guard-first law: this was the file's sole unguarded name deref
    // (:10-vs-:26 asymmetry) — a nameless envelope TypeError-killed the arm
    // at the head of the hub trigger chain (execution/index.js:741 runs this
    // FIRST, before the guarded kill twin), dying the whole cast flow.
    if (spell.name && spell.name.toLowerCase() === 'power word heal') {
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

async function handlePowerWordKill({ spell, metaCtx, getTargetInfo, playerStats, campaignName, applyPowerWordKillToTarget }) {
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
                        // SP-079 (§CLA-208 pay-at-open family): the open lane forwarded
                        // _deferChooserSlotPayment without paying — the chooser's confirm
                        // consumes the slot + logs the cast once (MassSuggestionModal).
                        deferSlotPayment: !!spell._deferChooserSlotPayment,
                        slotLevel: spell.slotLevel || spell.level || 6,
                        castingTime: spell.casting_time || 'Action',
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

function handleHypnoticPatternEarly({ fullSpell, spellSaveDc, playerStats, campaignName, metaCtx, innateSorceryActive }) {
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

function handleSleep({ fullSpell, spellSaveDc, playerStats, campaignName, metaCtx, characters }) {
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

function handleShapechange({ fullSpell, metaCtx, playerStats, campaignName, mapName, characters }) {
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

function handleFear({ spell, spellSaveDc, playerStats, campaignName, metaCtx, innateSorceryActive }) {
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

// fix#107 parity mirror (#1471 twin closure, ledger residual 'modalSpells:234-239
// old-regex-pair twin QUEUED'): silenceService.js :30-:71 owns the fixed law
// (FEET_TOKEN_RE/MILE_TOKEN_RE + numeric-first aoeRadiusFromSize) but those
// consts/helpers are module-private THERE (not exported), so these bytes
// MIRROR the source verbatim: numeric-first size (RAW 5e disk spells.json
// area_of_effect.size is NUMBER on ALL 89 aoe rows — the retired
// aoeSize.match(/(\d+)-foot-radius/) threw TypeError on it), plural feet/mile
// token set (retired /(\d+)-?foot/ matched ZERO plural forms), and LOUD
// refuse of out-of-contract tokens to the documented Silence RAW defaults
// 120ft range / 20ft sphere (no-fallbacks law — the gate is name==='silence'
// whose range is '120 feet' on BOTH disks, so any unmatched token here must
// be heard, not swallowed).
const FEET_TOKEN_RE = /^(\d+)\s*-?\s*(?:feet|foot|ft\.?)(?![a-z])/i;
const MILE_TOKEN_RE = /^(\d+)\s*-?\s*(?:miles|mile|mi\.?)(?![a-z])/i;
const RADIUS_TOKEN_RE = /^(\d+)\s*-?\s*(?:feet|foot|ft\.?)(?![a-z])/i;

function silenceRangeToFeet(rangeStr) {
    if (!rangeStr) return 120; // documented default: Silence RAW range = 120 feet (both disks)
    const token = String(rangeStr).trim();
    const feet = token.match(FEET_TOKEN_RE);
    if (feet) return parseInt(feet[1], 10);
    const miles = token.match(MILE_TOKEN_RE);
    if (miles) return parseInt(miles[1], 10) * 5280;
    console.error(`[modalSpells.silence] Unrecognized range token "${rangeStr}" — not a foot/mile count; Silence RAW default 120ft applies.`);
    return 120;
}

function silenceAoeRadiusFromSize(size) {
    if (size == null) return 20; // documented default: Silence is a 20-ft sphere
    if (typeof size === 'number') {
        if (Number.isFinite(size) && size > 0) return size;
        console.error(`[modalSpells.silence] Non-positive/non-finite numeric area_of_effect.size ${size} — 20ft sphere default.`);
        return 20;
    }
    if (typeof size === 'string') {
        const m = size.trim().match(RADIUS_TOKEN_RE);
        if (m) return parseInt(m[1], 10);
        console.error(`[modalSpells.silence] Unrecognized area_of_effect.size "${size}" — not a feet count; 20ft sphere default.`);
        return 20;
    }
    console.error(`[modalSpells.silence] Unexpected area_of_effect.size type ${typeof size} — 20ft sphere default.`);
    return 20;
}

function handleSilence({ spell, metaCtx, playerStats, campaignName, getCombatSummary }) {
    if (spell.name && spell.name.toLowerCase() === 'silence') {
        const rangeFeet = silenceRangeToFeet(spell.range);
        const aoeRadius = silenceAoeRadiusFromSize(spell.area_of_effect?.size);
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
