/* 多画面调试台：左侧常驻画面列表 + 右侧无限画布
 * 原生 ES 模块，无构建、无依赖；四个 iframe 同源，只读镜像真实房间，画面内部不可操作。
 */

const STORAGE_KEY = 'weizhuo:canvas:v2'
const ROOM_PENDING = '暂无房间'
const ZOOM_MIN = 0.25
const ZOOM_MAX = 2
const ZOOM_STEP = 1.2
const WIDTH_MIN = 240
const WIDTH_MAX = 1400
/* 默认 68%：1440×900 下四个画面（含 649 高的手机窗）能同时完整入画；工具条占住顶部，故首行从 y=90 起。 */
const DEFAULT_ZOOM = .65
const DEFAULT_PAN = { x: 10, y: 4 }
/* 窗口标题栏高度（世界坐标）；窗口总高 = 标题栏 + 画面内容 */
const HEAD_HEIGHT = 30

/* 固定画面，顺序即左侧列表顺序；x/y/width 为默认布局 */
const WINDOW_DEFS = [
  /* 电脑端按 1440×810 的真实大屏渲染再等比缩放：选本页是三栏布局，
     用 800×450 的窄视口会把右侧二维码那一栏挤出画面。 */
  { id: 'computer', label: '电脑主机端', src: '?endpoint=computer&mirror=computer&embed=1&stage=1&v=20261125-flow4', lobbySrc: '?endpoint=computer&mirror=computer&embed=1&stage=1&lobby=1&v=20261125-flow4', aspect: 16 / 9, width: 800, designW: 1440, x: 30, y: 80 },
  /* 主持端按独立主持页 1440×1040 的原布局设计；默认 620 宽时整页等比缩放，改大小只缩放不重排 */
  { id: 'host', label: '主持端', src: '?endpoint=host&mirror=host&embed=1&v=20261125-flow4', aspect: 1440 / 1040, width: 620, designW: 1440, x: 860, y: 80 },
  { id: 'owner', label: '房主玩家', src: '?endpoint=player&mirror=owner&embed=1&v=20261125-flow4', aspect: 390 / 844, width: 240, x: 860, y: 600 },
  { id: 'invited', label: '受邀玩家', src: '?endpoint=player&mirror=invited&embed=1&v=20261125-flow4', aspect: 390 / 844, width: 240, x: 1120, y: 600 },
  /* 五个座位逐一镜像；默认收起，点左侧列表才加载，避免九块画面同时跑 3D */
  { id: 'seat1', label: '玩家 1', src: '?endpoint=player&mirror=seat0&embed=1&v=20261125-flow4', aspect: 390 / 844, width: 230, x: 30, y: 1180, open: false },
  { id: 'seat2', label: '玩家 2', src: '?endpoint=player&mirror=seat1&embed=1&v=20261125-flow4', aspect: 390 / 844, width: 230, x: 280, y: 1180, open: false },
  { id: 'seat3', label: '玩家 3', src: '?endpoint=player&mirror=seat2&embed=1&v=20261125-flow4', aspect: 390 / 844, width: 230, x: 530, y: 1180, open: false },
  { id: 'seat4', label: '玩家 4', src: '?endpoint=player&mirror=seat3&embed=1&v=20261125-flow4', aspect: 390 / 844, width: 230, x: 780, y: 1180, open: false },
  { id: 'seat5', label: '玩家 5', src: '?endpoint=player&mirror=seat4&embed=1&v=20261125-flow4', aspect: 390 / 844, width: 230, x: 1030, y: 1180, open: false },
]

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function roundTo(value, digits = 1) {
  const base = 10 ** digits
  return Math.round(value * base) / base
}

/* 读取本地布局；结构不合法时整体回落默认布局 */
function readLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    if (!data.windows || typeof data.windows !== 'object') return null
    const zoomValue = data.zoom
    const panSource = data.pan && typeof data.pan === 'object' ? data.pan : null
    if (typeof zoomValue !== 'number' || !Number.isFinite(zoomValue)) return null
    if (!panSource || typeof panSource.x !== 'number' || typeof panSource.y !== 'number') return null
    if (!Number.isFinite(panSource.x) || !Number.isFinite(panSource.y)) return null
    return {
      zoom: clamp(zoomValue, ZOOM_MIN, ZOOM_MAX),
      pan: { x: panSource.x, y: panSource.y },
      windows: data.windows,
    }
  } catch {
    return null
  }
}

/* 单个画面的持久化状态；该条坏数据只回落该画面的默认值 */
function windowStateFromSaved(def, saved, index) {
  const fallback = { x: def.x, y: def.y, w: def.width, open: def.open !== false, z: index + 1 }
  const entry = saved && saved.windows ? saved.windows[def.id] : null
  if (!entry || typeof entry !== 'object') return fallback
  if (typeof entry.x !== 'number' || typeof entry.y !== 'number' || typeof entry.w !== 'number') return fallback
  if (!Number.isFinite(entry.x) || !Number.isFinite(entry.y) || !Number.isFinite(entry.w)) return fallback
  const z = entry.z
  return {
    x: entry.x,
    y: entry.y,
    w: clamp(entry.w, WIDTH_MIN, WIDTH_MAX),
    open: entry.open !== false,
    z: typeof z === 'number' && Number.isFinite(z) && z > 0 ? z : fallback.z,
  }
}

function withStamp(src, stamp) {
  return `${src}${src.includes('?') ? '&' : '?'}t=${stamp}`
}

export function initCanvasBoard(options = {}) {
  const viewport = document.querySelector('#canvas-viewport')
  const world = document.querySelector('#canvas-world')
  const railList = document.querySelector('#canvas-rail-list')
  if (!viewport || !world || !railList) return null

  /* 同一页面重复初始化时，先收掉上一块画布，避免监听器叠加 */
  if (window.weizhuoCanvasBoard && typeof window.weizhuoCanvasBoard.destroy === 'function') {
    window.weizhuoCanvasBoard.destroy()
  }

  const roomLabel = document.querySelector('#canvas-room-label')
  const zoomLabel = document.querySelector('#canvas-zoom-label')
  const notify = typeof options.notify === 'function' ? options.notify : null

  const listeners = []
  const records = new Map()
  const saved = readLayout()
  let zoom = saved ? saved.zoom : DEFAULT_ZOOM
  let pan = saved ? saved.pan : { ...DEFAULT_PAN }
  let room = ''
  /* 三镜演示：0 关闭；1 只看电脑；2 房主+对照播入场；3 房主停在选本后的详情页 */
  let demoStage = 0
  let nextZ = 1
  let saveTimer = 0
  let panDrag = null
  /* 触屏：单指拖动平移，双指捏合/拖动缩放平移 */
  const touchPoints = new Map()
  let touchPan = null
  let touchGesture = null
  /* 画布 HUD：网格、比例尺、左侧竖向标尺、对齐辅助线、拖动尺寸读数 */
  let rulerCanvas = null
  let rulerCtx = null
  let scaleEl = null
  let scaleBarEl = null
  let scaleLabelEl = null
  let guideXEl = null
  let guideYEl = null
  let sizeBadgeEl = null
  let rulerFrame = 0
  let destroyed = false

  function listen(target, type, handler, opts) {
    if (!target) return
    target.addEventListener(type, handler, opts)
    listeners.push([target, type, handler, opts])
  }

  function windowHeight(record) {
    return HEAD_HEIGHT + record.w / record.aspect
  }

  /* ---------- 布局持久化 ---------- */

  function scheduleSave() {
    if (destroyed) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(writeLayout, 160)
  }

  function writeLayout() {
    clearTimeout(saveTimer)
    saveTimer = 0
    if (destroyed) return
    const windows = {}
    for (const record of records.values()) {
      windows[record.id] = {
        x: roundTo(record.x),
        y: roundTo(record.y),
        w: roundTo(record.w),
        open: record.open,
        z: record.z,
      }
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        zoom: roundTo(zoom, 3),
        pan: { x: roundTo(pan.x), y: roundTo(pan.y) },
        windows,
      }))
    } catch {
      /* 隐私模式或配额不足时忽略 */
    }
  }

  /* ---------- 画布变换 ---------- */

  function applyTransform() {
    world.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
    if (zoomLabel) zoomLabel.textContent = `${Math.round(zoom * 100)}%`
    updateGrid()
    updateScale()
    scheduleRuler()
  }

  /* ---------- 网格 / 比例尺 / 竖向标尺 / 对齐辅助 ---------- */

  function createHud() {
    rulerCanvas = document.createElement('canvas')
    rulerCanvas.className = 'canvas-ruler-y'
    rulerCanvas.setAttribute('aria-hidden', 'true')
    viewport.append(rulerCanvas)
    rulerCtx = rulerCanvas.getContext('2d')

    guideXEl = document.createElement('div')
    guideXEl.className = 'canvas-guide canvas-guide-x'
    guideXEl.setAttribute('aria-hidden', 'true')
    guideYEl = document.createElement('div')
    guideYEl.className = 'canvas-guide canvas-guide-y'
    guideYEl.setAttribute('aria-hidden', 'true')
    viewport.append(guideXEl, guideYEl)

    scaleEl = document.createElement('div')
    scaleEl.className = 'canvas-scale'
    scaleEl.setAttribute('aria-hidden', 'true')
    scaleBarEl = document.createElement('span')
    scaleBarEl.className = 'canvas-scale-bar'
    scaleLabelEl = document.createElement('span')
    scaleLabelEl.className = 'canvas-scale-label'
    scaleEl.append(scaleBarEl, scaleLabelEl)
    viewport.append(scaleEl)

    sizeBadgeEl = document.createElement('div')
    sizeBadgeEl.className = 'canvas-size-badge'
    sizeBadgeEl.setAttribute('aria-hidden', 'true')
    viewport.append(sizeBadgeEl)
  }

  /* 方格背景：小格 20、大格 100，随平移缩放同步；太小的小格自动隐藏 */
  function updateGrid() {
    const minor = 20 * zoom
    const major = 100 * zoom
    const pos = `${pan.x}px ${pan.y}px`
    const layers = []
    const sizes = []
    if (minor >= 12) {
      layers.push('linear-gradient(to right, rgba(255,255,255,.05) 1px, transparent 1px)')
      layers.push('linear-gradient(to bottom, rgba(255,255,255,.05) 1px, transparent 1px)')
      sizes.push(`${minor}px ${minor}px`, `${minor}px ${minor}px`)
    }
    layers.push('linear-gradient(to right, rgba(200,163,92,.14) 1px, transparent 1px)')
    layers.push('linear-gradient(to bottom, rgba(200,163,92,.14) 1px, transparent 1px)')
    sizes.push(`${major}px ${major}px`, `${major}px ${major}px`)
    viewport.style.backgroundImage = layers.join(',')
    viewport.style.backgroundSize = sizes.join(',')
    viewport.style.backgroundPosition = Array(layers.length).fill(pos).join(',')
  }

  /* 比例尺：自动选 10/20/50/100/200/500，让横线大约 70–140px */
  function updateScale() {
    if (!scaleBarEl || !scaleLabelEl) return
    const lengths = [10, 20, 50, 100, 200, 500, 1000, 2000]
    let len = lengths.find(value => value * zoom >= 70 && value * zoom <= 140)
    if (!len) len = lengths.reduce((best, value) => Math.abs(value * zoom - 105) < Math.abs(best * zoom - 105) ? value : best, lengths[0])
    scaleBarEl.style.width = `${len * zoom}px`
    scaleLabelEl.textContent = `${len} · ${Math.round(zoom * 100)}%`
  }

  function scheduleRuler() {
    if (!rulerCanvas || rulerFrame) return
    rulerFrame = requestAnimationFrame(() => {
      rulerFrame = 0
      drawRuler()
    })
  }

  /* 左侧竖向标尺：主刻度 100、次刻度 20；缩放低时自动减少标签密度 */
  function drawRuler() {
    if (!rulerCanvas || !rulerCtx) return
    const rect = viewport.getBoundingClientRect()
    const width = 32
    const height = Math.max(1, rect.height)
    const dpr = Math.min(devicePixelRatio || 1, 2)
    if (rulerCanvas.width !== Math.round(width * dpr) || rulerCanvas.height !== Math.round(height * dpr)) {
      rulerCanvas.width = Math.round(width * dpr)
      rulerCanvas.height = Math.round(height * dpr)
    }
    const ctx = rulerCtx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = 'rgba(18,17,16,.92)'
    ctx.fillRect(0, 0, width, height)

    const minor = 20
    const major = 100
    const showMinor = minor * zoom >= 8
    const labelEvery = Math.max(1, Math.ceil(45 / (major * zoom)))
    const start = Math.floor((0 - pan.y) / zoom / minor) * minor
    const end = Math.ceil((height - pan.y) / zoom / minor) * minor
    ctx.font = '9px "Segoe UI", system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let wy = start; wy <= end; wy += minor) {
      const sy = pan.y + wy * zoom
      if (sy < -10 || sy > height + 10) continue
      const isMajor = wy % major === 0
      if (!isMajor && !showMinor) continue
      ctx.strokeStyle = isMajor ? 'rgba(200,163,92,.6)' : 'rgba(255,255,255,.18)'
      ctx.beginPath()
      ctx.moveTo(width - (isMajor ? 10 : 5), Math.round(sy) + .5)
      ctx.lineTo(width, Math.round(sy) + .5)
      ctx.stroke()
      if (isMajor && (wy / major) % labelEvery === 0) {
        ctx.fillStyle = '#8d8478'
        ctx.fillText(String(Math.round(wy)), width - 12, sy)
      }
    }
    ctx.strokeStyle = 'rgba(81,70,49,.85)'
    ctx.beginPath()
    ctx.moveTo(width - .5, 0)
    ctx.lineTo(width - .5, height)
    ctx.stroke()
  }

  function showGuideX(worldX) {
    if (!guideXEl) return
    guideXEl.style.display = 'block'
    guideXEl.style.left = `${pan.x + worldX * zoom}px`
  }

  function showGuideY(worldY) {
    if (!guideYEl) return
    guideYEl.style.display = 'block'
    guideYEl.style.top = `${pan.y + worldY * zoom}px`
  }

  function clearGuides() {
    if (guideXEl) guideXEl.style.display = 'none'
    if (guideYEl) guideYEl.style.display = 'none'
  }

  function showSizeBadge(record) {
    if (!sizeBadgeEl) return
    const rect = viewport.getBoundingClientRect()
    sizeBadgeEl.textContent = `${Math.round(record.w)} × ${Math.round(windowHeight(record))}`
    sizeBadgeEl.style.display = 'block'
    const x = pan.x + record.x * zoom
    const y = pan.y + record.y * zoom - 24
    sizeBadgeEl.style.left = `${clamp(x, 36, Math.max(36, rect.width - 96))}px`
    sizeBadgeEl.style.top = `${clamp(y, 4, Math.max(4, rect.height - 28))}px`
  }

  function hideSizeBadge() {
    if (sizeBadgeEl) sizeBadgeEl.style.display = 'none'
  }

  /* 拖动吸附：窗口的左/中/右、上/中/下靠近其他窗口或 100 网格时吸附并显示辅助线 */
  function snapDrag(record) {
    const threshold = 6 / zoom
    const others = [...records.values()].filter(item => item !== record && item.open)
    const height = windowHeight(record)
    const edgesX = [record.x, record.x + record.w / 2, record.x + record.w]
    const edgesY = [record.y, record.y + height / 2, record.y + height]
    const candX = []
    const candY = []
    for (const other of others) {
      const otherH = windowHeight(other)
      candX.push(other.x, other.x + other.w / 2, other.x + other.w)
      candY.push(other.y, other.y + otherH / 2, other.y + otherH)
    }
    for (const edge of edgesX) candX.push(Math.round(edge / 100) * 100)
    for (const edge of edgesY) candY.push(Math.round(edge / 100) * 100)

    let dx = 0
    let guideX = null
    let dy = 0
    let guideY = null
    for (const edge of edgesX) {
      for (const candidate of candX) {
        const delta = candidate - edge
        if (Math.abs(delta) <= threshold && (guideX === null || Math.abs(delta) < Math.abs(dx))) {
          dx = delta
          guideX = candidate
        }
      }
    }
    for (const edge of edgesY) {
      for (const candidate of candY) {
        const delta = candidate - edge
        if (Math.abs(delta) <= threshold && (guideY === null || Math.abs(delta) < Math.abs(dy))) {
          dy = delta
          guideY = candidate
        }
      }
    }
    record.x += dx
    record.y += dy
    clearGuides()
    if (guideX !== null) showGuideX(guideX)
    if (guideY !== null) showGuideY(guideY)
  }

  /* 缩放吸附：右边缘或下边缘靠近其他窗口/100 网格时，改宽度让边缘对齐 */
  function snapResize(record, width) {
    const threshold = 6 / zoom
    const others = [...records.values()].filter(item => item !== record && item.open)
    const candX = []
    const candY = []
    for (const other of others) {
      const otherH = windowHeight(other)
      candX.push(other.x, other.x + other.w / 2, other.x + other.w)
      candY.push(other.y, other.y + otherH / 2, other.y + otherH)
    }
    const right = record.x + width
    const bottom = record.y + HEAD_HEIGHT + width / record.aspect
    candX.push(Math.round(right / 100) * 100)
    candY.push(Math.round(bottom / 100) * 100)

    let bestWidth = width
    let bestDelta = threshold + 1
    let guideX = null
    let guideY = null
    for (const candidate of candX) {
      const next = candidate - record.x
      if (next < WIDTH_MIN || next > WIDTH_MAX) continue
      const delta = Math.abs(next - width)
      if (delta <= threshold && delta < bestDelta) {
        bestDelta = delta
        bestWidth = next
        guideX = candidate
        guideY = null
      }
    }
    for (const candidate of candY) {
      const next = (candidate - record.y - HEAD_HEIGHT) * record.aspect
      if (next < WIDTH_MIN || next > WIDTH_MAX) continue
      const delta = Math.abs(next - width)
      if (delta <= threshold && delta < bestDelta) {
        bestDelta = delta
        bestWidth = next
        guideY = candidate
        guideX = null
      }
    }
    clearGuides()
    if (guideX !== null) showGuideX(guideX)
    if (guideY !== null) showGuideY(guideY)
    return bestWidth
  }

  function applyWindow(record) {
    const el = record.el
    el.style.left = `${record.x}px`
    el.style.top = `${record.y}px`
    el.style.width = `${record.w}px`
    el.style.height = `${windowHeight(record)}px`
    el.style.zIndex = String(record.z)
    el.dataset.open = record.open ? 'true' : 'false'
    el.style.display = record.open ? 'flex' : 'none'
    /* 画面内容按虚拟设计尺寸渲染，再用 transform 等比缩放到窗口宽度 */
    if (record.frame) record.frame.style.transform = `scale(${record.w / record.designW})`
  }

  /* 以视口内某点为锚点缩放；锚点坐标是相对 viewport 的像素 */
  function setZoom(nextZoom, anchorX, anchorY) {
    const value = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX)
    if (Math.abs(value - zoom) < 0.0001) return
    const worldX = (anchorX - pan.x) / zoom
    const worldY = (anchorY - pan.y) / zoom
    zoom = value
    pan.x = anchorX - worldX * zoom
    pan.y = anchorY - worldY * zoom
    applyTransform()
    scheduleSave()
  }

  function zoomFromCenter(factor) {
    const rect = viewport.getBoundingClientRect()
    setZoom(zoom * factor, rect.width / 2, rect.height / 2)
  }

  /* ---------- 画面开关与焦点 ---------- */

  function updateRailState(record) {
    record.stateEl.textContent = record.open ? '已打开' : '已关闭'
    record.rail.dataset.open = record.open ? 'true' : 'false'
    record.rail.setAttribute('aria-pressed', record.open ? 'true' : 'false')
  }

  function updateRoomLabels() {
    const text = room || ROOM_PENDING
    if (roomLabel) roomLabel.textContent = room ? `房间 ${room}` : ROOM_PENDING
    for (const record of records.values()) record.roomEl.textContent = text
  }

  function flashNode(node) {
    if (!node) return
    node.classList.remove('is-flash')
    /* 强制回流，保证连续点击也能重新触发闪烁 */
    void node.offsetWidth
    node.classList.add('is-flash')
    setTimeout(() => node.classList.remove('is-flash'), 620)
    if (typeof node.animate !== 'function') return
    try {
      node.animate([
        { outline: '2px solid #ffd166', outlineOffset: '2px' },
        { outline: '2px solid rgba(255,209,102,0)', outlineOffset: '8px' },
      ], { duration: 620, easing: 'ease-out' })
    } catch {
      /* 不支持 Web Animations 时只靠 class 提示 */
    }
  }

  /* 置顶并同步列表高亮；不重建 iframe */
  function focusRecord(record, withFlash) {
    record.z = nextZ++
    applyWindow(record)
    for (const other of records.values()) {
      const active = other === record
      other.el.classList.toggle('is-focused', active)
      other.rail.classList.toggle('is-focused', active)
    }
    if (withFlash) {
      flashNode(record.el)
      flashNode(record.rail)
    }
    scheduleSave()
  }

  function openRecord(record) {
    if (record.open) return false
    record.open = true
    /* 默认收起的画面在第一次打开时才真正加载；空房态下只有电脑端进大厅 */
    record.mode = null
    applyRoomMode(record)
    record.el.dataset.open = 'true'
    record.el.style.display = 'flex'
    updateRailState(record)
    scheduleSave()
    return true
  }

  function closeRecord(record) {
    if (!record.open) return
    record.open = false
    /* iframe 留在 DOM 里，只隐藏；重新打开不会重新加载 */
    record.el.dataset.open = 'false'
    record.el.style.display = 'none'
    record.el.classList.remove('is-focused')
    record.rail.classList.remove('is-focused')
    updateRailState(record)
    scheduleSave()
  }

  /* 已打开但中心点不在可视区时，把画面平移到视口中心 */
  function ensureVisible(record) {
    const rect = viewport.getBoundingClientRect()
    if (!rect.width || !rect.height) return false
    const cx = pan.x + (record.x + record.w / 2) * zoom
    const cy = pan.y + (record.y + windowHeight(record) / 2) * zoom
    if (cx >= 0 && cx <= rect.width && cy >= 0 && cy <= rect.height) return false
    pan.x = rect.width / 2 - (record.x + record.w / 2) * zoom
    pan.y = rect.height / 2 - (record.y + windowHeight(record) / 2) * zoom
    applyTransform()
    scheduleSave()
    return true
  }

  function handleRailClick(record) {
    openRecord(record)
    const moved = ensureVisible(record)
    focusRecord(record, !moved)
  }

  /* ---------- 房间同步消息 ---------- */

  /* 没有房号即大厅态：只有电脑主机端显示扫码入口，其余画面留空。
     进入房间时再把各画面切回真实镜像。 */
  function applyRoomMode(record) {
    if (!record.open) return
    const lobbyMode = !room
    const mode = lobbyMode ? 'lobby' : 'room'
    if (record.mode === mode) return
    record.mode = mode
    record.loaded = false
    if (record.id === 'computer') {
      record.el.dataset.empty = 'false'
      record.frame.src = lobbyMode ? (record.lobbySrc || record.src) : record.src
      return
    }
    record.el.dataset.empty = lobbyMode ? 'true' : 'false'
    record.frame.src = lobbyMode ? 'about:blank' : record.src
  }

  function postRoom(record) {
    if (!record.loaded) return
    if (record.frame.getAttribute('src') === 'about:blank') return
    const target = record.frame.contentWindow
    if (!target) return
    try {
      target.postMessage({ type: 'weizhuo:target-room', room }, location.origin)
    } catch {
      /* 未加载完成或跨域时忽略，load 后会重发 */
    }
  }

  function setRoom(code) {
    room = code == null ? '' : String(code).trim()
    updateRoomLabels()
    for (const record of records.values()) {
      applyRoomMode(record)
      postRoom(record)
    }
    return room
  }

  /* 三镜演示：只改画面编排，不动房间状态。
     镜头 1 只留电脑；镜头 2 房主与对照重载进入场动画；镜头 3 房主直接停到选本详情页。 */
  function applyDemoStage(record) {
    if (record.id === 'computer') {
      record.el.dataset.empty = 'false'
      if (!room) record.frame.src = record.lobbySrc || record.src
      return
    }
    if (!demoStage) {
      record.mode = ''
      applyRoomMode(record)
      return
    }
    const active = demoStage >= 2 && (record.id === 'owner' || record.id === 'invited')
    if (!active) {
      record.el.dataset.empty = 'true'
      if (record.frame.getAttribute('src') !== 'about:blank') record.frame.src = 'about:blank'
      return
    }
    record.el.dataset.empty = 'false'
    /* 镜头 2 要真的重播落座动画：清掉同标签页里“已看过开场”的标记 */
    try { sessionStorage.removeItem('weizhuo:entryCinemaIntro') } catch { /* 隐私模式忽略 */ }
    const step = demoStage === 3 && record.id === 'owner' ? 3 : 2
    record.frame.src = withStamp(`${record.src}&demoStep=${step}`, Date.now())
  }

  function setDemoStage(stage) {
    demoStage = clamp(Number(stage) || 0, 0, 3)
    for (const record of records.values()) {
      if (record.open) applyDemoStage(record)
    }
    return demoStage
  }

  /* ---------- 工具条动作 ---------- */

  function fitAll() {
    const open = [...records.values()].filter(record => record.open)
    if (!open.length) {
      if (notify) notify('没有已打开的画面')
      return
    }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const record of open) {
      minX = Math.min(minX, record.x)
      minY = Math.min(minY, record.y)
      maxX = Math.max(maxX, record.x + record.w)
      maxY = Math.max(maxY, record.y + windowHeight(record))
    }
    const rect = viewport.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const pad = 48
    const boxW = Math.max(1, maxX - minX)
    const boxH = Math.max(1, maxY - minY)
    zoom = clamp(Math.min((rect.width - pad * 2) / boxW, (rect.height - pad * 2) / boxH), ZOOM_MIN, ZOOM_MAX)
    pan.x = (rect.width - boxW * zoom) / 2 - minX * zoom
    pan.y = (rect.height - boxH * zoom) / 2 - minY * zoom
    applyTransform()
    scheduleSave()
  }

  function resetLayout() {
    /* 取消可能还在排队的自动保存，避免重置后立刻又把默认布局写回本地 */
    clearTimeout(saveTimer)
    saveTimer = 0
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* 隐私模式下忽略 */
    }
    zoom = DEFAULT_ZOOM
    pan = { ...DEFAULT_PAN }
    let index = 0
    for (const record of records.values()) {
      const wasOpen = record.open
      record.x = record.x0
      record.y = record.y0
      record.w = record.width0
      record.open = record.open0
      if (record.open !== wasOpen || (record.open && !record.frame.getAttribute('src'))) {
        record.mode = null
        applyRoomMode(record)
      }
      record.z = index + 1
      index += 1
      record.el.classList.remove('is-focused')
      record.rail.classList.remove('is-focused')
      applyWindow(record)
      updateRailState(record)
    }
    nextZ = index + 1
    applyTransform()
    if (notify) notify('已重置画布布局')
  }

  function refreshAll() {
    const stamp = Date.now()
    const lobbyMode = !room
    for (const record of records.values()) {
      record.loaded = false
      record.mode = lobbyMode ? 'lobby' : 'room'
      /* 空房态下除电脑端外都保持空白，不加载任何镜像 */
      if (lobbyMode && record.id !== 'computer') {
        record.el.dataset.empty = 'true'
        const current = record.frame.getAttribute('src')
        if (current && current !== 'about:blank') record.frame.src = 'about:blank'
        continue
      }
      record.el.dataset.empty = 'false'
      /* 收起且从未加载过的画面保持空白，等第一次打开再加载 */
      if (!record.open && !record.frame.getAttribute('src')) continue
      const target = record.id === 'computer' && lobbyMode ? (record.lobbySrc || record.src) : record.src
      record.frame.src = withStamp(target, stamp)
    }
  }

  /* ---------- 指针交互 ---------- */

  function onHeadPointerDown(record, event) {
    if (event.button !== 0) return
    if (event.target && event.target.closest && event.target.closest('.canvas-window-close')) return
    event.preventDefault()
    focusRecord(record, false)
    record.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: record.x,
      y: record.y,
    }
    try {
      record.head.setPointerCapture(event.pointerId)
    } catch {
      /* 指针已释放时忽略 */
    }
    showSizeBadge(record)
  }

  function onHeadPointerMove(record, event) {
    const drag = record.drag
    if (!drag || drag.pointerId !== event.pointerId) return
    record.x = drag.x + (event.clientX - drag.startX) / zoom
    record.y = drag.y + (event.clientY - drag.startY) / zoom
    snapDrag(record)
    applyWindow(record)
    showSizeBadge(record)
  }

  function onHeadPointerUp(record, event) {
    const drag = record.drag
    if (!drag || drag.pointerId !== event.pointerId) return
    record.drag = null
    clearGuides()
    hideSizeBadge()
    try {
      if (record.head.hasPointerCapture(event.pointerId)) record.head.releasePointerCapture(event.pointerId)
    } catch {
      /* 忽略 */
    }
    scheduleSave()
  }

  function onResizePointerDown(record, event) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    focusRecord(record, false)
    record.resize = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startW: record.w,
    }
    try {
      record.resizeEl.setPointerCapture(event.pointerId)
    } catch {
      /* 忽略 */
    }
    showSizeBadge(record)
  }

  function onResizePointerMove(record, event) {
    const resize = record.resize
    if (!resize || resize.pointerId !== event.pointerId) return
    /* 只按横向位移改宽度，高度由宽高比推出；边缘靠近其他窗口/网格时吸附 */
    const width = clamp(resize.startW + (event.clientX - resize.startX) / zoom, WIDTH_MIN, WIDTH_MAX)
    record.w = snapResize(record, width)
    applyWindow(record)
    showSizeBadge(record)
  }

  function onResizePointerUp(record, event) {
    const resize = record.resize
    if (!resize || resize.pointerId !== event.pointerId) return
    record.resize = null
    clearGuides()
    hideSizeBadge()
    try {
      if (record.resizeEl.hasPointerCapture(event.pointerId)) record.resizeEl.releasePointerCapture(event.pointerId)
    } catch {
      /* 忽略 */
    }
    scheduleSave()
  }

  /* 触屏手势：只从画布空白处起手。单指拖动=平移；双指=捏合缩放，同时按两指中点平移。 */
  function beginTouchGesture() {
    if (touchPoints.size < 2) return
    const [a, b] = [...touchPoints.values()]
    const rect = viewport.getBoundingClientRect()
    const cx = (a.x + b.x) / 2 - rect.left
    const cy = (a.y + b.y) / 2 - rect.top
    touchGesture = {
      startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      startZoom: zoom,
      worldX: (cx - pan.x) / zoom,
      worldY: (cy - pan.y) / zoom,
    }
  }

  function updateTouchGesture() {
    if (!touchGesture || touchPoints.size < 2) return
    const [a, b] = [...touchPoints.values()]
    const rect = viewport.getBoundingClientRect()
    const cx = (a.x + b.x) / 2 - rect.left
    const cy = (a.y + b.y) / 2 - rect.top
    const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
    zoom = clamp(touchGesture.startZoom * (dist / touchGesture.startDist), ZOOM_MIN, ZOOM_MAX)
    pan.x = cx - touchGesture.worldX * zoom
    pan.y = cy - touchGesture.worldY * zoom
    applyTransform()
  }

  function onTouchDown(event) {
    if (event.pointerType !== 'touch') return false
    const target = event.target
    if (!(target instanceof Element) || target.closest('.canvas-toolbar')) return true
    /* 只在画布空白处起手，窗口标题栏和画面内部保留原有交互 */
    if (target !== viewport && target !== world) return true
    event.preventDefault()
    touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY })
    try {
      viewport.setPointerCapture(event.pointerId)
    } catch {
      /* 合成事件或浏览器拒绝时忽略 */
    }
    if (touchPoints.size >= 2) {
      touchPan = null
      beginTouchGesture()
    } else {
      touchPan = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
    }
    viewport.classList.add('is-panning')
    return true
  }

  function onTouchMove(event) {
    if (event.pointerType !== 'touch' || !touchPoints.has(event.pointerId)) return false
    event.preventDefault()
    touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (touchPoints.size >= 2) {
      updateTouchGesture()
      return true
    }
    if (touchPan && touchPan.id === event.pointerId) {
      pan.x = touchPan.panX + (event.clientX - touchPan.x)
      pan.y = touchPan.panY + (event.clientY - touchPan.y)
      applyTransform()
    }
    return true
  }

  function onTouchEnd(event) {
    if (event.pointerType !== 'touch' || !touchPoints.has(event.pointerId)) return false
    touchPoints.delete(event.pointerId)
    if (touchPoints.size < 2) touchGesture = null
    if (touchPoints.size === 0) {
      touchPan = null
      viewport.classList.remove('is-panning')
      scheduleSave()
    }
    try {
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId)
    } catch {
      /* 忽略 */
    }
    return true
  }

  /* 左键只从空白处起拖；中键可在任意非 iframe、非工具条区域起拖 */
  function onViewportPointerDown(event) {
    if (onTouchDown(event)) return
    if (event.button !== 0 && event.button !== 1) return
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('.canvas-toolbar')) return
    if (event.button === 0) {
      if (target !== viewport && target !== world) return
    } else if (target.closest('iframe')) {
      return
    }
    event.preventDefault()
    panDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    }
    try {
      viewport.setPointerCapture(event.pointerId)
    } catch {
      /* 忽略 */
    }
    viewport.classList.add('is-panning')
  }

  function onViewportPointerMove(event) {
    if (onTouchMove(event)) return
    if (!panDrag || panDrag.pointerId !== event.pointerId) return
    pan.x = panDrag.panX + (event.clientX - panDrag.startX)
    pan.y = panDrag.panY + (event.clientY - panDrag.startY)
    applyTransform()
  }

  function onPanEnd(event) {
    if (onTouchEnd(event)) return
    if (!panDrag || panDrag.pointerId !== event.pointerId) return
    panDrag = null
    viewport.classList.remove('is-panning')
    try {
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId)
    } catch {
      /* 忽略 */
    }
    scheduleSave()
  }

  function onWheel(event) {
    const target = event.target
    if (!(target instanceof Element) || target.closest('.canvas-toolbar')) return
    if (event.ctrlKey || event.metaKey) {
      /* 触控板捏合 / Ctrl+滚轮：以鼠标位置为锚点缩放 */
      event.preventDefault()
      const rect = viewport.getBoundingClientRect()
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12
      setZoom(zoom * factor, event.clientX - rect.left, event.clientY - rect.top)
      return
    }
    /* 只有画布空白处的滚轮才平移画布；窗口/画面内部的滚轮交给画面自己滚动 */
    if (target !== viewport && target !== world) return
    event.preventDefault()
    pan.x -= event.deltaX
    pan.y -= event.deltaY
    applyTransform()
    scheduleSave()
  }

  function onAuxClick(event) {
    if (event.button === 1) event.preventDefault()
  }

  /* ---------- 构建列表与窗口 ---------- */

  function createRailItem(record) {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'canvas-rail-item'
    item.dataset.canvasWindowId = record.id
    item.title = `定位到${record.label}`

    const thumb = document.createElement('span')
    thumb.className = 'canvas-rail-thumb'
    thumb.setAttribute('aria-hidden', 'true')
    thumb.dataset.shape = record.aspect >= 1 ? 'landscape' : 'portrait'
    thumb.style.display = 'block'
    /* 宽高比由数据决定，宽度等外观交给 style.css */
    thumb.style.aspectRatio = String(record.aspect)

    const text = document.createElement('span')
    text.className = 'canvas-rail-text'
    const name = document.createElement('span')
    name.className = 'canvas-rail-name'
    name.textContent = record.label
    const state = document.createElement('span')
    state.className = 'canvas-rail-state'
    text.append(name, state)

    item.append(thumb, text)
    listen(item, 'click', () => handleRailClick(record))

    record.rail = item
    record.thumb = thumb
    record.stateEl = state
    railList.append(item)
  }

  function createWindowNodes(record) {
    const el = document.createElement('div')
    el.className = 'canvas-window'
    el.dataset.windowId = record.id
    el.style.position = 'absolute'
    el.style.display = 'flex'
    el.style.flexDirection = 'column'

    const head = document.createElement('header')
    head.className = 'canvas-window-head'
    head.style.flex = '0 0 auto'
    head.style.touchAction = 'none'
    head.title = '拖动移动画面；双击放大到原始尺寸'

    const title = document.createElement('strong')
    title.className = 'canvas-window-title'
    title.textContent = record.label

    const roomEl = document.createElement('span')
    roomEl.className = 'canvas-window-room'
    roomEl.textContent = room || ROOM_PENDING

    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'canvas-window-close'
    close.setAttribute('aria-label', `关闭${record.label}`)
    close.textContent = '×'

    head.append(title, roomEl, close)

    /* 画面内容固定按设计尺寸渲染，外层窗口只做等比缩放，避免改大改小时重排或裁切 */
    const body = document.createElement('div')
    body.className = 'canvas-window-body'

    const frame = document.createElement('iframe')
    frame.title = record.label
    frame.setAttribute('allow', 'fullscreen; screen-orientation')
    frame.style.position = 'absolute'
    frame.style.top = '0'
    frame.style.left = '0'
    frame.style.width = `${record.designW}px`
    frame.style.height = `${record.designH}px`
    frame.style.border = '0'
    frame.style.display = 'block'
    frame.style.background = record.aspect < 1 ? '#e8e6df' : '#0c0b09'
    frame.style.transformOrigin = 'top left'
    /* 画布只展示、不操作：iframe 不可聚焦、不接收指针事件 */
    frame.tabIndex = -1
    frame.setAttribute('inert', '')
    frame.style.pointerEvents = 'none'
    /* 先挂 load 监听，再由 applyRoomMode 按“大厅/房间”决定是否真正加载 */
    listen(frame, 'load', () => {
      record.loaded = true
      postRoom(record)
    })

    /* 画面留白占位：大厅态没有房间时，除电脑端外都不加载镜像 */
    const empty = document.createElement('div')
    empty.className = 'canvas-window-empty'
    empty.setAttribute('aria-hidden', 'true')
    empty.innerHTML = '<span>大厅 · 等待房间创建</span>'

    const lock = document.createElement('div')
    lock.className = 'canvas-window-lock'
    lock.setAttribute('aria-hidden', 'true')
    lock.innerHTML = '<span>只读镜像</span>'
    body.append(frame, empty, lock)

    const resizeEl = document.createElement('span')
    resizeEl.className = 'canvas-window-resize'
    resizeEl.setAttribute('role', 'separator')
    resizeEl.setAttribute('aria-hidden', 'true')
    resizeEl.style.touchAction = 'none'

    el.append(head, body, resizeEl)

    record.el = el
    record.head = head
    record.roomEl = roomEl
    record.body = body
    record.frame = frame
    record.emptyEl = empty
    record.resizeEl = resizeEl

    /* 初始按当前房号决定：空房只有电脑端加载大厅扫码页 */
    record.mode = null
    applyRoomMode(record)

    listen(head, 'pointerdown', event => onHeadPointerDown(record, event))
    listen(head, 'pointermove', event => onHeadPointerMove(record, event))
    listen(head, 'pointerup', event => onHeadPointerUp(record, event))
    listen(head, 'pointercancel', event => onHeadPointerUp(record, event))
    /* 双击标题栏：在默认宽度与原始设计宽度之间切换，方便把主持端放大到 1:1 */
    listen(head, 'dblclick', () => {
      record.w = clamp(record.w < record.designW * .95 ? record.designW : (record.width0 || record.designW), WIDTH_MIN, WIDTH_MAX)
      applyWindow(record)
      scheduleSave()
    })
    listen(close, 'pointerdown', event => event.stopPropagation())
    listen(close, 'click', event => {
      event.stopPropagation()
      closeRecord(record)
    })
    listen(resizeEl, 'pointerdown', event => onResizePointerDown(record, event))
    listen(resizeEl, 'pointermove', event => onResizePointerMove(record, event))
    listen(resizeEl, 'pointerup', event => onResizePointerUp(record, event))
    listen(resizeEl, 'pointercancel', event => onResizePointerUp(record, event))

    applyWindow(record)
    world.append(el)
  }

  /* 清掉上一次初始化留下的自有节点，避免重复 */
  railList.querySelectorAll('[data-canvas-window-id]').forEach(node => node.remove())
  world.querySelectorAll('[data-canvas-window-id]').forEach(node => node.remove())

  for (const [index, def] of WINDOW_DEFS.entries()) {
    const state = windowStateFromSaved(def, saved, index)
    const record = {
      ...def,
      ...state,
      x0: def.x,
      y0: def.y,
      width0: def.width,
      open0: def.open !== false,
      /* 画面的虚拟设计尺寸：窗口改大改小只缩放这张“画面”，不让页面重新排版或被裁切 */
      designW: def.designW || def.width,
      designH: (def.designW || def.width) / def.aspect,
      loaded: false,
      drag: null,
      resize: null,
    }
    createRailItem(record)
    createWindowNodes(record)
    updateRailState(record)
    records.set(def.id, record)
    nextZ = Math.max(nextZ, record.z + 1)
  }

  world.style.transformOrigin = '0 0'
  createHud()
  applyTransform()
  updateRoomLabels()
  listen(window, 'resize', scheduleRuler)

  /* 视口与工具条事件统一在这里挂 */
  listen(viewport, 'pointerdown', onViewportPointerDown)
  listen(viewport, 'pointermove', onViewportPointerMove)
  listen(viewport, 'pointerup', onPanEnd)
  listen(viewport, 'pointercancel', onPanEnd)
  listen(viewport, 'wheel', onWheel, { passive: false })
  listen(viewport, 'auxclick', onAuxClick)

  const fitButton = document.querySelector('#canvas-fit')
  const resetButton = document.querySelector('#canvas-reset-layout')
  const reloadButton = document.querySelector('#canvas-reload')
  const zoomOutButton = document.querySelector('#canvas-zoom-out')
  const zoomInButton = document.querySelector('#canvas-zoom-in')

  listen(fitButton, 'click', fitAll)
  listen(resetButton, 'click', resetLayout)
  listen(reloadButton, 'click', () => {
    const ok = typeof window.confirm !== 'function'
      || window.confirm('重载会重新加载四个画面，画面内的当前状态会重置。确认重载？')
    if (!ok) return
    refreshAll()
    if (notify) notify('已重载全部画面')
  })
  listen(zoomOutButton, 'click', () => zoomFromCenter(1 / ZOOM_STEP))
  listen(zoomInButton, 'click', () => zoomFromCenter(ZOOM_STEP))

  listen(window, 'beforeunload', writeLayout)

  /* ---------- 对外接口 ---------- */

  function focusById(id) {
    const record = records.get(id)
    if (!record) return false
    openRecord(record)
    const moved = ensureVisible(record)
    focusRecord(record, !moved)
    return true
  }

  function snapshot() {
    return {
      room,
      zoom: roundTo(zoom, 3),
      pan: { x: roundTo(pan.x), y: roundTo(pan.y) },
      windows: [...records.values()].map(record => ({
        id: record.id,
        open: record.open,
        x: roundTo(record.x),
        y: roundTo(record.y),
        w: roundTo(record.w),
        h: roundTo(windowHeight(record)),
        z: record.z,
      })),
    }
  }

  function destroy() {
    if (destroyed) return
    destroyed = true
    clearTimeout(saveTimer)
    for (const [target, type, handler, opts] of listeners) {
      target.removeEventListener(type, handler, opts)
    }
    listeners.length = 0
    panDrag = null
    touchPoints.clear()
    touchPan = null
    touchGesture = null
    for (const record of records.values()) {
      record.el.remove()
      record.rail.remove()
    }
    records.clear()
    if (rulerFrame) cancelAnimationFrame(rulerFrame)
    rulerFrame = 0
    rulerCanvas?.remove()
    scaleEl?.remove()
    guideXEl?.remove()
    guideYEl?.remove()
    sizeBadgeEl?.remove()
    rulerCanvas = null
    scaleEl = null
    guideXEl = null
    guideYEl = null
    sizeBadgeEl = null
    world.style.transform = ''
    world.style.transformOrigin = ''
    viewport.classList.remove('is-panning')
    if (window.weizhuoCanvasBoard === board) delete window.weizhuoCanvasBoard
  }

  const board = {
    setRoom,
    demo: setDemoStage,
    focus: focusById,
    refreshAll,
    snapshot,
    destroy,
  }

  window.weizhuoCanvasBoard = board
  return board
}






















