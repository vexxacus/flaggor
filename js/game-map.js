// game-map.js
// Spelläge 3: Peka ut var på världskartan ett land ligger.
//
// v2 (bugg-fix + ombyggnad): den gamla varianten krävde en bundlad GeoJSON-fil
// med landgränser (public/data/world-countries.geo.json) som aldrig faktiskt
// bundlades - spelläget visade bara "Kartdata saknas" för alla besökare.
// Istället för att jaga en ~250 kB gränsfil är mekaniken nu ett "peka var du
// tror"-spel (GeoGuessr-stil): du klickar var som helst på kartan, och
// spelet räknar ut vilket lands mittpunkt klicket ligger närmast. Ingen
// extern gränsdata behövs, och "hur nära räknas som rätt" blir
// självförklarande - närmaste land vinner.
//
// Känd begränsning: eftersom vi bara har en ungefärlig mittpunkt per land
// (inte den riktiga geografiska formen) blir mycket små länder som ligger
// nära ett stort grannland svårare att "vinna" mot grannen - det är en
// medveten avvägning för att slippa en tung extern datakälla.
//
// Två spellägen istället för regionval: "Gissa land" (vi visar ett land, du
// pekar ut var det ligger) och "Gissa huvudstad" (vi visar en huvudstad, du
// pekar ut landet den hör till). Mekaniken är densamma - placera nålen i rätt
// land (närmast landmittpunkt vinner) och bekräfta placeringen.

import { sampleCountries } from "./countries-data.js";
import {
  renderProgress,
  renderTallyBar,
  showFeedback,
  showRoundSummary,
  pickEncouragement,
} from "./ui.js";
import { submitStreak } from "./local-highscores.js";

const ROUND_LENGTH = 10;
const WORLD_VIEW = { center: [20, 0], zoom: 2 };

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Avstånd i km mellan två [lat, lng]-punkter (haversine).
function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Hittar vilket lands mittpunkt en klickad koordinat ligger närmast.
function nearestCountry(clickLatLng, countries) {
  let best = null;
  let bestDist = Infinity;
  for (const c of countries) {
    if (!c.latlng || c.latlng.length !== 2) continue;
    const d = haversineKm(clickLatLng, c.latlng);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return { country: best, distanceKm: bestDist };
}

export function initMapGame(container, allCountries) {
  if (typeof L === "undefined") {
    container.innerHTML = `<p class="fq-error">Leaflet kunde inte laddas. Kontrollera internetuppkopplingen.</p>`;
    return;
  }
  renderModeSelect(container, allCountries);
}

// Kartspelet har inget regionval - istället väljer man vad man ska peka ut:
// själva landet, eller det land vars huvudstad visas. Mekaniken är densamma
// (placera nål i rätt land), men huvudstadsläget testar om man vet vilket land
// en huvudstad hör till - och ungefär var det ligger.
const MAP_MODES = [
  { key: "country", label: "🗺️ Gissa land", hint: "Vi visar ett land - peka ut var det ligger." },
  { key: "capital", label: "🏙️ Gissa huvudstad", hint: "Vi visar en huvudstad - peka ut landet den ligger i." },
];

function renderModeSelect(container, allCountries) {
  container.innerHTML = `
    <div class="fq-region-select">
      <h2>Vad vill du gissa?</h2>
      <div class="fq-region-grid">
        ${MAP_MODES.map(
          (m) => `<button type="button" class="fq-region-card" data-key="${m.key}">
            <span class="fq-map-mode-label">${m.label}</span>
            <span class="fq-map-mode-hint">${m.hint}</span>
          </button>`
        ).join("")}
      </div>
    </div>
  `;
  container.querySelectorAll(".fq-region-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = MAP_MODES.find((m) => m.key === btn.dataset.key);
      // Alla länder med giltig position; huvudstadsläget kräver dessutom ett
      // huvudstadsnamn att fråga efter.
      const pool = allCountries.filter(
        (c) => c.latlng && c.latlng.length === 2 && (mode.key === "country" || c.capital)
      );
      if (pool.length < 1) {
        alert("Ingen data att spela med - försök igen senare.");
        return;
      }
      startRound(container, allCountries, pool, mode);
    });
  });
}

function startRound(container, allCountries, pool, mode) {
  const state = {
    pool,
    mode,
    questions: sampleCountries(pool, Math.min(ROUND_LENGTH, pool.length)),
    index: 0,
    bestStreak: 0,
    streak: 0,
    correctCount: 0,
    locked: false,
  };

  container.innerHTML = '<div class="fq-map-wrap"><div class="fq-map"></div></div>';
  renderProgress(container, state.index, state.questions.length);
  renderTallyBar(container, { correctCount: state.correctCount, totalAnswered: state.index, combo: state.streak });

  const mapEl = container.querySelector(".fq-map");
  const map = L.map(mapEl, { worldCopyJump: true }).setView(WORLD_VIEW.center, WORLD_VIEW.zoom);
  // Etikettfritt kartlager (CartoDB "light_nolabels"): OSM-standardrutorna visar
  // alla landsnamn när man zoomar in, vilket gör att man kan "fuska" genom att
  // läsa etiketterna istället för att kunna geografin. Med ett namnlöst underlag
  // förblir spelet ett "peka var du tror"-spel där närmast vinner.
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap-bidragsgivare &copy; CARTO',
    subdomains: "abcd",
    maxZoom: 8,
  }).addTo(map);

  const markers = L.layerGroup().addTo(map);

  function askQuestion() {
    if (state.index >= state.questions.length) {
      submitStreak("map", state.bestStreak, { mode: state.mode.label });
      showRoundSummary(container, {
        bestStreak: state.bestStreak,
        correctCount: state.correctCount,
        total: state.questions.length,
        onReplay: () => startRound(container, allCountries, state.pool, state.mode),
        onChangeRegion: () => renderModeSelect(container, allCountries),
        changeRegionLabel: "Byt spelläge",
      });
      return;
    }

    state.locked = false;
    state.pendingLatLng = null;
    if (state.pinMarker) {
      map.removeLayer(state.pinMarker);
      state.pinMarker = null;
    }
    markers.clearLayers();
    map.flyTo(WORLD_VIEW.center, WORLD_VIEW.zoom, { duration: 0.5 });

    const answer = state.questions[state.index];
    let prompt = container.querySelector(".fq-map-prompt");
    if (!prompt) {
      prompt = document.createElement("div");
      prompt.className = "fq-map-prompt";
      container.querySelector(".fq-map-wrap").prepend(prompt);
    }
    const promptText =
      state.mode.key === "capital"
        ? `Tryck i landet vars huvudstad är <strong>${answer.capital}</strong>`
        : `Tryck där du tror att <strong>${answer.nameSv}</strong> ligger`;
    prompt.innerHTML = `
      <span class="fq-map-prompt-text">${promptText}</span>
      <button type="button" class="fq-map-confirm-btn" disabled>Bekräfta placering</button>
    `;
    prompt.querySelector(".fq-map-confirm-btn").addEventListener("click", confirmPlacement);
  }

  // Steg 1: klick placerar (eller flyttar) en kartnål utan att utvärdera - så
  // man inte råkar svara fel av misstag och kan finjustera innan man bekräftar.
  function handleMapClick(e) {
    if (state.locked) return;
    state.pendingLatLng = [e.latlng.lat, e.latlng.lng];
    if (state.pinMarker) {
      state.pinMarker.setLatLng(state.pendingLatLng);
    } else {
      state.pinMarker = L.marker(state.pendingLatLng, { draggable: true }).addTo(map);
      state.pinMarker.on("dragend", () => {
        const p = state.pinMarker.getLatLng();
        state.pendingLatLng = [p.lat, p.lng];
      });
    }
    const btn = container.querySelector(".fq-map-confirm-btn");
    if (btn) btn.disabled = false;
  }

  // Steg 2: spelaren bekräftar nålens placering, först då utvärderas svaret.
  function confirmPlacement() {
    if (state.locked || !state.pendingLatLng) return;
    const answer = state.questions[state.index];
    const clickLatLng = state.pendingLatLng;
    if (state.pinMarker) {
      map.removeLayer(state.pinMarker);
      state.pinMarker = null;
    }
    const confirmBtn = container.querySelector(".fq-map-confirm-btn");
    if (confirmBtn) confirmBtn.disabled = true;
    const { country: guessed, distanceKm } = nearestCountry(clickLatLng, allCountries);
    const correct = guessed && guessed.cca2 === answer.cca2;

    if (correct) {
      markers.addLayer(
        L.circleMarker(clickLatLng, { radius: 8, color: "#0f7a48", fillColor: "#16a362", fillOpacity: 0.9 })
      );
      registerResult(true, answer, null, 0);
      return;
    }

    // Med det medvetna "placera nål + bekräfta"-flödet utvärderas svaret direkt
    // (ingen tyst "förlåt första felklicket" längre - det kändes som att spelet
    // hoppade utan förklaring och stod kvar på 0/0).
    markers.addLayer(
      L.circleMarker(clickLatLng, { radius: 8, color: "#b7291f", fillColor: "#e1483c", fillOpacity: 0.85 })
    );
    if (answer.latlng && answer.latlng.length === 2) {
      markers.addLayer(
        L.circleMarker(answer.latlng, { radius: 8, color: "#0f7a48", fillColor: "#16a362", fillOpacity: 0.9 })
      );
    }
    registerResult(false, answer, guessed, distanceKm);
  }

  function registerResult(correct, answer, guessedCountry, distanceKm) {
    state.locked = true;
    const hadBigStreak = state.streak >= 5;
    if (correct) {
      state.streak += 1;
      state.correctCount += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
    } else {
      state.streak = 0;
    }

    const totalAnswered = state.index + 1;
    const message = pickEncouragement({
      correct,
      streakAfter: state.streak,
      hadBigStreak: !correct && hadBigStreak,
      correctCount: state.correctCount,
      totalAnswered,
    });
    renderTallyBar(container, { correctCount: state.correctCount, totalAnswered, combo: state.streak });

    const note =
      !correct && guessedCountry
        ? `Din nål hamnade cirka ${Math.round(distanceKm)} km bort - närmast låg ${guessedCountry.nameSv}.`
        : null;

    // Kartan är hög, så feedbacken + Nästa-knappen hamnar annars under fold.
    // Krymp kartan och scrolla in svaret så man ser rätt/fel direkt.
    const mapWrap = container.querySelector(".fq-map-wrap");
    if (mapWrap) mapWrap.classList.add("fq-map-wrap-answered");
    setTimeout(() => map.invalidateSize(), 280);

    showFeedback(container, {
      correct,
      country: answer,
      nearMissCountry: null,
      message,
      note,
      onNext: () => {
        if (mapWrap) mapWrap.classList.remove("fq-map-wrap-answered");
        setTimeout(() => map.invalidateSize(), 280);
        state.index += 1;
        askQuestion();
      },
    });

    // Efter att feedbackpanelen renderats: scrolla in den så rätt/fel-svaret
    // och Nästa-knappen syns utan att man behöver skrolla manuellt.
    const feedback = container.querySelector(".fq-feedback");
    if (feedback) {
      requestAnimationFrame(() => feedback.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    }
  }

  map.on("click", handleMapClick);

  askQuestion();
}
