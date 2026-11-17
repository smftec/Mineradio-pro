# v2.4.0 补丁一:engine 修正 + 统一注册 + 歌词 19 模式
import io

# ---- webgl-engine.js ----
p = 'public/js/webgl-engine.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);""",
"""    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);""")
s = s.replace("""    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.getParameter(gl.ARRAY_BUFFER_BINDING) || gl.createBuffer());
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    this.programs[id] = { prog, u: {} };""",
"""    this.programs[id] = { prog, u: {}, aPos: gl.getAttribLocation(prog, 'a_pos') };""")
s = s.replace("""    const p = this.programs[this.current];
    gl.useProgram(p.prog);
    gl.uniform2f(p.u.u_res, w, h);""",
"""    const p = this.programs[this.current];
    gl.useProgram(p.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(p.aPos);
    gl.vertexAttribPointer(p.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(p.u.u_res, w, h);""")
s = s.replace("""    const spec = player.getSpectrum();
    const bins = new Uint8Array(SPEC_BINS);""",
"""    const spec = this.specOverride || player.getSpectrum();
    const bins = new Uint8Array(SPEC_BINS);""")
io.open(p, 'w', encoding='utf-8').write(s)
print('engine fix OK')

# ---- visual-modes.js:统一注册 ----
p = 'public/js/visual-modes.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("import { player } from './player.js';",
"""import { player } from './player.js';
import { SHADER_IDS } from './shaders.js';
import { ShaderEngine, attachEngine, webglAvailable } from './webgl-engine.js';

let glProbe = null;
function probeGL() {
  if (glProbe === null) {
    try { const test = new ShaderEngine(document.createElement('canvas')); glProbe = test.ok ? 'yes' : 'no'; }
    catch { glProbe = 'no'; }
  }
  return glProbe;
}

// 统一注册:shader id 走 WebGL,canvas2d 模式走原绘制器
export function registerVisual(canvas, { mode = 'particles' } = {}) {
  if (SHADER_IDS.includes(mode) && probeGL() === 'yes') {
    const engine = new ShaderEngine(canvas);
    if (engine.ok && engine.use(mode)) { engine.active = true; return attachEngine(engine); }
  }
  return registerVisualizer(canvas, { mode });
}""")
io.open(p, 'w', encoding='utf-8').write(s)
print('facade OK')
