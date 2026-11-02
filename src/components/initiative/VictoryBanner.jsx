// Victory / defeat celebration overlay (Phase 1). Shown by every client at the
// combat-clear seam from the shared `lastCombatResult` stamp; click anywhere
// dismisses (per-client stamp persists — see useTvPresentation.js). The guard
// lives here so the container stays a single unconditional render.

import { buildVictoryLines } from './victoryLines.js'

const THEMES = {
    win: { icon: 'fa-trophy', label: 'Victory!', titleClass: '', cardClass: '' },
    defeat: { icon: 'fa-skull', label: 'The Party Falls', titleClass: ' defeat', cardClass: ' victory-card-defeat' },
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
