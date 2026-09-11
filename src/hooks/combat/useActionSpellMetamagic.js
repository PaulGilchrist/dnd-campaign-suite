import { useState, useCallback } from 'react'
import { getCurrentSorceryPoints, getMaxSorceryPoints, spendSorceryPoints, logMetamagicUse } from './useMetamagic.js'
import { addEntry } from '../../services/ui/logService.js'
import { isPsionicSpell, hasPsionicSorcery } from '../../services/rules/spells/metamagicRules.js'
import { prepareSpellCast, isFreeCastAuthorized } from '../../services/rules/spells/spellPreparationService.js'
import { executeSpellCast } from '../../services/rules/spells/spellCastService.js'

const AREA_SHAPES = ['emanation', 'cone', 'line', 'sphere', 'cube', 'cylinder', 'square', 'circle', 'wall', 'cage', 'floor', 'area'];

function parseAoERangeFeet(range) {
    if (range === 'Self') return 0
    if (typeof range === 'number') return range
    return parseInt(String(range).replace(/[^0-9]/g, '')) || 0
}

function showSaveAttackAoeModal(attack, playerStats, campaignName, setModalState) {
    const aoeShape = attack.area_of_effect?.shape || attack.area_of_effect?.type
    if (!aoeShape || !AREA_SHAPES.includes(String(aoeShape).toLowerCase()) || !setModalState) return false
    setModalState({ saveAttackAoeModal: {
        action: { name: attack.name, automation: {}, spell: attack },
        playerStats,
        campaignName,
        shape: aoeShape,
        range: parseAoERangeFeet(attack.range || '15 feet'),
        damage: attack.damage || '0',
        damageType: attack.damageType || '',
        saveType: attack.saveType || 'DEX',
        saveDc: attack.saveDc || playerStats.spellAbilities?.saveDc,
        dcSuccess: attack.saveSuccess === 0 ? 'none' : (attack.saveSuccess === 0.5 ? 'half' : attack.saveSuccess),
    }})
    return true
}

export function useActionSpellMetamagic({
    playerStats,
    campaignName,
    mapName,
    cannotAct,
    setPopupHtml,
    rollAttack,
    rollDamage,
    buildCtx,
    handleAttackClick,
    setModalState,
    characters,
}) {
    const [pendingActionMetamagic, setPendingActionMetamagic] = useState(null);
    const isBonusSorcerer = playerStats.class?.name === 'Sorcerer';

    const handleActionMetamagicConfirm = useCallback((result) => {
        const pending = pendingActionMetamagic;
        setPendingActionMetamagic(null);
        if (!pending) return;

        // CLA-271: the popup confirms Metamagic-options cost only; add the Psionic
        // Sorcery cost once, and only when its checkbox was actually selected.
        const totalMetamagicCost = result?.totalCost || 0;
        const psionicCost = result?.psionicActive ? (pending.psionicCost || 0) : 0;
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
        }).catch((e) => { console.error("[useActionSpellMetamagic:log-error]", e); });

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

    const showCastPopup = (castResult) => {
        if (!castResult?.automationPopup) return
        const popup = castResult.automationPopup
        if (popup.type === 'modal' && setModalState) {
            // handled by useSpellCastExecutor pattern
        } else {
            setPopupHtml(popup.payload)
        }
    }

    const castNoSpellAttack = async (attack) => {
        addEntry(campaignName, {
            type: 'spell',
            characterName: playerStats.name,
            spellName: attack.name,
            spellLevel: attack.spellLevel || 0,
            castingTime: attack.castingTime || 'Action',
            metamagic: [],
            spCost: 0,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[useActionSpellMetamagic:log-error]", e); });
        const freeCastAuthorized = isFreeCastAuthorized(playerStats.name, attack.name, attack.spellLevel || 0, playerStats, campaignName)
        const metaCtx = {};
        const result = await prepareSpellCast({ name: attack.name, level: attack.spellLevel || 0, baseLevel: 0 }, metaCtx, {
            playerName: playerStats.name,
            playerStats,
            campaignName,
            isUpcast: false,
            freeCastAuthorized,
        });
        const castResult = await executeSpellCast({ name: attack.name, level: attack.spellLevel || 0, baseLevel: 0 }, result.metaCtx, {
            rollAttack,
            rollDamage,
            playerStats,
            getTargetInfo: async () => {
                const cs = await buildCtx(attack);
                return cs?.targetName ? { name: cs.targetName } : null;
            },
            campaignName,
            mapName,
            characters,
        });
        showCastPopup(castResult)
    }

    const castKnownSpell = async (attack, spell) => {
        const spellLevel = attack.spellLevel || spell.level || 0;
        const freeCastAuthorized = isFreeCastAuthorized(playerStats.name, attack.name, spellLevel, playerStats, campaignName)
        const metaCtx = {};
        const result = await prepareSpellCast({ ...spell, name: attack.name, level: spellLevel }, metaCtx, {
            playerName: playerStats.name,
            playerStats,
            campaignName,
            isUpcast: false,
            freeCastAuthorized,
        });
        const castResult = await executeSpellCast({ ...spell, name: attack.name, level: spellLevel }, result.metaCtx, {
            rollAttack,
            rollDamage,
            playerStats,
            getTargetInfo: async () => {
                const cs = await buildCtx(attack);
                return cs?.targetName ? { name: cs.targetName } : null;
            },
            campaignName,
            mapName,
            characters,
        });
        showCastPopup(castResult)
    }

    const resolveSpellDamage = async (attack) => {
        if (showSaveAttackAoeModal(attack, playerStats, campaignName, setModalState)) return

        const spell = playerStats.spellAbilities?.spells?.find(s => s.name === attack.name)
        if (!isBonusSorcerer) {
            if (!spell) await castNoSpellAttack(attack)
            else await castKnownSpell(attack, spell)
            return;
        }
        if (!spell) {
            handleAttackClick(attack);
            return;
        }

        const spellLevel = attack.spellLevel || spell.level || 0;
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
                const castResult = await executeSpellCast({ ...spell, level: spellLevel }, metaCtx, {
                    rollAttack,
                    rollDamage,
                    playerStats,
                    getTargetInfo: async () => {
                        const cs = await buildCtx(attack);
                        return cs?.targetName ? { name: cs.targetName } : null;
                    },
                    campaignName,
                    mapName,
                    characters,
                });
                if (castResult?.automationPopup) {
                    const popup = castResult.automationPopup;
                    if (popup.type === 'modal' && setModalState) {
                        // handled by useSpellCastExecutor pattern
                    } else {
                        setPopupHtml(popup.payload);
                    }
                }
            },
        });
    };

    const handleSpellAttackClick = async (attack) => {
        if (cannotAct) return;
        const spell = playerStats.spellAbilities?.spells?.find(s => s.name === attack.name);
        if (!spell) {
            handleAttackClick(attack);
            return;
        }
        if (!isBonusSorcerer) {
            const freeCastAuthorized = isFreeCastAuthorized(playerStats.name, attack.name, attack.spellLevel || 0, playerStats, campaignName);
            const metaCtx = {};
            const result = await prepareSpellCast({ ...spell, name: attack.name, level: attack.spellLevel || 0 }, metaCtx, {
                playerName: playerStats.name,
                playerStats,
                campaignName,
                isUpcast: false,
                freeCastAuthorized,
            });
            // CLA-230: thread ctx.forcedMode (conditionAttackMode advantage/disadvantage,
            // e.g. Moonlight Step next-attack advantage) into the spell attack roll —
            // previously only getTargetInfo().name survived, so spell attacks never saw it.
            // handleNoSavePath spreads metaCtx into the attack roll ctx.
            const attackCtx = await buildCtx(attack);
            const castMetaCtx = attackCtx?.forcedMode && result.metaCtx?.forcedMode == null
                ? { ...result.metaCtx, forcedMode: attackCtx.forcedMode }
                : result.metaCtx;
            const castResult = await executeSpellCast({ ...spell, name: attack.name, level: attack.spellLevel || 0 }, castMetaCtx, {
                rollAttack,
                rollDamage,
                playerStats,
                getTargetInfo: async () => {
                    const cs = await buildCtx(attack);
                    return cs?.targetName ? { name: cs.targetName } : null;
                },
                campaignName,
                mapName,
                characters,
            });
            if (castResult?.automationPopup) {
                const popup = castResult.automationPopup;
                if (popup.type === 'modal' && setModalState) {
                    // handled by useSpellCastExecutor pattern
                } else {
                    setPopupHtml(popup.payload);
                }
            }
            return;
        }

        const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
        const isPsionic = isPsionicSpell(playerStats, spell.name);
        const hasPsionic = hasPsionicSorcery(playerStats);

        setPendingActionMetamagic({
            spellName: attack.name,
            spellLevel: spell.level || 0,
            castingTime: spell.casting_time || 'Action',
            _currentSP: currentSP,
            isPsionic: isPsionic && hasPsionic,
            psionicCost: isPsionic && hasPsionic ? (spell.level || 0) : 0,
            action: async (metaCtx) => {
                // CLA-230: thread ctx.forcedMode through the metamagic-resolved cast too
                // (metamagic never sets forcedMode itself — an existing metaCtx value wins,
                // mirroring handleNoSavePath's innate-sorcery `!metaCtx?.forcedMode` gate).
                const attackCtx = await buildCtx(attack);
                const castMetaCtx = attackCtx?.forcedMode && metaCtx?.forcedMode == null
                    ? { ...metaCtx, forcedMode: attackCtx.forcedMode }
                    : metaCtx;
                const castResult = await executeSpellCast({ ...spell, level: spell.level || 0 }, castMetaCtx, {
                    rollAttack,
                    rollDamage,
                    playerStats,
                    getTargetInfo: async () => {
                        const cs = await buildCtx(attack);
                        return cs?.targetName ? { name: cs.targetName } : null;
                    },
                    campaignName,
                    mapName,
                    characters,
                });
                showCastPopup(castResult)
            },
        });
    };


    return {
        pendingActionMetamagic,
        isBonusSorcerer,
        handleActionMetamagicConfirm,
        handleActionMetamagicSkip,
        handleActionSpellDamageClick: resolveSpellDamage,
        handleSpellAttackClick,
    };
}
