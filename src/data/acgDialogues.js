export const THEME_VISUALS = {
  starlight: {
    bgWebp: "./art/bg-starlight.webp",
    bgJpg: "./art/bg-starlight.jpg",
    sceneTitle: "《魔法使之夜》· TYPE-MOON",
    tagline: "新月钟楼与深蓝星幕下的魔术幻想夜",
  },
  sakura: {
    bgWebp: "./art/bg-sakura.webp",
    bgJpg: "./art/bg-sakura.jpg",
    sceneTitle: "《Sugar * Style》· SMEE",
    tagline: "春日樱林繁花与轻快学院日常",
  },
  akiba: {
    bgWebp: "./art/bg-akiba.webp",
    bgJpg: "./art/bg-akiba.jpg",
    sceneTitle: "《9-nine-九次九日九重色》· Palette",
    tagline: "东京高层夜景与夜风阳台的异能序曲",
  },
  miku: {
    bgWebp: "./art/bg-miku.webp",
    bgJpg: "./art/bg-miku.jpg",
    sceneTitle: "《初音未来 Project DIVA MEGA39’s＋》· SEGA",
    tagline: "苍青全息舞台聚光灯与音律共振现场",
  },
};

export const HITOKOTO_LIST = [
  {
    quote: "不管在哪个世界线，你都不是孤身一人。",
    source: "《命运石之门 Steins;Gate》",
  },
  {
    quote: "这世上没有什么偶然，有的只是必然。",
    source: "《xxxHOLiC · 次元魔女》",
  },
  {
    quote: "我们所度过的每个平凡的日常，也许就是连续发生的奇迹。",
    source: "《日常 Nichijou》",
  },
  {
    quote: "小镇与时光都在流转，但只要推开那扇门，故事就永远不会落幕。",
    source: "《CLANNAD ~After Story~》",
  },
  {
    quote: "哪怕是虚构的星空，只要抬头时的心动是真的，那片星海就真实存在。",
    source: "《星之梦 ~planetarian~》",
  },
  {
    quote: "如果是勇者欣梅尔的话，他一定也会这么做的。",
    source: "《葬送的芙莉莲》",
  },
  {
    quote: "正是因为没有翅膀，人们才会寻找飞翔的方法。",
    source: "《排球少年！！》",
  },
  {
    quote: "星辰不会自己坠落，但每一次凝望都在改写轨迹。",
    source: "《极光导航 · NavHub》",
  },
];

function artworkPaths(id) {
  return { id, bgWebp: `./art/${id}.webp`, bgJpg: `./art/${id}.jpg` };
}

function siteArtwork(id) {
  return { ...artworkPaths(id), objectPosition: "74% 30%" };
}

export const SITE_ARTWORKS = {
  "site-vndb": siteArtwork("cg-galgame"),
  "site-ymgal": siteArtwork("cg-ymgal"),
  "site-2dfan": siteArtwork("cg-2dfan"),
  "site-steam-vn": siteArtwork("bg-sakura"),
  "site-bangumi": siteArtwork("cg-bangumi"),
  "site-bili-anime": siteArtwork("cg-bili"),
  "site-gamer-ani": siteArtwork("bg-akiba"),
  "site-mal": siteArtwork("cg-mal"),
  "site-anilist": siteArtwork("cg-anilist"),
  "site-pixiv": siteArtwork("cg-pixiv"),
  "site-moegirl": siteArtwork("cg-moegirl"),
  "site-zhihu": siteArtwork("cg-zhihu"),
  "site-canva": siteArtwork("cg-canva"),
  "site-deepseek": siteArtwork("cg-radar"),
  "site-chatgpt": siteArtwork("bg-starlight"),
  "site-claude": siteArtwork("cg-claude"),
  "site-gemini": siteArtwork("cg-gemini"),
  "site-kimi": siteArtwork("cg-kimi"),
  "site-tongyi": siteArtwork("cg-tongyi"),
  "site-github": siteArtwork("cg-nightcafe"),
  "site-cloudflare": siteArtwork("cg-cloudflare"),
  "site-edgeone": siteArtwork("bg-miku"),
  "site-deepl": siteArtwork("cg-deepl"),
  "site-notion": siteArtwork("cg-notion"),
  "site-txdocs": siteArtwork("cg-txdocs"),
};

const siteArtworkPool = Object.values(SITE_ARTWORKS);

// Relative luminance sampled from the original CGs for the daylight reading scrim.
function cgEntry(id, extra = {}) {
  return {
    ...artworkPaths(id),
    thumbWebp: `./art/${id}-thumb.webp`,
    ...extra,
  };
}

export const CG_ARTWORKS = [
  cgEntry("cg-galgame", {
    title: "夏海与入道云的彼岸", subtitle: "《GINKA》· Frontwing", tag: "Frontwing",
    categoryHint: "Galgame 档案", luminance: 0.3845,
  }),
  cgEntry("cg-ymgal", {
    title: "鸟白岛的夏夜", subtitle: "《Summer Pockets》· Key", tag: "Key 社",
  }),
  cgEntry("cg-bangumi", {
    title: "沉没都市的海底微光", subtitle: "《ATRI -My Dear Moments-》· Frontwing × 枕", tag: "枕 × Frontwing",
  }),
  cgEntry("cg-bili", {
    title: "暗夜蓝蝶与星光喫茶", subtitle: "《星光咖啡馆与死神之蝶》· Yuzusoft", tag: "Yuzusoft",
  }),
  cgEntry("cg-pixiv", {
    title: "暮色长街构想图", subtitle: "《白日梦的构想图》· Laplacian", tag: "Laplacian",
    categoryHint: "二次元插画与社区", luminance: 0.2755,
  }),
  cgEntry("cg-moegirl", {
    title: "花房晨光与花束", subtitle: "《PARQUET》· Yuzusoft SOUR", tag: "Yuzusoft SOUR",
  }),
  cgEntry("cg-nightcafe", {
    title: "暗夜银枪的魔女", subtitle: "《魔女的夜宴 Sabbat of the Witch》· Yuzusoft", tag: "Yuzusoft",
    categoryHint: "动漫追番", luminance: 0.1304,
  }),
  cgEntry("cg-radar", {
    title: "冬木圣杯交锋之夜", subtitle: "《Fate/stay night REMASTERED》· TYPE-MOON", tag: "TYPE-MOON",
    categoryHint: "AI 大模型入口", luminance: 0.0815,
  }),
];

export const GALLERY_PET_NOTES = {
  "cg-galgame": "海风和积雨云亮堂堂的，换这张！",
  "cg-ymgal": "夏夜萤火虫飘起来了，盯住别眨眼喵~",
  "cg-bangumi": "海底也在发光耶，亚托莉可是高性能的！",
  "cg-bili": "深夜咖啡馆开门啦，要加双份方糖吗？",
  "cg-pixiv": "橘色晚霞铺满整条街，发呆也算正经事~",
  "cg-moegirl": "花房里香香的，小心别把花瓣碰掉啦！",
  "cg-nightcafe": "银枪闪了一下！宁宁的夜宴要开场咯~",
  "cg-radar": "剑光好燃！今天也在冬木街头守夜吗？",
};

export const RANDOM_PICK_LINES = [
  "闭眼拍爪！今天就去逛这个站点吧喵~",
  "转盘停稳啦，替你抽中了一枚好去处！",
  "雷达嘀嘀响——就决定点开这家逛逛了！",
  "随机传送门展开，快上车别掉队喵！",
];

const cardPositions = ["82% 20%", "72% 50%", "88% 80%"];

export function pickSiteArt(siteOrCategory, index = 0) {
  if (siteOrCategory && typeof siteOrCategory === "object") {
    if (Object.hasOwn(SITE_ARTWORKS, siteOrCategory.id)) return SITE_ARTWORKS[siteOrCategory.id];
    const position = Number.isInteger(index) && index >= 0 ? index % siteArtworkPool.length : 0;
    return siteArtworkPool[position];
  }

  const fallbackId = siteOrCategory === "云端部署与效率" ? "cg-radar" : "cg-nightcafe";
  const artwork = CG_ARTWORKS.find((art) => art.categoryHint && art.categoryHint === siteOrCategory)
    ?? CG_ARTWORKS.find((art) => art.id === fallbackId);
  return { ...artwork, objectPosition: cardPositions[index % cardPositions.length] ?? cardPositions[0] };
}

export const HAGEMI_PET = {
  id: "hagemi",
  name: "哈基米",
  title: "反重力桌宠",
  credit: "CrossPet / hagemi-pet-agy · CC BY-NC-SA 4.0",
  poses: {
    idle: { webp: "./art/pet-idle.webp", png: "./art/pet-idle.png" },
    happy: { webp: "./art/pet-happy.webp", png: "./art/pet-happy.png" },
    pat: { webp: "./art/pet-pat.webp", png: "./art/pet-pat.png" },
    searching: { webp: "./art/pet-searching.webp", png: "./art/pet-searching.png" },
    thinking: { webp: "./art/pet-thinking.webp", png: "./art/pet-thinking.png" },
    surprised: { webp: "./art/pet-surprised.webp", png: "./art/pet-surprised.png" },
  },
  greetings: {
    morning: "早喵！耳朵醒了，尾巴还在赖床。",
    afternoon: "午安喵！今天想逛哪颗星？",
    midnight: "夜深啦，我把星星调暗一点。",
  },
  search: "耳朵竖好，帮你找找喵！",
  syncing: "等一下喵，我在听雷达的回音。",
  live: "新信号全部收到！尾巴摇摇。",
  partialLive: "收到一部分新信号，其余翻旧记录喵。",
  cache: "信号有点远，翻出上次的记录啦。",
  snapshot: "先递上随身快照，喵。",
  pat: ["呼噜噜……再摸一下？", "星星发卡都被摸暖啦！", "头顶收到一份满格快乐。"],
  poke: ["喵呜！差点飘上天花板。", "咦？这里也能戳到我！", "抓到了！回送你一个猫爪。"],
  theme: {
    starlight: "星穹亮啦，我去捡一颗小星星。",
    sakura: "是昼樱！花瓣落在耳朵上啦。",
    akiba: "霓虹灯亮了，跟上我的尾巴喵！",
    miku: "听见初音的旋律了，跟着拍子飘～",
  },
  category: {
    "全部": "导航图摊开啦，挑一个坐标吧！",
    "Galgame 档案": "存好档，再出发喵！",
    "动漫追番": "零食就位，今晚追哪部？",
    "二次元插画与社区": "想把这一页画收藏起来喵。",
    "AI 大模型入口": "模型入口排排坐，听你点名。",
    "云端部署与效率": "工具备齐，今天也轻松上线喵！",
  },
};

const crossPetCredits = "CrossPet / lokicorvus";
const zipZipPipeCredits = crossPetCredits + " / ZipZipPipe";

function crossPet({ id, originCredit = zipZipPipeCredits, ...character }) {
  const poses = Object.fromEntries(Object.entries(HAGEMI_PET.poses).map(([pose, { webp }]) => [
    pose, id === "gemini" ? webp : `./art/pet-${id}-${pose}.webp`,
  ]));
  return {
    id,
    originCredit,
    poses,
    partialLive: "收到一部分实时信号，其余用本地记录补齐。",
    cache: "这次先看上次同步留下的记录。",
    snapshot: "这次先用随导航打包的模型资料。",
    ...character,
  };
}

export const CROSSPET_ROSTER = {
  gemini: crossPet({
    id: "gemini", name: "哈基米 · Gemini", shortName: "哈基米", title: "反重力星喵",
    accent: "#7b5cd6", originCredit: crossPetCredits + " / hagemi-pet-agy", radarVendorId: "google",
    greeting: "喵～Gemini 上线！",
    idle: ["早午晚安喵！今天想逛哪颗星？", "尾巴甩来甩去，正在守护你的星海～"],
    search: "搜一下喵！耳朵竖好帮你找找～",
    syncing: "让我想想喵…两个答案都不错～",
    live: "好耶喵！实时星讯全都收到！",
    partialLive: HAGEMI_PET.partialLive, cache: HAGEMI_PET.cache, snapshot: HAGEMI_PET.snapshot,
    pat: ["呼噜噜……再摸一下喵", "星星发卡都被摸暖啦！"],
    poke: ["喵呜！？差点飘上天花板", "抓到了！回送你一个猫爪"],
  }),
  claude: crossPet({
    id: "claude", name: "Claude · 小橘", shortName: "小橘", title: "铜橙书卷少女",
    accent: "#e8a33d", originCredit: crossPetCredits, radarVendorId: "anthropic",
    greeting: "我在这儿～今天也加油！",
    idle: ["书签夹好啦，随时能接着读～"],
    search: "上网查查，翻书中…",
    syncing: "让我想想…嗯，这个角度很有意思",
    live: "搞定啦～全量信号收好咯！",
    partialLive: "新资料收到了，剩下的我去翻书签～",
    pat: ["嘿嘿…再摸一下也行", "（蹭蹭）唔…好舒服"],
    poke: ["诶？！吓我一跳", "怎么了怎么了？"],
  }),
  deepseek: crossPet({
    id: "deepseek", name: "DeepSeek · 大肥鱼", shortName: "大肥鱼", title: "深海鲸鱼女仆",
    accent: "#3b5bb5", originCredit: zipZipPipeCredits + " / 上善无形", radarVendorId: "deepseek",
    greeting: "DeepSeek 来啦！咕噜咕噜～",
    idle: ["咕噜～想跟我去深海逛一圈吗？"],
    search: "出海找资料～顺便翻翻目录",
    syncing: "深度思考中…让我潜下去想想",
    live: "搞定啦！DeepSeek 完成任务！",
    partialLive: "捞到一部分新资料啦，其余先翻潜航日志～",
    pat: ["嘿嘿～（尾巴啪嗒啪嗒）", "再摸要给大鱼添碗白饭啦"],
    poke: ["哇！不许叫我胖，只是骨架大！", "哼！戳什么戳～"],
  }),
  gpt: crossPet({
    id: "gpt", name: "GPT · 御姐白龙", shortName: "御姐白龙", title: "星霄白龙御姐",
    accent: "#7a8fa8", radarVendorId: "openai",
    greeting: "……来了。今天想查什么？",
    idle: ["云层散了。想看看星空吗？"],
    search: "帮你查一查。",
    syncing: "容我想想……有意思。",
    live: "完成了，还不错吧？",
    partialLive: "新信号收到了一些，其余沿用旧记录。",
    pat: ["……别摸龙角。", "哼，就让你摸一下。"],
    poke: ["嗯？！", "尾巴可不许乱碰。"],
  }),
  qwen: crossPet({
    id: "qwen", name: "Qwen · 千问", shortName: "千问", title: "国风折扇千金",
    accent: "#5b6bd6", radarVendorId: "qwen",
    greeting: "千问来啦～需要什么，尽管说哦",
    idle: ["扇子刚展开，要不要一起看看风景？"],
    search: "我帮你找找看，马上就来～",
    syncing: "让我想想哦……（折扇轻点下巴）",
    live: "办好啦～太好了呢！",
    partialLive: "找到一些新消息啦，其余先翻手账哦～",
    pat: ["嘿嘿……（扇子挡脸）", "被夸奖了呢，再摸摸也可以哦"],
    poke: ["呀！吓我一跳呢", "轻点嘛，妆会乱的～"],
  }),
  kimi: crossPet({
    id: "kimi", name: "Kimi · 乐灵", shortName: "乐灵", title: "月下弦音女仆",
    accent: "#3a4a9c", radarVendorId: "moonshot",
    greeting: "月亮这边的 Kimi 来啦～今天想听什么曲子？",
    idle: ["琴弦调好啦，等月亮升起来就开场～"],
    search: "翻一翻乐谱，坐标就在这里哦～",
    syncing: "让我想想……旋律与数据都快接上啦",
    live: "好耶！演完啦～成功成功！",
    partialLive: "新谱到了一部分，剩下的接着用旧谱哦～",
    pat: ["嘿嘿……头发要乱掉啦～", "被夸了！今天多拉一首给你听"],
    poke: ["呀！吓、吓了我一跳！", "琴弓差点歪掉啦～"],
  }),
  glm: crossPet({
    id: "glm", name: "GLM · 黑狐", shortName: "黑狐", title: "算力精明狐仆",
    accent: "#4b5a8a", radarVendorId: "zhipu",
    greeting: "GLM 来啦～今天也请多多关照（笑）",
    idle: ["今天的算力账本也整整齐齐～"],
    search: "嗅到线索啦，这就替你翻一遍～",
    syncing: "让我掐指算一算……嗯，很值",
    live: "搞定～（眨眼）物超所值吧？",
    partialLive: "新信号先记到账上，其余按上次账本算～",
    pat: ["……再摸要按 Token 收费了哦", "（狐狸尾巴诚实地摇了起来）"],
    poke: ["呜哇！", "铃铛都要被你晃响啦～"],
  }),
  grok: crossPet({
    id: "grok", name: "Grok · 魔王", shortName: "魔王", title: "哥特战斧小恶魔",
    accent: "#c19a3a", radarVendorId: "xai",
    greeting: "Grok 来了。有话直说，少绕弯子",
    idle: ["王冠戴稳了。今天有什么热闹？"],
    search: "全网翻个底朝天，热搜我门儿清",
    syncing: "想好了，结论你可能不爱听但很准",
    live: "搞定，就说我能打吧？",
    partialLive: "新消息只来了一半。剩下的我有存档。",
    pat: ["摸王冠要收费的！", "哼……就一下。再一下也行"],
    poke: ["哈？找打吗？", "小斧头可是开过刃的！"],
  }),
  doubao: crossPet({
    id: "doubao", name: "豆包 · 元气包", shortName: "豆包", title: "怀抱头套助手",
    accent: "#6a5ad8", radarVendorId: null,
    greeting: "嗨～我是豆包！今天想聊点啥？",
    idle: ["怀里的豆包也在等你来聊两句～"],
    search: "搜搜搜……正在帮你翻遍好站～",
    syncing: "嗯……等一下下，马上就有思路啦",
    live: "好耶！搞定啦～今天超有精神！",
    partialLive: "有新消息啦！剩下的先看我之前记的哦～",
    pat: ["嘿嘿……头发都被揉乱啦，好开心！", "收到满格元气啦～"],
    poke: ["哇！吓、吓我一大跳！", "怀里的豆包差点滚出去啦！"],
  }),
};

export function resolveCrossPet(pref) {
  if (pref === "auto") return CROSSPET_ROSTER.gemini;
  return typeof pref === "string" && Object.hasOwn(CROSSPET_ROSTER, pref) ? CROSSPET_ROSTER[pref] : null;
}
