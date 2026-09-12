import { rollExpression } from '../../../../dice/diceRoller.js';
import { isInnateSorceryActive } from '../../../../combat/buffs/buffService.js';
import { isMagicMissile, executeMagicMissile } from './helpers.js';
import { resolveSpellDamageAtLevel } from '../../../core/spellDamageUtils.js';
import { activateSpiritualWeaponForce } from '../../../features/spiritualWeaponService.js';

function innateSorceryRollContext(playerStats, metaCtx, campaignName) {
    if (!isInnateSorceryActive(playerStats.name, campaignName) || metaCtx?.forcedMode) return metaCtx;
    return { ...metaCtx, forcedMode: 'advantage' };
}

function resolveNoSaveFormulas(spell, metaCtx, playerStats) {
    const overchannelFormula = metaCtx?.overchannelFormula || spell.damage?.formula || resolveSpellDamageAtLevel(spell, playerStats.level) || '';
    return {
        overchannelFormula,
        overchannelActive: metaCtx?.overchannelActive || false,
        overchannelUseCount: metaCtx?.overchannelUseCount || 0,
        finalFormula: metaCtx?.finalFormula || overchannelFormula,
    };
}

function buildNoSaveAttackContext(spell, metaCtx, playerStats, target, damageType, rollCtx, formulas, damageRollResult) {
    const attackCtx = {
        attackName: spell.name,
        targetName: target?.name,
        attackerName: playerStats.name,
        damageType: damageType || spell.damage?.damage_type,
        autoDamageFormula: formulas.finalFormula,
        autoDamageName: spell.name,
        spellName: spell.name,
        autoDamageSchool: spell.school,
        overchannelActive: formulas.overchannelActive,
        overchannelUseCount: formulas.overchannelUseCount,
        overchannelSpellLevel: metaCtx?.slotLevel || spell.level,
        autoDamageRollResult: damageRollResult,
        ...rollCtx,
        isCantrip: spell.baseLevel === 0 || spell.level === 0,
        playerStats,
    };
    if (metaCtx?.metamagicHeighten) {
        attackCtx.metamagicHeighten = true;
    }
    return attackCtx;
}

// SP-112: create the Spiritual Weapon force entity (record + duration clock +
// log) BEFORE the immediate melee spell attack so the spectral force exists
// as a persisting entity with a registered expiration, available for the
// later-turn "Move 20 ft & Attack" Bonus Action row.
async function activateSpiritualWeaponIfNeeded(spell, metaCtx, playerStats, campaignName, finalFormula) {
    if (spell.index !== 'spiritual-weapon' && spell.name !== 'Spiritual Weapon') return;
    await activateSpiritualWeaponForce(spell, playerStats, campaignName, {
        slotLevel: metaCtx?.slotLevel || spell.level,
        formula: finalFormula,
    });
}

async function handleNoSavePath({ spell, metaCtx, playerStats, campaignName, mapName, characters, getTargetInfo, rollAttack, spellToHit, damageType }) {

    if (isMagicMissile(spell)) {
        await executeMagicMissile(spell, metaCtx, { rollDamage: () => {}, playerStats, getTargetInfo, campaignName, mapName, characters });
        return null;
    }

    if (!(spell.attack_type || spell.damage)) return;

    const target = await getTargetInfo();
    const rollCtx = innateSorceryRollContext(playerStats, metaCtx, campaignName);
    const formulas = resolveNoSaveFormulas(spell, metaCtx, playerStats);

    await activateSpiritualWeaponIfNeeded(spell, metaCtx, playerStats, campaignName, formulas.finalFormula);

    const damageRollResult = rollExpression(formulas.overchannelFormula);
    const attackCtx = buildNoSaveAttackContext(spell, metaCtx, playerStats, target, damageType, rollCtx, formulas, damageRollResult);
    rollAttack(spell.name, spellToHit, attackCtx);
}

export { handleNoSavePath };
