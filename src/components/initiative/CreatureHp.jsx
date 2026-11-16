

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

function CurrentHpInput({ creature, currentHp, effectiveMaxHp, onChange, hpPending = false }) {
    const isPlayer = creature.type === 'player'
    return (
        <input
            // Fresh-mount settle face (improvement 2026-11-16 XB): while a player
            // row's HP truth (runtime bucket / roster stats) is still baking, show
            // a disabled em-dash placeholder instead of the fabricated 0 — and
            // flip the key on settle so the UNCONTROLLED defaultValue re-syncs
            // to the baked value (same presence-keyed remount idiom as
            // InitiativeControl in CreatureCard.jsx) rather than lingering on 0.
            key={hpPending ? 'hp-settling' : 'hp-live'}
            className="hp-inline-input"
            type="number"
            min={0}
            disabled={hpPending}
            defaultValue={hpPending ? '' : currentHp}
            placeholder={hpPending ? '—' : undefined}
            onBlur={(e) => {
                // Settle-window belt: a disabled input never receives real
                // focus, but a synthetic blur must never commit the
                // fabricated window either.
                if (hpPending) return
                let value = parseInt(e.target.value) || 0
                if (!isPlayer) {
                    // bug-initiative-hp-input-no-range-clamp: monster commits clamp
                    // into [0, effective max] and the input echoes the stored number
                    // so the card never shows an impossible value. Players keep
                    // the UNCLAMPED ceiling (temp-HP overshoot above max is legitimate).
                    value = Math.max(0, Math.min(value, effectiveMaxHp))
                    e.target.value = value
                }
                else if (value < 0) {
                    // bug-gm-hp-input-negative-player-hp: the player lane shares the
                    // damage lane's death floor (applyDamage Math.max(0, …)) — a
                    // mistyped minus sign echoes 0 instead of lingering as an
                    // impossible negative.
                    value = 0
                    e.target.value = value
                }
                onChange(creature.name, value)
            }}
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
                // #854: report through onChange(name, currentHp, baseMax) — never mutate
                // the creature prop (store-ref by way of combatSummary.creatures).
                const newCurrentHp = creature.currentHp > newEffectiveMax ? newEffectiveMax : creature.currentHp
                onChange(creature.name, newCurrentHp, newBaseMax)
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur()
            }}
            aria-label={`${creature.name} max HP`}
        />
    )
}

// TV presentation lane: big bar + plain numbers + status badge — across-the-
// room readable, zero input chrome. Exception: on non-localhost clients,
// monster HP NUMBERS stay hidden (bar + status badge only), mirroring the
// remote lane — a TV is shared with players, so the big-type mode must not
// leak what the normal lane hides.
function TvHpRow({ currentHp, effectiveMaxHp, isDead, isBloodied, hideNumbers }) {
    return (
        <div className="creature-hp">
            <div className="hp-bar-row">
                <HpBar current={currentHp} max={effectiveMaxHp} />
            </div>
            <div className="hp-inline-row">
                {!hideNumbers && (
                    <>
                        <span className="hp-label">HP</span>
                        <span className="hp-max-val">{currentHp}/{effectiveMaxHp}</span>
                    </>
                )}
                <HpStatusBadges isDead={isDead} isBloodied={isBloodied} />
            </div>
        </div>
    )
}

// Fresh-mount settle gate (improvement 2026-11-16 XB): player rows only —
// buildPlayerDisplayFields flags the window where neither the runtime HP
// bucket nor the roster's own stats has baked yet. Monster rows carry real HP
// on the combatSummary row itself, so they never settle. Module scope: the
// CreatureHp component sits at the eslint complexity ceiling (Initiative.jsx
// isActiveEconomyRowGmDriven precedent).
function isPlayerHpPending(creature) {
    return creature.type === 'player' && creature.hpPending === true
}

// GM/localhost player row: editable current HP + static max. Extracted to a
// sibling lane component (TvHpRow precedent) to keep CreatureHp under its
// eslint complexity ceiling while the settle gate lives in it (XB 2026-11-16).
function PlayerLocalhostHpRow({ creature, currentHp, effectiveMaxHp, onChange, hpPending }) {
    return (
        <>
            <CurrentHpInput creature={creature} currentHp={currentHp} effectiveMaxHp={effectiveMaxHp} onChange={onChange} hpPending={hpPending} />
            <span className="hp-sep">/</span>
            <span className="hp-max-val">{hpPending ? '—' : effectiveMaxHp}</span>
        </>
    )
}

function CreatureHp({ creature, isLocalhost, onChange, isPlayerSummoned, tvMode = false }) {
    const { currentHp: rawCurrentHp, maxHp: rawMaxHp, type, name } = creature
    const hpPending = isPlayerHpPending(creature)
    const currentHp = rawCurrentHp ?? 0
    const maxHp = rawMaxHp ?? 1
    const aidIncrease = useRuntimeValue(name, 'aidHpMaxIncrease', null)
    const heroesFeastIncrease = useRuntimeValue(name, 'heroesFeastHpMaxIncrease', null)
    const effectiveMaxHp = maxHp + (Number(aidIncrease) || 0) + (Number(heroesFeastIncrease) || 0)
    const isDead = currentHp <= 0
    const isBloodied = currentHp > 0 && currentHp <= Math.floor(effectiveMaxHp / 2)

    // TV presentation mode renders its own row; players/summoned/GM keep the
    // numeric bytes, remote monster cards fall back to badge-only.
    if (tvMode) {
        return (
            <TvHpRow
                currentHp={currentHp}
                effectiveMaxHp={effectiveMaxHp}
                isDead={isDead}
                isBloodied={isBloodied}
                hideNumbers={type !== 'player' && !isLocalhost && !isPlayerSummoned}
            />
        )
    }

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
                    <CurrentHpInput creature={creature} currentHp={currentHp} effectiveMaxHp={effectiveMaxHp} onChange={onChange} />
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
                    <PlayerLocalhostHpRow creature={creature} currentHp={currentHp} effectiveMaxHp={effectiveMaxHp} onChange={onChange} hpPending={hpPending} />
                ) : (
                    <span className="hp-max-val">{currentHp}/{effectiveMaxHp}</span>
                )}
            </div>
        </div>
    )
}

export default CreatureHp
