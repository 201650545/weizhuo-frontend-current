// Existing preview renderers retained as an internal scene source.
const legacyDocument = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>围桌 · 选本动效创意预览</title>
<style>
:root{
  --bg:#08080c;
  --panel:#101017;
  --panel-2:#16161f;
  --line:rgba(255,255,255,.09);
  --text:#f2f0ea;
  --muted:#9b9aa6;
  --gold:#d8b25f;
  --accent:#6fd3ff;
  --radius:18px;
  --sans:"PingFang SC","Noto Sans SC","Microsoft YaHei",system-ui,sans-serif;
  --serif:"Noto Serif SC","Songti SC","STSong",serif;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;min-height:100%}
body{
  background:var(--bg);color:var(--text);font-family:var(--sans);
  overflow-x:hidden;
}
/* 环境光：三块缓慢漂移的彩色光晕，制造舞台氛围
   blur 放在会动的元素自己身上：滤镜只烘焙一次，之后交给 GPU 做位移 */
.ambient{position:fixed;inset:-20vmax;z-index:0;pointer-events:none;opacity:.5}
.ambient i{position:absolute;display:block;border-radius:50%;filter:blur(64px);will-change:transform}
.ambient i:nth-child(1){width:46vmax;height:46vmax;left:-6vmax;top:-8vmax;background:radial-gradient(circle,#1d5f8a 0%,transparent 65%);animation:drift1 26s ease-in-out infinite}
.ambient i:nth-child(2){width:40vmax;height:40vmax;right:-10vmax;top:12vmax;background:radial-gradient(circle,#6a2f7a 0%,transparent 65%);animation:drift2 32s ease-in-out infinite}
.ambient i:nth-child(3){width:36vmax;height:36vmax;left:20vmax;bottom:-14vmax;background:radial-gradient(circle,#7a4a12 0%,transparent 65%);animation:drift1 38s ease-in-out infinite reverse}
@keyframes drift1{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(6vmax,4vmax,0) scale(1.12)}}
@keyframes drift2{0%,100%{transform:translate3d(0,0,0) scale(1.05)}50%{transform:translate3d(-6vmax,5vmax,0) scale(.95)}}
/* 左侧动画网关：按剧本杀流程分区，作为所有动画形态的入口 */
@media (min-width:960px){
  body{padding-left:236px}
  .gateway{position:fixed;inset:0 auto 0 0;width:236px;z-index:60;display:flex;flex-direction:column;padding:24px 16px 28px;background:#0a0908;border-right:1px solid rgba(255,255,255,.07);overflow-y:auto}
  .gw-title{font-family:var(--serif);font-size:16px;letter-spacing:.1em;color:#f3eee3}
  .gw-title small{display:block;margin-top:5px;font-family:var(--sans);font-size:10px;letter-spacing:.2em;color:var(--muted)}
  .gw-zone{margin-top:20px}
  .gw-zone h3{margin:0 0 7px;font-size:10px;letter-spacing:.2em;font-weight:500;color:var(--muted)}
  .gw-item{display:block;width:100%;text-align:left;border:1px solid transparent;background:none;color:rgba(255,255,255,.62);font:inherit;font-size:12px;line-height:1.4;padding:7px 9px;border-radius:6px;cursor:pointer;transition:background .18s,color .18s,border-color .18s}
  .gw-item:hover{background:rgba(255,255,255,.05);color:#fff}
  .gw-item.is-on{border-color:rgba(200,163,92,.45);background:rgba(200,163,92,.1);color:var(--gold)}
  .gw-item[disabled]{opacity:.28;cursor:default}
  .gateway .device-switch{margin:0 0 20px}
  .phone-stage.is-open{left:244px}
}
@media (max-width:959px){.gateway > :not(.device-switch){display:none}}
/* 赛博禅心式动效：光标体积光 + 标题遮罩浮起
   用一个小图层做位移，避免每次鼠标移动都重绘整屏渐变 */
.cursor-light{position:fixed;left:0;top:0;width:520px;height:520px;margin:-260px 0 0 -260px;z-index:45;pointer-events:none;opacity:0;transition:opacity .5s;mix-blend-mode:screen;background:radial-gradient(circle,rgba(255,198,128,.14),rgba(130,170,255,.05) 46%,transparent 72%);will-change:transform}
@media (pointer:coarse){.cursor-light{display:none}}
.panel.is-on .headline.is-in{animation:headIn .7s cubic-bezier(.22,.9,.24,1) both}
@keyframes headIn{from{opacity:0;transform:translateY(16px);filter:blur(6px)}}

/* ---------- 开场电影 ---------- */
.intro{position:relative;height:170vh;z-index:1}
.intro.is-skipped{display:none}
.intro-pin{position:sticky;top:0;height:100vh;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#050508}
.intro-light{position:absolute;inset:0;width:100%;height:100%;z-index:0;display:block;pointer-events:none}
body.webgl-light .intro-glow{display:none}
.intro-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 46%,rgba(216,178,95,.18),transparent 52%),radial-gradient(ellipse at 50% 50%,transparent 36%,rgba(0,0,0,.88) 100%);pointer-events:none}
.intro-glow{position:absolute;width:62vmin;height:62vmin;border-radius:50%;background:radial-gradient(circle,rgba(255,216,150,.45),rgba(255,168,78,.14) 46%,transparent 70%);filter:blur(28px);animation:breathe 5.6s ease-in-out infinite;pointer-events:none}
@keyframes breathe{0%,100%{transform:scale(.88);opacity:.5}50%{transform:scale(1.1);opacity:.92}}
.intro-copy{position:absolute;z-index:3;top:15%;left:0;right:0;text-align:center;padding:0 22px;will-change:transform,opacity}
.intro-kicker{margin:0 0 20px;font-size:11px;letter-spacing:.5em;color:var(--gold)}
.intro-title{margin:0;font-family:var(--serif);font-size:clamp(34px,9.2vw,68px);line-height:1.18;letter-spacing:.14em;color:#fff}
.intro-title span{display:block;will-change:transform,opacity,filter}
.intro-sub{margin:18px 0 0;font-size:12px;letter-spacing:.34em;color:rgba(255,255,255,.55)}
.cards-fan{position:absolute;inset:0;z-index:2;pointer-events:none}
/* 光落在桌面上的那一摊，加上体积尘 */
.intro-pool{position:absolute;left:50%;bottom:2%;width:66vw;height:24vh;transform:translateX(-50%);background:radial-gradient(ellipse at 50% 50%,rgba(255,226,180,.20),rgba(255,200,130,.06) 46%,transparent 72%);filter:blur(24px);opacity:0;pointer-events:none;z-index:0}
.intro-dust{position:absolute;inset:0;pointer-events:none;opacity:0;overflow:hidden;z-index:1}
.intro-dust i{position:absolute;width:2px;height:2px;border-radius:50%;background:rgba(255,236,200,.8);box-shadow:0 0 6px rgba(255,220,160,.7);animation:dustFloat linear infinite;will-change:transform,opacity}
@keyframes dustFloat{0%{transform:translate3d(0,0,0);opacity:0}16%,78%{opacity:.55}100%{transform:translate3d(8px,-78px,0);opacity:0}}
/* 光收成缝，六本从这里浮出 */
.intro-seam{position:absolute;left:50%;top:50%;width:min(16vw,190px);height:58vh;z-index:1;transform:translate(-50%,-50%) scale(.01,.02);transform-origin:50% 50%;will-change:transform,opacity;border-radius:6px;background:linear-gradient(90deg,transparent 0%,rgba(255,214,150,.10) 24%,rgba(255,234,196,.4) 50%,rgba(255,214,150,.10) 76%,transparent 100%),linear-gradient(180deg,transparent 0%,rgba(255,238,200,.45) 26%,rgba(255,238,200,.45) 72%,transparent 100%);box-shadow:0 0 120px 30px rgba(255,196,120,.18);opacity:0;pointer-events:none;filter:blur(10px);mix-blend-mode:screen}
/* 裂缝：边缘不规则的竖口，书从这里被吸走 */
.intro-rift{position:absolute;left:50%;top:50%;width:min(10vw,120px);height:74vh;transform:translate(-50%,-50%) scaleX(.12);transform-origin:50% 50%;z-index:1;pointer-events:none;opacity:0;background:linear-gradient(180deg,transparent 0%,rgba(255,226,176,.6) 14%,#fffdf2 48%,rgba(255,226,176,.6) 84%,transparent 100%);box-shadow:0 0 90px 26px rgba(255,206,140,.26);clip-path:polygon(47% 0,55% 7%,46% 14%,56% 22%,45% 31%,54% 39%,46% 48%,57% 57%,45% 66%,54% 75%,47% 84%,56% 92%,48% 100%,52% 92%,44% 84%,53% 75%,43% 66%,55% 57%,43% 48%,52% 39%,44% 31%,55% 22%,43% 14%,53% 7%,45% 0);filter:blur(5px);mix-blend-mode:screen}
.cards-fan img{position:absolute;left:50%;top:50%;width:min(52vw,220px);aspect-ratio:2/3;object-fit:cover;border-radius:8px;box-shadow:0 34px 66px -26px rgba(0,0,0,.95);opacity:0;transform:translate(-50%,-50%) scale(.6);will-change:transform,opacity}
.intro-end{position:absolute;z-index:4;left:0;right:0;bottom:12%;text-align:center;padding:0 24px;opacity:0;will-change:opacity}
.intro-end h2{margin:0 0 8px;font-family:var(--serif);font-size:clamp(24px,6.4vw,34px);letter-spacing:.16em;color:#fff}
.intro-end p{margin:0 0 22px;font-size:12px;letter-spacing:.26em;color:rgba(255,255,255,.55)}
.intro-cta{border:1px solid rgba(216,178,95,.85);background:rgba(216,178,95,.1);color:#ffe2a0;padding:12px 32px;border-radius:999px;font-size:13px;letter-spacing:.22em;font-family:inherit}
.intro-hint{position:absolute;bottom:26px;left:0;right:0;text-align:center;font-size:10.5px;letter-spacing:.3em;color:rgba(255,255,255,.42)}
.intro-hint i{display:block;width:1px;height:26px;margin:10px auto 0;background:linear-gradient(180deg,rgba(255,255,255,.6),transparent);animation:hint 1.8s ease-in-out infinite}
@keyframes hint{0%,100%{opacity:.2;transform:translateY(-4px)}50%{opacity:1;transform:none}}
/* 掉落段：y 轴时空，纸页与光柱向上掠过 */
.intro-fall{position:absolute;inset:0;z-index:2;opacity:0;pointer-events:none;overflow:hidden;will-change:opacity}
.fall-shaft{position:absolute;left:50%;top:-14%;width:34vmin;height:130%;transform:translateX(-50%);background:linear-gradient(180deg,rgba(255,230,180,.5),rgba(255,204,126,.16) 38%,rgba(255,190,110,0) 76%);filter:blur(20px)}
.fall-streaks{position:absolute;inset:-30% -20%;opacity:.45;background:repeating-linear-gradient(90deg,transparent 0 42px,rgba(255,226,176,.22) 42px 43px,transparent 43px 88px);transform:perspective(520px) rotateX(66deg);animation:fallRun 1.4s linear infinite}
.fall-streaks.b{opacity:.22;background:repeating-linear-gradient(90deg,transparent 0 22px,rgba(255,236,196,.2) 22px 23px,transparent 23px 61px);animation-duration:.9s;animation-direction:reverse}
@keyframes fallRun{from{background-position:0 0}to{background-position:0 -240px}}
.fall-white{position:absolute;inset:0;opacity:0;background:radial-gradient(circle at 50% 44%,#fffaf0 0%,#ffeccb 32%,#ffdca8 66%,#e8b77a 100%)}
/* 掉落段以外的整段时间里不跑这两条速度线，省掉两块全屏重绘 */
.intro-fall .fall-streaks{animation-play-state:paused}
.intro-fall.is-on .fall-streaks{animation-play-state:running}
/* 进走廊的一瞬：整屏是亮的，光再慢慢散掉 */
.depth-light{position:absolute;inset:0;z-index:11;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 45%,#fffaf0 0%,#ffeccb 32%,#ffd9a3 66%,#d8a76a 100%)}
/* 宿主大屏：顶光＋二维码入席 */
.host-gate{position:fixed;inset:0 0 0 236px;z-index:90;display:none;align-items:center;justify-content:center;background:#050508;overflow:hidden}
.host-gate.is-on{display:flex}
.host-beam{position:absolute;inset:0;background:radial-gradient(ellipse 60% 55% at 50% 0%,rgba(255,216,152,.26),rgba(255,190,110,.08) 44%,transparent 72%)}
.host-beam::after{content:"";position:absolute;left:50%;top:0;width:26vmin;height:86%;transform:translateX(-50%);background:linear-gradient(180deg,rgba(255,232,190,.34),rgba(255,210,140,.06) 55%,transparent 78%);filter:blur(20px)}
.host-inner{position:relative;z-index:2;text-align:center;padding:46px 56px 32px;border:1px solid rgba(216,178,95,.32);border-radius:26px;background:rgba(10,9,8,.58);backdrop-filter:blur(8px);box-shadow:0 40px 120px -30px rgba(0,0,0,.95)}
.host-kicker{margin:0 0 12px;font-size:11px;letter-spacing:.44em;color:var(--gold)}
.host-inner h2{margin:0 0 24px;font-family:var(--serif);font-size:clamp(28px,3.4vw,42px);letter-spacing:.18em;color:#fff}
.host-qr{width:206px;height:206px;margin:0 auto 22px;padding:10px;background:#f7f3e8;border-radius:10px;box-shadow:0 14px 52px rgba(0,0,0,.7)}
.host-qr canvas{width:100%;height:100%;display:block;image-rendering:pixelated}
.host-sub{margin:0 0 24px;font-size:13px;letter-spacing:.2em;color:rgba(255,255,255,.6)}
.host-sim{border:1px solid rgba(216,178,95,.85);background:rgba(216,178,95,.12);color:#ffe2a0;padding:13px 30px;border-radius:999px;font:inherit;font-size:13.5px;letter-spacing:.16em;cursor:pointer}
.host-skip{display:block;margin:18px auto 0;background:none;border:0;color:rgba(255,255,255,.32);font:inherit;font-size:11.5px;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.host-note{margin:14px 0 0;font-size:10.5px;letter-spacing:.1em;color:rgba(255,255,255,.26)}
@media (max-width:959px){.host-gate{display:none!important}}
/* 首屏自演：用 CSS 动画按真实时间完成，后台标签也不会卡在中间态 */
.intro.is-live .intro-kicker{opacity:1;transition:opacity .9s ease .05s}
.intro.is-live .intro-title span{animation:lineIn 1.05s cubic-bezier(.22,.9,.24,1) both}
.intro.is-live .intro-title span:nth-child(2){animation-delay:.16s}
.intro.is-live .intro-sub{opacity:1;transition:opacity 1s ease .55s}
@keyframes lineIn{from{opacity:0;transform:translateY(30px);filter:blur(11px)}to{opacity:1;transform:none;filter:blur(0)}}

.wrap{position:relative;z-index:1;max-width:1100px;margin:0 auto;padding:18px 16px 120px}
header.top{display:flex;flex-direction:column;gap:14px;padding:6px 2px 14px}
.crumbs{display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin:0 0 22px;font-size:11.5px;letter-spacing:.08em;color:var(--dim)}
.crumbs a{color:var(--gold);text-decoration:none;border-bottom:1px solid rgba(200,163,92,.35);padding-bottom:2px}
.crumbs a:hover{color:#f0d9a8;border-color:#f0d9a8}
.crumbs span{color:var(--dim)}
/* 设备开关：是左侧网关的第一项，跟标题、流程项排在同一列里，不压任何东西 */
.device-switch{display:flex;margin:12px;border:1px solid #3a332a;border-radius:8px;overflow:hidden;background:#0d0b09}
.device-switch button{flex:1;border:0;background:transparent;color:#9d9486;padding:8px 15px;font:inherit;font-size:12px;letter-spacing:.1em;cursor:pointer;transition:.16s}
.device-switch button:hover{color:#efe8da}
.device-switch button[aria-pressed="true"]{background:var(--gold);color:#17120b}
.phone-stage{position:fixed;inset:0;z-index:200;display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#050403;overflow:auto;padding:20px 20px 26px}
.phone-stage.is-open{display:flex}
.phone-frame{width:390px;height:844px;max-height:calc(100vh - 120px);border-radius:44px;border:1px solid #2a2620;background:#000;padding:10px;box-shadow:0 40px 120px -30px #000,0 0 0 1px rgba(200,163,92,.18)}
.phone-frame iframe{width:100%;height:100%;border:0;border-radius:34px;background:#050403}
.phone-actions{display:flex;gap:10px}
.phone-actions button{border:1px solid #3a332a;background:#12100d;color:#d8cfbf;border-radius:6px;padding:9px 16px;font:inherit;font-size:12px;letter-spacing:.1em;cursor:pointer}
.phone-actions button:hover{border-color:var(--gold);color:#f0d9a8}
.phone-frame{max-height:calc(100vh - 172px)}
.phone-plans{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;font-size:11px;letter-spacing:.14em;color:#8d8375}
.phone-plans button{border:1px solid #3a332a;background:#12100d;color:#d8cfbf;border-radius:999px;padding:6px 13px;font:inherit;font-size:12px;letter-spacing:.08em;cursor:pointer}
.phone-plans button:hover{border-color:var(--gold);color:#f0d9a8}
.phone-plans button[aria-pressed="true"]{border-color:rgba(200,163,92,.5);background:rgba(200,163,92,.12);color:var(--gold)}
.phone-tab{border-color:rgba(200,163,92,.5);color:var(--gold)}
.kicker{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px;letter-spacing:.22em}
.kicker b{color:var(--gold);font-weight:600;letter-spacing:.1em}
h1{margin:0;font-family:var(--serif);font-size:clamp(24px,6vw,40px);font-weight:600;line-height:1.2}
h1 span{background:linear-gradient(92deg,#7ee0ff,#c7a2ff 42%,#ffd27a);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{margin:0;color:var(--muted);font-size:13px;line-height:1.7}
.replay-intro{margin-left:8px;padding:0;border:0;background:none;color:var(--gold);font:inherit;font-size:12px;text-decoration:underline;text-underline-offset:3px;cursor:pointer}

.tabs{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 6px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.tabs::-webkit-scrollbar{display:none}
.tab{flex:0 0 auto;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--muted);border-radius:999px;padding:9px 15px;font-size:13px;font-family:inherit;transition:.25s;white-space:nowrap}
.tab:hover{color:var(--text);border-color:rgba(255,255,255,.25)}
.tab.is-on{color:#0c0c12;background:linear-gradient(120deg,#ffe3a3,#d8b25f);border-color:transparent;box-shadow:0 6px 24px -8px rgba(216,178,95,.8)}

.panel{display:none;animation:fade .45s ease both}
.panel.is-on{display:block}
@keyframes fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}

.headline{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px 14px;margin:18px 2px 4px}
.headline h2{margin:0;font-size:20px;font-family:var(--serif);font-weight:600}
.headline p{margin:0;color:var(--muted);font-size:12.5px}
.tag{font-size:11px;letter-spacing:.08em;color:var(--gold);border:1px solid rgba(216,178,95,.35);border-radius:999px;padding:3px 9px}

/* ---------- 方案 1：3D 封面流 ---------- */
.cf-stage{position:relative;height:min(58vh,430px);margin:18px 0 8px;perspective:1100px;perspective-origin:50% 45%;touch-action:pan-y;user-select:none}
.cf-track{position:absolute;inset:0;transform-style:preserve-3d}
.cf-card{position:absolute;left:50%;top:50%;width:172px;height:258px;margin:-129px 0 0 -86px;border-radius:14px;transform-style:preserve-3d;cursor:pointer;transition:transform .55s cubic-bezier(.22,.9,.24,1),opacity .45s;will-change:transform}
.cf-face{position:absolute;inset:0;border-radius:14px;border:1px solid rgba(255,255,255,.16);overflow:hidden;display:flex;align-items:center;justify-content:center;background:linear-gradient(155deg,var(--c1),var(--c2));box-shadow:0 30px 60px -22px rgba(0,0,0,.9),0 0 0 1px rgba(0,0,0,.5) inset}
.cf-face::after{content:"";position:absolute;inset:0;background:linear-gradient(120deg,rgba(255,255,255,.22),transparent 38%,transparent 62%,rgba(0,0,0,.35))}
.cf-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
.cf-veil{position:absolute;inset:0;z-index:1;background:linear-gradient(0deg,rgba(0,0,0,.75),rgba(0,0,0,.12) 55%,rgba(0,0,0,.35))}
.cf-face strong{writing-mode:vertical-rl;font-family:var(--serif);font-size:25px;letter-spacing:.32em;color:#fff;text-shadow:0 2px 18px rgba(0,0,0,.65);position:relative;z-index:1}
.cf-card .cf-glow{position:absolute;inset:-26px;border-radius:24px;background:radial-gradient(circle at 50% 50%,var(--glow),transparent 68%);opacity:0;transition:opacity .5s;pointer-events:none;z-index:-1}
.cf-card.is-focus .cf-glow{opacity:.9}
.cf-card.is-focus .cf-face{border-color:rgba(255,255,255,.5);box-shadow:0 40px 80px -26px rgba(0,0,0,.95),0 0 0 1px rgba(255,255,255,.14) inset}
.cf-meta{text-align:center;margin-top:6px}
.cf-meta strong{display:block;font-family:var(--serif);font-size:19px;letter-spacing:.06em}
.cf-meta small{color:var(--muted);font-size:12px}
.cf-dots{display:flex;justify-content:center;gap:7px;margin-top:14px}
.cf-dot{width:6px;height:6px;border-radius:99px;background:rgba(255,255,255,.22);transition:.3s}
.cf-dot.is-on{width:22px;background:var(--gold);box-shadow:0 0 14px rgba(216,178,95,.9)}

/* ---------- 方案 2：翻开封面 ---------- */
.books{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:18px;perspective:1400px}
@media(min-width:720px){.books{grid-template-columns:repeat(3,1fr);gap:22px}}
.book{position:relative;aspect-ratio:3/4.15;transform-style:preserve-3d;cursor:pointer}
.book-page{position:absolute;inset:0;border-radius:10px 14px 14px 10px;padding:16px 14px;background:linear-gradient(170deg,#efe9dc,#d8d0bf);color:#241f1a;overflow:hidden;display:flex;flex-direction:column;gap:8px;box-shadow:inset 12px 0 22px -18px rgba(0,0,0,.7)}
.book-page h3{margin:0;font-family:var(--serif);font-size:16px}
.book-page p{margin:0;font-size:11px;line-height:1.65;color:#4a4038;display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden}
.book-page small{margin-top:auto;font-size:10px;color:#7a6d5d;letter-spacing:.08em}
.book-cover{position:absolute;inset:0;border-radius:10px 14px 14px 10px;overflow:hidden;transform-origin:left center;transition:transform .85s cubic-bezier(.3,.75,.2,1),box-shadow .6s;transform-style:preserve-3d;background:linear-gradient(160deg,var(--c1),var(--c2));display:flex;align-items:center;justify-content:center;box-shadow:6px 10px 28px -12px rgba(0,0,0,.9)}
.book-cover::before{content:"";position:absolute;left:0;top:0;bottom:0;width:9px;background:linear-gradient(90deg,rgba(0,0,0,.5),rgba(255,255,255,.08))}
.book-cover::after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.18),transparent 42%,transparent 60%,rgba(0,0,0,.4));pointer-events:none;z-index:2}
.book-cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
.book-cover .bc-veil{position:absolute;inset:0;z-index:1;background:linear-gradient(0deg,rgba(0,0,0,.7),rgba(0,0,0,.08) 55%,rgba(0,0,0,.3))}
.book-cover strong{position:relative;z-index:3}
.book-cover strong{writing-mode:vertical-rl;font-family:var(--serif);font-size:21px;letter-spacing:.3em;color:#fff;text-shadow:0 3px 18px rgba(0,0,0,.6)}
.book.is-open .book-cover{transform:rotateY(-158deg);box-shadow:-10px 12px 24px -14px rgba(0,0,0,.8)}
.book-hint{position:absolute;left:0;right:0;bottom:-4px;text-align:center;font-size:11px;color:var(--muted);letter-spacing:.1em}

/* ---------- 方案 3：牌堆 ---------- */
.deck-stage{position:relative;height:min(60vh,440px);margin:20px 0 6px;display:flex;align-items:center;justify-content:center}
.deck{position:relative;width:200px;height:300px}
.deck-card{position:absolute;inset:0;border-radius:16px;overflow:hidden;background:linear-gradient(155deg,var(--c1),var(--c2));border:1px solid rgba(255,255,255,.18);box-shadow:0 26px 60px -22px rgba(0,0,0,.95);display:flex;align-items:center;justify-content:center;transition:transform .5s cubic-bezier(.22,.9,.24,1),opacity .4s;transform-origin:50% 100%;will-change:transform}
.deck-card::after{content:"";position:absolute;inset:0;background:linear-gradient(120deg,rgba(255,255,255,.2),transparent 40%,transparent 62%,rgba(0,0,0,.4));z-index:2}
.deck-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
.deck-card .deck-veil{position:absolute;inset:0;z-index:1;background:linear-gradient(0deg,rgba(0,0,0,.72),rgba(0,0,0,.1) 55%,rgba(0,0,0,.3))}
.deck-card strong{writing-mode:vertical-rl;font-family:var(--serif);font-size:26px;letter-spacing:.3em;color:#fff;text-shadow:0 3px 20px rgba(0,0,0,.7);position:relative;z-index:3}
.deck-card.dragging{transition:none}
.deck-bar{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:8px}
.deck-btn{border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--text);border-radius:999px;padding:10px 20px;font-size:13px;font-family:inherit}
.deck-btn:hover{border-color:var(--gold);color:var(--gold)}
.deck-count{color:var(--muted);font-size:12px;letter-spacing:.16em;min-width:56px;text-align:center}

/* ---------- 方案 4：光斑倾斜 ---------- */
.tilt-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:18px;perspective:900px}
@media(min-width:720px){.tilt-grid{grid-template-columns:repeat(3,1fr);gap:20px}}
.tilt{position:relative;aspect-ratio:3/4;border-radius:16px;overflow:hidden;transform-style:preserve-3d;transition:transform .18s ease-out,box-shadow .3s;background:linear-gradient(160deg,var(--c1),var(--c2));border:1px solid rgba(255,255,255,.14);box-shadow:0 20px 44px -24px rgba(0,0,0,.9);cursor:pointer}
.tilt::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at var(--mx,50%) var(--my,40%),rgba(255,255,255,.55),rgba(255,255,255,.12) 26%,transparent 58%);opacity:.55;mix-blend-mode:screen;pointer-events:none}
.tilt::after{content:"";position:absolute;inset:0;background:linear-gradient(125deg,rgba(255,255,255,.16),transparent 45%,rgba(0,0,0,.42));z-index:2}
.tilt img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
.tilt .tilt-veil{position:absolute;inset:0;z-index:1;background:linear-gradient(0deg,rgba(0,0,0,.72),rgba(0,0,0,.1) 60%,rgba(0,0,0,.28))}
.tilt strong{z-index:3}
.tilt .tilt-sub{z-index:3}
.tilt strong{position:absolute;left:0;right:0;bottom:14px;text-align:center;font-family:var(--serif);font-size:17px;letter-spacing:.14em;color:#fff;text-shadow:0 3px 16px rgba(0,0,0,.8);transform:translateZ(34px)}
.tilt .tilt-sub{position:absolute;top:12px;left:0;right:0;text-align:center;font-size:10.5px;letter-spacing:.2em;color:rgba(255,255,255,.75);transform:translateZ(18px)}

/* ---------- 方案 5：书脊书架 ---------- */
.shelf{display:flex;align-items:flex-end;gap:8px;height:min(56vh,420px);margin:22px 0 10px;padding:0 2px 18px;border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none;touch-action:pan-x}
.shelf::-webkit-scrollbar{display:none}
.spine{flex:0 0 44px;height:88%;border-radius:8px 8px 4px 4px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(165deg,var(--c1),var(--c2));display:flex;align-items:center;justify-content:center;transition:flex-basis .45s cubic-bezier(.22,.9,.24,1),height .45s,box-shadow .4s,filter .4s;cursor:pointer;position:relative;overflow:hidden}
.spine span{writing-mode:vertical-rl;font-family:var(--serif);font-size:14px;letter-spacing:.28em;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.6);white-space:nowrap}
.spine:hover{filter:brightness(1.25);box-shadow:0 0 24px -4px var(--glow)}
.spine.is-on{flex-basis:210px;height:100%;box-shadow:0 24px 50px -18px rgba(0,0,0,.9),0 0 34px -8px var(--glow)}
.spine.is-on span{writing-mode:horizontal-tb;font-size:24px;letter-spacing:.14em;transform:rotate(0)}
.spine.is-on::after{content:attr(data-genre);position:absolute;bottom:16px;left:18px;right:18px;font-family:var(--sans);font-size:11.5px;letter-spacing:.12em;color:rgba(255,255,255,.82);text-align:center}
.shelf-note{text-align:center;color:var(--muted);font-size:12px;letter-spacing:.1em}

/* ---------- 方案 6：滚动电影 ---------- */
.cine{position:relative;height:320vh;margin-top:10px}
.cine-sticky{position:sticky;top:0;height:100vh;overflow:hidden;display:flex;align-items:center}
.cine-track{display:flex;gap:18px;padding:0 8vw;will-change:transform}
.cine-card{flex:0 0 74vw;max-width:360px;height:min(58vh,400px);border-radius:20px;overflow:hidden;position:relative;border:1px solid rgba(255,255,255,.16);background:linear-gradient(158deg,var(--c1),var(--c2));box-shadow:0 30px 70px -28px rgba(0,0,0,.95)}
.cine-card::after{content:"";position:absolute;inset:0;background:linear-gradient(125deg,rgba(255,255,255,.18),transparent 40%,transparent 62%,rgba(0,0,0,.5));z-index:2}
.cine-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
.cine-card .cine-veil{position:absolute;inset:0;z-index:1;background:linear-gradient(0deg,rgba(0,0,0,.78),rgba(0,0,0,.12) 60%,rgba(0,0,0,.3))}
.cine-card .num{z-index:3}
.cine-card strong{z-index:3}
.cine-card small{z-index:3}
.cine-card .num{position:absolute;top:14px;left:18px;font-family:var(--serif);font-size:56px;line-height:1;color:rgba(255,255,255,.2)}
.cine-card strong{position:absolute;left:22px;bottom:56px;font-family:var(--serif);font-size:26px;letter-spacing:.12em;color:#fff;text-shadow:0 4px 22px rgba(0,0,0,.7)}
.cine-card small{position:absolute;left:22px;bottom:26px;font-size:12px;color:rgba(255,255,255,.8);letter-spacing:.1em}
.cine-tip{position:fixed;left:0;right:0;bottom:26px;text-align:center;font-size:12px;color:var(--muted);letter-spacing:.14em;pointer-events:none;opacity:0;transition:.4s}
.cine-tip.is-on{opacity:1}

/* ---------- 方案 7：纵深通道（沉浸式第一人称） ---------- */
/* ---- 扫码入场 A/B 对比 ---- */
.ac-stage{display:flex;gap:26px;justify-content:center;flex-wrap:wrap;padding:12px 0 4px}
.ac-col{width:330px;flex:0 0 auto}
.ac-cap{display:flex;align-items:baseline;gap:8px;margin-bottom:9px}
.ac-cap b{font:400 13px/1 var(--serif);letter-spacing:.1em;color:var(--gold)}
.ac-cap span{font:400 10.5px/1.5 var(--sans);color:var(--muted)}
.ac-phone{position:relative;width:330px;height:660px;border:1px solid rgba(255,255,255,.12);border-radius:22px;
  background:#040303;overflow:hidden;font-family:var(--serif);color:#efe8da;
  box-shadow:0 26px 70px -24px #000,inset 0 0 0 1px rgba(255,255,255,.03)}
.ac-phone > *{position:absolute;inset:0}
.ac-corridor{overflow:hidden;background:#060504;opacity:0;transition:opacity .7s}
.ac-phone[data-step="corridor"] .ac-corridor{opacity:1}
.ac-mask{position:absolute;inset:0;z-index:2;pointer-events:none;
  background:linear-gradient(180deg,#060504 0%,rgba(6,5,4,.46) 14%,transparent 32%,transparent 68%,rgba(6,5,4,.52) 86%,#060504 100%)}
.ac-track{position:absolute;inset:auto 0 auto 0;top:calc(50% - 78px);display:flex;flex-direction:column;gap:12px;
  transition:transform .85s cubic-bezier(.22,.72,.2,1)}
.ac-book{position:relative;height:156px;margin:0 26px;border-radius:5px;overflow:hidden;
  filter:brightness(.35) saturate(.6);transition:filter .55s,transform .55s}
.ac-book img{width:100%;height:100%;object-fit:cover;display:block}
.ac-book::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,3,3,.1),rgba(4,3,3,.72))}
.ac-book.on{filter:none;transform:scale(1.04)}
.ac-book span{position:absolute;left:14px;bottom:12px;z-index:2;font:400 13px/1.2 var(--serif);letter-spacing:.12em;color:#f4ecdc;opacity:0;transition:opacity .5s}
.ac-book.on span{opacity:1}
.ac-meta{inset:auto 20px 24px 20px;z-index:3;text-align:center}
.ac-meta em{display:block;font:400 9px/1 var(--sans);letter-spacing:.3em;color:var(--gold);font-style:normal}
.ac-meta h3{margin:7px 0 4px;font:400 17px/1.2 var(--serif);letter-spacing:.18em;color:#f6efe1}
.ac-meta p{margin:0;font:400 9.5px/1.5 var(--sans);letter-spacing:.06em;color:#8d8476}
.ac-layers{overflow:hidden}
.ac-layer{position:absolute;inset:-4%;background-size:cover;background-position:center;opacity:0;transform:scale(1.08);
  filter:saturate(.5) brightness(.7) blur(1.6px);transition:opacity .35s,transform 4s linear}
.ac-layer.on{opacity:.2;transform:scale(1)}
.ac-phone[data-step="blend"] .ac-layer.on{opacity:.5;filter:saturate(.6) brightness(1.25) blur(.6px);transform:scale(1.05)}
.ac-phone[data-step="focus"] .ac-layer.on{opacity:.9;filter:saturate(.85) brightness(.72);transform:scale(1.02)}
.ac-phone[data-step="focus"] .ac-layer:not(.on){opacity:0}
.ac-slit{inset:auto;left:50%;top:50%;width:0;height:2px;transform:translate(-50%,-50%);
  background:linear-gradient(90deg,transparent,rgba(255,248,232,.95),transparent);
  box-shadow:0 0 30px rgba(255,236,200,.9),0 0 80px rgba(255,214,150,.45);
  transition:width 1s cubic-bezier(.16,.8,.3,1),height 1s ease,opacity .7s}
.ac-phone[data-step="slit"] .ac-slit,.ac-phone[data-step="blend"] .ac-slit{width:124%}
.ac-phone[data-step="blend"] .ac-slit{height:58%;opacity:.16}
.ac-phone[data-step="focus"] .ac-slit{width:100%;height:100%;opacity:0}
.ac-scan{pointer-events:none;opacity:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 3px);transition:opacity .6s}
.ac-phone[data-step="blend"] .ac-scan,.ac-phone[data-step="focus"] .ac-scan{opacity:.5}
.ac-year{inset:auto;left:20px;top:28px;font:400 8.5px/1 var(--sans);letter-spacing:.32em;color:rgba(201,168,106,.6);opacity:0;transition:opacity .8s}
.ac-phone[data-step="blend"] .ac-year,.ac-phone[data-step="focus"] .ac-year{opacity:1}
.ac-focus{inset:auto 22px 58px 22px;text-align:center;opacity:0;transform:translateY(12px);transition:opacity .8s,transform .8s}
.ac-phone[data-step="focus"] .ac-focus{opacity:1;transform:none}
.ac-focus em{display:block;font:400 9px/1 var(--sans);letter-spacing:.32em;color:var(--gold);font-style:normal}
.ac-focus h3{margin:8px 0 5px;font:400 22px/1.2 var(--serif);letter-spacing:.24em;color:#f7f0e2}
.ac-focus p{margin:0;font:400 9.5px/1.5 var(--sans);color:#918879}
.ac-bar{display:flex;justify-content:center;padding:12px 0 8px}
.ac-bar button{border:1px solid rgba(216,178,95,.5);background:rgba(216,178,95,.12);color:var(--gold);
  border-radius:999px;padding:10px 20px;font:400 12px/1 var(--sans);letter-spacing:.1em;cursor:pointer;transition:.2s}
.ac-bar button:hover{background:rgba(216,178,95,.22)}
@media (max-width:760px){.ac-stage{gap:12px}.ac-col{width:100%;max-width:330px;height:auto}.ac-phone{width:100%;height:auto;aspect-ratio:1/2;transform:none}}

.panel[data-panel="depth"]{position:fixed;inset:0;z-index:55;display:none;background:#040408;animation:none}
.panel[data-panel="depth"].is-on{display:block}
.depth-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none}
.depth-scroll::-webkit-scrollbar{display:none}
.depth-track{height:620vh}
.depth-pin{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden;background:radial-gradient(ellipse at 50% 42%,#12101a 0%,#06060a 62%,#030305 100%)}
.depth-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab}
.depth-canvas:active{cursor:grabbing}
.depth-hud{position:absolute;left:0;right:0;top:0;z-index:6;display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:calc(18px + env(safe-area-inset-top)) 20px 0;pointer-events:none}
@media(min-width:960px){.depth-hud{padding-left:calc(236px + 26px)}}
.depth-hud-l{display:flex;flex-direction:column;gap:4px}
.depth-kicker{font-size:10px;letter-spacing:.32em;color:rgba(216,178,95,.85)}
.depth-now{font-family:var(--serif);font-size:21px;font-weight:600;letter-spacing:.12em;color:#fff;transition:.35s}
.depth-sub{font-size:11px;letter-spacing:.16em;color:rgba(255,255,255,.5)}
.depth-quit{pointer-events:auto;border:1px solid rgba(255,255,255,.18);background:rgba(10,10,14,.55);color:rgba(255,255,255,.75);border-radius:999px;padding:8px 16px;font:inherit;font-size:12px;letter-spacing:.16em;cursor:pointer;backdrop-filter:blur(8px)}
.depth-quit:hover{border-color:var(--gold);color:var(--gold)}
.depth-rail{position:absolute;right:16px;top:50%;z-index:6;width:2px;height:140px;margin-top:-70px;border-radius:2px;background:rgba(255,255,255,.1);overflow:hidden}
@media(min-width:960px){.depth-rail{right:26px}}
.depth-rail i{display:block;width:100%;height:0;background:linear-gradient(180deg,#ffe3a3,var(--gold));box-shadow:0 0 12px rgba(216,178,95,.8)}
.depth-hint{position:absolute;left:0;right:0;bottom:calc(24px + env(safe-area-inset-bottom));z-index:6;margin:0;padding:0 18px;text-align:center;font-size:11px;letter-spacing:.18em;color:rgba(255,255,255,.44);pointer-events:none;transition:opacity .4s}
/* ---------- 横向次元：翻开剧本（跨页阅读） ---------- */
.dspread{position:absolute;inset:0;z-index:7;display:flex;align-items:center;justify-content:center;padding:clamp(84px,12vh,116px) 18px clamp(58px,9vh,82px);pointer-events:none}
@media (min-width:960px){.dspread{padding-left:calc(236px + 26px);padding-right:26px}}
.dspread-book{position:relative;display:flex;width:min(100%,1000px);max-height:100%;pointer-events:auto;touch-action:none;filter:drop-shadow(0 40px 80px rgba(0,0,0,.62));opacity:0;transform:translateY(14px) scale(.985);transition:opacity .5s ease,transform .62s cubic-bezier(.22,.9,.24,1)}
.dspread.is-on .dspread-book{opacity:1;transform:none}
.dspread-left{position:relative;flex:0 0 36%;overflow:hidden;border:1px solid rgba(216,178,95,.24);border-right:0;border-radius:14px 0 0 14px;background:#08080d}
.dspread-left img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.dspread-left .dsp-veil{position:absolute;inset:0;background:linear-gradient(0deg,rgba(4,4,8,.95),rgba(4,4,8,.1) 52%,rgba(4,4,8,.45))}
.dsp-id{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:26px 24px 24px}
.dsp-id small{display:block;font-size:10px;letter-spacing:.3em;color:rgba(216,178,95,.9)}
.dsp-id strong{display:block;margin-top:8px;font-family:var(--serif);font-size:clamp(24px,3.4vw,34px);letter-spacing:.12em;color:#fff}
.dsp-id .dsp-seats{display:block;margin-top:10px;font-size:11px;letter-spacing:.16em;color:rgba(255,255,255,.55)}
.dsp-spine{position:absolute;top:0;right:0;bottom:0;width:18px;pointer-events:none;background:linear-gradient(90deg,rgba(0,0,0,.55),rgba(0,0,0,.08))}
.dspread-right{position:relative;flex:1;display:flex;flex-direction:column;border:1px solid rgba(216,178,95,.24);border-left:0;border-radius:0 14px 14px 0;background:linear-gradient(180deg,#111017,#0a0a10);overflow:hidden}
.dsp-pages{position:relative;flex:1;min-height:0;display:grid;padding:26px 32px 18px;perspective:1200px}
.dsp-page{grid-area:1/1;min-height:0;opacity:0;pointer-events:none;transform:translate3d(7%,0,0) rotateY(-7deg);transform-origin:left center;transition:opacity .34s ease,transform .52s cubic-bezier(.22,.9,.24,1);backface-visibility:hidden;will-change:transform,opacity}
.dsp-page.is-out{opacity:0;pointer-events:none;transform:translate3d(-6%,0,0) rotateY(6deg);transform-origin:right center;transition-duration:.3s}
.dsp-page.is-on{opacity:1;pointer-events:auto;transform:none}
/* 翻页停稳后再让内容错峰浮起，读的时候纸面是静的 */
.dsp-page.is-on > *{animation:dspRise .56s cubic-bezier(.22,.9,.24,1) both}
.dsp-page.is-on > *:nth-child(1){animation-delay:.04s}
.dsp-page.is-on > *:nth-child(2){animation-delay:.1s}
.dsp-page.is-on > *:nth-child(3){animation-delay:.17s}
.dsp-page.is-on > *:nth-child(4){animation-delay:.24s}
@keyframes dspRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.dsp-kicker{display:block;font-size:10px;letter-spacing:.34em;color:var(--gold)}
.dsp-page h3{margin:9px 0 16px;font-family:var(--serif);font-size:clamp(21px,2.6vw,29px);font-weight:600;letter-spacing:.1em}
.dsp-lede{margin:0;color:#c9c7d2;font-size:14.5px;line-height:2}
.dsp-lede::first-letter{float:left;margin:5px 9px 0 0;font-family:var(--serif);font-size:42px;line-height:.86;color:var(--gold)}
.dsp-beats{position:relative;margin:2px 0 0;padding:0 0 0 18px;list-style:none}
.dsp-beats::before{content:"";position:absolute;left:4px;top:6px;bottom:6px;width:1px;background:linear-gradient(180deg,rgba(216,178,95,.5),rgba(216,178,95,.06))}
.dsp-beats li{position:relative;padding:0 0 16px 8px}
.dsp-beats li:last-child{padding-bottom:0}
.dsp-beats li::before{content:"";position:absolute;left:-18px;top:7px;width:7px;height:7px;border-radius:50%;background:#0a0a10;border:1px solid rgba(216,178,95,.75)}
.dsp-beats b{display:block;font-size:10.5px;font-weight:500;letter-spacing:.16em;color:var(--gold)}
.dsp-beats strong{display:block;margin:4px 0;font-family:var(--serif);font-size:15px;letter-spacing:.06em}
.dsp-beats span{font-size:13px;line-height:1.75;color:var(--muted)}
.dsp-cast{display:grid;grid-template-columns:1fr 1fr;gap:2px 24px;margin:2px 0 0;padding:0;list-style:none}
.dsp-cast li{padding:9px 0;border-bottom:1px solid rgba(255,255,255,.07)}
.dsp-cast li:last-child{border-bottom:0}
.dsp-cast b{display:block;font-family:var(--serif);font-size:16px;letter-spacing:.08em}
.dsp-cast span{font-size:12px;line-height:1.6;color:var(--muted)}
.dsp-cta-text{margin:0;color:#c9c7d2;font-size:14px;line-height:1.9}
.dsp-page[data-page="3"]{display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
.dsp-foot{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 24px 12px;border-top:1px solid rgba(255,255,255,.06)}
.dsp-no{font-size:10.5px;letter-spacing:.24em;color:rgba(216,178,95,.8);font-variant-numeric:tabular-nums}
.dsp-tabs{display:flex;gap:7px}
.dsp-tabs i{display:block;width:18px;height:2px;border-radius:2px;background:rgba(255,255,255,.16);cursor:pointer;transition:background .3s,width .3s}
.dsp-tabs i.is-on{width:30px;background:var(--gold);box-shadow:0 0 10px rgba(216,178,95,.8)}
.dsp-flip{position:absolute;inset:0;z-index:4;pointer-events:none;opacity:0;background:linear-gradient(102deg,transparent 26%,rgba(255,240,210,.10) 46%,rgba(255,255,255,.07) 53%,transparent 72%)}
.dsp-flip.is-on{animation:dspSweep .55s cubic-bezier(.3,.7,.3,1) both}
@keyframes dspSweep{0%{opacity:0;transform:translateX(-55%)}30%{opacity:1}100%{opacity:0;transform:translateX(55%)}}
@media (max-width:759px){
  .dspread{padding:96px 14px 66px}
  .dspread-left{display:none}
  .dspread-right{border-left:1px solid rgba(216,178,95,.24);border-radius:14px}
  .dsp-pages{padding:22px 20px 14px}
  .dsp-cast{grid-template-columns:1fr}
  .dsp-foot{padding:10px 20px 12px}
}
.depth-turn{position:absolute;inset:0;z-index:12;pointer-events:none;opacity:0;background:#050508}
.depth-turn i{position:absolute;left:0;top:50%;width:100%;height:2px;margin-top:-1px;background:linear-gradient(90deg,transparent,#ffd27a,transparent);box-shadow:0 0 34px rgba(255,210,122,.9);transform:scaleX(.15)}
.depth-turn.is-on{animation:depthTurn .62s cubic-bezier(.4,0,.2,1) both}
.depth-turn.is-on i{animation:depthSlit .62s cubic-bezier(.4,0,.2,1) both}
@keyframes depthTurn{0%{opacity:0}38%{opacity:1}62%{opacity:1}100%{opacity:0}}
@keyframes depthSlit{0%{transform:scaleX(.12);opacity:0}38%{transform:scaleX(1);opacity:1}62%{transform:scaleX(1);opacity:1}100%{transform:scaleX(1);opacity:0}}
.depth-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.depth-ghost{border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--text);border-radius:999px;padding:9px 18px;font:inherit;font-size:12.5px;cursor:pointer}
.depth-ghost:hover{border-color:rgba(255,255,255,.3)}

/* ---------- 主方案入口 ---------- */
.btn-gold{border:0;border-radius:999px;background:linear-gradient(120deg,#ffe3a3,#d8b25f);color:#161209;padding:10px 20px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
.btn-gold:hover{filter:brightness(1.06)}

/* 开场进行中：不露出后面的页面，避免动画被打断 */
body.intro-flow .wrap{display:none}
/* ---------- 归档 ---------- */
.gw-more{margin-top:2px}
.gw-more summary{list-style:none;display:flex;align-items:center;gap:7px;padding:7px 9px;border-radius:6px;cursor:pointer;font-size:10px;letter-spacing:.2em;color:rgba(255,255,255,.34)}
.gw-more summary::-webkit-details-marker{display:none}
.gw-more summary::before{content:"＋";font-size:10px;color:rgba(216,178,95,.7)}
.gw-more[open] summary::before{content:"－"}
.gw-more summary:hover{background:rgba(255,255,255,.04);color:rgba(255,255,255,.62)}
.gw-archived{opacity:.6}
.gw-archived.is-on{opacity:1}
.archive{margin-top:32px;padding:2px 18px 6px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.025)}
.archive summary{list-style:none;cursor:pointer;padding:16px 0 10px;font-size:12.5px;letter-spacing:.14em;color:var(--muted)}
.archive summary::-webkit-details-marker{display:none}
.archive summary::before{content:"＋ ";color:var(--gold)}
.archive[open] summary::before{content:"－ "}
.archive .tabs{padding:2px 0 10px}
.archive-note{margin:0 0 10px;color:var(--muted);font-size:12px;line-height:1.8}
.archive-jump{flex:0 0 auto;border:1px dashed rgba(216,178,95,.4);background:transparent;color:var(--gold);border-radius:999px;padding:9px 15px;font-size:12.5px;font-family:inherit;cursor:pointer;white-space:nowrap}
.archive-jump:hover{background:rgba(216,178,95,.08)}

/* ---------- 通用说明条 ---------- */
.note{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:18px;padding:14px 16px;border:1px solid var(--line);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015))}
.note p{margin:0;flex:1 1 240px;color:var(--muted);font-size:12.5px;line-height:1.75}
.note p b{color:var(--text);font-weight:600}
.pick{border:1px solid rgba(216,178,95,.5);background:transparent;color:var(--gold);border-radius:999px;padding:9px 18px;font-size:12.5px;font-family:inherit;white-space:nowrap}
.pick:hover{background:rgba(216,178,95,.12)}
.pick.is-picked{background:linear-gradient(120deg,#ffe3a3,#d8b25f);color:#161209;border-color:transparent}

/* 详情抽屉 */
.sheet{position:fixed;left:0;right:0;bottom:0;z-index:40;transform:translateY(104%);transition:transform .45s cubic-bezier(.22,.9,.24,1);background:#12121a;border-top:1px solid rgba(255,255,255,.12);border-radius:22px 22px 0 0;padding:20px 20px calc(24px + env(safe-area-inset-bottom));box-shadow:0 -24px 60px rgba(0,0,0,.7)}
.sheet.is-on{transform:none}
.sheet h3{margin:0 0 4px;font-family:var(--serif);font-size:20px}
.sheet small{color:var(--gold);font-size:12px;letter-spacing:.1em}
.sheet p{margin:12px 0 0;color:var(--muted);font-size:13px;line-height:1.8}
.sheet .close{margin-top:16px;width:100%;border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--text);border-radius:12px;padding:12px;font-family:inherit;font-size:13px}

.toast{position:fixed;left:50%;bottom:34px;transform:translate(-50%,20px);z-index:60;background:rgba(20,20,28,.95);border:1px solid rgba(216,178,95,.5);color:var(--gold);border-radius:999px;padding:10px 20px;font-size:13px;opacity:0;transition:.3s;pointer-events:none}
.toast.is-on{opacity:1;transform:translate(-50%,0)}
footer.src{margin-top:46px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:12px;line-height:2}
footer.src a{color:#9fd8ff;text-decoration:none;border-bottom:1px dashed rgba(159,216,255,.4)}

/* ---------- 扫码首屏 · 三案（A/B/C） ---------- */
.gate-screen{position:relative;width:100%;overflow:hidden;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:#070605}
.gate-stage{position:absolute;left:0;top:0;width:1440px;height:810px;transform-origin:0 0;overflow:hidden;font-family:var(--serif);color:#f3ead6}
.gate-stage .vignette{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,transparent 34%,rgba(0,0,0,.86) 100%);pointer-events:none}
.gate-stage .grain{position:absolute;inset:0;opacity:.05;pointer-events:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='.55'/></svg>")}
.gate-stage .kicker{display:block;font-family:var(--sans);font-size:13px;letter-spacing:.42em;color:var(--gold)}
.gate-stage .qr{position:relative;background:#efe8d8;border-radius:6px;padding:14px;box-shadow:0 18px 60px rgba(0,0,0,.65),0 0 0 1px rgba(0,0,0,.35) inset}
.gate-stage .qr canvas{display:block;width:100%;height:100%;image-rendering:pixelated}
/* A 首屏已移除，保留入场对比复用的光柱与尘埃 */
@keyframes gateBeam{0%,100%{opacity:.72;transform:translateX(-50%) scaleX(.94)}50%{opacity:1;transform:translateX(-50%) scaleX(1.04)}}
@keyframes gateDust{0%{transform:translate3d(0,0,0);opacity:0}18%,72%{opacity:.6}100%{transform:translate3d(26px,-120px,0);opacity:0}}
@keyframes gateFadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
/* B / C 首屏已移除 */
</style>
</head>
<body>
<div class="ambient"><i></i><i></i><i></i></div>

<aside class="gateway" id="gateway" aria-label="动画网关">
  <!-- 设备开关：电脑视图 / 手机视图 -->
  <div class="device-switch" id="deviceSwitch" role="group" aria-label="预览设备">
    <button type="button" data-device="pc" aria-pressed="true">电脑</button>
    <button type="button" data-device="phone" aria-pressed="false">手机</button>
  </div>
  <div class="gw-title">动画网关<small>01 开场 / 02 入场 / 03 选本</small></div>
  <section class="gw-zone"><h3>00 · 主机端首屏</h3>
    <button class="gw-item" data-gate="host">扫码入席</button>
  </section>
  <section class="gw-zone"><h3>01 · 开场（默认）</h3>
    <button class="gw-item is-on" data-goto="intro">顶光唤醒</button>
  </section>
  <section class="gw-zone"><h3>02 · 选本</h3>
    <button class="gw-item" data-tab="depth">⑦ 纵深通道（主方案）</button>
    <details class="gw-more">
      <summary>归档 · 前 6 个</summary>
      <button class="gw-item gw-archived" data-tab="cf">① 3D 封面流</button>
      <button class="gw-item gw-archived" data-tab="flip">② 翻开封面</button>
      <button class="gw-item gw-archived" data-tab="deck">③ 牌堆</button>
      <button class="gw-item gw-archived" data-tab="tilt">④ 光斑倾斜</button>
      <button class="gw-item gw-archived" data-tab="spine">⑤ 书脊书架</button>
      <button class="gw-item gw-archived" data-tab="cine">⑥ 滚动电影</button>
    </details>
  </section>
  <section class="gw-zone"><h3>备选 · 时空入场（灵感 · 手动查看）</h3>
    <button class="gw-item" data-tab="arrivec">时空方案</button>
  </section>
  <section class="gw-zone"><h3>以后要补</h3>
    <button class="gw-item" disabled>座位聚拢</button>
    <button class="gw-item" disabled>房主入场</button>
    <button class="gw-item" disabled>线索展开</button>
    <button class="gw-item" disabled>投票揭晓</button>
    <button class="gw-item" disabled>五人登场</button>
    <button class="gw-item" disabled>谢幕退场</button>
  </section>
</aside>

<div class="host-gate" id="hostGate">
  <div class="host-beam"></div>
  <div class="host-inner">
    <p class="host-kicker">围桌 · 五人剧本杀</p>
    <h2>扫码入席</h2>
    <div class="host-qr"><canvas id="hostQr" width="132" height="132"></canvas></div>
    <p class="host-sub">扫码后随顶光落座 · 5 位玩家</p>
    <button class="host-sim" id="hostSim">模拟扫码，随光落下 →</button>
    <p class="host-note">演示用二维码，不具备真实扫码能力</p>
    <button class="host-skip" id="hostSkip">跳过，直接看预览</button>
  </div>
</div>

<section class="intro" id="intro">
  <div class="intro-pin">
    <canvas class="intro-light" id="introLight"></canvas>
    <div class="intro-glow"></div>
    <div class="intro-vignette"></div>
    <div class="intro-copy" id="introCopy">
      <p class="intro-kicker" id="introKicker">围桌 · 五人剧本杀</p>
      <h2 class="intro-title"><span>今晚</span><span>翻哪一本</span></h2>
      <p class="intro-sub" id="introSub">六段故事，等你入席</p>
    </div>
    <div class="intro-pool" id="introPool" aria-hidden="true"></div>
    <div class="intro-dust" id="introDust" aria-hidden="true"></div>
    <div class="intro-seam" id="introSeam" aria-hidden="true"></div>
    <div class="intro-rift" id="introRift" aria-hidden="true"></div>
    <div class="cards-fan" id="cardsFan">
      <img src="covers/rainy.jpg" alt=""><img src="covers/fog.jpg" alt=""><img src="covers/lamp.jpg" alt="">
      <img src="covers/bride.jpg" alt=""><img src="covers/summer.jpg" alt=""><img src="covers/rings.jpg" alt="">
    </div>
    <div class="intro-fall" id="introFall" aria-hidden="true">
      <div class="fall-shaft"></div>
      <div class="fall-streaks a"></div>
      <div class="fall-streaks b"></div>
      <div class="fall-white" id="fallWhite"></div>
    </div>
    <div class="intro-end" id="introEnd">
      <h2>继续下滑</h2>
      <p>光会带你进入选本通道</p>
      <button class="intro-cta" id="introCta">直接落下</button>
    </div>
    <div class="intro-hint" id="introHint">滚动开始<i></i></div>
  </div>
</section>

<div class="wrap">
  <nav class="crumbs">
    <a href="http://127.0.0.1:5189/主体原型/?endpoint=overview">← 返回产品 · 多画面画布</a>
    <span>设计画廊 / 01 开场 → 02 扫码入场 → 03 选本</span>
  </nav>
  <header class="top">
    <div class="kicker"><b>围桌</b>INTERACTION LAB</div>
    <h1>入场与选本动效 · <span>一页看完</span></h1>
    <p class="sub">三段顺序固定：01 开场（顶光唤醒）→ 02 扫码入场（时空）→ 03 选本（纵深通道，前 6 案归档）。每一屏都可循环播放。<button class="replay-intro" id="replayIntro">重看开场</button></p>
    <nav class="tabs" id="tabs">
      <button class="tab is-on" data-goto="intro">01 · 开场</button>
      <button class="tab" data-tab="depth">02 · 选本（纵深）</button>
      <button class="tab tab-opt" data-tab="arrivec">备选 · 时空</button>
      <button class="archive-jump" id="archiveJump">归档 · 前 6 个方案 ↓</button>
    </nav>
  </header>

  <!-- ① 3D 封面流 -->
  <section class="panel" data-panel="cf">
    <div class="headline">
      <h2>3D 封面流</h2><span class="tag">Apple Cover Flow 式</span>
      <p>左右滑动，卡沿弧线换位；中间的卡最大最亮。</p>
    </div>
    <div class="cf-stage" id="cfStage"><div class="cf-track" id="cfTrack"></div></div>
    <div class="cf-meta"><strong id="cfTitle"></strong><small id="cfSub"></small></div>
    <div class="cf-dots" id="cfDots"></div>
    <div class="note"><p><b>参考：</b>Awwwards 的 3D 卡片环（Shaky Picks）、Codrops 的 Cover Flow 实验。好处是「一眼看到全部，又只专注一本」。</p><button class="pick" data-pick="① 3D 封面流">我想用这个</button></div>
  </section>

  <!-- ② 翻开封面 -->
  <section class="panel" data-panel="flip">
    <div class="headline">
      <h2>翻开封面</h2><span class="tag">真实翻书</span>
      <p>点封面，它绕书脊翻开，露出里面的故事。</p>
    </div>
    <div class="books" id="books"></div>
    <div class="note"><p><b>参考：</b>Codrops BookBlock、flippingbooks 的数字翻书。把「选本」变成「翻书」这个动作本身。</p><button class="pick" data-pick="② 翻开封面">我想用这个</button></div>
  </section>

  <!-- ③ 牌堆 -->
  <section class="panel" data-panel="deck">
    <div class="headline">
      <h2>牌堆</h2><span class="tag">Tinder 式堆叠</span>
      <p>把不想要的划走，下一本自己浮上来。</p>
    </div>
    <div class="deck-stage"><div class="deck" id="deck"></div></div>
    <div class="deck-bar">
      <button class="deck-btn" id="deckPrev">上一张</button>
      <span class="deck-count" id="deckCount"></span>
      <button class="deck-btn" id="deckNext">划走这张</button>
    </div>
    <div class="note"><p><b>参考：</b>Dribbble 的 Playcards / Card Scrolling，以及 Webflow 社区的 GSAP 卡片堆。适合手机单手，节奏感最强。</p><button class="pick" data-pick="③ 牌堆">我想用这个</button></div>
  </section>

  <!-- ④ 光斑倾斜 -->
  <section class="panel" data-panel="tilt">
    <div class="headline">
      <h2>光斑倾斜</h2><span class="tag">光标磁吸 + 反光</span>
      <p>鼠标或手指移动时，卡跟着倾，光斑跟着走。</p>
    </div>
    <div class="tilt-grid" id="tiltGrid"></div>
    <div class="note"><p><b>参考：</b>Awwwards 上大量「Magnetic / Spotlight card」，Webflow 的 Magnetic Lights Card。适合电脑大屏，质感最贵。</p><button class="pick" data-pick="④ 光斑倾斜">我想用这个</button></div>
  </section>

  <!-- ⑤ 书脊书架 -->
  <section class="panel" data-panel="spine">
    <div class="headline">
      <h2>书脊书架</h2><span class="tag">抽出一本</span>
      <p>先看到一排书脊，点一下它自己抽出来展开。</p>
    </div>
    <div class="shelf" id="shelf"></div>
    <p class="shelf-note">点任意书脊试试</p>
    <div class="note"><p><b>参考：</b>实体书架陈列 + 手风琴式展开（站酷 / 优设的层叠抽拉卡片）。最有「旧书店」气质。</p><button class="pick" data-pick="⑤ 书脊书架">我想用这个</button></div>
  </section>

  <!-- ⑥ 滚动电影 -->
  <section class="panel" data-panel="cine">
    <div class="headline">
      <h2>滚动电影</h2><span class="tag">Scroll-driven</span>
      <p>往下滚，六本书横向走过整个屏幕。</p>
    </div>
    <div class="cine" id="cine">
      <div class="cine-sticky"><div class="cine-track" id="cineTrack"></div></div>
    </div>
    <div class="note"><p><b>参考：</b>Awwwards / Godly 常见的 scroll-driven storytelling（Lusion、Unseen Studio 那一路）。适合做大屏开场。</p><button class="pick" data-pick="⑥ 滚动电影">我想用这个</button></div>
  </section>

  <!-- 入场 · 双方案对比 -->
  <section class="panel" data-panel="arrivec">
    <div class="headline">
      <h2>扫码入场 · 时空方案</h2><span class="tag">光缝 · 叠印 · 对焦</span>
      <p>扫码之后，一道横向光缝张开，六段时空叠印在同一张底片上，再对焦到被选中的那一本，随后展开成六本走廊。</p>
    </div>
    <div class="ac-stage">
      <div class="ac-col">
        <div class="ac-cap"><b>时空入场</b><span>光缝 → 叠印 → 对焦 → 走廊</span></div>
        <div class="ac-phone" data-step="idle" data-ac="b">
          <div class="ac-layers"></div>
          <div class="ac-slit"></div>
          <div class="ac-scan"></div>
          <div class="ac-year">六 段 时 间 · 同 一 张 底 片</div>
          <div class="ac-focus"><em>第 〇 幕</em><h3>雨夜旧馆</h3><p>悬疑 · 旧案还原 · 5 人本</p></div>
          <div class="ac-corridor">
            <div class="ac-track"></div>
            <div class="ac-mask"></div>
            <div class="ac-meta"><em>第 〇 幕</em><h3>雨夜旧馆</h3><p>悬疑 · 旧案还原 · 5 人本</p></div>
          </div>
        </div>
      </div>
    </div>
    <div class="ac-bar"><button type="button" data-ac-play>重播入场</button></div>
    <div class="note"><p><b>说明：</b>入场做成「不属于任何一本」的时空层，避免公共入口偏向某一个年代；六本各自的年代感留在各自的剧照里。</p><button class="pick" data-pick="入场 · 时空方案 B">我想用这个</button></div>
  </section>

  <!-- ⑦ 纵深通道 -->
  <section class="panel" data-panel="depth">
    <div class="depth" id="depth">
      <div class="depth-scroll" id="depthScroll">
        <div class="depth-track" id="depthTrack">
          <div class="depth-pin" id="depthPin">
            <canvas class="depth-canvas" id="depthCanvas" role="img" aria-label="纵深选本通道：上下滑动选本，选中后左滑进入该本的横向次元"></canvas>
            <div class="depth-hud">
              <div class="depth-hud-l">
                <span class="depth-kicker" id="depthKicker">纵向走廊 · 上下选本</span>
                <strong class="depth-now" id="depthNow">雨夜旧馆</strong>
                <small class="depth-sub" id="depthSub">悬疑 · 旧案还原 · 5 位席位</small>
              </div>
              <button class="depth-quit" id="depthQuit">退出</button>
            </div>
            <div class="depth-rail"><i id="depthRail"></i></div>
            <p class="depth-hint" id="depthHint">上下滑动选本 · 左右拖动环视，看到边再拉开门</p>
            <div class="dspread" id="dspread" aria-hidden="true">
              <div class="dspread-book">
                <aside class="dspread-left" id="dspLeft">
                  <img id="dspCover" alt="">
                  <span class="dsp-veil"></span>
                  <div class="dsp-id">
                    <small id="dspGenre"></small>
                    <strong id="dspTitle"></strong>
                    <span class="dsp-seats" id="dspSeats"></span>
                  </div>
                  <span class="dsp-spine"></span>
                </aside>
                <div class="dspread-right">
                  <div class="dsp-pages" id="dspPages">
                    <article class="dsp-page" data-page="0">
                      <span class="dsp-kicker">故事梗概</span>
                      <h3>这是一个怎样的故事</h3>
                      <p class="dsp-lede" data-slot="story"></p>
                    </article>
                    <article class="dsp-page" data-page="1">
                      <span class="dsp-kicker">三段经过</span>
                      <h3>事情是这样发生的</h3>
                      <ol class="dsp-beats" data-slot="beats"></ol>
                    </article>
                    <article class="dsp-page" data-page="2">
                      <span class="dsp-kicker">在场席位</span>
                      <h3>今晚坐在桌上的人</h3>
                      <ul class="dsp-cast" data-slot="cast"></ul>
                    </article>
                    <article class="dsp-page" data-page="3">
                      <span class="dsp-kicker">开本</span>
                      <h3 data-slot="ctaTitle"></h3>
                      <p class="dsp-cta-text" data-slot="ctaText"></p>
                      <div class="depth-actions">
                        <button class="btn-gold" data-act="confirm">确认这本</button>
                        <button class="depth-ghost" data-act="back">回到走廊</button>
                      </div>
                    </article>
                  </div>
                  <div class="dsp-flip" id="dspFlip" aria-hidden="true"></div>
                  <footer class="dsp-foot">
                    <span class="dsp-no" id="dspNo">01 / 04</span>
                    <div class="dsp-tabs" id="dspTabs"><i></i><i></i><i></i><i></i></div>
                  </footer>
                </div>
              </div>
            </div>
            <div class="depth-light" id="depthLight" aria-hidden="true"></div>
            <div class="depth-turn" id="depthTurn" aria-hidden="true"><i></i></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <details class="archive" id="archive">
    <summary>归档 · 前 6 个选本动效（展开参考）</summary>
    <nav class="tabs">
      <button class="tab" data-tab="cf">① 3D 封面流</button>
      <button class="tab" data-tab="flip">② 翻开封面</button>
      <button class="tab" data-tab="deck">③ 牌堆</button>
      <button class="tab" data-tab="tilt">④ 光斑倾斜</button>
      <button class="tab" data-tab="spine">⑤ 书脊书架</button>
      <button class="tab" data-tab="cine">⑥ 滚动电影</button>
    </nav>
    <p class="archive-note">主方案已定为 ⑦ 纵深通道。这 6 个方案的交互完整保留，以后做新动画时可以回来取材。</p>
  </details>

  <footer class="src">
    灵感常看：<a href="https://www.awwwards.com/" target="_blank" rel="noreferrer">Awwwards</a> ·
    <a href="https://tympanus.net/codrops/" target="_blank" rel="noreferrer">Codrops</a> ·
    <a href="https://godly.website/" target="_blank" rel="noreferrer">Godly</a> ·
    <a href="https://hoverstat.es/" target="_blank" rel="noreferrer">Hoverstat.es</a> ·
    <a href="https://land-book.com/" target="_blank" rel="noreferrer">Land-book</a> ·
    <a href="https://www.siteinspire.com/" target="_blank" rel="noreferrer">Siteinspire</a> ·
    <a href="https://collectui.com/" target="_blank" rel="noreferrer">Collect UI</a>
  </footer>
</div>

<div class="sheet" id="sheet">
  <h3 id="sheetTitle"></h3>
  <small id="sheetSub"></small>
  <p id="sheetText"></p>
  <button class="close" id="sheetClose">收起来</button>
</div>
<div class="toast" id="toast"></div>

<script>
const BOOKS = [
  {title:'雨夜旧馆', genre:'悬疑 · 旧案还原', img:'covers/rainy.jpg', c1:'#1b4b6b', c2:'#0a1420', glow:'rgba(111,211,255,.55)',
   text:'暴雨封路，五名故人回到即将拆除的旧照相馆。晚宴前，邀请人死在暗房里，一张未冲洗的底片把人牵回十年前的失踪案。',
   beats:[['十年前','暗房里的失踪','顾晚晴在旧馆暗房消失，案子最终以“自行离家”结案。'],['今夜 · 暴雨','五名故人回馆','拆迁前夜，旧馆主人顾长庚把五个人同时请回。'],['晚宴前','死者与底片','顾长庚死在反锁的暗房，一张未冲洗的底片指向十年前。']],
   cast:[['沈知夏','胶片修复师 · 失踪者的挚友'],['周启明','摄影记者 · 旧馆学徒'],['林素琴','旧馆房东 · 拆迁签约人'],['许承安','离职刑警 · 旧案经办人'],['何映秋','旧馆主人的养女 · 第一发现人']]},
  {title:'雾港来信', genre:'本格推理 · 密室', img:'covers/fog.jpg', c1:'#4a2f7a', c2:'#140d24', glow:'rgba(177,140,255,.55)',
   text:'浓雾封港的深夜，五名陌生人被同一封匿名信召进海崖旅馆。午夜，寄信人死在从内反锁的钟楼里，唯一的钥匙留在死者口袋。',
   beats:[['午夜前','五封匿名信','五个陌生人被同一封信召进雾港旅馆，寄信人始终没有露面。'],['午夜','钟楼反锁','钟声停时，寄信人死在钟楼里，唯一一把钥匙留在他口袋。'],['天亮前','五份证词','浓雾封港，旅馆里只剩五个人能互相作证。']],
   cast:[['程砚秋','前巡捕房探长 · 落魄侦探'],['顾雪笙','海崖旅馆女主人 · 钥匙保管人'],['陆则言','钟表匠 · 受邀修钟的人'],['苏曼青','报社主笔 · 随身带相机的人'],['赵慕山','盐商 · 死者的生意伙伴']]},
  {title:'第七夜灯', genre:'黑暗 · 心理惊悚', img:'covers/lamp.jpg', c1:'#7a2a22', c2:'#1c0a09', glow:'rgba(255,138,92,.55)',
   text:'风暴把五个人困在孤岛疗养院。灯塔每七夜熄灭一次。今夜灯灭之前，院长失踪，档案室多出一份五人都没印象的入院记录。',
   beats:[['登岛第一夜','七号病房','沈砚在岛上醒来，手里多了一把刻着“灯室”的铜钥匙。'],['第七夜','灯灭七分钟','院长失踪，档案室出现一份五人从未记得的入院记录。'],['天亮之前','谁被忘记','灯塔每熄一次，就有人少一段记忆，五个人开始怀疑彼此是谁。']],
   cast:[['沈砚','失眠症患者 · 七号病房'],['白露','夜班护士 · 病历保管人'],['江既明','疗养院医生 · 记忆研究者'],['宋南乔','院长的女儿 · 遗嘱持有人'],['陈默','守灯人 · 唯一没离岛的人']]},
  {title:'河神娶亲', genre:'民俗悬疑 · 水乡怪谈', img:'covers/bride.jpg', c1:'#0f5b54', c2:'#06201f', glow:'rgba(78,240,200,.5)',
   text:'水乡每年替河神办一场婚礼。今年被选中的姑娘在仪式前失踪，喜船里只剩一件湿透的嫁衣，和一张写着五个名字的红帖。',
   beats:[['婚礼前夜','喜船空了','被选中的姑娘失踪，船里只剩湿嫁衣和一张写着五个名字的红帖。'],['子时','祠堂问名','族长把五个人留在祠堂，要他们天亮前交出“该上船的人”。'],['天亮前','河底旧箱','河底捞起一只刻满名字的木箱，里面少了一副骨骸。']],
   cast:[['沈绣娘','镇上最后的绣娘 · 嫁衣制作者'],['周渡','摆渡人 · 最后一晚见过新娘的人'],['林阿婆','祭祀主事 · 族长的妹妹'],['许文清','回乡的水文教师 · 不信鬼神的人'],['何小满','失踪姑娘的姐姐 · 今年本该被选中的人']]},
  {title:'长夏未寄', genre:'情感沉浸 · 青春悬疑', img:'covers/summer.jpg', c1:'#7a5218', c2:'#1c1206', glow:'rgba(255,209,102,.5)',
   text:'旧校舍拆除前的最后一个夏天，五名多年未见的好友回到天台，为五年前离开的林之夏补办一场告别。最后一封信的落款，是明天。',
   beats:[['五年前','河边的意外','林之夏落水身亡，五个人给出的说法彼此对不上。'],['这个夏天','旧校舍告别','拆迁前，五名好友回到天台，补办一场迟到五年的告别。'],['最后一封信','落款是明天','储物柜里的信按日期排好，最后一封写着明天才会发生的事。']],
   cast:[['顾南枝','律师 · 这次重逢的发起人'],['江屿','乐队吉他手 · 保留最后一条语音的人'],['林小满','林之夏的妹妹 · 今年刚满十八岁'],['周予安','中学教师 · 当年签事故报告的人'],['何夕','护士 · 最后一个见到林之夏的人']]},
  {title:'年轮', genre:'现代 · 变格还原', img:'covers/rings.jpg', c1:'#3d5c22', c2:'#0d1507', glow:'rgba(182,243,106,.5)',
   text:'三十年前，山谷里的小村被一场深夜大火烧尽。五个陌生人被同一件事召回废墟，发现彼此的人生像年轮一样层层交叠。',
   beats:[['三十年前','山谷大火','一夜之间小村被大火吞没；谷中无水无路，救火的人只能看着它烧到天亮。'],['今夜','五人重回废墟','五个互不相识的人先后抵达山谷，每个人都带着一件不该出现在这里的旧物。'],['天亮之前','重叠的年轮','怀表的时间对不上，照片里的面容隔了三十年却没有变老。']],
   cast:[['刘伯钊','退休教师 · 独居老人'],['袁本','都市白领 · 金丝眼镜'],['王小冉','寻亲少女 · 病历本保管人'],['姚波','沉默的旧货商 · 山谷旧识'],['陈烁','外科医生 · 怀表的主人']]}
]
const $ = sel => document.querySelector(sel)
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))

/* ---- 标签切换 ---- */
const tabs = [...document.querySelectorAll('.tab')]
tabs.forEach(tab => tab.addEventListener('click', () => {
  /* 进了任意方案就把 320vh 的开场段整段收起，否则它会一直压在预览面板上方 */
  /* 顶栏「01 · 开场」：回到开场段，不当作面板切换 */
  if (tab.dataset.goto === 'intro') {
    if (D.side) depthExitSide()
    document.body.classList.add('intro-flow')
    introEl.classList.remove('is-skipped')
    document.querySelector('.wrap')?.classList.remove('has-panel')
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('is-on'))
    tabs.forEach(t => t.classList.toggle('is-on', t === tab))
    setGw(document.querySelector('.gw-item[data-goto="intro"]'))
    scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  document.body.classList.remove('intro-flow')
  introEl.classList.add('is-skipped')
  document.querySelector('.wrap')?.classList.add('has-panel')
  if (D.side) depthExitSide()
  tabs.forEach(t => t.classList.toggle('is-on', t === tab))
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('is-on', p.dataset.panel === tab.dataset.tab))
  if (tab.dataset.tab === 'cine') cineUpdate()
  if (tab.dataset.tab === 'depth') depthOpen()
  else {
    const panel = document.querySelector('.panel[data-panel="' + tab.dataset.tab + '"]')
    if (panel) setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 20)
  }
  headlineIn(document.querySelector('.panel.is-on'))
  setGw(document.querySelector('.gw-item[data-tab="' + tab.dataset.tab + '"]'))
  if (tab.dataset.tab === 'arrivec') setTimeout(() => window.acPlay?.(), 60)
}))


/* ---- 详情抽屉 ---- */
function openSheet(book){
  $('#sheetTitle').textContent = book.title
  $('#sheetSub').textContent = book.genre + ' · 5 人'
  $('#sheetText').textContent = book.text
  $('#sheet').classList.add('is-on')
}
$('#sheetClose').addEventListener('click', () => $('#sheet').classList.remove('is-on'))

/* ---- 选择记录 ---- */
let toastTimer
document.querySelectorAll('.pick').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.pick').forEach(b => b.classList.remove('is-picked'))
  btn.classList.add('is-picked')
  btn.textContent = '已记下这个'
  const toast = $('#toast')
  toast.textContent = '已记下：' + btn.dataset.pick
  toast.classList.add('is-on')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('is-on'), 1800)
}))

/* ---------- ① 封面流 ---------- */
const cfStage = $('#cfStage'), cfTrack = $('#cfTrack'), cfDots = $('#cfDots')
let cfIndex = 0
cfTrack.innerHTML = BOOKS.map((b, i) => \`<div class="cf-card" data-i="\${i}" style="--c1:\${b.c1};--c2:\${b.c2};--glow:\${b.glow}"><div class="cf-glow"></div><div class="cf-face"><img class="cf-img" src="\${b.img}" alt=""><span class="cf-veil"></span><strong>\${esc(b.title)}</strong></div></div>\`).join('')
cfDots.innerHTML = BOOKS.map((_, i) => \`<span class="cf-dot\${i===0?' is-on':''}"></span>\`).join('')
const cfCards = [...cfTrack.children]
function cfLayout(){
  const w = cfStage.clientWidth
  const gap = Math.min(190, w * 0.42)
  cfCards.forEach((card, i) => {
    const d = i - cfIndex
    const abs = Math.abs(d)
    const x = d * gap
    const rot = Math.max(-58, Math.min(58, -d * 26))
    const scale = Math.max(.62, 1 - abs * .13)
    const z = -Math.min(320, abs * 90)
    card.style.transform = \`translate3d(\${x}px,0,\${z}px) rotateY(\${rot}deg) scale(\${scale})\`
    card.style.opacity = abs > 3 ? 0 : String(1 - abs * .17)
    card.style.zIndex = String(100 - abs)
    card.classList.toggle('is-focus', d === 0)
  })
  const b = BOOKS[cfIndex]
  $('#cfTitle').textContent = b.title
  $('#cfSub').textContent = b.genre + ' · 5 人'
  ;[...cfDots.children].forEach((dot, i) => dot.classList.toggle('is-on', i === cfIndex))
}
function cfGo(i){ cfIndex = Math.max(0, Math.min(BOOKS.length - 1, i)); cfLayout() }
cfCards.forEach(card => card.addEventListener('click', () => {
  const i = Number(card.dataset.i)
  if (i === cfIndex) return openSheet(BOOKS[i])
  cfGo(i)
}))
let cfX = null
cfStage.addEventListener('pointerdown', e => { cfX = e.clientX })
cfStage.addEventListener('pointerup', e => {
  if (cfX === null) return
  const dx = e.clientX - cfX
  cfX = null
  if (Math.abs(dx) > 42) cfGo(cfIndex + (dx < 0 ? 1 : -1))
})
cfStage.addEventListener('pointercancel', () => { cfX = null })
new ResizeObserver(cfLayout).observe(cfStage)
cfLayout()

/* ---------- ② 翻开封面 ---------- */
$('#books').innerHTML = BOOKS.map((b, i) => \`
  <div class="book" data-i="\${i}" style="--c1:\${b.c1};--c2:\${b.c2}">
    <div class="book-page">
      <h3>\${esc(b.title)}</h3>
      <p>\${esc(b.text)}</p>
      <small>\${esc(b.genre)} · 5 人</small>
    </div>
    <div class="book-cover"><img src="\${b.img}" alt=""><span class="bc-veil"></span><strong>\${esc(b.title)}</strong></div>
  </div>\`).join('')
document.querySelectorAll('.book').forEach(book => {
  book.addEventListener('click', () => {
    const open = book.classList.contains('is-open')
    document.querySelectorAll('.book').forEach(b => b.classList.remove('is-open'))
    if (!open) book.classList.add('is-open')
  })
})

/* ---------- ③ 牌堆 ---------- */
const deck = $('#deck')
const deckCount = $('#deckCount')
let deckIndex = 0
deck.innerHTML = BOOKS.map((b, i) => \`<div class="deck-card" data-i="\${i}" style="--c1:\${b.c1};--c2:\${b.c2}"><img src="\${b.img}" alt=""><span class="deck-veil"></span><strong>\${esc(b.title)}</strong></div>\`).join('')
const deckCards = [...deck.children]
function deckLayout(dragX = 0){
  deckCards.forEach((card, i) => {
    const rel = i - deckIndex
    if (rel < 0) {
      card.style.transform = 'translate3d(-120%, -6%, 0) rotate(-18deg)'
      card.style.opacity = '0'
      card.style.pointerEvents = 'none'
      return
    }
    card.style.pointerEvents = rel === 0 ? 'auto' : 'none'
    const y = Math.min(rel, 3) * -9
    const s = 1 - Math.min(rel, 3) * .045
    const isTop = rel === 0
    card.style.transform = \`translate3d(\${isTop ? dragX : 0}px, \${y}px, 0) scale(\${s}) rotate(\${isTop ? dragX * .05 : 0}deg)\`
    card.style.opacity = rel > 3 ? '0' : '1'
    card.style.zIndex = String(30 - rel)
  })
  deckCount.textContent = \`\${Math.min(deckIndex + 1, BOOKS.length)} / \${BOOKS.length}\`
}
let dragStart = null
deck.addEventListener('pointerdown', e => {
  const rel = Number(e.target.closest('.deck-card')?.dataset.i) - deckIndex
  if (rel !== 0) return
  dragStart = {x: e.clientX, card: e.target.closest('.deck-card')}
  dragStart.card.classList.add('dragging')
  dragStart.card.setPointerCapture?.(e.pointerId)
})
deck.addEventListener('pointermove', e => { if (dragStart) deckLayout(e.clientX - dragStart.x) })
deck.addEventListener('pointerup', e => {
  if (!dragStart) return
  const dx = e.clientX - dragStart.x
  dragStart.card.classList.remove('dragging')
  dragStart = null
  if (Math.abs(dx) > 70) { deckIndex = Math.min(deckIndex + 1, BOOKS.length - 1); deckLayout() }
  else deckLayout(0)
})
deck.addEventListener('pointercancel', () => { if (dragStart) { dragStart.card.classList.remove('dragging'); dragStart = null; deckLayout(0) } })
$('#deckNext').addEventListener('click', () => { deckIndex = Math.min(deckIndex + 1, BOOKS.length - 1); deckLayout() })
$('#deckPrev').addEventListener('click', () => { deckIndex = Math.max(deckIndex - 1, 0); deckLayout() })
deckCards.forEach(card => card.addEventListener('click', () => {
  if (Number(card.dataset.i) === deckIndex && !dragStart) openSheet(BOOKS[deckIndex])
}))
deckLayout()

/* ---------- ④ 光斑倾斜 ---------- */
$('#tiltGrid').innerHTML = BOOKS.map((b, i) => \`
  <div class="tilt" data-i="\${i}" style="--c1:\${b.c1};--c2:\${b.c2}">
    <img src="\${b.img}" alt=""><span class="tilt-veil"></span>
    <span class="tilt-sub">\${esc(b.genre)}</span>
    <strong>\${esc(b.title)}</strong>
  </div>\`).join('')
document.querySelectorAll('.tilt').forEach(card => {
  const i = Number(card.dataset.i)
  card.addEventListener('pointermove', e => {
    const r = card.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    card.style.setProperty('--mx', (px * 100) + '%')
    card.style.setProperty('--my', (py * 100) + '%')
    card.style.transform = \`rotateY(\${(px - .5) * 22}deg) rotateX(\${(.5 - py) * 20}deg) translateZ(12px)\`
    card.style.boxShadow = \`\${(px - .5) * -26}px \${(py - .5) * -26}px 60px -18px rgba(0,0,0,.85)\`
  })
  card.addEventListener('pointerleave', () => { card.style.transform = ''; card.style.boxShadow = '' })
  card.addEventListener('click', () => openSheet(BOOKS[i]))
})

/* ---------- ⑤ 书脊书架 ---------- */
$('#shelf').innerHTML = BOOKS.map((b, i) => \`
  <div class="spine" data-i="\${i}" data-genre="\${esc(b.genre)}" style="--c1:\${b.c1};--c2:\${b.c2};--glow:\${b.glow}"><span>\${esc(b.title)}</span></div>\`).join('')
document.querySelectorAll('.spine').forEach(spine => {
  spine.addEventListener('click', () => {
    const isOn = spine.classList.contains('is-on')
    document.querySelectorAll('.spine').forEach(s => s.classList.remove('is-on'))
    if (!isOn) spine.classList.add('is-on')
  })
})

/* ---------- ⑥ 滚动电影 ---------- */
const cine = $('#cine'), cineTrack = $('#cineTrack')
cineTrack.innerHTML = BOOKS.map((b, i) => \`
  <div class="cine-card" data-i="\${i}" style="--c1:\${b.c1};--c2:\${b.c2}">
    <img src="\${b.img}" alt=""><span class="cine-veil"></span>
    <span class="num">0\${i + 1}</span>
    <strong>\${esc(b.title)}</strong>
    <small>\${esc(b.genre)} · 5 人</small>
  </div>\`).join('')
const cineTip = document.createElement('div')
cineTip.className = 'cine-tip'
cineTip.textContent = '继续往下滚 · 书会自己走过来'
document.body.appendChild(cineTip)
function cineUpdate(){
  if (!cine.offsetHeight) return
  const rect = cine.getBoundingClientRect()
  const total = cine.offsetHeight - innerHeight
  const progress = Math.max(0, Math.min(1, -rect.top / total))
  const maxX = Math.max(0, cineTrack.scrollWidth - innerWidth + 40)
  cineTrack.style.transform = \`translate3d(\${-progress * maxX}px,0,0)\`
  const active = document.querySelector('.panel[data-panel="cine"]').classList.contains('is-on')
  cineTip.classList.toggle('is-on', active && progress < .96)
  ;[...cineTrack.children].forEach(card => {
    const r = card.getBoundingClientRect()
    const dist = Math.abs((r.left + r.width / 2) - innerWidth / 2)
    const near = Math.max(0, 1 - dist / (innerWidth * .8))
    card.style.transform = \`scale(\${.92 + near * .08})\`
    card.style.filter = \`brightness(\${.7 + near * .45})\`
  })
}
let cineTick = false
addEventListener('scroll', () => {
  if (cineTick) return
  cineTick = true
  requestAnimationFrame(() => { cineTick = false; cineUpdate() })
}, {passive:true})
addEventListener('resize', cineUpdate)
cineUpdate()

/* ---------- 开场电影 ---------- */
const introEl = $('#intro'), introCopy = $('#introCopy'), introKicker = $('#introKicker')
const introSub = $('#introSub'), introLines = [...document.querySelectorAll('.intro-title span')]
const fanImgs = [...document.querySelectorAll('#cardsFan img')]
/* 叠放顺序只跟左右位置有关，是常量：设一次就够，别每帧写 */
fanImgs.forEach((img, i) => {
  img.style.zIndex = String(10 - Math.round(Math.abs(i - (fanImgs.length - 1) / 2) * 2))
})
const introSeam = $('#introSeam')
const introPool = $('#introPool'), introDust = $('#introDust'), introRift = $('#introRift')
if (introDust){
  const dustCount = innerWidth < 700 ? 22 : 34
  for (let i = 0; i < dustCount; i++){
    const s = document.createElement('i')
    s.style.left = (50 + (Math.random() - .5) * 64) + 'vw'
    s.style.top = (16 + Math.random() * 64) + 'vh'
    s.style.animationDuration = (7 + Math.random() * 9).toFixed(1) + 's'
    s.style.animationDelay = (-Math.random() * 12).toFixed(1) + 's'
    s.style.width = s.style.height = (1 + Math.random() * 2).toFixed(1) + 'px'
    introDust.appendChild(s)
  }
}
const introEnd = $('#introEnd'), introCta = $('#introCta'), introHint = $('#introHint')
const introFall = $('#introFall'), fallWhite = $('#fallWhite')
const unit = v => Math.max(0, Math.min(1, v))
/* 宿主大屏：顶光＋二维码，模拟扫码后重放开场 */
let introFallEntered = false
;(function hostGate(){
  const gate = $('#hostGate'); if (!gate) return
  const qr = $('#hostQr')
  if (qr){
    const x = qr.getContext('2d'), n = 25, s = qr.width / n
    x.fillStyle = '#f7f3e8'; x.fillRect(0, 0, qr.width, qr.height)
    let seed = 7
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    x.fillStyle = '#0a0908'
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (rnd() > .52) x.fillRect(i * s, j * s, s, s)
    for (const [ox, oy] of [[0, 0], [n - 7, 0], [0, n - 7]]){
      x.fillStyle = '#0a0908'; x.fillRect(ox * s, oy * s, 7 * s, 7 * s)
      x.fillStyle = '#f7f3e8'; x.fillRect((ox + 1) * s, (oy + 1) * s, 5 * s, 5 * s)
      x.fillStyle = '#0a0908'; x.fillRect((ox + 2) * s, (oy + 2) * s, 3 * s, 3 * s)
    }
  }
  const params = new URLSearchParams(location.search)
  /* 默认不再自动弹「扫码入席」：它曾经整屏盖住左侧流程栏，看起来像页面坏了。
     现在只由侧栏「00 · 主机端首屏」手动打开，点其它流程项自动收起。 */
  if (params.get('gate') === '1' && innerWidth >= 960) { gate.classList.add('is-on'); document.documentElement.style.overflow = 'hidden' }
  document.querySelectorAll('.gw-item[data-gate="host"]').forEach(item => item.addEventListener('click', () => {
    gate.classList.add('is-on')
    document.documentElement.style.overflow = 'hidden'
  }))
  document.addEventListener('click', event => {
    const item = event.target.closest('.gw-item, #tabs .tab')
    if (!item || item.dataset.gate === 'host' || !gate.classList.contains('is-on')) return
    gate.classList.remove('is-on')
    document.documentElement.style.overflow = ''
  })
  $('#hostSim').addEventListener('click', () => {
    gate.classList.remove('is-on')
    document.documentElement.style.overflow = ''
    try { sessionStorage.setItem('weizhuo:hostScanned', '1') } catch { /* 忽略 */ }
    try { sessionStorage.removeItem(INTRO_KEY) } catch { /* 忽略 */ }
    introMarked = false
    introFallEntered = false
    introEl.classList.remove('is-skipped', 'is-live')
    void introEl.offsetWidth
    introEl.classList.add('is-live')
    window.scrollTo({ top: 0, behavior: 'auto' })
  })
  $('#hostSkip').addEventListener('click', () => {
    gate.classList.remove('is-on')
    document.documentElement.style.overflow = ''
  })
})()
/* 开场只看第一次：本会话看过就折叠，切方案不再从头滚一遍 */
const INTRO_KEY = 'weizhuo:introSeen'
let introMarked = false
try { introMarked = sessionStorage.getItem(INTRO_KEY) === '1' } catch { /* 隐私模式忽略 */ }
document.body.classList.add('intro-flow')
function markIntroSeen(){
  if (introMarked) return
  introMarked = true
  try { sessionStorage.setItem(INTRO_KEY, '1') } catch { /* 忽略 */ }
}
function enterFall(){
  if (introFallEntered) return
  introFallEntered = true
  markIntroSeen()
  document.body.classList.remove('intro-flow')
  depthScroll.scrollTop = 0
  document.querySelector('.tab[data-tab="depth"]')?.click()
  /* 落地缓冲：接住开场滚动的惯性，落稳后从第一本开始 */
  depthLockUntil = performance.now() + 1200
  depthResidualUntil = performance.now() + 2600
  depthLastInput = -1e9
  requestAnimationFrame(() => lightIn())
}
/* 进入走廊：先满屏亮光，再慢慢散开 */
function lightIn(){
  const el = $('#depthLight'); if (!el) return
  el.style.transition = 'none'
  el.style.opacity = '1'
  requestAnimationFrame(() => {
    el.style.transition = 'opacity 1.25s cubic-bezier(.3,.7,.3,1)'
    el.style.opacity = '0'
  })
}
function renderIntro(p){
  // 第一幕：文案逐行从黑暗里浮起
  const copyFull = p < .18
  introKicker.style.opacity = copyFull ? 1 : unit((p - .01) / .06)
  introLines.forEach((line, i) => {
    const k = copyFull ? 1 : unit((p - .03 - i * .06) / .12)
    line.style.opacity = k
    line.style.transform = \`translateY(\${(1 - k) * 30}px)\`
    line.style.filter = \`blur(\${(1 - k) * 10}px)\`
  })
  introSub.style.opacity = copyFull ? 1 : unit((p - .14) / .07)
  // 文案退场，顶光收成一道竖缝
  const copyOut = unit((p - .19) / .10)
  introCopy.style.opacity = 1 - copyOut
  introCopy.style.transform = \`translateY(\${-copyOut * 46}px)\`
  const seam = unit((p - .18) / .18)
  const seamOpen = unit((p - .36) / .16)
  if (introSeam){
    introSeam.style.opacity = seam * (1 - unit((p - .60) / .10))
    introSeam.style.transform = \`translate(-50%,-50%) scale(\${(.01 + seamOpen * .99).toFixed(3)},\${(.02 + seam * .98).toFixed(3)})\`
  }
  // 桌面光斑与体积尘
  const pool = unit((p - .02) / .16)
  if (introPool) introPool.style.opacity = pool * (1 - unit((p - .92) / .06))
  if (introDust) introDust.style.opacity = pool * (1 - unit((p - .90) / .06))
  // 裂缝张开
  const rift = unit((p - .56) / .18)
  if (introRift){
    introRift.style.opacity = rift * (1 - unit((p - .90) / .05))
    introRift.style.transform = \`translate(-50%,-50%) scaleX(\${(.12 + rift * 1.05).toFixed(3)})\`
  }
  // 六本：从缝里依次落下 → 扇形 → 被裂缝吸回
  const fan = unit((p - .46) / .16)
  const suck = unit((p - .64) / .20)
  const center = (fanImgs.length - 1) / 2
  const step = Math.min(innerWidth * .16, 84)
  fanImgs.forEach((img, i) => {
    const d = i - center
    const drop = unit((p - (.28 + i * .014)) / .20)
    const ease = 1 - Math.pow(1 - drop, 2.6)
    const x = d * step * fan * (1 - suck * .82)
    const y = ease * 7 - Math.abs(d) * 8 * fan - suck * 6
    img.style.opacity = Math.min(1, drop * 1.6) * (1 - unit((p - .80) / .10))
    img.style.transform = \`translate(calc(-50% + \${x}px), calc(-50% + \${y}vh)) rotate(\${d * 5.5 * fan}deg) scale(\${((.2 + .42 * ease) * (1 - suck * .55)).toFixed(3)})\`
  })
  // 掉落：六本被光吸下去，光柱与速度线接管，准备换到 z 轴
  const fall = unit((p - .62) / .30)
  introFall.style.opacity = fall
  introFall.classList.toggle('is-on', fall > .001)
  introFall.style.transform = \`translateY(\${(1 - fall) * 5}vh)\`
  if (fallWhite) fallWhite.style.opacity = unit((p - .90) / .09)
  // 收尾
  const endOp = unit((p - .72) / .09) * (1 - unit((p - .84) / .04))
  introEnd.style.opacity = endOp
  introEnd.style.pointerEvents = endOp > .3 ? 'auto' : 'none'
  introHint.style.opacity = 1 - unit(p / .05)
  if (p > .9) markIntroSeen()
  if (p > .90) enterFall()
}
let introTotal = 0
function introMeasure(){ introTotal = Math.max(0, introEl.offsetHeight - innerHeight) }
function introUpdate(){
  renderIntro(introTotal > 0 ? unit(-introEl.getBoundingClientRect().top / introTotal) : 0)
}
introCta.addEventListener('click', () => {
  enterFall()
})
$('#replayIntro').addEventListener('click', () => {
  document.body.classList.add('intro-flow')
  try { sessionStorage.removeItem(INTRO_KEY) } catch { /* 忽略 */ }
  introMarked = false
  introFallEntered = false
  introEl.classList.remove('is-skipped')
  introEl.classList.remove('is-live')
  void introEl.offsetWidth
  introEl.classList.add('is-live')
  introPlayed = true
  window.scrollTo({ top: 0, behavior: 'auto' })
})
/* 网关：左侧选动画形态，右侧舞台只演选中的那一个 */
function setGw(active) {
  document.querySelectorAll('.gw-item').forEach(item => item.classList.toggle('is-on', item === active))
}
document.querySelectorAll('.gw-item[data-tab]').forEach(item => item.addEventListener('click', () => {
  setGw(item)
  const tab = [...document.querySelectorAll('.tab')].find(t => t.dataset.tab === item.dataset.tab)
  tab?.click()
}))
document.querySelectorAll('.gw-item[data-goto="intro"]').forEach(item => item.addEventListener('click', () => {
  setGw(item)
  document.body.classList.add('intro-flow')
  if (D.side) depthExitSide()
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('is-on'))
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('is-on'))
  document.querySelector('.wrap')?.classList.remove('has-panel')
  D.p = 0; D.camZ = 0; D.look = 0; D.lookTarget = 0
  D.viewShift = 0; D.viewShiftT = 0
  D.door = 0; D.doorTarget = 0; D.doorShift = 0
  D.entering = false
  holdCancel()
  introFallEntered = false
  depthScroll.scrollTop = 0
  try { sessionStorage.removeItem(INTRO_KEY) } catch { /* 忽略 */ }
  introMarked = false
  introFallEntered = false
  introEl.classList.remove('is-skipped')
  introEl.classList.remove('is-live')
  void introEl.offsetWidth
  introEl.classList.add('is-live')
  introPlayed = true
  window.scrollTo({ top: 0, behavior: 'smooth' })
}))
/* 光标体积光：只在有精确指针的设备上跟随 */
const cursorLight = document.createElement('div')
cursorLight.className = 'cursor-light'
document.body.appendChild(cursorLight)
if (matchMedia('(pointer:fine)').matches) {
  let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy, armed = false, raf = 0
  function follow() {
    cx += (tx - cx) * 0.12
    cy += (ty - cy) * 0.12
    cursorLight.style.transform = \`translate3d(\${cx.toFixed(1)}px,\${cy.toFixed(1)}px,0)\`
    raf = Math.abs(tx - cx) + Math.abs(ty - cy) > .3 ? requestAnimationFrame(follow) : 0
  }
  addEventListener('pointermove', event => {
    tx = event.clientX
    ty = event.clientY
    if (!armed) { armed = true; cursorLight.style.opacity = '1' }
    if (!raf) raf = requestAnimationFrame(follow)
  }, { passive: true })
  document.addEventListener('pointerleave', () => { armed = false; cursorLight.style.opacity = '0' })
}
/* 切面板时标题做一次遮罩浮起 */
function headlineIn(panel) {
  const head = panel?.querySelector('.headline')
  if (!head) return
  head.classList.remove('is-in')
  void head.offsetWidth
  head.classList.add('is-in')
}
let introTick = false
addEventListener('scroll', () => {
  introEl.classList.remove('is-live')
  // 后台标签 rAF 会被节流，标记"看过"必须同步判断，不能等 rAF
  if (introTotal > 0 && scrollY / introTotal > .9) markIntroSeen()
  if (introTick) return
  introTick = true
  requestAnimationFrame(() => { introTick = false; introUpdate() })
}, { passive: true })
addEventListener('resize', () => { introMeasure(); introUpdate() })
introMeasure()
/* 只在标签可见时播首屏动画；后台标签直接呈现终态，避免定格在半透明 */
let introPlayed = false
function playIntroOnce(){
  if (introPlayed || document.visibilityState !== 'visible') return
  introPlayed = true
  introEl.classList.add('is-live')
}
playIntroOnce()
document.addEventListener('visibilitychange', playIntroOnce)

/* ---------- 开场光：WebGL 噪声光，替代 CSS 渐变光斑 ---------- */
;(function introLight(){
  const canvas = document.querySelector('#introLight')
  const gl = canvas && canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
  if (!gl) return
  const VS = 'attribute vec2 p;varying vec2 vUv;void main(){vUv=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}'
  const NOISE = [
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);',
    'return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}',
    'float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<3;i++){v+=a*noise(p);p=p*2.03+vec2(17.3,9.1);a*=0.5;}return v;}'
  ].join('\\n')
  const SCENE_FS = [
    'precision highp float;',
    'varying vec2 vUv;uniform vec2 uRes;uniform float uTime;',
    NOISE,
    'void main(){',
    'float aspect=uRes.x/uRes.y;float x=(vUv.x-0.5)*aspect;float y=vUv.y;',
    'float n=fbm(vec2(x*3.5,y*2.2)+vec2(uTime*0.02,uTime*0.015));',
    'float n2=fbm(vec2(x*9.0,y*6.0)-vec2(uTime*0.06,0.0));',
    'float coneW=0.16+(1.0-y)*0.26;',
    'float shaft=smoothstep(coneW,0.0,abs(x))*smoothstep(0.0,0.78,y);',
    'shaft*=0.65+n*0.70;',
    'vec3 col=vec3(1.0,0.76,0.46)*shaft*0.50;',
    'col+=vec3(1.0,0.60,0.30)*smoothstep(0.30,0.0,abs(x))*smoothstep(0.45,0.0,y)*0.18;',
    'float d=length(vec2(x,y-0.15));',
    'col+=vec3(1.0,0.70,0.42)*smoothstep(0.70,0.05,d)*0.10;',
    'col*=0.75+0.45*n2;',
    'gl_FragColor=vec4(max(col,0.0),1.0);}'
  ].join('\\n')
  const BRIGHT_FS = [
    'precision highp float;varying vec2 vUv;uniform sampler2D uTex;',
    'void main(){vec3 c=texture2D(uTex,vUv).rgb;float l=max(max(c.r,c.g),c.b);',
    'float k=smoothstep(0.22,0.95,l);gl_FragColor=vec4(c*k*1.35,1.0);}'
  ].join('\\n')
  const BLUR_FS = [
    'precision highp float;varying vec2 vUv;uniform sampler2D uTex;uniform vec2 uDir;',
    'void main(){vec3 s=vec3(0.0);float wsum=0.0;',
    'for(int i=-6;i<=6;i++){float fi=float(i);float w=exp(-(fi*fi)/18.0);s+=texture2D(uTex,vUv+uDir*fi).rgb*w;wsum+=w;}',
    'gl_FragColor=vec4(s/wsum,1.0);}'
  ].join('\\n')
  const COMP_FS = [
    'precision highp float;',
    'varying vec2 vUv;uniform sampler2D uScene;uniform sampler2D uBloom;uniform float uTime;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
    'void main(){vec2 c=vUv-0.5;float ca=0.0022;',
    'vec3 sc;sc.r=texture2D(uScene,vUv+c*ca).r;sc.g=texture2D(uScene,vUv).g;sc.b=texture2D(uScene,vUv-c*ca).b;',
    'vec3 bl=texture2D(uBloom,vUv).rgb;',
    'vec3 col=sc+bl*0.95;',
    'col*=smoothstep(1.12,0.22,length(c*vec2(1.0,1.18)));',
    'col=col/(col+0.65)*1.25;',
    'col+=(hash(gl_FragCoord.xy+fract(uTime)*137.0)-0.5)*(3.0/255.0);',
    'gl_FragColor=vec4(col,1.0);}'
  ].join('\\n')
  const compile = (type, src) => {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(shader)); return null }
    return shader
  }
  const makeProgram = fsSrc => {
    const vert = compile(gl.VERTEX_SHADER, VS)
    const frag = compile(gl.FRAGMENT_SHADER, fsSrc)
    if (!vert || !frag) return null
    const program = gl.createProgram()
    gl.attachShader(program, vert)
    gl.attachShader(program, frag)
    gl.bindAttribLocation(program, 0, 'p')
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(program)); return null }
    return program
  }
  const sceneP = makeProgram(SCENE_FS)
  const brightP = makeProgram(BRIGHT_FS)
  const blurP = makeProgram(BLUR_FS)
  const compP = makeProgram(COMP_FS)
  if (!sceneP || !brightP || !blurP || !compP) { canvas.style.display = 'none'; return }
  const uni = (p, names) => Object.fromEntries(names.map(n => [n, gl.getUniformLocation(p, n)]))
  const sceneU = uni(sceneP, ['uRes', 'uTime'])
  const brightU = uni(brightP, ['uTex'])
  const blurU = uni(blurP, ['uTex', 'uDir'])
  const compU = uni(compP, ['uScene', 'uBloom', 'uTime'])
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  function makeTarget(tw, th){
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    return { tex, fb, w: tw, h: th }
  }
  let w = 0, h = 0, visible = false
  let sceneT = null, brightT = null, blurA = null, blurB = null
  const started = performance.now()
  function ensureTargets(){
    const tw = Math.max(2, w >> 1), th = Math.max(2, h >> 1)
    if (sceneT && sceneT.w === tw && sceneT.h === th) return
    ;[sceneT, brightT, blurA, blurB].forEach(t => { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb) } })
    sceneT = makeTarget(tw, th)
    brightT = makeTarget(tw, th)
    blurA = makeTarget(tw, th)
    blurB = makeTarget(tw, th)
  }
  function pass(program, target){
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null)
    gl.viewport(0, 0, target ? target.w : w, target ? target.h : h)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
  function draw(){
    /* 这是一层柔光，不需要原生分辨率：降采样后 GPU 负担小很多，观感几乎不变 */
    const dpr = Math.min(devicePixelRatio, 1.5) * .72
    const nw = Math.round((canvas.clientWidth || innerWidth) * dpr)
    const nh = Math.round((canvas.clientHeight || innerHeight) * dpr)
    if (nw !== w || nh !== h) { w = nw; h = nh; canvas.width = w; canvas.height = h }
    ensureTargets()
    const t = (performance.now() - started) / 1000
    gl.useProgram(sceneP)
    gl.uniform2f(sceneU.uRes, w, h)
    gl.uniform1f(sceneU.uTime, t)
    pass(sceneP, sceneT)
    gl.useProgram(brightP)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, sceneT.tex)
    gl.uniform1i(brightU.uTex, 0)
    pass(brightP, brightT)
    gl.useProgram(blurP)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, brightT.tex)
    gl.uniform1i(blurU.uTex, 0)
    gl.uniform2f(blurU.uDir, 1.6 / brightT.w, 0)
    pass(blurP, blurA)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, blurA.tex)
    gl.uniform2f(blurU.uDir, 0, 1.6 / brightT.h)
    pass(blurP, blurB)
    gl.useProgram(compP)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, blurB.tex)
    gl.uniform1i(compU.uBloom, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, sceneT.tex)
    gl.uniform1i(compU.uScene, 1)
    gl.uniform1f(compU.uTime, t)
    pass(compP, null)
  }
  let lastDrawAt = 0
  function loop(){
    /* 光在缓慢呼吸，30fps 足够；进入走廊后停画，把 GPU 让给纵深画布（重放开场时继续） */
    if (!introFallEntered) {
      const now = performance.now()
      if (now - lastDrawAt >= 33) { lastDrawAt = now; draw() }
    }
    if (visible) requestAnimationFrame(loop)
  }
  new IntersectionObserver(entries => {
    const was = visible
    visible = entries[0].isIntersecting
    if (visible && !was) requestAnimationFrame(loop)
  }).observe(canvas)
  draw()
  document.body.classList.add('webgl-light')
})()

/* ---------- ⑦ 纵深通道：第一人称走廊 ---------- */
const depthPanel = document.querySelector('.panel[data-panel="depth"]')
const depthScroll = $('#depthScroll'), depthTrack = $('#depthTrack'), depthPin = $('#depthPin')
let depthLockUntil = 0
let depthResidualUntil = 0
let depthLastInput = -1e9
/* 落地：开场那次滑动整段丢掉。锁内全吞；锁外只要还在同一次连续滑动里（间隔 < 350ms）
   也一起吞掉，最多再容忍到 2.6s。用户停手后再滑，才算新的一次手势，从第一本开始。 */
const blockDuringLanding = e => {
  const now = performance.now()
  const gap = now - depthLastInput
  depthLastInput = now
  if (now < depthLockUntil || (now < depthResidualUntil && gap < 350)) {
    e.preventDefault(); e.stopPropagation()
    depthScroll.scrollTop = 0
  }
}
depthScroll.addEventListener('wheel', blockDuringLanding, { passive: false })
depthScroll.addEventListener('touchmove', blockDuringLanding, { passive: false })
const depthCanvas = $('#depthCanvas'), depthCtx = depthCanvas.getContext('2d')
const depthNow = $('#depthNow'), depthSub = $('#depthSub'), depthHint = $('#depthHint'), depthRail = $('#depthRail')
const depthKicker = $('#depthKicker'), depthQuitEl = $('#depthQuit'), depthTurn = $('#depthTurn')
const depthStations = [...document.querySelectorAll('.dsp-page')]
const DEPTH = { length: 42, fov: .9, coverW: 1.85, horizon: .46, seg: 2.15, z0: 9, gap: 6.2 }
const SIDE = { gap: 13, dz: 12, stations: 4 }
const LOOK = { px: 100, max: 2 }
function lookMax(){ return Math.min(LOOK.max, (D.w || innerWidth) / 720 * LOOK.max) }
const D = { p: 0, camZ: 0, look: 0, lookTarget: 0, focus: 0, book: 0,
  side: false, sideX: 0, sideTarget: 0, sideLook: 0, sideLookT: 0, station: 0, turning: false,
  viewShift: 0, viewShiftT: 0, door: 0, doorTarget: 0, doorSide: 1, doorShift: 0,
  pulling: false, entering: false,
  w: 0, h: 0, dpr: 1, running: false, hits: [], snap: [], hintText: '', hudKey: '' }
const depthItems = BOOKS.map((book, i) => ({
  i, book,
  x: (i % 2 ? 1 : -1) * (1.55 + (i % 3) * .5),
  y: ((i % 3) - 1) * .26,
  z: DEPTH.z0 + i * DEPTH.gap
}))
const depthImgs = BOOKS.map(b => { const im = new Image(); im.src = b.img; return im })
const depthDust = Array.from({ length: 70 }, () => ({
  x: (Math.random() * 2 - 1) * 3.4, y: (Math.random() * 2 - 1) * 2.1,
  z: Math.random() * 44, r: .5 + Math.random() * 1.5, sp: .55 + Math.random() * .85
}))
const depthRound = (c, x, y, w, h, r) => {
  const rr = Math.min(r, w / 2, h / 2)
  c.beginPath()
  c.moveTo(x + rr, y)
  c.arcTo(x + w, y, x + w, y + h, rr)
  c.arcTo(x + w, y + h, x, y + h, rr)
  c.arcTo(x, y + h, x, y, rr)
  c.arcTo(x, y, x + w, y, rr)
  c.closePath()
}
function depthProject(x, y, dz){
  const f = D.h * DEPTH.fov
  return [D.w / 2 + (x - D.look - D.viewShift - D.doorShift) * f / dz, D.h * DEPTH.horizon + y * f / dz]
}
function depthResize(){
  const w = depthPin.clientWidth, h = depthPin.clientHeight
  if (!w || !h) return
  D.w = w; D.h = h; D.dpr = Math.min(devicePixelRatio || 1, 1.5)
  depthCanvas.width = Math.round(w * D.dpr)
  depthCanvas.height = Math.round(h * D.dpr)
  D.total = Math.max(1, depthTrack.offsetHeight - depthPin.clientHeight)
}
function depthBackdrop(c, t){
  const { w, h } = D, cx = w / 2
  const g = c.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#0d0b13'); g.addColorStop(.55, '#07070c'); g.addColorStop(1, '#030305')
  c.fillStyle = g; c.fillRect(0, 0, w, h)
  const glow = c.createRadialGradient(cx, h * .44, 0, cx, h * .44, Math.max(w, h) * .55)
  glow.addColorStop(0, 'rgba(255,196,118,.13)')
  glow.addColorStop(.42, 'rgba(190,130,80,.04)')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = glow; c.fillRect(0, 0, w, h)
  const dome = c.createRadialGradient(cx, -h * .18, 0, cx, -h * .18, h * .95)
  dome.addColorStop(0, 'rgba(255,214,150,.11)')
  dome.addColorStop(.45, 'rgba(255,190,120,.045)')
  dome.addColorStop(1, 'rgba(255,190,120,0)')
  c.fillStyle = dome; c.fillRect(0, 0, w, h)
}
function depthCorridor(c){
  [[-3.2, -2.1], [3.2, -2.1], [-3.2, 2.1], [3.2, 2.1]].forEach(([x, y]) => {
    const [ax, ay] = depthProject(x, y, 1.4)
    const [bx, by] = depthProject(x, y, 38)
    const g = c.createLinearGradient(ax, ay, bx, by)
    g.addColorStop(0, 'rgba(255,214,150,.15)')
    g.addColorStop(1, 'rgba(255,214,150,0)')
    c.strokeStyle = g; c.lineWidth = 1
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke()
  })
  const base = Math.floor(D.camZ / DEPTH.seg) * DEPTH.seg
  for (let z = base; z < D.camZ + 36; z += DEPTH.seg) {
    const dz = z - D.camZ
    if (dz < 1.2) continue
    const a = Math.pow(Math.max(0, 1 - dz / 36), 1.5)
    const [x1, y1] = depthProject(-3.2, -2.1, dz)
    const [x2, y2] = depthProject(3.2, 2.1, dz)
    c.strokeStyle = 'rgba(216,178,95,' + (a * .09).toFixed(3) + ')'
    c.lineWidth = 1
    c.strokeRect(x1, y1, x2 - x1, y2 - y1)
  }
}
function depthDustDraw(c, t){
  for (const d of depthDust) {
    let z = ((d.z - D.camZ * d.sp) % 44 + 44) % 44
    const dz = z + .6
    if (dz < .9) continue
    const [sx, sy] = depthProject(d.x + Math.sin(t * .0004 + d.z) * .12, d.y + Math.cos(t * .0003 + d.x) * .1, dz)
    const a = Math.max(0, 1 - dz / 40) * .38 * Math.min(1, (dz - .9) / 2.2)
    if (a <= .012 || sx < -20 || sx > D.w + 20) continue
    c.fillStyle = 'rgba(255,224,178,' + a.toFixed(3) + ')'
    c.beginPath(); c.arc(sx, sy, Math.max(.6, d.r * 12 / dz), 0, 6.283); c.fill()
  }
}
function depthCovers(c, t){
  const f = D.h * DEPTH.fov, cx = D.w / 2
  const list = depthItems.map(item => ({ item, dz: item.z - D.camZ }))
    .filter(o => o.dz > .6 && o.dz < 46)
    .sort((a, b) => b.dz - a.dz)
  D.hits = []
  D.snap = []
  let focusNear = Infinity
  const projected = list.map(({ item, dz }) => {
    const bw = DEPTH.coverW * f / dz, bh = bw * 1.5
    const [sx, sy] = depthProject(item.x, item.y, dz)
    const alpha = Math.min(1, Math.max(0, (46 - dz) / 10)) * Math.min(1, Math.max(0, (dz - .8) / 2.8))
    if (dz > 1.2 && dz < 22 && dz < focusNear) { focusNear = dz; D.focus = item.i }
    if (dz > 2 && dz < 18) D.snap.push({ x: item.x, cx: sx })
    return { item, dz, bw, bh, sx, sy, alpha }
  })
  for (const o of projected) {
    if (o.alpha <= .01) continue
    const bob = Math.sin(t * .0007 + o.item.i) * o.bh * .006
    const x = o.sx - o.bw / 2, y = o.sy - o.bh / 2 + bob
    const rad = Math.max(3, o.bw * .05)
    c.save()
    c.globalAlpha = o.alpha
    c.shadowColor = 'rgba(0,0,0,.9)'
    c.shadowBlur = Math.min(60, 10 + o.bw * .12)
    c.shadowOffsetY = o.bh * .02
    depthRound(c, x, y, o.bw, o.bh, rad)
    c.fillStyle = '#0a0a10'
    c.fill()
    c.restore()

    c.save()
    c.globalAlpha = o.alpha
    depthRound(c, x, y, o.bw, o.bh, rad)
    c.clip()
    const im = depthImgs[o.item.i]
    if (im && im.complete && im.naturalWidth) c.drawImage(im, x, y, o.bw, o.bh)
    const veil = c.createLinearGradient(0, y, 0, y + o.bh)
    veil.addColorStop(0, 'rgba(0,0,0,.2)')
    veil.addColorStop(.55, 'rgba(0,0,0,.04)')
    veil.addColorStop(1, 'rgba(0,0,0,.74)')
    c.fillStyle = veil; c.fillRect(x, y, o.bw, o.bh)
    c.fillStyle = 'rgba(0,0,0,.45)'
    c.fillRect(x, y, Math.max(2, o.bw * .045), o.bh)
    c.restore()

    if (o.item.i === D.focus) {
      const pulse = .5 + .5 * Math.sin(t * .0022)
      c.save()
      c.globalAlpha = o.alpha
      c.strokeStyle = 'rgba(255,214,138,' + (.55 + pulse * .35).toFixed(2) + ')'
      c.lineWidth = Math.max(1.5, o.bw * .011)
      c.shadowColor = 'rgba(255,196,110,.9)'
      c.shadowBlur = 18 + pulse * 16
      depthRound(c, x - 6, y - 6, o.bw + 12, o.bh + 12, rad + 3)
      c.stroke()
      c.lineWidth = 1
      c.strokeStyle = 'rgba(255,224,170,.32)'
      c.shadowBlur = 0
      depthRound(c, x - 13, y - 13, o.bw + 26, o.bh + 26, rad + 9)
      c.stroke()
      const ay = y + o.bh / 2, s = Math.max(4, o.bw * .035)
      c.strokeStyle = 'rgba(255,214,138,' + (.5 + pulse * .4).toFixed(2) + ')'
      c.lineWidth = 2
      ;[-1, 1].forEach(dir => {
        const ax = dir < 0 ? x - 26 : x + o.bw + 26
        c.beginPath()
        c.moveTo(ax - dir * s, ay - s)
        c.lineTo(ax, ay)
        c.lineTo(ax - dir * s, ay + s)
        c.stroke()
      })
      c.restore()
    }
    if (o.bw > 108 && o.alpha > .55) {
      const fs = Math.max(12, Math.min(24, o.bw * .115))
      c.save()
      c.globalAlpha = o.alpha
      c.textAlign = 'center'
      c.font = '600 ' + fs + 'px "Noto Serif SC","Songti SC",serif'
      c.fillStyle = 'rgba(255,255,255,.92)'
      c.fillText(o.item.book.title, o.sx, y + o.bh + fs * 1.75)
      c.font = '400 ' + Math.max(9, fs * .5) + 'px "PingFang SC","Noto Sans SC",sans-serif'
      c.fillStyle = 'rgba(255,255,255,.48)'
      c.fillText(o.item.book.genre, o.sx, y + o.bh + fs * 2.8)
      if (o.item.i === D.focus) {
        c.fillStyle = 'rgba(255,214,138,.92)'
        c.fillText('← 左右拖动环视 →', o.sx, y + o.bh + fs * 4.05)
      }
      c.restore()
    }
    D.hits.push({ i: o.item.i, x, y, w: o.bw, h: o.bh, dz: o.dz })
  }
  D.hits.sort((a, b) => a.dz - b.dz)
  D.lookTarget = depthItems[D.focus].x
}
const sideDust = Array.from({ length: 60 }, () => ({
  x: Math.random() * 26, y: (Math.random() * 2 - 1) * 2.2, r: .5 + Math.random() * 1.4
}))
function sideColor(b, a){
  const m = (b.glow.match(/[\\d.]+/g) || [216, 178, 95]).slice(0, 3)
  return 'rgba(' + m[0] + ',' + m[1] + ',' + m[2] + ',' + a + ')'
}
function sideScene(c, t){
  const b = BOOKS[D.book], w = D.w, h = D.h, cx = w / 2, f = h * DEPTH.fov, dz = SIDE.dz
  const cy = h / 2 + D.sideLook * h * .05
  const bg = c.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, b.c1); bg.addColorStop(.55, b.c2); bg.addColorStop(1, '#030305')
  c.globalAlpha = .5; c.fillStyle = bg; c.fillRect(0, 0, w, h); c.globalAlpha = 1
  const glow = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * .62)
  glow.addColorStop(0, sideColor(b, .3))
  glow.addColorStop(.45, sideColor(b, .08))
  glow.addColorStop(1, sideColor(b, 0))
  c.fillStyle = glow; c.fillRect(0, 0, w, h)
  const base = Math.round(D.sideX / SIDE.gap)
  for (let k = base - 2; k <= base + 3; k++) {
    const wx = k * SIDE.gap
    const sx = cx + (wx - D.sideX) * f / dz
    const a = Math.max(0, 1 - Math.abs(wx - D.sideX) / (SIDE.gap * 1.9))
    c.strokeStyle = sideColor(b, (a * .16).toFixed(3))
    c.lineWidth = 1
    c.beginPath(); c.moveTo(sx, cy - 4.2 * f / dz); c.lineTo(sx, cy + 4.2 * f / dz); c.stroke()
  }
  ;[-4.2, 4.2].forEach(y => {
    const sy = cy + y * f / dz
    c.strokeStyle = sideColor(b, .1)
    c.beginPath(); c.moveTo(0, sy); c.lineTo(w, sy); c.stroke()
  })
  for (const d of sideDust) {
    let wx = ((d.x - D.sideX) % 26 + 26) % 26
    if (wx > 13) wx -= 26
    const sx = cx + wx * f / dz
    const sy = cy + d.y * f / dz + Math.sin(t * .0006 + d.x) * 4
    const a = Math.max(0, 1 - Math.abs(wx) / 12) * .42
    if (a <= .012 || sx < -20 || sx > w + 20) continue
    c.fillStyle = sideColor(b, a.toFixed(3))
    c.beginPath(); c.arc(sx, sy, Math.max(.6, d.r * 12 / dz), 0, 6.283); c.fill()
  }
  depthVignette(c)
}
function depthVignette(c){
  const { w, h } = D
  const v = c.createRadialGradient(w / 2, h * .46, Math.min(w, h) * .18, w / 2, h * .5, Math.max(w, h) * .78)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,.82)')
  c.fillStyle = v; c.fillRect(0, 0, w, h)
}
function doorDraw(c, t){
  const k = D.door
  if (k <= .004) return
  const side = D.doorSide || 1
  const w = D.w, h = D.h
  const open = Math.pow(k, .7)
  const cx = (side < 0 ? w * .27 : w * .73) - side * open * w * .02
  const cy = h * .5
  const base = Math.max(w, 900)
  const rx = base * (.012 + .05 * open)
  const ry = rx * 1.6
  const rot = side * .1
  const R = Math.max(rx, ry)

  c.save()
  c.translate(cx, cy)
  c.scale(1, 1.45)
  const halo = c.createRadialGradient(0, 0, 0, 0, 0, R * 3)
  halo.addColorStop(0, 'rgba(255,206,140,' + (.34 * open).toFixed(3) + ')')
  halo.addColorStop(.4, 'rgba(255,170,96,' + (.14 * open).toFixed(3) + ')')
  halo.addColorStop(1, 'rgba(255,150,80,0)')
  c.fillStyle = halo
  c.beginPath(); c.arc(0, 0, R * 3, 0, 6.283); c.fill()
  c.restore()

  c.save()
  c.translate(cx, cy); c.rotate(rot)
  c.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 3; i++){
    const rr = R * (1.35 + i * .22)
    c.strokeStyle = 'rgba(255,214,156,' + ((.16 - i * .04) * open).toFixed(3) + ')'
    c.lineWidth = 1
    c.beginPath(); c.ellipse(0, 0, rr, rr * 1.5, 0, -.7 + i * .4, 1.1 + i * .4); c.stroke()
    c.beginPath(); c.ellipse(0, 0, rr, rr * 1.5, 0, Math.PI - .7 + i * .4, Math.PI + 1.1 + i * .4); c.stroke()
  }
  c.restore()

  c.fillStyle = 'rgba(4,3,2,.97)'
  c.beginPath(); c.ellipse(cx, cy, rx, ry, rot, 0, 6.283); c.fill()

  c.save()
  c.translate(cx, cy); c.rotate(rot * .5)
  c.globalCompositeOperation = 'lighter'
  const bandRX = rx * 2.2, bandRY = ry * .24
  for (const [a0, a1, al, lw] of [[Math.PI, 6.283, .35, 1], [0, Math.PI, 1, 2.2]]){
    const ba = al * (.5 + .5 * open)
    const bg = c.createLinearGradient(-bandRX, 0, bandRX, 0)
    bg.addColorStop(0, 'rgba(255,170,90,0)')
    bg.addColorStop(.3, 'rgba(255,196,120,' + (ba * .5).toFixed(3) + ')')
    bg.addColorStop(.5, 'rgba(255,248,220,' + (ba * .95).toFixed(3) + ')')
    bg.addColorStop(.7, 'rgba(255,196,120,' + (ba * .5).toFixed(3) + ')')
    bg.addColorStop(1, 'rgba(255,170,90,0)')
    c.strokeStyle = bg
    c.lineWidth = (1 + 4 * open) * lw
    c.beginPath(); c.ellipse(0, 0, bandRX, bandRY, 0, a0, a1); c.stroke()
  }
  c.restore()

  c.save()
  c.globalCompositeOperation = 'lighter'
  c.shadowColor = 'rgba(255,224,170,.9)'
  c.shadowBlur = 16 + 26 * open
  c.strokeStyle = 'rgba(255,244,214,' + (.5 + .45 * k).toFixed(3) + ')'
  c.lineWidth = 1.2 + 2 * open
  c.beginPath(); c.ellipse(cx, cy, rx, ry, rot, 0, 6.283); c.stroke()
  c.strokeStyle = 'rgba(255,208,150,' + (.3 + .25 * k).toFixed(3) + ')'
  c.lineWidth = .9
  c.beginPath(); c.ellipse(cx, cy, rx * 1.08, ry * 1.08, rot, 0, 6.283); c.stroke()
  c.restore()

  if (k > .02){
    const head = -Math.PI / 2 + (t * .0018) % 6.283
    c.save()
    c.globalCompositeOperation = 'lighter'
    c.strokeStyle = 'rgba(255,248,225,' + (.45 + .45 * k).toFixed(3) + ')'
    c.lineWidth = 1.4 + 1.6 * k
    c.shadowColor = 'rgba(255,220,150,.9)'
    c.shadowBlur = 10 + 16 * k
    c.beginPath(); c.arc(cx, cy, R + 12, head - 6.283 * k, head); c.stroke()
    c.restore()
  }

  c.save()
  c.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 22; i++){
    const seed = i * 17.31
    const ang = seed + t * .0006 * (1 + i % 3)
    const rad = .5 + ((seed * 5.3) % 1) * .9
    const px = cx + Math.cos(ang) * rx * 1.6 * rad
    const py = cy + Math.sin(ang) * ry * 1.35 * rad
    const pa = (.15 + .5 * k) * (.5 + .5 * Math.sin(t * .002 + seed))
    c.fillStyle = 'rgba(255,226,160,' + Math.max(0, pa).toFixed(3) + ')'
    c.beginPath(); c.arc(px, py, .7 + 1.3 * k, 0, 6.283); c.fill()
  }
  c.restore()
}
function depthDraw(t){
  if (!D.w || !D.h) return
  const c = depthCtx
  c.setTransform(D.dpr, 0, 0, D.dpr, 0, 0)
  c.clearRect(0, 0, D.w, D.h)
  if (D.side) { sideScene(c, t); return }
  depthBackdrop(c, t)
  depthCorridor(c)
  depthDustDraw(c, t)
  depthCovers(c, t)
  depthVignette(c)
  doorDraw(c, t)
}
/* 跨页版式：书固定不动，只有左页封面做极轻的视差，翻页交给 .dsp-page */
const dspreadEl = $('#dspread'), dspLeft = $('#dspLeft'), dspPages = $('#dspPages')
const dspNo = $('#dspNo'), dspTabs = $('#dspTabs'), dspFlip = $('#dspFlip')
let dspCur = -1
function dspShowPage(i, animate){
  i = Math.min(SIDE.stations - 1, Math.max(0, i))
  if (i === dspCur) return
  const prev = dspCur
  dspCur = i
  dspPages.querySelectorAll('.dsp-page').forEach((el, k) => {
    el.classList.toggle('is-on', k === i)
    el.classList.toggle('is-out', animate && k === prev)
  })
  dspNo.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(SIDE.stations).padStart(2, '0')
  dspTabs.querySelectorAll('i').forEach((t, k) => t.classList.toggle('is-on', k === i))
  if (animate){
    dspFlip.classList.remove('is-on')
    void dspFlip.offsetWidth
    dspFlip.classList.add('is-on')
  }
}
dspTabs.addEventListener('click', e => {
  if (!D.side) return
  const i = [...dspTabs.children].indexOf(e.target)
  if (i < 0) return
  D.sideTarget = i * SIDE.gap
})
function depthStationSync(){
  /* 滚动位置到页边的比例，映射成左页 10px 的视差，制造"书在手里"的感觉 */
  const k = Math.max(-1, Math.min(1, (D.sideX - D.station * SIDE.gap) / SIDE.gap))
  dspLeft.style.transform = 'translate3d(' + (-k * 10).toFixed(1) + 'px,0,0)'
  /* 拖动时整页跟着手指轻微位移，松手吸附回位；只是位移，不重排 */
  if (Math.abs(D.sideTarget - D.sideX) > .05){
    dspPages.style.transition = 'none'
    dspPages.style.transform = 'translate3d(' + (k * 26).toFixed(1) + 'px,0,0)'
  } else if (dspPages.style.transform){
    dspPages.style.transition = 'transform .3s cubic-bezier(.22,.9,.24,1)'
    dspPages.style.transform = ''
  }
  if (D.side) dspShowPage(D.station, true)
}
function depthSync(){
  const side = D.side
  const b = BOOKS[side ? D.book : D.focus]
  if (side) {
    D.station = Math.min(SIDE.stations - 1, Math.max(0, Math.round(D.sideX / SIDE.gap)))
    depthRail.style.height = ((D.station / (SIDE.stations - 1)) * 100).toFixed(1) + '%'
    const sub = '剧本内页 · 第 ' + (D.station + 1) + ' / ' + SIDE.stations + ' 页'
    if (depthSub.textContent !== sub) depthSub.textContent = sub
    if (depthKicker.textContent !== '翻开剧本 · 左右翻页') depthKicker.textContent = '翻开剧本 · 左右翻页'
    if (depthQuitEl.textContent !== '返回走廊') depthQuitEl.textContent = '返回走廊'
    const hint = D.station === SIDE.stations - 1 ? '这是最后一页 · 右滑往回翻' : '左右滑动翻页 · 右滑往回翻'
    if (D.hintText !== hint) { D.hintText = hint; depthHint.textContent = hint }
    depthHint.style.opacity = '1'
  } else {
    depthRail.style.height = (D.p * 100).toFixed(1) + '%'
    if (depthKicker.textContent !== '纵向走廊 · 上下选本') depthKicker.textContent = '纵向走廊 · 上下选本'
    if (depthQuitEl.textContent !== '退出') depthQuitEl.textContent = '退出'
    depthHint.style.opacity = D.p > .03 ? '0' : '1'
    const atEdge = Math.abs(D.viewShift) > lookMax() * .97
    const hint = D.p > .96 ? '通道尽头 · 上滑回去挑一本'
      : (D.door > .02 || atEdge) ? '在门边保持 1 秒 · 正在推门'
      : '上下滑动选本 · 左右拖动环视，看到边再拉开门'
    if (D.hintText !== hint) { D.hintText = hint; depthHint.textContent = hint }
    const sub = b.genre + ' · ' + b.cast.length + ' 位席位'
    if (depthSub.textContent !== sub) depthSub.textContent = sub
  }
  if (depthNow.textContent !== b.title) depthNow.textContent = b.title
  depthStationSync()
}
function depthFill(b){
  const st = depthStations
  const cover = $('#dspCover')
  cover.src = b.img
  cover.alt = b.title + ' 封面'
  $('#dspTitle').textContent = b.title
  $('#dspGenre').textContent = b.genre
  $('#dspSeats').textContent = b.cast.length + ' 位席位 · 五小时本'
  st[0].querySelector('[data-slot="story"]').textContent = b.text
  st[1].querySelector('[data-slot="beats"]').innerHTML = b.beats.map(([time, title, line]) =>
    '<li><b>' + esc(time) + '</b><strong>' + esc(title) + '</strong><span>' + esc(line) + '</span></li>').join('')
  st[2].querySelector('[data-slot="cast"]').innerHTML = b.cast.map(([name, identity]) =>
    '<li><b>' + esc(name) + '</b><span>' + esc(identity) + '</span></li>').join('')
  st[3].querySelector('[data-slot="ctaTitle"]').textContent = '今晚就《' + b.title + '》'
  st[3].querySelector('[data-slot="ctaText"]').textContent = b.genre + ' · ' + b.cast.length + ' 位席位 · 开本即入席'
}
function depthLoop(){
  if (!depthPanel.classList.contains('is-on')) { D.running = false; return }
  if (D.side) {
    D.sideX += (D.sideTarget - D.sideX) * .16
    D.sideLook += (D.sideLookT - D.sideLook) * .12
  } else {
    const total = D.total || 1
    const now = performance.now()
    D.p = total > 0 ? unit(depthScroll.scrollTop / total) : 0
    D.camZ = D.p * DEPTH.length
    D.look += (D.lookTarget - D.look) * .12
    D.viewShift += (D.viewShiftT - D.viewShift) * .18
    D.doorTarget = holdTimer ? Math.min(1, (now - holdStart) / 1000) : 0
    D.door += (D.doorTarget - D.door) * .2
    if (D.doorTarget >= 1) depthArmEnter()
    D.doorShift = D.doorSide * Math.pow(D.door, 1.35) * 1.15
  }
  depthDraw(performance.now())
  depthSync()
  requestAnimationFrame(depthLoop)
}
function depthOpen(){
  depthResize()
  if (!D.running) { D.running = true; depthLoop() }
}
function depthTurnFlash(){
  depthTurn.classList.remove('is-on')
  void depthTurn.offsetWidth
  depthTurn.classList.add('is-on')
  clearTimeout(D.turnTimer)
  D.turnTimer = setTimeout(() => depthTurn.classList.remove('is-on'), 700)
}
function depthEnterSide(i){
  if (D.side) return
  D.book = i
  D.side = true
  D.sideX = 0; D.sideTarget = 0
  D.sideLook = 0; D.sideLookT = 0
  D.station = 0
  D.hintText = ''
  D.viewShift = 0; D.viewShiftT = 0
  D.door = 0; D.doorTarget = 0; D.doorShift = 0
  holdCancel()
  D.pulling = false
  depthFill(BOOKS[i])
  dspCur = -1
  dspShowPage(0, false)
  dspreadEl.classList.add('is-on')
  dspreadEl.setAttribute('aria-hidden', 'false')
  depthScroll.style.overflow = 'hidden'
  depthCanvas.style.touchAction = 'none'
  depthCanvas.style.transition = 'none'
  depthCanvas.style.transform = 'translateX(12%)'
  requestAnimationFrame(() => {
    depthCanvas.style.transition = 'transform .62s cubic-bezier(.22,.9,.24,1)'
    depthCanvas.style.transform = ''
  })
  depthTurnFlash()
}
function depthExitSide(){
  if (!D.side) return
  D.side = false
  D.sideX = 0; D.sideTarget = 0
  D.sideLook = 0; D.sideLookT = 0
  D.viewShift = 0; D.viewShiftT = 0
  D.door = 0; D.doorTarget = 0; D.doorShift = 0
  holdCancel()
  D.pulling = false
  dspreadEl.classList.remove('is-on')
  dspreadEl.setAttribute('aria-hidden', 'true')
  depthScroll.style.overflow = ''
  depthCanvas.style.touchAction = ''
  depthCanvas.style.transition = 'none'
  depthCanvas.style.transform = 'translateX(-12%)'
  requestAnimationFrame(() => {
    depthCanvas.style.transition = 'transform .62s cubic-bezier(.22,.9,.24,1)'
    depthCanvas.style.transform = ''
  })
  D.hintText = ''
  depthTurnFlash()
}
document.querySelector('[data-act="back"]').addEventListener('click', depthExitSide)
document.querySelector('[data-act="confirm"]').addEventListener('click', () => {
  const b = BOOKS[D.book]
  $('#toast').textContent = '已记下：《' + b.title + '》'
  $('#toast').classList.add('is-on')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => $('#toast').classList.remove('is-on'), 1800)
})
let depthDrag = null, depthSwallow = false
let holdTimer = 0, holdStart = 0
function holdBegin(){
  if (holdTimer) return
  holdStart = performance.now()
  holdTimer = setTimeout(() => { holdTimer = 0; depthArmEnter() }, 1000)
}
function holdCancel(){
  if (!holdTimer) return
  clearTimeout(holdTimer)
  holdTimer = 0
}
function depthArmEnter(){
  if (D.entering) return
  holdCancel()
  D.entering = true
  D.door = 1
  D.doorTarget = 1
  D.viewShiftT = lookMax() * D.doorSide
  D.viewShift = D.viewShiftT
  setTimeout(() => {
    D.entering = false
    D.pulling = false
    depthEnterSide(D.focus)
  }, 110)
}
depthPin.addEventListener('pointerdown', e => {
  if (e.target.closest('button,.depth-hud,.depth-rail,.depth-turn')) return
  depthDrag = { x: e.clientX, y: e.clientY, sideX: D.sideTarget, sideLook: D.sideLookT, moved: false, side: D.side }
  depthSwallow = false
  if (!D.side) {
    D.pulling = true
    holdCancel()
    D.viewShiftT = 0; D.doorTarget = 0; D.doorSide = 1
  }
})
depthPin.addEventListener('pointermove', e => {
  if (!depthDrag) return
  const dx = e.clientX - depthDrag.x, dy = e.clientY - depthDrag.y
  if (!depthDrag.moved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) depthDrag.moved = true
  if (!depthDrag.moved) return
  if (depthDrag.side) {
    /* 一次手势最多翻一页：拖再远也只前进/后退一页，像真的翻纸 */
    const steps = Math.max(-1, Math.min(1, -dx / (D.w || innerWidth) / .34))
    D.sideTarget = Math.max(0, Math.min((SIDE.stations - 1) * SIDE.gap, depthDrag.sideX + steps * SIDE.gap))
    D.sideLookT = Math.max(-1, Math.min(1, depthDrag.sideLook + dy / (D.h || innerHeight) * 1.5))
    return
  }
  if (D.entering) return
  if (Math.abs(dx) <= 6) return
  const dir = dx < 0 ? -1 : 1
  D.doorSide = dir
  D.viewShiftT = Math.max(-1, Math.min(1, dx / LOOK.px)) * lookMax()
  if (Math.abs(dx) >= LOOK.px) holdBegin(); else holdCancel()
})
depthPin.addEventListener('pointerup', e => {
  if (!depthDrag) return
  const dx = e.clientX - depthDrag.x
  const wasSide = depthDrag.side
  depthSwallow = depthDrag.moved
  if (wasSide) {
    if (dx > 90 && D.station === 0) depthExitSide()
    else D.sideTarget = Math.max(0, Math.min((SIDE.stations - 1) * SIDE.gap, Math.round(D.sideTarget / SIDE.gap) * SIDE.gap))
  } else if (!D.entering) {
    D.pulling = false
    holdCancel()
    D.viewShiftT = 0
    D.doorTarget = 0
  }
  depthDrag = null
})
depthPin.addEventListener('pointercancel', () => {
  if (!depthDrag) return
  depthSwallow = depthDrag.moved
  depthDrag = null
  if (D.side) D.sideTarget = Math.round(D.sideTarget / SIDE.gap) * SIDE.gap
  else { D.pulling = false; holdCancel(); D.viewShiftT = 0; D.doorTarget = 0 }
})
depthCanvas.addEventListener('click', e => {
  if (depthSwallow) { depthSwallow = false; return }
  if (D.side) return
  const r = depthCanvas.getBoundingClientRect()
  const x = e.clientX - r.left, y = e.clientY - r.top
  for (const hit of D.hits) {
    if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) {
      depthEnterSide(hit.i)
      break
    }
  }
})
depthPanel.addEventListener('wheel', e => {
  if (!D.side) return
  e.preventDefault()
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
  if (Math.abs(delta) < 2) return
  /* 一次滚动爆发只翻一页，和拖动同一套手感 */
  if (performance.now() < (D.wheelLock || 0)) return
  D.wheelLock = performance.now() + 420
  D.sideTarget = Math.max(0, Math.min((SIDE.stations - 1) * SIDE.gap, D.sideTarget + (delta > 0 ? SIDE.gap : -SIDE.gap)))
}, { passive: false })
function depthQuitAll(){
  if (D.side) depthExitSide()
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('is-on'))
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('is-on'))
  document.querySelectorAll('.gw-item').forEach(i => i.classList.remove('is-on'))
  document.querySelector('.wrap')?.classList.remove('has-panel')
  depthScroll.scrollTop = 0
  D.p = 0; D.camZ = 0; D.look = 0; D.lookTarget = 0
  D.viewShift = 0; D.viewShiftT = 0
  D.door = 0; D.doorTarget = 0; D.doorShift = 0
  holdCancel()
  D.pulling = false; D.entering = false
  document.querySelector('.wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
depthQuitEl.addEventListener('click', () => { if (D.side) depthExitSide(); else depthQuitAll() })
addEventListener('keydown', e => {
  if (!depthPanel.classList.contains('is-on')) return
  if (e.key === 'Escape') { if (D.side) depthExitSide(); else depthQuitAll(); return }
  if (!D.side) return
  if (e.key === 'ArrowLeft') D.sideTarget = Math.min((SIDE.stations - 1) * SIDE.gap, (D.station + 1) * SIDE.gap)
  if (e.key === 'ArrowRight') {
    if (D.station === 0) depthExitSide()
    else D.sideTarget = (D.station - 1) * SIDE.gap
  }
})
$('#archiveJump').addEventListener('click', () => {
  const arc = $('#archive')
  if (arc) { arc.open = true; arc.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
})
/* 只要不是“开场”入口，就退出开场遮蔽，露出后面的页面 */
document.addEventListener('click', e => {
  if (e.target.closest('.gw-item[data-goto="intro"], #replayIntro')) return
  if (e.target.closest('.tab, .gw-item, #replayIntro')) document.body.classList.remove('intro-flow')
})
addEventListener('scroll', () => {
  if (introFallEntered || !document.body.classList.contains('intro-flow')) return
  const total = introEl.offsetHeight - innerHeight
  if (total > 0 && scrollY > total * .90) enterFall()
}, { passive: true })
depthScroll.addEventListener('scroll', () => { if (!D.running) depthOpen() }, { passive: true })
addEventListener('resize', depthResize)
new ResizeObserver(depthResize).observe(depthPin)

/* ---------- 扫码首屏三案：缩放 / 伪二维码 / 尘埃 / 翻牌 ---------- */


/* 21×21 伪二维码 + 三个定位角，仅作预览示意 */
function gateDrawQr(canvas, seed){
  const ctx = canvas.getContext('2d')
  const size = canvas.width
  const cells = 21
  const cell = size / cells
  ctx.fillStyle = '#efe8d8'
  ctx.fillRect(0, 0, size, size)
  let s = seed
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  const finder = (cx, cy) => {
    ctx.fillStyle = '#171310'
    ctx.fillRect(cx * cell, cy * cell, 7 * cell, 7 * cell)
    ctx.fillStyle = '#efe8d8'
    ctx.fillRect((cx + 1) * cell, (cy + 1) * cell, 5 * cell, 5 * cell)
    ctx.fillStyle = '#171310'
    ctx.fillRect((cx + 2) * cell, (cy + 2) * cell, 3 * cell, 3 * cell)
  }
  const inFinder = (x, y) => (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)
  ctx.fillStyle = '#171310'
  for (let y = 0; y < cells; y++){
    for (let x = 0; x < cells; x++){
      if (inFinder(x, y)) continue
      if (rnd() < .46) ctx.fillRect(x * cell, y * cell, cell, cell)
    }
  }
  finder(0, 0); finder(cells - 7, 0); finder(0, cells - 7)
}
document.querySelectorAll('canvas[data-gate-qr]').forEach((c, i) => gateDrawQr(c, 977 + i * 131))

/* A 屏尘埃：54 颗，随机位置与漂浮时长 */
const gateDustA = document.getElementById('gateDustA')
if (gateDustA){
  let html = ''
  for (let i = 0; i < 54; i++){
    const left = Math.round(220 + Math.random() * 1000)
    const top = Math.round(120 + Math.random() * 620)
    const dur = (7 + Math.random() * 9).toFixed(1)
    const delay = (-Math.random() * 12).toFixed(1)
    const op = (.25 + Math.random() * .55).toFixed(2)
    html += '<i style="left:' + left + 'px;top:' + top + 'px;opacity:' + op + ';animation-duration:' + dur + 's;animation-delay:' + delay + 's"></i>'
  }
  gateDustA.innerHTML = html
}

/* ?p=0.5 直接定位到开场某个进度，方便截图核对 */
const startAt = Number(new URLSearchParams(location.search).get('p'))
if (!Number.isNaN(startAt) && startAt > 0) {
  introPlayed = true
  introEl.classList.remove('is-live')
  const total = introEl.offsetHeight - innerHeight
  window.scrollTo(0, introEl.offsetTop + total * Math.min(startAt, .98))
  introUpdate()
}

/* ---- 扫码入场 A/B 对比 ---- */
const AC_ROMANS = ['〇','一','二','三','四','五']
const AC_PHONES = [...document.querySelectorAll('.ac-phone')]
if (AC_PHONES.length && typeof BOOKS !== 'undefined') {
  AC_PHONES.forEach(phone => {
    phone.querySelector('.ac-track').innerHTML = BOOKS.map((b, i) =>
      \`<div class="ac-book" data-i="\${i}"><img src="\${b.img}" alt="\${b.title}"><span>\${b.title}</span></div>\`).join('')
    const layers = phone.querySelector('.ac-layers')
    if (layers) layers.innerHTML = BOOKS.map(b =>
      \`<i class="ac-layer" style="background-image:url('\${b.img}')"></i>\`).join('')
  })
  const acScroll = phone => {
    let i = 0
    const books = [...phone.querySelectorAll('.ac-book')]
    const meta = phone.querySelector('.ac-meta')
    const paint = () => {
      books.forEach((b, k) => b.classList.toggle('on', k === i))
      phone.querySelector('.ac-track').style.transform = \`translateY(\${-i * 168}px)\`
      if (meta) {
        meta.querySelector('em').textContent = \`第 \${AC_ROMANS[i]} 幕\`
        meta.querySelector('h3').textContent = BOOKS[i].title
        meta.querySelector('p').textContent = \`\${BOOKS[i].genre} · 5 人本\`
      }
    }
    paint()
    clearInterval(phone._acTimer)
    phone._acTimer = setInterval(() => { i = (i + 1) % BOOKS.length; paint() }, 1700)
  }
  const acPlayB = () => {
    const phone = document.querySelector('.ac-phone[data-ac="b"]')
    clearInterval(phone._acTimer)
    const token = phone._acToken = (phone._acToken || 0) + 1
    const layers = [...phone.querySelectorAll('.ac-layer')]
    const later = (ms, fn) => setTimeout(() => { if (phone._acToken === token) fn() }, ms)
    layers.forEach(l => l.classList.remove('on'))
    phone.dataset.step = 'slit'
    later(800, () => { phone.dataset.step = 'blend'; layers.forEach(l => l.classList.add('on')) })
    later(2900, () => {
      layers.forEach((l, k) => l.classList.toggle('on', k === 0))
      phone.dataset.step = 'focus'
    })
    later(4400, () => { phone.dataset.step = 'corridor'; acScroll(phone) })
  }
  window.acPlay = acPlayB
  document.querySelector('[data-ac-play]')?.addEventListener('click', window.acPlay)
}

/* ?tab=flip 之类可直接打开某个方案，方便截图与分享 */
const initialTab = window.previewLegacyScene
if (initialTab) {
  const targetTab = tabs.find(t => t.dataset.tab === initialTab)
  if (targetTab) {
    /* 定格在目标方案：关掉开场自动下落，避免它随后把标签切回纵深通道；
       同时收起 320vh 的开场段，否则它会把预览面板压在下面 */
    introFallEntered = true
    markIntroSeen()
    document.body.classList.remove('intro-flow')
    introEl.classList.remove('is-live')
    introEl.classList.add('is-skipped')
    targetTab.click()
    window.scrollTo(0, 0)
  }
}


</script></body></html>`

export function legacySceneDocument(scene) {
  const base = new URL('./', import.meta.url).href
  const boot = '<base href="' + base + '"><script>window.previewLegacyScene=' + JSON.stringify(scene) + '<' + '/script>'
  return legacyDocument.replace('<head>', '<head>' + boot).replace('</head>', "<style>\nbody{padding-left:0!important}.gateway,.host-gate,.ambient,.cursor-light,header.top,.crumbs,.archive,.src,.note{display:none!important}\n.wrap{display:flex;flex-direction:column;justify-content:center;min-height:100vh;padding:0 12px;max-width:none}.headline{margin-top:0}.headline p,.headline .tag{display:none}\nbody.intro-flow .intro{height:170vh}.ac-stage{margin-top:10px;gap:12px}.ac-col{width:auto;height:auto;max-width:100%}.ac-phone{width:auto;height:min(660px,calc(100vh - 210px));aspect-ratio:1/2;margin:0 auto;transform:none}\n/* 时空入场只有一部手机参与居中：标题与说明由画廊卡片承担，避免把手机压到中线以下 */\n.panel[data-panel=\"arrivec\"] .headline,.panel[data-panel=\"arrivec\"] .ac-cap,.panel[data-panel=\"arrivec\"] .ac-bar{display:none!important}\n.panel[data-panel=\"arrivec\"] .ac-stage{margin:0!important;padding:0!important}\n</style>" + '</head>')
}
