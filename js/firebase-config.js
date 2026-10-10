// firebase-config.js
//
// v1-skelettet kräver INTE ett Firebase-projekt för att köras lokalt eller
// hostas (highscores lagras i localStorage tills vidare, se local-highscores.js
// i main.js). När du är redo att koppla in Firestore/Auth (v2, se spelkoncept.md):
//
// 1. Skapa ett projekt på https://console.firebase.google.com
// 2. Lägg till en webbapp och klistra in configet nedan.
// 3. Kör `firebase init hosting` (och `firebase init firestore` för highscores/streaks).
// 4. Avkommentera raderna längst ner och byt ut TODO-värdena.
//
// OBS: importera ALDRIG hemliga API-nycklar här - Firebase web-config är
// publik/klient-sida per design och skyddas istället av firestore.rules.

export const firebaseConfig = {
  apiKey: "TODO",
  authDomain: "TODO.firebaseapp.com",
  projectId: "TODO",
  storageBucket: "TODO.appspot.com",
  messagingSenderId: "TODO",
  appId: "TODO",
};

export let app = null;
export let db = null;

export async function initFirebase() {
  // Avkommentera när du har fyllt i firebaseConfig ovan och lagt till
  // Firebase SDK via CDN i index.html:
  //
  // import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  // import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  // app = initializeApp(firebaseConfig);
  // db = getFirestore(app);
  console.info("Firebase är inte konfigurerat än - kör på localStorage-läge.");
}
