export const campaignName = 'test-campaign';
export const playerName = 'RangerGirl';

export function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 5,
        ...overrides,
    };
}

export function makeAction(overrides = {}) {
    return {
        name: 'Dread Ambush',
        automation: {
            type: 'dread_ambush',
            damageExpression: '2d6',
            damageType: 'Psychic',
            uses_expression: '1',
            ...overrides.automation,
        },
        ...overrides,
    };
}

export function makeHitAttack(overrides = {}) {
    return {
        attackEvent: {
            attackerName: playerName,
            damageApplied: true,
            ...overrides.attackEvent,
        },
        targetName: 'Goblin',
        ...overrides,
    };
}

export function defaultCombatRound() {
    return 1;
}

export function defaultBeforeEach(imports) {
    const {
        getRuntimeValue,
        rollExpression,
        getCurrentCombatRound,
        evaluateAutoExpression,
        findLastAttack,
        loadCombatSummary,
    } = imports;

    vi.clearAllMocks();
    rollExpression.mockReturnValue({ total: 7, rolls: [4, 3] });
    getCurrentCombatRound.mockReturnValue(defaultCombatRound());
    evaluateAutoExpression.mockReturnValue(2);
    findLastAttack.mockResolvedValue(makeHitAttack());
    loadCombatSummary.mockResolvedValue({});
    getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
        if (key === 'dreadAmbushUses') return 2;
        if (key === 'dreadAmbushUsedThisTurn') return undefined;
        if (key === 'characters') return [];
        return undefined;
    });
}
