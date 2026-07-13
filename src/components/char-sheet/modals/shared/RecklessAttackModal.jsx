import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import '../../CharSheet.css';

function RecklessAttackModal({ playerStats, campaignName, attack, onConfirm, onCancel }) {
    const playerName = playerStats.name;

    const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
    const isRecklessActive = activeBuffs.some(b => b.effect === 'advantage_attacks_advantage_against');

    console.log('[RecklessAttackModal] Pre-conditions:', {
        hasRecklessFeature: playerStats.automation?.specialActions?.some(a => a.effect === 'advantage_attacks_advantage_against' && a.trigger === 'first_attack_of_turn'),
        isRecklessAlreadyActive: isRecklessActive,
        attackName: attack?.name,
        attackAbilityName: attack?.abilityName,
        attackWeaponType: attack?.weaponType,
    });

    return (
        <div className="sp-overlay" onClick={onCancel}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-shield-halved"></i> Reckless Attack
                </div>
                <div className="sp-body">
                    <p>Use Reckless Attack? You'll have Advantage on Strength attack rolls until the start of your next turn, but attack rolls against you also have Advantage.</p>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={onConfirm}>
                        <i className="fa-solid fa-shield-halved"></i> Attack Recklessly
                    </button>
                    <button className="sp-dismiss-btn" onClick={onCancel}>Normal Attack</button>
                </div>
            </div>
        </div>
    );
}

export default RecklessAttackModal;
