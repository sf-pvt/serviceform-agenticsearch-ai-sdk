#!/usr/bin/env node
// Builds an example car index: 1000 made-up used and new cars for a made-up dealer.
// The fields match the car indexes Serviceform runs for real dealers, so the
// feed can be uploaded as a product index as it is (JSON, CSV or XML).
//
// Photos are real photos of each model from Wikimedia Commons (images.json, made by
// fetch-images.mjs). Each car takes the colour of its photo, and carries the
// photographer and licence in image_credit: the licences ask for that credit.
//
//   node examples/data/generate-cars.mjs [count]
//
// The output is the same every time (seeded random), so the files diff cleanly.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const COUNT = Number(process.argv[2]) || 1000;
const OUT = dirname(fileURLToPath(import.meta.url));
const SITE = 'https://demo-motors.example';
const THIS_YEAR = 2026;

// mulberry32: small, seeded, good enough for test data.
let seed = 20261006;
function rand() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (a) => a[Math.floor(rand() * a.length)];
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const weighted = (pairs) => { let r = rand() * pairs.reduce((s, [, w]) => s + w, 0); for (const [v, w] of pairs) if ((r -= w) < 0) return v; return pairs[0][0]; };

// brand, model, body style, new price in EUR, fuels on offer, engine variants, weight in the mix
const MODELS = [
  ['Toyota', 'Corolla', 'Hatchback', 30000, [['1.8 Hybrid', 'Hybrid'], ['2.0 Hybrid', 'Hybrid'], ['1.2 Turbo', 'Petrol']], 9],
  ['Toyota', 'RAV4', 'SUV', 45000, [['2.5 Hybrid AWD', 'Hybrid'], ['2.5 Plug-in AWD', 'Plug-in hybrid']], 7],
  ['Toyota', 'Yaris', 'Hatchback', 23000, [['1.5 Hybrid', 'Hybrid'], ['1.0 VVT-i', 'Petrol']], 6],
  ['Toyota', 'C-HR', 'SUV', 34000, [['1.8 Hybrid', 'Hybrid'], ['2.0 Hybrid', 'Hybrid']], 4],
  ['Volkswagen', 'Golf', 'Hatchback', 32000, [['1.5 TSI', 'Petrol'], ['2.0 TDI', 'Diesel'], ['1.4 eHybrid', 'Plug-in hybrid']], 8],
  ['Volkswagen', 'Passat', 'Estate', 42000, [['2.0 TDI', 'Diesel'], ['1.4 GTE', 'Plug-in hybrid']], 5],
  ['Volkswagen', 'Tiguan', 'SUV', 45000, [['1.5 TSI', 'Petrol'], ['2.0 TDI 4Motion', 'Diesel']], 6],
  ['Volkswagen', 'ID.4', 'SUV', 47000, [['Pro 77 kWh', 'Electric'], ['GTX AWD', 'Electric']], 5],
  ['Volkswagen', 'Polo', 'Hatchback', 22000, [['1.0 TSI', 'Petrol']], 4],
  ['Volvo', 'XC60', 'SUV', 60000, [['T6 AWD Recharge', 'Plug-in hybrid'], ['B4 AWD', 'Petrol'], ['D4 AWD', 'Diesel']], 7],
  ['Volvo', 'XC40', 'SUV', 45000, [['Recharge Twin', 'Electric'], ['B3', 'Petrol'], ['T5 Recharge', 'Plug-in hybrid']], 6],
  ['Volvo', 'V60', 'Estate', 50000, [['T6 AWD Recharge', 'Plug-in hybrid'], ['D4', 'Diesel']], 5],
  ['Volvo', 'V90', 'Estate', 62000, [['T8 AWD Recharge', 'Plug-in hybrid'], ['D5 AWD', 'Diesel']], 3],
  ['Volvo', 'XC90', 'SUV', 80000, [['T8 AWD Recharge', 'Plug-in hybrid'], ['B5 AWD', 'Diesel']], 3],
  ['Skoda', 'Octavia', 'Estate', 32000, [['1.5 TSI', 'Petrol'], ['2.0 TDI', 'Diesel'], ['1.4 iV', 'Plug-in hybrid']], 8],
  ['Skoda', 'Superb', 'Estate', 42000, [['2.0 TDI 4x4', 'Diesel'], ['1.4 iV', 'Plug-in hybrid']], 4],
  ['Skoda', 'Enyaq', 'SUV', 48000, [['80', 'Electric'], ['85x AWD', 'Electric']], 5],
  ['Skoda', 'Kodiaq', 'SUV', 46000, [['2.0 TDI 4x4', 'Diesel'], ['1.5 TSI', 'Petrol']], 4],
  ['BMW', '3 Series', 'Sedan', 52000, [['320d xDrive', 'Diesel'], ['330e', 'Plug-in hybrid'], ['320i', 'Petrol']], 6],
  ['BMW', '5 Series', 'Sedan', 68000, [['520d xDrive', 'Diesel'], ['530e', 'Plug-in hybrid']], 4],
  ['BMW', 'X3', 'SUV', 62000, [['xDrive20d', 'Diesel'], ['xDrive30e', 'Plug-in hybrid']], 5],
  ['BMW', 'X5', 'SUV', 90000, [['xDrive45e', 'Plug-in hybrid'], ['xDrive30d', 'Diesel']], 3],
  ['BMW', 'i4', 'Coupe', 62000, [['eDrive40', 'Electric'], ['M50', 'Electric']], 3],
  ['Mercedes-Benz', 'A-Class', 'Hatchback', 38000, [['A 180', 'Petrol'], ['A 250 e', 'Plug-in hybrid']], 4],
  ['Mercedes-Benz', 'C-Class', 'Sedan', 55000, [['C 220 d', 'Diesel'], ['C 300 e', 'Plug-in hybrid']], 5],
  ['Mercedes-Benz', 'E-Class', 'Estate', 72000, [['E 220 d 4Matic', 'Diesel'], ['E 300 de', 'Plug-in hybrid']], 3],
  ['Mercedes-Benz', 'GLC', 'SUV', 68000, [['GLC 300 e 4Matic', 'Plug-in hybrid'], ['GLC 220 d 4Matic', 'Diesel']], 4],
  ['Mercedes-Benz', 'EQA', 'SUV', 52000, [['EQA 250', 'Electric'], ['EQA 300 4Matic', 'Electric']], 2],
  ['Audi', 'A4', 'Estate', 52000, [['40 TDI quattro', 'Diesel'], ['35 TFSI', 'Petrol']], 5],
  ['Audi', 'A6', 'Estate', 68000, [['40 TDI quattro', 'Diesel'], ['55 TFSI e quattro', 'Plug-in hybrid']], 3],
  ['Audi', 'Q5', 'SUV', 65000, [['40 TDI quattro', 'Diesel'], ['50 TFSI e quattro', 'Plug-in hybrid']], 4],
  ['Audi', 'Q4 e-tron', 'SUV', 52000, [['40', 'Electric'], ['50 quattro', 'Electric']], 3],
  ['Ford', 'Focus', 'Hatchback', 28000, [['1.0 EcoBoost', 'Petrol'], ['1.5 EcoBlue', 'Diesel']], 5],
  ['Ford', 'Kuga', 'SUV', 40000, [['2.5 PHEV', 'Plug-in hybrid'], ['1.5 EcoBoost', 'Petrol']], 4],
  ['Ford', 'Mustang Mach-E', 'SUV', 58000, [['Extended Range RWD', 'Electric'], ['AWD', 'Electric']], 2],
  ['Ford', 'Transit Custom', 'Van', 42000, [['2.0 EcoBlue 130', 'Diesel'], ['2.0 EcoBlue 170', 'Diesel']], 3],
  ['Kia', 'Ceed', 'Estate', 28000, [['1.5 T-GDI', 'Petrol'], ['1.6 PHEV', 'Plug-in hybrid']], 4],
  ['Kia', 'Sportage', 'SUV', 40000, [['1.6 T-GDI HEV', 'Hybrid'], ['1.6 T-GDI PHEV AWD', 'Plug-in hybrid'], ['1.6 CRDi', 'Diesel']], 5],
  ['Kia', 'Niro', 'SUV', 38000, [['EV 64 kWh', 'Electric'], ['1.6 HEV', 'Hybrid']], 4],
  ['Kia', 'EV6', 'Crossover', 55000, [['77 kWh RWD', 'Electric'], ['GT-Line AWD', 'Electric']], 2],
  ['Hyundai', 'Tucson', 'SUV', 40000, [['1.6 T-GDI HEV', 'Hybrid'], ['1.6 T-GDI PHEV 4WD', 'Plug-in hybrid']], 4],
  ['Hyundai', 'Kona', 'SUV', 38000, [['Electric 64 kWh', 'Electric'], ['1.6 Hybrid', 'Hybrid']], 4],
  ['Hyundai', 'Ioniq 5', 'Crossover', 52000, [['77 kWh RWD', 'Electric'], ['77 kWh AWD', 'Electric']], 3],
  ['Hyundai', 'i30', 'Hatchback', 25000, [['1.0 T-GDI', 'Petrol'], ['1.5 T-GDI', 'Petrol']], 3],
  ['Tesla', 'Model 3', 'Sedan', 45000, [['RWD', 'Electric'], ['Long Range AWD', 'Electric'], ['Performance', 'Electric']], 6],
  ['Tesla', 'Model Y', 'SUV', 50000, [['RWD', 'Electric'], ['Long Range AWD', 'Electric'], ['Performance', 'Electric']], 6],
  ['Nissan', 'Qashqai', 'SUV', 34000, [['1.3 DIG-T', 'Petrol'], ['e-Power', 'Hybrid']], 4],
  ['Nissan', 'Leaf', 'Hatchback', 32000, [['40 kWh', 'Electric'], ['e+ 62 kWh', 'Electric']], 3],
  ['Peugeot', '308', 'Hatchback', 30000, [['1.2 PureTech', 'Petrol'], ['1.5 BlueHDi', 'Diesel'], ['Hybrid 180', 'Plug-in hybrid']], 3],
  ['Peugeot', '3008', 'SUV', 40000, [['Hybrid4 300', 'Plug-in hybrid'], ['1.2 PureTech', 'Petrol']], 3],
  ['Renault', 'Clio', 'Hatchback', 21000, [['TCe 90', 'Petrol'], ['E-Tech 145', 'Hybrid']], 3],
  ['Renault', 'Megane E-Tech', 'Crossover', 42000, [['EV60 220 hp', 'Electric']], 2],
  ['Mazda', 'CX-5', 'SUV', 40000, [['2.0 Skyactiv-G', 'Petrol'], ['2.2 Skyactiv-D AWD', 'Diesel']], 3],
  ['Mazda', 'MX-5', 'Convertible', 36000, [['1.5 Skyactiv-G', 'Petrol'], ['2.0 Skyactiv-G', 'Petrol']], 1],
  ['Honda', 'CR-V', 'SUV', 45000, [['2.0 e:HEV AWD', 'Hybrid']], 2],
  ['Seat', 'Leon', 'Estate', 30000, [['1.5 TSI', 'Petrol'], ['2.0 TDI', 'Diesel']], 3],
  ['Cupra', 'Formentor', 'SUV', 42000, [['1.5 TSI', 'Petrol'], ['VZ 1.4 e-Hybrid', 'Plug-in hybrid']], 2],
  ['Porsche', 'Macan', 'SUV', 85000, [['2.0', 'Petrol'], ['Electric 4', 'Electric']], 1],
  ['Porsche', 'Taycan', 'Sedan', 110000, [['4S', 'Electric'], ['Turbo', 'Electric']], 1],
  ['Lexus', 'NX', 'SUV', 60000, [['350h AWD', 'Hybrid'], ['450h+ AWD', 'Plug-in hybrid']], 1],
  ['Mitsubishi', 'Outlander', 'SUV', 45000, [['2.4 PHEV 4WD', 'Plug-in hybrid']], 2],
  ['Polestar', '2', 'Sedan', 55000, [['Long Range Single Motor', 'Electric'], ['Long Range Dual Motor', 'Electric']], 2],
];

const IMAGES = existsSync(join(OUT, 'images.json')) ? JSON.parse(readFileSync(join(OUT, 'images.json'), 'utf8')) : {};
const used = {};
// Next photo of this model, in turn, so 16 Golfs share 8 photos twice rather than at random.
function photo(brand, model) {
  const key = `${brand} ${model}`;
  const list = IMAGES[key];
  if (!list?.length) return null;
  const n = used[key] = (used[key] ?? Math.floor(rand() * list.length)) + 1;
  return list[n % list.length];
}

// First model year (in Europe) of models newer than the oldest cars on the lot.
const LAUNCH = {
  'Toyota C-HR': 2017, 'Volkswagen ID.4': 2021, 'Volvo XC40': 2018, 'Skoda Enyaq': 2021, 'Skoda Kodiaq': 2017,
  'BMW i4': 2021, 'Mercedes-Benz EQA': 2021, 'Audi Q4 e-tron': 2021, 'Ford Mustang Mach-E': 2021, 'Kia Niro': 2017,
  'Kia EV6': 2021, 'Hyundai Kona': 2018, 'Hyundai Ioniq 5': 2021, 'Tesla Model 3': 2019, 'Tesla Model Y': 2021,
  'Renault Megane E-Tech': 2022, 'Cupra Formentor': 2021, 'Porsche Taycan': 2020, 'Polestar 2': 2020,
};

const COLOURS = [['Black', 18], ['White', 18], ['Grey', 16], ['Silver', 14], ['Blue', 12], ['Red', 7], ['Green', 3], ['Brown', 3], ['Beige', 2], ['Orange', 1]];
const LOCATIONS = ['Helsinki', 'Espoo', 'Vantaa', 'Tampere', 'Turku', 'Oulu', 'Jyväskylä', 'Lahti'];
const TRIMS = ['', '', 'Comfort', 'Style', 'Business', 'Premium', 'Sport', 'Edition'];
const EXTRAS = [
  'Heated front seats', 'Heated steering wheel', 'Reversing camera', '360 camera', 'Adaptive cruise control',
  'Lane keeping assist', 'Blind spot monitor', 'Apple CarPlay', 'Android Auto', 'Navigation', 'Head-up display',
  'Keyless entry', 'Panoramic roof', 'Leather seats', 'Electric seats with memory', 'Parking sensors front and rear',
  'Tow bar', 'Electric tow bar', 'Fuel-fired heater', 'Remote pre-heating', 'Electric tailgate', 'LED matrix headlights',
  'Premium sound system', 'Wireless phone charging', 'Winter tyres included', 'Two sets of keys', 'Full service history',
];

const fmtEur = (n) => n.toLocaleString('en-GB');

function makeCar(i) {
  const [brand, model, body, newPrice, variants] = weighted(MODELS.map((m) => [m, m[5]]));
  const [variant, fuel] = pick(variants);
  const electric = fuel === 'Electric';
  const isNew = rand() < 0.12;
  let year = isNew ? THIS_YEAR : weighted([[2025, 8], [2024, 12], [2023, 14], [2022, 14], [2021, 13], [2020, 11], [2019, 9], [2018, 7], [2017, 5], [2016, 4], [2015, 3]]);
  const launch = LAUNCH[`${brand} ${model}`];
  if (launch && year < launch) year = int(launch, THIS_YEAR - 1);
  const age = THIS_YEAR - year;
  const mileage = isNew ? int(0, 50) : Math.max(1000, Math.round((age * int(9000, 24000) + int(-4000, 6000)) / 100) * 100);
  const trim = pick(TRIMS);
  const transmission = fuel !== 'Petrol' && fuel !== 'Diesel' || body === 'SUV' && rand() < 0.8 || newPrice > 50000 ? 'Automatic' : weighted([['Automatic', 6], ['Manual', 4]]);
  const drive = /AWD|4Matic|xDrive|quattro|4x4|4Motion|4WD|Dual Motor|Performance|4S|Turbo|Electric 4|Twin|GTX/.test(variant) ? 'All-wheel drive' : body === 'Van' ? 'Front-wheel drive' : brand === 'BMW' || brand === 'Mercedes-Benz' || brand === 'Tesla' || /RWD/.test(variant) ? 'Rear-wheel drive' : 'Front-wheel drive';

  // Value: about 13% off a year and 3% per 10,000 km above average, with some noise.
  let price = newPrice * (isNew ? 1 : Math.pow(0.87, age) * Math.pow(0.97, (mileage - age * 15000) / 10000)) * (0.92 + rand() * 0.16);
  price = Math.max(3500, Math.round(price / 100) * 100 - (rand() < 0.5 ? 10 : 0));
  const monthly = price >= 8000 ? Math.round((price * 0.85) / 60 + price * 0.002) : null;

  const id = String(100001 + i);
  const plate = `${'ABCEFGHIJKLMNOPRSTUVXYZ'[int(0, 22)]}${'ABCEFGHIJKLMNOPRSTUVXYZ'[int(0, 22)]}${'ABCEFGHIJKLMNOPRSTUVXYZ'[int(0, 22)]}-${int(100, 999)}`;
  const image = photo(brand, model);
  const colour = image?.colour || weighted(COLOURS);
  const location = pick(LOCATIONS);
  const accessories = [...EXTRAS].sort(() => rand() - 0.5).slice(0, int(4, 12)).sort();
  const powerKw = electric ? int(110, 400) : int(70, 250);
  const range = electric ? int(300, 620) : null;
  const owners = isNew ? 0 : Math.min(5, 1 + Math.floor(age / int(3, 6)));
  // Mercedes names its engines with the model in them ("GLC 300 e"), so do not say it twice.
  const title = `${brand} ${variant.startsWith(model) ? '' : model + ' '}${variant}${trim ? ' ' + trim : ''}`;
  const slug = `${brand}-${model}-${variant}-${year}-${id}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const description = [
    `${year} ${title} in ${colour.toLowerCase()}.`,
    isNew ? 'New car, ready for delivery.' : `${fmtEur(mileage)} km, ${owners} previous ${owners === 1 ? 'owner' : 'owners'}.`,
    `${fuel}, ${transmission.toLowerCase()}, ${drive.toLowerCase()}, ${powerKw} kW (${Math.round(powerKw * 1.36)} hp).`,
    range ? `Range up to ${range} km (WLTP).` : '',
    `Equipment: ${accessories.join(', ')}.`,
    `See it at our ${location} showroom. Trade-in and financing available.`,
  ].filter(Boolean).join(' ');

  return {
    id,
    objectID: id,
    title,
    brand,
    model,
    variant,
    year,
    price,
    monthly_price: monthly,
    currency: 'EUR',
    mileage,
    mileage_unit: 'km',
    fuel,
    transmission,
    drive,
    body_style: body,
    colour,
    power_kw: powerKw,
    electric_range_km: range,
    doors: body === 'Coupe' || body === 'Convertible' ? 2 : body === 'Van' ? 4 : 5,
    seats: body === 'Van' ? 3 : body === 'Coupe' || body === 'Convertible' ? (brand === 'Mazda' ? 2 : 4) : (model === 'XC90' || model === 'Kodiaq' || model === 'X5' ? 7 : 5),
    owners,
    condition: isNew ? 'new' : 'used',
    car_type: isNew ? 'new' : 'used',
    availability: rand() < 0.05 ? 'out of stock' : 'in stock',
    location,
    license_plate: isNew ? '' : plate,
    accessories,
    description,
    link: `${SITE}/cars/${slug}`,
    image_link: image?.url || `https://placehold.co/800x600/png?text=${encodeURIComponent(`${brand} ${model}\n${year}`)}`,
    image_credit: image ? `Photo: ${image.author}, ${image.licence}, via Wikimedia Commons` : '',
    image_source: image?.page || '',
  };
}

const cars = Array.from({ length: COUNT }, (_, i) => makeCar(i));

// JSON
writeFileSync(join(OUT, 'cars.json'), JSON.stringify(cars, null, 1) + '\n');

// CSV (accessories joined with "|")
const cols = Object.keys(cars[0]);
const csvCell = (v) => { const s = v == null ? '' : Array.isArray(v) ? v.join('|') : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
writeFileSync(join(OUT, 'cars.csv'), [cols.join(','), ...cars.map((c) => cols.map((k) => csvCell(c[k])).join(','))].join('\n') + '\n');

// XML, one <car> per record (set the record tag to "car" when you add the feed)
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const xmlCar = (c) => '  <car>\n' + cols.map((k) => {
  const v = c[k];
  if (v == null || v === '') return `    <${k}/>`;
  if (Array.isArray(v)) return `    <${k}>${v.map((a) => `<item>${esc(a)}</item>`).join('')}</${k}>`;
  return `    <${k}>${esc(v)}</${k}>`;
}).join('\n') + '\n  </car>';
writeFileSync(join(OUT, 'cars.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<cars>\n${cars.map(xmlCar).join('\n')}\n</cars>\n`);

const count = (k) => Object.entries(cars.reduce((m, c) => ((m[c[k]] = (m[c[k]] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
console.log(`${cars.length} cars written to ${OUT}`);
console.log('brands:', count('brand').length, '| fuel:', count('fuel').map(([k, v]) => `${k} ${v}`).join(', '));
console.log('price range:', Math.min(...cars.map((c) => c.price)), '-', Math.max(...cars.map((c) => c.price)), 'EUR');
