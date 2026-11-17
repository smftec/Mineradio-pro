// 16 个自研 GLSL 视觉效果(致敬 Mineradio/Folia 的视觉器命名)
// 共享约定:全屏 quad,uniform — u_res/u_time/u_bass/u_mid/u_high/u_all/u_beat/u_c1/u_c2/u_specTex(32 bin 频谱纹理)
// 主题色 u_c1/u_c2 由 CSS 变量实时注入,频谱采样函数 spec(x) 已内置

export const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const HEAD = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_bass, u_mid, u_high, u_all, u_beat, u_beatCount;
uniform vec3 u_c1, u_c2;
uniform sampler2D u_specTex;
varying vec2 v_uv;
#define PI 3.14159265
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
float spec(float x){return texture2D(u_specTex,vec2(clamp(x,0.,1.)*.95+.025,.5)).r;}
vec3 theme(float t){return mix(u_c1,u_c2,t);}
`;

// —— 每个效果:独立 main(自研 GLSL)——
export const SHADERS = {
  // 1. 华彩:放射频谱光芒
  cadenza: HEAD + `
void main(){
  vec2 uv=(v_uv-.5)*vec2(u_res.x/u_res.y,1.);
  float r=length(uv),a=atan(uv.y,uv.x)/PI*.5+.5;
  float rays=spec(a)*spec(fract(a*2.))*.9+u_bass*.3;
  float glow=exp(-r*2.6)*(0.5+rays*1.6);
  vec3 col=theme(clamp(rays*.8,.0,1.))*glow;
  col+=theme(1.)*pow(max(0.,1.-r),3.)*u_bass*1.2;
  float v=.12+glow*.8;
  gl_FragColor=vec4(col*v+theme(.5)*.03,v);
}`,

  // 2. 清唱:单色同心波纹
  cappella: HEAD + `
void main(){
  vec2 uv=(v_uv-.5)*vec2(u_res.x/u_res.y,1.);
  float r=length(uv);
  float w=sin(r*22.-u_time*2.5+u_bass*8.);
  float ring=smoothstep(.55,1.,w)*exp(-r*1.4)*(.25+u_bass);
  vec3 col=theme(.15)*ring+theme(.9)*ring*.55;
  float base=.06+fbm(uv*3.+u_time*.1)*.05;
  gl_FragColor=vec4(theme(.4)*base+col,1.);
}`,

  // 3. 克拉达:双环交织
  claddagh: HEAD + `
void main(){
  vec2 uv=(v_uv-.5)*vec2(u_res.x/u_res.y,1.);
  float r=length(uv),a=atan(uv.y,uv.x);
  float s1=spec(fract(a/PI+u_time*.05));
  float s2=spec(fract(-a/PI+u_time*.07+u_beatCount*.13));
  float g1=exp(-abs(r-(.32+s1*.24))*18.);
  float g2=exp(-abs(r-(.5+s2*.3))*16.);
  vec3 col=theme(.2)*g1*(.5+s1)+theme(.75)*g2*(.5+s2);
  col+=theme(.5)*exp(-r*3.)*u_bass;
  gl_FragColor=vec4(col,1.);
}`,

  // 4. 立体透视:多层视差粒子景深
  diorama: HEAD + `
void main(){
  vec3 col=vec3(0.);
  for(int l=0;l<5;l++){
    float z=float(l)+1.;
    vec2 p=(v_uv-.5)*(2.2+z*1.2)+vec2(u_time*.03*(mod(float(l),2.)==0.?.6:-.4),0.);
    vec2 g=floor(p*9.);
    vec2 f=fract(p*9.);
    float h=hash(g+float(l)*7.);
    if(h>.86){
      float d=length(f-.5);
      float sz=.06+z*.02+spec(h)*.1*u_bass;
      float m=smoothstep(sz,sz*.3,d)*(.4+u_all*.6)/(z*.5);
      col+=theme(h)*m;
    }
    col+=theme(.6)*.012/(z*.4);
  }
  gl_FragColor=vec4(col,1.);
}`,

  // 5. 烟雾:流体域扭曲
  fume: HEAD + `
void main(){
  vec2 uv=v_uv*3.;
  float t=u_time*.15;
  vec2 q=vec2(fbm(uv+t),fbm(uv+vec2(5.2,1.3)-t));
  float f=fbm(uv+q*1.8+vec2(0.,-u_time*.25));
  float dens=f*(.45+u_bass*.9)+u_low_glow_placeholder;
  vec3 col=theme(.15)*dens+theme(.85)*pow(f,2.5)*(.4+u_mid);
  col+=theme(.5)*exp(-length(v_uv-.5)*3.)*u_bass*.5;
  gl_FragColor=vec4(col,1.);
}`.replace('u_low_glow_placeholder', '(f*.2)'),

  // 6. 花火:节拍触发烟花
  hanabi: HEAD + `
void main(){
  vec2 uv=(v_uv-.5)*vec2(u_res.x/u_res.y,1.);
  vec3 col=vec3(.02,.02,.045);
  // 三个历史节拍的爆发环
  for(int k=0;k<3;k++){
    float bk=u_beatCount-float(k);
    float age=u_beat-bk*.0;
    float bt=u_time-bk*.75;
    if(bt<0.||bt>2.2)continue;
    float burstR=bt*.55*(1.+hash(vec2(bk,3.))*.4);
    float particles=0.;
    for(int j=0;j<18;j++){
      float aj=float(j)/18.*PI*2.+hash(vec2(bk,float(j)));
      float pj=exp(-abs(length(uv)-burstR-abs(sin(aj*3.+bt*6.))*.1)*14.)*exp(-bt*1.8);
      particles+=pj*exp(-abs(uv.x*sin(aj)+uv.y*cos(aj))*1.2);
    }
    vec3 bc=theme(hash(vec2(bk,7.)));
    col+=bc*particles*(.8-exp(-bt)*.4);
  }
  col+=theme(.5)*exp(-length(uv)*3.5)*u_bass*.9;
  gl_FragColor=vec4(col,1.);
}`,

  // 7. 光辉:垂直光柱
  lumiere: HEAD + `
void main(){
  float x=v_uv.x;
  float col=spec(x);
  float beam=exp(-abs(fract(x*7.+u_time*.06)-.5)*9.);
  float intensity=col*(.35+u_mid*.9);
  vec3 col3=theme(x)*(intensity*1.5+beam*.35);
  // 顶部辉光
  float glow=pow(v_uv.y,.6)*col*(.4+u_high);
  col3+=theme(.6)*glow*.7;
  float v=.10+intensity*.85+glow*.3;
  gl_FragColor=vec4(col3*v+theme(.4)*.02,v);
}`,

  // 8. 街町:霓虹城市网格
  machi: HEAD + `
void main(){
  float x=v_uv.x;
  float specV=spec(x);
  // 建筑天际线
  float buildings=.25+specV*.5+fbm(vec2(x*9.,3.))*.14;
  float inB=step(v_uv.y,buildings);
  // 窗格
  vec2 gp=vec2(fract(x*36.),fract(v_uv.y*22.));
  float win=step(.25,gp.x)*step(.75,gp.x)*step(.3,gp.y)*step(.7,gp.y)*inB;
  float flick=hash(floor(vec2(x*36.,v_uv.y*22.))+floor(u_time*2.))>.5?1.:.3;
  vec3 neon=theme(fract(x*3.+u_time*.05));
  vec3 col=mix(vec3(.02,.03,.06),neon*.5,win*flick*.8);
  // 楼顶霓虹描边
  float edge=smoothstep(buildings-.012,buildings,v_uv.y)*inB;
  col+=neon*edge*1.4;
  // 地面反射
  float refl=pow(1.-v_uv.y,3.)*step(buildings,v_uv.y)*.12;
  col+=neon*refl*(.4+u_mid);
  gl_FragColor=vec4(col+.01,1.);
}`,

  // 9. 莫奈:印象派色斑
  monet: HEAD + `
void main(){
  vec2 uv=v_uv*2.6;
  float t=u_time*.08;
  float n1=fbm(uv+t), n2=fbm(uv*1.7-vec2(t,t*.6)), n3=fbm(uv*.8+vec2(t*.3,t));
  vec3 col=mix(theme(n1*.9),theme(.4+n2*.5),n2*.6+n1*.3);
  col=mix(col,theme(.7+n3*.3),n3*.35);
  col*=.75+u_all*.5;
  // 笔触颗粒
  col+=(hash(v_uv*u_res.xy*.5)-.5)*.05;
  gl_FragColor=vec4(col*.9,1.);
}`,

  // 10. 雾霭:柔雾
  nebbia: HEAD + `
void main(){
  vec2 uv=v_uv;
  float f1=fbm(uv*2.2+u_time*.04);
  float f2=fbm(uv*3.4-vec2(u_time*.06,u_time*.02)+f1);
  float fog=smoothstep(.25,.85,f1*.6+f2*.5)*(.5+u_all*.5);
  vec3 col=mix(theme(.05)*.8,theme(.55),fog*.75);
  col=mix(col,theme(.9),pow(f2,3.)*.4);
  gl_FragColor=vec4(col,1.);
}`,

  // 11. 星云:多层 fbm + 星点
  nebula: HEAD + `
void main(){
  vec2 uv=v_uv*2.;
  float t=u_time*.05;
  float n=fbm(uv+t*vec2(.3,-.2))+fbm(uv*1.6-t)* .5;
  n=fbm(uv+n*1.5);
  vec3 col=theme(clamp(n*1.2,.0,1.))*pow(n,1.6)*1.5;
  col+=theme(.9)*pow(fbm(uv*3.+t*2.),3.)*u_mid;
  // 星点
  vec2 g=floor(v_uv*u_res.xy/2.5);
  float star=step(.985,hash(g))*exp(-length(fract(v_uv*u_res.xy/2.5)-.5)*6.)*(0.5+u_high*1.5);
  col+=vec3(.9,.95,1.)*star;
  gl_FragColor=vec4(col,1.);
}`,

  // 12. 组曲:万花筒分形
  partita: HEAD + `
void main(){
  vec2 uv=(v_uv-.5)*vec2(u_res.x/u_res.y,1.);
  float a=atan(uv.y,uv.x),r=length(uv);
  float seg=PI/6.;
  a=mod(a,seg); a=abs(a-seg*.5);
  vec2 p=vec2(cos(a),sin(a))*r;
  float t=u_time*.25;
  float pat=0.;
  for(int i=0;i<4;i++){
    float fi=float(i);
    p=abs(p)/dot(p,p)-vec2(.62+u_bass*.12,.42+spec(fi/4.)*.3);
    p*=rot(t*.15+fi);
    pat+=exp(-abs(p.y)*14.)*(1.-fi*.18);
  }
  vec3 col=theme(fract(r*.8+t*.1))*pat*(.5+u_all);
  col+=theme(.7)*exp(-r*2.5)*u_bass*.6;
  gl_FragColor=vec4(col,1.);
}`,

  // 13. 十四行诗:点阵网格波动
  sonnet: HEAD + `
void main(){
  vec2 g=v_uv*vec2(u_res.x/u_res.y,1.)*14.;
  vec2 cell=floor(g),f=fract(g)-.5;
  float ph=hash(cell)*6.28;
  float d=spec(fract(cell.x/14.))*2.;
  float wave=sin(u_time*2.5+ph+d*6.)*.5+.5;
  float r=length(f);
  float dot_=smoothstep(.32,.12,r)*(0.25+wave*(.4+u_bass*1.2));
  vec3 col=theme(fract(cell.x/14.))*dot_;
  col+=theme(.8)*dot_*dot_*.4;
  gl_FragColor=vec4(col,1.);
}`,

  // 14. 静物:低动态画布
  still: HEAD + `
void main(){
  vec2 uv=v_uv;
  float t=u_time*.02;
  float g1=fbm(uv*1.4+t), g2=fbm(uv*1.4*1.6-t*.7);
  vec3 col=mix(theme(.1),theme(.45),g1);
  col=mix(col,theme(.8),g2*.4);
  col*=.62+g1*.3+u_bass*.06;
  // 画布颗粒
  col+=(hash(v_uv*u_res.xy)-.5)*.02;
  gl_FragColor=vec4(col,1.);
}`,

  // 15. 蛋彩:颗粒分层色块
  tempera: HEAD + `
void main(){
  vec2 uv=v_uv;
  float bands=3.+floor(u_bass*3.);
  float band=floor(uv.y*bands)/bands;
  float n=fbm(vec2(uv.x*4.,band*9.+u_time*.05));
  float shade=step(uv.y,band+ .5/bands);
  vec3 col=theme(fract(band*.33+n*.2))*(.5+n*.5);
  // 颗粒质感
  float grain=hash(uv*u_res.xy+floor(u_time*8.));
  col+=(grain-.5)*.06;
  col=mix(col*0.9,col*1.15,shade*.5+u_mid*.5);
  gl_FragColor=vec4(col,1.);
}`,

  // 16. 倾斜:3D 频谱平面
  tilt: HEAD + `
void main(){
  // 伪 3D:透视网格地面 + 频谱柱
  vec2 uv=v_uv;
  float horizon=.42;
  float persp=(horizon+.02-uv.y);
  float z=1./max(persp,.001);
  vec2 world=vec2((uv.x-.5)*z, z);
  float col=spec(fract(world.x*.06));
  // 地面网格
  vec2 g=vec2(fract(world.x*.08),fract(z*.4+u_time*.3));
  float line=smoothstep(.48,.5,max(abs(g.x-.5),abs(g.y-.5)));
  vec3 col3=theme(.15)*line*.5*step(uv.y,horizon)*(0.4+u_all*.8);
  // 频谱墙(远处)
  float wallY=horizon;
  float inWall=step(wallY-.18,uv.y)*step(uv.y,wallY);
  float bars=step(.5,fract(uv.x*64.));
  float wallH=col*.9;
  float lit=step(1.-wallH*.9,fract(uv.y*30.))*inWall;
  col3+=theme(uv.x)*lit*1.2*inWall*.0;
  col3+=theme(.5)*inWall*wallH*.9;
  // 地平线辉光
  col3+=theme(.7)*exp(-abs(uv.y-horizon)*24.)*(.3+u_all*.7);
  gl_FragColor=vec4(col3+.005,1.);
}`,
};

export const SHADER_IDS = Object.keys(SHADERS);
