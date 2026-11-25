/* animation-lab-20261121 */
/* animation-lab-done */
import * as THREE from '../舞台原型/node_modules/three/build/three.module.js'

export function createStageViews({ camera, renderer, container, dolls, getPlayer, getRole, notify }) {
  const theatre = container.closest('.theatre')
  const canvas = renderer.domElement
  const buttons = [...theatre.querySelectorAll('[data-view]')]
  const orientationButton = theatre.querySelector('[data-view="orientation"]')
  const cameraButtons = [...theatre.querySelectorAll('[data-view="first"], [data-view="god"]')]
  const seatControl = document.querySelector('#seat-control')
  const seatSelect = document.querySelector('#view-seat')
  const exitButton = document.querySelector('#exit-immersive')
  const resetButton = document.querySelector('#reset-view')
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  const direction = new THREE.Vector3()
  const position = new THREE.Vector3()
  const target = new THREE.Vector3()
  const lookTarget = new THREE.Vector3(0, .8, 0)
  const spherical = new THREE.Spherical()
  const up = new THREE.Vector3(0, 1, 0)
  const pointers = new Map()
  let mode = 'god'
  let immersiveOrientation = null
  let immersive = false
  let nativeFullscreen = false
  let fullscreenPending = false
  let fullscreenOwnedByStage = false
  let yaw = 0
  let pitch = 0
  let zoom = 1
  let floorOffset = 0
  let labCamera = null
  let seat = getRole()
  let currentPlayer = getPlayer()
  let currentRole = getRole()
  let dragDistance = 0
  let pinchDistance = null
  let multiTouch = false
  let controlsTimer
  // zoom 是统一视野系数：数值越小视野越窄（拉近、物体变大），越大视野越宽（拉远、物体变小）。
  const ZOOM_MIN = .65
  const ZOOM_MAX = 1.6

  function refreshControls() {
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === mode)))
    if (orientationButton) {
      // 图标表示“下一步切到哪个方向”：横放的手机 = 当前竖屏、可切横屏。
      const portraitNow = immersiveOrientation === 'portrait'
      orientationButton.innerHTML = portraitNow
        ? '<span class="orientation-label">横屏</span>'
        : '<span class="orientation-label">竖屏</span>'
      orientationButton.setAttribute('aria-label', portraitNow ? '横屏入席' : '竖屏入席')
      orientationButton.title = orientationButton.getAttribute('aria-label')
    }
    cameraButtons.forEach(button => {
      button.hidden = !immersive
      button.textContent = button.dataset.view === 'first' ? '◉' : '⊙'
      button.setAttribute('aria-label', button.dataset.view === 'first' ? '第一人称' : '上帝视角')
      button.title = button.getAttribute('aria-label')
    })
    seatControl.hidden = mode !== 'first'
    seatSelect.value = String(seat)
    // 方向切换只保留工具坞中的一个按钮，避免与旧的退出按钮重复。
    exitButton.hidden = true
    theatre.dataset.cameraMode = mode
    theatre.dataset.immersive = String(immersive)
    canvas.setAttribute('aria-label', mode === 'first' ? `${seatSelect.selectedOptions[0].textContent}座位的第一人称舞台，可拖动环视` : '五人木偶剧场，可拖动环视和缩放')
  }

  function showControls() {
    clearTimeout(controlsTimer)
    theatre.classList.remove('controls-hidden')
    controlsTimer = setTimeout(() => {
      // 面板正开着就再等一会儿，别把用户正在看的资料一起藏掉。
      if (theatre.querySelector('.stage-drawer:not([hidden])')) return
      theatre.querySelectorAll('.stage-dock').forEach(dock => {
        if (dock.contains(document.activeElement)) document.activeElement.blur()
      })
      theatre.classList.add('controls-hidden')
      theatre.dispatchEvent(new CustomEvent('stage-idle'))
    }, 2200)
  }

  function resetView() {
    yaw = 0
    pitch = 0
    zoom = 1
    showControls()
  }

  function setMode(nextMode) {
    mode = nextMode
    resetView()
    refreshControls()
  }

  function setImmersive(enabled, orientation = null) {
    immersive = enabled
    immersiveOrientation = enabled ? orientation : null
    document.body.classList.toggle('stage-immersive', enabled)
    theatre.dataset.immersiveOrientation = enabled ? orientation : ''
    if (!enabled) {
      clearTimeout(controlsTimer)
      theatre.classList.remove('controls-hidden')
    }
    refreshControls()
    if (enabled) showControls()
  }

  async function enterImmersive(orientation = 'landscape') {
    // 竖屏入席是围桌俯视，横屏入席才是第一人称。之前两者都用 first，
    // 结果竖屏一进去就贴在木偶脸上，看不到五席。
    setMode(orientation === 'portrait' ? 'portrait' : 'first')
    setImmersive(true, orientation)
    // 玩家进入房间的默认状态是手机竖屏舞台。竖屏不请求原生全屏，
    // 避免部分移动浏览器把全屏手势解释成横屏布局。
    if (orientation === 'portrait') {
      fullscreenPending = false
      // 竖屏入席不请求原生全屏，但尝试在用户手势里锁一次竖屏；
      // 支持的小米/安卓浏览器会因此在后续全屏时保持竖屏。
      try { await screen.orientation?.lock?.('portrait') } catch { /* 不支持就按当前方向 */ }
      return
    }
    if (fullscreenPending) return
    fullscreenPending = true
    try {
      if (theatre.requestFullscreen && document.fullscreenElement !== theatre) {
        fullscreenOwnedByStage = true
        await theatre.requestFullscreen()
        nativeFullscreen = document.fullscreenElement === theatre
      }
      if (!immersive) {
        if (document.fullscreenElement === theatre) await document.exitFullscreen()
        return
      }
      if (orientation === 'landscape' && nativeFullscreen && screen.orientation?.lock) {
        try { await screen.orientation.lock('landscape') }
        catch { if (innerHeight > innerWidth) notify('请将手机横放，页面会自动适配。') }
      } else if (orientation === 'landscape' && innerHeight > innerWidth) notify('请将手机横放，页面会自动适配。')
    } catch {
      fullscreenOwnedByStage = false
      if (immersive) notify('已进入页面沉浸模式，手机可横放查看。')
    } finally {
      fullscreenPending = false
    }
  }

  async function exitImmersive() {
    setImmersive(false)
    fullscreenOwnedByStage = false
    screen.orientation?.unlock?.()
    if (document.fullscreenElement === theatre) {
      try { await document.exitFullscreen() }
      catch { notify('可按 Esc 退出浏览器全屏。') }
    }
    nativeFullscreen = false
    setMode('god')
  }

  function handleFullscreenChange() {
    if (document.fullscreenElement === theatre) nativeFullscreen = true
    else if (nativeFullscreen) {
      nativeFullscreen = false
      screen.orientation?.unlock?.()
      // 只有 enterImmersive 发起的全屏，退出时才回到上帝视角；
      // 设置里的“全屏”按钮只负责放大舞台，退出后保持当前视角。
      if (fullscreenOwnedByStage) {
        fullscreenOwnedByStage = false
        setImmersive(false)
        setMode('god')
      }
    }
  }

  function syncPhysicalOrientation() {
    if (!immersive) return
    // 竖屏入席由入口明确指定，保持手机构图，不能被 viewport 的瞬时变化改成横屏。
    if (immersiveOrientation === 'portrait') return
    const orientation = screen.orientation?.type
      ? screen.orientation.type.startsWith('landscape') ? 'landscape' : 'portrait'
      : innerWidth > innerHeight ? 'landscape' : 'portrait'
    if (orientation === immersiveOrientation) return
    immersiveOrientation = orientation
    theatre.dataset.immersiveOrientation = orientation
    if (orientation === 'portrait' && mode !== 'portrait') setMode('portrait')
    else if (orientation === 'landscape' && mode === 'portrait') setMode('first')
    refreshControls()
  }

  function handleKey(event) {
    if (event.key === 'Escape' && immersive) exitImmersive()
    if (event.target !== canvas) return
    if (event.key === 'ArrowLeft') yaw += .12
    else if (event.key === 'ArrowRight') yaw -= .12
    else if (event.key === 'ArrowUp') pitch += .08
    else if (event.key === 'ArrowDown') pitch -= .08
    else return
    pitch = THREE.MathUtils.clamp(pitch, -.65, .65)
    event.preventDefault()
  }

  function handleViewClick(event) {
    const button = event.target.closest('[data-view]')
    if (!button) return
    if (button.dataset.view === 'orientation') enterImmersive(immersiveOrientation === 'portrait' ? 'landscape' : 'portrait')
    else setMode(button.dataset.view)
  }

  function handleOrientationButton() {
    enterImmersive(immersiveOrientation === 'portrait' ? 'landscape' : 'portrait')
  }

  function handleSeatChange() {
    seat = Number(seatSelect.value)
    resetView()
    refreshControls()
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    canvas.setPointerCapture(event.pointerId)
    if (pointers.size === 0) { dragDistance = 0; multiTouch = false }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size > 1) multiTouch = true
    pinchDistance = null
  }

  function handlePointerMove(event) {
    const previous = pointers.get(event.pointerId)
    if (!previous) return
    const dx = event.clientX - previous.x
    const dy = event.clientY - previous.y
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    dragDistance += Math.abs(dx) + Math.abs(dy)
    if (pointers.size === 2) {
      const [first, second] = [...pointers.values()]
      const distance = Math.hypot(first.x - second.x, first.y - second.y)
      // 双指向外张开（distance 变大）时比值 < 1，zoom 变小 -> 拉近；
      // 双指向内收拢（distance 变小）时比值 > 1，zoom 变大 -> 拉远。
      // 旧代码把 zoom 锁在 1~1.5，张开那半边被下限吃掉，只剩收拢生效，手感正好相反。
      // 缩放只改注视点到相机的距离，注视点本身不动，因此以当前注视点为轴、不会平移跳变。
      if (pinchDistance !== null && distance > 0) {
        zoom = THREE.MathUtils.clamp(zoom * (pinchDistance / distance), ZOOM_MIN, ZOOM_MAX)
      }
      pinchDistance = distance
      return
    }
    yaw -= dx * .005
    pitch = THREE.MathUtils.clamp(pitch + dy * .004, -.65, .65)
  }

  function handlePointerEnd(event) {
    if (!pointers.has(event.pointerId)) return
    pointers.delete(event.pointerId)
    pinchDistance = null
    if (immersive && pointers.size === 0 && dragDistance < 8 && !multiTouch && event.type === 'pointerup') showControls()
  }

  function handleWheel(event) {
    event.preventDefault()
    // 与双指同一语义：向前滚/捏合张开 = zoom 变小 = 拉近，向后滚 = 拉远。
    zoom = THREE.MathUtils.clamp(zoom * Math.exp(event.deltaY * .001), ZOOM_MIN, ZOOM_MAX)
  }

  function update(delta) {
    if (currentPlayer !== getPlayer() || currentRole !== getRole()) {
      currentPlayer = getPlayer()
      currentRole = getRole()
      seat = currentRole
      resetView()
      refreshControls()
    }
    const firstPersonMode = labCamera ? labCamera.camera === 'first' : ['first', 'landscape'].includes(mode)
    if (!labCamera) dolls.forEach((item, index) => { item.doll.visible = !firstPersonMode || index !== seat })
    if (labCamera) {
      // 动画实验室接管相机：公共视角沿用 portrait/god 的构图，只叠加降低视角与推近。
      // 第一人称：
      // - follow：跟随自己当前座位旋转，邻席始终保持 72°，不会贴脸；
      // - fixed：机位固定在初始席位方向，但退到席位圈外；
      // - back：在圈外基础上再叠加后撤距离。
      if (firstPersonMode) {
      const anchor = labCamera.anchor === 'follow' ? 'follow' : labCamera.anchor === 'fixed' ? 'fixed' : labCamera.anchor === 'strict' ? 'strict' : 'back'
        const base = anchor === 'follow'
          ? dolls[labCamera.seat].seat.position
          : labCamera.fixedEye || dolls[labCamera.seat].seat.position
        const baseX = base.x ?? 0
        const baseZ = base.z ?? 0
        const outward = new THREE.Vector3(baseX, 0, baseZ)
        if (outward.lengthSq() === 0) outward.set(0, 0, -1)
        outward.normalize()
        const eyeHeight = THREE.MathUtils.clamp(Number(labCamera.eyeHeight) || 1.68, 1.2, 2.4)
        // 严格固定不后退：相机保持在席位原位。贴身角色在 applyDollVisibility 中整只隐藏，
        // 只保留椅子作为近景遮挡，避免镜头进入头部/手臂。
        const effectiveEyeHeight = eyeHeight
        const backOffset = THREE.MathUtils.clamp(Number(labCamera.backOffset) || 0, 0, .5)
        // 严格固定（strict）就是原位机位，不做 1.25 圈外保底；允许邻席擦镜头。
        const ringClearance = anchor === 'follow' || anchor === 'strict' ? 0 : 1.25
        const extraBack = anchor === 'follow' || anchor === 'back' ? backOffset : 0
        const offset = ringClearance + extraBack
        position.set(baseX + outward.x * offset, effectiveEyeHeight, baseZ + outward.z * offset)
        target.set(0, 1.05, 0)
      } else {
        const portrait = labCamera.camera === 'portrait'
        const lower = THREE.MathUtils.clamp(Number(labCamera.lower) || 0, 0, 1)
        const push = THREE.MathUtils.clamp(Number(labCamera.push) || 0, 0, 1)
        target.set(0, (portrait ? 3.6 : .8) - floorOffset - lower * .9, 0)
        direction.copy(portrait ? new THREE.Vector3(0, 6.4, 8.6) : new THREE.Vector3(0, 12.6, 9.4))
        direction.y *= 1 - lower * .42
        if (labCamera.speakerPoint) {
          target.x += labCamera.speakerPoint.x * .10 * push
          target.z += labCamera.speakerPoint.z * .10 * push
        }
        spherical.setFromVector3(direction)
        spherical.theta += yaw
        spherical.phi = THREE.MathUtils.clamp(spherical.phi - pitch, .12, 1.35)
        spherical.radius *= Math.max(1, .95 / camera.aspect) * zoom * (1 - push * .16)
        position.copy(target).add(direction.setFromSpherical(spherical))
      }
    } else if (firstPersonMode) {
      // 第一人称＝从木偶的眼睛往外看：眼高 1.63（头部 1.40–1.90 的中间偏上），
      // 再沿面朝方向前移 0.18 到脸前，避免机位落在头套内部。
      const seatPos = dolls[seat].seat.position
      const eyeScale = dolls[seat]?.seat.scale.y || 1
      const forward = new THREE.Vector3(-seatPos.x, 0, -seatPos.z).normalize()
      position.copy(seatPos).add(new THREE.Vector3(0, 1.63 * eyeScale, 0)).addScaledVector(forward, .18 * eyeScale)
      direction.copy(new THREE.Vector3(0, 1.42, 0)).sub(position).normalize()
      spherical.setFromVector3(direction)
      spherical.theta += yaw
      spherical.phi = THREE.MathUtils.clamp(spherical.phi - pitch, .18, Math.PI - .18)
      direction.setFromSpherical(spherical)
      target.copy(position).addScaledVector(direction, 4)
    } else {
      // 竖屏入席为手机构图：注视点抬到桌面上方 3.6，机位同步收近，
      // 让五席桌面整体下移到画面下方，桌面近沿落在约 2/3 高处，底部由地板补满。
      target.set(0, mode === 'portrait' ? 3.6 - floorOffset : .8, 0)
      direction.copy(mode === 'portrait' ? new THREE.Vector3(0, 6.4, 8.6) : mode === 'god' ? new THREE.Vector3(0, 12.6, 9.4) : new THREE.Vector3(0, 3.6, 10.8))
      spherical.setFromVector3(direction)
      spherical.theta += yaw
      spherical.phi = THREE.MathUtils.clamp(spherical.phi - pitch, .12, 1.35)
      // zoom 与视野同向：zoom 越小半径越小（拉近），越大半径越大（拉远）。
      // 另按画布宽高比补一次距离，窄幅竖屏也能保证五席横向完整入画。
      spherical.radius *= Math.max(1, .95 / camera.aspect) * zoom
      position.copy(target).add(direction.setFromSpherical(spherical))
    }
    const blend = reducedMotion.matches ? 1 : 1 - Math.exp(-Math.max(delta, .001) * 8)
    // 实验室“随席旋转”必须严格跟住席位：任何 lerp 滞后都会让邻席擦过镜头形成大脸。
    const labFollow = Boolean(labCamera && labCamera.camera === 'first' && labCamera.anchor === 'follow')
    if (labFollow) {
      camera.position.copy(position)
      lookTarget.copy(target)
    } else {
      camera.position.lerp(position, blend)
      lookTarget.lerp(target, blend)
    }
    camera.up.copy(up)
    camera.lookAt(lookTarget)
    // 第一人称同样以 zoom 为视野系数：zoom 小 -> fov 小 -> 更近；zoom 大 -> fov 大 -> 更远。
    // 实验室第一人称改由面板 FOV 控制；自己发言的“推近”改为轻微收窄 FOV，不再移动相机。
    const labPush = labCamera && labCamera.camera === 'first' && labCamera.anchor === 'follow'
      ? THREE.MathUtils.clamp(Number(labCamera.push) || 0, 0, 1) : 0
    const desiredFov = firstPersonMode
      ? labCamera && Number(labCamera.fov)
        ? THREE.MathUtils.clamp(Number(labCamera.fov) - labPush * 8, 55, 85)
        : THREE.MathUtils.clamp(78 * zoom, 52, 96)
      : 43
    camera.fov = labFollow ? desiredFov : THREE.MathUtils.lerp(camera.fov, desiredFov, blend)
    camera.near = firstPersonMode ? .035 : .1
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  }

  canvas.tabIndex = 0
  theatre.addEventListener('click', handleViewClick)
  theatre.addEventListener('click', () => showControls())
  // 电脑端统一规则：鼠标不动一会儿所有浮层自动淡出，鼠标一动立刻回来。
  let lastControlsMove = 0
  theatre.addEventListener('pointermove', () => {
    const now = performance.now()
    if (now - lastControlsMove < 180) return
    lastControlsMove = now
    showControls()
  })
  showControls()
  seatSelect.addEventListener('change', handleSeatChange)
  resetButton.addEventListener('click', resetView)
  exitButton.addEventListener('click', handleOrientationButton)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  screen.orientation?.addEventListener?.('change', syncPhysicalOrientation)
  window.addEventListener('orientationchange', syncPhysicalOrientation)
  document.addEventListener('keydown', handleKey)
  canvas.addEventListener('pointerdown', handlePointerDown)
  canvas.addEventListener('pointerdown', () => { if (immersive) showControls() })
  canvas.addEventListener('pointermove', handlePointerMove)
  canvas.addEventListener('pointerup', handlePointerEnd)
  canvas.addEventListener('pointercancel', handlePointerEnd)
  canvas.addEventListener('lostpointercapture', handlePointerEnd)
  canvas.addEventListener('wheel', handleWheel, { passive: false })
  refreshControls()

  window.stageViewSnapshot = () => ({
    mode, immersive, immersiveOrientation, seat, yaw, pitch, zoom,
    fov: camera.fov,
    position: camera.position.toArray(),
    target: lookTarget.toArray(),
    seatPosition: dolls[seat].seat.position.toArray(),
    seatPositions: dolls.map(item => item.seat.position.toArray()),
    seatRotations: dolls.map(item => item.seat.rotation.y),
    dollOffsets: dolls.map(item => item.doll.position.toArray()),
    dollRotations: dolls.map(item => item.doll.rotation.y),
    visiblePuppets: dolls.map(item => item.doll.visible),
    chairPositions: dolls.map(item => item.chair.position.toArray()),
    visibleChairs: dolls.map(item => item.chair.visible),
    aspect: camera.aspect,
  })

  function setFloorOffset(value) {
    floorOffset = THREE.MathUtils.clamp(Number(value) || 0, -1.2, 1.2)
  }

  // 动画实验室专用：传入相机接管参数，传 null 交回原有的 portrait/first/god 逻辑。
  function setLabCamera(next) {
    labCamera = next || null
  }

  function isFirstPerson() {
    return labCamera ? labCamera.camera === 'first' : ['first', 'landscape'].includes(mode)
  }

  function dispose() {
    clearTimeout(controlsTimer)
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
    screen.orientation?.removeEventListener?.('change', syncPhysicalOrientation)
    window.removeEventListener('orientationchange', syncPhysicalOrientation)
    document.removeEventListener('keydown', handleKey)
    delete window.stageViewSnapshot
  }

  return { update, dispose, setMode, enterImmersive, exitImmersive, setFloorOffset, setLabCamera, isFirstPerson, getMode: () => mode }
}

// ===== 舞台动画实验室引擎（原 stage-lab.js，合并进白名单文件以便 5189 直接刷新） =====
const TAU = Math.PI * 2
const EASINGS = {
  linear: value => value,
  easeInOutCubic: value => value < .5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2,
  easeOutCubic: value => 1 - Math.pow(1 - value, 3),
  easeInOutQuint: value => value < .5 ? 16 * value ** 5 : 1 - Math.pow(-2 * value + 2, 5) / 2,
}

const LAB_DEFAULT_CONFIG = {
  turns: 2,
  duration: 3,
  shortDuration: 1,
  easing: 'easeInOutCubic',
  direction: 1,
  anchor: 'speaker',
  alignOffset: 36,
  view: 'god',
  speaker: null,
  seatBack: false,
  backAmount: .1,
  lowerView: false,
  lowerAmount: .45,
  spotlight: false,
  pushIn: false,
  pushAmount: .45,
  holdOn: true,
  hold: .4,
  firstAnchor: 'follow',
  strictGuard: true,
  eyeHeight: 1.68,
  backOffset: .1,
  fov: 72,
  viewSeat: null,
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function createStageLab({
  dolls, spotlights, views,
  layoutRing, getSeatWorld, getDollSeatIndex, getOwnRole,
  onChange,
}) {
  const state = {
    active: false,
    playing: false,
    paused: false,
    finished: false,
    loop: false,
    timeScale: 1,
    step: 'idle',
    angle: 0,
    backAmount: 0,
    lower: 0,
    push: 0,
    spot: 0,
    config: { ...LAB_DEFAULT_CONFIG },
  }
  let segments = []
  let elapsed = 0
  let totalDuration = 0
  let startedAt = 0
  let fixedEye = null
  let previousMode = 'god'
  const listeners = new Set()
  if (typeof onChange === 'function') listeners.add(onChange)

  function subscribe(listener) {
    if (typeof listener === 'function') listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function emit() {
    listeners.forEach(listener => { try { listener(snapshot()) } catch { /* 界面回调不影响动画 */ } })
  }

  function ownRole() {
    return getOwnRole()
  }

  function speakerRole() {
    return Number.isInteger(state.config.speaker) ? state.config.speaker : ownRole()
  }

  function speakerSeat() {
    return getDollSeatIndex(speakerRole())
  }

  function cameraSeat() {
    const seat = Number(state.config.viewSeat)
    return Number.isInteger(seat) && seat >= 0 && seat < 5 ? seat : getDollSeatIndex(ownRole())
  }

  function cameraRole() {
    const seat = cameraSeat()
    const role = dolls.findIndex((item, index) => getDollSeatIndex(index) === seat)
    return role === -1 ? ownRole() : role
  }

  function captureFixedEye() {
    const world = getSeatWorld(cameraSeat(), state.angle)
    const length = Math.hypot(world.x, world.z) || 1
    fixedEye = { x: world.x, z: world.z, outX: world.x / length, outZ: world.z / length }
  }

  function applyDollVisibility() {
    const first = state.config.view === 'first-self' || state.config.view === 'first-other'
    const role = cameraRole()
    const seat = cameraSeat()
    const hiddenRoles = new Set([role])
    const nearSeats = new Set()
    // 严格固定默认防穿模：1.0 米内角色整只隐藏。关闭后恢复原始固定，允许遮挡/穿模。
    const guard = state.config.firstAnchor !== 'strict' || state.config.strictGuard !== false
    if (first && state.config.firstAnchor !== 'follow' && fixedEye && guard) {
      dolls.forEach((item, index) => {
        const distance = Math.hypot(item.seat.position.x - fixedEye.x, item.seat.position.z - fixedEye.z)
        if (distance < 1) {
          hiddenRoles.add(index)
          nearSeats.add(getDollSeatIndex(index))
        }
      })
    }
    const strict = first && state.config.firstAnchor === 'strict'
    dolls.forEach((item, index) => {
      item.doll.visible = !first || !hiddenRoles.has(index)
      // 观察席自己的椅子始终隐藏；严格固定保留贴身角色的椅子作为近景遮挡，
      // 固定/后撤则把贴身椅子也藏掉，保证后撤机位干净。
      const hideChair = index === seat || (!strict && nearSeats.has(index))
      item.chair.visible = !first || !hideChair
    })
  }

  function pushLabCamera() {
    if (!state.active) { views.setLabCamera(null); return }
    if (state.config.view === 'first-self' || state.config.view === 'first-other') {
      const anchor = ['follow', 'fixed', 'back', 'strict'].includes(state.config.firstAnchor) ? state.config.firstAnchor : 'follow'
      views.setLabCamera({
        camera: 'first',
        anchor,
        seat: cameraRole(),
        fixedEye: anchor === 'follow' ? null : fixedEye,
        eyeHeight: state.config.eyeHeight,
        backOffset: state.config.backOffset,
        fov: state.config.fov,
        push: state.config.view === 'first-self' ? state.push : 0,
      })
    } else {
      const world = getSeatWorld(speakerSeat(), state.angle)
      views.setLabCamera({
        camera: state.config.view === 'portrait' ? 'portrait' : 'god',
        anchor: 'public',
        lower: state.lower,
        push: state.push,
        speakerPoint: { x: world.x, z: world.z },
      })
    }
  }

  function renderFrame() {
    if (!state.active) return
    const back = [0, 0, 0, 0, 0]
    const speaker = speakerSeat()
    for (let seat = 0; seat < 5; seat++) back[seat] = seat === speaker ? 0 : state.backAmount
    layoutRing({ angle: state.angle, back })
    applyDollVisibility()
    const spotIndex = speakerRole()
    spotlights.forEach((light, index) => { light.intensity = index === spotIndex ? 22 * state.spot : 0 })
    if ((state.config.view === 'first-self' || state.config.view === 'first-other') && state.config.firstAnchor !== 'follow' && !fixedEye) captureFixedEye()
    pushLabCamera()
  }

  function computeTargetAngle(from) {
    const turns = clamp(Number(state.config.turns) || 0, 0, 6)
    const full = turns * TAU
    if (state.config.anchor !== 'speaker') return from + state.config.direction * full
    const seat = speakerSeat()
    const world = getSeatWorld(seat, from)
    const theta = Math.atan2(world.x, world.z)
    // 停靠位置可控：0° = 远席正中，36° = 远席偏一席。
    // 对比区会单独用 A/B 切换，不再由“是否第一人称”隐式决定。
    const gap = clamp(Number(state.config.alignOffset) || 0, 0, 90) * Math.PI / 180
    if (state.config.direction >= 0) {
      let need = Math.PI + gap - theta
      need = ((need % TAU) + TAU) % TAU
      return from + full + need
    }
    let needBack = theta - (Math.PI - gap)
    needBack = ((needBack % TAU) + TAU) % TAU
    return from - full - needBack
  }

  function buildSegments() {
    const list = []
    let cursor = 0
    const duration = clamp(Number(state.config.duration) || 0, 0, 12)
    const turnFrom = state.angle
    const turnTo = computeTargetAngle(turnFrom)
    if (duration > 0) {
      list.push({ key: 'turn', start: cursor, duration, from: turnFrom, to: turnTo, ease: EASINGS[state.config.easing] || EASINGS.easeInOutCubic })
      cursor += duration
    }
    if (state.config.seatBack) {
      list.push({ key: 'back', start: cursor, duration: .5, from: 0, to: clamp(state.config.backAmount, 0, .3), ease: EASINGS.easeOutCubic })
      cursor += .5
    }
    if (state.config.spotlight) {
      list.push({ key: 'spot', start: cursor, duration: .45, from: 0, to: 1, ease: EASINGS.easeOutCubic })
      cursor += .45
    }
    if (state.config.pushIn) {
      list.push({ key: 'push', start: cursor, duration: .7, from: 0, to: clamp(state.config.pushAmount, 0, 1), ease: EASINGS.easeOutCubic })
      cursor += .7
    }
    const hold = state.config.holdOn === false ? 0 : clamp(Number(state.config.hold) || 0, 0, 6)
    if (hold > 0) {
      list.push({ key: 'hold', start: cursor, duration: hold, from: 0, to: 0, ease: EASINGS.linear })
      cursor += hold
    }
    segments = list
    totalDuration = cursor
  }

  function activate() {
    if (state.active) return
    previousMode = views.getMode ? views.getMode() : 'god'
    state.active = true
    state.paused = false
    state.finished = false
    fixedEye = null
  }

  function startPlayback() {
    state.playing = true
    state.paused = false
    state.finished = false
    state.backAmount = 0
    state.lower = 0
    state.push = 0
    state.spot = 0
    state.step = 'turn'
    elapsed = 0
    startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (state.config.view === 'first-self' || state.config.view === 'first-other') {
      if (state.config.firstAnchor !== 'follow') captureFixedEye()
      else fixedEye = null
    }
    buildSegments()
    renderFrame()
    emit()
  }

  function playTurn(options = {}) {
    state.config = { ...state.config, ...options }
    if (!Number.isInteger(state.config.speaker)) state.config.speaker = ownRole()
    state.config.direction = state.config.direction >= 0 ? 1 : -1
    activate()
    startPlayback()
  }

  function applyTerminal() {
    const turn = segments.find(segment => segment.key === 'turn')
    if (turn) state.angle = turn.to
    state.backAmount = state.config.seatBack ? clamp(state.config.backAmount, 0, .3) : 0
    state.spot = state.config.spotlight ? 1 : 0
    state.push = state.config.pushIn ? clamp(state.config.pushAmount, 0, 1) : 0
    state.lower = state.config.lowerView && !state.config.view.startsWith('first') ? clamp(state.config.lowerAmount, 0, 1) : 0
    state.step = 'done'
    renderFrame()
  }

  function finish() {
    if (!state.active) return
    applyTerminal()
    state.playing = false
    state.paused = false
    state.finished = true
    emit()
  }

  function update(delta) {
    if (!state.active) return
    if (state.playing) {
      // 用真实时间而不是累加 delta：低帧率或省电模式下也能保持“首次 3 秒”的约定，
      // 不会因为每帧 delta 被截断而把动画拖成十几秒。
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      elapsed = ((now - startedAt) / 1000) * state.timeScale
      const lowerTarget = state.config.lowerView && !state.config.view.startsWith('first') ? clamp(state.config.lowerAmount, 0, 1) : 0
      state.lower = lowerTarget * clamp(elapsed / .6, 0, 1)
      if (elapsed >= totalDuration) {
        applyTerminal()
        state.playing = false
        state.finished = true
        if (state.loop) {
          state.finished = false
          startPlayback()
        } else {
          state.step = 'done'
          emit()
        }
        return
      }
      let activeStep = ''
      segments.forEach(segment => {
        const progress = clamp((elapsed - segment.start) / segment.duration, 0, 1)
        const eased = segment.ease(progress)
        if (segment.key === 'turn') state.angle = segment.from + (segment.to - segment.from) * eased
        else if (segment.key === 'back') state.backAmount = segment.from + (segment.to - segment.from) * eased
        else if (segment.key === 'spot') state.spot = segment.from + (segment.to - segment.from) * eased
        else if (segment.key === 'push') state.push = segment.from + (segment.to - segment.from) * eased
        if (elapsed >= segment.start && elapsed < segment.start + segment.duration) activeStep = segment.key
      })
      state.step = activeStep || 'done'
      renderFrame()
    }
  }

  function stop() {
    if (!state.active) return
    state.playing = false
    state.paused = true
    state.step = 'stopped'
    emit()
  }

  function skip() {
    if (!state.active) return
    finish()
  }

  function reset(restoreView = true) {
    const wasActive = state.active
    state.playing = false
    state.paused = false
    state.finished = false
    state.step = 'idle'
    state.angle = 0
    state.backAmount = 0
    state.lower = 0
    state.push = 0
    state.spot = 0
    segments = []
    elapsed = 0
    totalDuration = 0
    fixedEye = null
    layoutRing({ angle: 0, back: [0, 0, 0, 0, 0] })
    spotlights.forEach(light => { light.intensity = 0 })
    dolls.forEach(item => { item.doll.visible = true; item.chair.visible = true })
    if (wasActive) views.setLabCamera(null)
    state.active = false
    if (restoreView && wasActive && previousMode) views.setMode(previousMode)
    emit()
  }

  function setView(view) {
    state.config.view = ['god', 'portrait', 'first-self', 'first-other'].includes(view) ? view : 'god'
    activate()
    state.step = state.playing ? state.step : 'preview'
    if (state.config.view === 'first-self' || state.config.view === 'first-other') {
      if (state.config.firstAnchor !== 'follow') captureFixedEye()
      else fixedEye = null
    }
    renderFrame()
    emit()
  }

  function setDemoSpeaker(role) {
    const index = Number(role)
    if (Number.isInteger(index) && index >= 0 && index < 5) state.config.speaker = index
    if (state.active) { renderFrame(); emit() }
  }

  function setSeatBack(enabled, amount) {
    state.config.seatBack = enabled !== false
    if (Number.isFinite(Number(amount))) state.config.backAmount = clamp(Number(amount), 0, .3)
    if (state.active && !state.playing) { state.backAmount = state.config.seatBack ? state.config.backAmount : 0; renderFrame(); emit() }
  }

  function setLowerView(enabled, amount) {
    state.config.lowerView = enabled !== false
    if (Number.isFinite(Number(amount))) state.config.lowerAmount = clamp(Number(amount), 0, 1)
    if (state.active && !state.playing) {
      state.lower = state.config.lowerView && !state.config.view.startsWith('first') ? state.config.lowerAmount : 0
      renderFrame(); emit()
    }
  }

  function setSpotlight(enabled) {
    state.config.spotlight = enabled !== false
    if (state.active && !state.playing) { state.spot = state.config.spotlight ? 1 : 0; renderFrame(); emit() }
  }

  function setPush(enabled, amount) {
    state.config.pushIn = enabled !== false
    if (Number.isFinite(Number(amount))) state.config.pushAmount = clamp(Number(amount), 0, 1)
    if (state.active && !state.playing) { state.push = state.config.pushIn ? state.config.pushAmount : 0; renderFrame(); emit() }
  }

  function setFirstCamera(options = {}) {    let recapture = false
    if (options.firstAnchor !== undefined) {
      const anchor = ['follow', 'fixed', 'back', 'strict'].includes(options.firstAnchor) ? options.firstAnchor : 'follow'
      if (anchor !== state.config.firstAnchor) recapture = true
      state.config.firstAnchor = anchor
    }
    if (Number.isFinite(Number(options.eyeHeight))) state.config.eyeHeight = clamp(Number(options.eyeHeight), 1.45, 2.1)
    if (Number.isFinite(Number(options.backOffset))) state.config.backOffset = clamp(Number(options.backOffset), 0, .5)
    if (Number.isFinite(Number(options.fov))) state.config.fov = clamp(Number(options.fov), 55, 85)
    if ('viewSeat' in options) {
      const raw = options.viewSeat
      const seat = raw === null || raw === undefined || raw === '' || raw === 'auto' ? null : clamp(Number(raw), 0, 4)
      if (seat !== state.config.viewSeat) recapture = true
      state.config.viewSeat = seat
    }
    if (state.active) {
      if (recapture) fixedEye = null
      if ((state.config.view === 'first-self' || state.config.view === 'first-other') && state.config.firstAnchor !== 'follow' && !fixedEye) captureFixedEye()
      renderFrame()
      emit()
    }
  }

  function setStrictGuard(enabled) {
    state.config.strictGuard = Boolean(enabled)
    if (state.active) { renderFrame(); emit() }
  }

  function setTimeScale(value) {
    state.timeScale = clamp(Number(value) || 1, .1, 2)
    emit()
  }

  function setLoop(enabled) {
    state.loop = Boolean(enabled)
    emit()
  }

  function snapshot() {
    const backSeats = [0, 0, 0, 0, 0]
    const seat = speakerSeat()
    for (let index = 0; index < 5; index++) backSeats[index] = index === seat ? 0 : state.backAmount
    return {
      active: state.active,
      playing: state.playing,
      paused: state.paused,
      finished: state.finished,
      loop: state.loop,
      timeScale: state.timeScale,
      step: state.step,
      angle: state.angle,
      backAmount: state.backAmount,
      backSeats,
      lower: state.lower,
      push: state.push,
      spot: state.spot,
      config: { ...state.config },
      speaker: speakerRole(),
      speakerSeat: speakerSeat(),
      ownRole: ownRole(),
      cameraSeat: cameraSeat(),
      cameraRole: cameraRole(),
      fixedEye: fixedEye ? { ...fixedEye } : null,
      // cameraMode 返回本次演示实际使用的视角；未演示时回落到舞台当前模式。
      cameraMode: state.active
        ? (state.config.view === 'first-self' || state.config.view === 'first-other' ? 'first' : state.config.view === 'portrait' ? 'portrait' : 'god')
        : (views.getMode ? views.getMode() : null),
      viewMode: state.active
        ? (state.config.view === 'first-self' || state.config.view === 'first-other' ? 'first' : state.config.view === 'portrait' ? 'portrait' : 'god')
        : (views.getMode ? views.getMode() : null),
      firstPerson: views.isFirstPerson ? views.isFirstPerson() : false,
      stage: typeof window !== 'undefined' && window.stageViewSnapshot ? window.stageViewSnapshot() : null,
    }
  }

  function dispose() {
    reset()
    listeners.clear()
  }

  return {
    playTurn, stop, reset, finish, skip, cancel: reset,
    setView, setDemoSpeaker, setSeatBack, setLowerView, setSpotlight, setPush, setFirstCamera, setStrictGuard,
    setTimeScale, setLoop, update, subscribe, snapshot, dispose,
    isActive: () => state.active,
    isFirstPerson: () => views.isFirstPerson ? views.isFirstPerson() : false,
    getConfig: () => ({ ...state.config }),
  }
}

// ===== 舞台动画实验室面板与预设（原 demo-lab.js） =====
const STORAGE_KEY = 'weizhuo:lab:v1'
const STEP_LABELS = {
  idle: '待播放', turn: '转桌', back: '座位后退', spot: '聚光', push: '推近',
  hold: '停留', done: '已完成', stopped: '已停止', preview: '视角预览',
}
const EASING_OPTIONS = [
  ['easeInOutCubic', '缓入缓出'],
  ['easeOutCubic', '缓出'],
  ['easeInOutQuint', '更慢的收尾'],
  ['linear', '匀速'],
]
const RHYTHMS = {
  fast: { label: '快', first: 2, short: .6 },
  current: { label: '当前', first: 3, short: 1 },
  slow: { label: '慢', first: 4.5, short: 1.5 },
}
const COMPARE_LABELS = {
  self: '自己发言',
  other: '别人发言',
  stop: '停靠位置',
  rhythm: '节奏',
}

function formatLabValue(key, value) {
  const number = Number(value)
  if (key === 'turns') return `${number.toFixed(1)} 圈`
  if (key === 'duration' || key === 'shortDuration' || key === 'hold') return `${number.toFixed(1)} 秒`
  if (key === 'eyeHeight' || key === 'backOffset' || key === 'backAmount') return `${number.toFixed(2)} 米`
  if (key === 'fov') return `${Math.round(number)}°`
  if (key === 'lowerAmount' || key === 'pushAmount') return `${Math.round(number * 100)}%`
  return String(value)
}

export const LAB_PRESETS = {
  'first-two': {
    label: '首次发言 · 完整两圈',
    description: '整圈桌椅与聚光灯一起转，默认 3 秒，转到发言者面向公共屏。',
    config: { turns: 2, duration: 3, easing: 'easeInOutCubic', direction: 1, anchor: 'speaker', view: 'god', seatBack: false, spotlight: false, pushIn: false, hold: .4 },
  },
  'short-turn': {
    label: '同轮后续短转',
    description: '约 1 秒的小幅转动，不做完整两圈，只把下一位带入画面。',
    config: { turns: .2, duration: 1, easing: 'easeOutCubic', direction: 1, anchor: 'none', view: 'god', seatBack: false, spotlight: false, pushIn: false, hold: .2 },
  },
  'self-speak': {
    label: '自己发言 · 第一人称随席旋转',
    description: '相机跟随自己的座位绕桌心转，眼高 1.68、后撤 0.10、FOV 72，最终看向桌心；自己的木偶与椅子隐藏。',
    config: { turns: 2, duration: 3, easing: 'easeInOutCubic', direction: 1, anchor: 'speaker', view: 'first-self', speaker: 'own', seatBack: false, spotlight: true, pushIn: true, pushAmount: .35, hold: .8, firstAnchor: 'follow', eyeHeight: 1.68, backOffset: .1, fov: 72 },
  },
  'other-speak': {
    label: '别人发言 · 第一人称固定视点',
    description: '机位固定在自己席位方向并退到圈外，眼高 1.72、后撤 0.28、FOV 72；桌子和发言者转动，本席木偶与椅子隐藏。',
    config: { turns: 2, duration: 3, easing: 'easeInOutCubic', direction: 1, anchor: 'speaker', alignOffset: 36, view: 'first-other', speaker: 'next', seatBack: true, backAmount: .1, spotlight: true, pushIn: false, hold: .8, firstAnchor: 'back', eyeHeight: 1.72, backOffset: .28, fov: 72 },
  },
  combo: {
    label: '组合步骤 · 转桌→后退→聚光→推近→停留',
    description: '按顺序播放五段，便于比较衔接；每一步都可单独关掉。',
    config: { turns: 2, duration: 3, easing: 'easeInOutCubic', direction: 1, anchor: 'speaker', view: 'god', seatBack: true, backAmount: .1, lowerView: true, lowerAmount: .45, spotlight: true, pushIn: true, pushAmount: .45, hold: 1.2 },
  },
}

export const LAB_EFFECTS = [
  {
    group: '可用',
    items: [
      { id: 'first-two', status: '可用', label: '首次发言完整两圈', desc: '桌面、五套椅子/座位/木偶、聚光灯同步旋转，保持 72° 席位与面向桌心。' },
      { id: 'short-turn', status: '可用', label: '同轮后续短转', desc: '默认 1 秒、0.2 圈；圈数、时长、缓动、方向均可调。' },
      { id: 'playback', status: '可用', label: '播放 / 停止 / 复位 / 跳过', desc: '跳过只作用于当前设备，直接到本机动画终态；用上方播放控制操作。' },
      { id: 'loop', status: '可用', label: '循环与慢放', desc: '循环从头重放当前参数；慢放 0.5× 用于观察衔接。' },
      { id: 'ab', status: '可用', label: 'A/B 参数切换', desc: '把两套参数存到 A/B，一键对看，参数写入本机 localStorage。' },
      { id: 'combo', status: '可用', label: '组合步骤播放', desc: '转桌 → 座位后退 → 聚光 → 推近 → 停留，可逐项开关。' },
      { id: 'debug', status: '可用', label: '复用桌子/椅子/地板/视角调试', desc: '实验室里直接调桌子大小、椅子大小、地板高度和四种视角。' },
    ],
  },
  {
    group: '实验中',
    items: [
      { id: 'self-speak', status: '实验中', label: '自己发言：第一人称随席旋转', desc: '眼高 1.68、后撤 0.10、FOV 72；随席旋转不会让邻席贴近镜头。' },
      { id: 'other-speak', status: '实验中', label: '别人发言：固定视点 + 本席后撤', desc: '机位退到席位圈外再叠加后撤，避免转台木偶贴脸；眼高 1.72、FOV 72。' },
      { id: 'first-camera', status: '实验中', label: '第一人称镜头参数', desc: '锚点（随席/固定/后撤）、眼高、后撤距离、FOV 与观察席位均可调，默认值只用于演示。' },
      { id: 'lower', status: '实验中', label: '降低视角（仅公共屏/竖屏）', desc: '只在电脑公共屏和玩家镜像的竖屏构图试做，第一人称保持角色眼高。' },
    ],
  },
  {
    group: '尚未实现',
    items: [
      { id: 'bones', status: '尚未实现', reason: '木偶没有骨骼动画资产，本轮不伪造动作按钮。', label: '角色骨骼动作' },
      { id: 'props', status: '尚未实现', reason: '本轮只做转台与镜头，不引入大量道具模型。', label: '大量道具模型' },
      { id: 'drag3d', status: '尚未实现', reason: '当前只有滑杆调参，未做 3D 拖拽。', label: '3D 拖拽调参' },
      { id: 'split', status: '尚未实现', reason: '单画布一次只渲染一种相机，未做并排双渲染。', label: '并排双渲染对比' },
      { id: 'record', status: '尚未实现', reason: '未接入视频录制与导出。', label: '视频录制' },
      { id: 'multi', status: '尚未实现', reason: '第一阶段不做跨设备实验控制或多手机同步。', label: '跨设备实验控制 / 多手机同步' },
    ],
  },
]

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeConfig(config) {
  return { ...clone(LAB_DEFAULT_CONFIG), ...config }
}

function buildPresetConfig(preset, ownRole, endpoint) {
  const config = normalizeConfig(preset.config)
  if (config.speaker === 'own') config.speaker = ownRole
  else if (config.speaker === 'next') config.speaker = (Number(ownRole) + 1) % 5
  else if (!Number.isInteger(config.speaker)) config.speaker = ownRole
  if (endpoint === 'player' && config.view === 'god') config.view = 'portrait'
  return config
}

export function playLabPreset(lab, id, { endpoint = 'computer' } = {}) {
  const preset = LAB_PRESETS[id]
  if (!preset || !lab) return false
  const config = buildPresetConfig(preset, lab.snapshot().ownRole, endpoint)
  lab.reset()
  lab.playTurn(config)
  return true
}

function readStored() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return raw && typeof raw === 'object' ? raw : {}
  } catch { return {} }
}

function saveStored(value) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)) } catch { /* 隐私模式忽略 */ }
}

function controlRow(inner) {
  return `<div class="lab-control">${inner}</div>`
}

function rangeRow(key, label, min, max, step, value, unit = '') {
  return `<label class="lab-range"><span>${label}</span><input type="range" data-lab-config="${key}" min="${min}" max="${max}" step="${step}" value="${value}"><output data-lab-out="${key}">${value}${unit}</output></label>`
}

function checkRow(key, label) {
  return `<label class="lab-check"><input type="checkbox" data-lab-config="${key}"><span>${label}</span></label>`
}

export function createDemoLab({ lab, stage, notify, mirrorUrl, onExit, roleNames }) {
  const panel = document.querySelector('#lab-panel')
  const openButton = document.querySelector('#lab-open')
  if (!panel || !openButton) return null
  const stored = readStored()
  const config = normalizeConfig(stored.config)
  const ab = {
    A: normalizeConfig(stored.ab?.A || { turns: 2, duration: 3, view: 'god', anchor: 'speaker' }),
    B: normalizeConfig(stored.ab?.B || { turns: .2, duration: 1, easing: 'easeOutCubic', anchor: 'none', view: 'god' }),
  }
  let loop = Boolean(stored.loop)
  let slow = Boolean(stored.slow)
  let open = false
  let compareQueue = []
  let compareTimer = null
  let compareRunning = false
  let compareGroup = ''
  let compareStep = null
  let compareDoneText = '完成 A→B'
  let status = null
  const roles = Array.isArray(roleNames) && roleNames.length === 5 ? roleNames : ['角色 1', '角色 2', '角色 3', '角色 4', '角色 5']

  function syncStored() {
    saveStored({ config, ab, loop, slow })
  }

  function setOutputs() {
    panel.querySelectorAll('[data-lab-out]').forEach(node => {
      const key = node.dataset.labOut
      node.textContent = formatLabValue(key, config[key])
    })
    const lower = Number(config.lowerAmount) || 0
    const lowerExplain = panel.querySelector('[data-lab-explain="lower"]')
    if (lowerExplain) lowerExplain.textContent = `降低 ${Math.round(lower * 100)}% = 预设幅度的 ${Math.round(lower * 100)}%，公共视点下降约 ${(lower * .9).toFixed(2)} 米（第一人称不使用）。`
    const push = Number(config.pushAmount) || 0
    const fov = Number(config.fov) || 72
    const pushFov = Math.max(55, fov - push * 8).toFixed(1)
    const pushExplain = panel.querySelector('[data-lab-explain="push"]')
    if (pushExplain) pushExplain.textContent = `推近 ${Math.round(push * 100)}% = 公共机位半径收窄约 ${(push * 16).toFixed(1)}%（上帝约 ${(push * .16 * 15.72).toFixed(1)} 米 / 竖屏约 ${(push * .16 * 10.72).toFixed(1)} 米）；第一人称 FOV ${Math.round(fov)}°→${pushFov}°（自己发言）。`
    const rhythmState = panel.querySelector('[data-compare-state="rhythm"]')
    if (rhythmState && !compareRunning) rhythmState.textContent = `首次 ${Number(config.duration).toFixed(1)} 秒 · 短转 ${Number(config.shortDuration).toFixed(1)} 秒`
    panel.querySelectorAll('[data-lab-config]').forEach(node => {
      const key = node.dataset.labConfig
      if (!(key in config)) return
      if (node.type === 'checkbox') node.checked = Boolean(config[key])
      else if (key === 'viewSeat') { if (document.activeElement !== node) node.value = config.viewSeat === null ? '' : String(config.viewSeat) }
      else if (document.activeElement !== node) node.value = config[key]
    })
    panel.querySelectorAll('[data-lab-view]').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.labView === config.view)))
    panel.querySelectorAll('[data-lab-speaker]').forEach(node => { node.value = String(config.speaker ?? 0) })
    panel.querySelectorAll('[data-lab-toggle="loop"]').forEach(node => node.setAttribute('aria-pressed', String(loop)))
    panel.querySelectorAll('[data-lab-toggle="slow"]').forEach(node => node.setAttribute('aria-pressed', String(slow)))
    panel.querySelectorAll('[data-lab-gate]').forEach(node => { node.disabled = !config[node.dataset.labGate] })
  }

  function statusText(snapshot) {
    if (!snapshot || !snapshot.active) return '待播放 · 只改视觉，不改房间流程'
    return `演示中 · ${STEP_LABELS[snapshot.step] || snapshot.step} · 视觉隔离，房间阶段/队列/投票不变`
  }

  function renderEffects() {
    return LAB_EFFECTS.map(group => `<section class="lab-effects-group"><h3>${group.group}</h3>${group.items.map(item => {
      const playable = group.group !== '尚未实现' && LAB_PRESETS[item.id]
      const body = item.desc || item.reason || '尚未实现'
      if (!playable && group.group !== '尚未实现') {
        return `<div class="lab-effect lab-effect-info" data-status="${item.status}">
          <span class="lab-effect-head"><strong>${item.label}</strong><em>${item.status}</em></span>
          <small>${body}</small>
        </div>`
      }
      return `<button type="button" class="lab-effect" data-lab-effect="${item.id}" data-status="${item.status}" ${playable ? '' : 'disabled'} title="${body}">
        <span class="lab-effect-head"><strong>${item.label}</strong><em>${item.status}</em></span>
        <small>${body}</small>
      </button>`
    }).join('')}</section>`).join('')
  }

  function render() {
    panel.innerHTML = `
      <header class="lab-head">
        <div><span class="lab-kicker">舞台动画实验室 · 阶段二</span><h2>围桌转场</h2></div>
        <button type="button" class="icon-button" data-lab-action="close" aria-label="关闭动画实验室">×</button>
      </header>
      <p class="lab-status" id="lab-status">待播放 · 只改视觉，不改房间流程</p>
      <div class="lab-note">电脑公共舞台 + 玩家镜像观察。多手机同步未实现。</div>

      <section class="lab-section lab-compare">
        <h3>对比演示（实验中）</h3>
        <p class="lab-hint">同一组 A/B 只改一项；连续对比按 A→B，间隔约 0.8 秒。B 默认防穿模；取消“严格固定防穿模”可看原始遮挡/穿模，仅用于观察，不代表最终采用。</p>
        <div class="lab-compare-row">
          <div class="lab-compare-copy"><strong>自己发言</strong><small>A 随席旋转 / B 严格固定原位；同座位、发言者、圈数、时长、缓动。</small></div>
          <div class="lab-compare-actions"><button type="button" data-lab-compare="self-a">A</button><button type="button" data-lab-compare="self-b">B</button><button type="button" data-lab-compare="self-ab">连续 A→B</button><label class="lab-guard"><input type="checkbox" data-lab-config="strictGuard"><span>防穿模</span></label></div>
          <span class="lab-compare-state" data-compare-state="self">未对比</span>
        </div>
        <div class="lab-compare-row">
          <div class="lab-compare-copy"><strong>别人发言</strong><small>停靠固定在远席正中；A 本席后撤 0.28 米 / B 严格固定（back=0），只比较后退。B 默认防穿模，取消保护可看原始遮挡。</small></div>
          <div class="lab-compare-actions"><button type="button" data-lab-compare="other-a">A</button><button type="button" data-lab-compare="other-b">B</button><button type="button" data-lab-compare="other-ab">连续 A→B</button><label class="lab-guard"><input type="checkbox" data-lab-config="strictGuard"><span>防穿模</span></label></div>
          <span class="lab-compare-state" data-compare-state="other">未对比</span>
        </div>
        <div class="lab-compare-row">
          <div class="lab-compare-copy"><strong>发言者停靠位置</strong><small>A 远席偏 36° / B 远席正中；公共上帝与第一人称各看一次，正中遮挡保留。</small></div>
          <div class="lab-compare-actions"><button type="button" data-lab-compare="stop-a">A</button><button type="button" data-lab-compare="stop-b">B</button><button type="button" data-lab-compare="stop-ab">连续 A→B</button></div>
          <span class="lab-compare-state" data-compare-state="stop">未对比</span>
        </div>
        <div class="lab-compare-row">
          <div class="lab-compare-copy"><strong>节奏</strong><small>快 2.0/0.6 s · 当前 3.0/1.0 s · 慢 4.5/1.5 s（首次/短转）；只改时长。</small></div>
          <div class="lab-compare-actions"><button type="button" data-lab-rhythm="fast">快</button><button type="button" data-lab-rhythm="current">当前</button><button type="button" data-lab-rhythm="slow">慢</button><button type="button" data-lab-rhythm="cycle">连续三档</button></div>
          <span class="lab-compare-state" data-compare-state="rhythm">首次 ${Number(config.duration).toFixed(1)} s · 短转 ${Number(config.shortDuration).toFixed(1)} s</span>
        </div>
        <div class="lab-compare-row">
          <div class="lab-compare-copy"><strong>效果快捷</strong><small>座位后退 / 降低视角 / 推近 / 末尾停留四个开关。</small></div>
          <div class="lab-compare-actions"><button type="button" data-lab-effects="turn-only">仅转桌</button><button type="button" data-lab-effects="all-on">全开</button></div>
          <span class="lab-compare-state" data-compare-state="effects">按下方开关</span>
        </div>
        <div class="lab-compare-row">
          <div class="lab-compare-copy"><strong>恢复默认</strong><small>只重置参数，A/B 预设仍保留。</small></div>
          <div class="lab-compare-actions"><button type="button" data-lab-reset="camera">恢复镜头默认</button><button type="button" data-lab-reset="all">恢复全部默认</button></div>
          <span class="lab-compare-state" data-compare-state="reset">—</span>
        </div>
      </section>

      <section class="lab-section">
        <h3>一键预设</h3>
        <div class="lab-preset-grid">
          ${Object.entries(LAB_PRESETS).map(([id, preset]) => `<button type="button" class="lab-preset" data-lab-preset="${id}" title="${preset.description}">${preset.label}</button>`).join('')}
        </div>
      </section>

      <section class="lab-section">
        <h3>播放控制</h3>
        <div class="lab-transport">
          <button type="button" class="primary" data-lab-action="play">播放</button>
          <button type="button" data-lab-action="stop">停止</button>
          <button type="button" data-lab-action="reset">复位</button>
          <button type="button" data-lab-action="skip">跳过</button>
          <button type="button" data-lab-toggle="loop" aria-pressed="${loop}">循环</button>
          <button type="button" data-lab-toggle="slow" aria-pressed="${slow}">慢放 0.5×</button>
        </div>
        <div class="lab-ab">
          <span>A/B</span>
          <button type="button" data-lab-ab="apply-A">套用 A</button>
          <button type="button" data-lab-ab="apply-B">套用 B</button>
          <button type="button" data-lab-ab="save-A">存为 A</button>
          <button type="button" data-lab-ab="save-B">存为 B</button>
        </div>
      </section>

      <section class="lab-section">
        <h3>视角</h3>
        <div class="lab-seg">
          <button type="button" data-lab-view="god">公共上帝</button>
          <button type="button" data-lab-view="portrait">公共竖屏</button>
          <button type="button" data-lab-view="first-self">第一人称·自己</button>
          <button type="button" data-lab-view="first-other">第一人称·别人</button>
        </div>
        <p class="lab-hint">第一人称只在演示里尝试；降低视角仅对公共视角生效，第一人称保持角色眼高。</p>
      </section>

      <section class="lab-section">
        <h3>第一人称镜头</h3>
        ${controlRow(`<label class="lab-select"><span>镜头锚点</span><select data-lab-config="firstAnchor"><option value="follow">随席旋转</option><option value="fixed">固定本席（圈外）</option><option value="back">本席后撤</option><option value="strict">严格固定原位</option></select></label>`)}
        ${controlRow(`<label class="lab-select"><span>观察席位</span><span class="lab-inline"><select data-lab-config="viewSeat"><option value="">自动（本席）</option>${[0,1,2,3,4].map(index => `<option value="${index}">${index + 1} 号座位</option>`).join('')}</select><button type="button" data-lab-seat-next>下一位</button></span></label>`)}
        ${controlRow(rangeRow('eyeHeight', '眼高（米）', 1.45, 2.1, .01, config.eyeHeight))}
        ${controlRow(rangeRow('backOffset', '后撤距离（米）', 0, .5, .01, config.backOffset))}
        ${controlRow(rangeRow('fov', 'FOV（度）', 55, 85, 1, config.fov))}
        <p class="lab-hint">随席旋转不滞后；固定/后撤机位先退到席位圈外。严格固定：相机保持在席位原位，1.0 米内的角色整只隐藏，保留其椅子作为近景遮挡，用于观察固定机位被挡的情况，不再做后退保护。后撤距离只叠加在“随席旋转”和“本席后撤”上。观察席位仅实验室使用。</p>
      </section>

      <section class="lab-section">
        <h3>转台参数</h3>
        ${controlRow(rangeRow('turns', '圈数（圈）', .2, 3, .1, config.turns))}
        ${controlRow(rangeRow('duration', '首次时长（秒）', .5, 6, .1, config.duration))}
        ${controlRow(rangeRow('shortDuration', '短转时长（秒）', .3, 3, .1, config.shortDuration))}
        ${controlRow(`<label class="lab-select"><span>缓动</span><select data-lab-config="easing">${EASING_OPTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>`)}
        ${controlRow(`<label class="lab-select"><span>方向</span><select data-lab-config="direction"><option value="1">正向</option><option value="-1">反向</option></select></label>`)}
        ${controlRow(`<label class="lab-select"><span>转动对齐</span><select data-lab-config="anchor"><option value="speaker">发言者转到远席</option><option value="none">只转满圈数</option></select></label>`)}
        ${controlRow(`<label class="lab-select"><span>停靠位置</span><select data-lab-config="alignOffset"><option value="36">远席偏 36°</option><option value="0">远席正中</option></select></label>`)}
        ${controlRow(`<label class="lab-select"><span>演示发言者</span><select data-lab-speaker>${roles.map((name, index) => `<option value="${index}">${name}</option>`).join('')}</select></label>`)}
      </section>

      <section class="lab-section">
        <h3>镜头与席位</h3>
        ${checkRow('seatBack', '座位轻后退（仅非发言席）')}
        ${controlRow(rangeRow('backAmount', '后退幅度（米）', 0, .3, .01, config.backAmount))}
        ${checkRow('lowerView', '降低视角（仅公共屏）')}
        ${controlRow(rangeRow('lowerAmount', '降低幅度', .1, .8, .05, config.lowerAmount))}
        <p class="lab-hint" data-lab-explain="lower"></p>
        ${checkRow('spotlight', '转后聚光发言者')}
        ${checkRow('pushIn', '转后轻推近')}
        ${controlRow(rangeRow('pushAmount', '推近幅度', .1, .6, .05, config.pushAmount))}
        <p class="lab-hint" data-lab-explain="push"></p>
        ${checkRow('holdOn', '末尾停留')}
        ${controlRow(rangeRow('hold', '停留时长（秒）', 0, 3, .1, config.hold))}
      </section>

      <section class="lab-section">
        <h3>舞台尺寸（复用原有调试）</h3>
        ${controlRow(`<label class="lab-range"><span>桌子大小</span><input type="range" data-lab-debug="table" min=".75" max="1.35" step=".01" value="${(stage?.getStageSettings?.() || {}).tableScale ?? 1}"><output data-lab-debug-out="table"></output></label>`)}
        ${controlRow(`<label class="lab-range"><span>椅子大小</span><input type="range" data-lab-debug="chair" min=".75" max="1.35" step=".01" value="${(stage?.getStageSettings?.() || {}).chairScale ?? 1}"><output data-lab-debug-out="chair"></output></label>`)}
        ${controlRow(`<label class="lab-range"><span>地板高度（米）</span><input type="range" data-lab-debug="floor" min="-1.2" max="1.2" step=".1" value="${(stage?.getStageSettings?.() || {}).floorOffset ?? 0}"><output data-lab-debug-out="floor"></output></label>`)}
      </section>

      <section class="lab-section lab-assets">
        <h3>动画资产盘点</h3>
        ${renderEffects()}
      </section>

      <section class="lab-section">
        <button type="button" class="lab-mirror" data-lab-action="mirror">在玩家镜像中打开当前演示</button>
        <p class="lab-hint">同一浏览器会话的 393 宽玩家镜像，只用于本地预览；不是多设备同步，也不会控制其他手机。</p>
      </section>
      <p class="lab-boundary">实验室只改本机舞台视觉：不调用房间 action，不改阶段、计时、发言队列、投票与线索权限。关闭实验室后按最新房间状态恢复。</p>
    `
    setOutputs()
    syncDebugOutputs()
    updateStatus(lab.snapshot())
  }

  function syncDebugOutputs() {
    const settings = stage?.getStageSettings?.() || { tableScale: 1, chairScale: 1, floorOffset: 0 }
    panel.querySelectorAll('[data-lab-debug]').forEach(node => {
      const key = node.dataset.labDebug
      const value = key === 'table' ? settings.tableScale : key === 'chair' ? settings.chairScale : settings.floorOffset
      if (document.activeElement !== node) node.value = String(value)
      const out = panel.querySelector(`[data-lab-debug-out="${key}"]`)
      if (out) out.textContent = key === 'floor' ? `${Number(value) > 0 ? '+' : ''}${Number(value).toFixed(1)} 米` : `${Math.round(Number(value) * 100)}%`
    })
  }

  function updateStatus(snapshot) {
    status = snapshot
    const node = panel.querySelector('#lab-status')
    if (node) node.textContent = statusText(snapshot)
    panel.classList.toggle('is-playing', Boolean(snapshot?.playing))
  }

  function syncFromControl(node) {
    const key = node.dataset.labConfig
    if (!(key in config)) return
    if (node.type === 'checkbox') config[key] = node.checked
    else if (node.type === 'range') config[key] = Number(node.value)
    else if (key === 'direction' || key === 'alignOffset') config[key] = Number(node.value)
    else if (key === 'viewSeat') config[key] = node.value === '' ? null : Number(node.value)
    else config[key] = node.value
  }

  function applyLive(key) {
    if (key === 'seatBack' || key === 'backAmount') lab.setSeatBack(config.seatBack, config.backAmount)
    else if (key === 'lowerView' || key === 'lowerAmount') lab.setLowerView(config.lowerView, config.lowerAmount)
    else if (key === 'spotlight') lab.setSpotlight(config.spotlight)
    else if (key === 'pushIn' || key === 'pushAmount') lab.setPush(config.pushIn, config.pushAmount)
    else if (key === 'strictGuard') lab.setStrictGuard(config.strictGuard)
    else if (['firstAnchor', 'eyeHeight', 'backOffset', 'fov', 'viewSeat'].includes(key)) lab.setFirstCamera(config)
  }

  function handleConfigInput(event) {
    const node = event.target.closest('[data-lab-config]')
    if (!node) return
    if (compareRunning) cancelCompare('已手动调整')
    syncFromControl(node)
    applyLive(node.dataset.labConfig)
    setOutputs()
    syncStored()
  }

  function handleSpeaker(event) {
    const node = event.target.closest('[data-lab-speaker]')
    if (!node) return
    if (compareRunning) cancelCompare('已手动调整')
    config.speaker = Number(node.value)
    lab.setDemoSpeaker(config.speaker)
    syncStored()
  }

  function handleDebug(event) {
    const node = event.target.closest('[data-lab-debug]')
    if (!node) return
    const value = Number(node.value)
    if (node.dataset.labDebug === 'table') stage.setTableScale(value)
    else if (node.dataset.labDebug === 'chair') stage.setChairScale(value)
    else stage.setFloorOffset(value)
    syncDebugOutputs()
  }

  function applyPreset(id, play = true) {
    const preset = LAB_PRESETS[id]
    if (!preset) return
    cancelCompare()
    const shortDuration = Number(config.shortDuration) || 1
    const next = buildPresetConfig(preset, lab.snapshot().ownRole, 'computer')
    next.shortDuration = shortDuration
    if (id === 'short-turn') next.duration = shortDuration
    Object.assign(config, next)
    config.speaker = Number.isInteger(next.speaker) ? next.speaker : lab.snapshot().ownRole
    setOutputs()
    syncStored()
    if (!play) return
    lab.reset()
    lab.playTurn(config)
  }

  function currentPresetId() {
    if (config.view === 'first-self') return 'self-speak'
    if (config.view === 'first-other') return 'other-speak'
    if (Number(config.turns) <= .5) return 'short-turn'
    if (config.seatBack && config.spotlight && config.pushIn) return 'combo'
    return 'first-two'
  }

  function setCompareState(group, text) {
    const node = panel.querySelector(`[data-compare-state="${group}"]`)
    if (node) node.textContent = text
  }

  function cancelCompare(message = '') {
    if (compareTimer) { clearTimeout(compareTimer); compareTimer = null }
    const group = compareGroup
    compareQueue = []
    compareRunning = false
    compareStep = null
    compareGroup = ''
    if (message && group) setCompareState(group, message)
  }

  function compareSteps(group) {
    const own = lab.snapshot().ownRole
    const guardOn = config.strictGuard !== false
    if (group === 'self') {
      const base = { view: 'first-self', speaker: own, anchor: 'speaker', alignOffset: 0 }
      return {
        A: { chip: 'A · 随席旋转', config: { ...config, ...base, firstAnchor: 'follow' } },
        B: { chip: guardOn ? 'B · 严格固定（防穿模）' : 'B · 严格固定（原始）', config: { ...config, ...base, firstAnchor: 'strict' } },
      }
    }
    if (group === 'other') {
      // 停靠固定在远席正中，A/B 只改“后撤 0.28 米 vs 严格固定 0”。
      // 正中时严格固定会撞上转台送来的角色：贴身木偶整只隐藏，保留椅子遮挡。
      const base = { view: 'first-other', speaker: (Number(own) + 1) % 5, anchor: 'speaker', alignOffset: 0 }
      return {
        A: { chip: 'A · 后撤 0.28 米', config: { ...config, ...base, firstAnchor: 'back', backOffset: .28 } },
        B: { chip: guardOn ? 'B · 严格固定（防穿模）' : 'B · 严格固定（原始）', config: { ...config, ...base, firstAnchor: 'strict', backOffset: 0 } },
      }
    }
    if (group === 'stop') {
      return {
        A: { chip: 'A · 远席偏 36°', config: { ...config, alignOffset: 36 } },
        B: { chip: 'B · 远席正中', config: { ...config, alignOffset: 0 } },
      }
    }
    return {}
  }

  function applyCompareConfig(partial) {
    Object.assign(config, partial)
    if (!Number.isInteger(config.speaker)) config.speaker = lab.snapshot().ownRole
    setOutputs()
    syncStored()
    lab.setDemoSpeaker(config.speaker)
    lab.setFirstCamera(config)
  }

  function playCompareStep(step) {
    lab.reset()
    applyCompareConfig(step.config)
    lab.playTurn(config)
  }

  function runNextCompareStep() {
    if (!compareQueue.length) {
      const group = compareGroup
      compareRunning = false
      compareStep = null
      if (group) setCompareState(group, compareDoneText)
      compareGroup = ''
      return
    }
    const step = compareQueue.shift()
    compareStep = step
    if (compareGroup) setCompareState(compareGroup, step.chip)
    playCompareStep(step)
  }

  function startCompareRun(group, steps) {
    cancelCompare()
    compareGroup = group
    compareRunning = true
    compareDoneText = group === 'rhythm' ? '完成 快→当前→慢' : '完成 A→B'
    compareQueue = [steps.A, steps.B].filter(Boolean)
    lab.setLoop(false)
    loop = false
    setOutputs()
    setCompareState(group, '连续 A→B · 准备')
    runNextCompareStep()
  }

  function runCompareSlot(group, slot) {
    const steps = compareSteps(group)
    const step = steps[slot]
    if (!step) return
    cancelCompare()
    setCompareState(group, step.chip)
    playCompareStep(step)
  }

  function rhythmConfig(rhythm) {
    const shortMode = Number(config.turns) <= .5
    return { ...config, duration: shortMode ? rhythm.short : rhythm.first, shortDuration: rhythm.short }
  }

  function applyRhythm(key) {
    const rhythm = RHYTHMS[key]
    if (!rhythm) return
    cancelCompare()
    Object.assign(config, rhythmConfig(rhythm))
    setOutputs()
    syncStored()
    setCompareState('rhythm', `${rhythm.label} · 首次 ${Number(config.duration).toFixed(1)} 秒 / 短转 ${Number(config.shortDuration).toFixed(1)} 秒`)
    lab.reset()
    lab.playTurn(config)
  }

  function startRhythmCycle() {
    cancelCompare()
    compareGroup = 'rhythm'
    compareRunning = true
    compareDoneText = '完成 快→当前→慢'
    compareQueue = ['fast', 'current', 'slow'].map(key => {
      const rhythm = RHYTHMS[key]
      const next = rhythmConfig(rhythm)
      return { chip: `${rhythm.label} · ${Number(next.duration).toFixed(1)} 秒`, config: next }
    })
    lab.setLoop(false)
    loop = false
    setOutputs()
    setCompareState('rhythm', '连续 快→当前→慢')
    runNextCompareStep()
  }

  function setEffectsPreset(kind) {
    cancelCompare()
    if (kind === 'turn-only') {
      Object.assign(config, { seatBack: false, lowerView: false, pushIn: false, holdOn: false, hold: 0 })
    } else {
      Object.assign(config, { seatBack: true, lowerView: true, pushIn: true, holdOn: true, hold: config.hold > 0 ? config.hold : 1.2 })
    }
    lab.setSeatBack(config.seatBack, config.backAmount)
    lab.setLowerView(config.lowerView, config.lowerAmount)
    lab.setPush(config.pushIn, config.pushAmount)
    setOutputs()
    syncStored()
    setCompareState('effects', kind === 'turn-only' ? '仅转桌' : '全开')
  }

  function resetCameraDefaults() {
    cancelCompare()
    Object.assign(config, { firstAnchor: 'follow', eyeHeight: 1.68, backOffset: .1, fov: 72, viewSeat: null })
    lab.setFirstCamera(config)
    setOutputs()
    syncStored()
    setCompareState('reset', '镜头已恢复默认')
  }

  function resetAllDefaults() {
    cancelCompare()
    const speaker = lab.snapshot().ownRole
    Object.assign(config, normalizeConfig({}), {
      turns: 2,
      duration: 3,
      shortDuration: 1,
      alignOffset: 36,
      view: 'god',
      seatBack: true,
      backAmount: .1,
      lowerView: true,
      lowerAmount: .45,
      spotlight: false,
      pushIn: true,
      pushAmount: .45,
      holdOn: true,
      hold: 1.2,
      firstAnchor: 'follow',
      eyeHeight: 1.68,
      backOffset: .1,
      fov: 72,
      viewSeat: null,
    })
    config.speaker = speaker
    loop = false
    slow = false
    lab.setLoop(false)
    lab.setTimeScale(1)
    lab.reset()
    onExit?.()
    lab.setDemoSpeaker(speaker)
    lab.setFirstCamera(config)
    lab.setSeatBack(config.seatBack, config.backAmount)
    lab.setLowerView(config.lowerView, config.lowerAmount)
    lab.setSpotlight(config.spotlight)
    lab.setPush(config.pushIn, config.pushAmount)
    setOutputs()
    syncStored()
    ;['self', 'other', 'stop'].forEach(group => setCompareState(group, '未对比'))
    setCompareState('effects', '按下方开关')
    setCompareState('reset', '已恢复全部默认（A/B 保留）')
  }

  function nextViewSeat() {
    const current = config.viewSeat
    config.viewSeat = current === null ? 0 : (Number(current) + 1) % 5
    lab.setFirstCamera(config)
    setOutputs()
    syncStored()
  }

  function handleAction(action) {
    if (action === 'close') return close()
    if (action === 'play') { cancelCompare(); return lab.playTurn(config) }
    if (action === 'stop') { cancelCompare('已停止对比'); return lab.stop() }
    if (action === 'reset') { cancelCompare('已复位'); lab.reset(); onExit?.(); return updateStatus(lab.snapshot()) }
    if (action === 'skip') { cancelCompare('已跳过'); return lab.skip() }
    if (action === 'mirror') {
      const url = mirrorUrl?.(currentPresetId())
      if (!url) return
      const opened = window.open(url, '_blank', 'noopener')
      if (!opened) notify?.('浏览器拦截了新窗口，请允许本站弹出窗口后重试。')
      return
    }
  }

  function handleClick(event) {
    const compare = event.target.closest('[data-lab-compare]')
    if (compare) {
      const [group, slot] = compare.dataset.labCompare.split('-')
      if (slot === 'ab') startCompareRun(group, compareSteps(group))
      else runCompareSlot(group, slot.toUpperCase())
      return
    }
    const rhythm = event.target.closest('[data-lab-rhythm]')
    if (rhythm) {
      if (rhythm.dataset.labRhythm === 'cycle') startRhythmCycle()
      else applyRhythm(rhythm.dataset.labRhythm)
      return
    }
    const effects = event.target.closest('[data-lab-effects]')
    if (effects) { setEffectsPreset(effects.dataset.labEffects); return }
    const reset = event.target.closest('[data-lab-reset]')
    if (reset) {
      if (reset.dataset.labReset === 'camera') resetCameraDefaults()
      else resetAllDefaults()
      return
    }
    if (event.target.closest('[data-lab-seat-next]')) { nextViewSeat(); return }
    const effect = event.target.closest('[data-lab-effect]')
    if (effect && !effect.disabled) {
      const id = effect.dataset.labEffect
      if (LAB_PRESETS[id]) applyPreset(id)
      else notify?.('这个能力尚未实现，按钮保持禁用。')
      return
    }
    const preset = event.target.closest('[data-lab-preset]')
    if (preset) return applyPreset(preset.dataset.labPreset)
    const view = event.target.closest('[data-lab-view]')
    if (view) {
      cancelCompare()
      config.view = view.dataset.labView
      setOutputs()
      lab.setView(config.view)
      syncStored()
      return
    }
    const toggle = event.target.closest('[data-lab-toggle]')
    if (toggle) {
      cancelCompare()
      const name = toggle.dataset.labToggle
      if (name === 'loop') { loop = !loop; lab.setLoop(loop) }
      if (name === 'slow') { slow = !slow; lab.setTimeScale(slow ? .5 : 1) }
      setOutputs()
      syncStored()
      return
    }
    const abButton = event.target.closest('[data-lab-ab]')
    if (abButton) {
      cancelCompare()
      const [, verb, slot] = abButton.dataset.labAb.match(/^(apply|save)-([AB])$/) || []
      if (verb === 'apply' && ab[slot]) {
        Object.assign(config, normalizeConfig(ab[slot]))
        setOutputs()
        syncStored()
        lab.reset()
        lab.playTurn(config)
      } else if (verb === 'save') {
        ab[slot] = normalizeConfig(config)
        syncStored()
        notify?.(`当前参数已存为 ${slot}。`)
      }
      return
    }
    const action = event.target.closest('[data-lab-action]')
    if (action) handleAction(action.dataset.labAction)
  }

  function openPanel() {
    open = true
    panel.hidden = false
    document.body.classList.add('lab-open')
    document.querySelector('#demo-panel').hidden = true
    document.querySelector('#demo-toggle').setAttribute('aria-expanded', 'false')
    setOutputs()
    syncDebugOutputs()
    updateStatus(lab.snapshot())
  }

  function close() {
    cancelCompare()
    open = false
    panel.hidden = true
    document.body.classList.remove('lab-open')
    lab.reset()
    onExit?.()
  }

  openButton.addEventListener('click', openPanel)
  panel.addEventListener('click', handleClick)
  panel.addEventListener('input', event => { handleDebug(event); handleConfigInput(event); handleSpeaker(event) })
  panel.addEventListener('change', event => { handleDebug(event); handleConfigInput(event); handleSpeaker(event) })
  lab.subscribe(snapshot => {
    updateStatus(snapshot)
    if (compareRunning && compareStep && snapshot.finished && !snapshot.playing && !compareTimer) {
      compareTimer = setTimeout(() => { compareTimer = null; runNextCompareStep() }, 800)
    }
  })
  if (!Number.isInteger(config.speaker)) config.speaker = lab.snapshot().ownRole
  lab.setDemoSpeaker(config.speaker)
  lab.setFirstCamera(config)
  lab.setTimeScale(slow ? .5 : 1)
  lab.setLoop(loop)
  if (stored.speaker) lab.setDemoSpeaker(stored.speaker)
  render()

  return {
    open: openPanel,
    close,
    isOpen: () => open,
    playPreset: id => applyPreset(id),
    getConfig: () => ({ ...config }),
  }
}
