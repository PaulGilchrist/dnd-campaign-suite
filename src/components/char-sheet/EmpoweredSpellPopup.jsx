function EmpoweredSpellPopup({ state, onReroll, onClose }) {
    return (
        <div className="dice-roll-result">
            <div className="dice-roll-header">
                <i className="fa-solid fa-wand-magic-sparkles"></i>{state.name}
            </div>
            <div className="metamagic-sp-display">
                Sorcery Points: <strong>{state.currentSP}</strong> / {state.maxSP}
            </div>
            {state.error && (
                <div className="empowered-error" style={{ color: 'var(--stat-penalized, #cc4444)', marginTop: '8px' }}>
                    {state.error}
                </div>
            )}
            {state.lastEvent && !state.completed && state.lastEvent.rolls && (
                <div className="empowered-damage-info" style={{ marginTop: '8px' }}>
                    <div><strong>Spell:</strong> {state.lastEvent.spellName}</div>
                    <div><strong>Target:</strong> {state.lastEvent.targetName}</div>
                    <div><strong>Formula:</strong> {state.lastEvent.damageFormula}</div>
                    <div><strong>Original Damage:</strong> {state.lastEvent.rawDamage}</div>
                    <div><strong>CHA Modifier:</strong> {state.chaMod} — can reroll up to {state.chaMod} dice</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => onReroll(state.lastEvent, state.chaMod)}
                            style={{ padding: '4px 12px', cursor: 'pointer' }}
                        >
                            <i className="fa-solid fa-dice"></i> Reroll (1 SP)
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={onClose}
                            style={{ padding: '4px 12px', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            {state.completed && state.result && (
                <div className="empowered-result" style={{ marginTop: '8px' }}>
                    <hr />
                    {state.result.message ? (
                        <div>{state.result.message}</div>
                    ) : (
                        <>
                            <div><strong>Original Damage:</strong> {state.result.oldTotal}</div>
                            <div><strong>New Damage:</strong> {state.result.newTotal}</div>
                            <div><strong>Difference:</strong> {state.result.damageDifference > 0 ? '+' : ''}{state.result.damageDifference}</div>
                            <div><strong>Dice Rerolled:</strong> {state.result.rerollCount}</div>
                            <div style={{ fontSize: '0.85em', marginTop: '4px' }}>
                                Original dice: ({state.result.originalDice.join(', ')})<br />
                                New dice: ({state.result.newDice.join(', ')})
                            </div>
                            {state.result.targetCurrentHp != null && (
                                <div style={{ marginTop: '4px' }}><strong>Target HP:</strong> {state.result.targetCurrentHp}</div>
                            )}
                        </>
                    )}
                    <div style={{ marginTop: '8px', color: 'var(--stat-penalized, #cc4444)' }}>Spent 1 Sorcery Point</div>
                    <div className="dice-roll-hint" style={{ marginTop: '4px' }}>click to dismiss</div>
                </div>
            )}
            {!state.lastEvent && !state.error && (
                <div className="empowered-no-event" style={{ marginTop: '8px' }}>
                    No recent damage event found. Cast a spell that deals damage first.
                </div>
            )}
            {state.lastEvent && !state.lastEvent.rolls && !state.completed && (
                <div className="dice-roll-hint" style={{ marginTop: '8px' }}>click to dismiss</div>
            )}
        </div>
    );
}

export default EmpoweredSpellPopup;
