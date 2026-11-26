// @maintained-by-ai 2026-11-22: 2026-11-22
/**
 * Deferred plan A — DenialExplainer: classification lane only (the card
 * family itself is GMCopilot's own suite). Mocks the shared SSE client to
 * capture the handler, mocks the GMCopilot card to assert WHICH tip id the
 * latest denial rule maps to, and pins the GM-only gate + the ignored
 * event shapes (non-log keys, other types, rules with no explainer).
 */
import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const sse = vi.hoisted(() => ({ handlers: [] }));
vi.mock('../../services/ui/sseClient.js', () => ({
    subscribeToSSE: (_campaign, handler) => {
        sse.handlers.push(handler);
        return () => { sse.handlers = sse.handlers.filter(h => h !== handler); };
    },
}));

const host = vi.hoisted(() => ({ localhost: true }));
vi.mock('../../services/ui/isLocalhostBrowser.js', () => ({
    isLocalhostBrowser: () => host.localhost,
}));

vi.mock('./GMCopilot.jsx', () => ({
    default: ({ tipId }) => <div data-testid="copilot">{tipId}</div>,
}));

import DenialExplainer from './DenialExplainer.jsx';

const CAMPAIGN = 'test-campaign';

const emit = (event) => act(() => {
    sse.handlers.forEach(h => h(event));
});

const denial = (rule) => ({ key: `log-${CAMPAIGN}`, data: { type: 'enforcement_denied', rule, reason: 'x' } });

beforeEach(() => {
    sse.handlers.length = 0;
    host.localhost = true;
});

afterEach(cleanup);

describe('DenialExplainer (plan A)', () => {
    it('subscribes on GM screens and surfaces the mapped tip id for a denial class', () => {
        render(<DenialExplainer campaignName={CAMPAIGN} />);
        expect(screen.queryByTestId('copilot')).not.toBeInTheDocument();

        emit(denial('turnLock'));
        expect(screen.getByTestId('copilot')).toHaveTextContent('denial-turnlock');
        emit(denial('actionEconomy'));
        expect(screen.getByTestId('copilot')).toHaveTextContent('denial-economy');
        emit(denial('movementBudget'));
        expect(screen.getByTestId('copilot')).toHaveTextContent('denial-movement');
        emit(denial('lineOfSight'));
        expect(screen.getByTestId('copilot')).toHaveTextContent('denial-los');
    });

    it('never subscribes on player tabs (GM-only chrome)', () => {
        host.localhost = false;
        render(<DenialExplainer campaignName={CAMPAIGN} />);
        expect(sse.handlers).toHaveLength(0);
        expect(screen.queryByTestId('copilot')).not.toBeInTheDocument();
    });

    it('never subscribes on the TV layer (presentation only)', () => {
        render(<DenialExplainer campaignName={CAMPAIGN} tvMode />);
        expect(sse.handlers).toHaveLength(0);
    });

    it('ignores non-log events, other entry types, null rows, and unexplained rules', () => {
        render(<DenialExplainer campaignName={CAMPAIGN} />);
        emit({ key: 'change-campaign-targetEffects', data: { type: 'enforcement_denied', rule: 'turnLock' } });
        emit({ key: `log-${CAMPAIGN}`, data: { type: 'roll', rule: 'turnLock' } });
        emit({ key: `log-${CAMPAIGN}`, data: null });
        emit(denial('away'));
        emit(denial('condition'));
        emit(denial('opportunityAttack'));
        emit(denial(undefined));
        expect(screen.queryByTestId('copilot')).not.toBeInTheDocument();
    });

    it('unsubscribes on unmount (one shared SSE lane — never leak handlers)', () => {
        const { unmount } = render(<DenialExplainer campaignName={CAMPAIGN} />);
        expect(sse.handlers).toHaveLength(1);
        unmount();
        expect(sse.handlers).toHaveLength(0);
    });
});
