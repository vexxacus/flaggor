// main.js
// Enkel "single page"-växling mellan de tre spellägena på index.html.
// Ingen bundler krävs - allt körs som native ES-moduler direkt i webbläsaren.
//
// UX-fix (feedback): innan visades alltid hela "Välj ett spelläge"-sektionen
// (rubrik + fyra stora kort) ovanför spelytan, vilket tryckte ner själva
// frågan under skärmens nedre kant. Nu döljs den sektionen så fort ett
// spelläge har startats, och spellägena blir istället kompakta länkar i
// headern - så att frågan alltid hamnar "above the fold".

import { loadCountries, byRegion } from "./countries-data.js";
import { initFlagGame } from "./game-flags.js";
import { initCapitalGame } from "./game-capitals.js";
import { initMapGame } from "./game-map.js";
import { registerPlayToday } from "./local-highscores.js";

const gameArea = document.getElementById("game-area");
const hub = document.getElementById("hub");
const modeNav = document.getElementById("mode-nav");
const modeButtons = document.querySelectorAll("[data-mode]");
const statusEl = document.getElementById("load-status");
const dailyStreakBadge = document.getElementById("daily-streak-badge");

let allCountries = null;
let activeMode = null;

async function boot() {
  try {
    allCountries = await loadCountries();
    statusEl.textContent = "";
    const dailyStreak = registerPlayToday();
    renderDailyStreakBadge(dailyStreak);
  } catch (e) {
    console.error(e);
    statusEl.textContent =
      "Kunde inte hämta landsdata just nu. Kontrollera internetuppkopplingen och ladda om sidan.";
  }
}

// Den dagliga besöks-streaken (skild från in-round-streaken) samlades redan
// in men syntes aldrig - visar den nu diskret i headern från och med dag 2,
// så den inte känns påträngande vid första besöket.
function renderDailyStreakBadge(streak) {
  if (!streak || streak.current < 2) return;
  // "dagar i rad"-texten döljs på smala skärmar (se style.css) - ikon+antal
  // räcker där, så headern inte blir för trång.
  dailyStreakBadge.innerHTML = `🔥 ${streak.current} <span>dagar i rad</span>`;
  dailyStreakBadge.hidden = false;
}

function setActiveMode(mode) {
  activeMode = mode;

  // Dölj den stora "Välj ett spelläge"-sektionen - spellägena finns nu
  // istället kvar som länkar i headern (mode-nav), som förblir synlig.
  hub.hidden = true;
  modeNav.hidden = false;
  // Används av CSS för att göra headern kompakt på mobil under en runda.
  document.body.classList.add("fq-in-game");

  document.querySelectorAll(".fq-mode-nav-link").forEach((btn) => {
    btn.classList.toggle("fq-mode-nav-link--active", btn.dataset.mode === mode);
    btn.setAttribute("aria-current", btn.dataset.mode === mode ? "page" : "false");
  });
}

function startMode(mode) {
  if (!allCountries) return;
  setActiveMode(mode);
  window.scrollTo({ top: 0, behavior: "smooth" });
  const pool = byRegion(allCountries, "alla");

  if (mode === "flags") initFlagGame(gameArea, pool);
  else if (mode === "capitals") initCapitalGame(gameArea, pool);
  else if (mode === "map") initMapGame(gameArea, pool);
  else if (mode === "mystery") {
    gameArea.innerHTML = `
      <div class="fq-coming-soon">
        <h2>Dagens mysterieland</h2>
        <p>Kommer snart! Varje dag får alla samma land att lösa med så få
        ledtrådar som möjligt.</p>
      </div>`;
  }
}

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.disabled) return; // "Snart"-läget är inte spelbart än
    startMode(btn.dataset.mode);
  });
});

boot();
