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

    const eligibleSpells = allSpells.filter(s => s.level > 0 && s.level <= maxLevel);
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

// Per-attack roll/damage mirrors bonusAttacksHandler.applyFlurryOfBlows.
async function rollWeaponAttack(action, playerStats, campaignName, targetName, targetAc) {
    const playerName = playerStats.name;
    const attackBonus = playerStats.attacks?.[0]?.hitBonus ?? 0;
    const damageFormula = playerStats.attacks?.[0]?.damage ?? '1d4+0';
    const damageType = playerStats.attacks?.[0]?.damageType || 'Slashing';

    const d20Roll = rollD20();
    const totalAttack = d20Roll + attackBonus;
    const isCrit = DEBUG_FORCE_CRIT || d20Roll === 20;
    const hit = d20Roll === 1 ? false : totalAttack >= targetAc;

    let finalDamage = 0;
    let rollResult = null;
    if (hit) {
        rollResult = isCrit ? rollExpressionDoubled(damageFormula) : rollExpression(damageFormula);
        const rawDamage = rollResult?.total || 0;
        const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
        const applyResult = await applyDamageToTarget(
            getCombatSummary(campaignName),
            targetName,
            rawDamage,
            [damageType],
            campaignName,
            characters,
            false,
            playerName
        );
        finalDamage = applyResult?.finalDamage || 0;
        if (finalDamage > 0) {
            endInvisibilityOnHostileAction(playerName, campaignName);
        }
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

    return { d20Roll, totalAttack, hit, isCrit, finalDamage, damageType, ac: targetAc };
}

async function resolveSpellSaveDamage(action, spell, selectedSpellName, playerName, playerStats, campaignName, targetName) {
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
async function resolveWarMagicSpellDamage(action, spell, selectedSpellName, playerName, playerStats, campaignName, cs, targetName) {
    let spellDamage = 0;
    let spellFormula = '';
    let spellRolls = [];

    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
    const isShieldActive = (getRuntimeValue(targetName, 'activeBuffs', campaignName) || [])
        .some(b => b.effect === 'shield');

    if (isShieldActive && selectedSpellName.toLowerCase() === 'magic missile') {
        // Shield blocks Magic Missile entirely (mirrors executeMagicMissile).
        spellDamage = 0;
        spellFormula = 'Blocked by Shield';
    } else if (isAutoHitSpell(spell)) {
        const missile = selectedSpellName.toLowerCase() === 'magic missile'
            ? rollMagicMissileDamage(spell.level)
            : null;
        if (missile) {
            spellRolls = missile.rolls;
            spellDamage = missile.total;
            spellFormula = missile.formula;
        } else {
            spellFormula = resolveSpellDamageAtLevel(spell, spell.level);
            const result = rollExpression(spellFormula);
            spellRolls = result?.rolls || [];
            spellDamage = result?.total || 0;
        }
    } else if (spell.dc?.dc_type) {
        const saveOutcome = await resolveSpellSaveDamage(action, spell, selectedSpellName, playerName, playerStats, campaignName, targetName);
        spellRolls = saveOutcome.spellRolls;
        spellDamage = saveOutcome.spellDamage;
        spellFormula = saveOutcome.spellFormula;
    } else {
        // Spell attack roll against the target's AC.
        const formula = resolveSpellDamageAtLevel(spell, spell.level);
        const toHit = playerStats.spellAbilities?.toHit ?? 0;
        const d20 = rollD20();
        const hit = d20 === 1 ? false : (d20 + toHit) >= (cs?.creatures?.find(c => c.name === targetName)?.ac || 10);
        if (hit) {
            const result = rollExpression(formula);
            spellRolls = result?.rolls || [];
            spellDamage = result?.total || 0;
        }
        spellFormula = hit ? `${formula} (spell attack hit)` : `${formula} (spell attack missed)`;
    }

    if (spellDamage > 0) {
        const applyResult = await applyDamageToTarget(cs, targetName, spellDamage, [spell.damage?.damage_type || 'Force'], campaignName, characters, false, playerName);
        spellDamage = applyResult?.finalDamage ?? spellDamage;
        if (spellDamage > 0) {
            endInvisibilityOnHostileAction(playerName, campaignName);
            addEntry(campaignName, {
                type: 'roll',
                characterName: playerName,
                rollType: 'damage',
                name: `${selectedSpellName} (${targetName})`,
                formula: spellFormula,
                rolls: spellRolls,
                total: spellDamage,
                damageType: spell.damage?.damage_type || 'Force',
                targetName,
                finalDamage: spellDamage,
                isAutoHit: isAutoHitSpell(spell),
                timestamp: Date.now(),
            }).catch((e) => { console.error('[warMagicSpellHandler:spell-damage-log-error]', e); });
        }
    }

    return { spellDamage, spellFormula, spellRolls };
}

export async function confirmWarMagicSpell(action, playerStats, campaignName, selectedSpellName) {
    if (!selectedSpellName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No spell selected.',
            },
        };
    }

    const playerName = playerStats.name;

    const allSpells = await loadSpellData(playerStats);
    const spell = (allSpells || []).find(s => s.name === selectedSpellName);
    if (!spell) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Spell "${selectedSpellName}" not found.`,
            },
        };
    }

    // Target: the creature set on the caster's initiative card.
    const cs = getCombatSummary(campaignName);
    const targetName = cs ? getTargetFromAttacker(cs, playerName)?.name || null : null;
    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} requires a target — set the Target dropdown on your initiative card first.`,
            },
        };
    }

    const inRange = await isWithinRange(playerName, targetName, parseRangeFeet(spell.range));
    if (!inRange) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName} is out of range for ${selectedSpellName} (${spell.range}).`,
            },
        };
    }

    if (!expendSpellSlot(playerName, spell.level, playerStats, campaignName)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No level ${spell.level} spell slots available to cast ${selectedSpellName}.`,
            },
        };
    }

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
        const resolved = await resolveWarMagicSpellDamage(action, spell, selectedSpellName, playerName, playerStats, campaignName, cs, targetName);
        spellDamage = resolved.spellDamage;
    }

    // Grant and roll one weapon attack against the same target.
    const targetCreature = cs?.creatures?.find(c => c.name === targetName);
    const weapon = await rollWeaponAttack(action, playerStats, campaignName, targetName, targetCreature?.ac || 10);

    const weaponLine = `${weapon.hit ? (weapon.isCrit ? 'CRITICAL HIT' : 'Hit') : 'Miss'} — d20(${weapon.d20Roll}) + ${weapon.totalAttack - weapon.d20Roll} = ${weapon.totalAttack} vs AC ${weapon.ac}${weapon.hit ? `, ${weapon.finalDamage} ${weapon.damageType} damage` : ''}`;

    const popupDescription =
        `<b>${action.name}</b>: Cast <b>${selectedSpellName}</b> (level ${spell.level} spell slot expended) at <b>${targetName}</b>.` +
        (spellDamage > 0 ? ` Spell dealt <b>${spellDamage}</b> ${spellDamageType} damage.` : (spell.damage ? ' Spell dealt no damage.' : '')) +
        `<br/>Weapon attack: ${weaponLine}`;

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
