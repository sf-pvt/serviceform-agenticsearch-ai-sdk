/**
 * The words the widgets say, in the five languages Serviceform search tools
 * run in. A tool's own labels (settings `labels`, `facetLabels`) go over these.
 */
export interface Strings {
  placeholder: string; search: string; clearQuery: string; any: string; from: string; to: string; min: string; max: string;
  emptyTitle: string; emptyFor: string; emptyHint: string; showAll: string; filters: string; clear: string; clearFilters: string;
  results: string; result: string; none: string; more: string; fewer: string; loadMore: string; close: string; previous: string; next: string;
  inStock: string; askAi: string; products: string; pages: string; suggestions: string; thinking: string; continuing: string; startOver: string;
  findValue: string; apply: string; sortBy: string; chat: string;
  sort: Record<string, string>;
  fields: Record<string, string>;
}

const EN: Strings = {
  placeholder: 'Search', search: 'Search', clearQuery: 'Clear', any: 'Any', from: 'From', to: 'To', min: 'Min', max: 'Max',
  emptyTitle: 'No results', emptyFor: 'No results for {q}', emptyHint: 'Try other words or fewer filters.', showAll: 'Show all results', filters: 'Filters', clear: 'Clear all', clearFilters: 'Clear filters',
  results: '{n} results', result: '1 result', none: 'Nothing matches these filters.', more: 'Show more', fewer: 'Show fewer', loadMore: 'Show more results', close: 'Close', previous: 'Previous', next: 'Next',
  inStock: 'In stock only', askAi: 'Ask AI', products: 'Products', pages: 'Pages', suggestions: 'Suggestions', thinking: 'Thinking', continuing: 'Continuing from', startOver: 'Start over',
  findValue: 'Search', apply: 'Apply', sortBy: 'Sort by', chat: 'Chat with us',
  sort: { relevance: 'Best match', price_asc: 'Cheapest first', price_desc: 'Most expensive first', year_desc: 'Newest first', year_asc: 'Oldest first', mileage_asc: 'Lowest mileage first', newest: 'Latest added', name_asc: 'Name A to Z' },
  fields: { brand: 'Brand', make: 'Make', vendor: 'Brand', model: 'Model', body_style: 'Body style', car_type: 'Type', listing_type: 'Listing', fuel: 'Fuel', transmission: 'Transmission', drive: 'Drive', condition: 'Condition', colour: 'Colour', color: 'Colour', price: 'Price', year: 'Year', mileage: 'Mileage', seats: 'Seats', beds: 'Beds', doors: 'Doors', category: 'Category', main_category: 'Category', sub_category: 'Subcategory', leaf_category: 'Category', size: 'Size', material: 'Material', availability: 'Availability', city: 'City', type: 'Type', rooms: 'Rooms', area: 'Area', accessories: 'Equipment', gender: 'Gender', rent: 'Rent' },
};

const FI: Strings = {
  placeholder: 'Hae', search: 'Hae', clearQuery: 'Tyhjennä', any: 'Kaikki', from: 'Vähintään', to: 'Enintään', min: 'Min', max: 'Max',
  emptyTitle: 'Ei tuloksia', emptyFor: 'Ei tuloksia haulle {q}', emptyHint: 'Kokeile toista hakusanaa tai vähemmän rajauksia.', showAll: 'Näytä kaikki tulokset', filters: 'Rajaukset', clear: 'Tyhjennä kaikki', clearFilters: 'Tyhjennä rajaukset',
  results: '{n} tulosta', result: '1 tulos', none: 'Näillä rajauksilla ei löytynyt mitään.', more: 'Näytä lisää', fewer: 'Näytä vähemmän', loadMore: 'Näytä lisää tuloksia', close: 'Sulje', previous: 'Edellinen', next: 'Seuraava',
  inStock: 'Vain varastossa', askAi: 'Kysy tekoälyltä', products: 'Tuotteet', pages: 'Sivut', suggestions: 'Ehdotukset', thinking: 'Mietin', continuing: 'Jatkoa kysymykselle', startOver: 'Aloita alusta',
  findValue: 'Hae', apply: 'Käytä', sortBy: 'Järjestys', chat: 'Kysy chatissa',
  sort: { relevance: 'Osuvin ensin', price_asc: 'Halvin ensin', price_desc: 'Kallein ensin', year_desc: 'Uusin ensin', year_asc: 'Vanhin ensin', mileage_asc: 'Vähiten ajettu ensin', newest: 'Viimeksi lisätty', name_asc: 'Nimi A-Ö' },
  fields: { brand: 'Merkki', make: 'Merkki', vendor: 'Merkki', model: 'Malli', body_style: 'Korimalli', car_type: 'Tyyppi', listing_type: 'Ilmoitus', fuel: 'Käyttövoima', transmission: 'Vaihteisto', drive: 'Vetotapa', condition: 'Kunto', colour: 'Väri', color: 'Väri', price: 'Hinta', year: 'Vuosimalli', mileage: 'Mittarilukema', seats: 'Istuimet', beds: 'Vuodepaikat', doors: 'Ovet', category: 'Kategoria', main_category: 'Kategoria', sub_category: 'Alakategoria', leaf_category: 'Kategoria', size: 'Koko', material: 'Materiaali', availability: 'Saatavuus', city: 'Kaupunki', type: 'Tyyppi', rooms: 'Huoneet', area: 'Pinta-ala', accessories: 'Varusteet', gender: 'Sukupuoli', rent: 'Vuokra' },
};

const SV: Strings = {
  placeholder: 'Sök', search: 'Sök', clearQuery: 'Rensa', any: 'Alla', from: 'Från', to: 'Till', min: 'Min', max: 'Max',
  emptyTitle: 'Inga träffar', emptyFor: 'Inga träffar för {q}', emptyHint: 'Prova andra ord eller färre filter.', showAll: 'Visa alla träffar', filters: 'Filter', clear: 'Rensa alla', clearFilters: 'Rensa filter',
  results: '{n} träffar', result: '1 träff', none: 'Inget matchar de här filtren.', more: 'Visa fler', fewer: 'Visa färre', loadMore: 'Visa fler träffar', close: 'Stäng', previous: 'Föregående', next: 'Nästa',
  inStock: 'Endast i lager', askAi: 'Fråga AI', products: 'Produkter', pages: 'Sidor', suggestions: 'Förslag', thinking: 'Tänker', continuing: 'Fortsätter från', startOver: 'Börja om',
  findValue: 'Sök', apply: 'Använd', sortBy: 'Sortera', chat: 'Chatta med oss',
  sort: { relevance: 'Bästa träff', price_asc: 'Billigast först', price_desc: 'Dyrast först', year_desc: 'Nyast först', year_asc: 'Äldst först', mileage_asc: 'Lägst mätarställning först', newest: 'Senast tillagda', name_asc: 'Namn A-Ö' },
  fields: { ...EN.fields, car_type: 'Typ', listing_type: 'Annons', seats: 'Säten', beds: 'Bäddar', doors: 'Dörrar', accessories: 'Utrustning', rooms: 'Rum', area: 'Yta', brand: 'Märke', make: 'Märke', vendor: 'Märke', model: 'Modell', body_style: 'Kaross', fuel: 'Drivmedel', transmission: 'Växellåda', drive: 'Drivning', condition: 'Skick', colour: 'Färg', color: 'Färg', price: 'Pris', year: 'Årsmodell', mileage: 'Mätarställning', category: 'Kategori', main_category: 'Kategori', sub_category: 'Underkategori', leaf_category: 'Kategori', size: 'Storlek', material: 'Material', availability: 'Tillgänglighet', city: 'Stad', type: 'Typ', gender: 'Kön', rent: 'Hyra' },
};

const DE: Strings = {
  placeholder: 'Suchen', search: 'Suchen', clearQuery: 'Löschen', any: 'Alle', from: 'Von', to: 'Bis', min: 'Min', max: 'Max',
  emptyTitle: 'Keine Ergebnisse', emptyFor: 'Keine Ergebnisse für {q}', emptyHint: 'Andere Wörter oder weniger Filter versuchen.', showAll: 'Alle Ergebnisse anzeigen', filters: 'Filter', clear: 'Alle löschen', clearFilters: 'Filter löschen',
  results: '{n} Ergebnisse', result: '1 Ergebnis', none: 'Nichts passt zu diesen Filtern.', more: 'Mehr anzeigen', fewer: 'Weniger anzeigen', loadMore: 'Mehr Ergebnisse', close: 'Schließen', previous: 'Zurück', next: 'Weiter',
  inStock: 'Nur vorrätig', askAi: 'KI fragen', products: 'Produkte', pages: 'Seiten', suggestions: 'Vorschläge', thinking: 'Denke nach', continuing: 'Fortsetzung von', startOver: 'Neu beginnen',
  findValue: 'Suchen', apply: 'Anwenden', sortBy: 'Sortieren', chat: 'Mit uns chatten',
  sort: { relevance: 'Beste Treffer', price_asc: 'Günstigste zuerst', price_desc: 'Teuerste zuerst', year_desc: 'Neueste zuerst', year_asc: 'Älteste zuerst', mileage_asc: 'Niedrigster Kilometerstand zuerst', newest: 'Zuletzt hinzugefügt', name_asc: 'Name A-Z' },
  fields: { ...EN.fields, car_type: 'Typ', listing_type: 'Anzeige', seats: 'Sitze', beds: 'Schlafplätze', doors: 'Türen', accessories: 'Ausstattung', rooms: 'Zimmer', area: 'Fläche', brand: 'Marke', make: 'Marke', vendor: 'Marke', model: 'Modell', body_style: 'Karosserie', fuel: 'Kraftstoff', transmission: 'Getriebe', drive: 'Antrieb', condition: 'Zustand', colour: 'Farbe', color: 'Farbe', price: 'Preis', year: 'Baujahr', mileage: 'Kilometerstand', category: 'Kategorie', main_category: 'Kategorie', sub_category: 'Unterkategorie', leaf_category: 'Kategorie', size: 'Größe', material: 'Material', availability: 'Verfügbarkeit', city: 'Stadt', type: 'Typ', gender: 'Geschlecht', rent: 'Miete' },
};

const ES: Strings = {
  placeholder: 'Buscar', search: 'Buscar', clearQuery: 'Borrar', any: 'Todos', from: 'Desde', to: 'Hasta', min: 'Mín', max: 'Máx',
  emptyTitle: 'Sin resultados', emptyFor: 'Sin resultados para {q}', emptyHint: 'Prueba otras palabras o menos filtros.', showAll: 'Ver todos los resultados', filters: 'Filtros', clear: 'Borrar todo', clearFilters: 'Borrar filtros',
  results: '{n} resultados', result: '1 resultado', none: 'Nada coincide con estos filtros.', more: 'Ver más', fewer: 'Ver menos', loadMore: 'Ver más resultados', close: 'Cerrar', previous: 'Anterior', next: 'Siguiente',
  inStock: 'Solo en stock', askAi: 'Preguntar a la IA', products: 'Productos', pages: 'Páginas', suggestions: 'Sugerencias', thinking: 'Pensando', continuing: 'Continuando desde', startOver: 'Empezar de nuevo',
  findValue: 'Buscar', apply: 'Aplicar', sortBy: 'Ordenar', chat: 'Habla con nosotros',
  sort: { relevance: 'Más relevante', price_asc: 'Más barato primero', price_desc: 'Más caro primero', year_desc: 'Más nuevo primero', year_asc: 'Más antiguo primero', mileage_asc: 'Menos kilómetros primero', newest: 'Últimos añadidos', name_asc: 'Nombre A-Z' },
  fields: { ...EN.fields, car_type: 'Tipo', listing_type: 'Anuncio', seats: 'Plazas', beds: 'Plazas para dormir', doors: 'Puertas', accessories: 'Equipamiento', rooms: 'Habitaciones', area: 'Superficie', brand: 'Marca', make: 'Marca', vendor: 'Marca', model: 'Modelo', body_style: 'Carrocería', fuel: 'Combustible', transmission: 'Cambio', drive: 'Tracción', condition: 'Estado', colour: 'Color', color: 'Color', price: 'Precio', year: 'Año', mileage: 'Kilometraje', category: 'Categoría', main_category: 'Categoría', sub_category: 'Subcategoría', leaf_category: 'Categoría', size: 'Talla', material: 'Material', availability: 'Disponibilidad', city: 'Ciudad', type: 'Tipo', gender: 'Género', rent: 'Alquiler' },
};

const ALL: Record<string, Strings> = { en: EN, fi: FI, sv: SV, de: DE, es: ES };

export function stringsFor(language?: string, overrides?: Partial<Strings> | null, fieldNames?: Record<string, string> | null): Strings {
  const base = ALL[String(language || 'en').slice(0, 2).toLowerCase()] || EN;
  const o = overrides || {};
  return {
    ...base,
    ...o,
    sort: { ...base.sort, ...(o.sort || {}) },
    fields: { ...base.fields, ...(o.fields || {}), ...(fieldNames || {}) },
  };
}

/** "ELECTRIC" reads as shouting and "used" as unfinished; mixed case, digits and short codes are left alone. */
export function prettyValue(value: unknown): string {
  const s = String(value ?? '').trim();
  if (/\d/.test(s)) return s;
  if (s.length > 3 && s === s.toUpperCase() && /[A-Z]/.test(s)) {
    return s.toLowerCase().replace(/(^|[\s_-])([a-z])/g, (_m, sep, c) => (sep === '_' ? ' ' : sep) + c.toUpperCase());
  }
  if (s === s.toLowerCase() && /^[a-zà-ÿ]/.test(s)) return s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}

// What feeds write in English whatever the site's language.
const VALUE_WORDS: Record<string, Record<string, string>> = {
  new: { fi: 'Uusi', sv: 'Ny', de: 'Neu', es: 'Nuevo' }, used: { fi: 'Käytetty', sv: 'Begagnad', de: 'Gebraucht', es: 'Usado' }, demo: { fi: 'Esittely', sv: 'Demo', de: 'Vorführwagen', es: 'Demostración' },
  white: { fi: 'Valkoinen', sv: 'Vit', de: 'Weiß', es: 'Blanco' }, black: { fi: 'Musta', sv: 'Svart', de: 'Schwarz', es: 'Negro' }, gray: { fi: 'Harmaa', sv: 'Grå', de: 'Grau', es: 'Gris' }, grey: { fi: 'Harmaa', sv: 'Grå', de: 'Grau', es: 'Gris' },
  silver: { fi: 'Hopea', sv: 'Silver', de: 'Silber', es: 'Plata' }, blue: { fi: 'Sininen', sv: 'Blå', de: 'Blau', es: 'Azul' }, red: { fi: 'Punainen', sv: 'Röd', de: 'Rot', es: 'Rojo' }, green: { fi: 'Vihreä', sv: 'Grön', de: 'Grün', es: 'Verde' },
  brown: { fi: 'Ruskea', sv: 'Brun', de: 'Braun', es: 'Marrón' }, orange: { fi: 'Oranssi', sv: 'Orange', de: 'Orange', es: 'Naranja' }, yellow: { fi: 'Keltainen', sv: 'Gul', de: 'Gelb', es: 'Amarillo' }, beige: { fi: 'Beige', sv: 'Beige', de: 'Beige', es: 'Beige' },
  purple: { fi: 'Violetti', sv: 'Lila', de: 'Lila', es: 'Morado' }, gold: { fi: 'Kulta', sv: 'Guld', de: 'Gold', es: 'Dorado' },
  electric: { fi: 'Sähkö', sv: 'El', de: 'Elektro', es: 'Eléctrico' }, petrol: { fi: 'Bensiini', sv: 'Bensin', de: 'Benzin', es: 'Gasolina' }, gasoline: { fi: 'Bensiini', sv: 'Bensin', de: 'Benzin', es: 'Gasolina' },
  diesel: { fi: 'Diesel', sv: 'Diesel', de: 'Diesel', es: 'Diésel' }, hybrid: { fi: 'Hybridi', sv: 'Hybrid', de: 'Hybrid', es: 'Híbrido' }, 'plug-in hybrid': { fi: 'Lataushybridi', sv: 'Laddhybrid', de: 'Plug-in-Hybrid', es: 'Híbrido enchufable' },
  automatic: { fi: 'Automaatti', sv: 'Automat', de: 'Automatik', es: 'Automático' }, manual: { fi: 'Manuaali', sv: 'Manuell', de: 'Schaltgetriebe', es: 'Manual' },
  wagon: { en: 'Estate', fi: 'Farmari', sv: 'Kombi', de: 'Kombi', es: 'Familiar' }, estate: { en: 'Estate', fi: 'Farmari', sv: 'Kombi', de: 'Kombi', es: 'Familiar' }, 'station wagon': { en: 'Estate', fi: 'Farmari', sv: 'Kombi', de: 'Kombi', es: 'Familiar' },
  sedan: { fi: 'Sedan', sv: 'Sedan', de: 'Limousine', es: 'Berlina' }, hatchback: { fi: 'Viistoperä', sv: 'Halvkombi', de: 'Schrägheck', es: 'Compacto' }, suv: { en: 'SUV', fi: 'Katumaasturi', sv: 'SUV', de: 'SUV', es: 'SUV' },
  coupe: { en: 'Coupé', fi: 'Coupé', sv: 'Coupé', de: 'Coupé', es: 'Coupé' }, convertible: { fi: 'Avoauto', sv: 'Cabriolet', de: 'Cabrio', es: 'Descapotable' }, cabriolet: { en: 'Convertible', fi: 'Avoauto', sv: 'Cabriolet', de: 'Cabrio', es: 'Descapotable' },
  minivan: { en: 'People carrier', fi: 'Tila-auto', sv: 'Familjebuss', de: 'Van', es: 'Monovolumen' }, mpv: { en: 'People carrier', fi: 'Tila-auto', sv: 'Familjebuss', de: 'Van', es: 'Monovolumen' },
  van: { fi: 'Pakettiauto', sv: 'Skåpbil', de: 'Transporter', es: 'Furgoneta' }, pickup: { fi: 'Avolava', sv: 'Pickup', de: 'Pick-up', es: 'Pick-up' }, 'pick-up': { en: 'Pickup', fi: 'Avolava', sv: 'Pickup', de: 'Pick-up', es: 'Pick-up' },
  truck: { fi: 'Kuorma-auto', sv: 'Lastbil', de: 'Lkw', es: 'Camión' }, motorhome: { fi: 'Matkailuauto', sv: 'Husbil', de: 'Wohnmobil', es: 'Autocaravana' }, campervan: { fi: 'Retkeilyauto', sv: 'Campingbuss', de: 'Campingbus', es: 'Camper' },
  caravan: { fi: 'Matkailuvaunu', sv: 'Husvagn', de: 'Wohnwagen', es: 'Caravana' },
  awd: { en: 'All-wheel drive', fi: 'Neliveto', sv: 'Fyrhjulsdrift', de: 'Allrad', es: 'Tracción total' }, '4wd': { en: 'All-wheel drive', fi: 'Neliveto', sv: 'Fyrhjulsdrift', de: 'Allrad', es: 'Tracción total' },
  fwd: { en: 'Front-wheel drive', fi: 'Etuveto', sv: 'Framhjulsdrift', de: 'Frontantrieb', es: 'Tracción delantera' }, rwd: { en: 'Rear-wheel drive', fi: 'Takaveto', sv: 'Bakhjulsdrift', de: 'Heckantrieb', es: 'Tracción trasera' },
  lpg: { en: 'LPG', fi: 'Kaasu', sv: 'Gas', de: 'Autogas', es: 'GLP' }, cng: { en: 'CNG', fi: 'Kaasu', sv: 'Gas', de: 'Erdgas', es: 'GNC' },
  'in stock': { fi: 'Varastossa', sv: 'I lager', de: 'Vorrätig', es: 'En stock' }, 'out of stock': { fi: 'Loppu varastosta', sv: 'Slut i lager', de: 'Nicht vorrätig', es: 'Agotado' },
};

/** A facet value in the visitor's language where it is one of the usual words, tidied otherwise. */
export function valueLabel(value: unknown, language?: string): string {
  const key = String(value ?? '').trim().toLowerCase().replace(/_/g, ' ');
  const lang = String(language || 'en').slice(0, 2);
  const known = Object.prototype.hasOwnProperty.call(VALUE_WORDS, key) ? VALUE_WORDS[key] : null;
  return (known && known[lang]) || prettyValue(value);
}

/** The name of a filter, in words. */
export function fieldLabel(attribute: string, strings: Strings): string {
  return strings.fields[attribute] || prettyValue(String(attribute).replace(/_/g, ' '));
}
