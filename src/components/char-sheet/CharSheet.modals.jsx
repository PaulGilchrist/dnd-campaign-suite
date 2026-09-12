import React from 'react'
import SecondaryTargetModal from './modals/shared/SecondaryTargetModal.jsx'
import { sanitizeHtml } from '../../services/ui/sanitize.js'
import Popup from '../common/popup.jsx'
import AttackResultPopup from '../common/AttackResultPopup.jsx'
import PolymorphSelectionModal from './modals/PolymorphSelectionModal.jsx'
import AnimalShapesSelectionModal from './modals/AnimalShapesSelectionModal.jsx'
import ObjectTransformModal from './modals/ObjectTransformModal.jsx'

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

export { ShieldOfFaithTargetSelectionModal };

// eslint-disable-next-line react-refresh/only-export-components
export const renderPopup = ({ popupHtml, setPopupHtml, isLocalhost, playerStats, campaignName, characters: _characters, popupHandlers }) => {
    if (!popupHtml) return null;
    
    if (typeof popupHtml === 'string') {
        return <Popup onClickOrKeyDown={() => setPopupHtml(null)}><div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml) }}></div></Popup>;
    }
    if (popupHtml.type === 'shield_of_faith_target_selection') return null;
    if (popupHtml.type === 'barkskin_target_selection') return null;
    if (popupHtml.html) {
        return <Popup onClickOrKeyDown={() => setPopupHtml(null)}><div className="dice-roll-result"><div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml.html) }}></div><div className="dice-roll-hint">click to dismiss</div></div></Popup>;
    }
    if (popupHtml.type === 'automation_info') {
        return <Popup onClickOrKeyDown={() => setPopupHtml(null)}><div className="dice-roll-result"><div className="dice-roll-header"><i className="fa-solid fa-info-circle"></i>{popupHtml.name}</div><div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml.description) }}></div><div className="dice-roll-hint">click to dismiss</div></div></Popup>;
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
                excludeTypes={['construct', 'undead']}
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
                <div className="dice-roll-hint">click to dismiss</div>
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
