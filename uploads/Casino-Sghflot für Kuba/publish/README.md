# KUBA'S GAINZ LAB — 7×7 Cluster Slot

Spielbarer Prototyp eines 7×7-Cluster-Pays-Slots mit Tumble-Mechanik,
addierenden Multiplikatoren, Freispielen mit globalem Multiplikator,
Bonus Buys, Ante Bets und Super Spins.

**Kein Echtgeld. Demo-Prototyp. 18+.**

## Starten

Alles ist statisch — einfach `index.html` über einen Webserver öffnen:

```bash
python3 -m http.server 8080
# http://localhost:8080
```

(Direkt per `file://` funktioniert nicht, weil die Engine als ES-Modul geladen wird.)

## GitHub Pages

1. Diese Dateien in den Repo-Root pushen (`index.html` muss oben liegen).
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**
3. Branch `main`, Ordner `/ (root)` → Save.
4. Nach ein paar Minuten läuft der Slot unter
   `https://onlock009.github.io/Kuba-Slot/`

## Struktur

| Datei | Zweck |
| --- | --- |
| `index.html` | UI, Animationen, Debug-Panel, Simulator, Test-Runner |
| `gameMath.js` | Komplette Mathematik-Konfiguration (Target Math + Demo Math) |
| `engine.js` | RNG, ClusterDetector, AvalancheEngine, MultiplierEngine, ScatterEngine, WinCalculator, GameEngine, FreeSpinsRound, SimulationEngine |
| `tests.js` | 33 automatisierte Mechanik-Tests |
| `support.js` | Runtime für die Komponente |
| `symbols/` | Symbol-Grafiken |
| `audio/` | Hintergrund-Loop (`kuba-loop.mp3`), Multi-Knall (`boom.mp3`), Freispiel-Jingle (`freespins.mp3`) |

## Mathematik

`gameMath.js` enthält zwei Presets:

* **TARGET MATH** — auf RTP 96,55 % kalibriert (Monte-Carlo, 260k Spins).
  Hit Rate ~22 %, Freispiel-Trigger ~1/137, Ante 1 ~1/52, Max Win 10.000×.
* **DEMO MATH** — bewusst großzügiger für Streams/Vorführungen.
  **Ausdrücklich keine echten Wahrscheinlichkeiten eines kommerziellen Spiels.**

Öffentlich dokumentierte Strukturwerte (7×7, Cluster ab 5, Multiplikatorwerte
2×–500×, Scatter 4/5/6/7 → 15/20/25/30, Bonus Buy 100×, Super Buy 500×,
Ante 2×, Super Spins 10×/250×, Max Win 10.000×) sind exakt umgesetzt.

Alles, was **nicht** öffentlich dokumentiert ist — Symbolgewichte,
Auszahlungstabelle, Multiplikator-Gewichte, Scatter-Raten, Buy-Verteilungen —
ist im Code mit `UNKNOWN_PUBLIC_PROBABILITY` markiert und frei editierbar.
Diese Werte sind Projektparameter, keine Angaben eines Herstellers.

## Simulator & Tests

Rechte Konsole im Spiel:

* **SIM** — 100k / 1 Mio / 10 Mio Spins headless, zeigt RTP, Hit Rate,
  Trigger-Frequenz, Multiplikator-Histogramm, Max-Win-Treffer.
* **TESTS** — 33 Tests zu Cluster-Erkennung, Avalanche, Multiplikator-Addition,
  Scatter-Tabelle, Retrigger, Buys, Garantien und Max-Win-Cap.
* **DEBUG** — Grid, gefundene Cluster, Auszahlungen, angewendeter Multiplikator,
  theoretischer vs. tatsächlicher Gewinn, komplette Spin-Historie.
