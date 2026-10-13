/**
 * Level 5 Phase 3 (L5-004, plan §9) — AI service entry point.
 *
 * The single funnel every AI task flows through: build prompt → call the
 * LOCAL provider (D3) → parse + schema-validate (fail → retry ONCE →
 * `needs_human` fallback) → audit-log the proposal. The AI PROPOSES; the
 * engine applies after referee confirmation (§9.5). This module never writes
 * game state — it returns a validated ruling + logs the proposal.
 *
 * Runs server-side so every client shares one model and no endpoint/key
 * leaks to the browser.
 */
import { chat, probe, isLocalEndpoint } from './providers/localProvider.js';
import { buildRefereeMessages, parseRulingAnswer } from './promptBuilder.js';
import { needsHumanRuling } from './schemas.js';

export const AI_MODES = new Set(['off', 'suggest', 'autopilot']);

export function aiConfigLive(aiConfig) {
    return !!(aiConfig && aiConfig.mode && aiConfig.mode !== 'off' && isLocalEndpoint(aiConfig.endpoint));
}

function chatOpts(cfg) {
    return {
        endpoint: cfg.endpoint,
        model: cfg.model,
        temperature: cfg.temperature,
        provider: cfg.provider,
        timeoutMs: cfg.timeoutMs,
    };
}

/**
 * Ask the AI referee to rule on a player's freeform action (§9.2).
 * Returns { ok, ruling, proposals? }:
 *  - ok:true  — validated ruling; mode 'suggest' ⇒ awaiting referee confirm,
 *               'autopilot' ⇒ the CALLER (referee-console automation in P3-c)
 *               routes it through the normal gated lanes. Nothing applied here.
 *  - ok:false — AI off / unreachable / twice-invalid; ruling is the
 *               needs_human fallback so the table never stalls on the model.
 */
export async function askReferee({ campaign, action, characterName, aiConfig, state, log }) {
    if (!aiConfigLive(aiConfig)) {
        return { ok: false, code: 'AI_OFF', ruling: null };
    }
    const messages = buildRefereeMessages({ action, characterName, state });

    let lastError = 'no attempt made';
    for (let attempt = 1; attempt <= 2; attempt++) { // one retry, then human (§9.1)
        let content;
        try {
            content = await chat({ ...chatOpts(aiConfig), messages });
        } catch (e) {
            lastError = `${e.code || 'ERROR'}: ${String(e.message || e).slice(0, 160)}`;
            continue;
        }
        const result = parseRulingAnswer(content);
        if (result.ok) {
            await auditLog(log, campaign, characterName, result.ruling, attempt);
            return { ok: true, ruling: result.ruling, mode: aiConfig.mode };
        }
        lastError = `invalid ruling: ${result.errors.join('; ')}`;
    }

    const fallback = needsHumanRuling(lastError);
    await auditLog(log, campaign, characterName, fallback, 0);
    return { ok: false, code: 'AI_NEEDS_HUMAN', ruling: fallback };
}

async function auditLog(log, campaign, characterName, ruling, attempts) {
    if (typeof log !== 'function') return;
    try {
        await log(campaign, {
            type: 'ai_ruling',
            name: 'AI referee',
            characterName: characterName || null,
            ruling,
            attempts,
            description: `AI referee proposed ${ruling.type}: ${String(ruling.text || ruling.expression || ruling.actionName || ruling.effect || '').slice(0, 160)}${ruling.explanation ? ` — ${ruling.explanation}` : ''}`.slice(0, 300),
        });
    } catch (e) {
        console.error('[aiService:audit-log]', e);
    }
}

export { probe, isLocalEndpoint };
