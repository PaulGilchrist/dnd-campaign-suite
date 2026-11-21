// Audit-ledger type list for the Session & Audit console (extracted from
// SessionSection.jsx, backlog 2026-11-20 ZZ). Plain .js module so the server
// allowlist pin test (server/routes/log.schema-gate.test.js) can assert every
// type listed here is a member of ALLOWED_LOG_TYPES (server/routes/log.js) —
// a ledger filter naming a type the gate 400s would silently never match a row.
export const AUDIT_TYPES = [
    'enforcement_denied', 'enforcement_triggered', 'enforcement_clock_expired',
    'enforcement_cover', 'ai_ruling', 'ai_director', 'ai_world', 'session_phase',
    // Server-validator write refusals ride their own type since the GC
    // improve 2026-11-10 split (they used to hide inside enforcement_denied).
    'write_rejected',
];
