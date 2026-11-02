// TV presentation-mode toggle for the initiative header (Phase 1).
// Pure presentation control — the per-client preference lives in
// useTvPresentation.js; this only reflects/commands it.

export default function TvToggleButton({ tvMode, onToggle }) {
    return (
        <button
            type='button'
            className={`tv-toggle-button${tvMode ? ' tv-toggle-on' : ''}`}
            onClick={onToggle}
            aria-pressed={tvMode}
            title={tvMode
                ? 'Exit TV presentation mode'
                : 'TV presentation mode — big, glanceable layout for the table screen (browser goes fullscreen where allowed)'}
        >
            <i className='fa-solid fa-display'></i> TV
        </button>
    )
}
