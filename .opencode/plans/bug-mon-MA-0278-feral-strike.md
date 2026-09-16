# Bug MA-0278 — Animal Lord "Feral Strike" (legendary_actions[1]) — FAIL

**Monster:** Animal Lord (animal-lord), legendary_actions[1], actionType other
**Campaign:** test-campaign (header verified) · Animal Lord 1 LIVE cs idx0, init 20, activeCreature

## Evidence (2026-09-16)
- **Static (curl/python read of public/data/monsters.json:4897):** row is bare `{name:"Feral Strike", description:"...moves up to its Speed without provoking Opportunity Attacks, and it makes one Rend attack."}` — no `delegates_to`, no numeric mechanic. Header row[0] carries "3" only in name-text, no `uses` field (MA-0277 fingerprint).
- **Affordance enumeration (Playwright, row outerHTML):** `<div class="mc-action"><strong>Feral Strike.</strong> <span>…prose…</span></div>` — 0 `.mc-dice-link`, 0 buttons/[role=button], 0 legendary-spend chip. Zero-affordance inert DIV (MA-0269/0270/0271 family on same card).
- **2 clicks (prose span + strong title):** log count 500 → 500 zero delta; zero log entries matching /eral/; AL currentHp 323→323; no `monsterLegendaryUses`/legendary key on "Animal Lord 1" store.
- **Control (Rend chip live):** `.mc-action:has(strong ^Rend) .mc-dice-link` ("+13") one click → new log entry `roll | Animal Lord 1 | attack | total:20 hit:True Slashing`. Engine live; defect is row-side.
- **Delegation key-only:** monsterLegendaryUses.js:9 `r.name === action.delegates_to` — no name-proximity matching; grep "Feral" zero hits in src/services (combat/rules) and server/routes → no producer anywhere.

## Root cause
DATA. Bare {name, description} row renders inert-prose branch; "makes one Rend attack" is unresolvable without explicit delegation key (MA-0269 citation).

## Fix
- `"delegates_to": "Rend"` on legendary_actions[1] (resolves via key lookup to live Rend chip, MA-0022/MA-0136 pattern).
- Header `uses: 3` on legendary_actions[0] to wire legendaryHeaderAction/counter/spend gate (MA-0217/0227/0277 family).
- **Residual:** move-up-to-Speed / no-Oportunity-Attack clause remains unmodellable — §7 position/OA consumer is PC-side only, no monster movement or OA-immunity producer exists app-wide; needs engine work beyond this row's fix.

## Verdict
FAIL (inert-prose, zero-affordance, zero-delta; control live)
