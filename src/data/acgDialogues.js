export const THEME_VISUALS = {
  starlight: {
    bgWebp: "./art/bg-starlight.webp",
    bgJpg: "./art/bg-starlight.jpg",
    defaultMascotId: "sena",
    sceneTitle: "《魔法使之夜》· TYPE-MOON",
    tagline: "新月钟楼与深蓝星幕下的魔术幻想夜",
  },
  sakura: {
    bgWebp: "./art/bg-sakura.webp",
    bgJpg: "./art/bg-sakura.jpg",
    defaultMascotId: "sakura",
    sceneTitle: "《Sugar * Style》· SMEE",
    tagline: "春日樱林繁花与轻快学院日常",
  },
  akiba: {
    bgWebp: "./art/bg-akiba.webp",
    bgJpg: "./art/bg-akiba.jpg",
    defaultMascotId: "sena",
    sceneTitle: "《9-nine-九次九日九重色》· Palette",
    tagline: "东京高层夜景与夜风阳台的异能序曲",
  },
  miku: {
    bgWebp: "./art/bg-miku.webp",
    bgJpg: "./art/bg-miku.jpg",
    defaultMascotId: "sakura",
    sceneTitle: "《初音未来 Project DIVA MEGA39’s＋》· SEGA",
    tagline: "苍青全息舞台聚光灯与音律共振现场",
  },
};

export const MASCOTS = {
  sena: {
    id: "sena",
    name: "星奈 Sena",
    title: "星穹姬 · 极光领航员",
    cvStyle: "冷静微傲娇 · 重度 Galgame 考据党与赛博观测者",
    catchphrase: "「星轨校准完毕，今天要推哪一条世界线？」",
    avatarWebp: "./art/mascot-sena.webp",
    avatarJpg: "./art/mascot-sena.jpg",
    accent: "#a855f7",
    greetings: {
      default: "欢迎回到极光观测站。新番更新表、VNDB 档案和 AI 模型雷达都已经替你对齐好坐标了哦。",
      morning: "早安，领航员。晨间咖啡配 BGM 已经就绪，先看一眼今日的 AI 算力雷达还是补完昨晚的视觉小说？",
      afternoon: "午后容易犯困呢……要不要去 Pixiv 刷几张神仙立绘提提神，或者让模型助手帮你把代码收个尾？",
      night: "深夜模式已展开。戴上耳机吧，无论是推 Galgame 共通线还是深夜写码，星奈都会陪你守夜的。",
      poke: [
        "别乱戳立绘啦，好感度数值可不会因为连点就触发隐藏 CG 哦……大概。",
        "需要快速检索？直接按键盘上的「/」键就能唤起导航搜索框，这可是高玩快捷键。",
        "嘘，正在监听 OpenRouter 与各大模型节点的星门脉冲，状态灯一切平稳。",
      ],
    },
  },
  sakura: {
    id: "sakura",
    name: "樱雪 Sakura",
    title: "昼樱姬 · 番组图书委员",
    cvStyle: "温柔元气 · 追番手账达人与同人画集管理员",
    catchphrase: "「樱瓣落下的瞬间，正好翻到你最想看的下一页♪」",
    avatarWebp: "./art/mascot-sakura.webp",
    avatarJpg: "./art/mascot-sakura.jpg",
    accent: "#ec4899",
    greetings: {
      default: "欢迎光临~ 樱雪已经把常逛的番剧、画师社区和 AI 助手整理得整整齐齐，随时可以出发啦！",
      morning: "早上好呀！阳光和樱花都很温柔，今天也一起元气满满地探索新世界吧♪",
      afternoon: "下午茶时间到~ 要去 Bangumi 给在追的新番打个分，还是去萌娘百科巡礼词条呢？",
      night: "夜深了呢，屏幕亮度已经调成护眼色调啦。看完这一话番剧记得早点休息哦~",
      poke: [
        "诶嘿，被发现了~ 点击卡片上的「★」就能把喜欢的网站钉在顶部的常用手账里哦！",
        "想换个心情的话，点主题或插画画廊卡片，昼樱、星穹、秋叶原和初音青随时切换~",
        "本地书签都安全保存在浏览器里，也可以随时导出 JSON 备份带走呢♪",
      ],
    },
  },
};

export const THEME_SWITCH_LINES = {
  starlight: {
    sena: "已切入「星穹幻夜」主世界线——深空暗底搭配极光紫，最适合深夜推 Galgame 与沉浸式写码。",
    sakura: "夜空亮起星尘了呢~ 在静谧的星空下慢慢浏览收藏夹吧。",
  },
  sakura: {
    sena: "切换到「昼樱轻语」模式了……偶尔晒晒午后的樱花阳光，换个清爽视野也不赖。",
    sakura: "「昼樱轻语」展开♪ 春日樱色与通透玻璃面板，像翻开一本精装轻小说一样舒服吧？",
  },
  akiba: {
    sena: "「霓虹秋叶原」高能同步！赛博洋红与青色霓虹已点亮，仿佛置身无线电会馆街头的夜晚。",
    sakura: "哇，是秋叶原夜街的霓虹灯牌风格！动画、游戏与前沿 AI 的气息扑面而来呢~",
  },
  miku: {
    sena: "「苍穹音律」频率锁定，#39C5BB 电子青绿波长稳定，算力与音律同频共振中。",
    sakura: "切到清透的苍穹初音青啦♪ 听着电子歌姬的旋律整理资料，效率会翻倍哦！",
  },
};

export const CATEGORY_LINES = {
  "全部": {
    sena: "全领域星图已展开。精选 ACGN 与 AI 坐标全部待命，按「/」即可瞬时检索。",
    sakura: "全部宝藏站点都在这里啦，从 Galgame 档案到 AI 助手一应俱全哦~",
  },
  "Galgame 档案": {
    sena: "视觉小说核心档案库已解锁。VNDB 编号考据、月幕感想、2DFan 情报还是 Steam 正版入库，先存档再出发吧。",
    sakura: "是令人心动的 Galgame 专区呢♪ 每一部作品都是一段独一无二的青春与重逢~",
  },
  "动漫追番": {
    sena: "新番观测阵列就绪。去 Bangumi 记录点格子进度，还是直接打开 B 站番剧与动画疯开追？",
    sakura: "季度新番与经典神作都在这儿啦！备好零食和弹幕，今晚准备补哪一部番呢？",
  },
  "二次元插画与社区": {
    sena: "Pixiv 每日榜单与萌娘百科考据通道已连接——小心别在「万物皆可萌」的词条里逛到天亮哦。",
    sakura: "神仙画师的新作立绘和趣味百科词条都在这里，灵感枯竭的时候最适合来逛逛啦♪",
  },
  "AI 大模型入口": {
    sena: "前沿大模型矩阵已连接。无论是 DeepSeek 深度推理、Claude 代码精修还是 ChatGPT，随时召唤你的硅基搭档。",
    sakura: "AI 咏唱法阵准备完毕~ 写代码、译文本还是脑洞创作，大模型助手都能立刻响应哦！",
  },
  "云端部署与效率": {
    sena: "开发者工具链与零成本静态托管通道已就绪。GitHub 仓库、Cloudflare Pages 与协作文档一键直达。",
    sakura: "把灵感变成作品的工作台~ 代码托管、文档整理和翻译工具都帮你排好序啦。",
  },
};

export const AI_RADAR_SYNC_LINES = {
  syncing: {
    sena: "正在向 OpenRouter 星门、OpenAI/Claude 状态节点与 Ollama 仓库发送实时探测脉冲……请稍候。",
    sakura: "雷达天线旋转中~ 正在努力对齐各大 AI 模型的最新情报，马上就好哦♪",
  },
  live: {
    sena: "🟢 实时同步达成！8 大主流厂商模型目录、上下文窗口与官方服务状态均为最新实测数据。",
    sakura: "太棒啦，实时星讯接收成功♪ 所有 AI 模型的代表型号与在线状态都更新到最新鲜的一刻了！",
  },
  "partial-live": {
    sena: "🟡 部分实时同步完成：已刷新的来源已标绿，受限接口则由本地快照平稳兜底。",
    sakura: "收到一部分实时信号啦~ 其余模型目录由本地快照贴心补全，不影响正常查阅和直达官网哦。",
  },
  cache: {
    sena: "💾 外部接口暂时拥堵，已无缝切换至浏览器本地缓存记录——上次成功同步的真实坐标依然可靠。",
    sakura: "网络好像有一点点害羞呢，樱雪已经帮你调出了上次保存在本地的缓存手账啦~",
  },
  snapshot: {
    sena: "📦 当前处于构建快照基准模式。所有厂商旗舰型号、上下文参数与官网入口均由构建期实测快照提供兜底。",
    sakura: "目前展示的是打包好的精选构建快照哦，点击「立即同步」可以随时尝试连接最新实时信号♪",
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
export const CG_ARTWORKS = [
  {
    id: "cg-galgame", title: "夏海与入道云的彼岸", subtitle: "《GINKA》· Frontwing", tag: "Frontwing",
    bgWebp: "./art/cg-galgame.webp", bgJpg: "./art/cg-galgame.jpg", categoryHint: "Galgame 档案",
    luminance: 0.3845,
  },
  {
    ...artworkPaths("cg-ymgal"), title: "鸟白岛的夏夜", subtitle: "《Summer Pockets》· Key", tag: "Key 社",
  },
  {
    ...artworkPaths("cg-bangumi"), title: "沉没都市的海底微光", subtitle: "《ATRI -My Dear Moments-》· Frontwing × 枕", tag: "枕 × Frontwing",
  },
  {
    ...artworkPaths("cg-bili"), title: "暗夜蓝蝶与星光喫茶", subtitle: "《星光咖啡馆与死神之蝶》· Yuzusoft", tag: "Yuzusoft",
  },
  {
    id: "cg-pixiv", title: "暮色长街构想图", subtitle: "《白日梦的构想图》· Laplacian", tag: "Laplacian",
    bgWebp: "./art/cg-pixiv.webp", bgJpg: "./art/cg-pixiv.jpg", categoryHint: "二次元插画与社区",
    luminance: 0.2755,
  },
  {
    ...artworkPaths("cg-moegirl"), title: "花房晨光与花束", subtitle: "《PARQUET》· Yuzusoft SOUR", tag: "Yuzusoft SOUR",
  },
  {
    id: "cg-nightcafe", title: "暗夜银枪的魔女", subtitle: "《魔女的夜宴 Sabbat of the Witch》· Yuzusoft", tag: "Yuzusoft",
    bgWebp: "./art/cg-nightcafe.webp", bgJpg: "./art/cg-nightcafe.jpg", categoryHint: "动漫追番",
    luminance: 0.1304,
  },
  {
    id: "cg-radar", title: "冬木圣杯交锋之夜", subtitle: "《Fate/stay night REMASTERED》· TYPE-MOON", tag: "TYPE-MOON",
    bgWebp: "./art/cg-radar.webp", bgJpg: "./art/cg-radar.jpg", categoryHint: "AI 大模型入口",
    luminance: 0.0815,
  },
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

export function resolveMascotId(mascotPref, themeId) {
  if (mascotPref === "sena" || mascotPref === "sakura") return mascotPref;
  return THEME_VISUALS[themeId]?.defaultMascotId || "sena";
}

export function pickGreeting(mascotId, hour) {
  const { greetings } = MASCOTS[resolveMascotId(mascotId)];
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return greetings.default;
  if (hour >= 5 && hour <= 11) return greetings.morning;
  if (hour >= 12 && hour <= 18) return greetings.afternoon;
  return greetings.night;
}
