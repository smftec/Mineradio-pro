# v1.9.0 补丁:Home 大屏首页 + 命令面板 CSS
import io
p = 'public/css/app.css'
s = io.open(p, encoding='utf-8').read()

home_css = """
/* ============ Home 大屏首页(原版 hero 语言) ============ */
.home-hero {
  position: relative; min-height: 420px; padding: 28px;
  border-radius: 28px;
  border: 1px solid rgba(var(--accent-rgb), .22);
  background: linear-gradient(145deg, rgba(33, 29, 40, .64), rgba(9, 10, 14, .78) 48%, rgba(17, 20, 28, .72));
  box-shadow: 0 28px 90px rgba(0, 0, 0, .34), 0 0 0 1px rgba(var(--accent-rgb), .07), inset 0 1px 0 rgba(255, 255, 255, .065);
  backdrop-filter: blur(30px) saturate(1.16);
  overflow: hidden;
}
[data-theme="light"] .home-hero {
  background: linear-gradient(145deg, rgba(255, 255, 255, .8), rgba(244, 246, 252, .92) 48%, rgba(238, 242, 252, .86));
  box-shadow: 0 20px 60px rgba(30, 40, 80, .12), 0 0 0 1px rgba(var(--accent-rgb), .08), inset 0 1px 0 rgba(255, 255, 255, .6);
}
.home-hero::before {
  content: ''; position: absolute; inset: 0; opacity: .72; pointer-events: none;
  background:
    linear-gradient(118deg, rgba(255, 255, 255, .06), transparent 24%, rgba(var(--accent-rgb), .07) 54%, rgba(var(--accent2-rgb), .055) 82%, transparent 100%),
    linear-gradient(90deg, rgba(255, 255, 255, .032) 0 1px, transparent 1px 48px),
    linear-gradient(0deg, rgba(255, 255, 255, .024) 0 1px, transparent 1px 44px);
}
.home-hero::after {
  content: ''; position: absolute; left: 28px; right: 28px; bottom: 22px; height: 1px; opacity: .82; pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(var(--accent-rgb), .52), rgba(var(--accent2-rgb), .3), rgba(255, 255, 255, .18), transparent);
}
.home-hero-inner {
  position: relative; z-index: 2; height: 100%;
  display: grid; grid-template-columns: minmax(0, 1.16fr) minmax(150px, .64fr);
  grid-template-rows: auto auto auto auto minmax(150px, 1fr);
  column-gap: 18px;
}
.home-kicker {
  grid-column: 1; font-size: 10px; font-weight: 780; letter-spacing: .18em;
  color: rgba(var(--accent-rgb), .8); text-transform: uppercase; margin-bottom: 14px;
}
.home-title {
  grid-column: 1; font-size: clamp(30px, 4vw, 52px); line-height: .98; font-weight: 760;
  color: var(--text); max-width: 400px; text-shadow: 0 10px 36px rgba(0, 0, 0, .26);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.home-sub { grid-column: 1; margin-top: 12px; color: var(--muted); font-size: 14px; }
.home-quick-row { grid-column: 1; position: relative; z-index: 3; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 22px; }
.home-quick {
  height: 44px; border-radius: 14px; padding: 0 18px;
  border: 1px solid rgba(255, 255, 255, .12);
  background: linear-gradient(145deg, rgba(255, 255, 255, .075), rgba(255, 255, 255, .035));
  color: var(--text); font-family: inherit; font-size: 13.5px; font-weight: 640;
  cursor: pointer; display: inline-flex; align-items: center; gap: 9px;
  box-shadow: 0 16px 44px rgba(0, 0, 0, .24), inset 0 1px 0 rgba(255, 255, 255, .1);
  transition: transform var(--t-med), border-color var(--t-fast), background var(--t-fast), box-shadow var(--t-med);
}
.home-quick:hover {
  transform: translateY(-2px); border-color: rgba(var(--accent-rgb), .42);
  background: linear-gradient(145deg, rgba(var(--accent-rgb), .12), rgba(255, 255, 255, .045));
  box-shadow: 0 22px 58px rgba(0, 0, 0, .3), 0 0 28px rgba(var(--accent-rgb), .1), inset 0 1px 0 rgba(255, 255, 255, .13);
}
.home-quick:active { transform: translateY(0) scale(.98); }
.home-quick .ico { width: 16px; height: 16px; }
[data-theme="light"] .home-quick { border-color: rgba(15, 20, 40, .1); background: rgba(255, 255, 255, .7); box-shadow: 0 10px 30px rgba(30, 40, 80, .1), inset 0 1px 0 #fff; }
[data-theme="light"] .home-quick:hover { background: #fff; border-color: rgba(var(--accent-rgb), .4); }
.home-visual {
  grid-column: 2; grid-row: 1 / span 5;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  min-width: 150px;
}
.home-disc {
  width: min(200px, 100%); aspect-ratio: 1; border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 24px 70px rgba(0, 0, 0, .5), 0 0 0 1px rgba(255, 255, 255, .08), 0 0 60px rgba(var(--accent-rgb), .18);
  animation: home-disc-turn 24s linear infinite;
  animation-play-state: paused;
}
.home-disc.spinning { animation-play-state: running; }
@keyframes home-disc-turn { to { transform: rotate(360deg); } }
.home-eq { display: flex; align-items: flex-end; gap: 4px; height: 40px; }
.home-eq span {
  width: 4px; border-radius: 999px; height: 100%;
  background: linear-gradient(180deg, #fff, rgb(var(--accent-rgb)));
  box-shadow: 0 0 12px rgba(var(--accent-rgb), .5);
  transform-origin: bottom;
  animation: home-eq-rise 1s ease-in-out infinite;
  animation-play-state: paused; opacity: .5;
}
.home-eq.live span { animation-play-state: running; opacity: .94; mix-blend-mode: screen; }
.home-eq span:nth-child(1) { height: 40%; animation-delay: -.1s; }
.home-eq span:nth-child(2) { height: 85%; animation-delay: -.5s; }
.home-eq span:nth-child(3) { height: 60%; animation-delay: -.9s; }
.home-eq span:nth-child(4) { height: 95%; animation-delay: -.3s; }
.home-eq span:nth-child(5) { height: 50%; animation-delay: -.7s; }
.home-eq span:nth-child(6) { height: 75%; animation-delay: -1.1s; }
@keyframes home-eq-rise { 0%, 100% { transform: scaleY(.68); opacity: .66; } 45% { transform: scaleY(1); opacity: 1; } }
.home-wave {
  width: 100%; height: 64px; opacity: .94; mix-blend-mode: screen;
  display: block; margin-top: 4px;
}

/* home 下部:最近专辑拼贴 */
.home-section-head { display: flex; align-items: center; gap: 12px; margin: 26px 0 14px; }
.home-section-head h2 { font-size: 16px; font-weight: 700; }
.home-section-head .count { color: var(--faint); font-size: 12.5px; }
.home-section-head .link { margin-left: auto; background: none; border: none; color: var(--muted); cursor: pointer; font-size: 13px; }
.home-section-head .link:hover { color: var(--accent2); }
.home-mosaic { display: grid; grid-template-columns: 1.18fr .82fr; grid-template-rows: 1fr 1fr; gap: 10px; height: 280px; }
.home-tile {
  position: relative; border-radius: 18px; overflow: hidden; cursor: pointer;
  border: 1px solid var(--border);
  transition: transform var(--t-med), box-shadow var(--t-med);
}
.home-tile:hover { transform: translateY(-3px); box-shadow: var(--shadow-2); }
.home-tile img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .4s cubic-bezier(.16, 1, .3, 1); }
.home-tile:hover img { transform: scale(1.04); }
.home-tile .tile-label {
  position: absolute; left: 14px; bottom: 12px; right: 14px; z-index: 2;
  font-weight: 650; font-size: 14px; color: #fff; text-shadow: 0 2px 10px rgba(0, 0, 0, .6);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.home-tile .tile-sub { position: absolute; left: 14px; bottom: 34px; z-index: 2; font-size: 11.5px; color: rgba(255,255,255,.75); text-shadow: 0 2px 8px rgba(0,0,0,.6); }

/* ============ 命令面板(Ctrl+K) ============ */
.cmdk-mask { position: fixed; inset: 0; z-index: 400; background: rgba(0, 0, 0, .4); backdrop-filter: blur(4px); animation: lv-in .16s ease; }
.cmdk {
  position: fixed; z-index: 401; top: 12%; left: 50%; transform: translateX(-50%);
  width: min(600px, calc(100vw - 48px));
  background: rgba(20, 23, 40, .97); border: 1px solid rgba(var(--accent-rgb), .35); border-radius: 16px;
  box-shadow: var(--shadow-2); backdrop-filter: blur(30px) saturate(1.2);
  overflow: hidden; animation: cmdk-in .22s cubic-bezier(.16, 1, .3, 1);
}
[data-theme="light"] .cmdk { background: rgba(255, 255, 255, .98); }
@keyframes cmdk-in { from { opacity: 0; transform: translateX(-50%) translateY(-8px) scale(.98); } }
.cmdk-input-wrap { display: flex; align-items: center; gap: 10px; padding: 15px 18px; border-bottom: 1px solid var(--border); }
.cmdk-input-wrap .ico { color: var(--accent2); width: 17px; height: 17px; }
.cmdk-input-wrap input {
  flex: 1; background: none; border: none; outline: none; color: var(--text); font-size: 15px;
}
.cmdk-input-wrap input::placeholder { color: var(--faint); }
.cmdk-list { max-height: 46vh; overflow-y: auto; padding: 6px; }
.cmdk-group-label { font-size: 10.5px; letter-spacing: .14em; color: var(--faint); padding: 8px 12px 4px; text-transform: uppercase; }
.cmdk-item {
  display: flex; align-items: center; gap: 11px; padding: 9px 12px; border-radius: 9px;
  cursor: pointer; color: var(--text); font-size: 13.5px;
}
.cmdk-item .ico { width: 16px; height: 16px; color: var(--muted); flex-shrink: 0; }
.cmdk-item.selected { background: rgba(var(--accent-rgb), .22); }
.cmdk-item.selected .ico { color: var(--accent2); }
.cmdk-item .sub { margin-left: auto; font-size: 11.5px; color: var(--faint); }
.cmdk-empty { padding: 26px; text-align: center; color: var(--faint); font-size: 13px; }
"""

# 在设置样式前插入 home/palette 样式
s = s.replace("/* ============ 设置 ============ */", home_css + "\n/* ============ 设置 ============ */")
io.open(p, 'w', encoding='utf-8').write(s)
print('home + cmdk css OK')
