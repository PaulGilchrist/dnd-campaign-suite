import React from 'react'
import { CONDITIONS, getDefaultAbility } from '../../services/combat/conditions/conditionUtils.js'
import { TARGET_EFFECT_DEFINITIONS } from '../../services/combat/conditions/targetEffectDefinitions.js'
import './EffectAdder.css'

const SOURCE_OTHER = '__other__'

const ABILITY_OPTIONS = [
  { value: 'str', label: 'Strength' },
  { value: 'dex', label: 'Dexterity' },
  { value: 'con', label: 'Constitution' },
  { value: 'int', label: 'Intelligence' },
  { value: 'wis', label: 'Wisdom' },
  { value: 'cha', label: 'Charisma' },
]

function EffectAdder({ targetName, initialTab, onCancel, onApply, creatures }) {
  const [activeTab, setActiveTab] = React.useState(initialTab || 'conditions')

  // Conditions tab state
  const [selectedCondition, setSelectedCondition] = React.useState(null)
  const [conditionDc, setConditionDc] = React.useState(10)
  const [conditionAbility, setConditionAbility] = React.useState('con')

  // Effects tab state
  const [selectedEffectKey, setSelectedEffectKey] = React.useState(null)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [effectSource, setEffectSource] = React.useState('')
  const [sourceCustom, setSourceCustom] = React.useState('')
  const [effectValue, setEffectValue] = React.useState(10)
  const [effectAbility, setEffectAbility] = React.useState('wis')
  const [effectDc, setEffectDc] = React.useState(15)
  const [effectNotes, setEffectNotes] = React.useState('')

  // Concentration tab state
  const [spellName, setSpellName] = React.useState('')
  const [concentrationDc, setConcentrationDc] = React.useState(10)

  const creatureNames = React.useMemo(() => {
    const names = (creatures || []).map(c => c.name).filter(Boolean)
    return [...new Set(names)].sort((a, b) => a.localeCompare(b))
  }, [creatures])

  const selectedEffectDef = TARGET_EFFECT_DEFINITIONS.find(d => d.effect === selectedEffectKey)

  // Reset effects config when selection changes
  const handleSelectEffect = (effectKey) => {
    const def = TARGET_EFFECT_DEFINITIONS.find(d => d.effect === effectKey)
    setSelectedEffectKey(effectKey)
    setEffectSource(def?.defaults?.source || '')
    setSourceCustom('')
    setEffectValue(def?.defaults?.value ?? 10)
    setEffectAbility(def?.defaults?.ability || 'wis')
    setEffectDc(def?.defaults?.dc ?? 15)
    setEffectNotes('')
  }

  // Determine which fields to show for the selected effect
  const hasField = (field) => selectedEffectDef?.fields?.includes(field)

  // Filter effects by search query
  const filteredDefinitions = React.useMemo(() => {
    if (!searchQuery.trim()) return TARGET_EFFECT_DEFINITIONS
    const q = searchQuery.toLowerCase()
    return TARGET_EFFECT_DEFINITIONS.filter(def =>
      def.label.toLowerCase().includes(q) ||
      def.description.toLowerCase().includes(q) ||
      def.group.toLowerCase().includes(q) ||
      def.effect.toLowerCase().includes(q)
    )
  }, [searchQuery])

  // Group effects, filtering out empty groups when searching
  const groupedEffects = React.useMemo(() => {
    const groups = {}
    const groupOrder = ['Attack', 'Defensive', 'Saves & Checks', 'Spells', 'Movement', 'Lair']
    for (const def of filteredDefinitions) {
      if (!groups[def.group]) groups[def.group] = []
      groups[def.group].push(def)
    }
    return groupOrder.filter(g => groups[g]?.length).map(g => ({ group: g, effects: groups[g] }))
  }, [filteredDefinitions])

  const handleApplyCondition = () => {
    if (!selectedCondition) return
    onApply('conditions', { target: targetName, conditionKey: selectedCondition, dc: conditionDc, ability: conditionAbility })
  }

  const handleApplyEffect = () => {
    if (!selectedEffectKey) return
    onApply('effects', {
      target: targetName,
      effectKey: selectedEffectKey,
      source: effectSource === SOURCE_OTHER ? (sourceCustom || undefined) : (effectSource || undefined),
      value: hasField('value') ? effectValue : undefined,
      ability: hasField('ability') ? effectAbility : undefined,
      dc: hasField('dc') ? effectDc : undefined,
      notes: effectNotes || undefined,
    })
  }

  const handleApplyConcentration = () => {
    if (!spellName.trim()) return
    onApply('concentration', { target: targetName, spellName: spellName.trim(), dc: concentrationDc })
  }

  return (
    <div className='ea-overlay'>
      <div className='ea-modal'>
        <h3>{targetName}</h3>

        {/* ── Tab Bar ── */}
        <div className='ea-tabs'>
          {[
            { key: 'conditions', label: 'Conditions' },
            { key: 'effects', label: 'Effects' },
            { key: 'concentration', label: 'Concentration' },
          ].map(tab => (
            <button
              key={tab.key}
              className={`ea-tab ${activeTab === tab.key ? 'ea-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
              type='button'
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Conditions Tab ── */}
        {activeTab === 'conditions' && (
          <div>
            <div className='ea-grid'>
              {CONDITIONS.map(({ key, label }) => (
                <button
                  key={key}
                  className={`ea-badge ${selectedCondition === key ? 'ea-badge--selected' : ''}`}
                  onClick={() => {
                    setSelectedCondition(key)
                    const defaultAb = getDefaultAbility(key)
                    if (defaultAb) setConditionAbility(defaultAb)
                  }}
                  type='button'
                >
                  {label}
                </button>
              ))}
            </div>
            <div className='ea-fields'>
              <label>
                DC
                <input
                  type='number'
                  min='1'
                  value={conditionDc}
                  onChange={e => setConditionDc(parseInt(e.target.value) || 10)}
                />
              </label>
              <label>
                Save
                <select
                  value={conditionAbility}
                  onChange={e => setConditionAbility(e.target.value)}
                >
                  {ABILITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className='ea-actions'>
              <button onClick={onCancel} type='button'>Cancel</button>
              <button onClick={handleApplyCondition} disabled={!selectedCondition} type='button'>Apply</button>
            </div>
          </div>
        )}

        {/* ── Effects Tab ── */}
        {activeTab === 'effects' && (
          <div>
            <input
              className='ea-search'
              type='text'
              placeholder='Search effects…'
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSelectedEffectKey(null) }}
              autoFocus
            />

            {!selectedEffectKey ? (
              <div className='ea-scroll'>
                {groupedEffects.map(({ group, effects }) => (
                  <div key={group}>
                    <div className='ea-group-label'>{group}</div>
                    <div className='ea-group-effects'>
                      {effects.map(def => (
                        <button
                          key={def.effect}
                          className='ea-badge'
                          onClick={() => handleSelectEffect(def.effect)}
                          type='button'
                          title={def.description}
                        >
                          <i className={`fa-solid ${def.icon}`}></i> {def.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {groupedEffects.length === 0 && (
                  <div className='ea-empty'>No effects match "{searchQuery}"</div>
                )}
              </div>
            ) : (
              <div className='ea-config'>
                <div className='ea-config-header'>
                  <i className={`fa-solid ${selectedEffectDef.icon}`}></i>
                  <strong>{selectedEffectDef.label}</strong>
                </div>
                <p className='ea-config-desc'>{selectedEffectDef.description}</p>

                {hasField('source') && (
                  <label className='ea-config-field'>
                    Source (who caused this):
                    <select
                      value={effectSource}
                      onChange={e => setEffectSource(e.target.value)}
                    >
                      <option value='' disabled>Select source…</option>
                      {creatureNames.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                      <option value={SOURCE_OTHER}>Other…</option>
                    </select>
                    {effectSource === SOURCE_OTHER && (
                      <input
                        type='text'
                        value={sourceCustom}
                        onChange={e => setSourceCustom(e.target.value)}
                        placeholder='Custom source name'
                      />
                    )}
                  </label>
                )}

                {hasField('value') && (
                  <label className='ea-config-field'>
                    Value:
                    <input
                      type='number'
                      min='1'
                      value={effectValue}
                      onChange={e => setEffectValue(parseInt(e.target.value) || 0)}
                    />
                  </label>
                )}

                {hasField('ability') && (
                  <label className='ea-config-field'>
                    Ability:
                    <select value={effectAbility} onChange={e => setEffectAbility(e.target.value)}>
                      {ABILITY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </label>
                )}

                {hasField('dc') && (
                  <label className='ea-config-field'>
                    Save DC:
                    <input
                      type='number'
                      min='1'
                      value={effectDc}
                      onChange={e => setEffectDc(parseInt(e.target.value) || 10)}
                    />
                  </label>
                )}

                <label className='ea-config-field'>
                  Notes (optional):
                  <textarea
                    value={effectNotes}
                    onChange={e => setEffectNotes(e.target.value)}
                    placeholder='GM notes about this effect…'
                    rows={2}
                  />
                </label>

                <div className='ea-actions'>
                  <button onClick={() => setSelectedEffectKey(null)} type='button'>Back</button>
                  <button onClick={handleApplyEffect} type='button'>Apply</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Concentration Tab ── */}
        {activeTab === 'concentration' && (
          <div>
            <div className='ea-fields'>
              <label>
                Spell Name
                <input
                  type='text'
                  value={spellName}
                  onChange={e => setSpellName(e.target.value)}
                  placeholder='e.g. Hold Person'
                  autoFocus
                />
              </label>
              <label>
                DC
                <input
                  type='number'
                  min='1'
                  value={concentrationDc}
                  onChange={e => setConcentrationDc(parseInt(e.target.value) || 10)}
                />
              </label>
            </div>
            <div className='ea-actions'>
              <button onClick={onCancel} type='button'>Cancel</button>
              <button onClick={handleApplyConcentration} disabled={!spellName.trim()} type='button'>Apply</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EffectAdder
