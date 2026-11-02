// Victory-banner copy builder — pure lines from a `lastCombatResult` stamp.
// Lives beside VictoryBanner.jsx (kept component-only for fast refresh).

// Number agreement helper: 1 → "1 foe", anything else → "N foes".
const count = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`

export function buildVictoryLines(result) {
    const rounds = result.rounds ?? 1
    const lines = []
    if (result.wipe) lines.push(`The party fell after ${count(rounds, 'round')}.`)
    else lines.push(`The party survived ${count(rounds, 'round')}!`)
    if (result.foes > 0) {
        const defeated = result.defeated ?? 0
        const fled = Math.max(0, result.foes - defeated)
        lines.push(fled > 0
            ? `${count(defeated, 'foe')} defeated · ${fled} drove off`
            : `All ${count(result.foes, 'foe')} defeated`)
    }
    if (result.partySize > 0) {
        lines.push(`${result.survivors} of ${result.partySize} heroes standing`)
    }
    return lines
}
