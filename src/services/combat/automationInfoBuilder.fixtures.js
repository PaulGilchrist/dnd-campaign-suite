// ── Shared fixtures for automationInfoBuilder tests ──────────────────

import { vi } from 'vitest'

// ── Helper to normalize ability names (same as abilityLookup.js) ─────
const ABILITY_MAP = {
    str: 'Strength', dex: 'Dexterity',
    con: 'Constitution', int: 'Intelligence',
    wis: 'Wisdom', cha: 'Charisma',
}

export function normalizeAbilityName(name) {
    if (!name) return null
    const lower = name.toLowerCase().replace(/\s+/g, '')
    if (ABILITY_MAP[lower]) return ABILITY_MAP[lower]
    for (const long of Object.values(ABILITY_MAP)) {
        if (long.toLowerCase() === lower) return long
    }
    return null
}

export function createMockAutomationExpressions() {
    return {
        evaluateAutoExpression: vi.fn((expr, _stats) => {
            if (!expr) return 0
            return 2
        }),
        resolveHealingPoolExpression: vi.fn((base, scaling, stats) => {
            if (!scaling) return base
            if (!stats) return base
            const entries = Object.entries(scaling)
                .map(([k, v]) => ({ level: parseInt(k, 10), expression: String(v) }))
                .filter(e => !isNaN(e.level))
                .sort((a, b) => a.level - b.level)
            let resolved = base
            for (const entry of entries) {
                if (stats.level >= entry.level) resolved = entry.expression
            }
            return resolved
        }),
        getSaveDc: vi.fn((stats, ability, proficiency) => {
            const canonical = normalizeAbilityName(ability)
            const bonus = stats.abilities?.find(a => a.name === canonical)?.bonus ?? 0
            return 8 + bonus + (proficiency || 0)
        }),
        resolveUses: vi.fn((stats, usesSpec) => {
            if (typeof usesSpec === 'number') return usesSpec
            if (usesSpec === 'proficiency_bonus') return stats.proficiency || 0
            return stats.level || 1
        }),
        resolveDiceExpression: vi.fn((expr) => expr),
        resolveScaling: vi.fn((stats, scaling) => {
            if (!scaling) return null
            let result = null
            for (const entry of scaling) {
                if (stats.level >= entry.level) result = entry
            }
            return result
        }),
    }
}

// ── Shared test data ─────────────────────────────────────────────────

export const BASE_STATS = {
    level: 5,
    proficiency: 3,
    abilities: [
        { name: 'Strength', bonus: 4 },
        { name: 'Dexterity', bonus: 2 },
        { name: 'Constitution', bonus: 3 },
        { name: 'Intelligence', bonus: 1 },
        { name: 'Wisdom', bonus: 5 },
        { name: 'Charisma', bonus: 2 },
    ],
}

export const BASE_FEATURE = { name: 'Test Feature' }

export function makeFeature(automation, name = 'Test Feature') {
    return { name, automation }
}
