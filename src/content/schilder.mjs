// Schilder, Speisekarten und Aushänge für das Lese-Quiz („Schilder lesen“).
// `py`: eine Silbe pro chinesischem Zeichen (Taiwan-Aussprache); Ziffern bekommen keine Silbe.
// IDs nie ändern.

export const SIGN_CATEGORIES = [
  { id: "essen", title: "Speisekarte & Getränke", titleEn: "Menus & drinks" },
  { id: "laden", title: "Läden & Öffnungszeiten", titleEn: "Shops & opening hours" },
];

export const signs = [
  // Speisekarte & Getränke
  { id: "sg01", category: "essen", zh: "牛肉麵", py: "niú ròu miàn", de: "Rindfleisch-Nudelsuppe" },
  { id: "sg02", category: "essen", zh: "滷肉飯", py: "lǔ ròu fàn", de: "Reis mit geschmortem Schweinehack", hinweis: "Ein taiwanischer Klassiker und meist sehr günstig." },
  { id: "sg03", category: "essen", zh: "水餃", py: "shuǐ jiǎo", de: "Gekochte Teigtaschen" },
  { id: "sg04", category: "essen", zh: "鍋貼", py: "guō tiē", de: "Gebratene Teigtaschen" },
  { id: "sg05", category: "essen", zh: "小籠包", py: "xiǎo lóng bāo", de: "Suppen-Teigtaschen aus dem Dampfkorb" },
  { id: "sg06", category: "essen", zh: "蛋炒飯", py: "dàn chǎo fàn", de: "Gebratener Reis mit Ei" },
  { id: "sg07", category: "essen", zh: "燙青菜", py: "tàng qīng cài", de: "Blanchiertes grünes Gemüse", hinweis: "Die typische Beilage – meist mit Soße und Knoblauch." },
  { id: "sg08", category: "essen", zh: "無糖綠茶", py: "wú táng lǜ chá", de: "Grüner Tee ohne Zucker" },
  { id: "sg09", category: "essen", zh: "冰美式", py: "bīng měi shì", de: "Eiskalter Americano" },
  { id: "sg10", category: "essen", zh: "豆花", py: "dòu huā", de: "Süßer Tofupudding" },
  { id: "sg11", category: "essen", zh: "素食", py: "sù shí", de: "Vegetarisch", hinweis: "Das Zeichen 素 steht an vegetarischen Läden und Gerichten." },
  { id: "sg12", category: "essen", zh: "內用", py: "nèi yòng", de: "Hier essen", hinweis: "Das Gegenstück ist 外帶 – zum Mitnehmen." },
  { id: "sg13", category: "essen", zh: "加蛋", py: "jiā dàn", de: "Mit extra Ei" },
  { id: "sg14", category: "essen", zh: "套餐", py: "tào cān", de: "Menü (Set)" },
  {
    id: "sg15",
    category: "essen",
    zh: "招牌",
    py: "zhāo pái",
    de: "Spezialität des Hauses",
    hinweis: "招牌 heißt eigentlich Ladenschild – auf der Karte markiert es das beliebteste Gericht.",
  },
  { id: "sg16", category: "essen", zh: "時價", py: "shí jià", de: "Tagespreis", hinweis: "Steht oft bei Meeresfrüchten – frag vorher nach dem Preis." },
  { id: "sg32", category: "essen", zh: "餐具自取", py: "cān jù zì qǔ", de: "Besteck bitte selbst nehmen" },

  // Läden & Öffnungszeiten
  { id: "sg17", category: "laden", zh: "營業中", py: "yíng yè zhōng", de: "Geöffnet" },
  { id: "sg18", category: "laden", zh: "休息中", py: "xiū xí zhōng", de: "Gerade geschlossen (Pause)", hinweis: "In Taiwan spricht man 休息 meist xiūxí aus." },
  { id: "sg19", category: "laden", zh: "營業時間", py: "yíng yè shí jiān", de: "Öffnungszeiten" },
  {
    id: "sg20",
    category: "laden",
    zh: "週一公休",
    py: "zhōu yī gōng xiū",
    de: "Montags Ruhetag",
    hinweis: "公休 ist der feste Ruhetag. Wochentage: 週一 = Montag … 週日 = Sonntag.",
  },
  { id: "sg21", category: "laden", zh: "24小時營業", py: "xiǎo shí yíng yè", de: "24 Stunden geöffnet" },
  { id: "sg22", category: "laden", zh: "暫停營業", py: "zàn tíng yíng yè", de: "Vorübergehend geschlossen" },
  { id: "sg23", category: "laden", zh: "推", py: "tuī", de: "Drücken", hinweis: "An Türen: 推 = drücken, 拉 = ziehen." },
  { id: "sg24", category: "laden", zh: "拉", py: "lā", de: "Ziehen" },
  { id: "sg25", category: "laden", zh: "結帳處", py: "jié zhàng chù", de: "Kasse" },
  { id: "sg26", category: "laden", zh: "不收信用卡", py: "bù shōu xìn yòng kǎ", de: "Keine Kreditkarten" },
  { id: "sg27", category: "laden", zh: "全面八折", py: "quán miàn bā zhé", de: "Alles 20 % reduziert", hinweis: "八折 heißt: Du zahlst 80 % des Preises – also 20 % Rabatt." },
  { id: "sg28", category: "laden", zh: "售完", py: "shòu wán", de: "Ausverkauft" },
  { id: "sg29", category: "laden", zh: "限時優惠", py: "xiàn shí yōu huì", de: "Angebot für kurze Zeit" },
  { id: "sg30", category: "laden", zh: "禁止吸菸", py: "jìn zhǐ xī yān", de: "Rauchen verboten" },
  { id: "sg31", category: "laden", zh: "請勿觸摸", py: "qǐng wù chù mō", de: "Bitte nicht berühren" },
  { id: "sg33", category: "laden", zh: "洗手間", py: "xǐ shǒu jiān", de: "Toilette" },
];
