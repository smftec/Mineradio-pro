# v2.6.0 补丁一(修正版):按实际内容匹配
import io
p = 'public/js/webgl-engine.js'
s = io.open(p, encoding='utf-8').read()

old1 = """    this.start = performance.now();
    this.beatAcc = 0;"""
assert old1 in s, 'a1'
s = s.replace(old1, """    this.start = performance.now();
    // 视觉参数(Folia 预设系统):强度/速度/色彩覆盖
    this.params = { intensity: 1, speed: 1, c1: null, c2: null };
    this.scaledTime = 0;
    this.beatAcc = 0;""")

old2 = """    const p = this.programs[this.current];
    gl.useProgram(p.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(p.aPos);
    gl.vertexAttribPointer(p.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(p.u.u_res, w, h);
    gl.uniform1f(p.u.u_time, (performance.now() - this.start) / 1000);
    gl.uniform1f(p.u.u_bass, bass);
    gl.uniform1f(p.u.u_mid, mid);
    gl.uniform1f(p.u.u_high, high);
    gl.uniform1f(p.u.u_all, all);
    gl.uniform1f(p.u.u_beat, this.beatPulse);
    gl.uniform1f(p.u.u_beatCount, this.beatCount);
    const rgb = themeRGB || { a: [124/255, 92/255, 255/255], b: [53/255, 224/255, 255/255] };
    gl.uniform3f(p.u.u_c1, rgb.a[0], rgb.a[1], rgb.a[2]);
    gl.uniform3f(p.u.u_c2, rgb.b[0], rgb.b[1], rgb.b[2]);
    gl.uniform1i(p.u.u_specTex, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);"""
assert old2 in s, 'a2'
s = s.replace(old2, """    const p = this.programs[this.current];
    const prm = this.params;
    this.scaledTime += dt * (prm.speed || 1);
    gl.useProgram(p.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(p.aPos);
    gl.vertexAttribPointer(p.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(p.u.u_res, w, h);
    gl.uniform1f(p.u.u_time, this.scaledTime);
    // 强度调制:能量缩放(Folia 预设)
    const I = prm.intensity || 1;
    gl.uniform1f(p.u.u_bass, Math.min(1, bass * I));
    gl.uniform1f(p.u.u_mid, Math.min(1, mid * I));
    gl.uniform1f(p.u.u_high, Math.min(1, high * I));
    gl.uniform1f(p.u.u_all, Math.min(1, all * I));
    gl.uniform1f(p.u.u_beat, Math.min(1, this.beatPulse * I));
    gl.uniform1f(p.u.u_beatCount, this.beatCount);
    // 色彩:预设覆盖优先,否则主题色
    const rgb = themeRGB || { a: [124/255, 92/255, 255/255], b: [53/255, 224/255, 255/255] };
    const c1 = prm.c1 || rgb.a, c2 = prm.c2 || rgb.b;
    gl.uniform3f(p.u.u_c1, c1[0], c1[1], c1[2]);
    gl.uniform3f(p.u.u_c2, c2[0], c2[1], c2[2]);
    gl.uniform1i(p.u.u_specTex, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);""")

old3 = """  use(id) {
    if (!this.ok) return false;
    if (!this.register(id)) return false;
    this.current = id;
    this.gl.useProgram(this.programs[id].prog);
    return true;
  }"""
assert old3 in s, 'a3'
s = s.replace(old3, old3 + """

  // 视觉参数(Folia 预设):{ intensity, speed, c1, c2 }
  setParams(params) {
    if (!params) return;
    if (params.intensity != null) this.params.intensity = Math.max(0.2, Math.min(2.5, params.intensity));
    if (params.speed != null) this.params.speed = Math.max(0.1, Math.min(4, params.speed));
    if (params.c1) this.params.c1 = params.c1;
    if (params.c2) this.params.c2 = params.c2;
  }

  // 渲染档位:DPR 上限
  setDprCap(cap) {
    this._dprCap = Math.max(0.5, Math.min(2, cap || 1.5));
  }""")

old4 = """    // 分辨率同步(DPR 上限 1.5,性能保护)
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);"""
assert old4 in s, 'a4'
s = s.replace(old4, """    // 分辨率同步(DPR 档位,性能保护)
    const dpr = Math.min(window.devicePixelRatio || 1, this._dprCap || 1.5);""")

io.open(p, 'w', encoding='utf-8').write(s)
print('params system OK')
