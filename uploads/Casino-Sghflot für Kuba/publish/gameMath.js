/* =============================================================================
   KUBA'S GAINZ LAB — MathConfig
   -----------------------------------------------------------------------------
   QUELLENLAGE / EHRLICHKEITSHINWEIS
   Pragmatic Play veroeffentlicht fuer "Fortune of Olympus" KEINE vollstaendigen
   mathematischen Daten. Oeffentlich dokumentiert (und hier exakt umgesetzt) sind:
     - 7x7 Raster, 49 Positionen, keine Paylines, Cluster Pays
     - Cluster ab 5 identischen Symbolen, nur horizontal/vertikal verbunden
     - Avalanche / Tumble bis kein Cluster mehr vorhanden ist
     - Multiplikatorwerte 2,3,4,5,6,8,10,12,15,20,25,50,100,250,500
     - Multiplikatoren werden ADDIERT, nicht multipliziert
     - Scatter 4/5/6/7  ->  15/20/25/30 Freispiele (auch beim Retrigger)
     - Bonus Buy 100x Einsatz, Super Bonus Buy 500x Einsatz
     - Ante Bet 1: 2x Einsatz, 5-fach erhoehte Free-Spins-Chance
     - Super Spin 1: 10x Einsatz, mind. 1 garantierter Multiplikator
     - Super Spin 2: 250x Einsatz, garantierter Multiplikator >= 50x
     - Max Win 10.000x Einsatz
     - hoechster ausgewiesener RTP 96,55 %

   ALLES, was unten mit UNKNOWN markiert ist, ist NICHT oeffentlich bekannt.
   Diese Werte sind frei gewaehlte Projektparameter und duerfen NICHT als
   offizielle Fortune-of-Olympus-Wahrscheinlichkeiten dargestellt werden.
   ========================================================================== */

export const UNKNOWN = 'UNKNOWN_PUBLIC_PROBABILITY';

/* --- Symbole (eigenes Thema, keine fremden Assets) ------------------------ */
export const SYMBOLS = [
  { id: 'a',        name: 'ASS',      tier: 'low',  color: '#f5c542', img: 'sym_a' },
  { id: 'j',        name: 'BUBE',     tier: 'low',  color: '#31c257', img: 'sym_j' },
  { id: 'q',        name: 'DAME',     tier: 'low',  color: '#a855f7', img: 'sym_q' },
  { id: 'k',        name: 'KÖNIG',    tier: 'low',  color: '#9fb4ce', img: 'sym_k' },
  { id: 'pills',    name: 'BLUE PILLS', tier: 'mid', color: '#35b6ff', img: 'sym_pills' },
  { id: 'dumbbell', name: 'HANTEL',   tier: 'mid',  color: '#c8d4e4', img: 'sym_dumbbell' },
  { id: 'whey',     name: 'CASH',     tier: 'mid',  color: '#c9a2ff', img: 'sym_whey' },
  { id: 'peptid',   name: 'SPRITZE',  tier: 'high', color: '#cfe4f5', img: 'sym_peptid' },
  { id: 'testo',    name: 'TESTO',    tier: 'high', color: '#e8eef6', img: 'sym_testo' },
  { id: 'tanga',    name: 'TANGA',    tier: 'high', color: '#ff2e4d', img: 'sym_tanga' }
];
export const SYMBOL_IDS = SYMBOLS.map(s => s.id);
/* Bildsymbole = alles ausser den Kartenwerten. Wird fuer den Bild-Boost der
   Super Spins gebraucht. */
export const PICTURE_IDS = SYMBOLS.filter(s => s.tier !== 'low').map(s => s.id);

/* --- Auszahlungskurve ------------------------------------------------------
   PAY ANYWHERE: gezahlt wird nach ANZAHL gleicher Symbole auf dem Raster,
   Verbindung spielt keine Rolle. UNKNOWN: die echte Paytable.
   Kurve hier = Projektparameter, Auszahlung in Einsaetzen (x Bet). */
function payCurve(base) {
  return [
    { min: 9,  pay: +(base * 1).toFixed(4) },
    { min: 10, pay: +(base * 1.45).toFixed(4) },
    { min: 11, pay: +(base * 2.1).toFixed(4) },
    { min: 12, pay: +(base * 3).toFixed(4) },
    { min: 14, pay: +(base * 5.2).toFixed(4) },
    { min: 16, pay: +(base * 8.6).toFixed(4) },
    { min: 18, pay: +(base * 14).toFixed(4) },
    { min: 21, pay: +(base * 28).toFixed(4) },
    { min: 25, pay: +(base * 66).toFixed(4) },
    { min: 30, pay: +(base * 170).toFixed(4) }
  ];
}

/* Reihenfolge = Wertigkeit. UNKNOWN. */
/* PAY ANYWHERE ab 9 gleichen. Auf RTP 96,55 % kalibriert — Monte-Carlo mit
   500.000 Spins (Target Math, Ante aus): 97,744 % vor der Korrektur, Faktor
   0,98779 angewendet. Hit Rate ~47,8 %, Trigger ~1/107, Freispielanteil ~58 %.
   KURVENFORM = UNKNOWN_PUBLIC_PROBABILITY. */
const CLUSTER_BASE = {
  a: 0.02065, j: 0.02519, q: 0.02914, k: 0.03556,
  pills: 0.05463, dumbbell: 0.07142, whey: 0.09226,
  peptid: 0.16793, testo: 0.31471, tanga: 0.67180
};

function buildPayouts(scale) {
  const s = scale || 1;
  const out = {};
  for (const id of SYMBOL_IDS) out[id] = payCurve(CLUSTER_BASE[id] * s);
  return out;
}

/* --- Multiplikatorwerte: DOKUMENTIERT ------------------------------------- */
export const MULTIPLIER_VALUES = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 50, 100, 250, 500];

/* Gewichte dazu: UNKNOWN. Hohe Volatilitaet -> starkes Uebergewicht auf kleinen
   Werten; 100x/250x/500x sind ausgesprochene Seltenheiten. */
const MULTIPLIER_WEIGHTS_TARGET = [4200, 2900, 1800, 1150, 720, 430, 250, 140, 80, 42, 22, 6, 1.4, 0.22, 0.05];

/* --- Freispiel-Vergabe: DOKUMENTIERT -------------------------------------- */
export const FREE_SPIN_AWARDS = { 4: 15, 5: 20, 6: 25, 7: 30 };
/* Retrigger identisch dokumentiert */
export const RETRIGGER_AWARDS = { 4: 15, 5: 20, 6: 25, 7: 30 };

function baseConfig() {
  return {
    id: 'target',
    label: 'TARGET MATH',
    isDemo: false,

    /* DOKUMENTIERT */
    rtpTarget: 0.9655,
    maxWinMultiplier: 10000,
    /* DOKUMENTIERT: 7x7. Gewinnregel hier: PAY ANYWHERE ab 9 gleichen
       Symbolen irgendwo auf dem Raster — keine Verbindung noetig.
       minCluster bleibt als Parameter fuer den alternativen Cluster-Modus. */
    grid: { cols: 7, rows: 7, winMode: 'anywhere', minMatch: 9, minCluster: 5, diagonalCounts: false },
    volatility: 'hoch',

    symbols: SYMBOL_IDS.slice(),
    pictureSymbols: PICTURE_IDS.slice(),

    /* UNKNOWN — Symbolgewichte. Bildsymbole dominieren das Raster (rund zwei
       Drittel), die Kartenwerte sind nur noch Fueller. Konzentration bleibt
       aehnlich, damit Cluster gleich haeufig entstehen. */
    symbolWeights: {
      pills: 118, dumbbell: 114, whey: 110, peptid: 100, testo: 88, tanga: 74,
      a: 106, j: 100, q: 94, k: 88
    },

    /* UNKNOWN — Cluster-Auszahlungstabelle (x Einsatz) */
    clusterPayouts: buildPayouts(),

    /* DOKUMENTIERT */
    multiplierValues: MULTIPLIER_VALUES.slice(),
    /* UNKNOWN — Gewichte der Multiplikatorwerte */
    multiplierWeights: MULTIPLIER_WEIGHTS_TARGET.slice(),

    /* UNKNOWN — Erscheinungswahrscheinlichkeit pro neuer Zelle.
       Multiplikatoren sind bewusst selten: im Base Game landet im Schnitt
       nur auf jedem ca. 5. Spin ueberhaupt einer auf dem Raster. */
    multiplierChance: { base: 0.0042, tumble: 0.0042, freeSpins: 0.011 },

    /* UNKNOWN — Scatterwahrscheinlichkeit pro neuer Zelle.
       scatterWeights bleibt als alternative Gewichtungsform erhalten. */
    scatterChance: { base: 0.0155, tumble: 0.0055, freeSpins: 0.0075 },
    /* Umrechnung des dokumentierten Ante-Faktors (5x Trigger-Chance) auf die
       Scatter-Rate pro Zelle. UNKNOWN, wie Pragmatic das intern loest.
       Hier so gesetzt, dass Ante-Bet-RTP ~ Basis-RTP bleibt: bei 2x Einsatz
       kann die Trigger-Rate nicht wirklich 5x sein, ohne den RTP zu sprengen. */
    anteScatterExponent: 0.18,
    scatterWeights: { present: 1, absent: 63.5, note: UNKNOWN },
    baseGameScatterChance: 0.0155,
    freeSpinScatterWeights: { present: 1, absent: 132, note: UNKNOWN },
    retriggerWeights: { note: UNKNOWN },

    /* DOKUMENTIERT: 4..7 Scatter -> 15/20/25/30 */
    freeSpinAwards: Object.assign({}, FREE_SPIN_AWARDS),
    retriggerAwards: Object.assign({}, RETRIGGER_AWARDS),
    minScattersToTrigger: 4,
    minScattersToRetrigger: 4,

    /* DOKUMENTIERT: Kosten. UNKNOWN: interne Trigger-Verteilung des Buys. */
    bonusBuyParameters: {
      normal: { costMultiplier: 100, superMode: false, scatterDistribution: { 4: 74, 5: 19, 6: 5.5, 7: 1.5 }, note: UNKNOWN },
      super:  { costMultiplier: 500, superMode: true,  scatterDistribution: { 4: 70, 5: 21, 6: 7,   7: 2   }, note: UNKNOWN }
    },

    /* DOKUMENTIERT: Kosten + Garantien. UNKNOWN: Verteilung des Garantiewertes
       und der Bild-Boost (pictureBoost gewichtet Bildsymbole hoch, damit sich
       der Aufpreis auch im Bild sichtbar lohnt). */
    specialSpinParameters: {
      superSpin1: { costMultiplier: 10,  guaranteedMultipliers: 1, minMultiplier: null, pictureBoost: 1.45 },
      superSpin2: { costMultiplier: 250, guaranteedMultipliers: 1, minMultiplier: 50, pictureBoost: 2.10 }
    },

    /* Ante 1: DOKUMENTIERT 2x Einsatz + 5-fache Trigger-Chance.
       Ante 2: Preis in Quellen nicht eindeutig -> Konfigurationswert (ca. 7x). */
    anteBetParameters: {
      none:  { key: 'none',  label: 'AUS',    costMultiplier: 1, scatterFactor: 1, multiplierFloor: null },
      ante1: { key: 'ante1', label: 'ANTE 1', costMultiplier: 2, scatterFactor: 5, multiplierFloor: null },
      ante2: { key: 'ante2', label: 'ANTE 2', costMultiplier: 7, scatterFactor: 5, multiplierFloor: 5, costNote: UNKNOWN }
    },

    /* DOKUMENTIERT: Super Free Spins -> Multiplikator-Floor 5x */
    superFreeSpins: { multiplierFloor: 5 },

    betLevels: [0.2, 0.4, 0.6, 1, 2, 4, 6, 10, 20, 50, 100],

    unknownFields: [
      'symbolWeights', 'clusterPayouts', 'multiplierWeights',
      'multiplierChance', 'scatterChance', 'scatterWeights',
      'freeSpinScatterWeights', 'retriggerWeights',
      'bonusBuyParameters.*.scatterDistribution', 'anteBetParameters.ante2.costMultiplier'
    ]
  };
}

export const TARGET_MATH = baseConfig();

/* --- DEMO MATH -------------------------------------------------------------
   Vorfuehr-Mathematik: Features kommen HAEUFIGER (Trigger ~1/46 statt ~1/107,
   mehr Multiplikatoren), damit sich im Stream alles zeigen laesst. Der RTP ist
   aber ebenfalls auf 96,55 % kalibriert — die Auszahlungen pro Treffer sind
   dafuer kleiner. AUSDRUECKLICH KEINE Fortune-of-Olympus-Wahrscheinlichkeiten. */
export const DEMO_MATH = (() => {
  const m = baseConfig();
  m.id = 'demo';
  m.label = 'DEMO MATH';
  m.isDemo = true;
  m.rtpTarget = 0.9655;
  m.multiplierChance = { base: 0.0058, tumble: 0.0055, freeSpins: 0.0105 };
  m.scatterChance = { base: 0.0205, tumble: 0.0058, freeSpins: 0.0068 };
  m.baseGameScatterChance = 0.0205;
  m.multiplierWeights = [3900, 2700, 1720, 1120, 740, 470, 285, 168, 100, 55, 30, 9, 2.2, 0.4, 0.09];
  m.symbolWeights = { pills: 120, dumbbell: 116, whey: 112, peptid: 100, testo: 86, tanga: 70, a: 106, j: 100, q: 94, k: 86 };
  /* Demo triggert oefter und wirft mehr Multiplikatoren — damit der RTP trotzdem
     bei 96,55 % landet, ist die Auszahlungstabelle entsprechend herunterskaliert.
     Faktor per Monte-Carlo bestimmt. */
  m.demoPayoutScale = 0.5046;
  m.clusterPayouts = buildPayouts(m.demoPayoutScale);
  return m;
})();

export const MATH_PRESETS = { target: TARGET_MATH, demo: DEMO_MATH };

export function clonePreset(id) {
  return JSON.parse(JSON.stringify(MATH_PRESETS[id] || TARGET_MATH));
}

export function payoutFor(math, symbolId, clusterSize) {
  const table = math.clusterPayouts[symbolId];
  if (!table) return 0;
  let pay = 0;
  for (const row of table) if (clusterSize >= row.min) pay = row.pay;
  return pay;
}

export function freeSpinsForScatters(math, count) {
  const c = Math.min(7, count);
  if (c < math.minScattersToTrigger) return 0;
  return math.freeSpinAwards[c] || 0;
}

export function retriggerSpinsForScatters(math, count) {
  const c = Math.min(7, count);
  if (c < math.minScattersToRetrigger) return 0;
  return math.retriggerAwards[c] || 0;
}
