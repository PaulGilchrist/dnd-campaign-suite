
function HpBar({ current, max }) {
    const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
    const color = pct > 50 ? '#2ecc71' : pct > 25 ? '#f1c40f' : '#e74c3c'
    return (
        <div className="hp-bar-container">
            <div className="hp-bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
    )
}

export default HpBar
