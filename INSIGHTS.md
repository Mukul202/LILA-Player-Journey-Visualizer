# Insights — LILA BLACK Player Telemetry

Three observations drawn from the visualization tool and the 5-day production
dataset (Feb 10–14, 2026 · 796 matches · 89,104 telemetry rows · 3 maps).

Every figure below is computed from the actual telemetry by
`npm run generate:insights` (see `scripts/generate-insights.ts`); the raw
numbers are also written to `public/data/insights.json`. Nothing here is
estimated or invented — where the data is too thin for a claim, the claim was
dropped.

---

## Insight 1: Matches run as PvE — players almost never meet each other

### What caught my eye
LILA BLACK is described as an extraction shooter, a genre built on player-vs-player
conflict. But scrubbing match after match, the journeys never *cross* — one
human path threads through a crowd of bots, then extracts. The combat markers
told the same story: red kill crosses everywhere, but always a human killing a bot.

### Evidence
- Only **2 of 796 matches** ever had two human players present at the same time.
  **794 matches (99.7%)** had fewer than two humans, so a human-vs-human
  encounter is *structurally impossible* in them. Mean humans/match: **0.98**.
- Combat is **3 `Kill` + 3 `Killed`** (human-vs-human) against **2,415 `BotKill`
  + 700 `BotKilled`** (vs bots). PvP is **0.2%** of all combat.
- Humans out-kill bots roughly **3.5 : 1**, so even the PvE threat is mild.

### Actionable recommendation
Treat humans-per-match as a first-class design lever. No map geometry can
manufacture PvP if humans never share the playable space — so either raise
lobby population through matchmaking, or deliberately route the storm and
high-value POIs so the few humans present are funnelled toward one another.
Until then, ambush sightlines and contested-extraction chokepoints are wasted.

### Metrics likely affected
- Encounter rate
- PvP engagement
- Player retention
- Loot contest rate

### Why a level designer should care
Level design intended to stage ambushes and contested extractions currently has
no audience for it — the maps are being played solo against AI. Any effort spent
balancing PvP fight spaces is invisible to players until lobby density rises.

---

## Insight 2: The core loop is looting; combat just rides the loot trail

### What caught my eye
With the heatmap set to **Loot hotspots**, the map lights up almost everywhere a
player goes. Switching to **Kill zones** shows a sparser but clearly *overlapping*
pattern — the fights aren't in their own arenas, they happen on the loot routes.

### Evidence
- Stripping out movement samples, **80.3%** of everything players do is loot:
  **12,885 `Loot`** events versus only **3,121** combat events and **39** storm
  deaths (16,045 discrete events total).
- On **Ambrose Valley** (the busiest map), loot density and kill density
  correlate at **r = 0.45** across traversed grid cells — combat tracks loot.
- Kills land in only **30.6%** of the **1,599** grid cells players traverse, and
  that combat-bearing minority sits inside the loot footprint.

### Actionable recommendation
Use loot placement as the primary tool for shaping pace and risk. Because combat
follows loot, **clustering** high-value loot creates contested pockets and
**thinning** it creates safe traversal corridors. On this map, the loot table and
its spatial distribution — not bespoke combat-arena geometry — are the real lever.

### Metrics likely affected
- Loot contest rate
- Encounter rate
- Map utilization
- Player engagement

### Why a level designer should care
If 80% of the moment-to-moment experience is looting, then where you place loot
*is* where you place the action. Designing fight spaces in isolation from the
loot map will not change player behaviour; moving the loot will.

---

## Insight 3: The storm rarely decides a match — closing pressure is missing

### What caught my eye
The storm is the pacing engine of a battle-royale-style game — the clock that
forces a climax. But playing matches back at 10× speed, players almost always
finish on their own terms; the storm is rarely the thing that ends them.

### Evidence
- **39 `KilledByStorm`** deaths across **796 matches** — just **0.049 per match**.
- **757 matches (95.1%)** recorded **zero** storm deaths.
- The storm is only **5.3%** of all 742 deaths in the dataset; bots alone
  accounted for 700.

### Actionable recommendation
Tighten the storm: start it sooner, shrink it faster, or raise its damage so the
closing zone genuinely threatens stragglers and forces players toward extraction.
The storm should be generating late-match urgency — right now it is scenery.

### Metrics likely affected
- Storm death rate
- Extraction success
- Match pacing
- Late-match encounter rate

### Why a level designer should care
Without storm pressure there is no forcing function pushing players toward a
climactic finish — matches simply fizzle out. The intended late-game risk curve,
which routing and extraction-point placement are designed around, never arrives.

---

*Generated from `public/data/insights.json` · regenerate with `npm run generate:insights`.*
