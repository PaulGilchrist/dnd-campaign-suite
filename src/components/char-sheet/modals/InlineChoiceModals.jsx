import React from 'react';
import { isInteractive } from '../../../services/ui/modalDismissUtils.js';
import { confirmTeleport } from '../../../services/automation/handlers/class-warlock/tempTeleportHandler.js';

export default function InlineChoiceModals({
    mergedModalState,
    setModalState,
    setPopupHtml,
    pendingDamage,
    _mapName,
    _buildCtx,
    _buildCtxSync,
    _rollDamage,
    _playerStats,
    _campaignName,
    handleDivineFuryDamageType,
    handleDivineFurySkip,
    handleEnhancedUnarmedChoice,
    handleEnhancedUnarmedSkip,
    handleGenericDamageTypeChoice,
    handleGenericDamageTypeSkip,
    handleDamageTypeModifierChoice,
    handleDamageTypeModifierSkip,
    handleFeatureChoiceConfirm,
    handleFeatureChoiceSkip,
    handleAttackRiderOptionSelect,
    handleClockworkCavalcadeRepairConfirm,
    sanitizeHtml,
}) {
    const {
        moonlightStepFallbackModal,
        attackRiderOptionsModal,
        divineFuryChoice,
        damageTypeChoice,
        featureChoice,
        clockworkCavalcadeRepairModal,
    } = mergedModalState;

    if (!moonlightStepFallbackModal && !attackRiderOptionsModal && !divineFuryChoice && !damageTypeChoice && !featureChoice && !clockworkCavalcadeRepairModal) {
        return null;
    }

    return (
        <>
            {moonlightStepFallbackModal && (
                <div className="sp-overlay">
                    <div className="sp-modal" onClick={(e) => {
                        if (isInteractive(e.target)) return;
                        setModalState({ moonlightStepFallbackModal: null });
                    }}>
                        <div className="sp-header">
                            <i className="fa-solid fa-moon"></i> {moonlightStepFallbackModal.action.name}
                        </div>
                        <div className="sp-body">
                            <p>No Moonlight Step uses remaining. Consume a level {moonlightStepFallbackModal.slotLevel} spell slot to use Moonlight Step?</p>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-roll-btn" onClick={async () => {
                                const { action, playerStats: fallbackStats, campaignName: fallbackCampaign, slotLevel } = moonlightStepFallbackModal;
                                setModalState({ moonlightStepFallbackModal: null });
                                const res = await confirmTeleport(action, fallbackStats, fallbackCampaign, false, slotLevel);
                                if (res?.type === 'popup') {
                                    const payload = res.payload;
                                    const html = `<b>${payload.name || action.name}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
                                    setPopupHtml(html);
                                }
                            }}>
                                <i className="fa-solid fa-check"></i> Yes, Consume Slot
                            </button>
                            <button className="sp-dismiss-btn" onClick={() => setModalState({ moonlightStepFallbackModal: null })}>
                                <i className="fa-solid fa-times"></i> No
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {attackRiderOptionsModal && (
                <div className="sp-overlay">
                    <div className="sp-modal" onClick={(e) => {
                        if (isInteractive(e.target)) return;
                        setModalState({ attackRiderOptionsModal: null });
                    }}>
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> {attackRiderOptionsModal.maneuver.name} — Choose Effect
                        </div>
                        <div className="sp-body">
                            <p>Select the effect to apply:</p>
                            <div style={{ textAlign: 'left', marginTop: '12px' }}>
                                {attackRiderOptionsModal.riderOptions.map((opt, i) => (
                                    <label
                                        key={i}
                                        style={{
                                            display: 'block', padding: '8px 12px', margin: '4px 0',
                                            borderRadius: '6px', cursor: 'pointer',
                                            background: 'transparent',
                                            border: '1px solid var(--color-link)',
                                        }}
                                        onClick={() => handleAttackRiderOptionSelect(opt.name, attackRiderOptionsModal)}
                                    >
                                        <strong>{opt.name}</strong>
                                        {opt.effect === 'disadvantage_on_next_save' && <span style={{ opacity: 0.7, marginLeft: '6px', fontSize: '0.85em' }}>— Target has Disadvantage on next saving throw</span>}
                                        {opt.effect === 'next_attack_bonus' && <span style={{ opacity: 0.7, marginLeft: '6px', fontSize: '0.85em' }}>— Next attack against target gains +5 bonus</span>}
                                        {opt.effect === 'push_15ft' && <span style={{ opacity: 0.7, marginLeft: '6px', fontSize: '0.85em' }}>— Push target 15 feet</span>}
                                        {opt.effect === 'speed_reduction' && <span style={{ opacity: 0.7, marginLeft: '6px', fontSize: '0.85em' }}>— Reduce target's speed by 15 feet</span>}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-dismiss-btn" onClick={() => setModalState({ attackRiderOptionsModal: null })}>Skip</button>
                        </div>
                    </div>
                </div>
            )}
            {divineFuryChoice && (
                <div className="sp-overlay">
                    <div className="sp-modal">
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> Divine Fury — Damage Type
                        </div>
                        <div className="sp-body">
                            <p>Choose the damage type for this hit:</p>
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                <button className="sp-roll-btn" style={{ marginRight: '12px' }} onClick={() => handleDivineFuryDamageType('Necrotic')}>
                                    <i className="fa-solid fa-skull"></i> Necrotic
                                </button>
                                <button className="sp-roll-btn" onClick={() => handleDivineFuryDamageType('Radiant')}>
                                    <i className="fa-solid fa-sun"></i> Radiant
                                </button>
                            </div>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-dismiss-btn" onClick={handleDivineFurySkip}>Skip</button>
                        </div>
                    </div>
                </div>
            )}
            {damageTypeChoice && (
                <div className="sp-overlay">
                    <div className="sp-modal">
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> {damageTypeChoice.title}
                        </div>
                        <div className="sp-body">
                            <p>Choose the damage type for this hit:</p>
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                {damageTypeChoice.types.map((type) => (
                                    <button
                                        key={type}
                                        className="sp-roll-btn"
                                        style={{ margin: '0 6px 8px 6px' }}
                                        onClick={() => {
                                            if (pendingDamage?._attackRider) handleEnhancedUnarmedChoice(type);
                                            else if (pendingDamage?._damageTypeModifier) handleDamageTypeModifierChoice(type);
                                            else handleGenericDamageTypeChoice(type);
                                        }}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-dismiss-btn" onClick={() => {
                                if (pendingDamage?._attackRider) handleEnhancedUnarmedSkip();
                                else if (pendingDamage?._damageTypeModifier) handleDamageTypeModifierSkip();
                                else handleGenericDamageTypeSkip();
                            }}>Skip</button>
                        </div>
                    </div>
                </div>
            )}
            {featureChoice && (
                <div className="sp-overlay">
                    <div className="sp-modal">
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> {featureChoice.action.name}
                        </div>
                        <div className="sp-body">
                            <p><b>Choose your option:</b></p>
                            <p style={{ opacity: 0.8, fontSize: '0.9em' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(featureChoice.action.description) }}></p>
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                {featureChoice.options.map((opt, i) => {
                                    const optName = typeof opt === 'string' ? opt : opt.name;
                                    return (
                                        <button
                                            key={optName || i}
                                            className="sp-roll-btn"
                                            style={{ margin: '0 6px 8px 6px' }}
                                            onClick={() => handleFeatureChoiceConfirm(optName)}
                                        >
                                            {optName}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-dismiss-btn" onClick={handleFeatureChoiceSkip}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
            {clockworkCavalcadeRepairModal && (
                <div className="sp-overlay">
                    <div className="sp-modal" onClick={(e) => {
                        if (isInteractive(e.target)) return;
                        setModalState({ clockworkCavalcadeRepairModal: null });
                    }}>
                        <div className="sp-header">
                            <i className="fa-solid fa-hammer"></i> Clockwork Cavalcade: Repair
                        </div>
                        <div className="sp-body">
                            <p>Damaged objects within the Cube are repaired instantly. This effect does not restore Hit Points to creatures.</p>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-confirm-btn" onClick={handleClockworkCavalcadeRepairConfirm} type="button">
                                <i className="fa-solid fa-hammer"></i> Repair
                            </button>
                            <button className="sp-dismiss-btn" onClick={() => setModalState({ clockworkCavalcadeRepairModal: null })} type="button">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
