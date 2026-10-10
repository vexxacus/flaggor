// countries-data.js
// Hämtar grunddata (huvudstad, region, ISO-koder, ungefärlig position) från vår
// egen lokalt buntade fil (public/data/countries.json) och slår ihop med vår
// kuraterade trivia.json.
//
// VIKTIGT: detta laddades tidigare live från restcountries.com/v3.1, men den
// tjänsten är nedlagd (kräver numera konto + API-nyckel för v5) - se
// spelkoncept.md för bakgrund. Vi bundlar därför datan lokalt istället, vilket
// dessutom gör spelet snabbare och oberoende av tredje parts drifttider.
// Flaggbilder kommer fortfarande live från FlagCDN (se getFlagUrl), eftersom
// den tjänsten fortfarande är fri och nyckellös.

let _countriesCache = null;
let _triviaCache = null;

/** Bygger en FlagCDN-URL för en given ISO2-kod. Se https://flagcdn.com (kräver ingen nyckel). */
export function getFlagUrl(cca2, width = 320) {
  return `https://flagcdn.com/w${width}/${cca2.toLowerCase()}.png`;
}

async function fetchTrivia() {
  if (_triviaCache) return _triviaCache;
  const res = await fetch("data/trivia.json");
  _triviaCache = await res.json();
  return _triviaCache;
}

/**
 * Laddar och slår ihop all landsdata. Returnerar en array av:
 * { cca2, cca3, nameSv, nameEn, capital, region, subregion, population, latlng, trivia, flagUrl }
 */
export async function loadCountries() {
  if (_countriesCache) return _countriesCache;

  const [base, trivia] = await Promise.all([
    fetch("data/countries.json").then((r) => {
      if (!r.ok) throw new Error("Kunde inte läsa public/data/countries.json");
      return r.json();
    }),
    fetchTrivia(),
  ]);

  _countriesCache = base.map((c) => ({
    ...c,
    flagUrl: getFlagUrl(c.cca2),
    trivia: trivia[c.cca2] || null,
    regionSv: REGION_SV[c.region] || c.region,
    subregionSv: SUBREGION_SV[c.subregion] || c.subregion,
  }));

  return _countriesCache;
}

// Region/subregion kommer på engelska från countries.json (UN-liknande
// geoschema) - översätter till svenska så UI:t inte blandar språk.
const REGION_SV = {
  Africa: "Afrika",
  Americas: "Amerika",
  Asia: "Asien",
  Europe: "Europa",
  Oceania: "Oceanien",
};

const SUBREGION_SV = {
  "Northern Africa": "Nordafrika",
  "Western Africa": "Västafrika",
  "Middle Africa": "Centralafrika",
  "Eastern Africa": "Östafrika",
  "Southern Africa": "Södra Afrika",
  "North America": "Nordamerika",
  "Central America": "Centralamerika",
  Caribbean: "Karibien",
  "South America": "Sydamerika",
  "Central Asia": "Centralasien",
  "Eastern Asia": "Östasien",
  "South-Eastern Asia": "Sydostasien",
  "Southern Asia": "Sydasien",
  "Western Asia": "Västasien",
  "Northern Europe": "Norra Europa",
  "Southern Europe": "Södra Europa",
  "Eastern Europe": "Östeuropa",
  "Western Europe": "Västeuropa",
  "Australia and New Zealand": "Australien och Nya Zeeland",
  Melanesia: "Melanesien",
  Micronesia: "Mikronesien",
  Polynesia: "Polynesien",
};

/** Slumpar n unika länder ur en (valfri) redan filtrerad lista. */
export function sampleCountries(list, n) {
  const copy = [...list];
  const result = [];
  while (copy.length && result.length < n) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

/** Filtrerar på region (t.ex. "Europe", "Africa", "Asia") - matchar region-fältet i countries.json. */
export function byRegion(list, region) {
  if (!region || region === "alla") return list;
  return list.filter((c) => c.region.toLowerCase() === region.toLowerCase());
}

// Norden är inte en egen "region" i countries.json (Sverige/Danmark/Norge/Finland/
// Island räknas som "Northern Europe" tillsammans med Baltikum, Irland och
// Storbritannien) - så vi kuraterar den listan separat för ett Sverige-vänligt
// regionval i spelet.
export const NORDIC_CCA2 = new Set(["se", "no", "dk", "fi", "is"]);

/** Regionval för UI: nyckel -> { label, filter(list) }. Används av regionväljaren i spelen. */
export const REGION_OPTIONS = [
  { key: "alla", label: "Alla länder", filter: (list) => list },
  { key: "norden", label: "Norden", filter: (list) => list.filter((c) => NORDIC_CCA2.has(c.cca2)) },
  { key: "europa", label: "Europa", filter: (list) => byRegion(list, "Europe") },
  { key: "afrika", label: "Afrika", filter: (list) => byRegion(list, "Africa") },
  { key: "asien", label: "Asien", filter: (list) => byRegion(list, "Asia") },
  { key: "amerika", label: "Amerika", filter: (list) => byRegion(list, "Americas") },
  { key: "oceanien", label: "Oceanien", filter: (list) => byRegion(list, "Oceania") },
];
