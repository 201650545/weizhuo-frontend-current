import { legacySceneDocument } from './legacy-scenes.js?v=20261126-preview9'

const $ = selector => document.querySelector(selector)
const STORE = 'weizhuo:preview:v1'
const SUBJECT = new URL('http://127.0.0.1:5189/主体原型/')
const mainPlan = (id = 'current', title = '当前实现') => ({ id, title, integrated: true })
const legacy = (id, title) => ({ id, title, legacy: id })
const groups = [
  { title: '开场与入场', scenes: [
    { id: 'welcome', title: '电脑欢迎页与扫码', desktop: true, screen: 'welcome', plans: [mainPlan()] },
    { id: 'intro', title: '手机顶光唤醒', stage: 'intro', duration: 8.8, plans: [mainPlan('lamp', '顶光唤醒')] },
    { id: 'transition', title: '顶光 → 选本过渡', stage: 'intro', plans: [
      { id: 'beam', title: '光柱即隧道', trans: 1, duration: 7.2, handoff: 6.1 },
      { id: 'table', title: '光落成桌', trans: 2, duration: 8.6, handoff: 7.8 },
      { id: 'stars', title: '碎成星空', trans: 3, duration: 8, handoff: 6.9 },
    ] },
    { id: 'arrival', title: '入场备选', plans: [legacy('arrivec', '时空入场'), { id: 'door', title: '推门入席', stage: 'arrive' }] },
  ] },
  { title: '选本与建房', scenes: [
    { id: 'corridor', title: '选本走廊', stage: 'corridor', plans: [mainPlan('depth', '纵深通道'), { id: 'csscorr', title: 'CSS 纵深通道', page: './css-corridor.html' }, legacy('cf', '3D 封面流'), legacy('flip', '翻开封面'), legacy('deck', '牌堆'), legacy('tilt', '光斑倾斜'), legacy('cine', '滚动电影')] },
    { id: 'detail', title: '剧本详情', stage: 'detail', plans: [mainPlan('spread', '四页翻书'), { id: 'layout', title: '详情排版备选', library: true }] },
    { id: 'hosting', title: '主持方式与建房', screen: 'hosting', plans: [
      mainPlan(),
      { id: 'ritual', title: '开桌仪式（三步）', page: './hosting-ritual.html' },
      { id: 'plain', title: '极简一屏表单', page: './hosting-plain.html' },
    ] },
    { id: 'join', title: '输入房间码', screen: 'join-code', plans: [mainPlan()] },
  ] },
  { title: '入房与准备', scenes: [
    { id: 'seating', title: '选角与入席', phase: 'join', plans: [
      mainPlan(),
      { id: 'candle', title: '暗场烛光', mood: 'candle' },
      { id: 'night', title: '夜色窗光', mood: 'night' },
    ] },
    { id: 'ready', title: '阅读角色与准备', phase: 'ready', plans: [mainPlan()] },
    { id: 'consent', title: '录音意愿', phase: 'consent', plans: [mainPlan()] },
    { id: 'gather', title: '座位聚拢动画', pending: true, plans: [] },
  ] },
  { title: '正式游戏', scenes: [
    { id: 'introductions', title: '自我介绍', phase: 'intro', plans: [mainPlan()] },
    { id: 'ask', title: '初始提问', phase: 'ask', plans: [mainPlan()] },
    { id: 'clue1', title: '第一轮线索', phase: 'clue1', plans: [mainPlan()] },
    { id: 'discuss1', title: '第一轮讨论', phase: 'discuss1', plans: [mainPlan()] },
    { id: 'clue2', title: '第二轮线索', phase: 'clue2', plans: [mainPlan()] },
    { id: 'discuss2', title: '第二轮讨论', phase: 'discuss2', plans: [mainPlan()] },
    { id: 'vote', title: '秘密投票', phase: 'vote', plans: [mainPlan()] },
  ] },
  { title: '揭晓与谢幕', scenes: [
    { id: 'tally', title: '公开票型', phase: 'tally', plans: [mainPlan()] },
    { id: 'tie', title: '平票讨论与复投', phase: 'tie', plans: [mainPlan()] },
    { id: 'exit', title: '一席退场', phase: 'exit', plans: [mainPlan()] },
    { id: 'silence', title: '静候真相', phase: 'silence', plans: [mainPlan()] },
    { id: 'identity', title: '身份揭晓', phase: 'identity', plans: [mainPlan()] },
    { id: 'truth', title: '案件真相', phase: 'truth', plans: [mainPlan()] },
    { id: 'outcome', title: '本局结果', phase: 'outcome', plans: [mainPlan()] },
    { id: 'ended', title: '散场', phase: 'ended', plans: [mainPlan()] },
  ] },
]
const scenes = groups.flatMap(group => group.scenes.map(scene => ({ ...scene, group: group.title })))
const findScene = id => scenes.find(scene => scene.id === id)
function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem(STORE) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch { return {} }
}
let saved = readSaved()
const previousVisit = { ...saved }
const query = new URLSearchParams(location.search)
const oldTab = query.get('tab')
const oldScene = oldTab === 'arrivec' ? 'arrival' : oldTab ? 'corridor' : ''
let scene = findScene(query.get('scene')) || findScene(oldScene) || findScene(saved.scene) || findScene('transition')
let selections = saved.selections && typeof saved.selections === 'object' ? saved.selections : {}
let viewedPlans = saved.viewedPlans && typeof saved.viewedPlans === 'object' ? saved.viewedPlans : {}
if (oldTab && scene.plans.some(plan => plan.id === oldTab)) viewedPlans[scene.id] = oldTab
let perspective = ['owner', 'invited', 'computer', 'host'].includes(saved.perspective) ? saved.perspective : 'owner'
let device = ['portrait', 'landscape', 'desktop'].includes(saved.device) ? saved.device : 'portrait'
let comparing = false
let comparedIds = []
let playing = false
let elapsed = 0
let clockStart = 0
let tick = 0
let renderToken = 0
let frames = []
let applyingHistory = false
let noticeTimer

function selectedPlan() {
  return scene.plans.find(plan => plan.id === viewedPlans[scene.id]) || scene.plans[0]
}
function visiblePlans() {
  // Three simultaneous renderers keep motion comparisons readable and bounded.
  return comparing ? scene.plans.filter(plan => comparedIds.includes(plan.id)) : selectedPlan() ? [selectedPlan()] : []
}
function duration() { return Math.max(0, ...visiblePlans().map(plan => plan.duration || scene.duration || 0)) }
function save() {
  const value = { scene: scene.id, viewedPlans, selections, perspective, device, continuous: $('#continuous').checked, elapsed }
  try { localStorage.setItem(STORE, JSON.stringify(value)) } catch { notify('浏览器无法保存选择，请保留当前页面。') }
}
function updateAddress() {
  if (applyingHistory) return
  const url = new URL(location.href)
  url.search = ''
  url.searchParams.set('scene', scene.id)
  if (selectedPlan()) url.searchParams.set('plan', selectedPlan().id)
  url.hash = ''
  history.replaceState(null, '', url)
}
function notify(text) {
  $('#notice').textContent = text
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { $('#notice').textContent = '' }, 7000)
}
function renderNav() {
  $('#flowNav').replaceChildren(...groups.map(group => {
    const section = document.createElement('section')
    section.className = 'flow-group'
    const heading = document.createElement('h2')
    heading.textContent = group.title
    section.append(heading)
    for (const item of group.scenes) {
      const button = document.createElement('button')
      button.className = 'flow-link'
      button.dataset.scene = item.id
      button.setAttribute('aria-current', item.id === scene.id ? 'step' : 'false')
      const label = document.createElement('span')
      label.textContent = item.title
      const status = document.createElement('small')
      status.textContent = item.pending ? '待制作' : selections[item.id] ? '已选' : item.plans.some(plan => plan.integrated) ? '已有画面' : '待选'
      button.append(label, status)
      button.addEventListener('click', () => navigate(item.id))
      section.append(button)
    }
    return section
  }))
}
function renderPlans() {
  $('#plans').replaceChildren(...scene.plans.map(plan => {
    const button = document.createElement('button')
    button.className = 'plan-button'
    button.dataset.plan = plan.id
    button.setAttribute('aria-pressed', String(comparing ? comparedIds.includes(plan.id) : plan.id === selectedPlan()?.id))
    button.textContent = plan.title
    const small = document.createElement('small')
    small.textContent = selections[scene.id] === plan.id ? '已选' : plan.integrated ? '已接入主体' : plan.legacy ? '其他方案' : '待选'
    button.append(small)
    button.addEventListener('click', () => {
      if (comparing) {
        if (comparedIds.includes(plan.id)) {
          if (comparedIds.length === 1) return
          comparedIds = comparedIds.filter(id => id !== plan.id)
        } else {
          if (comparedIds.length >= 3) { notify('一次可比较三个方案，请先取消一个。'); return }
          comparedIds.push(plan.id)
        }
      } else viewedPlans[scene.id] = plan.id
      elapsed = 0
      render()
    })
    return button
  }))
}
function sourceFor(plan) {
  /* page：独立页面形式的方案（纯 CSS 实验版），只是换个地址，其余预览逻辑不变 */
  if (plan.page) return new URL(plan.page, location.href).href
  const url = new URL(SUBJECT)
  url.searchParams.set('preview', '1')
  url.searchParams.set('demo', '1')
  url.searchParams.set('embed', '1')
  const computer = scene.desktop || perspective === 'computer'
  const host = perspective === 'host' && !!scene.phase
  url.searchParams.set('endpoint', computer ? 'computer' : host ? 'host' : 'player')
  if (!computer && !host) url.searchParams.set('phone', '1')
  url.searchParams.set('previewRole', perspective)
  if (plan.mood) url.searchParams.set('mood', plan.mood)
  if (scene.phase) {
    url.searchParams.set('previewPhase', scene.phase)
    if (computer) url.searchParams.set('stage', '1')
  } else if (scene.screen) {
    url.searchParams.set('previewScreen', scene.screen)
  } else {
    url.searchParams.set('shelf', '1')
    url.searchParams.set('fresh', '1')
    url.searchParams.set('stage', plan.stage || scene.stage || 'corridor')
    if (plan.trans) url.searchParams.set('trans', String(plan.trans))
    if (scene.stage === 'intro') url.searchParams.set('lampAt', String(Math.min(elapsed, plan.handoff ? plan.handoff - .01 : duration() - .01)))
  }
  url.searchParams.set('v', '20261125-preview1')
  if (plan.library) return new URL('/docs/04_过程稿/预览库/2026-11-20_排版_选本页四方案.html', SUBJECT).href
  return url.href
}
function dimensions(plan) {
  if (plan.library) return [1440, 900]
  if (scene.desktop || device === 'desktop') return [1440, 900]
  return device === 'landscape' ? [824, 370] : [370, 824]
}
function fitFrames() {
  for (const item of frames) {
    const [width, height] = dimensions(item.plan)
    const availableWidth = Math.max(160, item.wrap.clientWidth)
    const availableHeight = innerWidth <= 620 ? 660 : Math.max(250, innerHeight - $('#screens').getBoundingClientRect().top - 230)
    const scale = Math.min(availableWidth / width, availableHeight / height, 1)
    item.viewport.style.width = `${Math.floor(width * scale)}px`
    item.viewport.style.height = `${Math.floor(height * scale)}px`
    item.frame.style.width = `${width}px`
    item.frame.style.height = `${height}px`
    item.frame.style.transform = `scale(${scale})`
  }
}
function statusText(plan) {
  if (selections[scene.id] === plan.id) return plan.integrated ? '已选 · 已接入主体' : '已选 · 待接入主体'
  return plan.integrated ? '已接入主体' : '待选择'
}
function renderScreens() {
  const container = $('#screens')
  frames = []
  container.replaceChildren()
  container.classList.toggle('comparing', comparing)
  container.style.setProperty('--count', String(visiblePlans().length))
  if (scene.pending) {
    const empty = document.createElement('div')
    empty.className = 'empty-scene'
    empty.innerHTML = '<h3>这个动画还待制作</h3><p>完成后，方案会出现在当前流程下。</p>'
    container.append(empty)
    return
  }
  const token = ++renderToken
  for (const plan of visiblePlans()) {
    const card = document.createElement('article')
    card.className = 'screen-card'
    card.dataset.plan = plan.id
    const heading = document.createElement('div')
    heading.className = 'screen-title'
    const title = document.createElement('strong')
    title.textContent = plan.title
    const status = document.createElement('span')
    status.textContent = statusText(plan)
    heading.append(title, status)
    const wrap = document.createElement('div')
    wrap.className = 'viewport-wrap'
    const viewport = document.createElement('div')
    viewport.className = 'viewport'
    const frame = document.createElement('iframe')
    frame.title = `${scene.title} · ${plan.title}`
    frame.setAttribute('allow', 'fullscreen')
    const footer = document.createElement('div')
    footer.className = 'screen-footer'
    const pick = document.createElement('button')
    pick.textContent = selections[scene.id] === plan.id ? '已选用' : '选用此方案'
    pick.setAttribute('aria-pressed', String(selections[scene.id] === plan.id))
    pick.addEventListener('click', () => {
      selections[scene.id] = plan.id
      viewedPlans[scene.id] = plan.id
      save()
      updateAddress()
      $('#sceneStatus').textContent = plan.integrated ? '已选 · 已接入主体' : '已选 · 待接入主体'
      renderNav()
      renderPlans()
      for (const item of frames) {
        item.status.textContent = statusText(item.plan)
        item.pick.textContent = selections[scene.id] === item.plan.id ? '已选用' : '选用此方案'
        item.pick.setAttribute('aria-pressed', String(selections[scene.id] === item.plan.id))
      }
      notify(`已记录「${plan.title}」${plan.integrated ? '，当前主体已采用。' : '，等待接入主体。'}`)
    })
    const open = document.createElement('a')
    open.textContent = '原尺寸打开 ↗'
    open.target = '_blank'
    open.rel = 'noopener'
    footer.append(pick, open)
    viewport.append(frame)
    wrap.append(viewport)
    card.append(heading, wrap, footer)
    container.append(card)
    frames.push({ frame, plan, wrap, viewport, status, pick, loaded: false, ready: false })
    const item = frames[frames.length - 1]
    frame.addEventListener('load', () => {
      if (token !== renderToken) return
      item.loaded = true
      if (plan.legacy) {
        // Hide the old selection buttons. The outer page persists the decision.
        try { frame.contentDocument.querySelectorAll('.pick').forEach(button => { button.hidden = true }) } catch { /* Same-origin document can finish loading later. */ }
      }
      updatePlayback()
    })
    if (plan.legacy) {
      frame.srcdoc = legacySceneDocument(plan.legacy)
      open.href = `${location.pathname}?scene=${scene.id}&plan=${plan.id}`
    } else {
      frame.src = sourceFor(plan)
      open.href = frame.src
    }
  }
  fitFrames()
}
function updatePlayback() {
  const timed = duration() > 0
  $('#timeline').hidden = !timed
  $('#seek').max = String(duration() || 1)
  $('#seek').value = String(elapsed)
  $('#timeReadout').textContent = `${elapsed.toFixed(1)} / ${duration().toFixed(1)} 秒`
  const ready = frames.length > 0 && frames.every(item => item.ready)
  $('#play').disabled = !timed || playing || !ready
  $('#pause').disabled = !timed || !playing
  $('#replay').disabled = scene.pending || (timed && !ready)
  $('#seek').disabled = timed && !ready
  $('#continuous').disabled = !timed
  $('#compare').disabled = scene.plans.length < 2
  $('#single').setAttribute('aria-pressed', String(!comparing))
  $('#compare').setAttribute('aria-pressed', String(comparing))
  $('#next').disabled = scenes.indexOf(scene) === scenes.length - 1
  $('#playbackNote').textContent = timed
    ? '拖动进度可定格。单步播放停在走廊交接画面，勾选连播可继续下一流程。'
    : scene.pending ? '当前节点待制作。' : '可直接操作画面。重播会恢复当前画面，下一步进入后续流程。'
}
function render() {
  stopClock()
  $('#breadcrumb').textContent = scene.group
  $('#sceneTitle').textContent = scene.title
  $('#sceneStatus').textContent = scene.pending ? '待制作' : scene.phase ? '现有画面 · 演示数据' : selections[scene.id] ? statusText(scene.plans.find(plan => plan.id === selections[scene.id]) || selectedPlan()) : scene.plans.some(plan => plan.integrated) ? '已有画面' : '方案待选'
  $('#perspective').value = scene.desktop ? 'computer' : perspective
  $('#perspective').disabled = !!scene.desktop
  $('#device').value = scene.desktop ? 'desktop' : device
  $('#device').disabled = !!scene.desktop
  // Before a room exists, the entry screens belong to the player journey.
  for (const option of $('#perspective').options) option.disabled = !scene.phase && !scene.desktop && ['host', 'computer'].includes(option.value)
  if (!scene.phase && !scene.desktop && ['host', 'computer'].includes(perspective)) {
    perspective = 'owner'
    $('#perspective').value = perspective
  }
  renderNav()
  renderPlans()
  renderScreens()
  updatePlayback()
  updateAddress()
  save()
}
function navigate(id) {
  const next = findScene(id)
  if (!next) return
  scene = next
  comparing = false
  elapsed = 0
  render()
}
function nextScene() {
  const following = { intro: 'transition', transition: 'corridor', arrival: 'corridor', corridor: 'detail', detail: 'hosting', hosting: 'seating', join: 'seating', consent: 'introductions', discuss2: 'vote', tally: 'exit', tie: 'vote' }
  const next = findScene(following[scene.id]) || scenes.slice(scenes.indexOf(scene) + 1).find(item => !item.pending)
  if (next) navigate(next.id)
}
function stopClock() {
  playing = false
  cancelAnimationFrame(tick)
  tick = 0
}
function sendClock(command) {
  for (const item of frames) {
    if (item.plan.legacy || item.plan.library) continue
    item.frame.contentWindow?.postMessage({ type: 'weizhuo:preview-clock', command, time: elapsed, at: performance.timeOrigin + performance.now(), holdAtEnd: true }, SUBJECT.origin)
  }
}
function stepClock(now) {
  if (!playing) return
  elapsed = Math.min(duration(), (now - clockStart) / 1000)
  updatePlayback()
  if (elapsed >= duration()) {
    stopClock()
    save()
    if ($('#continuous').checked) nextScene()
    updatePlayback()
    return
  }
  tick = requestAnimationFrame(stepClock)
}
function play() {
  if (!duration()) return
  if (elapsed >= duration()) elapsed = 0
  playing = true
  clockStart = performance.now() - elapsed * 1000
  sendClock('play')
  tick = requestAnimationFrame(stepClock)
  updatePlayback()
}
$('#perspective').addEventListener('change', event => {
  perspective = event.target.value
  device = ['computer', 'host'].includes(perspective) ? 'desktop' : 'portrait'
  render()
})
$('#device').addEventListener('change', event => { device = event.target.value; render() })
$('#single').addEventListener('click', () => { comparing = false; render() })
$('#compare').addEventListener('click', () => {
  comparing = true
  comparedIds = scene.plans.slice(0, 3).map(plan => plan.id)
  if (selectedPlan() && !comparedIds.includes(selectedPlan().id)) comparedIds[comparedIds.length - 1] = selectedPlan().id
  elapsed = 0
  render()
})
$('#replay').addEventListener('click', () => {
  elapsed = 0
  if (duration()) { sendClock('seek'); play() }
  else render()
})
$('#play').addEventListener('click', play)
$('#pause').addEventListener('click', () => { stopClock(); sendClock('seek'); updatePlayback(); save() })
$('#seek').addEventListener('input', event => {
  stopClock()
  elapsed = Number(event.target.value)
  sendClock('seek')
  updatePlayback()
})
$('#seek').addEventListener('change', save)
$('#next').addEventListener('click', nextScene)
$('#continuous').checked = saved.continuous === true
$('#continuous').addEventListener('change', save)
$('#resume').addEventListener('click', () => {
  scene = findScene(previousVisit.scene) || findScene('transition')
  comparing = false
  elapsed = Number(previousVisit.elapsed) || 0
  render()
})
window.addEventListener('resize', fitFrames)
window.addEventListener('message', event => {
  if (event.origin !== SUBJECT.origin || event.data?.type !== 'weizhuo:preview-ready') return
  const item = frames.find(entry => entry.frame.contentWindow === event.source)
  if (!item) return
  item.ready = true
  updatePlayback()
  if (duration()) sendClock(playing ? 'play' : 'seek')
})
window.addEventListener('pagehide', () => { stopClock(); save() })
window.addEventListener('popstate', () => {
  applyingHistory = true
  const params = new URLSearchParams(location.search)
  scene = findScene(params.get('scene')) || scene
  if (scene.plans.some(plan => plan.id === params.get('plan'))) viewedPlans[scene.id] = params.get('plan')
  elapsed = 0
  render()
  applyingHistory = false
})
if (scene.plans.some(plan => plan.id === query.get('plan'))) viewedPlans[scene.id] = query.get('plan')
if ((!query.has('scene') || query.get('scene') === saved.scene) && !oldTab && Number.isFinite(saved.elapsed)) elapsed = Math.min(saved.elapsed, duration())
render()
