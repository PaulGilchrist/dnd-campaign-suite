import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { normalizeSaveType } from '../../../../services/rules/combat/applyDamage.js';
import { storeSpellLastAttack, addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';
import CreatureSelectionModal from './CreatureSelectionModal.jsx';
import AreaEffectTargetModalBase from './AreaEffectTargetModalBase.jsx';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import { ResultsSummaryModal, TargetListRenderer } from './AOEConditionModal.subcomponents.jsx';
import './AOEConditionModal.css';

const TRAP_BLOCKING_EFFECTS = ['forcecage', 'maze', 'banishment', 'imprisonment'];

function trapEffectBlocksAttack(effects, effectName, attackerName, targetName) {
    if (!Array.isArray(effects) || effects.length === 0) return false;
    const attackerTrapped = effects.some(te => te.effect === effectName && te.target === attackerName);
    const targetTrapped = effects.some(te => te.effect === effectName && te.target === targetName);
    if (!attackerTrapped && !targetTrapped) return false;
    if (!attackerTrapped || !targetTrapped) return true;
    const attackerSources = effects
        .filter(te => te.effect === effectName && te.target === attackerName)
        .map(te => te.source);
    return !effects.some(te => te.effect === effectName && te.target === targetName && attackerSources.includes(te.source));
}

function isTargetExcludedByTraps(c, attackerName) {
    if (!attackerName || !c.name) return false;
    const effects = getRuntimeValue('campaign', 'targetEffects') || [];
    return TRAP_BLOCKING_EFFECTS.some(name => trapEffectBlocksAttack(effects, name, attackerName, c.name));
}

function buildAppliedConditions(effects) {
    return (effects || []).map(e => e.condition || e.type).filter(Boolean);
}

// SP-024: condition-only AoE fail grants must carry an expiry clock — before this
// the granted condition persisted permanently. Clock derived from spell duration data
// (threaded via savePath payload), not hardcoded:
//   round-based ("1 round") / "Instantaneous" → ONE rounds:1 clock anchored on the
//   caster — the app's documented "end of your next turn" convention, drains at round
//   wrap (CLA-045 precedent, expirationQueue.js rounds drain + expireOnCreatureName anchor);
//   minute/hour/day/"until dispelled"/concentration durations (Entangle/Grease twins
//   joining this lane) → no round clock: their condition lives with the spell-duration
//   lifecycle, and a rounds:1 clock here would cut them short (§9 concentration residual).
function resolveConditionClock({ duration, casterName }) {
    const text = String(duration || '').toLowerCase();
    if (/minute|hour|day|dispel|concentration/.test(text)) return null;
    const roundMatch = text.match(/(\d+)\s*rounds?/);
    return { rounds: roundMatch ? parseInt(roundMatch[1], 10) : 1, expireOnCreatureName: casterName };
}

// Generic 'condition' expiration type — clearExpirationEffects.js routes it through
// removeConditionEverywhere (the verified condition-removal lane, massFear precedent).
// A raw condition-name type ('blinded') has NO handler there and would drain silent no-op.
function buildExpirationEffects(conditionList) {
    return (conditionList || []).map(e => ({ type: 'condition', condition: e.condition || e.type })).filter(x => x.condition);
}

function buildConditionAppliedEntry({ targetName, conditionLabel, conditionList, saveDc, saveType, casterName }) {
    return {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: conditionLabel || conditionList.map(e => e.condition || e.type).join(', '),
        dc: saveDc,
        ability: saveType,
        sourceName: casterName,
        timestamp: Date.now(),
    };
}

function buildSaveResultEntry({ casterName, targetName, saveDc, saveType, success, detail }) {
    return {
        type: 'save_result',
        characterName: casterName,
        targetName,
        saveDc,
        saveType,
        success,
        roll: detail.roll ?? 0,
        total: detail.total ?? 0,
        saveBonus: detail.saveBonus ?? 0,
        description: `${targetName} ${success ? 'succeeded on' : 'failed'} ${saveType} save (DC ${saveDc}, rolled ${detail.roll ?? 0}${detail.saveBonus !== 0 ? ' + ' + detail.saveBonus : ''} = ${detail.total ?? 0})`,
        timestamp: Date.now(),
    };
}

function buildTargetResultEntry(targetName, success, detail, effects) {
    return {
        targetName,
        saveResult: success ? 'success' : 'failure',
        roll: detail.roll ?? 0,
        total: detail.total ?? 0,
        conditions: success ? [] : buildAppliedConditions(effects),
        appliedDamage: 0,
    };
}

function buildSaveResultRecord(targetName, success, detail) {
    return {
        targetName,
        success,
        roll: detail.roll ?? 0,
        total: detail.total ?? 0,
        saveBonus: detail.saveBonus ?? 0,
        conditionApplied: !success,
    };
}

async function resolveNpcTarget({ campaignName, casterName, targetName, target, saveType, saveDc, heightenTarget, conditionList, conditionLabel, carefulSpellProtected, applyConditionsToTarget, registerConditionExpiry }) {
    const saveBonus = target?.saveBonuses?.[normalizeSaveType(saveType).toLowerCase()] ?? 0;
    const saveRoll = heightenTarget === targetName ? Math.min(Math.floor(Math.random() * 20) + 1, Math.floor(Math.random() * 20) + 1) : Math.floor(Math.random() * 20) + 1;
    const saveTotal = saveRoll + saveBonus;
    const success = saveTotal >= saveDc;

    if (carefulSpellProtected) {
        await addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            targetName,
            saveDc,
            saveType,
            success: true,
            roll: saveRoll,
            total: saveTotal,
            saveBonus,
            description: `${targetName} succeeded on ${saveType} save (DC ${saveDc}, rolled ${saveRoll} + ${saveBonus} = ${saveTotal}) — Careful Spell protected`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[AOEConditionModal] Error logging save result:', e); });
        addTargetResult(campaignName, {
            targetName,
            saveResult: 'success',
            roll: saveRoll,
            total: saveTotal,
            conditions: [],
            appliedDamage: 0,
        });
        return {
            targetName,
            success: true,
            roll: saveRoll,
            total: saveTotal,
            saveBonus,
            conditionApplied: false,
        };
    }

    if (!success) {
        applyConditionsToTarget(targetName, conditionList, campaignName);
        registerConditionExpiry(targetName, conditionList);

        await addEntry(campaignName, {
            type: 'condition',
            action: 'applied',
            characterName: targetName,
            condition: conditionLabel || conditionList.map(e => e.condition || e.type).join(', '),
            dc: saveDc,
            ability: saveType,
            sourceName: casterName,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[AOEConditionModal] Error logging condition:', e); });

        await addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            targetName,
            saveDc,
            saveType,
            success: false,
            roll: saveRoll,
            total: saveTotal,
            saveBonus,
            description: `${targetName} failed ${saveType} save (DC ${saveDc}, rolled ${saveRoll} + ${saveBonus} = ${saveTotal})`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[AOEConditionModal] Error logging save result:', e); });

        const appliedConditions = conditionList.map(e => e.condition || e.type).filter(Boolean);
        addTargetResult(campaignName, {
            targetName,
            saveResult: 'failure',
            roll: saveRoll,
            total: saveTotal,
            conditions: appliedConditions,
            appliedDamage: 0,
        });
        // SP-024 secondary: return a fail record (was null) so ResultsSummaryModal
        // counts failed targets — display-only, conditions/logs untouched.
        return {
            targetName,
            success: false,
            roll: saveRoll,
            total: saveTotal,
            saveBonus,
            conditionApplied: true,
        };
    }

    await addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        targetName,
        saveDc,
        saveType,
        success: true,
        roll: saveRoll,
        total: saveTotal,
        saveBonus,
        description: `${targetName} succeeded on ${saveType} save (DC ${saveDc}, rolled ${saveRoll} + ${saveBonus} = ${saveTotal})`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[AOEConditionModal] Error logging save result:', e); });

    addTargetResult(campaignName, {
        targetName,
        saveResult: 'success',
        roll: saveRoll,
        total: saveTotal,
        conditions: [],
        appliedDamage: 0,
    });
    return {
        targetName,
        success: true,
        roll: saveRoll,
        total: saveTotal,
        saveBonus,
        conditionApplied: false,
    };
}


// Shared core for the two save-result lanes (run2#167 🗑 clone resolution):
// local handleSaveResult (:handleSaveResult) and the overlay handleSaveResultOverride
// were near-verbatim clones. Genuine differences are parameterized, not collapsed:
//   - pendingPrompts / setters live in TWO homes of state — local useState on the
//     selection lane, base ctx on the overlay lane (base forwards ctx and ignores
//     the handler's return, AreaEffectTargetModalBase.jsx:211-213);
//   - only the selection lane passes onAllPromptsResolved (its ResultsSummaryModal
//     `showResults` gate); the overlay lane resolves via the base's own
//     `allResolved` ctx render (AreaEffectTargetModalBase.jsx:181), so it has no
//     such gate.
// Accidental drift resolved here toward the file law: every sibling addEntry in
// this file awaits (:450 confirm, resolveNpcTarget :120/:155/:166/:201) — the
// override clone had silently dropped the awaits. Log-completes-before-persist-
// and-broadcast honors the every-automation-must-log rule; the re-sync is
// microtask-ordering only (final state byte-identical), flushed by every lane.
async function handleSaveResultCore({ event, pendingPrompts, campaignName, casterName, saveType, saveDc, conditionLabel, effects, applyConditionsToTarget, registerConditionExpiry, setResults, setPendingPrompts, onAllPromptsResolved }) {
    const detail = event.detail;
    if (!detail || !detail.promptId) return;

    const pendingIndex = pendingPrompts.findIndex(p => p.promptId === detail.promptId);
    if (pendingIndex === -1) return;

    const targetName = pendingPrompts[pendingIndex].targetName;
    const success = detail.success;

    if (!success) {
        const conditionList = effects || [{ type: 'blinded', condition: 'blinded' }];
        applyConditionsToTarget(targetName, conditionList, campaignName);
        registerConditionExpiry(targetName, conditionList);

        await addEntry(campaignName, buildConditionAppliedEntry({ targetName, conditionLabel, conditionList, saveDc, saveType, casterName })).catch((e) => { console.error('[AOEConditionModal] Error logging condition:', e); });
        await addEntry(campaignName, buildSaveResultEntry({ casterName, targetName, saveDc, saveType, success: false, detail })).catch((e) => { console.error('[AOEConditionModal] Error logging save result:', e); });
        addTargetResult(campaignName, buildTargetResultEntry(targetName, false, detail, effects));
    } else {
        await addEntry(campaignName, buildSaveResultEntry({ casterName, targetName, saveDc, saveType, success: true, detail })).catch((e) => { console.error('[AOEConditionModal] Error logging save result:', e); });
        addTargetResult(campaignName, buildTargetResultEntry(targetName, true, detail, effects));
    }

    persistAndNotify(getCombatSummary(campaignName), campaignName);

    setResults(prev => [...prev, buildSaveResultRecord(targetName, success, detail)]);
    setPendingPrompts(prev => {
        const updated = prev.filter(p => p.promptId !== detail.promptId);
        if (updated.length === 0 && onAllPromptsResolved) {
            onAllPromptsResolved();
        }
        return updated;
    });
}


// Shared core for the two ability_use lanes (fix#227 clone-debt (b), step 2 of 2 —
// consolidate AFTER drift-fix, per fix#269 degenerate-fold lesson inverted): the
// selection-lane handleCreatureSelectionConfirm (:481-era) and overlay-lane
// handleApplyOverride (:557-era) were ~90pct clones whose only real divergence was
// the D4-await drift, already adjudicated and repaired in the override lane (see
// comment there). Genuine ~10pct differences are parameterized, not collapsed
// (fix#246 honest-split), mirroring the handleSaveResultCore two-homes idiom above:
//   - setter homes differ: local useState on the selection lane vs base ctx on the
//     overlay lane (base forwards ctx and ignores the handler's return,
//     AreaEffectTargetModalBase.jsx:153);
//   - only the selection lane gates ResultsSummaryModal via onAllSelectedResolved;
//     the base renders resolution itself.
async function abilityUseCore({ campaignName, casterName, abilityName, saveDc, saveType, selectedNames, resolveAllSaves, setResults, setPendingPrompts, onAllSelectedResolved }) {
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName,
        description: `${abilityName}: Selecting ${selectedNames.length} target(s) for save (DC ${saveDc} ${saveType})`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[AOEConditionModal] Error logging feature use:', e); });

    const { results: newResults, prompts } = await resolveAllSaves(selectedNames);
    setResults(newResults);
    setPendingPrompts(prompts);
    if (onAllSelectedResolved) onAllSelectedResolved();
}


function AOEConditionModal({
    action,
    playerStats,
    campaignName,
    _shape,
    range,
    duration,
    saveType,
    saveDc,
    effects,
    conditionLabel,
    activeOverlay,
    metamagicCareful,
    metamagicHeighten,
    onClose,
}) {
    const [resultsState, setResults] = useState([]);
    const [pendingPrompts, setPendingPrompts] = useState([]);
    const [showResults, setShowResults] = useState(false);

    // fix#227 clone-debt (a): was TWO byte-identical unmount-reset useEffects (same
    // empty-deps cleanup, so safe-merge not sequencing) plus a no-op shell between them
    // whose if-branch body held only a comment — no state, no render, no subscription.
    // One honest effect remains; fix#229's dead-cleanup-noop lane owns whether even
    // this survivor is load-bearing.
    useEffect(() => {
        return () => {
            setResults([]);
            setPendingPrompts([]);
            setShowResults(false);
        };
    }, []);
    const [heightenTarget, setHeightenTarget] = useState(null);

    const isCarefulSpell = metamagicCareful || false;
    const allyList = isCarefulSpell ? getAllyList(playerStats.name) : null;
    const isCarefulAlly = useCallback((name) => allyList ? allyList.includes(name) : false, [allyList]);

    const applyConditionsToTarget = useCallback((targetName, conditionList, campaignName) => {
        const storedConditions = getRuntimeValue(targetName, 'activeConditions') || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const newConditions = conditions.filter(c => {
            const lowerC = String(c).toLowerCase();
            return !conditionList.some(e => (e.condition || e.type || '').toLowerCase() === lowerC);
        });
        conditionList.forEach(e => {
            const cond = e.condition || e.type;
            if (cond && !newConditions.some(c => String(c).toLowerCase() === cond.toLowerCase())) {
                newConditions.push(cond);
            }
        });
        setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);
    }, []);

    // SP-024: ONE addExpiration per failing target (all fail conditions in a single
    // clock — §38/CLA-045: sequential addExpiration calls race, one clock survives).
    const registerConditionExpiry = useCallback((targetName, conditionList) => {
        const clock = resolveConditionClock({ duration, casterName: playerStats.name });
        if (!clock) return;
        addExpiration({
            attackerName: playerStats.name,
            targetName,
            effects: buildExpirationEffects(conditionList),
            campaignName,
            rounds: clock.rounds,
            expireOnCreatureName: clock.expireOnCreatureName,
        });
    }, [duration, campaignName, playerStats.name]);

    const resolveAllSaves = useCallback(async (selectedNames) => {
        const combatSummary = getCombatSummary(campaignName);
        if (!combatSummary) return { results: [], prompts: [] };

        const conditionList = effects || [{ type: 'blinded', condition: 'blinded' }];
        const results = [];
        const prompts = [];

        storeSpellLastAttack(campaignName, {
            casterName: playerStats.name,
            spellName: action.name,
            saveType,
            saveDc,
            attackScope: 'aoe',
        });

        for (const targetName of selectedNames) {
            const target = combatSummary.creatures.find(c => c.name === targetName);
            if (!target) continue;

            const isNpc = target.type === 'npc';

            if (isNpc) {
                const carefulSpellProtected = isCarefulSpell && isCarefulAlly(targetName);
                const npcResult = await resolveNpcTarget({
                    campaignName, casterName: playerStats.name, targetName, target, saveType, saveDc,
                    heightenTarget, conditionList, conditionLabel, carefulSpellProtected, applyConditionsToTarget,
                    registerConditionExpiry,
                });
                if (npcResult) results.push(npcResult);
            } else {
                const carefulSpellProtected = isCarefulSpell && isCarefulAlly(targetName);

                if (carefulSpellProtected) {
                    results.push({
                        targetName,
                        success: true,
                        roll: null,
                        total: 0,
                        saveBonus: 0,
                        conditionApplied: false,
                    });
                } else {
                    const promptId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

                    sendSavePrompt(campaignName, {
                        promptId,
                        targetName,
                        saveType: saveType,
                        saveDc: saveDc,
                        sourceName: playerStats.name,
                    });

                    const existingPrompts = Array.from(getRuntimeValue('campaign', 'pendingSaveListenerPrompts') || []);
                    existingPrompts.push(promptId);
                    setRuntimeValue('campaign', 'pendingSaveListenerPrompts', existingPrompts, campaignName);

                    prompts.push({ promptId, targetName });
                }
            }
        }

        persistAndNotify(getCombatSummary(campaignName), campaignName);

        return { results, prompts };
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, isCarefulSpell, isCarefulAlly, heightenTarget, effects, conditionLabel, applyConditionsToTarget, registerConditionExpiry]);

    const handleSaveResult = useCallback((event) => handleSaveResultCore({
        event,
        pendingPrompts,
        campaignName,
        casterName: playerStats.name,
        saveType,
        saveDc,
        conditionLabel,
        effects,
        applyConditionsToTarget,
        registerConditionExpiry,
        setResults,
        setPendingPrompts,
        // Selection-lane-only difference: open the ResultsSummaryModal once the
        // last prompt resolves. (Defensive arm — confirm already set showResults
        // — retained verbatim-in-behavior per run2#167.)
        onAllPromptsResolved: () => setShowResults(true),
    }), [campaignName, saveDc, saveType, pendingPrompts, effects, conditionLabel, applyConditionsToTarget, registerConditionExpiry, playerStats.name]);

    useEffect(() => {
        if (pendingPrompts.length === 0) return;
        const handleSaveEvent = (event) => {
            handleSaveResult(event);
        };
        window.addEventListener('save-result', handleSaveEvent);
        return () => window.removeEventListener('save-result', handleSaveEvent);
    }, [pendingPrompts.length, handleSaveResult]);

    const combatSummary = getCombatSummary(campaignName);
    const isOverlayTargeted = playerStats.targetName?.startsWith('overlay-');

    const eligibleTargets = useMemo(() => {
        if (!combatSummary?.creatures) return [];
        return combatSummary.creatures
            .filter(c => !isTargetExcludedByTraps(c, playerStats.name))
            .map(c => ({
                ...c,
                carefulSpellProtected: isCarefulSpell && isCarefulAlly(c.name),
            }));
    }, [combatSummary, isCarefulSpell, isCarefulAlly, playerStats.name]);

    const getCreatureTargets = () => {
        return eligibleTargets.map(c => ({
            name: c.name,
            type: c.type,
            currentHp: c.currentHp,
            maxHp: c.maxHp,
            carefulSpellProtected: c.carefulSpellProtected,
        }));
    };

    // Selection lane wrapper: local useState setters + ResultsSummaryModal gate
    // (showResults is already set by confirm; the gate here mirrors the ordering of
    // the pre-consolidation handler exactly — results, prompts, then gate).
    const handleCreatureSelectionConfirm = useCallback((selectedNames) => abilityUseCore({
        campaignName,
        casterName: playerStats.name,
        abilityName: action.name,
        saveDc,
        saveType,
        selectedNames,
        resolveAllSaves,
        setResults,
        setPendingPrompts,
        onAllSelectedResolved: () => setShowResults(true),
    }), [campaignName, playerStats.name, action.name, saveDc, saveType, resolveAllSaves]);

    const handleCreatureSelectionSkip = useCallback(() => {
        onClose();
    }, [onClose]);

    const extraState = { heightenTarget, setHeightenTarget };

    const renderBody = (ctx) => {
        if (!ctx.processing && !ctx.allResolved) {
            return (
                <>
                    <p>Select creatures in the area of effect. Each must make a <strong>{saveType}</strong> saving throw (DC {saveDc}).</p>
                    <p className="sp-note">On a failed save, target becomes <strong>{conditionLabel}</strong>.</p>
                    {metamagicHeighten && <p className="sp-note">Heightened Spell: select one target for disadvantage on its first save.</p>}
                    <p className="sp-note">Targets selected: {ctx.selected.size}/{ctx.eligibleTargets.length}</p>
                    <TargetListRenderer eligibleTargets={ctx.eligibleTargets} selected={ctx.selected} toggleTarget={ctx.toggleTarget} heightenTarget={ctx.heightenTarget} setHeightenTarget={ctx.setHeightenTarget} metamagicHeighten={metamagicHeighten} />
                </>
            );
        }

        if (ctx.processing || ctx.pendingPrompts.length > 0) {
            return (
                <>
                    <p>Resolving {saveType} saving throws (DC {saveDc})...</p>
                    <div className="abjure-results-list">
                        {ctx.results.map(r => (
                            <div key={r.targetName} className={`abjure-result ${r.success ? 'abjure-result-success' : 'abjure-result-fail'}`}>
                                <strong>{r.targetName}</strong>: {r.success
                                    ? `Saved — unaffected (rolled ${r.roll ?? 0}{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''} = ${r.total})`
                                    : `Failed — ${conditionLabel}! (rolled ${r.roll ?? 0}{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''} = ${r.total})`}
                            </div>
                        ))}
                        {ctx.pendingPrompts.map(p => (
                            <div key={p.promptId} className="abjure-result abjure-result-pending">
                                <strong>{p.targetName}</strong>: <em>Waiting for save roll...</em>
                            </div>
                        ))}
                    </div>
                    {ctx.allResolved && (
                        <p className="sp-note aoe-condition-resolved-note">All targets resolved.</p>
                    )}
                </>
            );
        }

        return null;
    };

    const renderActions = (ctx) => {
        if (!ctx.processing && !ctx.allResolved) {
            return (
                <>
                    <button className="sp-roll-btn" onClick={() => ctx.handleApply()} disabled={ctx.selected.size === 0 || ctx.processing} type="button">
                        <i className="fa-solid fa-dice-d20"></i> {action.name} ({ctx.selected.size} target{ctx.selected.size !== 1 ? 's' : ''})
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose} type="button">Cancel</button>
                </>
            );
        }
        return null;
    };

    // Overlay lane wrapper (fix#227 clone-debt (b)): reads/writes the BASE ctx
    // setters and passes no gate — the base renders resolution itself (two-homes note
    // at handleSaveResultCore). The awaits the pre-consolidation lane silently dropped
    // live in the shared core now, so both lanes log ability_use BEFORE resolveAllSaves'
    // per-target save_result/condition writes. Base ignores the returned promise
    // (AreaEffectTargetModalBase.jsx:153 discards the returned promise), so the
    // async shape is contract-safe.
    const handleApplyOverride = useCallback((ctx) => {
        if (ctx.selected.size === 0) return;
        ctx.setProcessing(true);
        return abilityUseCore({
            campaignName,
            casterName: playerStats.name,
            abilityName: action.name,
            saveDc,
            saveType,
            selectedNames: Array.from(ctx.selected),
            resolveAllSaves,
            setResults: ctx.setResults,
            setPendingPrompts: ctx.setPendingPrompts,
        });
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, resolveAllSaves]);

    // Overlay-lane wrapper: reads/writes the BASE ctx state (two-homes-of-state
    // difference from handleSaveResult) and has no all-resolved gate — the base
    // renders resolution itself.
    const handleSaveResultOverride = useCallback((event, ctx) => handleSaveResultCore({
        event,
        pendingPrompts: ctx.pendingPrompts,
        campaignName,
        casterName: playerStats.name,
        saveType,
        saveDc,
        conditionLabel,
        effects,
        applyConditionsToTarget,
        registerConditionExpiry,
        setResults: ctx.setResults,
        setPendingPrompts: ctx.setPendingPrompts,
    }), [campaignName, saveDc, saveType, effects, conditionLabel, applyConditionsToTarget, registerConditionExpiry, playerStats.name]);

    if (isOverlayTargeted && activeOverlay) {
        return (
            <AreaEffectTargetModalBase
                combatSummary={combatSummary}
                attackerName={playerStats.name}
                attackerPos={null}
                saveDc={saveDc}
                campaignName={campaignName}
                mapData={null}
                featureName={action.name}
                saveType={saveType}
                rangeFeet={range}
                onClose={onClose}
                icon="fa-solid fa-dice-d20"
                handleApplyOverride={handleApplyOverride}
                handleSaveResultOverride={handleSaveResultOverride}
                extraState={extraState}
                renderBody={renderBody}
                renderActions={renderActions}
            />
        );
    }

    return (
        <>
            {/* display is dynamic (derived from showResults state) — dynamic-data exception, stays inline */}
            <div style={{ display: showResults ? 'none' : undefined }}>
                <CreatureSelectionModal
                    title={action.name}
                    icon="fa-dice-d20"
                    targets={getCreatureTargets()}
                    description={`Select creatures in the area of effect. Each must make a <strong>${saveType}</strong> saving throw (DC ${saveDc}).`}
                    note={`On a failed save, target becomes <strong>${conditionLabel}</strong>.${metamagicHeighten ? ' Heightened Spell: one target will have disadvantage.' : ''}`}
                    confirmLabel={action.name}
                    confirmIcon="fa-dice-d20"
                    onConfirm={handleCreatureSelectionConfirm}
                    onSkip={handleCreatureSelectionSkip}
                    metamagicHeighten={metamagicHeighten}
                    heightenTarget={heightenTarget}
                    setHeightenTarget={setHeightenTarget}
                />
            </div>
            {showResults ? (
                <ResultsSummaryModal
                    results={resultsState}
                    conditionLabel={conditionLabel}
                    onClose={onClose}
                />
            ) : null}
        </>
    );
}

export default AOEConditionModal;
