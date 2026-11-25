import React from 'react'
import SecondaryTargetModal from './modals/shared/SecondaryTargetModal.jsx'
import { sanitizeHtml } from '../../services/ui/sanitize.js'
import { requestArmTarget } from '../../services/ui/armTargetSignal.js'
import Popup from '../common/popup.jsx'
import AttackResultPopup from '../common/AttackResultPopup.jsx'
import PolymorphSelectionModal from './modals/PolymorphSelectionModal.jsx'
import AnimalShapesSelectionModal from './modals/AnimalShapesSelectionModal.jsx'
import ObjectTransformModal from './modals/ObjectTransformModal.jsx'
import { ResultsSummaryModal } from './modals/shared/AOEConditionModal.subcomponents.jsx'

const ShieldOfFaithTargetSelectionModal = ({ popupHtml, setPopupHtml, handleShieldOfFaithTargetSelected }) => {
    const targets = popupHtml?.creatureTargets?.map(name => ({ name, type: 'creature' })) || [];

    return (
        <SecondaryTargetModal
            title="Shield of Faith"
            targets={targets}
            onTargetSelected={handleShieldOfFaithTargetSelected}
            onSkip={() => setPopupHtml(null)}
            description="Choose a creature within 60 feet to gain a +2 bonus to AC."
            confirmLabel="Cast"
            confirmIcon="fa-shield-halved"
        />
    );
}

// CLA-391: stable array identity — inline literals in props refire the modal's load effect.
const SHAPECHANGE_EXCLUDE_TYPES = ['construct', 'undead'];

// Types whose face is mounted OUTSIDE the popup lane (CharSheet renders
// ShieldOfFaithTargetSelectionModal from its own state; the barkskin picker
// rides the same lane) — renderPopup must stay silent for both. Consolidated
// from two `if` siblings into one table lookup when the aoe_condition_results
// route joined (complexity ceiling; suppression law pinned by
// CharSheet.popupRendering.test.jsx).
const POPUP_TYPES_HANDLED_OUTSIDE = new Set([
    'shield_of_faith_target_selection',
    'barkskin_target_selection',
]);

export { ShieldOfFaithTargetSelectionModal };

// eslint-disable-next-line react-refresh/only-export-components
export const renderPopup = ({ popupHtml, setPopupHtml, isLocalhost, playerStats, campaignName, characters: _characters, popupHandlers, onViewInitiative }) => {
    if (!popupHtml) return null;
    
    if (typeof popupHtml === 'string') {
        return <Popup onClickOrKeyDown={() => setPopupHtml(null)}><div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml) }}></div></Popup>;
    }
    if (POPUP_TYPES_HANDLED_OUTSIDE.has(popupHtml.type)) return null;
    if (popupHtml.html) {
        return (
            <Popup onClickOrKeyDown={() => setPopupHtml(null)}>
                <div className="dice-roll-result"><div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml.html) }}></div></div>
                <ArmTargetFooter armTargetName={popupHtml.armTargetName} setPopupHtml={setPopupHtml} onViewInitiative={onViewInitiative} />
            </Popup>
        );
    }
    if (popupHtml.type === 'automation_info') {
        return <Popup onClickOrKeyDown={() => setPopupHtml(null)}><div className="dice-roll-result"><div className="dice-roll-header"><i className="fa-solid fa-info-circle"></i>{popupHtml.name}</div><div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml.description) }}></div></div></Popup>;
    }
    // Condition-only AoE lane (Stinking Cloud sheet cast): the handler's resolved
    // per-target save records land on the SAME Results face vocabulary the
    // condition modals ride (`.abjure-result` rows + saveEquationText), instead
    // of the chain closing silently after the last save prompt.
    if (popupHtml.type === 'aoe_condition_results') {
        return <ResultsSummaryModal
            results={popupHtml.results}
            conditionLabel={popupHtml.conditionLabel}
            saveDc={popupHtml.saveDc}
            onClose={() => setPopupHtml(null)}
        />;
    }
    if (popupHtml.type === 'wild_shape_select') {
        return (
            <PolymorphSelectionModal
                playerStats={popupHtml.playerStats}
                campaignName={popupHtml.campaignName}
                title="Wild Shape"
                icon="fa-paw"
                actionLabel="Wild Shape"
                onConfirm={(beast) => {
                    setPopupHtml(null);
                    popupHandlers.onWildShapeConfirm(popupHtml.action, beast, popupHtml.playerStats, popupHtml.campaignName);
                }}
                onCancel={() => setPopupHtml(null)}
                isLocalhost={isLocalhost}
            />
        );
    }
    if (popupHtml.type === 'polymorph_select') {
        return (
            <PolymorphSelectionModal
                maxCR={popupHtml.maxCR}
                campaignName={popupHtml.campaignName}
                title="Polymorph"
                icon="fa-paw"
                actionLabel="Transform"
                onConfirm={(beast) => {
                    setPopupHtml(null);
                    popupHandlers.onPolymorphConfirm(beast, popupHtml);
                }}
                onCancel={() => setPopupHtml(null)}
            />
        );
    }
    if (popupHtml.type === 'shapechange_select') {
        return (
            <PolymorphSelectionModal
                maxCR={popupHtml.maxCR}
                campaignName={popupHtml.campaignName}
                title="Shapechange"
                icon="fa-paw"
                actionLabel="Shapechange"
                allowAnyCreature={true}
                excludeTypes={SHAPECHANGE_EXCLUDE_TYPES}
                onConfirm={(form) => {
                    setPopupHtml(null);
                    popupHandlers.onShapechangeConfirm(form, popupHtml);
                }}
                onCancel={() => setPopupHtml(null)}
            />
        );
    }
    if (popupHtml.type === 'animal_shapes_target_selection') {
        return (
            <AnimalShapesSelectionModal
                targets={popupHtml.targets}
                maxCR={popupHtml.maxCR}
                campaignName={popupHtml.campaignName}
                title="Animal Shapes"
                icon="fa-paw"
                onConfirm={popupHandlers.onAnimalShapesBeastConfirm}
                onCancel={() => setPopupHtml(null)}
            />
        );
    }
    if (popupHtml.type === 'true_polymorph_select') {
        return (
            <PolymorphSelectionModal
                maxCR={popupHtml.maxCR}
                campaignName={popupHtml.campaignName}
                title="True Polymorph"
                icon="fa-paw"
                actionLabel="Transform"
                allowAnyCreature={true}
                mode={popupHtml.mode}
                onConfirm={(creature) => {
                    setPopupHtml(null);
                    popupHandlers.onTruePolymorphConfirm(creature, popupHtml);
                }}
                onCancel={() => setPopupHtml(null)}
            />
        );
    }
    if (popupHtml.type === 'true_polymorph_object') {
        return (
            <ObjectTransformModal
                onConfirm={(objectType) => {
                    setPopupHtml(null);
                    popupHandlers.onObjectTransformConfirm(objectType, popupHtml);
                }}
                onCancel={() => setPopupHtml(null)}
            />
        );
    }
    if (popupHtml.type === 'heal_multi') {
        return <HealMultiPopup popupHtml={popupHtml} setPopupHtml={setPopupHtml} />;
    }
    return <AttackResultPopup
        popupHtml={popupHtml}
        onClose={() => {
            if (popupHtml?.type === 'automation_info') return;
            setPopupHtml(null);
        }}
        campaignName={campaignName}
        attackerName={playerStats?.name}
        playerStats={playerStats}
        setPopupHtml={setPopupHtml}
        {...buildAttackResultHandlers(popupHtml, popupHandlers)}
    />;
}

// "Arm a target" deep link (backlog 2026-11-24 run BA): the sheet no-target
// refusal copy explains the arm lane; this footer button walks the user there —
// sheet → Initiative (via the same setActiveView callback lane as Encounter
// Builder's Join Encounter / NPCs' onViewInitiative) and arms a per-client
// focus request the ATTACKER's card Target select honors on mount. It writes
// NOTHING: no targetName, no game state (server-first law — ephemeral UI
// flags stay local). No armTargetName (every other `{html}` popup) → renders
// nothing, chrome byte-unchanged.
const ArmTargetFooter = ({ armTargetName, setPopupHtml, onViewInitiative }) => {
    if (!armTargetName) return null;
    const handleArmClick = () => {
        setPopupHtml(null);
        requestArmTarget(armTargetName);
        onViewInitiative?.();
    };
    return (
        <div className="popup-close-row">
            <button type="button" className="popup-close-btn" onClick={handleArmClick}>Arm a target</button>
        </div>
    );
};

const HealMultiPopup = ({ popupHtml, setPopupHtml }) => {
    const healResults = popupHtml.results || [];
    const totalHealed = healResults.reduce((sum, r) => sum + r.healAmount, 0);
    return (
        <Popup onClickOrKeyDown={() => setPopupHtml(null)}>
            <div className="dice-roll-result">
                <div className="dice-roll-header">
                    <i className="fa-solid fa-heart"></i> {popupHtml.name}
                </div>
                <div className="dice-roll-total">{totalHealed}</div>
                <div className="dice-roll-breakdown">
                    {popupHtml.formula}: <span className="dice-rolled">{popupHtml.rolls.join(', ')}</span>
                </div>
                {popupHtml.bonusHeal > 0 && (
                    <div className="dice-roll-heal-bonus">
                        <i className="fa-solid fa-sparkles"></i> Bonus: +{popupHtml.bonusHeal} ({popupHtml.bonusHealDetail})
                    </div>
                )}
                {healResults.length > 0 && (
                    <div className="dice-roll-heal-multi">
                        {healResults.map((r, i) => (
                            <div key={i} className="dice-roll-heal-multi-target">
                                <strong>{r.targetName}</strong>: +{r.healAmount} HP ({r.rolls.join(', ')})
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Popup>
    );
};

const ATTACK_RESULT_CONDITIONAL_HANDLERS = [
    ['onSuperiorityManeuver', 'availableSuperiorityManeuvers'],
    ['onTacticalMind', 'tacticalMind'],
    ['onDarkOnesLuck', 'darkOnesLuck'],
    ['onPsiBolsteredKnack', 'psiBolsteredKnack'],
    ['onBardicInspiration', 'bardicInspiration'],
    ['onBardicInspirationOffense', 'bardicInspirationOffense'],
    ['onEmpoweredSpell', 'empoweredSpell'],
    ['onPuncture', 'piercerPuncture'],
    ['onSavageAttacker', 'savageAttacker'],
    ['onSavageAttackerChoice', 'savageAttacker'],
    ['onReroll', 'autoReroll'],
];

function buildAttackResultHandlers(popupHtml, popupHandlers) {
    const handlers = {
        onAfterBiDefense: popupHandlers.onBiDefenseCombatSummary,
        onStrokeOfLuck: popupHandlers.onStrokeOfLuck,
    };
    for (const [prop, flag] of ATTACK_RESULT_CONDITIONAL_HANDLERS) {
        handlers[prop] = popupHtml?.[flag] ? popupHandlers[prop] : undefined;
    }
    return handlers;
}
