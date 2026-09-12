

import { HP_STATUS_DESCRIPTIONS } from '../../services/combat/conditions/effectDescriptions.js'
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import HpBar from './HpBar.jsx'

function HpStatusBadges({ isDead, isBloodied }) {
    return (
        <span className="hp-status">
            {isDead && <span className="status-badge dead" title={HP_STATUS_DESCRIPTIONS['DEAD']}>DEAD</span>}
            {isBloodied && <span className="status-badge bloodied" title={HP_STATUS_DESCRIPTIONS['BLOODIED']}>BLOODIED</span>}
            {!isDead && !isBloodied && <span className="status-badge healthy" title={HP_STATUS_DESCRIPTIONS['OK']}>OK</span>}
        </span>
    )
}

function CurrentHpInput({ creature, currentHp, onChange }) {
    return (
        <input
            className="hp-inline-input"
            type="number"
            min={0}
            defaultValue={currentHp}
            onBlur={(e) => onChange(creature.name, parseInt(e.target.value) || 0)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur()
            }}
            aria-label={`${creature.name} current HP`}
        />
    )
}

function MaxHpInput({ creature, effectiveMaxHp, aidIncrease, heroesFeastIncrease, onChange }) {
    return (
        <input
            className="hp-inline-input hp-max-input"
            type="number"
            min="1"
            defaultValue={effectiveMaxHp}
            onBlur={(e) => {
                const newEffectiveMax = parseInt(e.target.value) || 1
                const aidAmt = Number(aidIncrease) || 0
                const hfAmt = Number(heroesFeastIncrease) || 0
                const newBaseMax = newEffectiveMax - aidAmt - hfAmt
                creature.maxHp = newBaseMax
                if (creature.currentHp > newEffectiveMax) {
                    creature.currentHp = newEffectiveMax
                }
                onChange(creature.name, creature.currentHp)
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur()
            }}
            aria-label={`${creature.name} max HP`}
        />
    )
}

function CreatureHp({ creature, isLocalhost, onChange, isPlayerSummoned }) {
    const { currentHp: rawCurrentHp, maxHp: rawMaxHp, type, name } = creature
    const currentHp = rawCurrentHp ?? 0
    const maxHp = rawMaxHp ?? 1
    const aidIncrease = useRuntimeValue(name, 'aidHpMaxIncrease', null)
    const heroesFeastIncrease = useRuntimeValue(name, 'heroesFeastHpMaxIncrease', null)
    const effectiveMaxHp = maxHp + (Number(aidIncrease) || 0) + (Number(heroesFeastIncrease) || 0)
    const isDead = currentHp <= 0
    const isBloodied = currentHp > 0 && currentHp <= Math.floor(effectiveMaxHp / 2)

    if (type !== 'player' && !isLocalhost) {
        if (isPlayerSummoned) {
            return (
                <div className="creature-hp">
                    <div className="hp-bar-row">
                        <HpBar current={currentHp} max={effectiveMaxHp} />
                    </div>
                    <div className="hp-inline-row">
                        <span className="hp-label">HP</span>
                        <span className="hp-max-val">{currentHp}/{effectiveMaxHp}</span>
                    </div>
                </div>
            )
        }
        return (
            <div className="creature-hp">
                <div className="hp-bar-row">
                    <HpBar current={currentHp} max={effectiveMaxHp} />
                </div>
                <div className="hp-inline-row">
                    <HpStatusBadges isDead={isDead} isBloodied={isBloodied} />
                </div>
            </div>
        )
    }

    if (type !== 'player') {
        return (
            <div className="creature-hp">
                <div className="hp-bar-row">
                    <HpBar current={currentHp} max={effectiveMaxHp} />
                </div>
                <div className="hp-inline-row">
                    <span className="hp-label">HP</span>
                    <CurrentHpInput creature={creature} currentHp={currentHp} onChange={onChange} />
                    <span className="hp-sep">/</span>
                    <MaxHpInput creature={creature} effectiveMaxHp={effectiveMaxHp} aidIncrease={aidIncrease} heroesFeastIncrease={heroesFeastIncrease} onChange={onChange} />
                </div>
            </div>
        )
    }

    return (
        <div className="creature-hp">
            <div className="hp-bar-row">
                <HpBar current={currentHp} max={effectiveMaxHp} />
            </div>
            <div className="hp-inline-row">
                <span className="hp-label">HP</span>
                {isLocalhost ? (
                    <>
                        <CurrentHpInput creature={creature} currentHp={currentHp} onChange={onChange} />
                        <span className="hp-sep">/</span>
                        <span className="hp-max-val">{effectiveMaxHp}</span>
                    </>
                ) : (
                    <span className="hp-max-val">{currentHp}/{effectiveMaxHp}</span>
                )}
            </div>
        </div>
    )
}

export default CreatureHp
