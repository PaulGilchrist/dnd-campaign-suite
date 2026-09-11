import { loadSpellData } from '../../../ui/dataLoader.js';
import { addEntry } from '../../../ui/logService.js';
import { rollD20, rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveSpellDamageAtLevel } from '../../../rules/core/spellDamageUtils.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { endInvisibilityOnHostileAction } from '../../../rules/features/invisibilityService.js';

// CLA-381: once-per-turn latch (CLA-342/CLA-371 family) — stamped at the
// confirm trigger, cleared at round-wrap beside _Slow_Fall_usedRound in
// initiative.jsx + navigationHandlers.js.
const USED_ROUND_KEY = '_War_Magic_usedRound';

function getKnownSpellNames(playerStats) {
    return (playerStats.spells || [])
        .map(s => (typeof s === 'string' ? s : s?.name))
        .filter(Boolean);
}

function refusal(action, playerName, campaignName, reason) {
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: 'war_magic_refused',
        name: action.name,
        description: `${action.name}: ${reason}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[warMagicCantripHandler:refusal-log-error]", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${action.name} — ${reason}`,
            automation: action.automation,
        },
    };
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const spellListKey = auto.spellList || 'wizard_cantrips';
    const playerName = playerStats.name;

    // CLA-381: once-per-turn gate at the row click — refuse before the chooser
    // opens when the attack replacement is already spent this round.
    const currentRound = (await getCombatContext(campaignName))?.round || 1;
    const usedRound = Number(getRuntimeValue(playerName, USED_ROUND_KEY, campaignName) ?? 0);
    if (usedRound === currentRound) {
        return refusal(action, playerName, campaignName, 'Once per turn — attack already replaced with a cantrip this turn.');
    }

    const allSpells = await loadSpellData(playerStats);
    const knownNames = getKnownSpellNames(playerStats);
    const cantrips = (allSpells || []).filter(s => s.level === 0 && knownNames.includes(s.name));
    if (!cantrips.length) {
        return refusal(action, playerName, campaignName, 'No known Wizard cantrips available.');
    }

    const optionNames = cantrips.map(s => s.name);
    const optionDetails = {};
    for (const s of cantrips) {
        optionDetails[s.name] = {
            name: s.name,
            level: s.level,
            casting_time: s.casting_time || '1 action',
            range: s.range || '',
            description: s.description || '',
            damage: s.damage || null,
        };
    }

    return {
        type: 'modal',
        modalName: 'warMagicCantrip',
        payload: {
            action,
            playerStats,
            campaignName,
            options: optionNames,
            optionDetails,
            spellListKey,
        },
    };
}

async function resolveSaveOutcome({ campaignName, action, playerStats, playerName, targetName, spell, formula }) {
    const { promise } = createSaveListener(campaignName, {
        targetName,
        attackerName: playerName,
        saveType: spell.dc.dc_type,
        saveDc: playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 0),
        sourceName: `${action.name} — ${spell.name}`,
    });
    let spellDamage = 0;
    let spellRolls = [];
    let outcomeLine = '';
    try {
        const saveResult = await promise;
        const success = saveResult?.success ?? false;
        if (!success) {
            const result = rollExpression(formula);
            spellRolls = result?.rolls || [];
            spellDamage = result?.total || 0;
            if (spell.dc.dc_success === 'half') {
                spellDamage = Math.floor(spellDamage / 2);
            }
        }
        outcomeLine = success ? `${targetName} saved — no damage.` : `${targetName} failed the save.`;
    } catch {
        outcomeLine = 'Save prompt dismissed.';
    }
    return { spellDamage, spellRolls, outcomeLine };
}

async function resolveSpellAttackOutcome({ campaignName, playerStats, playerName, targetName, targetAc, spell, formula, spellDamageType }) {
    const toHit = playerStats.spellAbilities?.toHit ?? 0;
    const d20 = rollD20();
    const totalAttack = d20 + toHit;
    const hit = d20 === 1 ? false : totalAttack >= targetAc;
    let spellDamage = 0;
    let spellRolls = [];
    if (hit) {
        const result = rollExpression(formula);
        spellRolls = result?.rolls || [];
        spellDamage = result?.total || 0;
    }
    addEntry(campaignName, {
        type: 'roll',
        characterName: playerName,
        rollType: 'attack',
        name: `${spell.name} (${targetName})`,
        rolls: [d20],
        total: totalAttack,
        bonus: toHit,
        isNatural20: d20 === 20,
        isNatural1: d20 === 1,
        targetName,
        targetAc,
        damageType: spellDamageType,
        hit,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[warMagicCantripHandler:attack-roll-log-error]", e); });
    const outcomeLine = `${d20} + ${toHit} = ${totalAttack} vs AC ${targetAc} — ${hit ? 'HIT' : 'MISS'}.`;
    return { spellDamage, spellRolls, outcomeLine };
}

async function applyCantripDamage({ cs, campaignName, playerName, targetName, spellDamage, spellRolls, spellDamageType, formula, characters, selectedSpellName }) {
    if (spellDamage <= 0) return spellDamage;
    const applyResult = await applyDamageToTarget(cs, targetName, spellDamage, [spellDamageType], campaignName, characters, false, playerName);
    const finalDamage = applyResult?.finalDamage ?? spellDamage;
    if (finalDamage > 0) {
        endInvisibilityOnHostileAction(playerName, campaignName);
        addEntry(campaignName, {
            type: 'roll',
            characterName: playerName,
            rollType: 'damage',
            name: `${selectedSpellName} (${targetName})`,
            formula,
            rolls: spellRolls,
            total: finalDamage,
            damageType: spellDamageType,
            targetName,
            finalDamage,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[warMagicCantripHandler:damage-log-error]", e); });
    }
    return finalDamage;
}

async function resolveCantripRollOutcome(ctx) {
    const { spell, formula } = ctx;
    if (!spell.damage || !formula) return { spellDamage: 0, spellRolls: [], outcomeLine: '' };

    const outcome = spell.dc?.dc_type
        // Save-for-half cantrip: target rolls the save.
        ? await resolveSaveOutcome({ campaignName: ctx.campaignName, action: ctx.action, playerStats: ctx.playerStats, playerName: ctx.playerName, targetName: ctx.targetName, spell, formula })
        // Spell attack roll against the target's AC.
        : await resolveSpellAttackOutcome({ campaignName: ctx.campaignName, playerStats: ctx.playerStats, playerName: ctx.playerName, targetName: ctx.targetName, targetAc: ctx.targetAc, spell, formula, spellDamageType: ctx.spellDamageType });

    const spellDamage = await applyCantripDamage({
        cs: ctx.cs, campaignName: ctx.campaignName, playerName: ctx.playerName, targetName: ctx.targetName,
        spellDamage: outcome.spellDamage, spellRolls: outcome.spellRolls, spellDamageType: ctx.spellDamageType,
        formula, characters: ctx.characters, selectedSpellName: ctx.selectedSpellName,
    });
    return { spellDamage, spellRolls: outcome.spellRolls, outcomeLine: outcome.outcomeLine };
}

// CLA-381: mirrors warMagicSpellHandler.confirmWarMagicSpell minus the spell
// slot payment — arms the card target, range-checks, rolls the cantrip
// (spell attack or save), applies damage (lastAttack + hp_change via
// applyDamageToTarget), and latches once per turn.
export async function confirmWarMagicCantrip(action, playerStats, campaignName, selectedSpellName) {
    if (!selectedSpellName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No cantrip selected.',
            },
        };
    }

    const playerName = playerStats.name;

    const allSpells = await loadSpellData(playerStats);
    const spell = (allSpells || []).find(s => s.name === selectedSpellName && s.level === 0);
    if (!spell) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Cantrip "${selectedSpellName}" not found.`,
            },
        };
    }

    // Known-cantrip gate (defense-in-depth alongside the chooser filter).
    if (!getKnownSpellNames(playerStats).includes(selectedSpellName)) {
        return refusal(action, playerName, campaignName, `${selectedSpellName} is not a cantrip you have prepared.`);
    }

    const currentRound = (await getCombatContext(campaignName))?.round || 1;
    const usedRound = Number(getRuntimeValue(playerName, USED_ROUND_KEY, campaignName) ?? 0);
    if (usedRound === currentRound) {
        return refusal(action, playerName, campaignName, 'Once per turn — attack already replaced with a cantrip this turn.');
    }

    // Target: the creature set on the caster's initiative card.
    const cs = getCombatSummary(campaignName);
    const targetName = cs ? getTargetFromAttacker(cs, playerName)?.name || null : null;
    if (!targetName) {
        return refusal(action, playerName, campaignName, 'requires a target — set the Target dropdown on your initiative card first.');
    }

    const inRange = await isWithinRange(playerName, targetName, rangeToFeet(spell.range));
    if (!inRange) {
        return refusal(action, playerName, campaignName, `${targetName} is out of range for ${selectedSpellName} (${spell.range}).`);
    }

    // CLA-371 lesson: serialize the latch — awaited stamp at the TRIGGER,
    // before resolution, so a second same-round click reads the stamped round.
    await setRuntimeValue(playerName, USED_ROUND_KEY, currentRound, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${action.name}: Replaced attack with cantrip "${selectedSpellName}"`,
    }).catch((e) => { console.error("[warMagicCantripHandler:log-error]", e); });

    const spellDamageType = spell.damage?.damage_type || 'Force';
    const formula = resolveSpellDamageAtLevel(spell, playerStats.level || 1);
    const targetAc = cs?.creatures?.find(c => c.name === targetName)?.ac || 10;
    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];

    const { spellDamage, outcomeLine } = await resolveCantripRollOutcome({
        cs, campaignName, action, playerStats, playerName, targetName, targetAc, spell, formula, spellDamageType, characters, selectedSpellName,
    });

    const damageLine = spellDamage > 0 ? ` Dealt <b>${spellDamage}</b> ${spellDamageType} damage.` : (spell.damage ? ' No damage dealt.' : '');
    const popupDescription =
        `<b>${action.name}</b>: Cast <b>${selectedSpellName}</b> at <b>${targetName}</b>. ` +
        outcomeLine +
        damageLine +
        '<br/>No spell slot consumed (cantrip).';

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: 'war_magic_cantrip',
            description: popupDescription,
            automation: action.automation,
        },
    };
}
