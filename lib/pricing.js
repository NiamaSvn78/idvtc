/**
 * Recalcul serveur du tarif — miroir de la logique CFG/OSRM de vtc-project/public/index.html.
 * Le prix envoyé par le client n'est jamais une source de vérité : cette fonction
 * calcule un prix attendu indépendant, utilisé pour rejeter toute session Stripe
 * dont le montant soumis serait anormalement inférieur.
 */
const CFG = {
  tarifs: {
    business: { km: 2.50, min: 30, h: 75 },
    van: { km: 2.50, min: 40, h: 95 },
  },
  extraKmRate: 2.50,
  osrmFactor: 1.30,
  forfaits: {
    cdg: { van: 100, business: 100 },
    orly: { van: 90, business: 90 },
  },
};

const AIRPORTS = [
  { key: 'cdg', lat: 49.0097, lon: 2.5479 },
  { key: 'orly', lat: 48.7233, lon: 2.3794 },
  { key: 'bourget', lat: 48.9694, lon: 2.4414, forfaitKey: 'cdg' },
  { key: 'beauvais', lat: 49.4544, lon: 2.1128, forfaitKey: 'cdg' },
];

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcParisExtraKm(coord) {
  if (!coord || coord.lat == null || coord.lon == null) return 0;
  if (coord.postcode && String(coord.postcode).slice(0, 2) === '75') return 0;
  return Math.max(0, Math.ceil(haversineKm(coord.lat, coord.lon, 48.853, 2.350) - 5));
}

/** Détection par proximité géographique — plus robuste à falsifier qu'un texte d'adresse. */
function detectAirportByCoord(lat, lon) {
  if (lat == null || lon == null) return null;
  for (const ap of AIRPORTS) {
    if (haversineKm(lat, lon, ap.lat, ap.lon) < 3) return ap.forfaitKey || ap.key;
  }
  return null;
}

function madHourlyPrice(veh, hours) {
  const h = Math.max(Number(hours) || 2, 2);
  const rate = (CFG.tarifs[veh] || CFG.tarifs.van).h;
  return h * rate;
}

function forfaitPrice({ fpack, veh, isRound, addrCoord, retAddrCoord }) {
  const f = CFG.forfaits[fpack];
  if (!f) return null;
  const base = f[veh] != null ? f[veh] : f.van;
  const extraA = calcParisExtraKm(addrCoord);
  const extraR = isRound ? calcParisExtraKm(retAddrCoord || addrCoord) : 0;
  return (base + extraA) + (isRound ? (base + extraR) : 0);
}

function kmTransferPrice({ veh, isRound, km }) {
  const t = CFG.tarifs[veh] || CFG.tarifs.van;
  const basePrice = Math.ceil(Math.max(km * t.km, t.min));
  return isRound ? basePrice * 2 : basePrice;
}

async function fetchOsrmKm(depLat, depLon, arrLat, arrLon) {
  const url = `https://router.project-osrm.org/route/v1/driving/${depLon},${depLat};${arrLon},${arrLat}?overview=false`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.[0]) return null;
    return Math.round(data.routes[0].distance / 1000 * CFG.osrmFactor * 10) / 10;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function computeTransferPrice({ veh, isRound, depLat, depLon, arrLat, arrLon }) {
  depLat = Number(depLat); depLon = Number(depLon); arrLat = Number(arrLat); arrLon = Number(arrLon);
  if ([depLat, depLon, arrLat, arrLon].some((v) => !Number.isFinite(v))) return null;

  const depAp = detectAirportByCoord(depLat, depLon);
  const arrAp = detectAirportByCoord(arrLat, arrLon);
  const apKey = depAp || arrAp;
  if (apKey && !(depAp && arrAp)) {
    const extraDep = !depAp ? calcParisExtraKm({ lat: depLat, lon: depLon }) : 0;
    const extraArr = !arrAp ? calcParisExtraKm({ lat: arrLat, lon: arrLon }) : 0;
    const extraEur = Math.ceil((extraDep + extraArr) * CFG.extraKmRate) * (isRound ? 2 : 1);
    const f = CFG.forfaits[apKey];
    const base = (f[veh] != null ? f[veh] : f.van) * (isRound ? 2 : 1);
    return base + extraEur;
  }

  const km = await fetchOsrmKm(depLat, depLon, arrLat, arrLon);
  if (km != null) return kmTransferPrice({ veh, isRound, km });

  // OSRM indisponible : plancher à vol d'oiseau (moins précis mais jamais nul).
  const straightKm = haversineKm(depLat, depLon, arrLat, arrLon) * CFG.osrmFactor;
  return kmTransferPrice({ veh, isRound, km: straightKm });
}

async function computeSinglePrice(d) {
  const isRound = d.tripMode === 'round-trip' || d.tripMode === 'split';
  if (d.tab === 'p') {
    return forfaitPrice({ fpack: d.fpack, veh: d.veh, isRound, addrCoord: d.addrCoord, retAddrCoord: d.retAddrCoord });
  }
  if (d.tab === 'm') {
    if (d.mdur == null) return null;
    return madHourlyPrice(d.veh, d.mdur);
  }
  if (d.tab === 't') {
    return computeTransferPrice({ veh: d.veh, isRound, depLat: d.depLat, depLon: d.depLon, arrLat: d.arrLat, arrLon: d.arrLon });
  }
  return null;
}

/**
 * @param {object} resData corps de /api/create-checkout-session (même forme que buildReservationData côté client)
 * @returns {Promise<number|null>} prix attendu, ou null si non vérifiable (→ la route doit alors rejeter)
 */
async function computeExpectedTotal(resData) {
  const base = await computeSinglePrice({
    tab: resData.type,
    veh: resData.vehicle,
    tripMode: resData.tripMode,
    fpack: resData.fpack,
    addrCoord: resData.paddressCoord,
    retAddrCoord: resData.preturnAddrCoord,
    mdur: resData.durationMin != null ? Number(resData.durationMin) / 60 : null,
    depLat: resData.depLat,
    depLon: resData.depLon,
    arrLat: resData.arrLat,
    arrLon: resData.arrLon,
  });
  if (base == null) return null;

  let total = base;
  const prestations = Array.isArray(resData.prestationsData) ? resData.prestationsData : [];
  for (const p of prestations) {
    const price = await computeSinglePrice({
      tab: p.tab,
      veh: p.veh,
      tripMode: p.tripMode,
      fpack: p.fpack,
      addrCoord: p.addrCoord,
      retAddrCoord: p.retAddrCoord,
      mdur: p.mdur,
      depLat: p.dep?.lat,
      depLon: p.dep?.lon,
      arrLat: p.arr?.lat,
      arrLon: p.arr?.lon,
    });
    if (price == null) return null; // un élément non vérifiable invalide l'ensemble
    total += price;
  }
  return total;
}

module.exports = { computeExpectedTotal };
