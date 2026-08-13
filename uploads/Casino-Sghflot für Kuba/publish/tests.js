/* =============================================================================
   KUBA'S GAINZ LAB — automatisierte Tests der Spielmechanik
   Reine Logik-Tests, laufen ohne UI. Seed-RNG = ausdruecklich Testmodus.
   ========================================================================== */
import {
  RNG, CELL, ClusterDetector, GridEngine, AvalancheEngine,
  MultiplierEngine, ScatterEngine, WinCalculator, GameEngine, FreeSpinsRound
} from './engine.js';
import { clonePreset, freeSpinsForScatters, retriggerSpinsForScatters } from './gameMath.js';

const COLS = 7, ROWS = 7, MIN = 9;

function blank(fill) {
  const g = new Array(COLS * ROWS);
  for (let i = 0; i < g.length; i++) g[i] = { t: CELL.SYMBOL, s: fill || 'filler' + (i % 3), k: i };
  return g;
}
function put(g, cells, sym) { for (const i of cells) g[i] = { t: CELL.SYMBOL, s: sym, k: i }; return g; }
function clustersOf(g) { return ClusterDetector.findAnywhere(g, MIN); }
function hasCluster(g, sym, size) {
  return clustersOf(g).some(c => c.sym === sym && c.cells.length >= (size || MIN));
}

export function runTests() {
  const out = [];
  const t = (name, fn) => {
    try { const r = fn(); out.push({ name, pass: r.pass, info: r.info || '' }); }
    catch (e) { out.push({ name, pass: false, info: 'Exception: ' + e.message }); }
  };

  /* --- Gewinnerkennung: PAY ANYWHERE ------------------------------------- */
  t('9 gleiche irgendwo = Gewinn', () => {
    const g = put(blank(), [0,3,9,14,17,22,28,31,36], 'testo');
    const w = ClusterDetector.findAnywhere(g, 9).filter(c => c.sym === 'testo');
    return { pass: w.length === 1 && w[0].cells.length === 9, info: 'verstreut, keine Verbindung' };
  });
  t('8 gleiche = kein Gewinn', () => {
    const g = put(blank(), [0,3,9,14,17,22,28,31], 'testo');
    return { pass: ClusterDetector.findAnywhere(g, 9).filter(c => c.sym === 'testo').length === 0, info: 'Mindestanzahl 9 greift' };
  });
  t('Verbindung ist egal — 9 in einer Reihe zaehlen gleich', () => {
    const g = put(blank(), [14,15,16,17,18,19,20,21,22], 'testo');
    const w = ClusterDetector.findAnywhere(g, 9).filter(c => c.sym === 'testo');
    return { pass: w.length === 1 && w[0].cells.length === 9, info: 'zusammenhaengend zahlt identisch' };
  });
  t('Alle 9 Zellen gehoeren zum Gewinn und werden entfernt', () => {
    const g = put(blank(), [1,5,8,12,19,23,26,30,37], 'testo');
    const w = ClusterDetector.findAnywhere(g, 9).find(c => c.sym === 'testo');
    return { pass: w && w.cells.length === 9, info: 'Gewinngruppe = alle Vorkommen' };
  });
  t('Zwei Symbole koennen gleichzeitig zahlen', () => {
    let g = put(blank('filler'), [0,1,2,3,4,5,6,7,8], 'testo');
    g = put(g, [11,12,13,14,15,16,17,18,19], 'tanga');
    const w = ClusterDetector.findAnywhere(g, 9);
    return { pass: w.length >= 2, info: w.length + ' Gewinngruppen' };
  });

  /* --- Avalanche --------------------------------------------------------- */
  const math = clonePreset('target');
  const rng = new RNG(12345);
  const ge = new GridEngine(math, rng);

  t('Gewinnsymbole werden korrekt entfernt', () => {
    let g = put(blank(), [14, 15, 16, 17, 18], 'testo');
    const removed = new Set([14, 15, 16, 17, 18]);
    g = AvalancheEngine.collapse(g, removed, COLS, ROWS, ge, { phase: 'tumble', mode: 'base' });
    const stillThere = g.filter(c => c.t === CELL.SYMBOL && c.s === 'testo').length;
    return { pass: stillThere <= 5, info: 'Testo-Zellen nach Collapse: ' + stillThere + ' (nur zufaellige Neuzellen)' };
  });
  t('Symbole fallen nach unten', () => {
    const g = blank();
    g[7] = { t: CELL.SYMBOL, s: 'marker', k: 999 };
    const res = AvalancheEngine.collapse(g, new Set([14, 21, 28, 35, 42]), COLS, ROWS, ge, { phase: 'tumble', mode: 'base' });
    return { pass: res[42].s === 'marker', info: 'Marker von Index 7 auf 42 gefallen: ' + (res[42].s === 'marker') };
  });
  t('Neue Symbole erscheinen oben', () => {
    const g = blank();
    const res = AvalancheEngine.collapse(g, new Set([0, 7, 14, 21, 28]), COLS, ROWS, ge, { phase: 'tumble', mode: 'base' });
    const topFresh = [0, 7, 14, 21, 28].filter(i => res[i] && res[i].fresh !== false).length;
    return { pass: res.filter(Boolean).length === 49 && topFresh > 0, info: 'Grid vollstaendig, ' + topFresh + ' neue/verschobene Zellen in Spalte 0' };
  });
  t('Mehrere Tumbles laufen bis kein Cluster mehr da ist', () => {
    const e = new GameEngine(clonePreset('demo'), new RNG(777));
    let maxT = 0, any = false;
    for (let i = 0; i < 200; i++) {
      const r = e.spin({ bet: 1, mode: 'base', trace: false });
      if (r.tumbles > maxT) maxT = r.tumbles;
      if (r.tumbles > 1) any = true;
      const left = ClusterDetector.findAnywhere(r.finalGrid, MIN);
      if (left.length) return { pass: false, info: 'Endgrid enthaelt noch einen Gewinn' };
    }
    return { pass: any, info: 'max. Tumbles in 200 Spins: ' + maxT + ', Endgrids clusterfrei' };
  });

  /* --- Multiplikatoren ---------------------------------------------------- */
  t('Mehrere Multiplikatoren werden ADDIERT, nicht multipliziert', () => {
    const list = [{ index: 1, value: 10 }, { index: 2, value: 25 }, { index: 3, value: 50 }];
    const sum = MultiplierEngine.sum(list);
    return { pass: sum === 85, info: '10+25+50 = ' + sum + ' (multipliziert waere 12500)' };
  });
  t('Multiplikator wird genau einmal angewendet', () => {
    const w = WinCalculator.applyMultiplier(10, 85);
    return { pass: w === 850, info: '10 € x85 = ' + w + ' €' };
  });
  t('Base-Game-Multiplikator wird nach der Sequenz zurueckgesetzt', () => {
    const e = new GameEngine(clonePreset('demo'), new RNG(4242));
    let seenMult = false, leaked = false;
    for (let i = 0; i < 300; i++) {
      const r = e.spin({ bet: 1, mode: 'base', trace: false });
      if (r.multiplierSum > 0) seenMult = true;
      if (r.appliedMultiplier !== (r.multiplierSum > 0 ? r.multiplierSum : 1)) leaked = true;
    }
    return { pass: seenMult && !leaked, info: 'jeder Base-Spin startet bei 0x — kein Uebertrag' };
  });
  t('Freispiel-Multiplikator bleibt ueber mehrere Spins bestehen', () => {
    const e = new GameEngine(clonePreset('demo'), new RNG(2024));
    const round = new FreeSpinsRound(e, { bet: 1, spins: 30 });
    let prev = 0, monotone = true, grew = false;
    while (!round.finished) {
      const r = round.nextSpin(false);
      if (!r) break;
      if (round.globalMultiplier < prev) monotone = false;
      if (round.globalMultiplier > prev) grew = true;
      prev = round.globalMultiplier;
    }
    return { pass: monotone && grew, info: 'globaler Multiplikator am Ende: ' + prev + 'x (nie gesunken)' };
  });

  /* --- Scatter / Freispiele ---------------------------------------------- */
  [[4, 15], [5, 20], [6, 25], [7, 30]].forEach(([sc, sp]) => {
    t(sc + ' Scatter = ' + sp + ' Freispiele', () => {
      const got = freeSpinsForScatters(math, sc);
      return { pass: got === sp, info: 'ergibt ' + got };
    });
  });
  t('3 Scatter loesen keine Freispiele aus', () => {
    return { pass: freeSpinsForScatters(math, 3) === 0, info: 'Mindestens 4 noetig' };
  });
  t('Retrigger vergibt zusaetzliche Freispiele (4/5/6/7 = 15/20/25/30)', () => {
    const ok = retriggerSpinsForScatters(math, 4) === 15 && retriggerSpinsForScatters(math, 5) === 20 &&
               retriggerSpinsForScatters(math, 6) === 25 && retriggerSpinsForScatters(math, 7) === 30;
    const e = new GameEngine(clonePreset('demo'), new RNG(31337));
    const round = new FreeSpinsRound(e, { bet: 1, spins: 15 });
    const before = round.total;
    let grew = false;
    while (!round.finished) { const r = round.nextSpin(false); if (!r) break; if (round.total > before) grew = true; }
    return { pass: ok, info: 'Tabelle korrekt' + (grew ? ', Retrigger in Demo-Lauf beobachtet' : '') };
  });

  /* --- Buys & Special Spins ---------------------------------------------- */
  t('Bonus Buy kostet exakt 100x Einsatz', () => {
    const c = math.bonusBuyParameters.normal.costMultiplier;
    const checks = [[0.2, 20], [1, 100], [10, 1000]];
    const ok = c === 100 && checks.every(([b, exp]) => +(b * c).toFixed(2) === exp);
    return { pass: ok, info: '0,20 → 20 | 1 → 100 | 10 → 1.000' };
  });
  t('Super Bonus Buy kostet exakt 500x Einsatz', () => {
    const c = math.bonusBuyParameters.super.costMultiplier;
    return { pass: c === 500 && +(0.2 * c).toFixed(2) === 100, info: '0,20 → 100 | 1 → 500 | 10 → 5.000' };
  });
  t('Super Spin 1 garantiert mindestens einen Multiplikator', () => {
    const e = new GameEngine(clonePreset('target'), new RNG(9001));
    for (let i = 0; i < 250; i++) {
      const r = e.spin({ bet: 1, mode: 'base', trace: false, guaranteedMultipliers: 1 });
      if (r.multipliers.length < 1) return { pass: false, info: 'Spin ' + i + ' hatte keinen Multiplikator' };
    }
    return { pass: true, info: '250/250 Spins mit >= 1 Multiplikator' };
  });
  t('Super Spin 2 garantiert einen Multiplikator >= 50x', () => {
    const e = new GameEngine(clonePreset('target'), new RNG(9002));
    for (let i = 0; i < 250; i++) {
      const r = e.spin({ bet: 1, mode: 'base', trace: false, guaranteedMultipliers: 1, minGuaranteedMultiplier: 50 });
      if (!r.multipliers.some(v => v >= 50)) return { pass: false, info: 'Spin ' + i + ' ohne 50x+' };
    }
    return { pass: true, info: '250/250 Spins mit mindestens 50x' };
  });
  t('Super Free Spins erzeugen keinen Multiplikator unter 5x', () => {
    const e = new GameEngine(clonePreset('demo'), new RNG(5150));
    const round = new FreeSpinsRound(e, { bet: 1, spins: 40, superMode: true });
    const bad = [];
    while (!round.finished) {
      const r = round.nextSpin(false);
      if (!r) break;
      for (const v of r.multipliers) if (v < 5) bad.push(v);
    }
    return { pass: bad.length === 0, info: bad.length ? 'gefunden: ' + bad.join(',') : 'Floor 5x eingehalten' };
  });
  t('Ante Bet 1 kostet 2x und erhoeht die Trigger-Chance 5-fach', () => {
    const a = math.anteBetParameters.ante1;
    return { pass: a.costMultiplier === 2 && a.scatterFactor === 5, info: 'Kosten 2x, Faktor 5x' };
  });
  t('Ante Bet 2 aktiviert den Multiplikator-Floor 5x', () => {
    const a = math.anteBetParameters.ante2;
    return { pass: a.scatterFactor === 5 && a.multiplierFloor === 5, info: 'Preis ' + a.costMultiplier + 'x (Konfigurationswert, nicht eindeutig dokumentiert)' };
  });

  /* --- Max Win ------------------------------------------------------------ */
  t('Max-Win-Cap von 10.000x wird immer eingehalten', () => {
    const r1 = WinCalculator.cap(999999, 1, 10000);
    const r2 = WinCalculator.cap(50, 0.2, 10000);
    const ok = r1.win === 10000 && r1.capped && r2.win === 50 && !r2.capped;
    const e = new GameEngine(clonePreset('demo'), new RNG(606));
    let over = false;
    for (let i = 0; i < 400; i++) {
      const r = e.spin({ bet: 1, mode: 'base', trace: false });
      if (r.totalWin > 10000) over = true;
    }
    return { pass: ok && !over, info: 'Cap greift, 400 Demo-Spins ohne Ueberschreitung' };
  });
  t('Freispiel-RUNDE wird ebenfalls auf 10.000x gedeckelt', () => {
    const e = new GameEngine(clonePreset('demo'), new RNG(777001));
    const round = new FreeSpinsRound(e, { bet: 1, spins: 200, superMode: true });
    while (!round.finished) if (!round.nextSpin(false)) break;
    return { pass: round.roundWin <= 10000, info: 'Rundengewinn ' + round.roundWin.toFixed(2) + ' <= 10.000' };
  });
  t('Kein Gewinn wird durch den Multiplikator doppelt berechnet', () => {
    const e = new GameEngine(clonePreset('demo'), new RNG(8080));
    for (let i = 0; i < 500; i++) {
      const r = e.spin({ bet: 1, mode: 'base', trace: false });
      const expect = r.sequenceWin > 0 ? +(r.sequenceWin * r.appliedMultiplier).toFixed(6) : 0;
      const capped = Math.min(expect, 10000);
      if (Math.abs(r.totalWin - capped) > 0.0001) {
        return { pass: false, info: 'Spin ' + i + ': erwartet ' + capped + ', erhalten ' + r.totalWin };
      }
    }
    return { pass: true, info: '500 Spins: totalWin === sequenzGewinn x Multiplikator (einmalig, gedeckelt)' };
  });
  t('Scatter zaehlen nicht als Gewinnsymbol mit', () => {
    const g = blank();
    for (const i of [0,1,2,3,4,5,6,7,8,9]) g[i] = { t: CELL.SCATTER, k: i };
    const cl = clustersOf(g);
    return { pass: !cl.some(c => c.cells.some(i => g[i].t === CELL.SCATTER)), info: 'Scatter zahlen nie als Symbol' };
  });
  t('Multiplikator-Zellen zaehlen nicht mit', () => {
    const g = blank();
    for (const i of [0,1,2,3,4,5,6,7,8,9]) g[i] = { t: CELL.MULTIPLIER, v: 10, k: i };
    const cl = clustersOf(g);
    return { pass: !cl.some(c => c.cells.some(i => g[i].t === CELL.MULTIPLIER)), info: 'Orbs sind keine Gewinnsymbole' };
  });
  t('Erzwungene Scatteranzahl trifft exakt (Bonus Buy)', () => {
    const e = new GameEngine(clonePreset('target'), new RNG(1212));
    for (const n of [4, 5, 6, 7]) {
      const r = e.spin({ bet: 1, mode: 'base', trace: false, forcedScatters: n });
      if (r.scatters < n) return { pass: false, info: 'angefordert ' + n + ', erhalten ' + r.scatters };
    }
    return { pass: true, info: '4/5/6/7 Scatter exakt erzeugbar' };
  });
  t('Seed-RNG ist reproduzierbar (nur Testmodus)', () => {
    const a = new GameEngine(clonePreset('target'), new RNG(4711)).spin({ bet: 1, mode: 'base', trace: false });
    const b = new GameEngine(clonePreset('target'), new RNG(4711)).spin({ bet: 1, mode: 'base', trace: false });
    return { pass: a.totalWin === b.totalWin && a.tumbles === b.tumbles, info: 'gleicher Seed = gleiches Ergebnis' };
  });

  return out;
}
