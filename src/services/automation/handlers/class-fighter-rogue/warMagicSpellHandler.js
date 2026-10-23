import { loadSpellData } from '../../../ui/dataLoader.js';
import { addEntry } from '../../../ui/logService.js';
import { rollD20, rollExpression, rollExpressionDoubled } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { resolveSpellDamageAtLevel, isAutoHitSpell } from '../../../rules/core/spellDamageUtils.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { endInvisibilityOnHostileAction } from '../../../rules/features/invisibilityService.js';
import { DEBUG_FORCE_CRIT } from '../../../ui/utils.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const spellListKey = auto.spellList || 'wizard_spells';
    const maxLevel = auto.maxSpellLevel || 2;

    const allSpells = await loadSpellData(playerStats);
    if (!allSpells || !allSpells.length) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No Wizard spells available.',
            },
        };
    }

    // casting_time gate (both-edition War Magic / Improved War Magic law):
    // the feature replaces the Attack action, so only ACTION-casting spells
    // are offered — reaction (Shield: '1 reaction' 5e / 'Reaction' 2024)
    // and bonus-action rows are excluded; '1 action' (x248 5e),
    // 'Action' (x278 2024) and 'Action or Ritual' (x18 2024) pass
    // (isActionCastingTime token law). A row with no casting_time is
    // malformed data: excluded and logged loudly (no silent fallback).
    const eligibleSpells = allSpells.filter(s => {
        if (!(s.level > 0 && s.level <= maxLevel)) return false;
        if (!s.casting_time) {
            console.error(`[warMagicSpellHandler] Spell "${s.name}" has no casting_time — excluded from War Magic options (cannot verify it is cast with the Action the feature replaces).`);
            return false;
        }
        return isActionCastingTime(s.casting_time);
    });
    if (!eligibleSpells.length) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No Wizard spells of level 1-2 available.',
            },
        };
    }

    const optionNames = eligibleSpells.map(s => s.name);
    const optionDetails = {};
    for (const s of eligibleSpells) {
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
        modalName: 'warMagicSpell',
        payload: {
            action,
            playerStats,
            campaignName,
            options: optionNames,
            optionDetails,
            spellListKey,
            maxSpellLevel: maxLevel,
        },
    };
}

/**
 * casting_time predicate for the War Magic spell/cantrip chooser.
 * Token law (census of shipped catalogs, both editions): a casting time
 * qualifies when it is the Action — 'action', '1 action', 'Action',
 * 'Action or Ritual' (ritual variants still cast as an Action). 'bonus
 * action'/'Bonus Action' and any 'reaction' row never qualify: their only
 * 'action'-bearing token is the compound, which is not a standalone
 * Action. Data-driven; never a spell-name blocklist.
 */
export function isActionCastingTime(castingTime) {
    const tokens = String(castingTime).toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.includes('action')) return false;
    return tokens.filter(t => t !== 'action').every(t => t === '1' || t === 'or' || t === 'ritual');
}

// Spell slot expenditure mirrors spellPreparationService.prepareSpellCast
// (runtime `spell_slots_level_N` key, fallback to the slot table maximum).
function expendSpellSlot(playerName, spellLevel, playerStats, campaignName) {
    const slotKey = `spell_slots_level_${spellLevel}`;
    const stored = getRuntimeValue(playerName, slotKey, campaignName);
    const maxSlots = (playerStats.spellAbilities && playerStats.spellAbilities[slotKey]) || 0;
    const available = stored != null ? Number(stored) : maxSlots;
    if (available <= 0) {
        return false;
    }
    setRuntimeValue(playerName, slotKey, available - 1, campaignName);
    return true;
}

function parseRangeFeet(range) {
    if (!range || /self/i.test(range)) return null;
    const match = String(range).match(/(\d+)/);
    return match ? Number(match[1]) : null;
}

// Magic Missile dart count mirrors spellCastService executeMagicMissile.
function getMagicMissileDartCount(slotLevel) {
    return 3 + (slotLevel - 1);
}

function rollMagicMissileDamage(slotLevel) {
    const darts = getMagicMissileDartCount(slotLevel);
    const rolls = [];
    let total = 0;
    for (let i = 0; i < darts; i++) {
        const dart = rollExpression('1d4 + 1');
        if (!dart) continue;
        rolls.push(dart.total);
        total += dart.total;
    }
    const formula = darts === 1 ? '1d4 + 1' : `${darts}× 1d4 + 1`;
    return { rolls, total, formula };
}

function resolveWeaponAttackStats(playerStats) {
    return {
        playerName: playerStats.name,
        attackBonus: playerStats.attacks?.[0]?.hitBonus ?? 0,
        damageFormula: playerStats.attacks?.[0]?.damage ?? '1d4+0',
        damageType: playerStats.attacks?.[0]?.damageType || 'Slashing',
    };
}

async function applyWeaponHitDamage({ playerName, targetName, damageFormula, damageType, isCrit, campaignName }) {
    const rollResult = isCrit ? rollExpressionDoubled(damageFormula) : rollExpression(damageFormula);
    const rawDamage = rollResult?.total || 0;
    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
    const applyResult = await applyDamageToTarget(getCombatSummary(campaignName), targetName, rawDamage, [damageType], { campaignName, characters: characters, ignoreResistance: false, attackerName: playerName });
    const finalDamage = applyResult?.finalDamage || 0;
    if (finalDamage > 0) {
        endInvisibilityOnHostileAction(playerName, campaignName);
    }
    return { rollResult, finalDamage };
}

function logWeaponDamageRoll(action, playerName, targetName, campaignName, { damageFormula, damageType, rollResult, finalDamage, isCrit }) {
    addEntry(campaignName, {
        type: 'roll',
        characterName: playerName,
        rollType: 'damage',
        name: `${action.name} (weapon attack)`,
        formula: damageFormula,
        rolls: rollResult?.rolls || [],
        total: rollResult?.total || 0,
        modifier: rollResult?.modifier || 0,
        damageType,
        targetName,
        finalDamage,
        isCrit,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[warMagicSpellHandler:weapon-damage-log-error]', e); });
}

// Per-attack roll/damage mirrors bonusAttacksHandler.applyFlurryOfBlows.
async function rollWeaponAttack(action, playerStats, campaignName, targetName, targetAc) {
    const { playerName, attackBonus, damageFormula, damageType } = resolveWeaponAttackStats(playerStats);

    const d20Roll = rollD20();
    const totalAttack = d20Roll + attackBonus;
    const isCrit = DEBUG_FORCE_CRIT || d20Roll === 20;
    const hit = d20Roll === 1 ? false : totalAttack >= targetAc;

    let finalDamage = 0;
    let rollResult = null;
    if (hit) {
        ({ rollResult, finalDamage } = await applyWeaponHitDamage({ playerName, targetName, damageFormula, damageType, isCrit, campaignName }));
    }

    addEntry(campaignName, {
        type: 'roll',
        characterName: playerName,
        rollType: 'attack',
        name: `${action.name} (weapon attack)`,
        rolls: [d20Roll],
        total: totalAttack,
        bonus: attackBonus,
        isNatural20: d20Roll === 20,
        isNatural1: d20Roll === 1,
        targetName,
        targetAc,
        damageType,
        hit,
        isCrit,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[warMagicSpellHandler:attack-roll-log-error]', e); });

    if (hit) {
        logWeaponDamageRoll(action, playerName, targetName, campaignName, { damageFormula, damageType, rollResult, finalDamage, isCrit });
    }

    return { d20Roll, totalAttack, hit, isCrit, finalDamage, damageType, ac: targetAc };
}

async function resolveSpellSaveDamage({ action, spell, selectedSpellName, playerName, playerStats, campaignName, targetName }) {
    const formula = resolveSpellDamageAtLevel(spell, spell.level);
    const { promise } = createSaveListener(campaignName, {
        targetName,
        attackerName: playerName,
        saveType: spell.dc.dc_type,
        saveDc: playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 0),
        sourceName: `${action.name} — ${selectedSpellName}`,
    });
    let spellRolls = [];
    let spellDamage = 0;
    let spellFormula;
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
        spellFormula = success ? `${formula} — save succeeded, no damage` : `${formula} — save failed`;
    } catch {
        spellFormula = `${formula} — save prompt dismissed`;
    }
    return { spellRolls, spellDamage, spellFormula };
}

// Resolve spell damage against the card target: shield-block, auto-hit,
// save-for-half, or spell-attack paths (in original guard order).
async function resolveWarMagicSpellDamage({ action, spell, selectedSpellName, playerName, playerStats, campaignName, cs, targetName }) {
    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];

    const { spellRolls, spellDamage, spellFormula } = await resolveWarMagicDamageRoll(
        { action, spell, selectedSpellName, playerName, playerStats, campaignName, cs, targetName }
    );

    if (spellDamage <= 0) {
        return { spellDamage, spellFormula, spellRolls };
    }

    const applyResult = await applyDamageToTarget(cs, targetName, spellDamage, [spell.damage?.damage_type || 'Force'], { campaignName, characters: characters, ignoreResistance: false, attackerName: playerName });
    const finalDamage = applyResult?.finalDamage ?? spellDamage;
    if (finalDamage > 0) {
        endInvisibilityOnHostileAction(playerName, campaignName);
        addEntry(campaignName, {
            type: 'roll',
            characterName: playerName,
            rollType: 'damage',
            name: `${selectedSpellName} (${targetName})`,
            formula: spellFormula,
            rolls: spellRolls,
            total: finalDamage,
            damageType: spell.damage?.damage_type || 'Force',
            targetName,
            finalDamage,
            isAutoHit: isAutoHitSpell(spell),
            timestamp: Date.now(),
        }).catch((e) => { console.error('[warMagicSpellHandler:spell-damage-log-error]', e); });
    }

    return { spellDamage: finalDamage, spellFormula, spellRolls };
}

async function resolveWarMagicDamageRoll({ action, spell, selectedSpellName, playerName, playerStats, campaignName, cs, targetName }) {
    const isShieldActive = (getRuntimeValue(targetName, 'activeBuffs', campaignName) || [])
        .some(b => b.effect === 'shield');

    // Shield blocks Magic Missile entirely (mirrors executeMagicMissile).
    if (isShieldActive && selectedSpellName.toLowerCase() === 'magic missile') {
        return { spellRolls: [], spellDamage: 0, spellFormula: 'Blocked by Shield' };
    }
    if (isAutoHitSpell(spell)) {
        return resolveAutoHitSpellDamage(spell, selectedSpellName);
    }
    if (spell.dc?.dc_type) {
        return resolveSpellSaveDamage({ action, spell, selectedSpellName, playerName, playerStats, campaignName, targetName });
    }
    // Spell attack roll against the target's AC.
    return resolveSpellAttackDamage(spell, playerName, playerStats, cs, targetName);
}

function resolveAutoHitSpellDamage(spell, selectedSpellName) {
    const missile = selectedSpellName.toLowerCase() === 'magic missile'
        ? rollMagicMissileDamage(spell.level)
        : null;
    if (missile) {
        return { spellRolls: missile.rolls, spellDamage: missile.total, spellFormula: missile.formula };
    }
    const spellFormula = resolveSpellDamageAtLevel(spell, spell.level);
    const result = rollExpression(spellFormula);
    return { spellRolls: result?.rolls || [], spellDamage: result?.total || 0, spellFormula };
}

function resolveSpellAttackDamage(spell, playerName, playerStats, cs, targetName) {
    const formula = resolveSpellDamageAtLevel(spell, spell.level);
    const toHit = playerStats.spellAbilities?.toHit ?? 0;
    const d20 = rollD20();
    const hit = d20 === 1 ? false : (d20 + toHit) >= (cs?.creatures?.find(c => c.name === targetName)?.ac || 10);

    let spellRolls = [];
    let spellDamage = 0;
    if (hit) {
        const result = rollExpression(formula);
        spellRolls = result?.rolls || [];
        spellDamage = result?.total || 0;
    }
    const spellFormula = hit ? `${formula} (spell attack hit)` : `${formula} (spell attack missed)`;
    return { spellRolls, spellDamage, spellFormula };
}

function buildWeaponLine(weapon) {
    const outcome = weapon.hit ? (weapon.isCrit ? 'CRITICAL HIT' : 'Hit') : 'Miss';
    const damagePart = weapon.hit ? `, ${weapon.finalDamage} ${weapon.damageType} damage` : '';
    return `${outcome} — d20(${weapon.d20Roll}) + ${weapon.totalAttack - weapon.d20Roll} = ${weapon.totalAttack} vs AC ${weapon.ac}${damagePart}`;
}

function resolveWarMagicTargetName(cs, playerName) {
    if (!cs) return null;
    return getTargetFromAttacker(cs, playerName)?.name || null;
}

function buildWarMagicPopupDescription({ action, selectedSpellName, spell, targetName, spellDamage, spellDamageType, weaponLine }) {
    const spellPart = spellDamage > 0
        ? ` Spell dealt <b>${spellDamage}</b> ${spellDamageType} damage.`
        : (spell.damage ? ' Spell dealt no damage.' : '');
    return `<b>${action.name}</b>: Cast <b>${selectedSpellName}</b> (level ${spell.level} spell slot expended) at <b>${targetName}</b>.` +
        spellPart +
        `<br/>Weapon attack: ${weaponLine}`;
}

function buildConfirmRefusalPopup(action, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
        },
    };
}

// All pre-resolution law checks for confirmWarMagicSpell, in strict order:
// selection → spell exists → casting_time gate → armed target → range →
// slot expenditure. Returns { error, spell, cs, targetName } — on any failed
// gate, error carries the refusal popup (side-effect-free: nothing is spent
// or latched before every gate passes).
async function resolveWarMagicConfirmEligibility(action, playerStats, campaignName, selectedSpellName) {
    const playerName = playerStats.name;
    if (!selectedSpellName) {
        return { error: buildConfirmRefusalPopup(action, 'No spell selected.') };
    }

    const allSpells = await loadSpellData(playerStats);
    const spell = (allSpells || []).find(s => s.name === selectedSpellName);
    if (!spell) {
        return { error: buildConfirmRefusalPopup(action, `Spell "${selectedSpellName}" not found.`) };
    }

    // casting_time law gate mirrors the chooser filter (defense-in-depth):
    // War Magic replaces the Attack action, so a non-action spell is an
    // illegal choice — refuse BEFORE spending a slot, the weapon attack, or
    // touching anything.
    if (!isActionCastingTime(spell.casting_time ?? '')) {
        return { error: buildConfirmRefusalPopup(action, `${selectedSpellName} casts as ${spell.casting_time || 'unknown casting time'} — ${action.name} replaces the Attack action, so only action-casting spells qualify.`) };
    }

    // Target: the creature set on the caster's initiative card.
    const cs = getCombatSummary(campaignName);
    const targetName = resolveWarMagicTargetName(cs, playerName);
    if (!targetName) {
        return { error: buildConfirmRefusalPopup(action, `${action.name} requires a target — set the Target dropdown on your initiative card first.`) };
    }

    const inRange = await isWithinRange(playerName, targetName, parseRangeFeet(spell.range));
    if (!inRange) {
        return { error: buildConfirmRefusalPopup(action, `${targetName} is out of range for ${selectedSpellName} (${spell.range}).`) };
    }

    if (!expendSpellSlot(playerName, spell.level, playerStats, campaignName)) {
        return { error: buildConfirmRefusalPopup(action, `No level ${spell.level} spell slots available to cast ${selectedSpellName}.`) };
    }

    return { spell, cs, targetName };
}

export async function confirmWarMagicSpell(action, playerStats, campaignName, selectedSpellName) {
    const playerName = playerStats.name;
    const eligibility = await resolveWarMagicConfirmEligibility(action, playerStats, campaignName, selectedSpellName);
    if (eligibility.error) return eligibility.error;
    const { spell, cs, targetName } = eligibility;

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${action.name}: Expended a level ${spell.level} spell slot to cast "${selectedSpellName}" at ${targetName}.`,
    }).catch((e) => { console.error('[warMagicSpellHandler:slot-log-error]', e); });

    // Resolve spell damage against the card target.
    const spellDamageType = spell.damage?.damage_type || 'Force';
    let spellDamage = 0;

    if (spell.damage) {
        const resolved = await resolveWarMagicSpellDamage({ action, spell, selectedSpellName, playerName, playerStats, campaignName, cs, targetName });
        spellDamage = resolved.spellDamage;
    }

    // Grant and roll one weapon attack against the same target.
    const targetCreature = cs?.creatures?.find(c => c.name === targetName);
    const weapon = await rollWeaponAttack(action, playerStats, campaignName, targetName, targetCreature?.ac || 10);

    const weaponLine = buildWeaponLine(weapon);

    const popupDescription = buildWarMagicPopupDescription({ action, selectedSpellName, spell, targetName, spellDamage, spellDamageType, weaponLine });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: 'war_magic_spell',
            description: popupDescription,
            automation: action.automation,
        },
    };
}
