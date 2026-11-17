# v2.1.0 补丁:完整移植原版全部剩余动效
import io
p = 'public/css/app.css'
s = io.open(p, encoding='utf-8').read()

FX = """
/* ============ 原版动效完整移植(v2.1) ============ */

/* 歌词完整 3D:进入(900ms)+ 漂浮(5.6s)+ 退出(700ms),参数与原版一致 */
.lv-lyrics { transform-style: preserve-3d; }
.lv-line.leaving { animation: lyr-out .7s cubic-bezier(.55, 0, .85, .45) forwards; pointer-events: none; }
@keyframes lyr-out {
  0% { opacity: 1; transform: translate3d(var(--bx, 0px), 0, 0) rotateX(0) rotateY(0) scale(1); filter: blur(0); }
  100% { opacity: 0; transform: translate3d(calc(var(--bx, 0px) + 60px), -40px, -120px) rotateX(-22deg) rotateY(18deg) scale(.78); filter: blur(10px); }
}
.lv-line.active {
  animation: lyr-in-3d .9s cubic-bezier(.16, .84, .32, 1.02), lyr-bob-3d 5.6s ease-in-out .9s infinite;
}
@keyframes lyr-in-3d {
  0% { opacity: 0; transform: translate3d(calc(var(--bx, 0px) + 40px), 30px, -160px) rotateX(28deg) rotateY(-22deg) scale(.7); filter: blur(14px) drop-shadow(0 4px 22px rgba(var(--accent2-rgb), .3)); }
  55% { opacity: 1; filter: blur(0) drop-shadow(0 4px 22px rgba(var(--accent2-rgb), .22)); }
  100% { opacity: 1; transform: translate3d(calc(var(--bx, 0px) + 4px), 0, 0) rotateX(0) rotateY(0) scale(1); filter: blur(0); }
}
@keyframes lyr-bob-3d {
  0%, 100% { transform: translate3d(var(--bx, 0px), 0, 0) rotateX(0deg) rotateY(0deg) scale(1); }
  25% { transform: translate3d(calc(var(--bx, 0px) + 6px), -7px, 12px) rotateX(2deg) rotateY(-1.5deg) scale(1.01); }
  50% { transform: translate3d(var(--bx, 0px), 3px, 0) rotateX(-1.5deg) rotateY(0deg) scale(.99); }
  75% { transform: translate3d(calc(var(--bx, 0px) - 6px), -4px, 8px) rotateX(1.2deg) rotateY(1.5deg) scale(1.005); }
}

/* Home 视觉漂移(未播放时)与卡片悬浮(±2px) */
.home-visual.drift { animation: home-visual-drift 8.8s ease-in-out infinite; }
@keyframes home-visual-drift {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
  50% { transform: translate3d(0, -5px, 0) rotate(.6deg); }
}
.home-tile.float { animation: home-card-float 7.4s ease-in-out infinite; }
@keyframes home-card-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }

/* 骨架扫光(Home 加载/列表加载占位) */
.skeleton::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(110deg, transparent, rgba(255, 255, 255, .08), transparent);
  transform: translateX(-100%);
  animation: home-shimmer 1.5s ease-in-out infinite;
}
@keyframes home-shimmer { 100% { transform: translateX(100%); } }
.scan-float.skeleton, .scan-float.skeleton::before { border-radius: 12px; overflow: hidden; }

/* 队列/列表加载骨架(原版 queue-shimmer) */
.queue-shimmer {
  height: 56px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, .06);
  background: linear-gradient(90deg, rgba(255, 255, 255, .035), rgba(var(--accent2-rgb), .085), rgba(255, 255, 255, .035));
  background-size: 220% 100%;
  animation: queue-shimmer 1.05s linear infinite;
}
@keyframes queue-shimmer { 0% { background-position: 120% 0; } 100% { background-position: -120% 0; } }

/* 面板退出 blur(原版 fx-panel-out) */
.lyrics-view.closing { animation: fx-panel-out .26s cubic-bezier(.5, 0, .7, 1) forwards; }
.modal-mask.closing .modal { animation: fx-panel-out .26s cubic-bezier(.5, 0, .7, 1) forwards; }
@keyframes fx-panel-out {
  0% { opacity: 1; transform: translateX(0) translateY(0) scale(1); filter: blur(0); }
  100% { opacity: 0; transform: translateX(24px) translateY(12px) scale(.97); filter: blur(6px); }
}

/* 搜索/命令面板结果下滑进入(原版 search-results-in) */
.cmdk-list { animation: search-results-in .26s cubic-bezier(.2, .7, .2, 1) both; }
@keyframes search-results-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }

/* 主题色切换脉冲(原版 preset-card-pulse) */
body.accent-pulse::after {
  content: ''; position: fixed; inset: 0; z-index: 500; pointer-events: none;
  background: radial-gradient(circle at 50% 42%, rgba(var(--accent-rgb), .22), transparent 58%);
  animation: preset-card-pulse .72s cubic-bezier(.16, 1, .3, 1);
}
@keyframes preset-card-pulse {
  0% { opacity: 0; transform: scale(.6) rotate(0deg); }
  35% { opacity: 1; }
  100% { opacity: 0; transform: scale(1.25) rotate(12deg); }
}

/* 喜欢按钮光晕(原版 .liked .heart-svg) */
#pb-fav.active svg { filter: drop-shadow(0 0 10px rgba(255, 122, 144, .34)); }

/* 标题栏更新徽标:SVG 环(检查 dash 流动 / 下载进度环) */
.update-badge svg.update-ring-svg { width: 34px; height: 34px; display: block; }
.update-badge .ring-base {
  fill: none; stroke: rgba(255, 255, 255, .14); stroke-width: 1.65;
}
.update-badge .ring-dash {
  fill: none; stroke: var(--accent2); stroke-width: 1.65; stroke-linecap: round;
  stroke-dasharray: 48 18; stroke-dashoffset: 0;
  filter: drop-shadow(0 0 5px rgba(var(--accent2-rgb), .3));
}
.update-badge.checking .ring-dash { animation: update-ring-dash-flow .9s linear infinite; }
@keyframes update-ring-dash-flow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -66; } }
.update-badge .ring-progress {
  fill: none; stroke: var(--accent2); stroke-width: 1.95; stroke-linecap: round;
  stroke-dasharray: 100; stroke-dashoffset: 100;
  transition: stroke-dashoffset .25s linear;
  filter: drop-shadow(0 0 5px rgba(var(--accent2-rgb), .25));
}
.update-badge .dot { display: none; }
.update-badge.has-update .dot { display: block; }
"""

# 追加到文件末尾
s += FX

# 更新检查按钮 checking 态换 SVG 环(替换文字 spinner — 保留 spinner 亦可见,改为环优先)
s = s.replace("""    case 'checking':
      rows.push('<div class="val"><span class="spin-icon"></span> 正在检查更新…</div>');
      break;""",
"""    case 'checking':
      rows.push('<div class="val"><svg viewBox="0 0 34 34" class="update-ring-svg" style="width:16px;height:16px;vertical-align:-3px"><circle class="ring-dash" cx="17" cy="17" r="15"/></svg> 正在检查更新…</div>');
      break;""")

io.open(p, 'w', encoding='utf-8').write(s)
print('fx css OK, added', len(FX), 'chars')
