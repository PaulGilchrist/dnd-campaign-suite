// Victory / defeat celebration overlay (Phase 1). Shown by every client at the
// combat-clear seam from the shared `lastCombatResult` stamp; click anywhere
// dismisses (per-client stamp persists — see useTvPresentation.js). The guard
// lives here so the container stays a single unconditional render.

const THEMES = {
    win: { icon: 'fa-trophy', label: 'Victory!', titleClass: '', cardClass: '' },
    defeat: { icon: 'fa-skull', label: 'The Party Falls', titleClass: ' defeat', cardClass: ' victory-card-defeat' },
}

function buildVictoryLines(result) {
    const rounds = result.rounds ?? 1
    const roundWord = rounds === 1 ? 'round' : 'rounds'
    const lines = []
    if (result.wipe) lines.push(`The party fell after ${rounds} ${roundWord}.`)
    else lines.push(`The party survived ${rounds} ${roundWord}!`)
    if (result.foes > 0) {
        const fled = Math.max(0, (result.foes ?? 0) - (result.defeated ?? 0))
        lines.push(fled > 0
            ? `${result.defeated} foes defeated · ${fled} drove off`
            : `All ${result.foes} foes defeated`)
    }
    if (result.partySize > 0) {
        lines.push(`${result.survivors} of ${result.partySize} heroes standing`)
    }
    return lines
}

export default function VictoryBanner({ visible, result, onDismiss }) {
    if (!visible || !result) return null
    const theme = result.wipe ? THEMES.defeat : THEMES.win
    return (
        <div className='victory-banner' role='status' onClick={onDismiss} title='Click to dismiss'>
            <div className={`victory-card${theme.cardClass}`}>
                <div className={`victory-title${theme.titleClass}`}>
                    <i className={`fa-solid ${theme.icon}`}></i>
                    {theme.label}
                </div>
                {buildVictoryLines(result).map(line => (
                    <div key={line} className='victory-line'>{line}</div>
                ))}
                <button type='button' className='victory-dismiss' onClick={onDismiss}>Continue</button>
            </div>
        </div>
    )
}
