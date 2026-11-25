/* 入场 + 选本动画（玩家端，含房主玩家视角 iframe）
   1) 顶光唤醒：黑屏 → 吊灯闪两下再稳 → 光锥张开落在木桌上（three.js，自动播放，轻点跳过）
   2) 纵深走廊：手势上下推进，聚焦最近一本
   3) 翻开剧本：四页跨页阅读，末页确认开本
   由 app.js 在「未入席 && entryMode === 'shelf'」时挂载。 */
import * as THREE from '../舞台原型/node_modules/three/build/three.module.js'
import { createSoftScene, TRANSITIONS } from './entry-transitions.js?v=20261125-preview1'

const esc = value => String(value).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))
const unit = value => Math.max(0, Math.min(1, value))

const PALETTE = [
  ['#1b4b6b', '#0a1420', 'rgba(111,211,255,.55)'],
  ['#4a2f7a', '#140d24', 'rgba(177,140,255,.55)'],
  ['#7a2a22', '#1c0a09', 'rgba(255,138,92,.55)'],
  ['#0f5b54', '#06201f', 'rgba(78,240,200,.5)'],
  ['#7a5218', '#1c1206', 'rgba(255,209,102,.5)'],
  ['#2c4318', '#0a1206', 'rgba(182,243,106,.45)'],
]

const DEPTH = { length: 34, fov: .9, coverW: 1.85, horizon: .46, z0: 9, gap: 6.2 }

const SEEN_KEY = 'weizhuo:entryCinemaIntro'
/* ?fresh=1：强制重播入场（画廊手机视图的「重看入场」用） */
if (new URLSearchParams(location.search).get('fresh') === '1') {
  try { sessionStorage.removeItem(SEEN_KEY) } catch { /* 隐私模式忽略 */ }
}
let introPlayedThisLoad = false
try { introPlayedThisLoad = sessionStorage.getItem(SEEN_KEY) === '1' } catch { /* 隐私模式忽略 */ }

/* 供外部「回到入场」调用：清掉本会话的已播标记，下一次挂载重新播开场 */
export function resetEntryCinema() {
  try { sessionStorage.removeItem(SEEN_KEY) } catch { /* 隐私模式忽略 */ }
  introPlayedThisLoad = false
  resumeP = 0
}
let activeCleanup = null
let resumeP = 0

function buildBooks(list) {
  return (list || []).map((script, index) => {
    const pal = PALETTE[index % PALETTE.length]
    return {
      id: script.id,
      title: script.title || '未命名剧本',
      genre: script.genre || '本格推理',
      players: script.players || (script.cast ? script.cast.length : 5),
      desc: script.description || '',
      notice: script.notice || '',
      beats: (script.beats || []).map(beat => Array.isArray(beat)
        ? { mark: beat[0], title: beat[1], text: beat[2] }
        : { mark: beat.mark, title: beat.title, text: beat.text }),
      cast: (script.cast || []).map(member => ({ name: member.name, identity: member.identity || '' })),
      img: script.cover ? `../图库素材/${script.cover}` : '',
      c1: pal[0],
      c2: pal[1],
      glow: pal[2],
    }
  })
}

/* ---------- 第一幕：顶光唤醒（three.js） ---------- */
/* 口径：灯泡藏在灯罩里，光只从罩口向下出。桌面、光锥、尘埃都由同一个「罩口聚光」函数受光，三者才对得上。 */
const LAMP = { rimY: 2, rimR: .3, shadeH: .28, shadeTopR: .07, narrow: 6, wide: 21, end: 8.8 }
/* 闪两下再稳：[起始秒, 时长, 强度] */
const FLICKERS = [[1.1, .07, .22], [1.62, .16, .42]]
/* 取景：起点只让灯罩底沿从画面顶边探进来；终点俯看，光池落在画面中部 */
const LAMP_FROM = { pos: [0, 1.5, 3.3], look: [0, .75, 0] }
const LAMP_TO = { pos: [0, 2.3, 2.9], look: [0, .1, 0] }
const ease = k => k * k * (3 - 2 * k)

function lampState(t) {
  let flicker = 0
  FLICKERS.forEach(([at, span, amp]) => {
    if (t >= at && t < at + span) flicker = Math.max(flicker, amp * (1 - (t - at) / span) ** 1.4)
  })
  const open = ease(unit((t - 3.6) / 2.6))
  /* 2.2s 起极暗地稳住（四成），3.6s 起随光锥张开升到全亮 */
  let power = Math.max(flicker, ease(unit((t - 2.2) / 1.4)) * .42 + open * .58)
  if (t > 6.2) power = 1 + Math.sin((t - 6.2) * 1.7) * .025
  return { power, angle: LAMP.narrow + (LAMP.wide - LAMP.narrow) * open, cam: ease(unit((t - 3.4) / 3.8)) }
}

const SPOT_GLSL = `
uniform vec3 uBulb;
uniform vec2 uCone;
uniform float uPower;
float spotCone(vec3 p) {
  float d = distance(uBulb, p);
  float cone = smoothstep(uCone.x, uCone.y, (uBulb.y - p.y) / d);
  return cone * 4.6 / (d * d);
}
float spotLight(vec3 p, vec3 n) {
  return spotCone(p) * max(dot(n, normalize(uBulb - p)), 0.0);
}`
const WOOD_GLSL = `
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
  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= .5; }
  return v;
}`
const SURFACE_VERT = `
varying vec3 vPos;
varying vec3 vNormal;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPos = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}`
const FINISH_GLSL = `
  col = 1.0 - exp(-col * 1.5);
  gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);`

/* 返回 null 表示这台设备开不出 WebGL，调用方直接跳过本幕。 */
function createLampScene(canvas, onDone) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  } catch { return null }
  renderer.setClearColor(0x000000, 1)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(46, 1, .1, 30)
  const spot = {
    uBulb: { value: new THREE.Vector3(0, LAMP.rimY, 0) },
    uCone: { value: new THREE.Vector2() },
    uPower: { value: 0 },
  }
  const dustTime = { uTime: { value: 0 } }
  const dustDpr = { uDpr: { value: 1 } }

  /* 木桌：板条 + 顺纹木纹，只在光池里被照亮 */
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: spot,
      vertexShader: SURFACE_VERT,
      fragmentShader: `
        ${SPOT_GLSL}
        ${WOOD_GLSL}
        varying vec3 vPos;
        varying vec3 vNormal;
        void main() {
          vec3 n = normalize(vNormal);
          float plank = floor(vPos.x / .17);
          float inPlank = vPos.x - plank * .17;
          vec2 g = vec2(inPlank, vPos.z * .1 + hash21(vec2(plank, 3.7)) * 9.0);
          float warp = fbm(vec2(g.x * 30.0, g.y)) * 2.0;
          float line = vPos.x * 180.0 + warp;
          float bands = mix(.5 + .5 * sin(line), .5, clamp(fwidth(line) * 1.5, 0.0, 1.0));
          float fine = vPos.x * 700.0;
          float fibre = mix(fbm(vec2(fine, vPos.z * 5.0)), .5, clamp(fwidth(fine), 0.0, 1.0));
          vec3 wood = mix(vec3(.03, .013, .005), vec3(.3, .145, .058), bands * .75 + fibre * .25);
          wood *= .45 + .55 * smoothstep(0.0, .0035, min(inPlank, .17 - inPlank));
          vec3 toBulb = normalize(uBulb - vPos);
          vec3 halfV = normalize(toBulb + normalize(cameraPosition - vPos));
          float gloss = pow(max(dot(n, halfV), 0.0), 34.0) * (.09 - fibre * .05) * spotCone(vPos) * 2.0;
          vec3 col = (wood * spotLight(vPos, n) * vec3(1.0, .8, .56) + gloss * vec3(1.0, .86, .64)) * 1.7 * uPower;
          ${FINISH_GLSL}
        }`,
    }),
  )
  scene.add(table)

  /* 灯罩：外面是深色珐琅，只露底沿；内壁被灯泡照亮，从下面看是一圈暖边 */
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(LAMP.shadeTopR, LAMP.rimR, LAMP.shadeH, 64, 1, true),
    new THREE.ShaderMaterial({
      uniforms: spot,
      side: THREE.DoubleSide,
      vertexShader: SURFACE_VERT,
      fragmentShader: `
        ${SPOT_GLSL}
        varying vec3 vPos;
        varying vec3 vNormal;
        void main() {
          vec3 geom = normalize(vNormal);
          /* 朝向相机的一侧：正面对着相机的是外壁，反面朝着相机的是内壁 */
          vec3 n = gl_FrontFacing ? geom : -geom;
          float h = clamp((vPos.y - ${LAMP.rimY.toFixed(2)}) / ${LAMP.shadeH.toFixed(2)}, 0.0, 1.0);
          /* 外壁是深色珐琅，只有紧贴底沿的一线被罩口的光照亮；内壁直接被灯泡照着 */
          vec3 col;
          if (gl_FrontFacing) {
            col = vec3(.004, .0045, .004) * uPower * 2.0 + vec3(1.0, .72, .4) * pow(1.0 - h, 16.0) * .3 * uPower;
          } else {
            float lit = max(dot(n, normalize(uBulb - vPos)), 0.0);
            col = vec3(1.0, .66, .34) * (lit * .7 + .3) * 1.3 * uPower;
          }
          ${FINISH_GLSL}
        }`,
    }),
  )
  shade.position.y = LAMP.rimY + LAMP.shadeH / 2
  scene.add(shade)

  /* 灯泡的辉光：一片加色贴图，亮度跟着灯走 */
  const glowCanvas = document.createElement('canvas')
  glowCanvas.width = glowCanvas.height = 128
  const g2d = glowCanvas.getContext('2d')
  const grad = g2d.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,246,224,1)')
  grad.addColorStop(.22, 'rgba(255,214,150,.5)')
  grad.addColorStop(.6, 'rgba(255,180,100,.1)')
  grad.addColorStop(1, 'rgba(255,170,90,0)')
  g2d.fillStyle = grad
  g2d.fillRect(0, 0, 128, 128)
  const glowTex = new THREE.CanvasTexture(glowCanvas)
  glowTex.colorSpace = THREE.SRGBColorSpace
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })
  const glow = new THREE.Sprite(glowMat)
  glow.position.set(0, LAMP.rimY + .08, 0)
  glow.scale.set(.6, .6, .6)
  scene.add(glow)

  /* 光锥：单位锥体，顶点在灯泡处，按半角缩放；越往下越淡，只作底，亮度主要交给尘埃 */
  const coneScale = { uScale: { value: new THREE.Vector3(1, 1, 1) } }
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(1, 1, 48, 12, true).translate(0, -.5, 0),
    new THREE.ShaderMaterial({
      uniforms: { ...spot, ...coneScale },
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform vec3 uScale;
        varying float vH;
        varying vec3 vPos;
        varying vec3 vNormal;
        void main() {
          vH = -position.y;
          vNormal = normalize(vec3(normal.x / uScale.x, normal.y / uScale.y, normal.z / uScale.z));
          vec4 world = modelMatrix * vec4(position, 1.0);
          vPos = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: `
        uniform float uPower;
        varying float vH;
        varying vec3 vPos;
        varying vec3 vNormal;
        void main() {
          vec3 view = normalize(cameraPosition - vPos);
          float body = pow(abs(dot(normalize(vNormal), view)), 1.3);
          float fade = pow(1.0 - vH, 1.5) * smoothstep(0.0, .06, vH);
          gl_FragColor = vec4(vec3(1.0, .82, .58) * body * fade * .16 * uPower, 1.0);
        }`,
    }),
  )
  cone.position.set(0, LAMP.rimY, 0)
  cone.visible = false
  scene.add(cone)

  /* 尘埃：光锥「靠尘埃可见」，每粒的亮度就是它所在位置收到的聚光 */
  const DUST = 4200
  const dustPos = new Float32Array(DUST * 3)
  const dustSeed = new Float32Array(DUST * 3)
  for (let i = 0; i < DUST; i += 1) {
    dustPos.set([(Math.random() - .5) * 3, Math.random() * LAMP.rimY, (Math.random() - .5) * 3], i * 3)
    dustSeed.set([Math.random(), Math.random(), Math.random()], i * 3)
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 3))
  const dust = new THREE.Points(
    dustGeo,
    new THREE.ShaderMaterial({
      uniforms: { ...spot, ...dustTime, ...dustDpr },
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        ${SPOT_GLSL}
        attribute vec3 aSeed;
        uniform float uTime;
        uniform float uDpr;
        varying float vLum;
        varying vec3 vSeed;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * (.12 + aSeed.x * .08) + aSeed.y * 6.2832) * .05;
          p.z += cos(uTime * (.1 + aSeed.y * .08) + aSeed.z * 6.2832) * .05;
          p.y += sin(uTime * (.06 + aSeed.z * .05) + aSeed.x * 6.2832) * .04;
          vSeed = aSeed;
          vLum = min(spotCone(p), 2.0) * uPower;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp(11.0 / -mv.z, .6, 1.8) * (.6 + aSeed.y * .8) * uDpr;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uTime;
        varying float vLum;
        varying vec3 vSeed;
        void main() {
          float d = length(gl_PointCoord - .5) * 2.0;
          float tw = .5 + .5 * sin(uTime * (1.2 + vSeed.z * 2.4) + vSeed.x * 6.2832);
          gl_FragColor = vec4(vec3(1.0, .84, .58) * vLum * smoothstep(1.0, .15, d) * (.35 + tw * .65) * 1.1, 1.0);
        }`,
    }),
  )
  dust.visible = false
  scene.add(dust)

  /* ---------- 播放 ---------- */
  const camFrom = new THREE.Vector3(...LAMP_FROM.pos)
  const camTo = new THREE.Vector3(...LAMP_TO.pos)
  const lookFrom = new THREE.Vector3(...LAMP_FROM.look)
  const lookTo = new THREE.Vector3(...LAMP_TO.look)
  const look = new THREE.Vector3()
  const rad = THREE.MathUtils.degToRad
  let raf = 0
  let origin = 0
  let done = false
  let lastT = 0

  function renderAt(t) {
    lastT = t
    const state = lampState(t)
    spot.uPower.value = state.power
    spot.uCone.value.set(Math.cos(rad(state.angle + 2.5)), Math.cos(rad(Math.max(0, state.angle - 2.5))))
    cone.visible = dust.visible = state.power > 0
    cone.scale.set(LAMP.rimY * Math.tan(rad(state.angle)) + .02, LAMP.rimY + .02, LAMP.rimY * Math.tan(rad(state.angle)) + .02)
    coneScale.uScale.value.copy(cone.scale)
    glowMat.opacity = state.power * .9
    camera.position.lerpVectors(camFrom, camTo, state.cam)
    camera.lookAt(look.lerpVectors(lookFrom, lookTo, state.cam))
    dustTime.uTime.value = t
    renderer.render(scene, camera)
    if (t >= LAMP.end && !done) {
      done = true
      onDone()
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame)
    renderAt(Math.max(0, (now - origin) / 1000))
  }

  return {
    /* from：起始秒数，0 是黑屏开头，画廊直达时跳过黑屏。
       hold：定格在这一秒不播放（?lampAt= 开发用，截图工具一拍要五秒，只能这样逐帧验收；定格时轻点仍会跳过） */
    start(from = 0, hold = null) {
      cancelAnimationFrame(raf)
      done = false
      if (hold !== null) { raf = 0; renderAt(Math.min(hold, LAMP.end - .001)); return }
      origin = performance.now() - from * 1000
      raf = requestAnimationFrame(frame)
    },
    seek(time) {
      cancelAnimationFrame(raf)
      raf = 0
      done = false
      renderAt(Math.min(time, LAMP.end - .001))
    },
    /* 轻点跳过：直接落到定格，由调用方接后续 */
    skip() {
      if (done) return
      done = true
      onDone()
    },
    resize(w, h, dpr) {
      renderer.setPixelRatio(dpr)
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      dustDpr.uDpr.value = dpr
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
        object.material?.dispose()
      })
      glowTex.dispose()
      renderer.dispose()
    },
  }
}

function template(books) {
  return `
  <div class="ec-stage" data-phase="intro">
    <div class="ec-lamp">
      <canvas class="ec-gl"></canvas>
    </div>

    <div class="ec-corridor">
      <canvas class="ec-canvas"></canvas>
      <div class="ec-hud">
        <div class="ec-hud-l">
          <span class="ec-kicker">纵向走廊 · 上下选本</span>
          <strong class="ec-now"></strong>
          <small class="ec-hud-sub"></small>
        </div>
      </div>
      <div class="ec-rail"><i></i></div>
      <p class="ec-guide">上下拖动选本 · 轻触封面翻开</p>
      <button type="button" class="ec-open">翻开剧本</button>
      <div class="ec-turn"></div>
    </div>

    <div class="ec-spread" aria-hidden="true">
      <div class="ec-book">
        <aside class="ec-left">
          <img alt="">
          <span class="ec-veil"></span>
          <div class="ec-id"><small></small><strong></strong><span></span></div>
        </aside>
        <div class="ec-right">
          <div class="ec-pages">
            <article class="ec-page" data-page="0"></article>
            <article class="ec-page" data-page="1"></article>
            <article class="ec-page" data-page="2"></article>
            <article class="ec-page" data-page="3"></article>
          </div>
          <div class="ec-flip"></div>
          <footer class="ec-foot">
            <span class="ec-no">01 / 04</span>
            <div class="ec-tabs"><i class="is-on"></i><i></i><i></i><i></i></div>
          </footer>
        </div>
      </div>
    </div>
  </div>
  <div class="ec-arrive" aria-hidden="true">
    <div class="ea-room">
      <div class="ea-table"></div>
      <i class="ea-lamp" style="left:33%;top:54%;animation-delay:2.15s"></i>
      <i class="ea-lamp" style="left:67%;top:54%;animation-delay:2.3s"></i>
      <i class="ea-lamp" style="left:19%;top:68%;animation-delay:2.45s"></i>
      <i class="ea-lamp" style="left:81%;top:68%;animation-delay:2.6s"></i>
      <i class="ea-lamp host" style="left:50%;top:79%;animation-delay:3.05s"></i>
    </div>
    <div class="ea-spill"></div>
    <div class="ea-door"><i class="ea-panel l"></i><i class="ea-panel r"></i><span class="ea-gap"></span></div>
    <div class="ea-copy">
      <p>围桌 · 五人剧场</p>
      <h3>门已开，请入席</h3>
      <span>五席已备 · 请落座</span>
    </div>
    <button type="button" class="ea-skip">跳过</button>
  </div>
  <div class="ec-top-actions">
    <button type="button" class="ec-join">已有房间码</button>
    <button type="button" class="ec-replay">重看开场</button>
  </div>
`
}

export function mountEntryCinema(host, options = {}) {
  if (!host) return
  const root = host.querySelector('[data-cinema-root]')
  if (!root) return
  const books = buildBooks(options.scripts)
  if (!books.length) return

  if (activeCleanup) {
    const previous = activeCleanup
    activeCleanup = null
    previous()
  }
  /* 要重播开场时，走廊必须从第一本开始，不能被上一次的进度带回中段 */
  if (!introPlayedThisLoad) resumeP = 0

  root.innerHTML = template(books)

  const stage = root.querySelector('.ec-stage')
  const intro = root.querySelector('.ec-lamp')

  const canvas = root.querySelector('.ec-canvas')
  const ctx = canvas.getContext('2d')
  const nowEl = root.querySelector('.ec-now')
  const hudSub = root.querySelector('.ec-hud-sub')
  const rail = root.querySelector('.ec-rail i')
  const openBtn = root.querySelector('.ec-open')
  const turnEl = root.querySelector('.ec-turn')
  const joinBtn = root.querySelector('.ec-join')
  const replayBtn = root.querySelector('.ec-replay')

  const spread = root.querySelector('.ec-spread')
  const arriveEl = root.querySelector('.ec-arrive')
  const pages = [...root.querySelectorAll('.ec-page')]
  const noEl = root.querySelector('.ec-no')
  const tabs = [...root.querySelectorAll('.ec-tabs i')]
  const flipEl = root.querySelector('.ec-flip')
  const rightPage = root.querySelector('.ec-right')

  let phase = 'intro'
  let currentBook = null
  let station = 0
  let loopRaf = 0
  let running = false

  const D = {
    w: 0, h: 0, dpr: 1,
    p: resumeP || 0,
    pTarget: resumeP || 0,
    camZ: 0, look: 0, lookTarget: 0,
    viewShift: 0, viewShiftT: 0,
    hits: [],
    focus: 0,
    motes: [],
  }

  /* ?trans=1|2|3：三个过渡候选方案（entry-transitions.js），从柔光柱起；
     不带参数走正式的顶光唤醒。两者同一块画布、同一套接口 */
  const previewMode = new URLSearchParams(location.search).get('preview') === '1'
  const trans = Number(new URLSearchParams(location.search).get('trans'))
  const softScene = TRANSITIONS.includes(trans)
    ? createSoftScene(root.querySelector('.ec-gl'), { books, plan: trans, onDone: enterCorridor })
    : null
  const lamp = softScene || createLampScene(root.querySelector('.ec-gl'), enterCorridor)
  /* 没有 WebGL 就没有「重看开场」可言，直接走走廊 */
  replayBtn.hidden = !lamp

  books.forEach(book => {
    if (!book.img) return
    const image = new Image()
    image.src = book.img
    book.image = image
  })

  const items = books.map((book, index) => ({
    i: index,
    book,
    x: (index % 2 ? 1 : -1) * (1.25 + (index % 3) * .42),
    y: ((index % 3) - 1) * .24,
    z: DEPTH.z0 + index * DEPTH.gap,
  }))

  for (let i = 0; i < 54; i += 1) {
    D.motes.push({
      x: (Math.random() - .5) * 10,
      y: (Math.random() - .5) * 5.4,
      z: Math.random() * (DEPTH.length + 10),
      r: .7 + Math.random() * 1.8,
    })
  }

  /* ---------- 尺寸 ---------- */
  function resize() {
    const w = root.clientWidth || 360
    const h = root.clientHeight || 620
    D.dpr = Math.min(2, window.devicePixelRatio || 1)
    D.w = w
    D.h = h
    canvas.width = Math.round(w * D.dpr)
    canvas.height = Math.round(h * D.dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    lamp?.resize(w, h, D.dpr)
    if (phase === 'corridor') draw()
  }

  const ro = new ResizeObserver(() => resize())
  ro.observe(root)

  /* ---------- 第一幕：顶光唤醒 ---------- */
  /* 自动播放；轻点跳过，直接交给 enterCorridor。
     ?lampAt=秒数：定格在那一秒（开发验收用），此时没有跳过和接续 */
  function startLamp(from = 0, hold = null) {
    if (!lamp) { enterCorridor(); return }
    if (hold === null && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { enterCorridor(); return }
    /* 柔光柱没有黑屏，重看时不必跳过第一秒 */
    lamp.start(softScene && hold === null && !previewMode ? 0 : from, hold)
  }

  function enterCorridor() {
    if (phase !== 'intro') return
    phase = 'corridor'
    introPlayedThisLoad = true
    try { sessionStorage.setItem(SEEN_KEY, '1') } catch { /* 隐私模式忽略 */ }
    intro.classList.add('is-gone')
    setTimeout(() => {
      if (!intro.isConnected || phase === 'intro') return
      intro.style.display = 'none'
      lamp?.stop()
    }, 640)
    stage.dataset.phase = 'corridor'
    resize()
    turnFlash()
    if (!running) {
      running = true
      loopRaf = requestAnimationFrame(loop)
    }
  }

  function turnFlash() {
    turnEl.style.transition = 'none'
    turnEl.style.opacity = '1'
    requestAnimationFrame(() => {
      turnEl.style.transition = 'opacity 1.2s cubic-bezier(.3,.7,.3,1)'
      turnEl.style.opacity = '0'
    })
  }

  /* 重看开场：从走廊退回第一幕，走廊进度归零；跳过黑屏等待，从吊灯亮起看 */
  function replayIntro() {
    if (phase === 'spread' || !lamp) return
    running = false
    cancelAnimationFrame(loopRaf)
    D.p = 0
    D.pTarget = 0
    D.look = 0
    D.lookTarget = 0
    D.viewShift = 0
    D.viewShiftT = 0
    resumeP = 0
    phase = 'intro'
    intro.style.display = ''
    intro.classList.remove('is-gone')
    stage.dataset.phase = 'intro'
    resize()
    startLamp(1)
  }

  /* ---------- 第二幕：走廊绘制 ---------- */
  function project(x, y, z) {
    const dz = z - D.camZ
    const f = D.h * DEPTH.fov
    return {
      dz,
      x: D.w * .5 + (x - D.look * .9 - D.viewShift) * f / dz,
      y: D.h * DEPTH.horizon + y * f / dz,
      f,
    }
  }

  function rr(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.arcTo(x + w, y, x + w, y + h, radius)
    ctx.arcTo(x + w, y + h, x, y + h, radius)
    ctx.arcTo(x, y + h, x, y, radius)
    ctx.arcTo(x, y, x + w, y, radius)
    ctx.closePath()
  }

  function drawBackdrop() {
    const { w, h } = D
    const bg = ctx.createRadialGradient(w * .5, h * .42, 0, w * .5, h * .46, Math.max(w, h) * .8)
    bg.addColorStop(0, '#181523')
    bg.addColorStop(.55, '#0b0a11')
    bg.addColorStop(1, '#030305')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    const hz = h * DEPTH.horizon
    const floor = ctx.createLinearGradient(0, hz, 0, h)
    floor.addColorStop(0, 'rgba(20,18,28,0)')
    floor.addColorStop(.4, 'rgba(16,14,23,.86)')
    floor.addColorStop(1, '#050407')
    ctx.fillStyle = floor
    ctx.fillRect(0, hz, w, h - hz)
  }

  function drawCorridor() {
    const { w, h } = D
    const hz = h * DEPTH.horizon
    const vx = w * .5 - D.look * 26
    ctx.lineWidth = 1
    for (let i = -4; i <= 4; i += 1) {
      const strength = .05 - Math.abs(i) * .008
      ctx.strokeStyle = `rgba(216,178,95,${Math.max(.012, strength)})`
      ctx.beginPath()
      ctx.moveTo(vx + i * w * .022, hz)
      ctx.lineTo(vx + i * w * .42, h)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(vx + i * w * .022, hz)
      ctx.lineTo(vx + i * w * .42, 0)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(216,178,95,.075)'
    ctx.beginPath()
    ctx.moveTo(0, hz)
    ctx.lineTo(w, hz)
    ctx.stroke()
  }

  function drawMotes() {
    ctx.fillStyle = 'rgba(255,236,200,.7)'
    D.motes.forEach(mote => {
      let dz = mote.z - D.camZ
      const span = DEPTH.length + 10
      while (dz < .4) dz += span
      if (dz > 30) return
      const size = Math.max(.6, mote.r * (7 / dz))
      const x = D.w * .5 + (mote.x - D.viewShift) * (D.h * DEPTH.fov) / dz
      const y = D.h * DEPTH.horizon + mote.y * (D.h * DEPTH.fov) / dz
      ctx.globalAlpha = Math.min(.75, 1.2 - dz / 26)
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.globalAlpha = 1
  }

  function drawCovers() {
    D.hits = []
    let best = -1
    let bestDz = Infinity

    const ordered = items
      .map(item => ({ item, dz: item.z - D.camZ }))
      .filter(entry => entry.dz > .4 && entry.dz < 32)
      .sort((a, b) => b.dz - a.dz)

    ordered.forEach(({ item, dz }) => {
      if (dz < 22 && dz > 1.4 && dz < bestDz) {
        bestDz = dz
        best = item.i
      }

      const point = project(item.x, item.y, item.z)
      const bw = DEPTH.coverW * point.f / dz
      if (bw > D.w * 1.4) return
      const bh = bw * 1.5
      const x = point.x - bw / 2
      const y = point.y - bh / 2
      if (x + bw < -80 || x > D.w + 80) return

      const alpha = Math.min(1, Math.max(0, (32 - dz) / 8), Math.max(.15, dz / 1.6))
      ctx.globalAlpha = alpha

      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,.85)'
      ctx.shadowBlur = Math.min(40, bw * .22)
      ctx.shadowOffsetY = Math.min(26, bw * .12)
      ctx.fillStyle = '#0c0b12'
      rr(x, y, bw, bh, bw * .02)
      ctx.fill()
      ctx.restore()

      ctx.save()
      rr(x, y, bw, bh, Math.max(2, bw * .02))
      ctx.clip()
      if (item.book.image && item.book.image.complete && item.book.image.naturalWidth) {
        ctx.drawImage(item.book.image, x, y, bw, bh)
      } else {
        const grad = ctx.createLinearGradient(x, y, x + bw, y + bh)
        grad.addColorStop(0, item.book.c1)
        grad.addColorStop(1, item.book.c2)
        ctx.fillStyle = grad
        ctx.fillRect(x, y, bw, bh)
      }
      const sheen = ctx.createLinearGradient(x, y, x + bw * .8, y + bh)
      sheen.addColorStop(0, 'rgba(255,255,255,.1)')
      sheen.addColorStop(.35, 'rgba(255,255,255,0)')
      sheen.addColorStop(1, 'rgba(0,0,0,.42)')
      ctx.fillStyle = sheen
      ctx.fillRect(x, y, bw, bh)
      ctx.restore()

      ctx.strokeStyle = `rgba(216,178,95,${item.i === D.focus ? .85 : .3})`
      ctx.lineWidth = item.i === D.focus ? Math.max(1.4, bw * .012) : 1
      rr(x, y, bw, bh, Math.max(2, bw * .02))
      ctx.stroke()

      if (item.i === D.focus) {
        ctx.fillStyle = item.book.glow
        ctx.globalAlpha = alpha * .45
        ctx.beginPath()
        ctx.ellipse(point.x, y + bh + 8, bw * .45, 10, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = alpha
      }

      if (bw > 96 && point.x > 72 && point.x < D.w - 72) {
        const fs = Math.max(9, Math.min(15, bw * .082))
        ctx.textAlign = 'center'
        ctx.fillStyle = item.i === D.focus ? '#f8f4ea' : 'rgba(240,236,226,.72)'
        ctx.font = `600 ${fs}px "Noto Serif SC","Songti SC",serif`
        ctx.fillText(item.book.title, point.x, y + bh + fs + 14, bw + 42)
        ctx.fillStyle = 'rgba(216,178,95,.72)'
        ctx.font = `500 ${Math.max(8, fs * .66)}px "PingFang SC","Noto Sans SC",sans-serif`
        ctx.fillText(item.i === D.focus ? '轻触翻开' : item.book.genre, point.x, y + bh + fs * 2.2 + 14, bw + 30)
      }

      if (bw > 40 && dz < 17 && x > -20 && x + bw < D.w + 20) {
        D.hits.push({ x, y, w: bw, h: bh, i: item.i })
      }
      ctx.globalAlpha = 1
    })

    if (best >= 0) D.focus = best
    D.lookTarget = items[D.focus] ? items[D.focus].x : 0
  }

  function drawVignette() {
    const { w, h } = D
    const edge = ctx.createRadialGradient(w * .5, h * .46, Math.min(w, h) * .18, w * .5, h * .5, Math.max(w, h) * .68)
    edge.addColorStop(0, 'rgba(0,0,0,0)')
    edge.addColorStop(.62, 'rgba(0,0,0,.16)')
    edge.addColorStop(1, 'rgba(0,0,0,.88)')
    ctx.fillStyle = edge
    ctx.fillRect(0, 0, w, h)

    const top = ctx.createLinearGradient(0, 0, 0, h * .3)
    top.addColorStop(0, 'rgba(3,3,5,.8)')
    top.addColorStop(1, 'rgba(3,3,5,0)')
    ctx.fillStyle = top
    ctx.fillRect(0, 0, w, h * .3)
  }

  function draw() {
    if (!D.w || !D.h) return
    ctx.setTransform(D.dpr, 0, 0, D.dpr, 0, 0)
    ctx.clearRect(0, 0, D.w, D.h)
    drawBackdrop()
    drawCorridor()
    drawMotes()
    drawCovers()
    drawVignette()
  }

  function syncHud() {
    const book = books[D.focus]
    if (!book) return
    if (nowEl.textContent !== book.title) {
      nowEl.textContent = book.title
      hudSub.textContent = `${book.genre} · ${book.players} 位席位`
      openBtn.textContent = `翻开《${book.title}》`
    }
    rail.style.height = `${(D.p * 100).toFixed(1)}%`
  }

  function loop() {
    if (!root.isConnected) return
    if (phase !== 'corridor') return
    D.p += (D.pTarget - D.p) * .18
    if (Math.abs(D.pTarget - D.p) < .0004) D.p = D.pTarget
    D.camZ = D.p * DEPTH.length
    D.look += (D.lookTarget - D.look) * .16
    D.viewShift += (D.viewShiftT - D.viewShift) * .16
    resumeP = D.pTarget
    draw()
    syncHud()
    loopRaf = requestAnimationFrame(loop)
  }

  /* ---------- 手势：走廊 ---------- */
  let drag = null

  function lookMax() {
    return Math.min(1.6, D.w / 600)
  }

  canvas.addEventListener('pointerdown', event => {
    if (phase !== 'corridor') return
    drag = { x: event.clientX, y: event.clientY, p: D.pTarget, moved: false }
    try { canvas.setPointerCapture(event.pointerId) } catch { /* 忽略 */ }
  })

  canvas.addEventListener('pointermove', event => {
    if (!drag || phase !== 'corridor') return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.moved && Math.abs(dx) < 7 && Math.abs(dy) < 7) return
    drag.moved = true
    D.pTarget = Math.max(0, Math.min(1, drag.p + (-dy) / (D.h * 1.5)))
    D.viewShiftT = Math.max(-1, Math.min(1, dx / 120)) * lookMax()
  })

  function endDrag(event) {
    if (!drag) return
    const { moved, x, y } = drag
    drag = null
    D.viewShiftT = 0
    if (!moved) {
      const rect = canvas.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const hit = D.hits.find(area => px >= area.x && px <= area.x + area.w && py >= area.y && py <= area.y + area.h)
      if (hit) openSpread(hit.i)
      return
    }
    snapToStation()
  }

  /* 松手后吸附到最近一本，保证聚焦封面停在舒适距离，不会顶满屏幕 */
  function snapToStation() {
    const cam = D.pTarget * DEPTH.length
    const index = Math.max(0, Math.min(items.length - 1, Math.round((cam + 7 - DEPTH.z0) / DEPTH.gap)))
    const p = (DEPTH.z0 + index * DEPTH.gap - 7) / DEPTH.length
    D.pTarget = Math.max(0, Math.min(1, p))
  }

  canvas.addEventListener('pointerup', endDrag)
  canvas.addEventListener('pointercancel', () => { drag = null; D.viewShiftT = 0 })

  let wheelTimer = 0
  canvas.addEventListener('wheel', event => {
    if (phase !== 'corridor') return
    event.preventDefault()
    D.pTarget = Math.max(0, Math.min(1, D.pTarget + event.deltaY / (D.h * 3)))
    clearTimeout(wheelTimer)
    wheelTimer = setTimeout(snapToStation, 320)
  }, { passive: false })

  openBtn.addEventListener('click', () => openSpread(D.focus))

  /* ---------- 第一幕手势：轻点跳过 ---------- */
  intro.addEventListener('pointerup', () => {
    if (phase === 'intro') lamp?.skip()
  })

  /* ---------- 第三幕：翻开剧本 ---------- */
  function fillSpread(book) {
    const escapeText = value => esc(value).replace(/\n/g, '<br>')
    pages[0].innerHTML = `
      <p class="ec-kicker">故事简介</p>
      <h3>${esc(book.title)}</h3>
      <p class="ec-lede">${escapeText(book.desc || '这一场故事还没有写下简介，等你入席后慢慢揭晓。')}</p>`

    const beats = book.beats.length
      ? book.beats.map(beat => `<li><b>${esc(beat.mark || '')}</b><strong>${esc(beat.title || '')}</strong><span>${escapeText(beat.text || '')}</span></li>`).join('')
      : `<li><b>提示</b><strong>故事暂未公开</strong><span>${escapeText(book.notice || book.desc || '入席后由主持人引导展开。')}</span></li>`
    pages[1].innerHTML = `
      <p class="ec-kicker">三段经过</p>
      <h3>故事走向</h3>
      <ol class="ec-beats">${beats}</ol>`

    const cast = book.cast.length
      ? book.cast.map(member => `<li><b>${esc(member.name)}</b><span>${escapeText(member.identity || '身份待揭晓')}</span></li>`).join('')
      : `<li><b>${book.players} 位玩家</b><span>角色由主持人在开本前分配。</span></li>`
    pages[2].innerHTML = `
      <p class="ec-kicker">在场席位</p>
      <h3>${book.players} 位角色</h3>
      <ul class="ec-cast">${cast}</ul>`

    pages[3].innerHTML = `
      <p class="ec-kicker">开本</p>
      <h3>今晚就《${esc(book.title)}》</h3>
      <p class="ec-cta-text">${esc(book.genre)} · ${book.players} 位席位<br>${escapeText(book.notice || '确认后选择主持方式，创建房间并入席。')}</p>
      <div class="ec-actions">
        <button type="button" class="ec-btn-gold" data-act="confirm">确认这本</button>
        <button type="button" class="ec-btn-ghost" data-act="back">回到走廊</button>
      </div>`

    const leftImg = root.querySelector('.ec-left img')
    if (leftImg) {
      if (book.img) leftImg.src = book.img
      else {
        leftImg.removeAttribute('src')
        leftImg.style.background = `linear-gradient(160deg,${book.c1},${book.c2})`
      }
    }
  }

  function showPage(index, animate) {
    const next = Math.max(0, Math.min(3, index))
    if (next === station && pages[next].classList.contains('is-on')) return
    pages.forEach((page, i) => {
      const on = i === next
      page.classList.toggle('is-on', on)
      page.classList.toggle('is-out', !on && page.classList.contains('is-on') === false && animate && i === station)
    })
    station = next
    noEl.textContent = `${String(next + 1).padStart(2, '0')} / 04`
    tabs.forEach((tab, i) => tab.classList.toggle('is-on', i === next))
    if (animate) {
      flipEl.classList.remove('is-on')
      void flipEl.offsetWidth
      flipEl.classList.add('is-on')
    }
  }

  function openSpread(index) {
    const book = books[index]
    if (!book) return
    currentBook = book
    fillSpread(book)
    station = -1
    showPage(0, false)
    phase = 'spread'
    stage.dataset.phase = 'spread'
    spread.setAttribute('aria-hidden', 'false')
    running = false
    cancelAnimationFrame(loopRaf)
    D.viewShiftT = 0
  }

  function closeSpread() {
    phase = 'corridor'
    stage.dataset.phase = 'corridor'
    spread.setAttribute('aria-hidden', 'true')
    resize()
    if (!running) {
      running = true
      loopRaf = requestAnimationFrame(loop)
    }
  }

  let spreadDrag = null
  rightPage.addEventListener('pointerdown', event => {
    spreadDrag = { x: event.clientX, y: event.clientY }
  })
  rightPage.addEventListener('pointerup', event => {
    if (!spreadDrag) return
    const dx = event.clientX - spreadDrag.x
    const dy = event.clientY - spreadDrag.y
    spreadDrag = null
    if (Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(dy)) return
    if (dx < 0) {
      if (station < 3) showPage(station + 1, true)
    } else if (station === 0) {
      closeSpread()
    } else {
      showPage(station - 1, true)
    }
  })

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => showPage(index, true))
  })

  /* 扫码后的第一幕：推门入席。播完再进开场/走廊；选本确认后不再播这一段。 */
  function playArrive(done) {
    if (!arriveEl) { done(); return }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return }
    phase = 'arrive'
    stage.dataset.phase = 'arrive'
    spread.setAttribute('aria-hidden', 'true')
    arriveEl.setAttribute('aria-hidden', 'false')
    let finished = false
    let timer = 0
    const finish = () => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      arriveEl.setAttribute('aria-hidden', 'true')
      done()
    }
    timer = setTimeout(finish, 4600)
    arriveEl.addEventListener('click', finish, { once: true })
  }

  spread.addEventListener('click', event => {
    const action = event.target.closest('[data-act]')
    if (!action) return
    if (action.dataset.act === 'back') {
      closeSpread()
      return
    }
    if (action.dataset.act === 'confirm' && currentBook) {
      options.onConfirm?.(currentBook.id)
    }
  })

  joinBtn.addEventListener('click', () => {
    options.onJoin?.()
  })

  replayBtn.addEventListener('click', replayIntro)

  let previewFrame = 0
  const handoff = ({ 1: 6.1, 2: 7.8, 3: 6.9 })[trans] || LAMP.end
  function previewAt(time) {
    if (time >= handoff) {
      if (phase !== 'corridor') goCorridor()
      const fade = Math.min(1, (time - handoff) / .64)
      intro.style.display = fade < 1 ? '' : 'none'
      intro.style.opacity = String(1 - fade)
      if (fade < 1) lamp?.seek(time)
      return
    }
    intro.style.opacity = ''
    if (phase !== 'intro') {
      running = false
      cancelAnimationFrame(loopRaf)
      phase = 'intro'
      intro.style.display = ''
      intro.classList.remove('is-gone')
      stage.dataset.phase = 'intro'
      resize()
    }
    lamp?.seek(Math.max(0, time))
  }
  function previewCommand(event) {
    if (!previewMode || event.source !== window.parent || event.data?.type !== 'weizhuo:preview-clock') return
    const expected = document.referrer ? new URL(document.referrer).origin : location.origin
    if (event.origin !== expected) return
    cancelAnimationFrame(previewFrame)
    const time = Math.max(0, Number(event.data.time) || 0)
    previewAt(time)
    if (event.data.command !== 'play') return
    const at = Number(event.data.at) || Date.now()
    const animate = () => {
      const elapsed = time + Math.max(0, (performance.timeOrigin + performance.now() - at) / 1000)
      previewAt(elapsed)
      if (elapsed < handoff + .64) previewFrame = requestAnimationFrame(animate)
    }
    previewFrame = requestAnimationFrame(animate)
  }
  if (previewMode) window.addEventListener('message', previewCommand)

  /* ---------- 生命周期 ---------- */
  const cleanup = () => {
    window.removeEventListener('message', previewCommand)
    cancelAnimationFrame(previewFrame)
    lamp?.dispose()
    cancelAnimationFrame(loopRaf)
    clearTimeout(wheelTimer)
    ro.disconnect()
    resumeP = D.pTarget
    running = false
  }
  activeCleanup = cleanup

  const goCorridor = () => {
    phase = 'corridor'
    intro.style.display = 'none'
    lamp?.stop()
    stage.dataset.phase = 'corridor'
    resize()
    if (!running) {
      running = true
      loopRaf = requestAnimationFrame(loop)
    }
  }

  /* ?stage=intro|corridor|arrive：画廊手机视图按流程按钮直接定位。
     正常入场不再播推门入席，黑屏 → 顶光唤醒 → 走廊；这一幕本会话播过就直接进走廊。 */
  const entryStage = new URLSearchParams(location.search).get('stage')
  if (entryStage === 'intro') {
    const hold = new URLSearchParams(location.search).get('lampAt')
    startLamp(1, hold === null ? null : Number(hold) || 0)
  } else if (entryStage === 'corridor') {
    goCorridor()
  } else if (entryStage === 'detail' && previewMode) {
    goCorridor()
    openSpread(0)
  } else if (entryStage === 'arrive') {
    playArrive(() => startLamp(1))
  } else if (introPlayedThisLoad) {
    goCorridor()
  } else {
    startLamp(0)
  }
  if (previewMode && window.parent !== window) {
    const parentOrigin = document.referrer ? new URL(document.referrer).origin : location.origin
    window.parent.postMessage({ type: 'weizhuo:preview-ready' }, parentOrigin)
  }
}
