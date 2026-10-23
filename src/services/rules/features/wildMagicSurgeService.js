import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { executeHandler } from '../../automation/index.js';
import { usesSpellSlot } from './spellUtils.js';
import { checkOncePerTurn, markOncePerTurn } from '../../automation/common/oncePerTurn.js';

// #1433(b): RAW class gate — a surge fires only when cast BY a Sorcerer.
// Disk: classes.json:11352 "immediately after you cast a sorcerer spell of
// 1st level or higher" and 2024/classes.json:11391 "immediately after you
// cast a Sorcerer spell with a spell slot" — both feature rows live INSIDE
// the Sorcerer class block, so "you" is the Sorcerer feature-holder. The
// removed spell.classes branch let a non-Sorcerer casting a Sorcerer-listed
// spell surge. Gate is the caster's class (house form: automationInfoBuilder/
// damage.js:23 playerStats.class?.name === 'Ranger').
function isSorcererCaster(playerStats) {
    return playerStats?.class?.name === 'Sorcerer';
}

// #1433 export-surface-shrink: the four finders below are MODULE-LOCAL.
// They never had an importer outside this service except its own test file
// (test-only-export disease); triggerWildMagicSurge is the sole public
// surface (spellCastService/execution/index.js:538) and the test's disk
// census now rides that seam (fix#297 row-9 restructure-pins pattern).
// Demoted-not-deleted: each finder has a live internal consumer below
// (:124/:129/:132/:137 pre-fix numbering).
function getWildMagicSurgeFeatures(playerStats) {
    const passives = playerStats?.automation?.passives;
    if (passives == null) {
        console.error('[wildMagicSurgeService] Missing array:', passives);
        throw new Error('Expected array, got ' + passives);
    }
    // #1433(a): accept BOTH disk-faithful surge forms. 2024 ships type
    // 'wild_magic_surge' (2024/classes.json:11394); the 2014 origin ships
    // type 'auto_effect' + trigger 'roll_1_on_wild_magic_d20' + effect
    // 'wild_magic_surge_table' (classes.json:11353-11360) — bytes naming the
    // 2014 nat-1 die rule verbatim, so disk stays authoritative and the
    // filter learns the canonical disk fingerprint. Precedent:
    // automation/index.js:679 resolveHandler routes that exact type+effect
    // pair to handleWildMagicSurge; the execution side already spoke 2014.
    return passives.filter(p => p.type === 'wild_magic_surge' ||
        (p.type === 'auto_effect' && p.effect === 'wild_magic_surge_table'));
}

function getControlledChaosFeature(playerStats) {
    const passives = playerStats?.automation?.passives;
    if (passives == null) {
        console.error('[wildMagicSurgeService] Missing array:', passives);
        throw new Error('Expected array, got ' + passives);
    }
    return passives.find(p => p.type === 'auto_effect' && p.effect === 'wild_magic_double_roll');
}

function getTamedSurgeFeature(playerStats) {
    const passives = playerStats?.automation?.passives;
    if (passives == null) {
        console.error('[wildMagicSurgeService] Missing array:', passives);
        throw new Error('Expected array, got ' + passives);
    }
    return passives.find(p => p.type === 'wild_magic_tamed');
}

function getFeatsOfChaosFeature(playerStats) {
    const passives = playerStats?.automation?.passives;
    if (passives == null) {
        console.error('[wildMagicSurgeService] Missing array:', passives);
        throw new Error('Expected array, got ' + passives);
    }
    return passives.find(p => p.type === 'feats_of_chaos' && p.condition === 'feats_of_chaos_active');
}

async function executeWildMagicSurgeAction(surgeFeature, playerStats, campaignName, mapName, { autoSurge, markOnce }) {
    const surgeTable = playerStats.wildMagicSurgeTable;
    if (surgeTable == null) {
        console.error('[wildMagicSurgeService] Missing array:', surgeTable);
        throw new Error('Expected array, got ' + surgeTable);
    }

    const action = {
        name: surgeFeature.name,
        automation: {
            type: 'wild_magic_surge',
            trigger: 'after_sorcerer_spell_slot',
            oncePerTurn: surgeFeature.oncePerTurn || false,
            ...(autoSurge ? { autoSurge: true } : {}),
        },
        wildMagicSurgeTable: surgeTable,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        if (result && markOnce) {
            await markOncePerTurn('Wild Magic Surge', 'surgeUsedRound', playerStats, campaignName);
        }
        return result || null;
    } catch (e) {
        console.error(`[wildMagicSurge] Failed to execute surge for ${surgeFeature.name}:`, e);
        throw e;
    }
}

function hasTamedSurgeUses(playerStats, campaignName) {
    const currentUses = getRuntimeValue(playerStats.name, 'tamedSurgeUses', campaignName);
    const normalizedUses = currentUses === null || currentUses === undefined ? 1 : Number(currentUses);
    return normalizedUses > 0;
}

// CLA-354: the chooser lists surgeTable rows minus the final wish row
// (WildMagicSurgeModal.slice(0, -1)) — no selectable rows = nothing to offer.
function hasTamedSurgeChoices(playerStats) {
    const surgeTable = playerStats.wildMagicSurgeTable || [];
    return surgeTable.slice(0, -1).length > 0;
}

// CLA-354: Tamed Surge (Wild Magic lv18) — "Immediately after casting Sorcerer spell
// with spell slot, create effect of your choice ... instead of rolling." The post-cast
// seam must offer the tamed chooser INSTEAD of the random d100 roll lane. Rides the
// same modal/result pipeline as the roll lane (executeHandler → wild_magic_tamed →
// handleTamedSurge → WildMagicSurgeModal → onTamedSurgeSelected spends uses + logs).
export async function triggerWildMagicSurge(spell, metaCtx, playerStats, campaignName, mapName) {
    if (!playerStats) return null;
    if (!isSorcererCaster(playerStats)) return null;
    // #1433(c): a sorcerer lane dispatch requires a cast spell. null/
    // undefined here used to crash on spell.level deref or — worse, with
    // metaCtx.slotLevel pre-stamped — phantom-surge the table with no
    // spell at all. Loud-refuse per no-fallbacks; zero store traffic.
    if (spell == null) {
        console.error('[wildMagicSurgeService] Missing spell:', spell);
        return null;
    }
    if (!usesSpellSlot(spell, metaCtx)) return null;

    const tamedFeature = getTamedSurgeFeature(playerStats);
    if (tamedFeature && hasTamedSurgeUses(playerStats, campaignName) && hasTamedSurgeChoices(playerStats)) {
        return await executeHandler({ name: tamedFeature.name, automation: { ...tamedFeature } }, playerStats, campaignName, mapName);
    }

    const surgeFeatures = getWildMagicSurgeFeatures(playerStats);
    if (surgeFeatures.length === 0) return null;

    const controlledChaos = getControlledChaosFeature(playerStats);
    if (controlledChaos) {
        await setRuntimeValue(playerStats.name, 'wildMagicDoubleRoll', true, campaignName, true);
    }

    const featsOfChaos = getFeatsOfChaosFeature(playerStats);
    // CLA-134: an armed spell-attack cast consumes featsOfChaosActive at the
    // computeD20Roll roll seam BEFORE this post-cast clause runs — the
    // cast-time metaCtx stamp keeps the slot-cast re-arm + auto-surge clause
    // RAW-correct for attack-roll spells.
    const featsOfChaosActive = getRuntimeValue(playerStats.name, 'featsOfChaosActive', campaignName) === true || metaCtx?.featsOfChaosArmedAtCast === true;
    const surgeFeature = surgeFeatures[0];

    if (featsOfChaos && featsOfChaosActive) {
        await setRuntimeValue(playerStats.name, 'featsOfChaosActive', false, campaignName, true);
        await setRuntimeValue(playerStats.name, 'featsOfChaosUses', 1, campaignName, true);
        return await executeWildMagicSurgeAction(surgeFeature, playerStats, campaignName, mapName, { autoSurge: true, markOnce: false });
    }

    const skip = await checkOncePerTurn('Wild Magic Surge', 'surgeUsedRound', playerStats.name, campaignName);
    if (skip) return null;

    return await executeWildMagicSurgeAction(surgeFeature, playerStats, campaignName, mapName, { autoSurge: false, markOnce: true });
}
