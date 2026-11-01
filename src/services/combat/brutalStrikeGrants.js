// CLA-044 / dup-extraction: shared, PURE Brutal Strike grant logic for both the
// legacy sheet-attack lane (automation/contextBuilder-sync.js) and the combat
// pipeline step (combat/steps/attackRollBonuses.js). No store reads/writes, no
// logging, no randomness — callers wire up setRuntimeValue/addExpiration/addEntry.

// WM-008 family byte-shape: feet parsed from option.value token
// ("15_ft_until_start_of_next_turn") or effect key ("push_15ft") — registered
// te consumers compute te.value||10, so value MUST be numeric (MA-0995/MA-1147).
function brutalStrikeFeet(option, fallback) {
    const fromValue = Number(String(option.value ?? '').match(/(\d+)/)?.[1]);
    if (Number.isFinite(fromValue)) return fromValue;
    const fromEffect = Number(String(option.effect ?? '').match(/(\d+)/)?.[1]);
    if (Number.isFinite(fromEffect)) return fromEffect;
    return fallback;
}

// CLA-044: resolve a Brutal Strike option to a registered te grant.
// Data-driven over ALL rider option keys (lv9 push_15ft/speed_reduction,
// lv13/17 adds disadvantage_on_next_save/next_attack_bonus).
export function brutalStrikeTeForOption(option, playerName, targetName) {
    if (option.effect === 'disadvantage_on_next_save' || option.effect === 'next_attack_bonus') {
        return {
            te: {
                target: targetName,
                source: playerName,
                option: option.name,
                effect: option.effect,
                value: option.effect === 'next_attack_bonus' ? (option.value || 5) : (option.value || null),
                noOpportunityAttacks: option.noOpportunityAttacks || false,
                duration: 'until_start_of_next_turn',
            },
            replace: false,
            clock: false,
        };
    }
    if (option.effect === 'speed_reduction') {
        return {
            te: {
                target: targetName,
                source: playerName,
                option: option.name,
                effect: 'speed_reduction',
                value: brutalStrikeFeet(option, 15),
                duration: 'until_start_of_next_turn',
            },
            // Hamstring: "only one at a time — the most recent one"
            replace: true,
            clock: true,
        };
    }
    if (String(option.effect || '').startsWith('push')) {
        // MA-0079/MA-0138 push marker te: instant, NO clock (badge residual).
        return {
            te: {
                target: targetName,
                source: playerName,
                option: option.name,
                effect: 'push',
                value: brutalStrikeFeet(option, 15),
                duration: 'instant',
            },
            replace: true,
            clock: false,
        };
    }
    console.error(`[brutalStrike] Unregistered Brutal Strike option effect "${option.effect}" — no grant`);
    return null;
}

// Build the campaign-log entry payload for a granted te. fix#167 single-source:
// the logged distance comes from te.value (never a hardcoded "15 feet"), so any
// data-driven variant reports honestly. Caller posts it via addEntry.
export function buildBrutalStrikeGrantEntry(option, te, playerName, targetName) {
    const description = te.effect === 'speed_reduction'
        ? `${option.name}: ${targetName} speed reduced ${te.value} ft until start of ${playerName}'s next turn`
        : te.effect === 'push'
            ? `${option.name}: ${targetName} pushed ${te.value} ft straight away (token position GM-enforced)`
            : `${option.name} applied to ${targetName}`;
    return {
        type: 'ability_use',
        characterName: playerName,
        abilityName: option.name,
        description,
        targetName,
    };
}
