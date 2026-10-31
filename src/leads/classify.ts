// Multilingual classification: where a job is, how it's worked, what kind of
// engagement it is, and what language the post is in. Posts come in English,
// German, Spanish, Portuguese, French, Polish, Russian and Japanese.

export type WorkMode = "REMOTE" | "HYBRID" | "ONSITE";
export type Employment = "FREELANCE" | "CONTRACT" | "PART_TIME" | "FULL_TIME" | "UNKNOWN";

export const HOME_COUNTRY = "Bangladesh";

// [display name, aliases in local languages, major tech cities]
const COUNTRIES: [string, string[], string[]][] = [
  ["Bangladesh", ["bangladesh", "বাংলাদেশ"], ["dhaka", "chittagong", "chattogram", "sylhet"]],
  ["India", ["india"], ["bangalore", "bengaluru", "mumbai", "delhi", "hyderabad", "pune", "chennai", "gurgaon", "noida"]],
  ["Pakistan", ["pakistan"], ["lahore", "karachi", "islamabad"]],
  ["Singapore", ["singapore"], []],
  ["Malaysia", ["malaysia"], ["kuala lumpur"]],
  ["Indonesia", ["indonesia"], ["jakarta", "bali"]],
  ["Vietnam", ["vietnam", "viet nam"], ["ho chi minh", "hanoi"]],
  ["Thailand", ["thailand"], ["bangkok"]],
  ["Philippines", ["philippines"], ["manila"]],
  ["Japan", ["japan", "日本"], ["tokyo", "osaka", "東京", "大阪"]],
  ["South Korea", ["south korea", "korea"], ["seoul"]],
  ["China", ["china", "中国"], ["shanghai", "beijing", "shenzhen"]],
  ["Hong Kong", ["hong kong"], []],
  ["Taiwan", ["taiwan"], ["taipei"]],
  ["United Arab Emirates", ["united arab emirates", "uae", "u.a.e."], ["dubai", "abu dhabi"]],
  ["Saudi Arabia", ["saudi arabia", "ksa"], ["riyadh", "jeddah"]],
  ["Qatar", ["qatar"], ["doha"]],
  ["Israel", ["israel"], ["tel aviv"]],
  ["Turkey", ["turkey", "türkiye"], ["istanbul", "ankara"]],
  ["Russia", ["russia", "россия", "рф"], ["moscow", "москва", "saint petersburg", "санкт-петербург", "новосибирск", "екатеринбург", "казань"]],
  ["Kazakhstan", ["kazakhstan", "казахстан"], ["almaty", "алматы", "astana", "астана"]],
  ["Georgia", ["sakartvelo"], ["tbilisi", "тбилиси"]],
  ["Armenia", ["armenia", "армения"], ["yerevan", "ереван"]],
  ["Serbia", ["serbia", "сербия"], ["belgrade", "белград"]],
  ["Germany", ["germany", "deutschland"], ["berlin", "munich", "münchen", "hamburg", "frankfurt", "cologne", "köln", "stuttgart", "düsseldorf", "leipzig", "dresden", "nuremberg", "nürnberg", "hannover", "karlsruhe", "bonn", "essen", "dortmund", "bremen", "mannheim"]],
  ["Austria", ["austria", "österreich"], ["vienna", "wien", "graz", "linz", "salzburg"]],
  ["Switzerland", ["switzerland", "schweiz", "suisse"], ["zurich", "zürich", "geneva", "genève", "basel", "bern", "lausanne"]],
  ["Netherlands", ["netherlands", "nederland", "holland"], ["amsterdam", "rotterdam", "utrecht", "eindhoven", "the hague", "den haag"]],
  ["Belgium", ["belgium", "belgique", "belgië"], ["brussels", "bruxelles", "antwerp", "ghent"]],
  ["France", ["france"], ["paris", "lyon", "marseille", "toulouse", "lille", "nantes", "bordeaux"]],
  ["Spain", ["spain", "españa"], ["madrid", "barcelona", "valencia", "sevilla", "málaga", "malaga", "bilbao"]],
  ["Portugal", ["portugal"], ["lisbon", "lisboa", "porto", "braga"]],
  ["Italy", ["italy", "italia"], ["milan", "milano", "rome", "roma", "turin", "torino", "bologna"]],
  ["Ireland", ["ireland", "éire"], ["dublin", "cork", "galway"]],
  ["United Kingdom", ["united kingdom", "uk", "u.k.", "england", "scotland", "great britain"], ["london", "manchester", "edinburgh", "bristol", "cambridge", "oxford", "leeds", "birmingham", "glasgow"]],
  ["Poland", ["poland", "polska"], ["warsaw", "warszawa", "kraków", "krakow", "wrocław", "wroclaw", "gdańsk", "gdansk", "poznań", "poznan", "łódź", "lodz"]],
  ["Czechia", ["czechia", "czech republic"], ["prague", "praha", "brno"]],
  ["Romania", ["romania", "românia"], ["bucharest", "bucurești", "cluj"]],
  ["Hungary", ["hungary"], ["budapest"]],
  ["Ukraine", ["ukraine", "україна", "украина"], ["kyiv", "kiev", "lviv", "київ", "киев"]],
  ["Sweden", ["sweden", "sverige"], ["stockholm", "gothenburg", "göteborg", "malmö"]],
  ["Norway", ["norway", "norge"], ["oslo", "bergen"]],
  ["Denmark", ["denmark", "danmark"], ["copenhagen", "københavn", "aarhus"]],
  ["Finland", ["finland", "suomi"], ["helsinki", "espoo", "tampere"]],
  ["Estonia", ["estonia", "eesti"], ["tallinn"]],
  ["Greece", ["greece"], ["athens"]],
  ["Croatia", ["croatia", "hrvatska"], ["zagreb", "dubrovnik", "split"]],
  ["United States", ["united states", "usa", "u.s.a.", "u.s.", "us"], ["new york", "nyc", "san francisco", "sf", "bay area", "seattle", "austin", "boston", "chicago", "los angeles", "denver", "atlanta", "miami", "palo alto", "mountain view", "san jose", "washington dc", "portland", "philadelphia"]],
  ["Canada", ["canada"], ["toronto", "vancouver", "montreal", "montréal", "ottawa", "calgary", "waterloo"]],
  ["Mexico", ["mexico", "méxico"], ["mexico city", "cdmx", "guadalajara", "monterrey"]],
  ["Brazil", ["brazil", "brasil"], ["são paulo", "sao paulo", "rio de janeiro", "belo horizonte", "curitiba", "porto alegre", "florianópolis", "joinville", "recife", "campinas"]],
  ["Argentina", ["argentina"], ["buenos aires", "córdoba"]],
  ["Chile", ["chile"], ["santiago"]],
  ["Colombia", ["colombia"], ["bogotá", "bogota", "medellín", "medellin"]],
  ["Australia", ["australia"], ["sydney", "melbourne", "brisbane", "perth"]],
  ["New Zealand", ["new zealand"], ["auckland", "wellington"]],
  ["South Africa", ["south africa"], ["cape town", "johannesburg"]],
  ["Nigeria", ["nigeria"], ["lagos"]],
  ["Kenya", ["kenya"], ["nairobi"]],
  ["Egypt", ["egypt"], ["cairo"]],
];

const REGIONS: [string, RegExp][] = [
  ["Europe", /\b(europe|european union|eu|emea|eea|европа)\b/i],
  ["Asia-Pacific", /\b(apac|asia[\s-]pacific|asia|азия)\b/i],
  ["Latin America", /\b(latam|latin america|south america|américa latina|america latina)\b/i],
  ["North America", /\b(north america|americas)\b/i],
  ["Middle East", /\b(middle east|mena|gcc)\b/i],
  ["Africa", /\bafrica\b/i],
];

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Latin-script words get word boundaries; non-Latin scripts can't use \b.
function wordRe(words: string[]) {
  return new RegExp(`(?<![\\p{L}\\p{N}])(${words.map(escape).join("|")})(?![\\p{L}\\p{N}])`, "iu");
}

const COUNTRY_RES = COUNTRIES.map(([name, aliases, cities]) => {
  // "US"/"UK" are only trusted in capitals; "us" is an English word.
  const shortCaps = aliases.filter((a) => /^(us|uk|u\.s\.|u\.k\.)$/i.test(a));
  const rest = aliases.filter((a) => !shortCaps.includes(a));
  return {
    name,
    re: wordRe([...rest, ...cities]),
    caps: shortCaps.length ? new RegExp(`(?<![\\w.])(${shortCaps.map((a) => escape(a.toUpperCase())).join("|")})(?![\\w])`) : null,
  };
});

/** Countries mentioned in a location string (header / location field), in order of appearance. */
export function findCountries(location: string): string[] {
  const hits: [number, string][] = [];
  for (const c of COUNTRY_RES) {
    const m = c.re.exec(location) ?? (c.caps ? c.caps.exec(location) : null);
    if (m) hits.push([m.index, c.name]);
  }
  return hits.sort((a, b) => a[0] - b[0]).map(([, n]) => n);
}

export function findRegion(location: string): string | undefined {
  return REGIONS.find(([, re]) => re.test(location))?.[0];
}

const REMOTE_WORDS =
  /(?<![\p{L}])(remote|remotely|fully distributed|work from home|wfh|remoto|remota|en remoto|teletrabajo|fernarbeit|home[\s-]?office|mobiles arbeiten|télétravail|zdalnie|zdalna|praca zdalna|удал[её]нн\p{L}*|удал[её]нка|можно удал[её]нно|リモート|在宅|远程)(?![\p{L}])/iu;
const HYBRID_WORDS = /(?<![\p{L}])(hybrid|híbrido|hibrido|hybride|hybrydow\p{L}*|гибрид\p{L}*|ハイブリッド)(?![\p{L}])/iu;
// "No remote" mentions the word but means the opposite.
const NOT_REMOTE = /\b(no remote|not remote|non-remote|on-?site only|in[\s-]office only)\b|kein(e)? (home ?office|remote)|sem home ?office|sin remoto|без удал[её]нки/i;

export function detectWorkMode(text: string, hint?: WorkMode): WorkMode {
  if (hint) return hint;
  if (NOT_REMOTE.test(text)) return HYBRID_WORDS.test(text) ? "HYBRID" : "ONSITE";
  if (HYBRID_WORDS.test(text)) return "HYBRID";
  if (REMOTE_WORDS.test(text)) return "REMOTE";
  return "ONSITE";
}

export function mentionsRemote(text: string) {
  return REMOTE_WORDS.test(text);
}

const EMPLOYMENT: [Employment, RegExp][] = [
  ["FREELANCE", /(?<![\p{L}])(freelanc\p{L}*|freiberuflich\p{L}*|autónomo|autonomo|фриланс|самозанят\p{L}*|フリーランス|per project|project[\s-]based|one[\s-]off|gig)(?![\p{L}])/iu],
  ["CONTRACT", /(?<![\p{L}])(contract|contractor|contracting|befristet\p{L}*|pj|contrato|prestação de serviço|temporário|temporal|interim|b2b|договор\p{L}*|гпх|проектн\p{L}*|業務委託)(?![\p{L}])/iu],
  ["PART_TIME", /(?<![\p{L}])(part[\s-]?time|teilzeit|meio período|medio tiempo|media jornada|temps partiel|частичная занятость|неполный рабочий день|パートタイム|\d{1,2}\s?h(ours|rs)?\s?(\/|per\s)?\s?week)(?![\p{L}])/iu],
  ["FULL_TIME", /(?<![\p{L}])(full[\s-]?time|vollzeit|unbefristet\p{L}*|clt|tiempo completo|jornada completa|integral|temps plein|cdi|pełny etat|umowa o pracę|полный рабочий день|полная занятость|正社員|permanent)(?![\p{L}])/iu],
];

// In a long body, single words like "contract" are too ambiguous ("smart
// contract", "contract testing"), so only explicit phrases count there.
const BODY_EMPLOYMENT: [Employment, RegExp][] = [
  ["FREELANCE", /(?<![\p{L}])(freelance (basis|role|position|project|work|developer)|as a freelancer|freiberuflich\p{L}*|фриланс|самозанят\p{L}*|per project|project[\s-]based)(?![\p{L}])/iu],
  ["CONTRACT", /(?<![\p{L}])((on a |this is a |fixed[\s-]term |\d+[\s-]month )contract( basis| role| position)?|contract[\s-]to[\s-]hire|contract (role|position|engagement)|b2b (contract|basis)|befristet\p{L}*|contrato pj|vaga pj|договор гпх|業務委託)(?![\p{L}])/iu],
  ["PART_TIME", EMPLOYMENT[2][1]],
  ["FULL_TIME", EMPLOYMENT[3][1]],
];

/** Headline wins; the body only counts when it's explicit. */
export function detectEmployment(headline: string, body = "", fallback: Employment = "UNKNOWN"): Employment {
  return (
    EMPLOYMENT.find(([, re]) => re.test(headline))?.[0] ??
    BODY_EMPLOYMENT.find(([, re]) => re.test(body))?.[0] ??
    fallback
  );
}

export function isGig(employment: Employment) {
  return employment === "FREELANCE" || employment === "CONTRACT" || employment === "PART_TIME";
}

const VISA =
  /(?<![\p{L}])(visa sponsorship|sponsor (a |your |the )?(work )?visas?|we sponsor|relocation (support|package|assistance|bonus|help)|relocate you|help (you )?relocat\p{L}*|blue card|blaue karte|visum|visa support|employment pass|релокац\p{L}*|релокейт|помощь с переездом|realocação|reubicación|relocalización|ビザ)(?![\p{L}])/iu;
const NO_VISA = /\b(no|not able to|unable to|cannot|can't|do not|don't|won't) (offer |provide )?(visa )?sponsor|without (visa )?sponsorship\b/i;

export function offersVisa(text: string) {
  return VISA.test(text) && !NO_VISA.test(text);
}

// Stopword counts are a cheap, decent language detector for job posts.
const STOPWORDS: Record<string, RegExp> = {
  de: /\b(und|der|die|das|wir|mit|für|sie|ist|eine|unser|deine|bei|auf|zu)\b/gi,
  es: /\b(y|el|los|las|para|con|una|empresa|buscamos|años|del|que|en)\b/gi,
  pt: /\b(e|os|as|para|com|uma|empresa|você|vaga|não|do|da|que|em)\b/gi,
  fr: /\b(et|le|les|des|pour|avec|une|nous|vous|est|du|au)\b/gi,
  pl: /\b(i|oraz|dla|się|jest|nie|na|w|z|praca)\b/gi,
  en: /\b(and|the|for|with|you|we|our|are|is|to|of|in)\b/gi,
};

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", de: "German", es: "Spanish", pt: "Portuguese", fr: "French", pl: "Polish", ru: "Russian", ja: "Japanese", zh: "Chinese", uk: "Ukrainian",
};

export function detectLanguage(text: string): string {
  const sample = text.slice(0, 3000);
  if (/[぀-ヿ]/.test(sample)) return "ja";
  if ((sample.match(/[一-鿿]/g)?.length ?? 0) > 20) return "zh";
  const cyr = sample.match(/[Ѐ-ӿ]/g)?.length ?? 0;
  if (cyr > 30) return /[іїєґ]/i.test(sample) ? "uk" : "ru";
  const counts = Object.entries(STOPWORDS).map(([lang, re]) => [lang, sample.match(re)?.length ?? 0] as const);
  const english = counts.find(([lang]) => lang === "en")![1];
  const [best, n] = counts.reduce((a, b) => (b[1] > a[1] ? b : a));
  // English job jargon leaks into every language, so another language must clearly win.
  return best !== "en" && n > english * 1.3 && n >= 5 ? best : "en";
}
