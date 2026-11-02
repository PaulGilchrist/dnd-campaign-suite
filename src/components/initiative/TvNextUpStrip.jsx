// "Up next" strip for the initiative tracker (Phase 1). Renders the
// container-derived order (active creature excluded, wraparound, Thief's
// Reflexes second turns skipped). Presentational only.

export default function TvNextUpStrip({ creatures }) {
    if (!creatures || !creatures.length) return null
    return (
        <div className='tv-next-up' aria-label='Up next'>
            <span className='tv-next-up-label'>Up next</span>
            {creatures.map(c => (
                <span key={c.name} className={`tv-next-chip ${c.type}`}>
                    <i className={`fa-solid ${c.type === 'player' ? 'fa-user' : 'fa-dragon'}`}></i> {c.name}
                </span>
            ))}
        </div>
    )
}
