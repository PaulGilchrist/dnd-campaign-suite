
function ConcentrationPicker({ targetName, spellName, dc, onSpellNameChange, onDcChange, onCancel, onApply }) {
    return (
        <div className='condition-picker-overlay' onClick={onCancel}>
            <div className='condition-picker-modal' onClick={e => e.stopPropagation()}>
                <h3>Concentration for {targetName}</h3>
                <div className='condition-picker-fields'>
                    <label>
                        Spell
                        <input
                            type='text'
                            value={spellName}
                            onChange={e => onSpellNameChange(e.target.value)}
                            placeholder='Spell name'
                            autoFocus
                        />
                    </label>
                    <label>
                        DC
                        <input
                            type='number'
                            min='1'
                            value={dc}
                            onChange={e => onDcChange(parseInt(e.target.value) || 10)}
                        />
                    </label>
                </div>
                <div className='condition-picker-actions'>
                    <button onClick={onCancel} type='button'>Cancel</button>
                    <button onClick={onApply} disabled={!spellName.trim()} type='button'>Apply</button>
                </div>
            </div>
        </div>
    )
}

export default ConcentrationPicker
