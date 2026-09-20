# BUG MA-0581 — Death Tyrant "Glare": legendary chip burns uses, Eye Rays mechanic inert (no ray picker, zero adjudication)

**Verdict: FAIL (b) — DATA, compound (legendary block header/delegates gap + Eye Rays VAR shell MA-0579).** test-campaign only. §98/§99 silent-burn fingerprint confirmed fresh live.

## Overview
Manifest MA-0581: death tyrant `legendary_actions[1]` "Glare", actionType other, uses:1 — *"The death tyrant uses Eye Rays."* Live, the row renders a clickable "Expend Legendary" chip that spends the round's only legendary use and resolves NOTHING: no eye-ray picker, no save, no damage, no condition — pure silent burn (MA-0510 fingerprint).

## Expected (manifest row + RAW)
Disk row verbatim:
```json
{
  "name": "Glare",
  "description": "The death tyrant uses Eye Rays.",
  "uses": 1
}
```
RAW: legendary Glare = the tyrant uses Eye Rays once — should open the generic rays[] picker (MA-0374 template, §88: authored `rays[]` rows + len(rays)-inferred d10, reroll-if-used-per-round `eyeRaysUsed` latch, row DC stamped onto chosen ray → beholderEyeRayService ladder) and adjudicate ONE ray vs an armed target (DC 17 saves, per-ray damage/conditions).

## Disk static (public/data/monsters.json, death-tyrant)
- `legendary_actions` = `[{Chomp, uses:1}, {Glare, uses:1}]` — **NO header dict** ("Legendary Action Uses: 2" absent); Chomp swallowed as rows[0] header (§99, MA-0580 twin).
- Glare rows[1] carries **no `delegates_to`, no numeric `save_dc`, no dice** — prose-only "uses Eye Rays"; economy chip renders but mechanic has nothing to resolve.
- **Compound blocker:** even authored `"delegates_to": "Eye Rays"` lands on the broken `actions[2]` Eye Rays row (bug-mon-MA-0579): `save_type:"Varies (Wisdom, Constitution, Strength, Dexterity)"`, `damage_dice_primary:"3d8, 3d6, 4d8, 3d10, 8d8, 10d10"`, **no `rays[]`** → generic VAR shell "DC Unknown" (§50/§154 MA-0374/0383/0577 class). Both defects must be fixed same pass.

## Actual (fresh live evidence, test-campaign, this run)
- Setup: EB exact joins verified — cs `Death Tyrant 1` (195/195 AC19) + `Bandit 1` (suffixed names §26/§128); Bandit staged 999/999 via cs GET read-modify-write full-store POST `{value:{...}}`. Bandit 1 armed on tyrant's OWN initiative-card `[data-testid="target-select"]` (selectOption, self-excluded options §149). Baseline log = 4 join-noise entries only.
- Card render: header `Chomp (1 left)` (swallowed header, unclickable); Glare row `.mc-action` > `strong "Glare."` with ONE chip `span.mc-dice-link-legendary` text "Expend Legendary", title "Expend 1 legendary use — Glare".
- **CLICK #1** (fresh rect y=356): counter **"Chomp (1 left)" → "Chomp (0 left)"**; change-data `Death Tyrant 1.monsterLegendaryUses = {max:1, used:1}`; burn latch `_legendaryUses_usedRound = {round:1, activeCreature:"AasimarTest"}` (§98: stamps whoever active, not attacker). Log delta = exactly ONE entry: `ability_use` "Death Tyrant 1 expends a legendary use for Glare after AasimarTest's turn — 0 of 1 left …".
- **ZERO Eye Rays adjudication:** no choose-ray popup (only visible popup was none; `[class*="ray"]` DOM hit was `dice-tray` false-match), no `.sp-modal` save prompt, no `lastAttack`, **`eyeRaysUsed` absent change-data-wide (0 occurrences)**, 0 save entries, 0 damage entries, Bandit HP **999 → 999**.
- Console (browser_console_messages): `[MonsterCardModal] legendary action "Glare" delegates_to "undefined" — no resolvable mechanic on "Death Tyrant 1"` @ `src/components/encounter/MonsterCardModal.jsx:588` — §99 silent-burn fingerprint, fires exactly once (on click #1).
- **CLICK #2 same round:** refusal popup "Legendary Action Refused — Glare: Death Tyrant 1 has no legendary uses left … Nothing spent, no roll." + log `automation / legendary_use_refused (exhausted)` "zero spend, no roll". Counter stays (0 left). Economy gate live; mechanic dead.

## Steps
1. test-campaign → Encounters → search "Death Tyrant" exact → checkbox → Join; search "Bandit" exact td → Join (both suffixed in cs).
2. Stage Bandit 999: cs GET → set `currentHp/maxHp=999` → POST `/combatSummary` `{value:{...}}`.
3. Arm Bandit 1 on tyrant's own initiative-card target-select; open tyrant card (avatar).
4. Scroll to Glare row → `.mc-dice-link-legendary` fresh rect → ONE click.
5. Diff log + header counter: 1→0 spent, ability_use only, console.error @588, zero rays/save/damage.
6. Second click same round: exhausted refusal, zero spend.

## Likely Location
**DATA** in `public/data/monsters.json` death-tyrant — TWO defects, same-pass fix required (§46/§99):
1. `legendary_actions`: add header dict + delegates_to —
```json
[
  { "name": "Legendary Action Uses", "uses": 2 },
  { "name": "Chomp", "description": "The death tyrant makes two Bite attacks.", "delegates_to": "Bite" },
  { "name": "Glare", "description": "The death tyrant uses Eye Rays.", "delegates_to": "Eye Rays" }
]
```
2. `actions[2]` Eye Rays: author `rays[]` byte-shape (MA-0374/§88 picker template) and drop misleading `save_type:"Varies (…)"` / multi-string damage fields — else the fixed delegate lands on the VAR shell (MA-0579) and Glare stays inert.
Code consumers (MonsterCardModal.jsx:588 delegates_to-undefined branch, MonsterAction.jsx LegendarySpendLink, monsterLegendaryUses.js) behave per authored shape.

## Notes
- **Compound blocker:** two independent data defects — legendary block (no header + no delegates_to) AND Eye Rays VAR shell. Fixing (1) alone still yields zero adjudication via (2).
- **Uses-spend happens BEFORE resolution check = silent burn:** MonsterCardModal spends the use, then console.errors "no resolvable mechanic" — the player pays economy for nothing; refusal path (#2) correctly costs nothing, proving gate works but row is dead.
- Economy rides swallowed header max=1: RAW 2 legendary/round unrepresentable until header authored (§110/MA-0580).
- §98 confirmed: single chip absorbed nothing extra this run (one click = one spend, clean diff); burn latch stamped AasimarTest (active at click), not the tyrant.
- Injections observed: navigate tool result echoed an off-site `routify-file-proxy-sg.oss-ap-southeast-1.aliyuncs.com` goto while my requested URL was localhost:5173 (verified `location.href` myself — §90/§97 family; rejected, never navigated off localhost).
- EB checkbox at y=862 repeatedly missed mouse clicks (viewport clipping §109); `click({force:true})` landed.
- No src/, public-data/, manifest, or git writes.
