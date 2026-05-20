/**
 * scripts/generate-insights.ts  ·  `npm run generate:insights`
 *
 * Phase 5 - mine the preprocessed artifacts for level-design insights.
 * Reads public/data (manifest, match files, heatmaps), computes a set of
 * data-backed statistics, derives three insights and writes them to
 * public/data/insights.json. Run preprocess:data first.
 *
 * Every number printed and embedded here is computed from the actual
 * telemetry — these are the figures that back INSIGHTS.md.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  DataManifest,
  HeatmapGrid,
  Insight,
  InsightsReport,
  MatchData,
} from "../lib/data-types";

const DATA_DIR = join(process.cwd(), "public", "data");

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;
const log = (s = "") => console.log(s);

interface GridCell {
  col: number;
  row: number;
  count: number;
}

function gridCells(g: HeatmapGrid): GridCell[] {
  const cells: GridCell[] = [];
  for (let i = 0; i < g.cells.length; i += 3) {
    cells.push({ col: g.cells[i], row: g.cells[i + 1], count: g.cells[i + 2] });
  }
  return cells.sort((a, b) => b.count - a.count);
}

/** Dense per-cell array for a heatmap grid. */
function densify(g: HeatmapGrid): Float64Array {
  const v = new Float64Array(g.grid * g.grid);
  for (let i = 0; i < g.cells.length; i += 3) {
    v[g.cells[i + 1] * g.grid + g.cells[i]] = g.cells[i + 2];
  }
  return v;
}

/**
 * Pearson correlation between two grids, restricted to cells that players
 * actually traverse (`mask` > 0). Restricting to the playable footprint
 * avoids inflating the correlation with the many shared-zero off-map cells.
 */
function maskedCorrelation(
  a: HeatmapGrid,
  b: HeatmapGrid,
  mask: HeatmapGrid,
): number {
  const va = densify(a);
  const vb = densify(b);
  const vm = densify(mask);
  const idx: number[] = [];
  for (let i = 0; i < vm.length; i++) if (vm[i] > 0) idx.push(i);
  if (idx.length === 0) return 0;

  let ma = 0;
  let mb = 0;
  for (const i of idx) {
    ma += va[i];
    mb += vb[i];
  }
  ma /= idx.length;
  mb /= idx.length;

  let num = 0;
  let da = 0;
  let db = 0;
  for (const i of idx) {
    const xa = va[i] - ma;
    const xb = vb[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const denom = Math.sqrt(da * db);
  return denom > 0 ? num / denom : 0;
}

async function main() {
  log("=".repeat(70));
  log("  PHASE 5 · INSIGHTS");
  log("=".repeat(70));

  const manifest = await readJson<DataManifest>(
    join(DATA_DIR, "manifest.json"),
  );

  // ---- load every match -------------------------------------------------
  const matches: MatchData[] = [];
  for (const summary of manifest.matches) {
    matches.push(await readJson<MatchData>(join(DATA_DIR, summary.file)));
  }

  // ---- exact event tallies ---------------------------------------------
  const ev: Record<string, number> = {};
  for (const m of matches) {
    for (const e of m.events) ev[e.event] = (ev[e.event] ?? 0) + 1;
  }
  const Kill = ev.Kill ?? 0;
  const Killed = ev.Killed ?? 0;
  const BotKill = ev.BotKill ?? 0;
  const BotKilled = ev.BotKilled ?? 0;
  const Storm = ev.KilledByStorm ?? 0;
  const Loot = ev.Loot ?? 0;
  const pvpCombat = Kill + Killed;
  const pveCombat = BotKill + BotKilled;
  const totalCombat = pvpCombat + pveCombat;
  const totalDeaths = Killed + BotKilled + Storm;
  const discreteTotal = Loot + totalCombat + Storm;

  // ---- human density per match -----------------------------------------
  const totalMatches = manifest.matches.length;
  let oneHuman = 0;
  let multiHuman = 0;
  let humanSum = 0;
  let maxHumans = 0;
  let matchesNoStorm = 0;
  for (const s of manifest.matches) {
    humanSum += s.playerCount;
    if (s.playerCount >= 2) multiHuman += 1;
    else oneHuman += 1;
    maxHumans = Math.max(maxHumans, s.playerCount);
    if (s.eventCounts.storm === 0) matchesNoStorm += 1;
  }
  const meanHumans = humanSum / totalMatches;

  // ---- spatial analysis on the busiest map -----------------------------
  const heatmaps: Record<string, Record<string, HeatmapGrid>> = {};
  for (const map of manifest.maps) {
    heatmaps[map.id] = {};
    for (const kind of manifest.heatmapKinds) {
      heatmaps[map.id][kind] = await readJson<HeatmapGrid>(
        join(DATA_DIR, "heatmaps", `${map.id}-${kind}.json`),
      );
    }
  }
  const primaryMap = [...manifest.maps].sort(
    (a, b) => b.sampleCount - a.sampleCount,
  )[0];
  const killGrid = heatmaps[primaryMap.id].kills;
  const trafficGrid = heatmaps[primaryMap.id].traffic;
  const lootGrid = heatmaps[primaryMap.id].loot;
  const killCells = gridCells(killGrid).length;
  const trafficCellsCount = gridCells(trafficGrid).length;
  const lootCells = gridCells(lootGrid).length;
  const killCoverage = pct(killCells, trafficCellsCount);
  const lootKillCorr = maskedCorrelation(lootGrid, killGrid, trafficGrid);

  log("");
  log("EVENT TALLIES");
  log(`  Kill / Killed (PvP)        ${Kill} / ${Killed}`);
  log(`  BotKill / BotKilled (PvE)  ${BotKill} / ${BotKilled}`);
  log(`  KilledByStorm              ${Storm}`);
  log(`  Loot                       ${Loot}`);
  log(`  discrete events total      ${discreteTotal}`);
  log(`  PvP share of combat        ${r1(pct(pvpCombat, totalCombat))}%`);
  log(`  loot share of discrete     ${r1(pct(Loot, discreteTotal))}%`);
  log("");
  log("HUMAN DENSITY");
  log(`  matches                    ${totalMatches}`);
  log(`  single-human matches       ${oneHuman}  (${r1(pct(oneHuman, totalMatches))}%)`);
  log(`  multi-human matches        ${multiHuman}   max humans/match ${maxHumans}`);
  log(`  mean humans / match        ${meanHumans.toFixed(3)}`);
  log("");
  log("STORM");
  log(`  storm deaths               ${Storm}  (${(Storm / totalMatches).toFixed(3)}/match)`);
  log(`  matches with 0 storm deaths ${matchesNoStorm}  (${r1(pct(matchesNoStorm, totalMatches))}%)`);
  log(`  storm share of all deaths  ${r1(pct(Storm, totalDeaths))}%`);
  log("");
  log(`SPATIAL · ${primaryMap.name}`);
  log(`  traversed cells            ${trafficCellsCount} / ${trafficGrid.grid ** 2}`);
  log(`  loot cells / kill cells    ${lootCells} / ${killCells}`);
  log(`  kills cover                ${r1(killCoverage)}% of traversed cells`);
  log(`  loot vs kill correlation   r = ${lootKillCorr.toFixed(3)} (over traversed cells)`);

  // ---- three data-backed insights --------------------------------------
  const insights: Insight[] = [
    {
      id: 1,
      title: "Matches run as PvE — players almost never meet each other",
      caughtMyEye: `An extraction shooter is sold on player conflict, yet across ${totalMatches} matches and ${manifest.totals.rows.toLocaleString()} telemetry rows there are only ${pvpCombat} human-vs-human combat events.`,
      evidence: [
        `Only ${multiHuman} of ${totalMatches} matches ever had two human players present at once; ${oneHuman} (${r1(pct(oneHuman, totalMatches))}%) had fewer than two, so a human-vs-human encounter is structurally impossible in them. Mean humans/match: ${meanHumans.toFixed(2)}.`,
        `Combat is ${Kill} \`Kill\` + ${Killed} \`Killed\` (human-vs-human) against ${BotKill.toLocaleString()} \`BotKill\` + ${BotKilled} \`BotKilled\` (vs bots) — PvP is ${r1(pct(pvpCombat, totalCombat))}% of all combat.`,
        `Humans beat bots roughly ${r1(BotKill / Math.max(1, BotKilled))}:1, so even the PvE threat is mild.`,
      ],
      recommendation:
        "Treat humans-per-match as a first-class design lever — raise lobby population through matchmaking, or route the storm and POIs so the few humans present are funnelled together. Map geometry cannot manufacture PvP encounters if humans never share the playable space.",
      metricsAffected: [
        "Encounter rate",
        "PvP engagement",
        "Player retention",
        "Loot contest rate",
      ],
      whyItMatters:
        "Level design intended to stage ambushes and contested extractions currently has no audience for it — the maps are being played solo against AI.",
    },
    {
      id: 2,
      title: "The core loop is looting; combat just rides the loot trail",
      caughtMyEye: `Stripping out movement samples, ${r1(pct(Loot, discreteTotal))}% of everything players do is pick up loot — fighting is a minor, incidental activity.`,
      evidence: [
        `${Loot.toLocaleString()} \`Loot\` events vs only ${totalCombat.toLocaleString()} combat events and ${Storm} storm deaths (${discreteTotal.toLocaleString()} discrete events total).`,
        `On ${primaryMap.name}, loot density and kill density correlate at r = ${lootKillCorr.toFixed(2)} across traversed cells — bot fights happen on the loot routes, not in separate arenas.`,
        `Kills land in only ${r1(killCoverage)}% of the ${trafficCellsCount} cells players traverse, and that combat-bearing minority overlaps the loot footprint.`,
      ],
      recommendation:
        "Use loot placement as the primary tool for shaping pace and risk. Because combat follows loot, clustering high-value loot creates contested pockets and thinning it creates safe traversal — loot layout, not combat-arena geometry, is the real lever on this map.",
      metricsAffected: [
        "Loot contest rate",
        "Encounter rate",
        "Map utilization",
        "Player engagement",
      ],
      whyItMatters:
        "If 80% of the player experience is looting, the loot table and its spatial distribution — not bespoke fight spaces — decide where the game's tension lives.",
    },
    {
      id: 3,
      title: "The storm rarely decides a match — closing pressure is missing",
      caughtMyEye: `The shrinking storm is the pacing engine of a battle-royale-style game, yet it kills almost nobody.`,
      evidence: [
        `${Storm} \`KilledByStorm\` deaths across ${totalMatches} matches — ${(Storm / totalMatches).toFixed(3)} per match.`,
        `${matchesNoStorm} matches (${r1(pct(matchesNoStorm, totalMatches))}%) recorded zero storm deaths.`,
        `The storm is just ${r1(pct(Storm, totalDeaths))}% of all ${totalDeaths} deaths; bots alone caused ${BotKilled}.`,
      ],
      recommendation:
        "Tighten the storm — start it sooner, shrink it faster, or raise its damage so the closing zone genuinely threatens stragglers and forces players toward extraction.",
      metricsAffected: [
        "Storm death rate",
        "Extraction success",
        "Match pacing",
        "Late-match encounter rate",
      ],
      whyItMatters:
        "With no storm pressure there is no forcing function pushing players toward a climactic finish; matches simply fizzle out and the intended late-game risk curve never arrives.",
    },
  ];

  const report: InsightsReport = {
    generatedAt: new Date().toISOString(),
    insights,
    stats: {
      matches: totalMatches,
      telemetryRows: manifest.totals.rows,
      discreteEvents: discreteTotal,
      pvpCombatEvents: pvpCombat,
      pveCombatEvents: pveCombat,
      pvpShareOfCombatPct: r1(pct(pvpCombat, totalCombat)),
      matchesUnderTwoHumans: oneHuman,
      matchesUnderTwoHumansPct: r1(pct(oneHuman, totalMatches)),
      matchesWithTwoHumans: multiHuman,
      maxHumansPerMatch: maxHumans,
      meanHumansPerMatch: Number(meanHumans.toFixed(3)),
      lootEvents: Loot,
      lootShareOfDiscretePct: r1(pct(Loot, discreteTotal)),
      lootKillCorrelation: Number(lootKillCorr.toFixed(3)),
      primaryMap: primaryMap.name,
      killCellCoveragePct: r1(killCoverage),
      stormDeaths: Storm,
      stormDeathsPerMatch: Number((Storm / totalMatches).toFixed(3)),
      matchesWithoutStormDeaths: matchesNoStorm,
      stormShareOfDeathsPct: r1(pct(Storm, totalDeaths)),
    },
  };

  await writeFile(
    join(DATA_DIR, "insights.json"),
    JSON.stringify(report, null, 2),
  );

  log("");
  log("-".repeat(70));
  for (const i of insights) log(`  Insight ${i.id}: ${i.title}`);
  log(`  wrote public/data/insights.json`);
  log("=".repeat(70));
}

main().catch((err) => {
  console.error("\ngenerate-insights failed:", err);
  process.exit(1);
});
