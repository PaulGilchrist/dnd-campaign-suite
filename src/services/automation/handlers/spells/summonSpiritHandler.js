import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { setTempHpOnKey } from '../buffs/tempHpService.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary, getCurrentCombatRound } from '../../../encounters/combatData.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import storage from '../../../ui/storage.js';
import cloneDeep from 'lodash/cloneDeep.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import { getMonsterSaveBonuses, getNextUniqueMonsterName } from '../../../encounters/encounterToInitiative.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

function getTargetEffects() {
    const stored = getRuntimeValue('campaign', 'targetEffects');
    return stored || [];
}

function getSlotLevel(action) {
    const auto = action.automation;
    if (auto?.slotLevel) return auto.slotLevel;
    if (action.metaCtx?.slotLevel) return action.metaCtx.slotLevel;
    if (action.spell?.level) return action.spell.level;
    return auto?.baseLevel || 3;
}

function getSpellSaveDc(playerStats) {
    return playerStats.spellAbilities?.saveDc || (8 + (playerStats.proficiency || 2));
}

function getSpellAttackModifier(playerStats) {
    return playerStats.spellAbilities?.toHit || 0;
}

function getSpellcastingModifier(playerStats) {
    return playerStats.spellAbilities?.modifier || 0;
}

function getWisdomModifier(playerStats) {
    const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
    return wis?.bonus || 0;
}

async function loadMonsterData(monsterIndex) {
    const monsters = await loadMonsters();
    const monster = monsters.find(m => m.index === monsterIndex);
    if (!monster) {
        console.error(`[summonSpirit] Monster "${monsterIndex}" not found in monsters.json`);
        return null;
    }
    return monster;
}

// Negative caster modifiers fold tokens like "2d12+3+spellcasting modifier"
// to "2d12+3+-1" — parseExpression's ([+-]\d+)+ tail rejects the "+-"
// collision, canRollExpression goes false and the damage chip dies silently.
// Collapse double-sign runs to their arithmetic total ("+3+-1" → "+2";
// lone "+-3" → "-3"; "+0" folds are kept).
function normalizeSigns(text) {
    let out = String(text);
    out = out.replace(/([+-]\d+)((?:\+-\d+)+)/g, (run) => {
        const sum = (run.match(/[+-]\d+/g) || []).reduce((acc, seg) => acc + parseInt(seg, 10), 0);
        return sum < 0 ? `-${Math.abs(sum)}` : `+${sum}`;
    });
    out = out.replace(/\+-(\d+)/g, '-$1');
    return out;
}

function foldRowDice(row, { slotLevel, spellAttackMod, wisModifier, spellcastingModifier }) {
    const resolved = { ...row };
    resolved.damage_dice_primary = normalizeSigns(String(resolved.damage_dice_primary || '')
        .replace(/WIS modifier/gi, String(wisModifier))
        .replace(/spellcasting modifier/gi, String(spellcastingModifier))
        .replace(/spell level/gi, String(slotLevel)));
    if (resolved.damage_dice_secondary != null) {
        resolved.damage_dice_secondary = normalizeSigns(String(resolved.damage_dice_secondary)
            .replace(/WIS modifier/gi, String(wisModifier))
            .replace(/spellcasting modifier/gi, String(spellcastingModifier))
            .replace(/spell level/gi, String(slotLevel)));
    }
    let desc = String(resolved.description || '');
    desc = desc.replace(/WIS modifier/gi, String(wisModifier));
    desc = desc.replace(/\+?spell attack modifier/gi, () => (spellAttackMod < 0 ? `-${Math.abs(spellAttackMod)}` : `+${spellAttackMod}`));
    desc = desc.replace(/spell level/gi, String(slotLevel));
    desc = desc.replace(/spellcasting modifier/gi, String(spellcastingModifier));
    resolved.description = normalizeSigns(desc);
    return resolved;
}

function resolveMonsterActions(monster, mods) {
    return (monster.actions || []).map(action => {
        const resolved = foldRowDice(action, mods);
        if (resolved.attack_bonus === null || resolved.attack_bonus === undefined) {
            resolved.attack_bonus = mods.spellAttackMod;
        }
        if (resolved.save_dc != null && resolved.save_dc === 20) {
            resolved.save_dc = mods.spellSaveDc;
        }
        return resolved;
    });
}

// MA-0467: reactions fold the SAME dice tokens as actions ("spell level" →
// slotLevel, WIS/spellcasting mod) — previously omitted entirely, leaving
// summoned combatants with reactions:None and unnormalized "+spell level"
// prose (stricter block than MA-0465's action-dice gap). attack_bonus/
// save_dc stay untouched: a reaction row must never gain a false auto-hit
// attack affordance. automation/usage ride the row byte-shape unchanged.
function resolveMonsterReactions(monster, mods) {
    return (monster.reactions || []).map(row => foldRowDice(row, mods));
}

function resolveSummonedHp({ baseHp, auto, slotLevel, scale, halveHp }) {
    let hp = scale
        ? baseHp + (auto.hpPerLevelAbove || 0) * Math.max(0, slotLevel - (auto.baseLevel || slotLevel))
        : baseHp;
    // CLA-252: the Phantasmal Creatures free (spectral) cast halves the summoned creature's HP.
    if (halveHp) {
        hp = Math.max(1, Math.floor(hp / 2));
    }
    return hp;
}

function spiritWarlockOptions(options, playerStats) {
    return {
        warlockLevel: options.warlockLevel || playerStats.level,
        chaModifier: options.chaModifier || 0,
    };
}

function buildSpiritCreature({ monster, displayName, casterName, initiativeValue, slotLevel, auto, playerStats, options = {} }) {
    const baseAc = typeof monster.armor_class === 'number' ? monster.armor_class : 10;
    const baseHp = monster.hit_points || 10;
    const scale = auto.scale !== false;

    // SP-114: canonical summon stat blocks with a fixed block AC (Summon
    // Aberration et al.) scale Hit Points only — AC stays the base
    // armor_class from monsters.json. SP-015: a block that spells its AC as
    // "11 + the spell's level" opts in via armor_class_scales_with_slot
    // (bestial-spirit-* only) — every unflagged summon is byte-identical.
    const acScales = scale && monster.armor_class_scales_with_slot === true;
    const ac = baseAc + (acScales ? slotLevel : 0);
    const hp = resolveSummonedHp({ baseHp, auto, slotLevel, scale, halveHp: options.halveHp });

    const spellSaveDc = getSpellSaveDc(playerStats);
    const spellAttackMod = getSpellAttackModifier(playerStats);
    const wisModifier = getWisdomModifier(playerStats);
    const spellcastingModifier = getSpellcastingModifier(playerStats);

    const actions = resolveMonsterActions(monster, { slotLevel, spellAttackMod, spellSaveDc, wisModifier, spellcastingModifier });

    if (options.createThrall) {
        // CLA-066: Hex rider transport (CLA-036 Bestial Fury byte-shape) —
        // the thrall's weapon attack rows arm the hit-confirmed extra-Psychic
        // leg (resolveCreateThrallRiderHit) when the target is under the
        // warlock's Hex; once per thrall per round (`_CreateThrall_usedRound`
        // latch, sneak-step convention). Save rows stay inert (never pass
        // through the attack-chip press).
        const thrallHexBonus = options.thrallHexBonus || { expression: '1d6', damageType: 'Psychic' };
        actions.forEach(row => {
            if (row.attack_bonus != null && row.save_dc == null) {
                row.thrall_hex_rider = true;
                row.thrall_hex_bonus = thrallHexBonus;
            }
        });
        actions.push({
            name: "Psychic Strike",
            casting_time: "Bonus Action",
            description: `The thrall lashes out with psychic energy. Make a spell attack roll. On a hit, the target takes 1d6 Psychic damage. This bonus action can only be used on a creature under the warlock's Hex spell.`,
            attack_bonus: spellAttackMod,
            damage_dice_primary: "1d6",
            damage_type_primary: "Psychic",
        });
    }

    return {
        name: displayName,
        type: 'npc',
        monsterType: monster.type,
        initiative: String(initiativeValue - 0.1),
        targetName: null,
        ac,
        resistances: monster.damage_resistances || [],
        immunities: monster.damage_immunities || monster.immunities || [],
        concentration: null,
        maxHp: hp,
        currentHp: hp,
        saveBonuses: getMonsterSaveBonuses(monster),
        monsterIndex: monster.index,
        size: monster.size || 'Medium',
        speed: monster.speed || { walk: '30 ft.' },
        actions,
        reactions: resolveMonsterReactions(monster, { slotLevel, spellAttackMod, spellSaveDc, wisModifier, spellcastingModifier }),
        summonedBy: casterName,
        summonSource: 'spell',
        createThrall: options.createThrall === true,
        ...spiritWarlockOptions(options, playerStats),
    };
}

function infoPopup(action, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation?.type,
            description,
            automation: action.automation,
        },
    };
}

function getCasterInitiativeValue(combatSummary, casterName) {
    const casterCreature = combatSummary.creatures.find(c => c.name === casterName);
    let initiativeValue = 0;
    if (casterCreature?.initiative !== '' && casterCreature?.initiative !== undefined) {
        initiativeValue = parseInt(casterCreature.initiative, 10) || 0;
    }
    const casterInitBonus = casterCreature?.initiativeBonus || 0;
    return initiativeValue || (Math.floor(Math.random() * 20) + 1 + casterInitBonus);
}

// SP-114: Create Thrall (2024 Warlock lv14 major) is the ONLY data source that
// modifies Summon Aberration (no Concentration, 1 minute, temp HP, Hex rider).
// Gate every thrall-specific behavior on the caster actually holding the feature —
// never on the spell name alone (a Wizard's Summon Aberration is canonical).
function featureHasThrallAutomation(f, spellName) {
    const autos = Array.isArray(f.automation) ? f.automation : [f.automation].filter(Boolean);
    return autos.some(a => a && a.type === 'create_thrall' && a.spell === spellName);
}

function rawThrallFeatures(playerStats) {
    const klasses = playerStats?.class || {};
    const subclass = klasses.subclass || {};
    return [
        ...(klasses.class_levels || []).flatMap(cl => cl.features || []),
        ...(subclass.class_levels || []).flatMap(cl => cl.features || []),
        // CLA-066 hydration: 2024 majors store features FLAT (classes.json
        // majors[].features; subclasses=[]) — scan them here too.
        ...(subclass.features || []),
        ...(klasses.major?.features || []),
    ];
}

function hasCreateThrallFor(playerStats, spellName) {
    // CLA-066: runtime automation.specialActions is the canonical shape for
    // 2024 — the automationCollector flattens majors correctly, while
    // runtime class.subclass is `{ name }` only. Gate on the collected
    // automation first, then fall back to raw feature scans (legacy 5e
    // class_levels + hydrated flat major/subclass features).
    const specialActions = (playerStats?.automation || {}).specialActions || [];
    if (specialActions.some(a => a && a.type === 'create_thrall' && a.spell === spellName)) {
        return true;
    }
    return rawThrallFeatures(playerStats).some(f => featureHasThrallAutomation(f, spellName));
}

// CLA-066: rider die/damage type authored on the feature's attack_rider
// automation (collected into playerStats.automation.passives); canonical
// fallback is the lv1-4 Hex bonus die.
function resolveThrallHexBonus(playerStats) {
    const rider = (playerStats?.automation?.passives || []).find(p => p.type === 'attack_rider' && p.trigger === 'companion_aberration_hit');
    return {
        expression: rider?.damageExpression || '1d6',
        damageType: rider?.damageType || 'Psychic',
    };
}

// Minutes are encoded as rounds app-wide (CLA-334 recipe: 10min=100 rounds).
function summonDurationRounds(duration) {
    const match = String(duration || '').toLowerCase().match(/(\d+)\s*(minute|hour)/);
    if (!match) return undefined;
    const n = parseInt(match[1], 10);
    return match[2] === 'hour' ? n * 600 : n * 10;
}

function resolveSummonFlags(playerStats, action) {
    // CLA-252: a Phantasmal Creatures free cast (spellPreparationService stamps the spell)
    // summons a spectral creature with halved HP; a normal slotted cast keeps full HP.
    const phantasmalPassive = (playerStats.automation?.passives || []).find(p => p.type === 'phantasmal_creatures');
    const isPhantasmalFreeCast = !!action.spell?._phantasmalCreatures;
    const halveHp = isPhantasmalFreeCast && !!(phantasmalPassive?.halvesHp ?? action.spell?._phantasmalHalvesHp);
    return { isPhantasmalFreeCast, halveHp };
}

function applyThrallTempHp(creature, playerStats, campaignName) {
    const chaMod = playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0;
    const tempHp = (playerStats.level || 0) + chaMod;
    setTempHpOnKey(creature.name, 'tempHp', tempHp, campaignName);
    return tempHp;
}

// SP-005: unique combatant name + one 'summoned' te marker PER spawn.
// The old dedup-by-name silently dropped markers for repeat same-variant
// summons (all sharing the bare variant name), emptying te across multi-cast.
// SP-004 mirrors this: unique name first, then a FRESH marker array appended
// with spread (never mutated in place — dirty-check new===old skips the POST).
function buildSummonedMarker(creatureName, casterName, noConcentration) {
    return {
        target: creatureName,
        source: casterName,
        effect: 'summoned',
        summonSource: 'spell',
        duration: noConcentration ? '1_minute' : 'concentration',
    };
}

// SP-005 defect A: a leveled summon whose slot could NOT be paid (popup
// advisory, base lv exhausted) must REFUSE — zero spawn, zero `summons` log,
// no higher-slot auto-upcast. Driven by the payment outcome stamped onto
// metaCtx by prepareSpellCast so PASS casts (which paid at stage 1) are never
// blocked; free/psionic/quick-ritual casts stay allowed. Only fires when
// slotConsumed is explicitly false (undefined = unstamped legacy callers/tests).
function resolveUnpaidSummonRefusal(action) {
    const mc = action.metaCtx || {};
    if (mc.freeCastUsed === true || mc.quickRitualUsed === true || mc._psionicUsed === true) return null;
    if (mc.slotConsumed === false) {
        return `No spell slot available at level ${getSlotLevel(action)} — ${action.name} summon refused.`;
    }
    return null;
}

async function refuseUnpaidSummon(action, playerStats, campaignName, reason) {
    const casterName = playerStats.name;
    await addEntry(campaignName, {
        type: 'automation',
        characterName: casterName,
        automationType: 'summon_refused',
        name: action.name,
        description: `${casterName} — ${reason}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[summonSpiritHandler:refused-log-error]', e); });
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation?.type,
            description: reason,
            automation: action.automation,
        },
    };
}

// SP-114: spell-end removal clock ("up to N minute/hour" → rounds). Fires
// remove_summoned_creatures at duration expiry; cleanupConcentrationEffects
// consumes (and drains) this same entry on an earlier concentration break.
// CLA-066: a Create Thrall caster drops Concentration but keeps a hard
// 1-minute expiry (CLA-334 clock recipe: minutes×10 = rounds:10) — same
// consumer, ONE addExpiration (§38 — no competing clocks).
function applySummonDuration({ noConcentration, createThrall, casterName, action, auto, playerStats, combatSummary, campaignName }) {
    const effects = [{ type: 'remove_summoned_creatures', spell: action.name }];
    if (!noConcentration) {
        addConcentration(combatSummary, casterName, action.name, getSpellSaveDc(playerStats));
        addExpiration({ attackerName: casterName, targetName: casterName, effects, campaignName, rounds: summonDurationRounds(action.spell?.duration || auto.duration) });
        return;
    }
    if (createThrall) {
        addExpiration({ attackerName: casterName, targetName: casterName, effects, campaignName, rounds: 10 });
    }
}

// CLA-066: modification spend log — the no-Concentration/1-minute + temp HP
// modification is a resolved automation event, not silence.
async function logCreateThrallApplied({ createThrall, campaignName, casterName, creatureName, thrallTempHp }) {
    if (!createThrall) return;
    await addEntry(campaignName, {
        type: 'automation',
        characterName: casterName,
        automationType: 'create_thrall_applied',
        name: 'Create Thrall',
        description: `Create Thrall: ${creatureName} is summoned without Concentration (duration 1 minute) with ${thrallTempHp} Temporary Hit Points (Warlock level + Charisma modifier).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[summonSpiritHandler:thrall-log-error]", e); });
}

async function performSummon(action, playerStats, campaignName, variant) {
    const auto = action.automation;
    const casterName = playerStats.name;
    const slotLevel = getSlotLevel(action);

    const refusalReason = resolveUnpaidSummonRefusal(action);
    if (refusalReason) {
        return refuseUnpaidSummon(action, playerStats, campaignName, refusalReason);
    }

    const combatSummary = getCombatSummary(campaignName);
    if (!combatSummary) {
        return infoPopup(action, 'Failed to load combat summary.');
    }

    const monster = await loadMonsterData(variant.monsterIndex);
    if (!monster) {
        return infoPopup(action, `Failed to load monster data for ${variant.name}.`);
    }

    // SP-114: concentration comes from the spell's data (auto.noConcentration is
    // only stamped by feature flows that explicitly drop it — phantasmal/free-cast
    // options). A caster holding the Create Thrall feature gets its verified
    // no-Concentration/1-minute thrall modification; everyone else concentrates.
    const createThrall = hasCreateThrallFor(playerStats, action.name);
    const noConcentration = !!auto.noConcentration || createThrall;
    const initiativeValue = getCasterInitiativeValue(combatSummary, casterName);

    const { isPhantasmalFreeCast, halveHp } = resolveSummonFlags(playerStats, action);

    // SP-005 defect B: reuse the EB unique-name helper so repeat same-variant
    // summons never collide on the bare name ("Animated Object (Medium) 1/2/3").
    const displayName = getNextUniqueMonsterName(variant.name, combatSummary.creatures);

    const creature = buildSpiritCreature({ monster, displayName, casterName, initiativeValue, slotLevel, auto, playerStats, options: { noConcentration, createThrall, thrallHexBonus: resolveThrallHexBonus(playerStats), warlockLevel: playerStats.level, chaModifier: (playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0), halveHp } });
    if (isPhantasmalFreeCast) {
        creature.phantasmal = true;
        creature.spectral = true;
    }
    combatSummary.creatures.push(creature);

    const thrallTempHp = createThrall ? applyThrallTempHp(creature, playerStats, campaignName) : 0;

    const targetEffects = [...getTargetEffects(), buildSummonedMarker(creature.name, casterName, noConcentration)];

    combatSummary.creatures.sort((a, b) => {
        const aInit = a.initiative === '' || a.initiative === undefined ? 0 : Number(a.initiative);
        const bInit = b.initiative === '' || b.initiative === undefined ? 0 : Number(b.initiative);
        return bInit - aInit;
    });

    applySummonDuration({ noConcentration, createThrall, casterName, action, auto, playerStats, combatSummary, campaignName });
    await storage.set('combatSummary', cloneDeep(combatSummary), campaignName);
    await setRuntimeValue('campaign', 'targetEffects', targetEffects, campaignName);
    window.dispatchEvent(new CustomEvent('initiative-rolled'));

    const summonLabel = auto.typeLabel || variant.name;
    const castLabel = isPhantasmalFreeCast
        ? `${casterName} casts ${action.name} — Phantasmal Creatures free cast (spectral, half HP), summoning ${variant.name} (${creature.maxHp}/${creature.maxHp} HP).`
        : `${casterName} casts ${action.name} (slot level ${slotLevel}), summoning ${variant.name} (${creature.maxHp}/${creature.maxHp} HP).`;

    await addEntry(campaignName, {
        type: 'summons',
        characterName: casterName,
        summonName: summonLabel,
        description: castLabel,
        summonedCreatures: [creature.name],
        timestamp: Date.now(),
    }).catch((e) => { console.error("[summonSpiritHandler:log-error]", e); });

    await logCreateThrallApplied({ createThrall, campaignName, casterName, creatureName: creature.name, thrallTempHp });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${casterName} casts ${action.name}, summoning ${variant.name}. It acts right after ${casterName}.`,
            automation: auto,
        },
        logEntries: [{
            type: 'summons',
            characterName: casterName,
            summonName: summonLabel,
            description: castLabel,
            summonedCreatures: [creature.name],
            timestamp: Date.now(),
        }],
    };
}

// CLA-066: Create Thrall Hex rider — hit-confirmed extra-Psychic leg on the
// thrall's attack rows (CLA-036 Bestial Fury / MA-0007 separate-leg template).
// The attack_rider automation's trigger `companion_aberration_hit` has no
// generic trigger bus; the card-row transport is the sanctioned consumer.
// Bonus folds ONCE per thrall per round (`_CreateThrall_usedRound` latch,
// sneak-step convention, round from FRESH getCurrentCombatRound) when the
// target carries the hex te (top-level targetEffects channel). Separate roll
// + own `roll damage` log leg; dice NEVER doubled on crit.
export const THRALL_HEX_RIDER_LATCH_KEY = '_CreateThrall_usedRound';

export async function resolveCreateThrallRiderHit({ campaignName, monsterName, autoDamage, rollDamage }) {
    if (autoDamage?.thrallHexRider !== true) return null;
    const round = getCurrentCombatRound(campaignName);
    const attackName = autoDamage.name || 'Slam';
    const targetName = autoDamage.targetName || null;

    const usedRound = getRuntimeValue(monsterName, THRALL_HEX_RIDER_LATCH_KEY, campaignName);
    if (Number(usedRound) === round) {
        await addEntry(campaignName, {
            type: 'automation',
            automationType: 'create_thrall_refused',
            characterName: monsterName,
            abilityName: attackName,
            description: `${monsterName}: Create Thrall Hex bonus already applied this turn (once per turn) — no extra damage.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[summonSpiritHandler:rider-refusal-log-error]', e); });
        return null;
    }

    if (!targetName) return null;
    const hexed = getTargetEffects().some(te => te.target === targetName && te.effect === 'hex_ability_check_disadvantage');
    if (!hexed) return null;

    const expression = autoDamage.thrallHexBonus?.expression || '1d6';
    const damageType = autoDamage.thrallHexBonus?.damageType || 'Psychic';
    const result = rollExpression(expression);
    if (!result) {
        console.error('[summonSpiritHandler] Create Thrall Hex bonus roll failed for formula', expression);
        return null;
    }

    await rollDamage({
        name: `${attackName} — Create Thrall`,
        formula: expression,
        total: result.total,
        rolls: result.rolls,
        modifier: 0,
        context: { damageType, targetName, attackerName: monsterName },
    });
    // Latch stamp awaited BEFORE the next rider read consumes it (§40).
    await setRuntimeValue(monsterName, THRALL_HEX_RIDER_LATCH_KEY, round, campaignName);

    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'create_thrall_hex_bonus',
        characterName: monsterName,
        abilityName: attackName,
        description: `${monsterName} deals extra ${expression} ${damageType} (Hex on ${targetName}) — Create Thrall ${result.total} ${damageType}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[summonSpiritHandler:rider-grant-log-error]', e); });

    return result;
}

export async function handle(action, playerStats, campaignName) {
    const variants = action.automation?.variants || [];
    if (variants.length === 1) {
        return performSummon(action, playerStats, campaignName, variants[0]);
    }
    return {
        type: 'modal',
        modalName: 'summonSpirit',
        payload: { action, playerStats, campaignName },
    };
}

export async function confirmSummonSpirit(action, playerStats, campaignName, variantName) {
    const auto = action.automation;
    const variant = auto?.variants?.find(v => v.name === variantName);
    if (!variant) {
        return infoPopup(action, 'No summon variant selected.');
    }
    return performSummon(action, playerStats, campaignName, variant);
}

export { buildSpiritCreature, resolveMonsterActions, resolveMonsterReactions };
