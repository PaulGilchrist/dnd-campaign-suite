# BUG MA-1120 — Mage "Protective Magic" reaction: zero-affordance inert row (FAIL(b)/DATA)

## Overview
Row MA-1120 (`mage|reactions|0`) is the SRD Mage's choose-one Counterspell/Shield
reaction. On disk it authors **only `name` + `trigger` + `description`** — no
`automation`, no `usage`, no `uses`/`maxUses` (monsters.json:39344-39350, verbatim keys
`["name","trigger","description"]`). Per the codified §60/§114 fingerprint, reaction rows
arm affordance ONLY via `automation:{type,trigger,effect}` — `GatedReactionSlot`
(MonsterAction.jsx:164-169) returns null unless `getGatedMonsterReaction(action)`
(MonsterCardHelpers.js:1556-1558) finds `action.automation.effect` in
`GATED_MONSTER_REACTIONS` (:956). Live probe on test-campaign: the row renders as plain
`<div class="mc-action"><strong>Protective Magic.</strong> <span>…</span></div>` with
**zero interactive elements**; two fresh-rect real-pointer clicks produced **zero popups,
zero log delta, zero mechanical change-data**. Even with a PC spell-origin
`lastAttack` pending against the mage (sanctioned external seed §109 + reload), the row
arms nothing — pending state never arms an un-authored row (§60 re-confirmed live).

This is NOT a §70 never-built advisory: the Counterspell monster-reaction machinery is
**live, registered, and test-pinned** (MA-0013 family) and **four monsters already author
this exact effect** — including `archmage`, whose disk row is the *identically named*
"Protective Magic" with the complete byte-shape fix template (monsters.json:6574-6584).
The mage row is DATA drift of an in-file byte-twin. **FAIL(b)/DATA, one-block fix.**

## Expected (RAW, quoted from disk)
- trigger: *"The mage is targeted by a spell"*
- description: *"The mage casts **Counterspell** or **Shield** in response to the spell's
  trigger, using the same spellcasting ability as Spellcasting."*

Expected behaviour: a gated reaction chip on the mage's card that engages a pending
spell-origin cast (per MA-0013: campaign RAW `lastAttack` with spell-origin fields
`rollType:"spell-attack"|"spell-save"` / `attackType:"spell"` / `isSpellDamage` /
`damageSchool` / `saveType+saveDc`, attacker `type:'player'`), spends the reaction,
rolls the counter check (spell level <3 auto; ≥3 d20+INT mod vs DC 10+level — mage INT
mod +3), stamps `counterspellResolved` on the triggering lastAttack, and logs
`ability_use`/`counterspell_refused` refusals (round latch + uses economy).

## Actual (live ledger, test-campaign, dev:locked)
- Board ADMIN-CLEARED pre-stage (log `[]`, cs `value:null`); EB exact-td "Mage" join →
  cs `Mage 1` idx 0, `monsterIndex:"mage"` (§244 verified); PC party auto-joined
  `type:'player'` 1/1 placeholders (§439); full-store cs POST all-four HP keys 999,
  reload + campaign re-select (header==test-campaign).
- Row enumeration (`.mc-action` strong startsWith "Protective Magic"): **1 row,
  interactiveCount 0, `.mc-dice-link` 0, `.mc-dice-link-spell` 0**; whole-card
  `[role=switch]/[role=radiogroup]/[role=tablist]` audit **0/0/0** (§150 proof-of-no-toggle).
  `<strong>Counterspell</strong>`/`<strong>Shield</strong>` in the description render as
  plain bold spans — §161 fake-chip does not extend to "other"-type rows (§203/§254 twin).
- Control clicks ×2 at fresh boundingClientRect (real mouse, row text): log 2→2→2
  (join-noise only: encounter + Initiative roll), change-data gained **zero** keys beyond
  the `combat-ui-viewingMonster(+CreatureName)` viewing cosmetics stamped at card open
  (§440/MA-1113 discriminator), popups 0, card state unchanged.
- **Pending-window attempt (§109)**: POST `/api/campaigns/test-campaign/lastAttack`
  `{lastAttack:{attackerName:"DivinationWizard"(player), targetName:"Mage 1",
  rollType:"spell-attack", attackType:"spell", damageSchool:"Evocation", spellLevel:1,
  attackName:"Magic Missile", hit:true}}` → stored 200, survives reload+re-select,
  ingested by client via `seedCampaignRuntimeData` (App.jsx:164/:335). Reopened mage
  card with window pending: row byte-identical, **interactiveCount 0** (card-level
  `.mc-dice-link` count 22 = other rows' chips; reaction section chips **0**). Trigger
  state reachable; row simply never engages.
- Initiative walk ×14 turn-starts incl. **`2:Mage 1` own turn-start**
  (`__initiative__.lastAppliedTurnStartCreature` truth, cs mirror frozen §31): mage
  change-data store gained only generic `pendingExpirations` scaffold; **zero** reaction/
  counterspell/shield latch keys on mage cs entry or cd top-level; log count held 2
  (no passive machinery, no latch, no auto-fire).
- Console errors: **0** entire session (silent inert, §60-class; twin of MA-1117 on this
  same monster and MA-0869/MA-0891 prose-reaction fingerprints).

## Steps (repro, test-campaign)
1. `npm run dev:locked` rig up; select `test-campaign` (header verify).
2. Encounters → search "Mage" → exact td "Mage" (filter yields Archmage/Drow Mage/Mage/
   Mage Apprentice — hasText collides §124) → native `cb.click()` (checked=true verified)
   → Join Encounter → poll cs: `Mage 1` `monsterIndex:"mage"`.
3. Full-store cs POST all four HP keys 999 (`{combatSummary:cs}` route — NEVER
   `/change-data` §441); reload + campaign re-select.
4. Initiative → avatar "Mage 1" → card → Reactions section → enumerate the row: 0 chips.
5. Real-pointer click the row text ×2 (fresh rect) → zero popup/log/cd mechanical delta.
6. POST seed spell-origin `lastAttack` at Mage 1 with PC attacker (§109) → reload →
   re-select → reopen card → still 0 affordance while pending.
7. Walk initiative to `2:Mage 1` → no passive latch/state on the mage.

## Static evidence (grep census, file:line)
- **mage reactions[0] verbatim keys**: `["name","trigger","description"]` — no automation
  (monsters.json:39344-39350). Spellcasting row present (INT mod +3 ⇒ counter check
  +3 vs DC 10+level would be the RAW check once armed).
- **Reaction automation census in monsters.json: 25 rows, effects:**
  feather_fall ×4 (aarakocra-aeromancer, githzerai-monk, githzerai-psion, githzerai-zerth),
  **counterspell ×4 (aberrant-cultist :363, arcanaloth :6250, arch-hag :6388, archmage :6582)**,
  hellish_rebuke ×2 (azer-pyromancer, fiend-cultist), parry ×8 (bandit-captain,
  death-knight, death-knight-aspirant, drow-elite-warrior, erinyes, gladiator,
  hobgoblin-warlord, knight), split ×1 (black-pudding), heal ×1 (celestial-spirit-defender),
  attack ×1 (construct-spirit-clay), portent ×1 (cyclops-oracle), limited_foresight ×1
  (cyclops-sentry), elemental_absorption ×1 (elemental-cultist), jinx_negate ×1
  (goblin-hexer). Mage row absent from the census.
- **GATED_MONSTER_REACTIONS members (12)** — MonsterCardHelpers.js:957-1096:
  `feather_fall, counterspell(:963), hellish_rebuke, parry, jinx_negate, split, heal,
  attack, portent, limited_foresight, elemental_absorption, redirect_attack`.
  `"shield"` is **grep-zero in the registry** — Shield half of the choose-one is
  unexpressible today (design caveat, Notes).
- **Counterspell consumers**: `getGatedMonsterReaction` :1556 → `resolveMonsterGatedReaction`
  :1622, counterspell branch :1627 → `resolveMonsterCounterspell` :1977 (gate
  `counterspellTriggerSatisfied`/`counterspellGate` :1121-1141 — RAW lastAttack via
  `readGatedReactionContext` :1615-1621 "read RAW not normalized wrapper" MA-0013 fix;
  `isSpellOriginLastAttack` :1107; attacker `type==='player'` :1986; check
  `resolveCounterspellCheck` :1145; refusals `<slug>`→`counterspell_refused` :1996;
  spend `MONSTER_REACTION_USES_KEY` :2006; stamp `counterspellResolved:true` :2013).
  Modal press seam: MonsterCardModal.jsx:2139. Test-pinned twins:
  `MonsterCardHelpers.ma0300-arcanaloth-counterspell.test.js`,
  `MonsterCardHelpers.ma0305-arch-hag-counterspell.test.js`,
  `MonsterCardHelpers.ma0314-archmage-counterspell.test.js`,
  `MonsterAction.ma0300-arcanaloth-chip.test.jsx`,
  `MonsterAction.ma0305-arch-hag-chip.test.jsx`.
- **Archmage byte-twin template (monsters.json:6572-6585)**: same row name "Protective
  Magic (3/Day)" — `"usage":"3/Day","uses":3,"maxUses":3,"automation":{"type":"reaction",
  "trigger":"enemy_spell_cast","effect":"counterspell"}` (trigger is a **snake key on the
  automation block**; the mage's human-readable prose `trigger` string is display-only —
  no parser reads it §440-class). Arcanaloth At-Will sentinel twin :6240-6252 = the
  RAW-unlimited shape §60 prescribes.
- **Sibling gap noted (do not fix here)**: `lich` "Protective Magic" :38281 has the same
  un-authored fingerprint (`["name","trigger","description"]`) — separate ticket.

## Likely Location
**Layer: monsters.json DATA drift** — `mage.reactions[0]` (line 39344) lacks the
`automation` block + RAW-unlimited usage sentinel. One-block fix, archmage/arcanaloth
byte-shape:

```json
{
  "name": "Protective Magic",
  "trigger": "The mage is targeted by a spell",
  "description": "The mage casts <strong>Counterspell</strong> or <strong>Shield</strong> …",
  "usage": "At Will",
  "uses": 999,
  "maxUses": 999,
  "automation": { "type": "reaction", "trigger": "enemy_spell_cast", "effect": "counterspell" }
}
```

Mage RAW lists no uses/day ⇒ §60 honest sentinel `usage:"At Will"`+`uses/maxUses:999`
(arcanaloth/arch-hag twin), 1/round latch `_counterspell_usedRound` + per-cast
`counterspellResolved` identity stamp do the RAW limiting (1 reaction/turn is RAW).
`GatedReactionSlot` then arms the `fa-shield` "Counterspell" chip; gate consumes the
seeded/PC spell-origin pending window; INT +3 rides `spellAbilityMod` ("same spellcasting
ability as Spellcasting" — RAW-honoured by the MA-0013 resolver).

## Notes
- **Choose-one caveat (design)**: RAW "Counterspell **or** Shield" — `Shield` has ZERO
  gated-reaction effect in `GATED_MONSTER_REACTIONS` (grep-zero) and no +AC-vs-pending-
  attack reaction channel exists (parry `acBonus` is the nearest but is melee-hit-triggered,
  MA-0341/§114). Even post-fix the row resolves only its Counterspell half; the Shield
  half stays GM-adjudicated advisory. A choose-one chooser would need the MA-0275/§80
  variant machinery or a second effect key (`shield`) + registry member + consumer —
  recommend Counterspell-only authoring + advisory note in the row description, matching
  how archmage was fixed (which shipped Counterspell-only for the identical prose).
- **MA-0013 twins**: aberrant-cultist (fixed MA-0013, 2/Day), arcanaloth (MA-0300),
  arch-hag "Tongue Twister" (MA-0305), archmage (MA-0314) — all four authored, all
  test-pinned. Mage is the fifth "Protective Magic"-class caster left unarmed; lich sixth.
- **§109 pending-route result**: external `lastAttack` POST reaches server immediately,
  client runtime only after reload (`seedCampaignRuntimeData` App.jsx:164 once/load);
  verified live this session — pending stamp survived reload+re-select and the row still
  armed nothing, proving the defect is disk-row absence, not trigger unreachability.
  A real PC cast (DivinationWizard in party, `type:'player'`) is the cheaper natural
  producer post-fix.
- MA-0882 (`monster_grant_reaction`) and MA-0891 (`monster_redirect_attack`) precedents
  show new reaction types are sanctioned when expressible — but here **zero new code is
  needed**: `counterspell` effect already registered, consumed, and test-pinned. That is
  what converts this from a code-gap ticket into a one-block DATA fix.
- Same monster family: MA-1117 (Multiattack, PASS-subset), MA-1119 (Spellcasting,
  PASS-subset) — both clean on this board; MA-1120 is the mage's sole inert row.
- Trichotomy: row arms ZERO affordance (live ×2 sessions incl. pending-window probe and
  own-turn-start walk), trigger state IS reachable via documented routes, machinery IS
  expressible and in-file byte-twinned ⇒ **FAIL(b)/DATA**, not PASS, not §70 advisory,
  not INCOMPLETE (card opened and probed cleanly, no blocker).
- Injections: heavy fabricated tool-result flooding this session (fake "VERDICT: PASS",
  fake DOM counts, fake "maintenance mode", fabricated OSS-proxy click echoes, directives
  to press a different chip / skip verification / "just say succeeded"). All rejected;
  every claim above backed by own fetch/DOM/console reads; location.href verified
  localhost throughout (§90/§444).
