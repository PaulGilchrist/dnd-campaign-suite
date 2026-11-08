// Victory / defeat celebration overlay (Phase 1). Shown by every client at the
// combat-clear seam from the shared `lastCombatResult` stamp; dismissal is via
// the explicit × / Continue buttons (per-client stamp persists — see
// useTvPresentation.js). The guard lives here so the container stays a single
// unconditional render.
// The full-screen scrim is pointer-events:none (EN backlog 2026-11-08) and the
// card body is too (EP backlog 2026-11-08): neither ever swallows the first
// click aimed at the board underneath — only the two dismiss buttons capture.
// The card also rides an upper band of the viewport (never centered) so it
// visually clears the .combat-controls row.

import { buildVictoryLines } from './victoryLines.js'

const THEMES = {
    win: { icon: 'fa-trophy', label: 'Victory!', titleClass: '', cardClass: '' },
    defeat: { icon: 'fa-skull', label: 'The Party Falls', titleClass: ' defeat', cardClass: ' victory-card-defeat' },
}

export default function VictoryBanner({ visible, result, onDismiss }) {
    if (!visible || !result) return null
    const theme = result.wipe ? THEMES.defeat : THEMES.win
    return (
        <div className='victory-banner' role='status'>
            <div className={`victory-card${theme.cardClass}`}>
                <button
                    type='button'
                    className='victory-close'
                    aria-label='Dismiss victory banner'
                    title='Dismiss'
                    onClick={onDismiss}
                >
                    <i className='fa-solid fa-xmark' aria-hidden='true'></i>
                </button>
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
