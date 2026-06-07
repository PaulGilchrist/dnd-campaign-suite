import { useState, useCallback } from 'react'
import { getCurrentSorceryPoints, getMaxSorceryPoints, spendSorceryPoints } from './useMetamagic.js'
import { addEntry } from '../services/ui/logService.js'
import { rollExpression, rollExpressionDoubled } from '../services/dice/diceRoller.js'

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
    handleDamageClick,
}) {
    const [pendingActionMetamagic, setPendingActionMetamagic] = useState(null);
    const isBonusSorcerer = playerStats.class?.name === 'Sorcerer';

    const handleActionMetamagicConfirm = useCallback((result) => {
        const pending = pendingActionMetamagic;
        setPendingActionMetamagic(null);
        if (!pending) return;

        if (result?.totalCost > 0) {
            spendSorceryPoints(playerStats.name, result.totalCost, campaignName, getMaxSorceryPoints(playerStats));
        }

        addEntry(campaignName, {
            type: 'spell',
            characterName: playerStats.name,
            spellName: pending.spellName,
            spellLevel: pending.spellLevel || 0,
            castingTime: pending.castingTime || 'Action',
            metamagic: result?.options || [],
            spCost: result?.totalCost || 0,
            timestamp: Date.now(),
        });

        const metaCtx = {};
        if (result?.options) {
            if (result.options.includes('Heightened Spell')) metaCtx.metamagicHeighten = true;
            if (result.options.includes('Careful Spell')) metaCtx.metamagicCareful = true;
            if (result.options.includes('Twinned Spell') && result.twinTarget) metaCtx.metamagicTwinTarget = result.twinTarget;
            if (result.options.includes('Distant Spell')) metaCtx.metamagicDistant = true;
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

    const handleActionSpellDamageClick = (attack) => {
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
            const result = wasCrit ? rollExpressionDoubled(attack.damage) : rollExpression(attack.damage);
            if (!result) return;

            if (!mapName) {
                rollDamage(attack.name, attack.damage, result.total, result.rolls, result.modifier, buildCtxSync(attack));
            } else {
                buildCtx(attack).then(ctx => {
                    rollDamage(attack.name, attack.damage, result.total, result.rolls, result.modifier, ctx);
                }).catch(() => {});
            }
            return;
        }

        const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
        setPendingActionMetamagic({
            spellName: attack.name,
            spellLevel: attack.spellLevel || 0,
            castingTime: attack.castingTime || 'Action',
            _currentSP: currentSP,
            action: (metaCtx) => {
                const wasCrit = popupHtml?.isCrit;
                if (wasCrit && setPopupHtml) setPopupHtml(null);
                const r = wasCrit ? rollExpressionDoubled(attack.damage) : rollExpression(attack.damage);
                if (!r) return;
                if (!mapName) {
                    rollDamage(attack.name, attack.damage, r.total, r.rolls, r.modifier, { ...buildCtxSync(attack), ...metaCtx });
                } else {
                    buildCtx(attack).then(ctx => {
                        rollDamage(attack.name, attack.damage, r.total, r.rolls, r.modifier, { ...ctx, ...metaCtx });
                    }).catch(() => {});
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

        const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
        setPendingActionMetamagic({
            spellName: attack.name,
            spellLevel: spell.level || 0,
            castingTime: spell.casting_time || 'Action',
            _currentSP: currentSP,
            action: (metaCtx) => {
                if (!mapName) {
                    const ctx = buildCtxSync(attack);
                    rollAttack(attack.name, attack.hitBonus - exhaustionPenalty, { ...ctx, ...metaCtx });
                } else {
                    buildCtx(attack).then(ctx => {
                        rollAttack(attack.name, attack.hitBonus - exhaustionPenalty, { ...ctx, ...metaCtx });
                    }).catch(() => {});
                }
            },
        });
    };

    const handleSpellDamageClick = (attack) => {
        const spell = playerStats.spellAbilities?.spells?.find(s => s.name === attack.name);
        if (!spell) {
            handleDamageClick(attack);
            return;
        }
        if (!isBonusSorcerer) {
            handleDamageClick(attack);
            return;
        }

        const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
        setPendingActionMetamagic({
            spellName: attack.name,
            spellLevel: spell.level || 0,
            castingTime: spell.casting_time || 'Action',
            _currentSP: currentSP,
            action: (metaCtx) => {
                const wasCrit = popupHtml?.isCrit;
                if (wasCrit && setPopupHtml) setPopupHtml(null);
                const r = wasCrit ? rollExpressionDoubled(attack.damage) : rollExpression(attack.damage);
                if (!r) return;
                if (!mapName) {
                    rollDamage(attack.name, attack.damage, r.total, r.rolls, r.modifier, { ...buildCtxSync(attack), ...metaCtx });
                } else {
                    buildCtx(attack).then(ctx => {
                        rollDamage(attack.name, attack.damage, r.total, r.rolls, r.modifier, { ...ctx, ...metaCtx });
                    }).catch(() => {});
                }
            },
        });
    };

    return {
        pendingActionMetamagic,
        isBonusSorcerer,
        handleActionMetamagicConfirm,
        handleActionMetamagicSkip,
        handleActionSpellDamageClick,
        handleSpellAttackClick,
        handleSpellDamageClick,
    };
}
