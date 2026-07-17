import { useState, useCallback } from 'react'
import { getCurrentSorceryPoints, getMaxSorceryPoints, spendSorceryPoints, logMetamagicUse } from './useMetamagic.js'
import { addEntry } from '../../services/ui/logService.js'
import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js'
import { isPsionicSpell, hasPsionicSorcery } from '../../services/rules/spells/metamagicRules.js'
import { getRuntimeValue } from '../runtime/useRuntimeState.js'
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../services/rules/spells/postCastRiderService.js'

export function useActionSpellMetamagic({
    playerStats,
    campaignName,
    mapName,
    exhaustionPenalty,
    cannotAct,
    popupHtml,
    setPopupHtml,
    rollAttack,
    rollDamage,
    buildCtx,
    buildCtxSync,
    handleAttackClick,
}) {
    const [pendingActionMetamagic, setPendingActionMetamagic] = useState(null);
    const isBonusSorcerer = playerStats.class?.name === 'Sorcerer';

    const applyElementalAffinity = (attack, formula, total, rolls, modifier) => {
        const affinityType = getRuntimeValue(playerStats.name, '_Elemental_Affinity_chosenType', campaignName);
        if (!affinityType || !attack.damageType) return { formula, total, rolls, modifier };

        const damageType = String(attack.damageType).trim();
        if (damageType.toLowerCase() !== affinityType.toLowerCase()) return { formula, total, rolls, modifier };

        const chaAbility = playerStats.abilities.find(a => a.name === 'Charisma');
        const chaMod = chaAbility?.bonus || 0;
        if (chaMod <= 0) return { formula, total, rolls, modifier };

        return {
            formula: `${formula} + ${chaMod} [${affinityType}]`,
            total: total + chaMod,
            rolls: [...rolls],
            modifier,
        };
    };

    const applyEmpoweredEvocation = (attack, formula, total, rolls, modifier) => {
        const hasEmpoweredEvoc = getEmpoweredEvocationFeatures(playerStats).length > 0;
        if (!hasEmpoweredEvoc) return { formula, total, rolls, modifier };

        const spellSchool = (attack.autoDamage?.autoDamageSchool || attack.school || '').toLowerCase();
        if (spellSchool !== 'evocation') return { formula, total, rolls, modifier };

        const intMod = getEmpoweredEvocationIntModifier(playerStats);
        if (intMod <= 0) return { formula, total, rolls, modifier };

        return {
            formula: `${formula} + ${intMod} [Empowered Evocation]`,
            total: total + intMod,
            rolls: [...rolls],
            modifier,
        };
    };

    const applyPotentSpellcasting = (attack, formula, total, rolls, modifier) => {
        const isCantrip = attack.baseLevel === 0 || attack.level === 0;
        if (!isCantrip) return { formula, total, rolls, modifier };

        const potentFeature = playerStats.automation?.actions?.find(
            a => a.type === 'damage_bonus' && !a.upgrades && a.options?.some(o => o.toLowerCase().includes('spellcasting'))
        );
        if (!potentFeature) return { formula, total, rolls, modifier };

        const optKey = `_${(potentFeature.name || 'PotentSpellcasting').replace(/\s+/g, '_')}_option`;
        const chosen = getRuntimeValue(playerStats.name, optKey, campaignName);
        if (potentFeature.options.length > 1 && !chosen) return { formula, total, rolls, modifier };
        if (chosen && !chosen.toLowerCase().includes('spellcasting')) return { formula, total, rolls, modifier };

        const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
        const wisMod = Math.max(0, wis?.bonus || 0);
        if (wisMod <= 0) return { formula, total, rolls, modifier };

        return {
            formula: `${formula} + ${wisMod} [Blessed Strikes]`,
            total: total + wisMod,
            rolls: [...rolls],
            modifier,
        };
    };

    const handleActionMetamagicConfirm = useCallback((result) => {
        const pending = pendingActionMetamagic;
        setPendingActionMetamagic(null);
        if (!pending) return;

        let totalMetamagicCost = result?.totalCost || 0;
        let psionicCost = 0;
        if (pending.isPsionic && !result?.options?.includes('Subtle Spell')) {
            psionicCost = pending.psionicCost;
        }
        const totalCost = totalMetamagicCost + psionicCost;
        if (totalCost > 0) {
            spendSorceryPoints(playerStats.name, totalCost, campaignName, getMaxSorceryPoints(playerStats));
        }

        const metamagicOptions = result?.options || [];
        if (psionicCost > 0 && !metamagicOptions.includes('Psionic Sorcery')) {
            metamagicOptions.push('Psionic Sorcery');
        }

        if (totalCost > 0) {
            logMetamagicUse(campaignName, playerStats.name, pending.spellName, metamagicOptions, totalCost);
        }

        addEntry(campaignName, {
            type: 'spell',
            characterName: playerStats.name,
            spellName: pending.spellName,
            spellLevel: pending.spellLevel || 0,
            castingTime: pending.castingTime || 'Action',
            metamagic: metamagicOptions,
            spCost: totalCost,
            timestamp: Date.now(),
        });

        const metaCtx = {};
        if (result?.options) {
            if (result.options.includes('Heightened Spell')) metaCtx.metamagicHeighten = true;
            if (result.options.includes('Careful Spell')) metaCtx.metamagicCareful = true;
            if (result.options.includes('Twinned Spell') && result.twinTarget) metaCtx.metamagicTwinTarget = result.twinTarget;
            if (result.options.includes('Distant Spell')) metaCtx.metamagicDistant = true;
        }
        if (psionicCost > 0) {
            metaCtx.psionicSpell = true;
        }

        pending.action(metaCtx);
    }, [pendingActionMetamagic, playerStats, campaignName]);

    const handleActionMetamagicSkip = useCallback(() => {
        const pending = pendingActionMetamagic;
        setPendingActionMetamagic(null);
        if (!pending) return;

        addEntry(campaignName, {
            type: 'spell',
            characterName: playerStats.name,
            spellName: pending.spellName,
            spellLevel: pending.spellLevel || 0,
            castingTime: pending.castingTime || 'Action',
            metamagic: [],
            spCost: 0,
            timestamp: Date.now(),
        });

        pending.action({});
    }, [pendingActionMetamagic, playerStats.name, campaignName]);

    const resolveSpellDamage = async (attack) => {
        if (!isBonusSorcerer) {
            addEntry(campaignName, {
                type: 'spell',
                characterName: playerStats.name,
                spellName: attack.name,
                spellLevel: attack.spellLevel || 0,
                castingTime: attack.castingTime || 'Action',
                metamagic: [],
                spCost: 0,
                timestamp: Date.now(),
            });
            const wasCrit = popupHtml?.isCrit;
            if (wasCrit && setPopupHtml) setPopupHtml(null);
            const rawResult = wasCrit ? rollExpressionDoubled(attack.damage) : rollExpression(attack.damage);
            if (!rawResult) return;

            const affResult = applyElementalAffinity(attack, attack.damage, rawResult.total, rawResult.rolls, rawResult.modifier);
            const empResult = applyEmpoweredEvocation(attack, affResult.formula, affResult.total, affResult.rolls, affResult.modifier);
            const { formula, total, rolls, modifier } = applyPotentSpellcasting(attack, empResult.formula, empResult.total, empResult.rolls, empResult.modifier);

            if (!mapName) {
                const ctx = await buildCtxSync(attack);
                rollDamage(attack.name, formula, total, rolls, modifier, ctx);
            } else {
                buildCtx(attack).then(ctx => {
                    rollDamage(attack.name, formula, total, rolls, modifier, ctx);
                }).catch((e) => { console.error("[useActionSpellMetamagic] Error:", e); });
            }
            return;
        }

        const spellLevel = attack.spellLevel || 0;
        const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
        const isPsionic = isPsionicSpell(playerStats, attack.name);
        const hasPsionic = hasPsionicSorcery(playerStats);

        setPendingActionMetamagic({
            spellName: attack.name,
            spellLevel: spellLevel,
            castingTime: attack.castingTime || 'Action',
            _currentSP: currentSP,
            isPsionic: isPsionic && hasPsionic,
            psionicCost: isPsionic && hasPsionic ? spellLevel : 0,
            action: async (metaCtx) => {
                const wasCrit = popupHtml?.isCrit;
                if (wasCrit && setPopupHtml) setPopupHtml(null);
                const rawR = wasCrit ? rollExpressionDoubled(attack.damage) : rollExpression(attack.damage);
                if (!rawR) return;

                const affR = applyElementalAffinity(attack, attack.damage, rawR.total, rawR.rolls, rawR.modifier);
                const empR = applyEmpoweredEvocation(attack, affR.formula, affR.total, affR.rolls, affR.modifier);
                const { formula, total, rolls, modifier } = applyPotentSpellcasting(attack, empR.formula, empR.total, empR.rolls, empR.modifier);

                if (!mapName) {
                    const ctx = await buildCtxSync(attack);
                    rollDamage(attack.name, formula, total, rolls, modifier, { ...ctx, ...metaCtx });
                } else {
                    buildCtx(attack).then(ctx => {
                        rollDamage(attack.name, formula, total, rolls, modifier, { ...ctx, ...metaCtx });
                    }).catch((e) => { console.error("[useActionSpellMetamagic] Error:", e); });
                }
            },
        });
    };

    const handleSpellAttackClick = (attack) => {
        if (cannotAct) return;
        const spell = playerStats.spellAbilities?.spells?.find(s => s.name === attack.name);
        if (!spell) {
            handleAttackClick(attack);
            return;
        }
        if (!isBonusSorcerer) {
            handleAttackClick(attack);
            return;
        }

        const spellLevel = spell.level || 0;
        const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
        const isPsionic = isPsionicSpell(playerStats, spell.name);
        const hasPsionic = hasPsionicSorcery(playerStats);

        setPendingActionMetamagic({
            spellName: attack.name,
            spellLevel: spellLevel,
            castingTime: spell.casting_time || 'Action',
            _currentSP: currentSP,
            isPsionic: isPsionic && hasPsionic,
            psionicCost: isPsionic && hasPsionic ? spellLevel : 0,
            action: async (metaCtx) => {
                if (!mapName) {
                    const ctx = await buildCtxSync(attack);
                    rollAttack(attack.name, attack.hitBonus - exhaustionPenalty, { ...ctx, ...metaCtx });
                } else {
                    buildCtx(attack).then(ctx => {
                        rollAttack(attack.name, attack.hitBonus - exhaustionPenalty, { ...ctx, ...metaCtx });
                    }).catch((e) => { console.error("[useActionSpellMetamagic] Error:", e); });
                }
            },
        });
    };


    return {
        pendingActionMetamagic,
        isBonusSorcerer,
        handleActionMetamagicConfirm,
        handleActionMetamagicSkip,
        resolveSpellDamage,
        handleSpellAttackClick,
    };
}
