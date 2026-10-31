/**
 * Level 5 Phase 3 (L5-005, plan §9.2) — AI client wrappers (thin transport).
 *
 * Talks to the server-side AI referee endpoints (server/routes/campaigns-ai.js).
 * The proposal comes back schema-validated; NOTHING is applied here — the
 * referee console confirms, then routes through applyRuling.js which walks
 * the SAME lanes a human click walks (Principle 3).
 */

export async function getAiStatus(campaignName) {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/ai/status`)
    if (!res.ok) throw new Error(`ai status returned ${res.status}`)
    return res.json()
}

/**
 * @returns {Promise<{ok:boolean, ruling?:object, code?:string, mode?:string}>}
 */
export async function askAiReferee({ campaignName, action, characterName }) {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/ai/referee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, characterName }),
    })
    const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
    if (!res.ok) return { ok: false, code: res.status === 403 ? 'AI_OFF' : 'AI_ERROR', error: data.error }
    return data
}

/** §9.3 — ask the AI director to decide an NPC's turn (proposal only). */
export async function askNpcDirector({ campaignName, creatureName }) {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/ai/director`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatureName }),
    })
    const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
    if (!res.ok && !data.code) return { ok: false, code: res.status === 403 ? 'AI_OFF' : 'AI_ERROR', error: data.error }
    return data
}

/** §9.4 — ask the AI world keeper for campaign-consistent content (proposal only). */
export async function askWorldKeeper({ campaignName, kind, focus = null }) {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/ai/world`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, focus }),
    })
    const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
    if (!res.ok && !data.code) return { ok: false, code: res.status === 403 ? 'AI_OFF' : 'AI_ERROR', error: data.error }
    return data
}

/** Server dice oracle (§7.4) — the honest roller when enforcement.serverDice is on. */export async function serverRoll({ campaignName, expression, mode = 'normal', reason = '' }) {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/roll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression, mode, reason }),
    })
    if (!res.ok) throw new Error(`server dice refused (${res.status})`)
    return res.json()
}

/**
 * Admin model discovery — asks the LOCAL endpoint (via the server, which
 * attaches the server-local bearer key) for its model list. Returns
 * { ok, models?, error? } so the config row can surface failures honestly.
 */
export async function fetchAiModels({ endpoint, provider }) {
    const res = await fetch('/api/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, provider }),
    })
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
    return { ok: true, models: data.models || [] }
}

// --- AI Campaign Authoring designer (plan Phase 4) -------------------------
// Thin transport to server/routes/ai-designer.js. Generation lands DRAFTS
// only — the Campaign Builder review flow is what makes content live.

export async function loadDesignerConversation({ campaignName }) {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/ai/designer/conversation`)
    if (!res.ok) throw new Error(`designer conversation returned ${res.status}`)
    return res.json()
}

export async function designerChat({ campaignName, message }) {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/ai/designer/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
    })
    const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
    if (!res.ok && !data.code) return { ok: false, code: res.status === 403 ? 'AI_OFF' : 'AI_ERROR', error: data.error }
    return data
}

export async function designerPlan({ campaignName }) {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/ai/designer/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    })
    const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
    if (!res.ok && !data.code) return { ok: false, code: res.status === 403 ? 'AI_OFF' : 'AI_ERROR', error: data.error }
    return data
}

export async function designerGenerate({ campaignName, scope }) {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/ai/designer/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
    })
    const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
    if (!res.ok && !data.code) return { ok: false, code: res.status === 403 ? 'AI_OFF' : 'AI_ERROR', error: data.error }
    return data
}

/**
 * Phase 6 per-entity refine: PROPOSAL ONLY — the caller feeds the returned
 * replacement into the editor form; the GM's normal save (with their echoed
 * stamp) is what persists, so concurrent-tab 409s keep protecting edits.
 * @returns {Promise<{ok:true, replacement}|{ok:false, errors?|code?}>}
 */
export async function refineEntity({ campaignName, kind, entity, instruction }) {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/ai/refine/${encodeURIComponent(kind)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, instruction }),
    })
    const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
    if (!res.ok && !data.code) return { ok: false, code: res.status === 403 ? 'AI_OFF' : 'AI_ERROR', error: data.error }
    return data
}

/**
 * AI Dress (campaign-authoring residual item 2): PROPOSAL ONLY — the server
 * validates every in-place op against the live map document and returns the
 * op list + human-readable preview + pre-validated merged document. Nothing
 * is saved here; the caller PUTs `updated` through the normal map lane only
 * after the GM applies the preview.
 * @returns {Promise<{ok:true, map, ops, preview, updated}|{ok:false, errors?|code?}>}
 */
export async function dressMapProposal({ campaignName, mapName, instruction }) {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/ai/dress/${encodeURIComponent(mapName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
    })
    const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
    if (!res.ok && !data.code) return { ok: false, code: res.status === 403 ? 'AI_OFF' : 'AI_ERROR', error: data.error }
    return data
}
