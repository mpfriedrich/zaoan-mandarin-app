// Übungsmaterial für das Tontraining (Phase 3). `py`: eine Silbe pro Zeichen, Taiwan-Aussprache.
// Töne: 1–4, 0 = neutral.

/** Tonpaare: für jede Kombination aus erstem und zweitem Ton ein häufiges Wort. */
export const tonePairs = [
  { zh: "飛機", py: "fēi jī", de: "Flugzeug" },
  { zh: "今年", py: "jīn nián", de: "dieses Jahr" },
  { zh: "開始", py: "kāi shǐ", de: "anfangen" },
  { zh: "生日", py: "shēng rì", de: "Geburtstag" },
  { zh: "桌子", py: "zhuō zi", de: "Tisch" },
  { zh: "明天", py: "míng tiān", de: "morgen" },
  { zh: "學習", py: "xué xí", de: "lernen" },
  { zh: "牛奶", py: "niú nǎi", de: "Milch" },
  { zh: "學校", py: "xué xiào", de: "Schule" },
  { zh: "什麼", py: "shén me", de: "was" },
  { zh: "老師", py: "lǎo shī", de: "Lehrer/in" },
  { zh: "旅行", py: "lǚ xíng", de: "reisen" },
  {
    zh: "你好",
    py: "nǐ hǎo",
    de: "hallo",
    hinweis: "Zwei 3. Töne hintereinander: Der erste wird wie ein 2. Ton gesprochen (ní hǎo), geschrieben bleibt nǐ hǎo.",
  },
  { zh: "請問", py: "qǐng wèn", de: "Entschuldigung, darf ich fragen" },
  { zh: "耳朵", py: "ěr duo", de: "Ohr" },
  { zh: "麵包", py: "miàn bāo", de: "Brot" },
  { zh: "大學", py: "dà xué", de: "Universität" },
  { zh: "電腦", py: "diàn nǎo", de: "Computer" },
  { zh: "再見", py: "zài jiàn", de: "auf Wiedersehen" },
  { zh: "謝謝", py: "xiè xie", de: "danke" },
];

/** Minimalpaare: gleiche Laute, anderer Ton – andere Bedeutung. */
export const minimalPairs = [
  { a: { zh: "買", py: "mǎi", de: "kaufen" }, b: { zh: "賣", py: "mài", de: "verkaufen" } },
  { a: { zh: "湯", py: "tāng", de: "Suppe" }, b: { zh: "糖", py: "táng", de: "Zucker" } },
  { a: { zh: "睡覺", py: "shuì jiào", de: "schlafen" }, b: { zh: "水餃", py: "shuǐ jiǎo", de: "Teigtaschen" } },
  { a: { zh: "請問", py: "qǐng wèn", de: "darf ich fragen" }, b: { zh: "親吻", py: "qīn wěn", de: "küssen" } },
  { a: { zh: "大學", py: "dà xué", de: "Universität" }, b: { zh: "大雪", py: "dà xuě", de: "starker Schneefall" } },
  { a: { zh: "杯子", py: "bēi zi", de: "Becher" }, b: { zh: "被子", py: "bèi zi", de: "Bettdecke" } },
];
