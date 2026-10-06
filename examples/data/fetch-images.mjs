#!/usr/bin/env node
// Finds real photos for each model in generate-cars.mjs on Wikimedia Commons and
// saves them to images.json, with the author and licence each one needs as credit.
// generate-cars.mjs reads images.json offline.
//
//   node examples/data/fetch-images.mjs            only looks up models that have no photos yet
//   node examples/data/fetch-images.mjs --refresh  looks up every model again
//
// The photos in images.json were checked by eye. A refresh brings in photos nobody has
// looked at (Commons returns results in a different order each time), so check them.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));
const PER_MODEL = 8;
const UA = 'serviceform-agenticsearch-example-feed/1.0 (https://github.com/sf-pvt/serviceform-agenticsearch-ai-sdk)';

// Read brand + model pairs straight from the generator so the two never drift.
const src = readFileSync(join(OUT, 'generate-cars.mjs'), 'utf8');
const models = [...src.matchAll(/^\s*\['([^']+)', '([^']+)', '[^']+', \d+, \[\[/gm)].map((m) => [m[1], m[2]]);

// Commons names some cars differently from the brochure.
// Commons names some cars differently from the brochure, and a plain search finds
// generations older than anything on this lot (2015-2026), so name the generation.
const SEARCH = {
  'Toyota Corolla': ['Toyota Corolla E210', 'Toyota Corolla Touring Sports', 'Toyota Corolla Hybrid'],
  'Toyota RAV4': ['Toyota RAV4 XA50', 'Toyota RAV4 Plug-in Hybrid', 'Toyota RAV4 Hybrid'],
  'Toyota Yaris': ['Toyota Yaris XP210', 'Toyota Yaris Hybrid', 'Toyota Yaris XP150'],
  'Volkswagen Golf': ['Volkswagen Golf VIII', 'Volkswagen Golf VII'],
  'Volkswagen Passat': ['Volkswagen Passat B8', 'Volkswagen Passat Variant B9'],
  'Volkswagen Polo': ['Volkswagen Polo VI'],
  'BMW 3 Series': ['BMW G20', 'BMW G21', 'BMW 3er G20'],
  'BMW 5 Series': ['BMW G30', 'BMW G31', 'BMW G60', 'BMW G61'],
  'BMW X5': ['BMW X5 G05', 'BMW X5 F15'],
  'Mercedes-Benz A-Class': ['Mercedes-Benz W177', 'Mercedes-Benz A-Klasse W177', 'Mercedes-Benz A 250 e'],
  'Mercedes-Benz C-Class': ['Mercedes-Benz W206', 'Mercedes-Benz S206', 'Mercedes-Benz W205', 'Mercedes-Benz S205'],
  'Mercedes-Benz E-Class': ['Mercedes-Benz S213', 'Mercedes-Benz W213', 'Mercedes-Benz S214', 'Mercedes-Benz W214'],
  'Mercedes-Benz GLC': ['Mercedes-Benz GLC X254', 'Mercedes-Benz GLC X253', 'Mercedes-Benz X254'],
  'Audi A4': ['Audi A4 B9', 'Audi A4 Avant B9'],
  'Ford Focus': ['Ford Focus IV', 'Ford Focus Mk4', 'Ford Focus Turnier'],
  'Ford Kuga': ['Ford Kuga III', 'Ford Kuga PHEV', 'Ford Kuga third generation'],
  'Hyundai i30': ['Hyundai i30 PD', 'Hyundai i30 III', 'Hyundai i30 Kombi'],
  'Nissan Leaf': ['Nissan Leaf ZE1', 'Nissan Leaf 2018', 'Nissan Leaf e+'],
  'Mazda MX-5': ['Mazda MX-5 ND', 'Mazda MX-5 RF'],
  'Mazda CX-5': ['Mazda CX-5 KF', 'Mazda CX-5 Facelift'],
  'Seat Leon': ['SEAT Leon Mk4', 'SEAT Leon Sportstourer', 'SEAT Leon Mk3'],
  'Lexus NX': ['Lexus NX AAZH26', 'Lexus NX 350h', 'Lexus NX 300h'],
  'Hyundai Tucson': ['Hyundai Tucson NX4', 'Hyundai Tucson Hybrid'],
  'Renault Megane E-Tech': ['Renault Megane E-Tech', 'Renault Mégane E-Tech'],
  'Mitsubishi Outlander': ['Mitsubishi Outlander PHEV', 'Mitsubishi Outlander fourth generation', 'Mitsubishi Outlander III'],
};
// Title words that mean the photo is not the outside of the car.
const SKIP = /interior|innen|innenraum|cockpit|dashboard|armaturen|deska|engine|motor\b|motorraum|logo|badge|emblem|schriftzug|wheel|felge|rad\b|seat|sitz|boot|trunk|kofferraum|detail|light|leuchte|scheinwerfer|steering|lenkrad|display|screen|charging port|key|model car|\btoy\b|diecast|lego|crash|accident|police|polizei|taxi|rally|race|racing|\bdtm\b|banger|safety car|tuning|concept|prototype|\blf-|camouflage|erlkönig|leichenwagen|polizia|wnętrze|hearse|bundesheer|army|military|cabrio|cabriolet|\blwb\b|\bgr yaris|\bgrmn|cross\b|e-cell|f-cell|hyper|\bmk ?[12]\b|cropped|edited/i;
// A year before 2014 in the file name means an older generation than anything on this lot.
const OLD = /(^|[^0-9])(19[5-9][0-9]|200[0-9]|201[0-3])([^0-9]|$)/;// Photos that passed the filters but are wrong when you look at them (an interior, a
// close-up, an older generation, another model). Checked by eye on 2026-10-06.
const BLOCK = new Set([
  "2016 Volvo V90 Inscription rear.jpg",
  "Volvo S90-V90 - wnętrze (MSP17).jpg",
  "Škoda Superb IV Combi Leonberg 2024 IMG 1087.jpg",
  "BMW G30-LCI kidney grilles 2023.jpg",
  "Mercedes-Benz E 220d Stationwagon Sports (S213) rear.jpg",
  "MERCEDES-BENZ GLC (X254) China (3).jpg",
  "MERCEDES-BENZ GLC (X254) China (2).jpg",
  "Audi A4 Allroad Quattro B9 at IAA 2019 IMG 0297.jpg",
  "DSC00875 Unmarked Audi A4, Polizia di Stato, Front Right.jpg",
  "Audi Q5 GU DSC 8561.jpg",
  "Hyundai Ioniq 5 N TA Spec Auto Zuerich 2025 DSC 3735.jpg",
  "Renault Clio V (2023) Esprit Alpine Automesse Ludwigsburg 2023 1X7A0088.jpg",
  "Renault-Clio-Tandil.jpg",
  "Renault Megane E-Tech 1X7A6017.jpg",
  "Renault Megane E-Tech 1X7A6020.jpg",
  "Porsche Taycan IAA 2019 JM 0787.jpg",
  "Porsche Taycan GTS, IAA Open Space 2025, Munich (20250909-P1050259).jpg",
  "Porsche Taycan 2021021203.jpg",
  "Porsche Taycan 2021021201.jpg",
  "Lexus NX 450h+\"F SPORT\" (6LA-AAZH26-AWXLB(F)) rear.jpg",
  "Mitsubishi Outlander PHEV, Auto 2025, Zurich (20251029-P1074527).jpg",
  "Mitsubishi OUTLANDER 2026Winter.jpg",
  "MITSUBISHI OUTLANDER(CW,ZG,ZH) China.jpg",
  "MITSUBISHI OUTLANDER(CW,ZG,ZH) China (3).jpg",
  "MITSUBISHI OUTLANDER(CW,ZG,ZH) China (2).jpg",
  "Einsatzfahrzeug Skoda Superb der KaPo Graubünden (2026).jpg",
  "Mercedes-Benz E 220d Stationwagon Sports (S213) front.jpg",
  "AUDI A4 ALLROAD QUATTRO B9 China (4).jpg",
  "AUDI A4 ALLROAD QUATTRO B9 China (5).jpg",
  "Porsche Taycan 20210214.jpg",
  "Porsche Taycan 2021021202.jpg",
  "MITSUBISHI OUTLANDER(CW,ZG,ZH) China (13).jpg",
  "MITSUBISHI OUTLANDER(CW,ZG,ZH) China (7).jpg",
  "MITSUBISHI OUTLANDER (CU,ZE,ZF) China.jpg",
  "MITSUBISHI OUTLANDER(CW,ZG,ZH) China (12).jpg",
  "Škoda Superb II Sanming 02 2022-02-14.jpg",
]);
const LICENCES = /^(CC0|CC BY(-SA)? [1-4]\.0|Public domain|PD)/i;
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ');
const strip = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function search(q) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '50',
    gsrsearch: `${q} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|size|extmetadata',
    iiurlwidth: '960', iiextmetadatafilter: 'LicenseShortName|Artist|DateTimeOriginal',
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} for ${q}`);
  return Object.values((await res.json()).query?.pages || {}).sort((a, b) => a.index - b.index);
}

const FILE = join(OUT, 'images.json');
const saved = existsSync(FILE) && !process.argv.includes('--refresh') ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
const out = {};
for (const [brand, model] of models) {
  const key = `${brand} ${model}`;
  if (saved[key]?.length) { out[key] = saved[key]; continue; }
  const modelWords = norm(model).trim();
  const picked = [];
  for (const q of SEARCH[key] || [key]) {
    const qWords = norm(q.replace(brand, '')).trim() || modelWords;
    for (const p of await search(q)) {
      const i = p.imageinfo?.[0]; if (!i) continue;
      const m = i.extmetadata || {};
      const title = p.title.replace(/^File:/, '');
      const t = ` ${norm(title)} `;
      const licence = strip(m.LicenseShortName?.value);
      const ratio = i.width / i.height;
      if (!(t.includes(` ${modelWords} `) || t.includes(` ${qWords} `)) || !t.includes(norm(brand).split(' ')[0])) continue;
      // Check skip words without the car's own name ("Toyota" holds "toy", "Seat" is a word on the list).
      const rest = title.replace(new RegExp(`${brand}|${model}`, 'gi'), '');
      if (BLOCK.has(title.replace(/_/g, ' ')) || SKIP.test(rest) || OLD.test(title) || !LICENCES.test(licence)) continue;
      if (i.width < 1400 || ratio < 1.25 || ratio > 2.1) continue;
      if (picked.some((x) => x.url === i.thumburl)) continue;
      picked.push({ url: i.thumburl.split('?')[0], page: i.descriptionurl, author: strip(m.Artist?.value).slice(0, 120) || 'Unknown', licence });
      if (picked.length >= PER_MODEL) break;
    }
    if (picked.length >= PER_MODEL) break;
  }
  out[key] = picked;
  console.log(`${String(picked.length).padStart(2)}  ${key}`);
}
writeFileSync(FILE, JSON.stringify(out, null, 1) + '\n');
const thin = Object.entries(out).filter(([, v]) => v.length < 3).map(([k]) => k);
console.log(thin.length ? `Fewer than 3 photos: ${thin.join(', ')}` : 'Every model has at least 3 photos.');
