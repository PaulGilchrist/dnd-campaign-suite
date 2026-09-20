# BUG MA-0593 — Demilich legendary_actions[2] "Necrosis" — zero-affordance dead row (FAIL(b)/DATA, MA-0580 twin)

**Verdict:** FAIL(b) / DATA — zero affordance. Exact MA-0580 Death Tyrant Chomp twin: prose weapon child with no `delegates_to` renders pure text; the authored child `uses:1` is dead (nothing consumes it). NOT the MA-0510 silent-burn variant: no header → no `legendaryGate` → no "Expend Legendary" chip exists at all → nothing clickable, nothing burns, console silent.

## Expected (§46 legendary economy fix shape)

Row disk shape (public/data/monsters.json Demilich legendary_actions[2]):

```json
{
  "name": "Necrosis",
  "description": "The demilich makes one Necrotic Burst attack.",
  "uses": 1
}
```

Per §46 (reusable legendary economy, MA-0021/0022/0070/0218) a prose weapon child must delegate:

```json
// rows[0] header, added SAME pass (else Expend chip silent-burns, MA-0510):
{ "name": "Legendary Action Uses", "description": "The demilich can take 3 legendary actions...", "uses": 3 }
// Necrosis child fix:
{ "name": "Necrosis", "description": "The demilich makes one Necrotic Burst attack.", "uses": 1, "delegates_to": "Necrotic Burst" }
```

With header `uses` present, `legendaryHeaderAction` (monsterLegendaryUses.js:153-157) arms the gated section; `LegendarySpendLink` (MonsterAction.jsx:161-172) renders "Expend Legendary"; `resolveLegendaryRow` (MonsterCardModal.jsx:464-474) resolves `delegates_to:"Necrotic Burst"` through the attack seam → live +11 / 7d6 Necrotic roll via the delegate row (actions[1], verified live +11 chip MA-0588/0589), with honest `ability_use` spend + latch.

## Actual (fresh evidence, 2026-09-19, test-campaign :5173)

**Render enumeration** (card open via initiative avatar `img[alt="Demilich 1"]`, Bandit qty1 joined, Bandit staged HP/maxHp 999 via full-store `/combatSummary {value}` POST §120, target armed on Demilich's own card `[data-testid="target-select"]` selectOption):

Necrosis row `.mc-action` innerHTML — byte-evidence, ZERO interactive elements:

```html
<strong>Necrosis.</strong> <span>The demilich makes one Necrotic Burst attack.</span>
```

- `span[role="button"] / a[href] / button / .mc-dice-link*` inside row: `[]`
- No "Expend Legendary" chip; overlay-wide `.mc-dice-link-legendary` count: `0`; no counter text anywhere (`usesText` scan for /uses|left/i: `[]` — child `uses:1` never renders; `formatActionUsage` reads `usage`, not `uses`)
- Sibling contrast (renderer proven alive on same card): Necrotic Burst → `mc-dice-link "+11"`; Energy Drain & Grave-Dust Flight → ungated `mc-dice-link-save-clickable "DC 19 Constitution"` (MA-0591/0592 unguarded fallback confirmed, MonsterCardBody.jsx:57 plain branch); Multiattack → text-only (correct)

**Click ledger (zero-delta control):** two fresh-rect mouse clicks at Necrosis row center (scrollIntoView first, 1.2 s spacing):
- Click 1: log delta 0, popup 0
- Click 2: log delta 0, popup 0
- Bandit 1 HP after both: 999 (999→999, zero damage)
- Card stayed open; `counter`: never rendered, so nothing decrements; change-data `Demilich 1` keys `[]`, `monsterLegendaryUses` absent → economy never engaged, zero burn

**Console:** 0 errors across the whole session (no MA-0510 `no resolvable mechanic` — that console.error lives inside `resolveLegendaryRowMechanic` (MonsterCardModal.jsx:436) which is unreachable without `legendaryGate`; dead-end here is upstream: no affordance mounts at all).

**Log tail (join-noise-only §146):** 4 entries — `encounter`, `roll Demilich 1`, `encounter`, `roll Bandit 1`. Zero `ability_use`, zero `roll attack`, zero `roll damage`, zero `hp_change`.

## Steps to reproduce

1. test-campaign, Encounters → search "Demilich" → check → Join Encounter; search "Bandit" exact → check → Join Encounter.
2. Stage Bandit HP 999 (full-store POST `/api/campaigns/test-campaign/combatSummary {value:fullCs}` §120).
3. Initiative → arm `Bandit 1` on Demilich's own card target-select → open Demilich card (avatar alt "Demilich 1" §128).
4. Legendary Actions section → Necrosis row: text-only, zero chips; click twice → nothing.

## Likely location

- **DATA:** `public/data/monsters.json` Demilich `legendary_actions` child shape — Necrosis lacks `delegates_to:"Necrotic Burst"` AND the array lacks a rows[0] numeric `uses` header (`legendaryHeaderAction` accepts header ONLY at rows[0] — monsterLegendaryUses.js:156; rows[0] here is Energy Drain, no uses → `legendaryHeader=null` → MonsterCardBody.jsx:54-57 plain fallback, no `legendaryGate` prop → MonsterAction.jsx:162 `if (!legendaryGate) return null`).
- **Resolution seam:** `monsterLegendaryUses.js` `legendaryDelegateAction` (:6-10) spans actions+legendary_actions by exact name and would find "Necrotic Burst" (actions[1], attack_bonus 11, 7d6) — the ONLY missing piece is the `delegates_to` field plus the header, fixed SAME pass (§46).
- Child-level `uses:1` is consumed nowhere app-wide: no counter, no per-row spend gate (per-row once-per-turn would need the cooldown clause prose `hasLegendaryCooldownClause` :134 or shared-header economy).

## Notes / siblings

- MA-0580 Death Tyrant Chomp: identical fingerprint (prose "two Bite attacks" child, zero chip) — sanctioned zero-affordance-inert twin; §46 requires delegates_to on the same pass as the header.
- MA-0588/0589: Necrotic Burst actions[1] +11 chip live — delegate target resolves cleanly once wired.
- MA-0591/0592: legendary rows[0]/[1] ungated DC 19 save chips (headerless fallback); fixing header same pass will also correctly gate those rows.
- MA-0510 silent-burn NOT applicable (requires armed header + gate); MA-0092/0217/0375/0405 header fingerprint applies (no numeric uses → no counter, economy consumers exist but unreached = DATA FAIL).
- §66: Multiattack text row correct as-is; §99/§110 header-swallow nuance: Necrosis is rows[2] with no numeric affordance, so it doesn't even render a shared-gate chip (unlike rows[1+] save rows).
