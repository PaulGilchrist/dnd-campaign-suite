

function CreatureHp({ creature, isLocalhost, onChange }) {
    const { currentHp: rawCurrentHp, maxHp: rawMaxHp, type } = creature
    const currentHp = rawCurrentHp ?? 0
    const maxHp = rawMaxHp ?? 1
    const isDead = currentHp <= 0
    const isBloodied = currentHp > 0 && currentHp <= Math.floor(maxHp / 2)

    if (type === 'npc' && !isLocalhost) {
        return (
            <div className="creature-hp">
                <div className="hp-bar-row">
                    <HpBar current={currentHp} max={maxHp} />
                </div>
                <div className="hp-inline-row">
                    <span className="hp-status">
                        {isDead && <span className="status-badge dead">DEAD</span>}
                        {isBloodied && <span className="status-badge bloodied">BLOODIED</span>}
                        {!isDead && !isBloodied && <span className="status-badge healthy">OK</span>}
                    </span>
                </div>
            </div>
        )
    }

    if (type === 'npc' && isLocalhost) {
        return (
            <div className="creature-hp">
                <div className="hp-bar-row">
                    <HpBar current={currentHp} max={maxHp} />
                </div>
                <div className="hp-inline-row">
                    <span className="hp-label">HP</span>
                    <input
                        className="hp-inline-input"
                        type="number"
                        min="0"
                        value={currentHp}
                        onChange={(e) => onChange(creature.name, parseInt(e.target.value) || 0)}
                        aria-label={`${creature.name} current HP`}
                    />
                    <span className="hp-sep">/</span>
                    <input
                        className="hp-inline-input hp-max-input"
                        type="number"
                        min="1"
                        value={maxHp}
                        onChange={(e) => {
                            const newMax = parseInt(e.target.value) || 1
                            creature.maxHp = newMax
                            if (creature.currentHp > newMax) {
                                creature.currentHp = newMax
                            }
                            onChange(creature.name, creature.currentHp)
                        }}
                        aria-label={`${creature.name} max HP`}
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="creature-hp">
            <div className="hp-bar-row">
                <HpBar current={currentHp} max={maxHp} />
            </div>
            <div className="hp-inline-row">
                <span className="hp-label">HP</span>
                <input
                    className="hp-inline-input"
                    type="number"
                    min={0}
                    value={currentHp}
                    onChange={(e) => onChange(creature.name, parseInt(e.target.value) || 0)}
                    aria-label={`${creature.name} current HP`}
                />
                <span className="hp-sep">/</span>
                <span className="hp-max-val">{maxHp}</span>
            </div>
        </div>
    )
}

import HpBar from './HpBar.jsx'

export default CreatureHp
