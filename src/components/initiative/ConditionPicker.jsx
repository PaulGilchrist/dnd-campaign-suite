

function ConditionPicker({ targetName, selected, dc, ability, onSelect, onDcChange, onAbilityChange, onCancel, onApply }) {
    return (
        <div className='condition-picker-overlay' onClick={onCancel}>
            <div className='condition-picker-modal' onClick={e => e.stopPropagation()}>
                <h3>Add Condition to {targetName}</h3>
                <div className='condition-picker-grid'>
                    {CONDITIONS.map(({ key, label }) => (
                        <button
                            key={key}
                            className={`condition-badge condition-picker-badge ${selected === key ? 'condition-picker-badge--selected' : ''}`}
                            onClick={() => {
                                onSelect(key)
                                onAbilityChange(getDefaultAbility(key) || 'str')
                            }}
                            type='button'
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className='condition-picker-fields'>
                    <label>
                        DC
                        <input
                            type='number'
                            min='1'
                            value={dc}
                            onChange={e => onDcChange(parseInt(e.target.value) || 10)}
                        />
                    </label>
                    <label>
                        Save
                        <select
                            value={ability}
                            onChange={e => onAbilityChange(e.target.value)}
                        >
                            <option value='str'>Strength</option>
                            <option value='dex'>Dexterity</option>
                            <option value='con'>Constitution</option>
                            <option value='int'>Intelligence</option>
                            <option value='wis'>Wisdom</option>
                            <option value='cha'>Charisma</option>
                        </select>
                    </label>
                </div>
                <div className='condition-picker-actions'>
                    <button onClick={onCancel} type='button'>Cancel</button>
                    <button onClick={onApply} disabled={!selected} type='button'>Apply</button>
                </div>
            </div>
        </div>
    )
}

import { CONDITIONS, getDefaultAbility } from '../../services/conditionUtils.js'

export default ConditionPicker
