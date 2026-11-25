/* 入场过渡三个候选方案（只有 ?trans=1|2|3 才启用；不带参数的正式流程不走这里）
   共同起点：雾化暖光柱 + 文案（画廊电脑视图那版柔光）
   1 光柱就是隧道：文案化进尘埃，镜头推进光柱，尘埃变星点，亮芯扩满屏
   2 光落成桌：光柱收成光池，六本书依次升起，飞进纵深排成通道
   3 碎成星空：光柱和文字碎成粒子向上飘散，重组成星空隧道壁
   终点都交给 entry-cinema 的 2D 走廊（同一机位、第一本前）。 */
import * as THREE from '../舞台原型/node_modules/three/build/three.module.js'

const unit = v => Math.max(0, Math.min(1, v))
const ease = k => k * k * (3 - 2 * k)
const ramp = (t, a, b) => ease(unit((t - a) / (b - a)))

export const TRANSITIONS = [1, 2, 3]

/* 与 2D 走廊同一机位：DEPTH.fov .9 → 半视场 tan = 1/1.8，地平线在 .46 高 → 低头 atan(.08/1.8) */
const CORRIDOR = { tan: 1 / 1.8, pitch: Math.atan(.08 / 1.8), z0: 9, gap: 6.2, coverW: 1.85, coverH: 2.775 }

/* 每套方案一条时间线：某一秒的全部状态。画面只是状态的函数，定格/逐帧验收靠它 */
const BASE = { push: 0, morph: 0, tunnel: 0, pool: 0, column: 0, table: 0, cam: 0, corridor: 0, flash: 0, travel: 0, break: 0 }
const PLANS = {
  1: { end: 7.2, handoff: 6.1, at(t) {
    const push = ramp(t, 2.6, 5.7)
    return { ...BASE, push, column: 1,
      morph: ramp(t, 1.6, 3.9),
      tunnel: ramp(t, 3.4, 5.2) * (1 - ramp(t, 5.7, 6.3)),
      travel: 9 * push * push,
      corridor: ramp(t, 5.6, 6.5),
      flash: ramp(t, 5.4, 6.1) * (1 - ramp(t, 6.3, 7.2)) }
  } },
  /* 书 i：3.1 + .26i 起升起 1.1s；4.9 + .2i 起飞 1.5s */
  2: { end: 8.6, handoff: 7.8, at(t) {
    return { ...BASE,
      pool: ramp(t, 1.6, 3.2),
      morph: ramp(t, 1.4, 2.9),
      column: 1 - ramp(t, 5.0, 6.0),
      table: ramp(t, 1.8, 3.2) * (1 - ramp(t, 5.2, 6.6)),
      cam: ramp(t, 5.0, 6.9),
      corridor: ramp(t, 5.6, 6.9) }
  } },
  /* 前进速度 3.6s 起平滑拉满（smoothstep 的积分是 u³ - u⁴/2） */
  3: { end: 8.0, handoff: 6.9, at(t) {
    const u = unit((t - 3.6) / 1.4)
    return { ...BASE,
      break: ramp(t, 1.4, 2.9),
      morph: ramp(t, 1.4, 4.4),
      tunnel: ramp(t, 2.6, 4.4),
      travel: 4.2 * (u ** 3 - u ** 4 / 2) + Math.max(0, t - 5.0) * 2.1,
      corridor: ramp(t, 6.3, 7.2),
      flash: ramp(t, 6.2, 6.9) * (1 - ramp(t, 7.1, 8.0)) }
  } },
}

/* ---------- 全屏背景：柔光柱 / 光池桌面 / 隧道壁 / 走廊底 / 亮芯一闪 ---------- */
const SCREEN_VERT = `
varying vec2 vUv;
void main() {
  vUv = position.xy * .5 + .5;
  gl_Position = vec4(position.xy, .99999, 1.0);
}`
const NOISE_GLSL = `
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = .5;
  for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.3, 9.1); a *= .5; }
  return v;
}`
const BG_FRAG = `
varying vec2 vUv;
uniform vec2 uRes;
uniform mat4 uCam;
uniform float uTime, uPush, uBreak, uTunnel, uPool, uColumn, uTable, uCorridor, uFlash, uTravel;
${NOISE_GLSL}
void main() {
  float aspect = uRes.x / uRes.y;
  /* sc：x 以屏高为单位，y 上正下负 */
  vec2 sc = vec2((vUv.x - .5) * aspect, vUv.y - .5);
  vec3 rd = normalize((uCam * vec4(sc.x, sc.y, -${CORRIDOR.tan.toFixed(4)}, 0.0)).xyz);

  /* 光柱：屏幕空间的柔光；光落成桌时柱脚抬到桌面落点 */
  float base = .5 * uPool;
  float y = clamp((sc.y + .5 - base) / (1.0 - base), 0.0, 1.0);
  float widen = 1.0 + uPush * 2.8 - uPool * .6;
  float ax = abs(sc.x) / widen;
  float coneW = .16 + (1.0 - y) * .26;
  vec2 q = vec2(ax * sign(sc.x), y - uBreak * .45);
  float n = fbm(q * vec2(3.5, 2.2) + vec2(uTime * .02, uTime * .015 - uTravel * .06));
  float n2 = fbm(q * vec2(9.0, 6.0) - vec2(uTime * .06, uTravel * .2));
  float shaft = smoothstep(coneW, 0.0, ax) * smoothstep(0.0, .78, y) * (.65 + n * .70);
  vec3 light = vec3(1.0, .76, .46) * shaft * .50;
  light += vec3(1.0, .60, .30) * smoothstep(.30, 0.0, ax) * smoothstep(.45, 0.0, y) * .18;
  light += vec3(1.0, .70, .42) * smoothstep(.70, .05, length(vec2(ax, y - .15))) * .10;
  light += vec3(1.0, .72, .42) * smoothstep(coneW * 2.4, 0.0, ax) * smoothstep(0.0, .9, y) * (.35 + n * .4) * .16;
  light *= (.75 + .45 * n2) * uColumn * (1.0 + uPush * 1.1);
  /* 碎裂：按噪声块侵蚀，断口留一线亮边；没碎时阈值在噪声取值范围之外，光柱不受影响 */
  float chunk = vnoise(sc * 26.0);
  float th = mix(-.2, 1.2, uBreak);
  light *= smoothstep(th - .06, th + .06, chunk);
  light *= 1.0 + uBreak * (1.0 - uBreak) * 4.0 * smoothstep(.07, 0.0, abs(chunk - th));
  /* 推进时只剩中间一根亮芯，四周压暗 */
  light *= 1.0 - uPush * smoothstep(.04, .5, length(sc * vec2(1.0, 1.2))) * .8;

  /* 桌面：桌面在 y = -1，光池由射线落点算出 */
  if (uTable > 0.0 && rd.y < -0.001) {
    vec3 hp = rd * (-1.0 / rd.y);
    float r2 = dot(hp.xz, hp.xz);
    float pool = smoothstep(12.0, 1.5, r2) / pow(1.0 + r2 * .9, 1.6);
    float grain = sin(hp.x * 60.0 + fbm(hp.xz * 3.0) * 6.0) * .5 + .5;
    float plank = fract(hp.x / .62);
    vec3 wood = mix(vec3(.03, .013, .005), vec3(.3, .145, .058), grain * .7 + .3 * fbm(hp.xz * 8.0));
    wood *= .5 + .5 * smoothstep(0.0, .025, min(plank, 1.0 - plank));
    light += wood * pool * vec3(1.0, .8, .56) * 4.2 * uTable;
    light += vec3(1.0, .72, .42) * smoothstep(.14, 0.0, abs(hp.x)) * smoothstep(3.2, .3, abs(hp.z - 1.2)) * .22 * uTable;
  }

  /* 隧道壁：半径 2.6 的圆筒，横环 + 纵肋，随前进滚动 */
  if (uTunnel > 0.0) {
    float a = max(dot(rd.xy, rd.xy), 1e-4);
    float depth = -rd.z * 2.6 / sqrt(a);
    float ring = abs(fract((depth + uTravel) / 2.4) - .5);
    float rib = abs(fract(atan(rd.y, rd.x) * 3.8197) - .5);
    float fog = exp(-depth * .075);
    light += vec3(.85, .7, .43) * fog * uTunnel * .9 * ((1.0 - smoothstep(0.0, max(.06, fwidth(depth / 2.4) * 1.5), .5 - ring)) * .5 + (1.0 - smoothstep(0.0, .12, .5 - rib)) * .12);
  }

  vec3 col = light / (light + .65) * 1.25;

  /* 走廊底：与 2D 走廊 drawBackdrop / drawCorridor 同一套颜色与放射线 */
  if (uCorridor > 0.0) {
    float k = clamp(length(vec2((vUv.x - .5) * aspect, vUv.y - .42)) / (.8 * max(aspect, 1.0)), 0.0, 1.0);
    vec3 bg = mix(vec3(.094, .082, .137), vec3(.043, .039, .067), smoothstep(0.0, .55, k));
    bg = mix(bg, vec3(.012, .012, .02), smoothstep(.55, 1.0, k));
    float hz = .46;
    float s = vUv.y < hz ? (hz - vUv.y) / hz : (vUv.y - hz) / (1.0 - hz);
    if (vUv.y < hz) {
      bg = mix(bg, vec3(.063, .055, .09), smoothstep(0.0, .4, s) * .86);
      bg = mix(bg, vec3(.02, .016, .027), smoothstep(.4, 1.0, s));
    }
    if (s > 0.001) {
      float param = ((vUv.x - .5) - .022 * s) / (.398 * s);
      float dist = abs(param - floor(param + .5)) * .398 * s * uRes.x;
      bg += vec3(.85, .7, .37) * max(.012, .05 - abs(floor(param + .5)) * .008) * (1.0 - smoothstep(0.0, 1.2, dist));
    }
    bg += vec3(.85, .7, .37) * .075 * (1.0 - smoothstep(0.0, 1.0, abs(vUv.y - hz) * uRes.y));
    col = mix(col * (1.0 - uCorridor * .9), bg, uCorridor);
  }

  /* 暗角与顶部压暗 */
  float v = length(vec2((vUv.x - .5) * aspect, vUv.y - .46));
  float vk = clamp((v - .18 * min(aspect, 1.0)) / (.68 * max(aspect, 1.0) - .18 * min(aspect, 1.0)), 0.0, 1.0);
  col *= 1.0 - (vk < .62 ? vk / .62 * .16 : .16 + (vk - .62) / .38 * .72);
  col = mix(vec3(.012, .012, .02), col, 1.0 - .8 * (1.0 - smoothstep(0.0, .3, vUv.y)));
  col = mix(col, vec3(1.0, .95, .87), uFlash);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 137.0) - .5) * (3.0 / 255.0);
  gl_FragColor = vec4(col, 1.0);
}`

/* ---------- 粒子：文案像素 + 光柱尘埃，同一套顶点着色器按方案走不同路径 ---------- */
const POINT_VERT = `
attribute vec3 aPos;
attribute vec4 aInfo;
attribute vec3 aTint;
uniform float uMorph, uMode, uTime, uTravel, uPush, uOpacity, uDpr, uAspect, uBase;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float seed = aInfo.x;
  float isText = 1.0 - aPos.z;
  /* 延迟：文案像被一行行带走（落池时自下而上，其余自上而下），叠一点噪声；尘埃各自随机 */
  float wave = (uMode > 1.5 && uMode < 2.5) ? (.5 - aPos.y) : (aPos.y + .5);
  float delay = mix(aInfo.y * .6, wave * .5 + aInfo.y * .2, isText);
  float k = clamp((uMorph - delay) / (1.0 - delay), 0.0, 1.0);
  vec2 p = aPos.xy;
  float size = mix(1.9, 3.0, k) * isText + (.9 + aInfo.y * 2.2) * aPos.z;
  vec3 warm = vec3(1.0, .84, .58);
  vec3 col = warm;
  float alpha = mix(.75, 1.0, aPos.z);
  p += vec2(sin(uTime * (.12 + seed * .3) + seed * 9.0), cos(uTime * (.1 + seed * .2) + seed * 5.0)) * .006 * aPos.z;

  if (uMode < 1.5) {
    /* ① 文案先在原位松开、往光柱轴心上方一带，再随镜头径向掠过；尘埃全程被推着向外 */
    vec2 flung = p * (1.0 + uPush * uPush * 9.0 * (.5 + seed));
    p += vec2(-p.x * .75, .06 + seed * .06) * smoothstep(0.0, .6, k) * isText + (flung - p) * mix(1.0, smoothstep(.55, 1.0, k), isText);
    alpha *= mix(.75, .5, k * isText) * (1.0 - smoothstep(.55, .8, length(p)));
    col = mix(warm, aTint, uPush * aPos.z + smoothstep(.4, 1.0, k) * isText);
  } else if (uMode < 2.5) {
    /* ② 落进光池，越落越快 */
    float e = k * k;
    p = mix(p, vec2(p.x * .12, -uBase + (seed - .5) * .06), e);
    alpha *= .8 * (1.0 - smoothstep(.75, 1.0, k));
  } else {
    /* ③ 先向上飘散，再重组到隧道壁上；壁上的点随前进流向镜头 */
    float up = smoothstep(0.0, .5, k);
    vec2 risen = p + vec2(sin(seed * 40.0 + uTime * 1.3) * .04 * up, up * (.16 + seed * .24));
    float u = fract(aInfo.w - uTravel * (.03 + seed * .03));
    float depth = 1.0 + 34.0 * u * u;
    float e = smoothstep(.45, 1.0, k);
    p = mix(risen, vec2(cos(aInfo.z), sin(aInfo.z)) * (4.68 / depth), e);
    alpha *= mix(1.0, smoothstep(1.0, .75, u) * smoothstep(0.0, .04, u), e);
    size = mix(size, clamp(9.0 / depth, .9, 2.8), e);
    col = mix(warm, aTint, e * .75);
  }

  /* 尘埃只在光柱里可见，带一点闪烁 */
  float cy = aPos.y + .5;
  float lit = smoothstep(.16 + (1.0 - cy) * .26, 0.0, abs(aPos.x)) * smoothstep(0.0, .78, cy);
  alpha *= mix(smoothstep(0.0, .08, k), (.35 + .65 * lit) * (.5 + .5 * sin(uTime * (1.2 + seed * 2.4) + seed * 6.28)) * uOpacity, aPos.z);
  vColor = col;
  vAlpha = alpha;
  gl_Position = vec4(p.x / (uAspect * .5), p.y / .5, 0.0, 1.0);
  gl_PointSize = size * uDpr;
}`
const POINT_FRAG = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float a = vAlpha * smoothstep(1.0, .2, length(gl_PointCoord - .5) * 2.0);
  if (a < .003) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
}`

const TEXT_FRAG = `
varying vec2 vUv;
uniform sampler2D uTex;
uniform sampler2D uNoise;
uniform vec2 uCells;
uniform float uMorph;
uniform float uMode;
void main() {
  vec4 c = texture2D(uTex, vUv);
  /* 与粒子顶点着色器同一条延迟公式：文案按行传开，叠一点噪声 */
  float wave = (uMode > 1.5 && uMode < 2.5) ? (1.0 - vUv.y) : vUv.y;
  float delay = texture2D(uNoise, vUv * uCells).r * .2 + wave * .5;
  c.a *= 1.0 - smoothstep(delay - .04, delay + .04, uMorph);
  gl_FragColor = c;
}`

/* 文案画进画布：同一张画布既贴成文字层，又逐像素采样成粒子 */
function buildTextCanvas(w, h) {
  const S = 2
  const s = Math.min(1.25, w / 390)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * S)
  canvas.height = Math.round(h * S)
  const g = canvas.getContext('2d')
  g.setTransform(S * s, 0, 0, S * s, 0, 0)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const W = w / s
  const H = h / s
  const serif = '"Noto Serif SC","Songti SC","STSong",serif'
  const sans = '"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif'
  let y = H * .225
  const line = (text, font, color, tracking, gap) => {
    g.font = font
    g.fillStyle = color
    g.letterSpacing = `${tracking}px`
    g.fillText(text, W / 2 + tracking / 2, y)
    y += gap
  }
  line('围桌 · 五人剧本杀', `500 10px ${sans}`, '#d8b25f', 4.6, 31)
  line('今晚', `600 30px ${serif}`, '#fff', 4.2, 43)
  line('翻哪一本', `600 30px ${serif}`, '#fff', 4.2, 31)
  line('六段故事，等你入席', `11px ${sans}`, 'rgba(255,255,255,.58)', 3.7, 0)
  return { canvas, S }
}

/* 像素采样成粒子。延迟取自一张 3px 格的噪声图，文字层按同一张图溶解，两者对得上 */
function sampleParticles(textCanvas, S, noise, noiseW, tints) {
  const cw = textCanvas.width
  const w = cw / S
  const h = textCanvas.height / S
  const data = textCanvas.getContext('2d').getImageData(0, 0, cw, textCanvas.height).data
  const pos = []
  const info = []
  const tint = []
  const add = (x, y, type, seed, delay, theta, phase) => {
    pos.push(x, y, type)
    info.push(seed, delay, theta, phase)
    const c = tints[Math.floor(seed * tints.length) % tints.length]
    tint.push(c[0], c[1], c[2])
  }
  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      if (data[(py * S * cw + px * S) * 4 + 3] < 120) continue
      add((px + .5 - w / 2) / h, .5 - (py + .5) / h, 0, Math.random(), noise[Math.floor(py / 3) * noiseW + Math.floor(px / 3)] / 255, 0, 0)
    }
  }
  return { pos, info, tint, count: info.length / 4 }
}

/* 返回 null 表示这台设备开不出 WebGL。接口与 createLampScene 一致：
   start(from, hold) / skip / resize / stop / dispose；播到交接点调 onDone */
export function createSoftScene(canvas, { books, plan, onDone }) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  } catch { return null }
  renderer.setClearColor(0x000000, 1)

  const timeline = PLANS[plan]
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(2 * Math.atan(CORRIDOR.tan) * 180 / Math.PI, 1, .1, 120)
  const restCam = { pos: new THREE.Vector3(0, 0, 0), look: new THREE.Vector3(0, .08 / 1.8, -1) }
  const tableCam = { pos: new THREE.Vector3(0, 4.2, 4.0), look: new THREE.Vector3(0, -.6, -.3) }

  const bg = {
    uRes: { value: new THREE.Vector2() }, uCam: { value: new THREE.Matrix4() },
    uTime: { value: 0 }, uPush: { value: 0 }, uBreak: { value: 0 }, uTunnel: { value: 0 }, uPool: { value: 0 },
    uColumn: { value: 1 }, uTable: { value: 0 }, uCorridor: { value: 0 }, uFlash: { value: 0 }, uTravel: { value: 0 },
  }
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: bg, vertexShader: SCREEN_VERT, fragmentShader: BG_FRAG, depthWrite: false, depthTest: false,
  }))
  backdrop.renderOrder = -1
  backdrop.frustumCulled = false
  scene.add(backdrop)

  /* 文字层：按噪声图逐格溶解，粒子从同一格飞出 */
  const noiseCanvas = document.createElement('canvas')
  const noiseTex = new THREE.CanvasTexture(noiseCanvas)
  noiseTex.minFilter = noiseTex.magFilter = THREE.NearestFilter
  let textTex = null
  const textMat = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: null }, uNoise: { value: noiseTex },
      uCells: { value: new THREE.Vector2(1, 1) }, uMorph: { value: 0 }, uMode: { value: plan },
    },
    vertexShader: SCREEN_VERT, fragmentShader: TEXT_FRAG, transparent: true, depthWrite: false, depthTest: false,
  })
  const textLayer = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), textMat)
  textLayer.renderOrder = 2
  textLayer.frustumCulled = false
  scene.add(textLayer)

  const pt = {
    uMorph: { value: 0 }, uMode: { value: plan }, uTime: { value: 0 }, uTravel: { value: 0 }, uPush: { value: 0 },
    uOpacity: { value: 1 }, uDpr: { value: 1 }, uAspect: { value: 1 }, uBase: { value: 0 },
  }
  const points = new THREE.Points(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
    uniforms: pt, vertexShader: POINT_VERT, fragmentShader: POINT_FRAG,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  }))
  points.renderOrder = 3
  points.frustumCulled = false
  scene.add(points)

  const tints = books.map(book => (book.glow.match(/[\d.]+/g) || ['255', '255', '255']).slice(0, 3).map(Number).map(v => v / 255))

  /* 文字层与粒子都随尺寸重排 */
  function layout(w, h) {
    const cells = [Math.ceil(w / 3), Math.ceil(h / 3)]
    noiseCanvas.width = cells[0]
    noiseCanvas.height = cells[1]
    const ng = noiseCanvas.getContext('2d')
    const img = ng.createImageData(cells[0], cells[1])
    const noise = new Uint8Array(cells[0] * cells[1])
    for (let i = 0; i < noise.length; i += 1) {
      noise[i] = Math.random() * 255
      img.data[i * 4] = noise[i]
      img.data[i * 4 + 3] = 255
    }
    ng.putImageData(img, 0, 0)
    noiseTex.needsUpdate = true
    textMat.uniforms.uCells.value.set(cells[0], cells[1])

    const { canvas: textCanvas, S } = buildTextCanvas(w, h)
    textTex?.dispose()
    textTex = new THREE.CanvasTexture(textCanvas)
    textMat.uniforms.uTex.value = textTex

    const sample = sampleParticles(textCanvas, S, noise, cells[0], tints)
    /* 尘埃：落在光柱轮廓里，亮不亮交给着色器 */
    for (let i = 0; i < 900; i += 1) {
      const cy = Math.random()
      const half = (.16 + (1 - cy) * .26) * (.25 + Math.random() * .75)
      const c = tints[i % tints.length]
      sample.pos.push((Math.random() * 2 - 1) * half, cy - .5, 1)
      sample.info.push(Math.random(), Math.random() * .6, 0, Math.random())
      sample.tint.push(c[0], c[1], c[2])
    }
    points.geometry.dispose()
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(sample.pos, 3))
    geo.setAttribute('aPos', new THREE.Float32BufferAttribute(sample.pos, 3))
    geo.setAttribute('aInfo', new THREE.Float32BufferAttribute(sample.info, 4))
    geo.setAttribute('aTint', new THREE.Float32BufferAttribute(sample.tint, 3))
    points.geometry = geo
    pt.uAspect.value = w / h
  }

  /* 书（仅方案 2）：桌面在 y = -1。桌面只写深度不写颜色，书从桌下升起时被它挡住 */
  const loader = new THREE.TextureLoader()
  const loads = []
  if (plan === 2) {
    const mask = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ colorWrite: false }))
    mask.position.y = -1
    scene.add(mask)
  }
  const covers = plan === 2 ? books.map((book, i) => {
    const fallback = document.createElement('canvas')
    fallback.width = 64
    fallback.height = 96
    const g2 = fallback.getContext('2d')
    const grad = g2.createLinearGradient(0, 0, 64, 96)
    grad.addColorStop(0, book.c1)
    grad.addColorStop(1, book.c2)
    g2.fillStyle = grad
    g2.fillRect(0, 0, 64, 96)
    const tex = new THREE.CanvasTexture(fallback)
    tex.colorSpace = THREE.SRGBColorSpace
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(CORRIDOR.coverW, CORRIDOR.coverH), mat)
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 3.9), new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(...tints[i]) }, uOpacity: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uOpacity;
        void main() { gl_FragColor = vec4(uColor * uOpacity * smoothstep(1.0, 0.0, length(vUv - .5) * 2.0) * .7, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }))
    halo.position.z = -.05
    const group = new THREE.Group()
    group.add(mesh, halo)
    group.visible = false
    scene.add(group)
    if (book.img) {
      loads.push(new Promise(resolve => loader.load(book.img, loaded => {
        loaded.colorSpace = THREE.SRGBColorSpace
        mat.map = loaded
        mat.needsUpdate = true
        resolve()
      }, undefined, resolve)))
    }
    return { group, mesh, halo }
  }) : []
  const coversReady = Promise.all(loads).catch(() => {})

  /* 书 i：桌面上 3 列 × 2 排，飞到走廊里各自的位子 */
  function poseAt(t) {
    covers.forEach((cover, i) => {
      const up = ease(unit((t - 3.1 - i * .26) / 1.1))
      const fly = ease(unit((t - 4.9 - i * .2) / 1.5))
      const cx = (i % 2 ? 1 : -1) * (1.25 + (i % 3) * .42)
      const cz = -CORRIDOR.z0 - i * CORRIDOR.gap
      const tx = (Math.floor(i / 2) - 1) * .92
      const tz = i % 2 ? .2 : -1.4
      const ty = -1 + CORRIDOR.coverH * .22
      const lit = unit((up - .45) / .55)
      cover.group.visible = up > 0
      cover.group.position.set(
        tx + (cx - tx) * fly,
        ty - (1 - up) * (CORRIDOR.coverH * .44 + .12) + (((i % 3) - 1) * .24 - ty) * fly + Math.sin(Math.PI * fly) * .8,
        tz + (cz - tz) * fly)
      cover.group.scale.setScalar(.44 + .56 * fly)
      cover.group.rotation.y = Math.sin(Math.PI * fly) * .45 * (cx > 0 ? 1 : -1)
      cover.mesh.material.color.setScalar(.05 + .95 * lit)
      cover.halo.material.uniforms.uOpacity.value = lit * (1 - fly) * .55
    })
  }

  /* ---------- 播放 ---------- */
  let raf = 0
  let origin = 0
  let done = false
  let lastT = 0
  let size = [0, 0]

  function renderAt(t) {
    lastT = t
    const s = timeline.at(t)
    bg.uTime.value = pt.uTime.value = t
    bg.uPush.value = pt.uPush.value = s.push
    bg.uTravel.value = pt.uTravel.value = s.travel
    bg.uBreak.value = s.break
    bg.uTunnel.value = s.tunnel
    bg.uFlash.value = s.flash
    bg.uCorridor.value = s.corridor
    pt.uMorph.value = textMat.uniforms.uMorph.value = s.morph
    if (plan === 2) {
      poseAt(t)
      camera.position.lerpVectors(tableCam.pos, restCam.pos, s.cam)
      camera.lookAt(new THREE.Vector3().lerpVectors(tableCam.look, restCam.look, s.cam))
      bg.uPool.value = s.pool
      bg.uColumn.value = s.column
      bg.uTable.value = s.table
      pt.uBase.value = .5 * s.pool
      pt.uOpacity.value = s.column
    } else {
      camera.position.set(0, 0, 0)
      camera.rotation.set(-CORRIDOR.pitch, 0, 0)
      bg.uColumn.value = 1
    }
    camera.updateMatrixWorld()
    bg.uCam.value.copy(camera.matrixWorld)
    renderer.render(scene, camera)
  }

  function frame(now) {
    const t = Math.max(0, (now - origin) / 1000)
    renderAt(t)
    if (t >= timeline.handoff && !done) {
      done = true
      onDone()
    }
    if (t >= timeline.end) {
      raf = 0
      return
    }
    raf = requestAnimationFrame(frame)
  }

  return {
    /* from：起始秒；hold：定格在这一秒（?lampAt= 逐帧验收用，等封面贴图到位再画） */
    start(from = 0, hold = null) {
      cancelAnimationFrame(raf)
      done = false
      if (hold !== null) {
        Promise.race([coversReady, new Promise(resolve => setTimeout(resolve, 1500))])
          .then(() => { if (!raf) renderAt(hold) })
        return
      }
      origin = performance.now() - from * 1000
      raf = requestAnimationFrame(frame)
    },
    seek(time) {
      cancelAnimationFrame(raf)
      raf = 0
      renderAt(time)
    },
    /* 轻点跳过：直接交给后续 */
    skip() {
      if (done) return
      done = true
      cancelAnimationFrame(raf)
      raf = 0
      onDone()
    },
    resize(w, h, dpr) {
      renderer.setPixelRatio(dpr)
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      bg.uRes.value.set(w * dpr, h * dpr)
      pt.uDpr.value = dpr
      if (w !== size[0] || h !== size[1]) {
        size = [w, h]
        layout(w, h)
      }
      /* 改尺寸会清空画布；没在循环播放时（定格）把刚才那一帧补画回来 */
      if (!raf) renderAt(lastT)
    },
    stop() {
      cancelAnimationFrame(raf)
      raf = 0
    },
    dispose() {
      cancelAnimationFrame(raf)
      scene.traverse(object => {
        object.geometry?.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach(material => material?.map?.dispose())
        materials.forEach(material => material?.dispose())
      })
      textTex?.dispose()
      noiseTex.dispose()
      renderer.dispose()
    },
  }
}
