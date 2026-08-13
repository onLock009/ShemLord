/* =============================================================================
   KUBA'S GAINZ LAB — Spiel-Engine (UI-frei, deterministisch testbar)
   RNG | GridEngine | ClusterDetector | AvalancheEngine | MultiplierEngine
   ScatterEngine | WinCalculator | GameEngine | FreeSpinsRound | SimulationEngine
   ========================================================================== */
import { payoutFor, freeSpinsForScatters, retriggerSpinsForScatters } from './gameMath.js';

/* --- RNG -------------------------------------------------------------------
   Ohne Seed: crypto/Math.random (Produktivpfad).
   Mit Seed: xorshift32 — AUSSCHLIESSLICH Testmodus, nie im echten Spiel.     */
export class RNG {
  constructor(seed) {
    this.seeded = seed !== undefined && seed !== null;
    this.isTestMode = this.seeded;
    this._s = (this.seeded ? (seed >>> 0) : 1) || 1;
  }
  next() {
    if (!this.seeded) return Math.random();
    let x = this._s;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;  x >>>= 0;
    this._s = x;
    return x / 4294967296;
  }
  int(n) { return Math.floor(this.next() * n); }
  weighted(values, weights) {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    let r = this.next() * total;
    for (let i = 0; i < values.length; i++) { r -= weights[i]; if (r <= 0) return values[i]; }
    return values[values.length - 1];
  }
}

export const CELL = { SYMBOL: 'sym', SCATTER: 'scatter', MULTIPLIER: 'mult' };

/* --- ClusterDetector -------------------------------------------------------
   Flood-Fill mit 4er-Nachbarschaft. Diagonalen zaehlen NIE.                  */
export class ClusterDetector {
  static find(grid, cols, rows, minCluster) {
    const seen = new Uint8Array(cols * rows);
    const out = [];
    for (let i = 0; i < grid.length; i++) {
      const cell = grid[i];
      if (seen[i] || !cell || cell.t !== CELL.SYMBOL) continue;
      const sym = cell.s;
      const stack = [i];
      const cells = [];
      seen[i] = 1;
      while (stack.length) {
        const idx = stack.pop();
        cells.push(idx);
        const c = idx % cols, r = (idx - c) / cols;
        if (c > 0)        ClusterDetector._push(grid, seen, stack, idx - 1,    sym);
        if (c < cols - 1) ClusterDetector._push(grid, seen, stack, idx + 1,    sym);
        if (r > 0)        ClusterDetector._push(grid, seen, stack, idx - cols, sym);
        if (r < rows - 1) ClusterDetector._push(grid, seen, stack, idx + cols, sym);
      }
      if (cells.length >= minCluster) out.push({ sym, cells: cells.sort((a, b) => a - b) });
    }
    return out;
  }
  static _push(grid, seen, stack, idx, sym) {
    if (seen[idx]) return;
    const c = grid[idx];
    if (!c || c.t !== CELL.SYMBOL || c.s !== sym) return;
    seen[idx] = 1;
    stack.push(idx);
  }

  /* PAY ANYWHERE: N gleiche Symbole irgendwo auf dem Raster zahlen —
     Verbindung spielt keine Rolle. */
  static findAnywhere(grid, minMatch) {
    const map = {};
    for (let i = 0; i < grid.length; i++) {
      const c = grid[i];
      if (!c || c.t !== CELL.SYMBOL) continue;
      (map[c.s] = map[c.s] || []).push(i);
    }
    const out = [];
    for (const sym in map) if (map[sym].length >= minMatch) out.push({ sym, cells: map[sym] });
    return out;
  }

  static detect(grid, math) {
    const g = math.grid;
    if (g.winMode === 'cluster') return ClusterDetector.find(grid, g.cols, g.rows, g.minCluster);
    return ClusterDetector.findAnywhere(grid, g.minMatch);
  }
}

/* --- GridEngine + Scatter/Multiplier-Erzeugung ---------------------------- */
export class GridEngine {
  constructor(math, rng) { this.math = math; this.rng = rng; this._id = 0; }
  setMath(m) { this.math = m; }

  rollSymbol(pictureBoost) {
    const m = this.math;
    const boost = pictureBoost && pictureBoost > 1 ? pictureBoost : 1;
    const pics = m.pictureSymbols || [];
    const wts = m.symbols.map(s => m.symbolWeights[s] * (boost > 1 && pics.indexOf(s) >= 0 ? boost : 1));
    return this.rng.weighted(m.symbols, wts);
  }
  rollMultiplier(floor) {
    const m = this.math;
    let vals = m.multiplierValues, wts = m.multiplierWeights;
    if (floor) {
      const v = [], w = [];
      for (let i = 0; i < vals.length; i++) if (vals[i] >= floor) { v.push(vals[i]); w.push(wts[i]); }
      if (v.length) { vals = v; wts = w; }
    }
    return this.rng.weighted(vals, wts);
  }
  /* ctx: { phase:'initial'|'tumble', mode:'base'|'free', anteFactor, floor } */
  newCell(ctx) {
    const m = this.math;
    const scBase = ctx.phase === 'tumble'
      ? m.scatterChance.tumble
      : (ctx.mode === 'base' ? m.scatterChance.base : m.scatterChance.freeSpins);
    /* Ante erhoeht die TRIGGER-Wahrscheinlichkeit um den Faktor, nicht die
       Symbolrate. Da P(>=4 Scatter aus 49) ungefaehr wie p^4 waechst, wird der
       Faktor mit anteScatterExponent (Default 0.25) auf die Zellrate umgerechnet. */
    const expo = m.anteScatterExponent != null ? m.anteScatterExponent : 0.25;
    const f = ctx.anteFactor && ctx.anteFactor > 1 ? Math.pow(ctx.anteFactor, expo) : 1;
    const sc = Math.min(0.25, scBase * f);
    const ml = ctx.phase === 'tumble'
      ? m.multiplierChance.tumble
      : (ctx.mode === 'base' ? m.multiplierChance.base : m.multiplierChance.freeSpins);
    const r = this.rng.next();
    if (r < sc) return { t: CELL.SCATTER, k: ++this._id, fresh: true };
    if (r < sc + ml) return { t: CELL.MULTIPLIER, v: this.rollMultiplier(ctx.floor), k: ++this._id, fresh: true };
    return { t: CELL.SYMBOL, s: this.rollSymbol(ctx.pictureBoost), k: ++this._id, fresh: true };
  }
  build(ctx) {
    const n = this.math.grid.cols * this.math.grid.rows;
    const g = new Array(n);
    for (let i = 0; i < n; i++) g[i] = this.newCell(ctx);
    return g;
  }
}

/* --- ScatterEngine -------------------------------------------------------- */
export class ScatterEngine {
  static count(grid) {
    let n = 0;
    for (let i = 0; i < grid.length; i++) if (grid[i].t === CELL.SCATTER) n++;
    return n;
  }
  /* Erzwingt genau `target` Scatter (fuer Bonus Buy) */
  static force(grid, target, rng, gridEngine) {
    const idx = [];
    for (let i = 0; i < grid.length; i++) if (grid[i].t === CELL.SCATTER) idx.push(i);
    while (idx.length > target) {
      const pos = idx.pop();
      grid[pos] = { t: CELL.SYMBOL, s: gridEngine.rollSymbol(), k: ++gridEngine._id, fresh: true };
    }
    let guard = 0;
    while (idx.length < target && guard++ < 500) {
      const i = rng.int(grid.length);
      if (idx.indexOf(i) >= 0) continue;
      grid[i] = { t: CELL.SCATTER, k: ++gridEngine._id, fresh: true };
      idx.push(i);
    }
    return grid;
  }
}

/* --- MultiplierEngine ------------------------------------------------------ */
export class MultiplierEngine {
  static present(grid) {
    const out = [];
    for (let i = 0; i < grid.length; i++) if (grid[i].t === CELL.MULTIPLIER) out.push({ index: i, value: grid[i].v });
    return out;
  }
  /* Addieren, niemals multiplizieren. */
  static sum(list) { return list.reduce((a, o) => a + o.value, 0); }

  static guarantee(grid, count, minValue, rng, gridEngine) {
    const have = MultiplierEngine.present(grid).filter(o => !minValue || o.value >= minValue);
    let need = Math.max(0, count - have.length);
    let guard = 0;
    while (need > 0 && guard++ < 500) {
      const i = rng.int(grid.length);
      if (grid[i].t === CELL.MULTIPLIER || grid[i].t === CELL.SCATTER) continue;
      grid[i] = { t: CELL.MULTIPLIER, v: gridEngine.rollMultiplier(minValue || null), k: ++gridEngine._id, fresh: true };
      need--;
    }
    return grid;
  }
}

/* --- AvalancheEngine ------------------------------------------------------ */
export class AvalancheEngine {
  /* Entfernt `removed`, laesst alles nachrutschen, fuellt oben auf.
     Multiplikator- und Scatter-Zellen bleiben bestehen (werden nur bewegt). */
  static collapse(grid, removed, cols, rows, gridEngine, ctx) {
    const out = new Array(cols * rows);
    for (let c = 0; c < cols; c++) {
      const keep = [];
      for (let r = rows - 1; r >= 0; r--) {
        const i = r * cols + c;
        if (!removed.has(i)) keep.push({ cell: grid[i], row: r });
      }
      for (let k = 0; k < rows; k++) {
        const row = rows - 1 - k;
        const dst = row * cols + c;
        if (k < keep.length) {
          const it = keep[k];
          out[dst] = Object.assign({}, it.cell, { fresh: it.row !== row, win: false, gone: false });
        } else {
          out[dst] = gridEngine.newCell(ctx);
        }
      }
    }
    return out;
  }
}

/* --- WinCalculator ---------------------------------------------------------
   Trennt strikt Cluster-Gewinn und Multiplikator. Der Multiplikator wird
   GENAU EINMAL am Ende der Sequenz angewendet.                               */
export class WinCalculator {
  static clusterWin(math, clusters, bet) {
    let win = 0;
    for (const cl of clusters) {
      cl.pay = payoutFor(math, cl.sym, cl.cells.length) * bet;
      win += cl.pay;
    }
    return +win.toFixed(6);
  }
  static applyMultiplier(sequenceWin, multiplier) {
    if (sequenceWin <= 0) return 0;
    const m = multiplier > 0 ? multiplier : 1;
    return +(sequenceWin * m).toFixed(6);
  }
  static cap(win, bet, maxWinMultiplier) {
    const max = bet * maxWinMultiplier;
    return win > max ? { win: max, capped: true } : { win: +win.toFixed(6), capped: false };
  }
}

/* --- GameEngine ------------------------------------------------------------ */
export class GameEngine {
  constructor(math, rng) {
    this.math = math;
    this.rng = rng || new RNG();
    this.gridEngine = new GridEngine(math, this.rng);
  }
  setMath(math) { this.math = math; this.gridEngine.setMath(math); }
  setRng(rng) { this.rng = rng; this.gridEngine.rng = rng; }

  idleGrid() {
    const n = this.math.grid.cols * this.math.grid.rows;
    const g = new Array(n);
    for (let i = 0; i < n; i++) g[i] = { t: CELL.SYMBOL, s: this.gridEngine.rollSymbol(), k: ++this.gridEngine._id, fresh: false };
    return g;
  }

  /* opts:
     bet, mode:'base'|'free', anteFactor, multiplierFloor,
     forcedScatters, guaranteedMultipliers, minGuaranteedMultiplier,
     globalMultiplier (nur mode==='free'), trace (Steps+History sammeln)      */
  spin(opts) {
    const m = this.math;
    const bet = opts.bet;
    const mode = opts.mode || 'base';
    const trace = opts.trace !== false;
    const cols = m.grid.cols, rows = m.grid.rows;
    const floor = opts.multiplierFloor || null;
    const ctxInit = { phase: 'initial', mode, anteFactor: opts.anteFactor || 1, floor, pictureBoost: opts.pictureBoost };
    const ctxTumble = { phase: 'tumble', mode, anteFactor: opts.anteFactor || 1, floor, pictureBoost: opts.pictureBoost };

    const steps = [], history = [];
    const log = (s) => { if (trace) history.push(s); };
    const snap = (g) => g.map(c => Object.assign({}, c));

    let grid = this.gridEngine.build(ctxInit);
    if (opts.forcedScatters) ScatterEngine.force(grid, opts.forcedScatters, this.rng, this.gridEngine);
    if (opts.guaranteedMultipliers) {
      MultiplierEngine.guarantee(grid, opts.guaranteedMultipliers,
        opts.minGuaranteedMultiplier || floor || null, this.rng, this.gridEngine);
    }

    log('Spin gestartet — Modus: ' + mode + ', Einsatz: ' + bet.toFixed(2));
    if (trace) steps.push({ type: 'grid', grid: snap(grid) });

    let sequenceWin = 0, tumbles = 0, scatterMax = ScatterEngine.count(grid);
    const clusterSizes = [];

    for (;;) {
      const clusters = ClusterDetector.detect(grid, m);
      if (!clusters.length) break;
      const win = WinCalculator.clusterWin(m, clusters, bet);
      sequenceWin += win;
      for (const cl of clusters) clusterSizes.push(cl.cells.length);

      log('Cluster gefunden: ' + clusters.map(c => c.sym + ' x' + c.cells.length).join(', '));
      log('Gewinn berechnet: ' + win.toFixed(2) + ' (Sequenz ' + sequenceWin.toFixed(2) + ')');
      if (trace) steps.push({
        type: 'clusters', tumble: tumbles, sequenceWin: +sequenceWin.toFixed(2), win: +win.toFixed(2),
        clusters: clusters.map(c => ({ sym: c.sym, cells: c.cells.slice(), pay: +c.pay.toFixed(4) }))
      });

      const removed = new Set();
      for (const cl of clusters) for (const i of cl.cells) removed.add(i);
      log('Symbole entfernt: ' + removed.size);
      if (trace) steps.push({ type: 'remove', cells: Array.from(removed) });

      grid = AvalancheEngine.collapse(grid, removed, cols, rows, this.gridEngine, ctxTumble);
      tumbles++;
      const sc = ScatterEngine.count(grid);
      if (sc > scatterMax) scatterMax = sc;
      log('Symbole fallen, neue Symbole erzeugt — Tumble ' + tumbles);
      if (trace) steps.push({ type: 'cascade', tumble: tumbles, grid: snap(grid) });
      if (tumbles > 80) break;
    }
    log('Tumble-Sequenz beendet nach ' + tumbles + ' Avalanches');

    const orbs = MultiplierEngine.present(grid);
    const orbSum = MultiplierEngine.sum(orbs);
    if (orbs.length) log('Multiplikatoren gefunden: ' + orbs.map(o => o.value + 'x').join(' + ') + ' = ' + orbSum + 'x');

    let appliedMultiplier, newGlobal = opts.globalMultiplier || 0;
    if (mode === 'free') {
      newGlobal = (opts.globalMultiplier || 0) + orbSum;
      appliedMultiplier = newGlobal > 0 ? newGlobal : 1;
      log('Globaler Freispiel-Multiplikator: ' + (opts.globalMultiplier || 0) + 'x + ' + orbSum + 'x = ' + newGlobal + 'x');
    } else {
      appliedMultiplier = orbSum > 0 ? orbSum : 1;
      log('Sequenz-Multiplikator (Base Game): ' + appliedMultiplier + 'x — wird nach der Sequenz zurueckgesetzt');
    }
    if (trace && orbs.length) {
      steps.push({ type: 'collect', values: orbs.map(o => o.value), cells: orbs.map(o => o.index), sum: orbSum, total: mode === 'free' ? newGlobal : orbSum });
    }

    const raw = WinCalculator.applyMultiplier(sequenceWin, appliedMultiplier);
    const capped = WinCalculator.cap(raw, bet, m.maxWinMultiplier);
    log('Theoretischer Gewinn: ' + raw.toFixed(2) + ' | Max-Win-Cap: ' + (bet * m.maxWinMultiplier).toFixed(2));
    if (capped.capped) log('MAX WIN CAP GREIFT — begrenzt auf ' + capped.win.toFixed(2));
    log('Auszahlung abgeschlossen: ' + capped.win.toFixed(2));
    if (trace) steps.push({ type: 'total', win: capped.win, raw, capped: capped.capped, multiplier: appliedMultiplier });

    return {
      mode, bet, steps, history,
      finalGrid: grid,
      sequenceWin: +sequenceWin.toFixed(6),
      multipliers: orbs.map(o => o.value),
      multiplierSum: orbSum,
      appliedMultiplier,
      globalMultiplier: newGlobal,
      rawWin: raw,
      totalWin: capped.win,
      capped: capped.capped,
      scatters: scatterMax,
      tumbles, clusterSizes
    };
  }
}

/* --- FreeSpinsRound --------------------------------------------------------
   Haelt den GLOBALEN Multiplikator ueber die gesamte Runde. Kein Reset
   zwischen einzelnen Freispielen.                                            */
export class FreeSpinsRound {
  constructor(engine, opts) {
    this.engine = engine;
    this.bet = opts.bet;
    this.superMode = !!opts.superMode;
    this.total = opts.spins;
    this.remaining = opts.spins;
    this.played = 0;
    this.globalMultiplier = 0;
    this.roundWin = 0;
    this.retriggers = 0;
    this.capped = false;
    this.floor = this.superMode ? (engine.math.superFreeSpins.multiplierFloor || null) : (opts.multiplierFloor || null);
  }
  get finished() { return this.remaining <= 0 || this.capped; }

  nextSpin(trace) {
    if (this.finished) return null;
    this.remaining--; this.played++;
    const res = this.engine.spin({
      bet: this.bet, mode: 'free', trace: trace !== false,
      multiplierFloor: this.floor,
      globalMultiplier: this.globalMultiplier
    });
    this.globalMultiplier = res.globalMultiplier;

    const award = retriggerSpinsForScatters(this.engine.math, res.scatters);
    res.retriggerSpins = award;
    if (award > 0) { this.remaining += award; this.total += award; this.retriggers++; }

    const max = this.bet * this.engine.math.maxWinMultiplier;
    this.roundWin += res.totalWin;
    if (this.roundWin >= max) {
      const over = this.roundWin - max;
      if (over > 0) res.totalWin = +(res.totalWin - over).toFixed(6);
      this.roundWin = max; this.capped = true; res.capped = true; this.remaining = 0;
    }
    res.roundWin = this.roundWin;
    res.remaining = this.remaining;
    res.totalSpins = this.total;
    return res;
  }
}

/* --- SimulationEngine ----------------------------------------------------- */
export class SimulationEngine {
  constructor(engine) { this.engine = engine; this.cancelled = false; }
  cancel() { this.cancelled = true; }

  async run(spins, opts, onProgress) {
    const o = opts || {};
    const bet = o.bet || 1;
    const math = this.engine.math;
    const ante = math.anteBetParameters[o.ante || 'none'];
    const chunk = o.chunk || 25000;
    /* ungedrosselter Yield — setTimeout wird in versteckten Tabs auf 1x/Minute gebremst */
    const yieldToUI = () => new Promise(r => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => { ch.port1.close(); r(); };
      ch.port2.postMessage(0);
    });
    this.cancelled = false;

    const st = {
      spins: 0, totalBet: 0, totalWin: 0, rtp: 0,
      freeSpinsPlayed: 0, triggers: 0, retriggers: 0,
      baseWin: 0, freeWin: 0, baseSpins: 0,
      maxWin: 0, maxWinX: 0, maxWinHits: 0,
      over: { 10: 0, 50: 0, 100: 0, 500: 0, 1000: 0, 5000: 0 },
      multiplierCount: 0, multiplierTotal: 0, multiplierHist: {},
      tumbles: 0, clusterCount: 0, clusterCells: 0,
      winningSpins: 0
    };
    const cost = bet * ante.costMultiplier;
    const bump = (v) => { for (const k of [10, 50, 100, 500, 1000, 5000]) if (v >= k * bet) st.over[k]++; };
    const track = (res) => {
      st.tumbles += res.tumbles;
      st.clusterCount += res.clusterSizes.length;
      for (const s of res.clusterSizes) st.clusterCells += s;
      for (const v of res.multipliers) {
        st.multiplierCount++; st.multiplierTotal += v;
        st.multiplierHist[v] = (st.multiplierHist[v] || 0) + 1;
      }
    };

    let done = 0;
    while (done < spins && !this.cancelled) {
      const end = Math.min(spins, done + chunk);
      for (; done < end; done++) {
        st.spins++; st.baseSpins++; st.totalBet += cost;
        const res = this.engine.spin({
          bet, mode: 'base', trace: false,
          anteFactor: ante.scatterFactor,
          multiplierFloor: ante.multiplierFloor
        });
        track(res);
        let roundWin = res.totalWin;
        st.baseWin += res.totalWin;

        const fsAward = freeSpinsForScatters(math, res.scatters);
        if (fsAward > 0) {
          st.triggers++;
          const round = new FreeSpinsRound(this.engine, { bet, spins: fsAward, superMode: false, multiplierFloor: ante.multiplierFloor });
          while (!round.finished) {
            const fr = round.nextSpin(false);
            if (!fr) break;
            st.freeSpinsPlayed++;
            st.freeWin += fr.totalWin;
            track(fr);
            if (fr.retriggerSpins > 0) st.retriggers++;
          }
          roundWin += round.roundWin;
        }
        const maxRound = bet * math.maxWinMultiplier;
        if (roundWin > maxRound) roundWin = maxRound;
        if (roundWin >= maxRound) st.maxWinHits++;
        st.totalWin += roundWin;
        if (roundWin > 0) st.winningSpins++;
        if (roundWin > st.maxWin) st.maxWin = roundWin;
        bump(roundWin);
      }
      st.rtp = st.totalBet > 0 ? st.totalWin / st.totalBet : 0;
      if (onProgress) onProgress(done / spins, st);
      await yieldToUI();
    }

    st.rtp = st.totalBet > 0 ? st.totalWin / st.totalBet : 0;
    st.maxWinX = st.maxWin / bet;
    st.triggerFrequency = st.triggers > 0 ? st.baseSpins / st.triggers : 0;
    st.avgFreeSpinsPerTrigger = st.triggers > 0 ? st.freeSpinsPlayed / st.triggers : 0;
    st.avgMultiplier = st.multiplierCount > 0 ? st.multiplierTotal / st.multiplierCount : 0;
    st.avgBaseWin = st.baseSpins > 0 ? st.baseWin / st.baseSpins : 0;
    st.avgFreeWin = st.freeSpinsPlayed > 0 ? st.freeWin / st.freeSpinsPlayed : 0;
    st.avgTumbles = st.spins > 0 ? st.tumbles / (st.spins + st.freeSpinsPlayed) : 0;
    st.avgClusterSize = st.clusterCount > 0 ? st.clusterCells / st.clusterCount : 0;
    st.hitRate = st.spins > 0 ? st.winningSpins / st.spins : 0;
    st.cancelled = this.cancelled;
    return st;
  }
}

export { payoutFor, freeSpinsForScatters, retriggerSpinsForScatters };
