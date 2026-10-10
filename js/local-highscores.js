// local-highscores.js
// Highscore = bästa antal rätt i rad (streak) under en rond - inte poäng.
// Vi tog bort poängsystemet eftersom det kändes dubbelt upp med streak-
// mekaniken (se spelkoncept.md). "bestStreak" här ska inte blandas ihop med
// den dagliga inloggnings-streaken i getStreak()/registerPlayToday() nedan -
// det är två olika saker som råkar heta snarlikt.
//
// v1: highscores lagras i localStorage per läge. När Firestore kopplas in (v2),
// byt bara ut dessa tre funktioner mot motsvarande Firestore-anrop -
// resten av koden (main.js) behöver inte ändras.

const KEY = "flagquiz_highscores_v1";
const MAX_PER_MODE = 10;

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch (e) {
    return {};
  }
}

export function getHighscores(mode) {
  const all = readAll();
  return (all[mode] || []).sort((a, b) => b.bestStreak - a.bestStreak).slice(0, MAX_PER_MODE);
}

export function submitStreak(mode, bestStreak, meta = {}) {
  const all = readAll();
  if (!all[mode]) all[mode] = [];
  all[mode].push({ bestStreak, date: new Date().toISOString(), ...meta });
  all[mode] = all[mode].sort((a, b) => b.bestStreak - a.bestStreak).slice(0, MAX_PER_MODE);
  localStorage.setItem(KEY, JSON.stringify(all));
  return all[mode];
}

export function getStreak() {
  try {
    return JSON.parse(localStorage.getItem("flagquiz_streak_v1")) || { current: 0, lastPlayed: null };
  } catch (e) {
    return { current: 0, lastPlayed: null };
  }
}

export function registerPlayToday() {
  const streak = getStreak();
  const today = new Date().toISOString().slice(0, 10);
  if (streak.lastPlayed === today) return streak; // redan registrerad idag

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  streak.current = streak.lastPlayed === yesterday ? streak.current + 1 : 1;
  streak.lastPlayed = today;
  localStorage.setItem("flagquiz_streak_v1", JSON.stringify(streak));
  return streak;
}
