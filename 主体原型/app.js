/* animation-lab-20261121 */
/* animation-lab-done */
/* flow-ui-20261120 */
/* flow-ui-done */
import * as THREE from '../舞台原型/node_modules/three/build/three.module.js'
import { createStageViews, createStageLab, createDemoLab, playLabPreset } from './stage-views.js?v=20261123-lab10'
import { buildPuppet } from './puppet-model.js?v=20261123-walk4'
import { scriptCatalog } from './scripts-data.mjs?v=20261123-cast3'
import { initCanvasBoard } from './canvas-board.js?v=20261125-canvas22'
import { mountEntryCinema, resetEntryCinema } from './entry-cinema.js?v=20261125-preview1'

const names = scriptCatalog[0].cast.map(member => member.name)
const images = ['角色01_木偶版_1K.png', '角色02_周启明_木偶版_2K.png', '角色03_林素琴_木偶版_2K.png', '角色04_许承安_木偶版_2K.png', '角色05_何映秋_木偶版_2K.png']
const phases = [
  ['create', '布置这一场故事', '选择主持方式，准备五人的围桌。', 0],
  ['join', '等候入席', '五个座位，等待各自的故事。', 0],
  ['ready', '读一读你的故事', '角色卡在各自手机中阅读。', 0],
  ['consent', '开场之前', '每个人都可以决定是否同意录音。', 0],
  ['intro', '初次见面', '按举手顺序介绍自己，听一听彼此的故事。', 1],
  ['ask', '你想问谁', '线索开放之前，先聊聊刚才的介绍。', 2],
  ['clue1', '第一封线索', '公共线索与个人线索同时开放。', 3],
  ['discuss1', '话语之间', '第一轮讨论与提问。', 3],
  ['clue2', '另一面故事', '第二轮线索已经开放。', 4],
  ['discuss2', '最后的疑问', '第二轮讨论与提问。', 4],
  ['vote', '把答案留在心里', '每个人秘密提交选择，结束后统一公开。', 5],
  ['tally', '此刻，揭开选择', '本轮投票已经结束。', 5],
  ['tie', '再听一听彼此', '重新讨论后，向全部五名玩家复投。', 5],
  ['exit', '一席落幕', '机关轻响，木偶缓缓退入幕后。', 6],
  ['silence', '静候真相', '让这一刻，安静两秒。', 6],
  ['identity', '面具之后', '身份揭晓。', 6],
  ['truth', '故事的全貌', '案件真相揭晓。', 6],
  ['outcome', '这一场的答案', '本局结果已经确定。', 6],
  ['ended', '散场，再会', '故事落幕，留下一桌回忆。', 7],
]
const scripts = scriptCatalog.map(script => ({
  ...script,
  roles: script.cast.map(member => member.name),
}))
/* 画布三镜演示：2 停在入场动画，3 直接停在选本后的详情页（只影响本地视图） */
const demoStep = new URLSearchParams(location.search).get('demoStep') || ''
let scriptDetail = demoStep === '3' ? scriptCatalog[0].id : null
let creatingRoom = false
let pendingShare = null

const journeyNames = ['入席与准备', '自我介绍', '初始提问', '第一轮线索与讨论', '第二轮线索与讨论', '秘密投票', '落幕与真相', '本局结束']
const byId = Object.fromEntries(phases.map(phase => [phase[0], phase]))
let state
let player = 0
let tab = 'stage'
let toastTimeout
let sceneView
let stageLab = null
let labUI = null
let labDemoApplied = false
let tableScale = 1
let chairScale = 1
let floorOffset = 0
let fullscreenRequested = false
let computerFullscreenActive = false
const params = new URLSearchParams(location.search)
const phoneEntry = params.get('phone') === '1'
const touchPhone = navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches
const phoneMode = phoneEntry || touchPhone
if (phoneMode) document.body.dataset.device = 'phone'
// embed=1 表示这页被总览 iframe 内嵌；stage=1 表示内嵌的电脑副本直接进公共舞台。
const embedMode = params.get('embed') === '1'
const forceComputerStage = params.get('stage') === '1'
if (embedMode) document.body.dataset.embed = '1'
/* 画布镜像：mirror=computer|host|owner|invited，只读，不占席位、不写房间状态 */
const mirrorParam = params.get('mirror') || ''
const mirrorMode = (['computer', 'host', 'owner', 'invited'].includes(mirrorParam) || /^seat[0-4]$/.test(mirrorParam)) ? mirrorParam : ''
/* lobby=1：画布大厅态，镜像只要大厅快照（电脑端待扫码），不跟随任何房间 */
const lobbyMirror = params.get('lobby') === '1' && !!mirrorMode
if (mirrorMode) document.body.dataset.mirror = mirrorMode
let endpoint = phoneMode ? 'player' : (params.get('endpoint') || 'computer')
if (!['computer', 'host', 'player', 'test', 'owner', 'invited', 'overview'].includes(endpoint)) endpoint = 'computer'
// 电脑主机端首屏先选本：只有确认过“进入这一场”的房间号才直接上舞台。
// 服务端会把房间存在 .cache 里跨重启恢复，不记住这一步就会一开机显示“等候入席”。
const BOARD_KEY = 'weizhuo:computerBoard'
/* cast=all：纯展示入口，让五个角色同时从黑暗里出场，不依赖房间是否满员。 */
const demoCast = params.get('cast') === 'all'
let computerBoardRoom = readBoardRoom()
let computerBoardScript = ''
let lastPhaseForBoard = null
let autoFollowRoom = ''
// 首帧本地状态是 create，服务端快照回来才变 join，不能把这一次误判成“刚建房”。
let roomSnapshots = 0
function readBoardRoom() {
  try { return sessionStorage.getItem(BOARD_KEY) || '' } catch { return '' }
}
function setComputerBoard(code) {
  computerBoardRoom = code || ''
  /* 镜像页不写共享 sessionStorage，画布不替电脑端记住房号 */
  if (mirrorMode || params.get('preview') === '1') return
  // 电脑主机端在“进入这一场”的点击里顺手切到浏览器全屏：这一步在用户手势内，才不会被浏览器拒绝。
  if (code && endpoint === 'computer' && !embedMode && !document.fullscreenElement) {
    document.querySelector('.theatre')?.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {})
  }
  try {
    if (code) sessionStorage.setItem(BOARD_KEY, code)
    else sessionStorage.removeItem(BOARD_KEY)
  } catch { /* 隐私模式忽略 */ }
}
let playerSceneOpen = false
let playerSceneBootRestore = true
let stagePanel = null
const previewMode = params.get('preview') === '1'
const networked = !previewMode && params.get('demo') !== '1'
const testDevice = new URLSearchParams(location.search).get('testDevice')
const forceShelf = params.get('shelf') === '1'
let entryMode = demoStep === '3' ? 'library' : (forceShelf || params.get('demoStep') === '2' || !params.get('room') ? 'shelf' : 'join')
// 双玩家测试、房主、受邀与总览共用同一个测试房间，房号从房主测试会话里取。
const TEST_ENDPOINTS = new Set(['test', 'owner', 'invited', 'overview'])
function isTestEndpoint() { return TEST_ENDPOINTS.has(endpoint) }
// 桌面本机页面（电脑/主持/房主/受邀/画布）共用同一个测试房间；iframes 里的测试身份不显示演示工具。
const demoDevice = !testDevice && !phoneMode
let testRoomCode = ''
let testRoomState = null
/* 画布页首次进入时自动展开一次演示工具，用户手动收起后不再自动打开 */
let canvasDemoUserClosed = false
let testRoomPoll = null
let canvasBoard = null
let canvasMirrorRoom = ''
let accordionPanel = 'story'
let bootReleased = false
let roomCodeDraft = ''
let invitationQrOpen = true
let musicLibrary = []
let musicLibraryStatus = 'loading'
let musicLibraryError = ''
let musicEnabled = false
let musicTrackIndex = 0
let preparationLoop = true
let musicLibraryRequest
let musicLoadedUrl = ''
let musicPlayToken = 0
const musicAudio = new Audio()
musicAudio.preload = 'metadata'
const preparationTrackTitles = ['O Come O Come Emmanuel', 'the grotto', 'old doll']
function preparationTracks() {
  return preparationTrackTitles.map(title => musicLibrary.find(track => track.title === title)).filter(Boolean)
}
musicAudio.addEventListener('ended', () => {
  if (!musicEnabled) return
  if (!preparationLoop) {
    musicEnabled = false
    renderMusicControls()
    return
  }
  const preparation = preparationTracks()
  if (!preparation.length) return
  const next = preparation[(preparation.findIndex(track => track.title === musicLibrary[musicTrackIndex]?.title) + 1) % preparation.length]
  musicTrackIndex = musicLibrary.indexOf(next)
  playMusicTrack(next)
})
async function loadMusicLibrary() {
  musicLibraryStatus = 'loading'
  musicLibraryError = ''
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    // 服务端的静态白名单按完整路径匹配，带查询串会 404，曲库一直加载失败。
    const response = await fetch('/主体原型/music-library.json', { cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new Error(`曲库加载失败（${response.status}）`)
    const items = await response.json()
    if (!Array.isArray(items) || items.length === 0) throw new Error('曲库没有可播放的曲目。')
    musicLibrary = items
    musicLibraryStatus = 'ready'
    const firstPreparationTrack = preparationTracks()[0]
    if (firstPreparationTrack) musicTrackIndex = musicLibrary.indexOf(firstPreparationTrack)
  } catch (error) {
    musicLibraryStatus = 'failed'
    musicLibraryError = error.name === 'AbortError' ? '曲库请求超时。' : error.message
  } finally {
    clearTimeout(timeout)
  }
}
musicLibraryRequest = loadMusicLibrary()
function apiUrl(path) {
  const url = new URL(path, location.origin)
  if (testDevice) url.searchParams.set('testDevice', testDevice)
  return url.pathname + url.search
}

function playMusicTrack(track) {
  if (!track) return
  const url = apiUrl(`/api/music/${encodeURIComponent(track.file)}`)
  const token = ++musicPlayToken
  // 同一首曲目不要重复赋 src：手机端点第二下会打断上一段加载（AbortError），
  // 看起来就是“再点一次还是不生效”，实际每次都在重新缓冲。
  if (musicLoadedUrl !== url) {
    musicLoadedUrl = url
    musicAudio.src = url
  }
  musicAudio.playbackRate = Number(state?.musicRate || 0.9)
  musicAudio.play().then(() => {
    if (token !== musicPlayToken) return
    musicEnabled = true
    renderMusicControls()
  }).catch(error => {
    if (token !== musicPlayToken) return
    // AbortError 只是上一次 play() 被新的加载打断，不代表浏览器拦了播放，不要弹提示。
    if (error && error.name === 'AbortError') return
    musicEnabled = false
    renderMusicControls()
    if (error && error.name === 'NotAllowedError') return notify('浏览器拦下了这次播放，请再点一次音乐按钮。')
    if (error && error.name === 'NotSupportedError') return notify('这首歌的格式当前设备放不了，换一首试试。')
    notify('音乐没有播放出来，请再点一次或检查局域网连接。')
  })
}

const MUSIC_RATES = [0.8, 0.85, 0.9, 0.95, 1]
function renderMusicControls() {
  document.querySelectorAll('[data-action="music-toggle"]').forEach(button => {
    button.setAttribute('aria-pressed', String(musicEnabled))
    button.setAttribute('aria-label', musicEnabled ? '停止音乐' : '播放音乐')
    button.title = musicEnabled ? '停止音乐' : '播放音乐'
    button.textContent = musicEnabled ? 'Ⅱ' : '♫'
  })
  const rate = Number(state?.musicRate || 0.9)
  musicAudio.playbackRate = rate
  // 设置弹窗是静态渲染的，按钮旁边的状态文字要跟着播放状态一起更新。
  document.querySelectorAll('#settings-dialog [data-action="music-toggle"] + span').forEach(span => {
    span.textContent = musicEnabled ? '正在播放' : '未播放'
  })
  document.querySelectorAll('.music-rate-select').forEach(select => { select.value = String(rate) })
  document.querySelectorAll('[data-action="cycle-music-rate"]').forEach(button => {
    button.textContent = `${rate}×`
    button.setAttribute('aria-label', `音乐倍速，当前 ${rate} 倍，点击切换`)
    button.title = `音乐倍速 ${rate}×`
  })
}

function toggleMusic() {
  if (musicEnabled) {
    musicAudio.pause()
    musicEnabled = false
    renderMusicControls()
    return
  }
  // 不能在 await 之后再调 play()：手势一过，手机浏览器就会以“未允许播放”为由拒绝。
  if (musicLibraryStatus !== 'ready') {
    if (musicLibraryStatus === 'failed') musicLibraryRequest = loadMusicLibrary()
    notify('曲库还在加载，等一两秒再点一次音乐按钮。')
    return
  }
  preparationLoop = true
  const selected = preparationTracks()[0]
  if (!selected) return notify('准备阶段曲目缺失，请打开曲库选择音乐。')
  musicTrackIndex = musicLibrary.indexOf(selected)
  playMusicTrack(selected)
}

async function showMusicLibrary() {
  if (musicLibraryStatus !== 'ready') {
    if (musicLibraryStatus === 'failed') musicLibraryRequest = loadMusicLibrary()
    await musicLibraryRequest
    if (musicLibraryStatus !== 'ready') return notify(`${musicLibraryError || '曲库加载失败。'}请检查局域网服务后重试。`)
  }
  const groups = ['A 静水', 'B 暗涌', 'C 怪诞', 'D 压迫', 'E 伤感', 'F 怀旧']
  document.querySelector('#music-library-content').innerHTML = groups.map(group => {
    const tracks = musicLibrary.map((track, index) => ({ ...track, index })).filter(track => track.group === group)
    if (!tracks.length) return ''
    return `<section class="music-group"><h3>${group}</h3>${tracks.map(track => `<button class="music-track" data-music-index="${track.index}"><span>${escaped(track.title)}</span><small>${escaped(track.durationLabel)} · ${escaped(track.emotion)}</small></button>`).join('')}</section>`
  }).join('')
  document.querySelector('#music-library-dialog').showModal()
}

let lan = { me: null, revision: -1, connected: false }
let lanEvents
let lanEventsRoom = ''
const ROOM_KEY = 'weizhuo:room'
// 房主与受邀设备各自记自己的房号：共用一把 key 会让受邀侧读到房主刚建的房间，
// 刷新后自动进房，破坏“必须手动输码加入”的边界。
function roomStorageKey() { return testDevice ? 'weizhuo:room:' + testDevice : ROOM_KEY }
function storedRoomCode() {
  /* 画布镜像页不读共享房号：房号只来自父画布的 setRoom 广播，避免串到别的房间 */
  if (mirrorMode || forceShelf) return ''
  try { return localStorage.getItem(roomStorageKey()) || '' } catch { return '' }
}
function rememberRoomCode(code) {
  if (!code) return
  /* 镜像页不改共享 localStorage，也不改自己的地址栏 */
  if (mirrorMode) return
  try { localStorage.setItem(roomStorageKey(), code) } catch { /* 隐私模式 */ }
  const url = new URL(location.href)
  if (url.searchParams.get('room') !== code) {
    url.searchParams.set('room', code)
    history.replaceState(null, '', url)
  }
}
function hasJoined() { return networked ? lan.me !== null : state.joined[player] }

function freshState() {
  return {
    musicRate: 0.9,
    scriptId: null, roomCode: null, roomOwner: null, seats: Array(5).fill(null), joined: Array(5).fill(false), seenShared: Array.from({ length: 5 }, () => []),
    phase: 'create', host: 'ai', manualControl: false, phaseSeconds: 0, roles: Array(5).fill(null), ready: Array(5).fill(false),
    consent: Array(5).fill(null), recorded: false,
    introduced: Array(5).fill(false), introQueueStarted: false, askQueue: [], queue: [], speaker: null, target: null,
    read: { 1: Array.from({ length: 5 }, () => [false, false]), 2: Array.from({ length: 5 }, () => [false, false]) },
    shared: [], confirmed: Array(5).fill(false), remaining: null, paused: false,
    votes: Array(5).fill(undefined), selectedVote: null, voteRound: 1, history: [], winner: null, voteAllAbstained: false,
    summaries: {}, versions: [], messages: [], events: [], disconnected: Array(5).fill(false),
    hostDisconnected: false, keptRecording: true,
  }
}

function currentCast() {
  return selectedScript().cast || scriptCatalog[0].cast
}

function castNames() {
  return currentCast().map(member => member.name)
}

function roleName(index) {
  const cast = currentCast()
  return (cast[state.roles[index] ?? index] || cast[index] || scriptCatalog[0].cast[index]).name
}

function escaped(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}

function action(label, name, argument = '', primary = false, disabled = false) {
  return `<button data-action="${name}" data-value="${argument}" class="${primary ? 'primary' : ''}" ${disabled ? 'disabled' : ''}>${label}</button>`
}

function notify(message) {
  const toast = document.querySelector('#toast')
  toast.textContent = message
  toast.hidden = false
  clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => { toast.hidden = true }, 3200)
}

function record(message) {
  state.events.push(message)
}

function isDiscussion() {
  return ['ask', 'discuss1', 'discuss2', 'tie'].includes(state.phase)
}

function roundNumber() {
  return ['clue2', 'discuss2', 'vote', 'tally', 'tie', 'exit', 'silence', 'identity', 'truth', 'outcome', 'ended'].includes(state.phase) ? 2 : 1
}

function go(phase) {
  state.phase = phase
  state.phaseSeconds = 0
  state.queue = phase === 'ask' ? [...(state.askQueue || [])] : []
  state.askQueue = []
  state.introQueueStarted = false
  state.speaker = null
  state.target = null
  if (phase === 'ask') state.speaker = state.queue.shift() ?? null
  state.confirmed.fill(false)
  state.remaining = null
  state.paused = false
  tab = 'stage'
  if (isDiscussion()) state.remaining = 60
  if (phase === 'vote') {
    state.votes = Array(5).fill(undefined)
    state.remaining = 180
    state.selectedVote = null
    state.voteAllAbstained = false
  }
  if (phase === 'silence') state.remaining = 2
  record(`进入${byId[phase][1]}`)
  render()
}

function finishDiscussion() {
  const phase = state.phase
  if (phase === 'discuss1' || phase === 'discuss2') {
    const round = phase === 'discuss1' ? 1 : 2
    state.summaries[round] = ''
    record(`第${round}轮总结等待手工补记，AI 服务未接入`)
  }
  go(({ ask: 'clue1', discuss1: 'clue2', discuss2: 'vote', tie: 'vote' })[phase])
}

function finishVote() {
  state.votes = state.votes.map(value => value === undefined ? null : value)
  const allAbstained = state.votes.every(value => value === null)
  const counts = Array(5).fill(0)
  state.votes.forEach(value => { if (value !== null) counts[value]++ })
  const highest = Math.max(...counts)
  const leaders = counts.flatMap((count, index) => count === highest ? [index] : [])
  state.winner = highest > 0 && leaders.length === 1 ? leaders[0] : null
  state.voteAllAbstained = allAbstained
  state.history.push({ round: state.voteRound, votes: [...state.votes], counts, allAbstained })
  go('tally')
}

function queuePlayer(index) {
  if (state.queue.includes(index) || state.speaker === index) return notify('你已经在发言或排队。')
  if (state.phase === 'intro' && state.introduced[index]) return notify('这一席已完成介绍。')
  if (state.phase === 'intro' && !state.introQueueStarted) {
    state.queue.push(index)
    if (state.queue.length === 5) {
      state.introQueueStarted = true
      state.speaker = state.queue.shift()
      record('五名玩家均已举手，开始按队列介绍。')
    }
  } else if (state.speaker === null) state.speaker = index
  else state.queue.push(index)
  state.remaining = null
  state.confirmed.fill(false)
  record(`${roleName(index)}举手`)
}

function queueAsk(index) {
  if (state.askQueue.includes(index) || state.speaker === index) return notify('你已经在提问队列中。')
  state.askQueue.push(index)
  record(`${roleName(index)}在介绍阶段排队提问`)
}

function nextSpeaker() {
  if (state.speaker !== null && state.phase === 'intro') state.introduced[state.speaker] = true
  state.speaker = state.queue.shift() ?? null
  state.target = null
  if (state.speaker === null && isDiscussion()) state.remaining = 60
}

const privateNotesKey = () => `weizhuo-notes:${state.roomCode || 'demo'}:${player}`
function readPrivateNotes() {
  try { return { text: '', favorites: [], mode: 'phone', ...JSON.parse(localStorage.getItem(privateNotesKey()) || '{}') } }
  catch { return { text: '', favorites: [], mode: 'phone' } }
}
function roleCard() {
  // 角色卡只属于玩家自己的设备；电脑公共屏与主持端即使共用同一份房间状态也不渲染。
  if (endpoint !== 'player') return '<h3>角色卡</h3><p>角色卡与个人笔记只在各自玩家设备上显示。</p>'
  const role = state.roles[player]
  if (role === null) return '<h3>选一个座位</h3><p>加入房间后，先领取自己的角色。</p>'
  const notes = readPrivateNotes()
  const saved = notes.favorites.includes('timeline-placeholder')
  const member = currentCast()[role]
  return `<div class="portrait"><img src="../图库素材/${images[role]}" alt="${escaped(member.name)}的角色设定"></div><h3>${escaped(member.name)}</h3><p class="muted">${escaped(member.identity)}</p><p>${escaped(member.bio)}</p><p class="muted">完整角色故事与关键时间线待编写。</p><section class="story-timeline role-timeline"><article><mark>关键时间 · 待填</mark><h4>事件标题待填</h4><p>正式角色故事提供后，按时间顺序整理事件，并突出重要时间与信息。</p></article><article><mark>人物关系 · 待填</mark><h4>关系变化待填</h4><p>当前为空白内容位，不代表剧本事实。</p></article></section><h4>重点收藏</h4><p class="muted">正文交付后，点按或长按标红重点即可收藏。</p><button data-action="favorite-toggle" data-value="timeline-placeholder" class="story-highlight ${saved ? 'saved' : ''}">${saved ? '已收藏' : '收藏重点示意'} · 正文待填</button><h4>个人笔记</h4><div class="actions"><button data-action="note-mode" data-value="phone" class="${notes.mode === 'phone' ? 'selected' : ''}">手机记录</button><button data-action="note-mode" data-value="paper" class="${notes.mode === 'paper' ? 'selected' : ''}">纸笔记录</button></div>${notes.mode === 'phone' ? `<textarea id="private-notes" maxlength="3000" placeholder="写下自己的观察……">${escaped(notes.text)}</textarea><button data-action="save-private-notes">保存笔记</button>` : '<p class="muted">已选择纸笔记录，可在纸上整理观察。</p>'}<p class="muted">这份内容只在本人手机出现。</p>`
}

function renderJourney() {
  const group = byId[state.phase][3]
  document.querySelector('#journey').innerHTML = journeyNames.map((name, index) => `<div class="journey-item ${index === group ? 'active' : ''} ${index < group ? 'done' : ''}"><i></i><span>${name}</span></div>`).join('')
}

function timeText() {
  if (state.remaining === null) return ''
  return `${Math.floor(state.remaining / 60).toString().padStart(2, '0')}:${(state.remaining % 60).toString().padStart(2, '0')}`
}

function queueMarkup() {
  const speaker = state.speaker === null ? '<span class="queue-empty">暂无发言</span>' : `<strong>${escaped(roleName(state.speaker))}</strong>`
  const waiting = state.queue.length ? state.queue.map(index => escaped(roleName(index))).join(' → ') : '<span class="queue-empty">暂无排队</span>'
  return `<p class="queue-speaker">当前发言：${speaker}</p><p class="queue-wait">排队：${waiting}</p>`
}

function renderStage() {
  document.querySelector('#stage-title').textContent = byId[state.phase][1]
  let status = '五人围桌'
  if (['create', 'join', 'ready', 'consent'].includes(state.phase)) status = ['join', 'ready'].includes(state.phase) ? '' : `${state.roles.filter(value => value !== null).length} / 5 已入席`
  if (state.speaker !== null) status = `当前发言 · ${roleName(state.speaker)}`
  if (state.phase === 'vote') status = `${state.votes.filter(value => value !== undefined).length} / 5 已投 · ${timeText()}`
  if (isDiscussion() && state.speaker === null) status = state.remaining === 0 ? '等待全员确认' : `讨论收尾 · ${timeText()}`
  if (state.phase === 'silence') status = `${state.remaining} 秒`
  if (state.paused || state.hostDisconnected) status = state.hostDisconnected ? '主持设备离线 · 已暂停' : '主持问答 · 已暂停'
  const statusElement = document.querySelector('#stage-state')
  statusElement.textContent = status
  statusElement.classList.toggle('paused', state.paused || state.hostDisconnected)
  document.querySelector('#director-label').textContent = state.host === 'ai' ? 'AI 幕后主持 · 演示' : '真人主持'
  document.querySelector('#stage-caption').textContent = directorPrompt()
  const queueBox = document.querySelector('#stage-queue')
  if (queueBox) {
    queueBox.hidden = !['intro', 'ask', 'discuss1', 'discuss2', 'tie'].includes(state.phase)
    if (!queueBox.hidden) queueBox.innerHTML = queueMarkup()
  }
  const overlay = document.querySelector('#public-overlay')
  overlay.hidden = !['tally', 'identity', 'truth', 'outcome', 'ended'].includes(state.phase)
  if (state.phase === 'tally') {
    const result = state.history.at(-1)
    const cast = castNames()
    const allAbstained = Boolean(result?.allAbstained ?? state.voteAllAbstained)
    overlay.innerHTML = `<h2>第 ${result.round} 轮票型</h2>${cast.map((_, index) => `<div class="receipt"><span>${roleName(index)}</span><span>${result.votes[index] === null ? '弃票' : `投给 ${cast[result.votes[index]]}`}</span></div>`).join('')}<p>${cast.map((name, index) => `${name} ${result.counts[index]} 票`).join(' · ')}</p><p>${allAbstained ? '本轮全员弃票，回到讨论，由所有未出局玩家重新投票。' : state.winner === null ? '本轮未产生唯一最高票，重新讨论后复投。' : `${cast[state.winner]}成为唯一出局者。`}</p>`
  }
  if (state.phase === 'identity') {
    const cast = castNames()
    overlay.innerHTML = `<h2>测试身份揭晓</h2><p>本次出局角色</p><div class="result-title">${cast[state.winner]}</div><p>测试凶手为${cast[4]}。这项设定仅用于验证胜负流程。</p>`
  }
  if (state.phase === 'truth') overlay.innerHTML = '<h2>案件真相</h2><p>这里将呈现完整案件的时间线、作案过程与线索解释。</p><p>当前为空白测试局，正式案件内容等待填入。</p>'
  if (state.phase === 'outcome') overlay.innerHTML = `<h2>本局结果</h2><div class="result-title">${state.winner === 4 ? '其他玩家获胜' : '凶手获胜'}</div><p>依据本次票出的角色与测试凶手身份自动判断。</p>`
  if (state.phase === 'ended') overlay.innerHTML = `<h2>散场，再会。</h2><p>这一局已完成全部流程。</p><p>${state.recorded ? '原型未生成真实录音文件。' : '本局未录音。'}</p>`
  sceneView?.update()
}

function directorPrompt() {
  if (state.hostDisconnected) return '主持设备已断线，流程暂停，等待原设备重连。'
  if (state.paused) return '当前流程已暂停。查看主持解释后，请确认继续。'
  const prompts = {
    create: '先选择这一场故事的主持方式。',
    join: '请各位选择角色入席。',
    ready: '请阅读自己的角色卡，读完后确认准备好。',
    consent: '请各位回应录音意愿，任何一人不同意则关闭录音与识别。',
    intro: '请举手介绍自己，说完后点击下一位。',
    ask: '你可以针对刚才的介绍提问，举手后按顺序发言。',
    clue1: '第一轮线索已开放，请分别确认公共线索与个人线索已读。',
    discuss1: '现在开始第一轮讨论。需要发言时请举手。',
    clue2: '第二轮线索已开放，请阅读新信息并确认已读。',
    discuss2: '请完成最后一轮讨论，再秘密提交你的判断。',
    vote: '请在手机上秘密投票或弃票，结束后统一公开。',
    tally: state.voteAllAbstained ? '本轮全员弃票，回到讨论，由所有未出局玩家重新投票。' : state.winner === null ? '本轮需要重新讨论后复投。' : '票型已经公开，即将开始退场。',
    tie: '请再次讨论。下一轮仍可投给全部未出局玩家。',
    exit: '请看向舞台，出局木偶正在退场。',
    silence: '请安静片刻。',
    identity: '现在揭晓测试身份。',
    truth: '这里将呈现正式案件的完整真相。',
    outcome: '本局胜负已经确定。',
    ended: '本局结束，可以回看已公开内容与阶段总结。',
  }
  return prompts[state.phase]
}

function selectedScript() {
  return scripts.find(script => script.id === state.scriptId) || scripts[0]
}

/* covers-integrated */
function scriptCover(script, compact = false) {
  if (script.cover) {
    return `<div class="script-cover-slot has-cover${compact ? ' compact' : ''}"><img class="script-cover-image" src="../图库素材/${escaped(script.cover)}" alt="${escaped(script.title)}封面"><div class="script-cover-title"><strong>${escaped(script.title)}</strong></div></div>`
  }
  return `<div class="script-cover-slot${compact ? ' compact' : ''}" role="img" aria-label="${escaped(script.title)}封面预留"><span>封面预留</span><strong>${escaped(script.title)}</strong></div>`
}

function storySections(script = scripts[0]) {
  const cast = script.cast || scriptCatalog[0].cast
  const beats = script.beats || []
  return [
    ['story', '剧本简介', `<div class="story-timeline">${beats.map(([mark, title, text]) => `<article><mark>${escaped(mark)}</mark><h4>${escaped(title)}</h4><p>${escaped(text)}</p></article>`).join('')}</div><p class="muted">${escaped(script.notice)}</p><p class="muted">${escaped(script.status)}</p>`],
    ['characters', '角色简介', `<div class="character-intros">${cast.map((member, index) => `<article><img src="../图库素材/${images[index]}" alt="${escaped(member.name)}"><div><h4>${escaped(member.name)}</h4><p class="muted">${escaped(member.identity)}</p><p>${escaped(member.bio)}</p></div></article>`).join('')}</div>`],
    ['guide', '玩法与准备', '<h4>五人围桌 · 两轮线索</h4><ol><li>加入房间后，各自选择角色和空座。</li><li>阅读角色卡，五人准备完毕后开始。</li><li>自我介绍、初始提问、两轮线索与讨论。</li><li>秘密投票，公开票型并揭晓真相。</li></ol><p><mark>电脑主机持续运行</mark>，所有设备保持连接同一局域网。</p>'],
  ]
}
function accordion(sections) {
  const active = sections.some(section => section[0] === accordionPanel) ? accordionPanel : sections[0][0]
  const activeSection = sections.find(section => section[0] === active)
  const [activeId, activeTitle, activeContent] = activeSection
  return `<div class="info-accordion"><nav class="accordion-index" aria-label="内容分区">${sections.map(([id,title])=>`<button class="accordion-heading ${id===active?'active':''}" data-action="accordion" data-value="${id}" aria-expanded="${id===active}"><span>${title}</span><span aria-hidden="true">${id===active?'−':'＋'}</span></button>`).join('')}</nav><section class="accordion-panel" aria-label="${activeTitle}"><div class="accordion-content" tabindex="0" aria-label="${activeTitle}内容" data-section="${activeId}">${activeContent}</div></section></div>`
}
function libraryHero(script) {
  return `<header class="library-hero">${scriptCover(script)}<div class="library-caption"><h3>${escaped(script.title)}</h3><p>${script.players} 人 · ${escaped(script.genre)} · 两轮线索</p></div></header>`
}
function roomEntry() {
  const script = scripts[0]
  if (entryMode === 'shelf') return renderShelf()
  if (entryMode === 'join') return `<div class="fixed-player-page">${libraryHero(script)}<div class="entry-form-content"><h3>填写房主房间码</h3><p>向房主获取六位数字，提交后进入房间。</p>${joinRoomForm()}</div><footer class="fixed-actions">${action('回到入场','entry-replay')}</footer></div>`
  if (entryMode === 'library') return renderLibrary()
  return `<div class="fixed-player-page">${libraryHero(script)}${accordion([storySections(script)[0]])}<footer class="fixed-actions entry-options">${action('回到入场','entry-replay')}${action('自己创建房间','entry-create')}${action('填写房主房间码','entry-join')}</footer></div>`
}
function renderShelf() {
  /* 三幕入场动画的挂载壳：由 renderPhone 在 innerHTML 写完后调用 mountEntryCinema。 */
  return `<div class="fixed-player-page entry-cinema-shell"><div class="entry-cinema" data-cinema-root></div></div>`
}
/* 书架横滑时更新底部指示点。scroll 不冒泡，用捕获阶段监听。 */
document.addEventListener('scroll', event => {
  const flow = event.target
  if (!flow?.classList?.contains('shelf-flow')) return
  const slides = [...flow.querySelectorAll('.shelf-slide')]
  if (!slides.length) return
  const flowRect = flow.getBoundingClientRect()
  const center = flowRect.left + flowRect.width / 2
  let nearest = 0
  let best = Infinity
  slides.forEach((slide, index) => {
    const rect = slide.getBoundingClientRect()
    const distance = Math.abs(rect.left + rect.width / 2 - center)
    if (distance < best) { best = distance; nearest = index }
  })
  slides.forEach((slide, index) => slide.classList.toggle('is-active', index === nearest))
  document.querySelectorAll('.shelf-dot').forEach((dot, index) => dot.classList.toggle('is-active', index === nearest))
}, true)
function renderLibrary() {
  const script = scripts.find(item=>item.id===scriptDetail) || scripts[0]
  let sections = storySections(script)
  if (creatingRoom) sections = [['hosting','选择主持方式',`<div class="actions">${action('AI 主持','host','ai',state.host==='ai')}${action('真人主持','host','human',state.host==='human')}</div><p>${state.host==='ai'?'当前采用预设流程演示，真实 AI 待接入。':'真人主持使用独立设备，独立于五名玩家。'}</p><p>本次仍使用流程测试内容。</p>`], ...sections]
  const mainAction = creatingRoom ? action('创建房间并入席','create',script.id,true) : scriptDetail ? action('创建房间 · 选择主持','begin-create',script.id,true) : action('查看剧本详情','script-detail',script.id,true)
  return `<div class="fixed-player-page">${libraryHero(script)}${accordion(sections)}<footer class="fixed-actions">${creatingRoom ? `${action('回到入场','entry-replay')}${action('返回详情','cancel-create')}` : action('回到入场','entry-replay')}${mainAction}</footer></div>`
}
function joinRoomForm() {
  return `<form id="join-room-form"><label for="room-code">六位房间码</label><input id="room-code" inputmode="numeric" autocomplete="off" pattern="[0-9]{6}" minlength="6" maxlength="6" placeholder="请输入房主提供的房间码" value="${escaped(roomCodeDraft)}" required><button type="submit" class="primary">确认加入房间</button><p id="join-error" role="status"></p></form>`
}

function seatList(interactive = false) {
  return `<div class="seat-list">${castNames().map((_, seat) => {
    const occupant = state.seats.indexOf(seat)
    const occupied = occupant !== -1
    const label = `${seat + 1} 号座位 · ${occupied ? roleName(occupant) : '空位'}`
    return interactive ? action(label + (occupant === player ? '（我）' : ''), 'pick-seat', seat, occupant === player, occupied || state.roles[player] === null || !['join', 'ready'].includes(state.phase)) : `<div class="public-seat">${label}</div>`
  }).join('')}</div>`
}

function invitation() {
  if (!invitationQrOpen) return `<button class="invite-qr-trigger" data-action="toggle-invite-qr">扫码进入房间</button>`
  if (!networked) return `<div class="invite-qr-content"><button class="invite-qr-trigger" data-action="toggle-invite-qr">收起二维码</button><p>单机演示模式</p></div>`
  // 真人主持必须给房主一个可转交的独立入口，否则建房即“主持离线”卡死。
  const hostInvite = state.host === 'human' && player === state.roomOwner && lan.hostInviteUrl
    ? `<div class="host-invite"><span class="board-kicker">真人主持入口</span><p>请另一位朋友用独立设备打开</p><img class="lan-qr" src="${apiUrl('/api/qr?kind=host')}" alt="主持邀请二维码"><p><a href="${escaped(lan.hostInviteUrl)}">${escaped(lan.hostInviteUrl)}</a></p></div>`
    : ''
  return `<div class="invite-qr-content"><button class="invite-qr-trigger" data-action="toggle-invite-qr">收起二维码</button><img class="lan-qr" src="${apiUrl('/api/qr?kind=room')}" alt="房间加入二维码"><p><a href="${escaped(lan.roomUrl || '#')}">${escaped(lan.roomUrl || '')}</a></p>${hostInvite}</div>`
}

let knownRooms = []
let roomListAt = 0
async function refreshRoomList() {
  if (previewMode) return
  if (Date.now() - roomListAt < 3000) return
  roomListAt = Date.now()
  try {
    const response = await fetch(apiUrl('/api/rooms'))
    knownRooms = response.ok ? await response.json() : []
  } catch { knownRooms = [] }
  renderRoomList()
}
function renderRoomList() {
  const box = document.querySelector('#computer-room-list')
  if (!box) return
  const rooms = Array.isArray(knownRooms) ? knownRooms : []
  if (!rooms.length) { box.hidden = true; box.innerHTML = ''; return }
  box.hidden = false
  box.innerHTML = `<span class="board-kicker">本机正在开的房间</span>${rooms.map(room => `<button type="button" class="board-room-item" data-action="computer-open-room" data-value="${room.code}"><span>${room.code}</span><small>${room.joined || 0}/5 人 · ${['join', 'ready'].includes(room.phase) ? '候场' : room.phase === 'create' ? '空房' : '进行中'}</small></button>`).join('')}`
}

function renderComputer() {
  const script = scripts.find(item => item.id === computerBoardScript) || selectedScript()
  const catalog = document.querySelector('#computer-catalog')
  if (catalog) catalog.innerHTML = scripts.map((item, index) => `<button type="button" class="board-book${item.id === script.id ? ' active' : ''}" data-action="computer-pick-script" data-value="${item.id}" aria-pressed="${item.id === script.id}"><span class="board-book-no">${String(index + 1).padStart(2, '0')}</span><span class="board-book-title">${escaped(item.title)}</span><span class="board-book-meta">${item.players} 人 · ${escaped(item.genre)}</span></button>`).join('')
  // 服务端会保留上一场房间，这里只提示，不自动把人拽上舞台。
  const waiting = state.phase !== 'create'
  const roomCard = document.querySelector('#computer-room-card')
  if (roomCard) {
    roomCard.hidden = !waiting || !state.roomCode
    roomCard.innerHTML = waiting && state.roomCode
      ? `<span class="board-kicker">这一场还开着</span><div class="board-room-code">${state.roomCode}</div><p class="board-room-meta">${state.joined.filter(Boolean).length}/5 人已进 · ${state.roles.filter(role => role !== null).length} 席已选角色</p><button type="button" class="board-enter" data-action="computer-enter-stage" aria-label="进入公共舞台">进入公共舞台</button>`
      : ''
  }
  const arrived = state.joined.filter(Boolean).length
  const room = document.querySelector('#computer-room')
  if (room) room.innerHTML = `<details class="host-panel computer-seat-panel"><summary>${escaped(script.title)} · ${arrived}/5 人入席</summary><p>房间码 ${state.roomCode || '待创建'} · ${state.host === 'ai' ? 'AI 主持' : '真人主持'}</p><div class="room-status"><span>${state.roles.filter(role => role !== null).length} / 5 已选角色</span></div>${seatList()}</details>`
  const events = document.querySelector('#computer-events')
  if (events) events.innerHTML = state.events.length ? state.events.slice(-60).map(event => `<p>${escaped(event)}</p>`).join('') : '<p>等待房间操作。</p>'
  if (endpoint === 'computer') refreshRoomList()
}

let computerIdleTimer
function showComputerPanels() {
  if (endpoint !== 'computer') {
    clearTimeout(computerIdleTimer)
    computerIdleTimer = null
    document.body.classList.remove('computer-panels-hidden')
    return
  }
  document.body.classList.remove('computer-panels-hidden')
  clearTimeout(computerIdleTimer)
  computerIdleTimer = setTimeout(() => document.body.classList.add('computer-panels-hidden'), 10 * 1000)
}
document.addEventListener('pointermove', event => {
  if (event.pointerType === 'mouse' && endpoint === 'computer') showComputerPanels()
}, { passive: true })
document.addEventListener('pointerdown', () => { if (endpoint === 'computer') showComputerPanels() }, { passive: true })
document.addEventListener('keydown', () => { if (endpoint === 'computer') showComputerPanels() })

function publicClue(round) {
  return { title: `第${round}轮公共线索`, text: '这一轮所有玩家都能阅读的公共信息，将放在这里。' }
}

function personalClue(round, owner) {
  return { title: `${roleName(owner)}的第${round}轮个人线索`, text: `这是一条仅对${roleName(owner)}开放的第${round}轮测试信息。正式线索原文将在这里呈现。` }
}

function cluesUnlocked() {
  return !['create', 'join', 'ready', 'consent', 'intro', 'ask'].includes(state.phase)
}

function publicClues() {
  if (!cluesUnlocked()) return '<p>初始提问结束后统一开放第一轮线索。</p>'
  let html = ''
  for (let round = 1; round <= roundNumber(); round++) {
    const clue = publicClue(round)
    html += `<article class="clue-card"><h4>${clue.title}</h4><p>${clue.text}</p></article>`
    html += state.shared.filter(id => Number(id.split('-')[0]) === round).map(id => {
      const owner = Number(id.split('-')[1])
      const clue = personalClue(round, owner)
      return `<article class="clue-card"><h4>${clue.title}</h4><small>${roleName(owner)}已公开给全桌</small><p>${clue.text}</p></article>`
    }).join('')
  }
  return html
}

function publicInformation(includeQueue = false) {
  return `<details class="host-panel computer-live-panel"><summary>全桌进行中 · ${byId[state.phase][1]}</summary><div class="public-facts"><p>当前发言　${state.speaker === null ? '暂无' : roleName(state.speaker)}</p><p>提问对象　${state.target === null ? '暂无' : roleName(state.target)}</p>${includeQueue ? `<p>提问排队　${state.queue.length ? state.queue.map(roleName).join(' → ') : '暂无'}</p>` : ''}<p data-role="timer">计时　${state.remaining === null ? '不限时' : timeText()}</p><p>录音　${state.recorded ? '同意，功能待接入' : '关闭'} · 识别待接入</p></div>${['join', 'ready'].includes(state.phase) ? `<p>角色 ${state.roles.filter(role => role !== null).length}/5 · 已准备 ${state.ready.filter(Boolean).length}/5</p>` : ''}${['clue1', 'clue2'].includes(state.phase) ? `<p>本轮已读　公共 ${state.read[roundNumber()].filter(read => read[0]).length}/5 · 个人 ${state.read[roundNumber()].filter(read => read[1]).length}/5</p>` : ''}${state.phase === 'vote' ? `<p>已投 ${state.votes.filter(vote => vote !== undefined).length}/5 人</p>` : ''}</details><details class="host-panel"><summary>公共线索与玩家公开内容</summary>${publicClues()}</details><details class="host-panel"><summary>全桌阶段总结</summary>${Object.keys(state.summaries).length ? Object.entries(state.summaries).map(([round, text]) => `<h4>第${round}轮</h4><p>${escaped(text || '等待补记，玩家可在总结页修订。')}</p>`).join('') : '<p>讨论结束后整理在这里。</p>'}</details>`
}

function renderPublicInformation() {
  const html = publicInformation()
  document.querySelector('#computer-public').innerHTML = html

}

function renderHostOverview() {
  const automatic = state.host === 'ai' && !state.manualControl
  document.querySelector('#host-phase').textContent = byId[state.phase][1]
  document.querySelector('#host-running').textContent = state.hostDisconnected ? '主持离线 · 已暂停' : state.paused ? '已暂停' : automatic ? '自动流程演示中' : '手动主持中'
  document.querySelector('#host-controls-title').textContent = automatic ? '自动主持与接管' : '流程控制'
  document.querySelector('#host-next-condition').textContent = state.remaining === null ? '' : `剩余 ${timeText()}`
  const progress = state.roles.map((role, index) => {
    let status = role === null ? '尚未入席' : '已入席'
    if (state.phase === 'ready') status = state.ready[index] ? '已准备' : '阅读角色卡'
    if (state.phase === 'consent') status = state.consent[index] === null ? '等待回应' : '已回应'
    if (state.phase === 'intro') status = state.introduced[index] ? '介绍已完成' : state.speaker === index ? '正在介绍' : '等待介绍'
    if (isDiscussion()) status = state.speaker === index ? '正在发言' : state.queue.includes(index) ? '排队中' : state.confirmed[index] ? '已确认结束' : '讨论中'
    if (['clue1', 'clue2'].includes(state.phase)) {
      const read = state.read[roundNumber()][index]
      status = `公共${read[0] ? '已读' : '未读'} · 个人${read[1] ? '已读' : '未读'}`
    }
    if (state.phase === 'vote') status = state.votes[index] === undefined ? '尚未提交' : '已提交'
    if (state.disconnected[index]) status = '设备离线'
    return `<div class="host-progress-row"><span>${role === null ? `玩家设备 ${index + 1}` : roleName(index)}</span><span>${status}</span></div>`
  }).join('')
  document.querySelector('#host-progress').innerHTML = progress
  document.querySelector('#host-public-messages').innerHTML = state.messages.length ? state.messages.map(message => `<div class="host-message"><strong>${escaped(message.author)}</strong><p>${escaped(message.text)}</p></div>`).join('') : '<p class="host-description">请求解释与主持回复会显示在这里。</p>'
  document.querySelector('#host-services').innerHTML = `<div class="service-item"><span>主持</span><span>${state.host === 'ai' ? '本机预设流程 · AI 服务待接入' : '真人操作'}</span></div><div class="service-item"><span>录音</span><span>${state.recorded ? '已获全员同意 · 服务待接入' : '关闭'}</span></div><div class="service-item"><span>语音识别</span><span>待接入</span></div><div class="service-item"><span>音乐</span><span>待接入</span></div>`
}

function renderHost() {
  const phase = state.phase
  const box = document.querySelector('#host-body')
  document.querySelector('#host-mode-label').textContent = state.host === 'ai' ? 'AI 主持 · 预设流程演示' : '真人主持'
  let description = ''
  let controls = ''
  let detail = ''
  if (phase === 'create') {
    description = '等待第一位玩家选本并创建房间。'
  } else if (phase === 'join') {
    description = '等待五名玩家在各自设备中选择角色。'
    controls = `${action('演示：五人入席并开始流程', 'demo-start-flow')}${action('模拟其余玩家入席', 'fill-roles')}${action('进入角色阅读', 'to-ready', '', true, state.roles.includes(null))}`
  } else if (phase === 'ready') {
    description = `已有 ${state.ready.filter(Boolean).length} / 5 人准备好。开局前可换选角色。`
    controls = `${action('演示：五人入席并开始流程', 'demo-start-flow')}${action('模拟其余玩家准备', 'fill-ready')}${action('返回选角', 'back-join')}${action('全员准备，继续', 'to-consent', '', true, !state.ready.every(Boolean))}`
  } else if (phase === 'consent') {
    description = `已收到 ${state.consent.filter(value => value !== null).length} / 5 人的回应。任一人拒绝即关闭录音与识别。原型会演示录音不可用时继续游戏。`
    controls = `${action('模拟其余人同意', 'fill-consent')}${action('正式开场', 'start', '', true, state.consent.includes(null))}`
  } else if (phase === 'intro') {
    description = state.introQueueStarted ? `已完成 ${state.introduced.filter(Boolean).length} / 5 席介绍。其余玩家可在当前介绍期间排队或取消。` : `已有 ${state.queue.length} / 5 人举手。五人都准备并举手后，才按队列开始介绍。`
    controls = `${action('主持代点下一位', 'next-speaker', '', false, state.speaker === null)}${action('模拟完成其余介绍', 'fill-intro')}${action('进入初始提问', 'intro-end', '', true, !state.introduced.every(Boolean))}`
  } else if (isDiscussion()) {
    description = state.speaker === null ? `队列已清空。${state.remaining > 0 ? '一分钟收尾后收集全员确认。' : `已确认 ${state.confirmed.filter(Boolean).length} / 5 人。`}` : `${roleName(state.speaker)}正在提问${state.target === null ? '' : `，被问者为${roleName(state.target)}`}。`
    controls = `${action('主持代点下一位', 'next-speaker', '', false, state.speaker === null)}${action('体验用 · 结束收尾计时', 'skip-countdown', '', false, state.speaker !== null || state.remaining === 0)}${action('主持代全员确认', 'fill-confirm', '', false, state.speaker !== null || state.remaining !== 0)}${action(phase === 'tie' ? '开始复投' : '进入下一阶段', 'discussion-end', '', true, !state.confirmed.every(Boolean))}`
  } else if (phase === 'clue1' || phase === 'clue2') {
    const read = state.read[roundNumber()]
    description = `公共线索 ${read.filter(value => value[0]).length} / 5 已读，个人线索 ${read.filter(value => value[1]).length} / 5 已读。`
    controls = `${action('模拟其余玩家读完', 'fill-read')}${action('开始讨论', 'clues-end', '', true, !read.every(value => value.every(Boolean)))}`
  } else if (phase === 'vote') {
    description = `第 ${state.voteRound} 轮秘密投票。请在手机中提交选择。到时未提交按弃票。`
    controls = `${action('模拟其余票 · 唯一最高', 'fill-votes', 'unique')}${action('模拟其余票 · 平票', 'fill-votes', 'tie')}${action('体验用 · 立即到时收票', 'vote-timeout')}`
  } else if (phase === 'tally') {
    description = state.voteAllAbstained ? '本轮全员弃票，回到讨论，由所有未出局玩家重新投票。' : state.winner === null ? '本轮最高票平票，需要重新讨论与投票。' : '唯一出局者已确定，即将进入退场演出。'
    controls = action(state.winner === null ? '重新讨论' : '开始退场', 'tally-next', '', true)
  } else if (phase === 'exit') {
    description = '出局木偶向幕后退场。声音制作在后续接入。'
    controls = action('退场结束，进入静默', 'exit-end', '', true)
  } else if (phase === 'silence') {
    description = '静默两秒后，AI 模式自动揭晓，真人模式由主持推进。'
    if (state.host === 'human' || state.manualControl) controls = action('揭晓身份', 'silence-end', '', true, state.remaining !== 0)
  } else if (phase === 'identity') controls = action('查看案件真相', 'identity-end', '', true)
  else if (phase === 'truth') controls = action('查看胜负结果', 'truth-end', '', true)
  else if (phase === 'outcome') controls = action('结束本局', 'outcome-end', '', true)
  else if (phase === 'ended') {
    description = '本局流程已结束。正式版本中，房主在这里决定录音保留或删除，默认保留。'
    controls = `${action(state.keptRecording ? '录音处置 · 默认保留' : '录音处置 · 已选删除', 'record-disposition')}${action('再体验一局', 'reset', '', true)}`
  }
  if (state.phase !== 'create') detail += `<div class="queue">${state.queue.length ? `提问排队　${state.queue.map(roleName).join(' → ')}` : ''}</div>`
  const temporary = document.createElement('div')
  temporary.innerHTML = controls
  const demoActions = ['demo-start-flow', 'fill-roles', 'fill-ready', 'fill-consent', 'fill-intro', 'fill-read', 'fill-votes', 'skip-countdown', 'vote-timeout']
  const demo = document.querySelector('#demo-actions')
  demo.replaceChildren()
  temporary.querySelectorAll('button').forEach(button => {
    if (demoActions.includes(button.dataset.action)) demo.appendChild(button)
  })
  demo.insertAdjacentHTML('beforeend', `${action(state.disconnected[player] ? '模拟玩家重连' : '模拟当前玩家断线', state.disconnected[player] ? 'reconnect' : 'disconnect', '', false, phase === 'create')}${action(state.hostDisconnected ? '模拟主持重连' : '模拟主持断线', state.hostDisconnected ? 'host-reconnect' : 'host-disconnect', '', false, state.host !== 'human' || phase === 'create')}`)
  if (phase !== 'create' && !hasJoined()) demo.insertAdjacentHTML('beforeend', action('模拟扫描房主房间二维码', 'simulate-scan-room'))
  if (isDiscussion()) demo.insertAdjacentHTML('beforeend', action('模拟其余玩家确认结束', 'simulate-confirm', '', false, state.speaker !== null || state.remaining !== 0))
  controls = temporary.innerHTML
  if (state.host === 'ai' && !state.manualControl && !['create', 'ended'].includes(phase)) {
    controls = `${action('人工接管', 'takeover')}${action('暂停自动主持', 'pause')}`
  } else if (state.host === 'ai' && state.manualControl && phase !== 'ended') controls += action('交回自动主持', 'release-host')
  if (phase === 'ended') controls = ''
  if (state.paused) controls = `${action('确认继续', 'resume', '', true)}${state.host === 'ai' && !state.manualControl ? action('人工接管', 'takeover') : ''}`
  if (state.hostDisconnected) controls = '<p class="host-description">等待原主持设备恢复连接。</p>'
  box.innerHTML = `${description ? `<p class="host-description">${description}</p>` : ''}${detail}<div class="actions">${controls}</div>`
  renderHostOverview()
}

function clueCards() {
  const saved = readPrivateNotes().favorites.includes('timeline-placeholder') ? '<section class="saved-facts"><h3>我的收藏</h3><p class="story-highlight saved">关键时间 · 正文待填</p></section>' : ''
  if (!cluesUnlocked()) return `<h3>线索资料</h3>${saved}<h3>线索尚未开放</h3><p>初始提问结束后，同一轮公共线索与个人线索会同时到达并按轮次整理。</p>`
  const personalLink = endpoint === 'player' ? '<a href="#personal-clue-section">个人线索</a>' : ''
  let html = `<h3>线索资料</h3>${saved}<nav class="clue-links"><a href="#public-clue-section">公共线索</a>${personalLink}</nav><section id="public-clue-section"><h3>公共线索</h3>`
  for (let round = 1; round <= roundNumber(); round++) {
    const clue = publicClue(round)
    const read = state.read[round][player][0]
    html += `<article class="clue-card"><small>第${round}轮 · 全桌可见</small><h4>${clue.title}</h4><p>${clue.text}</p>${action(read ? '公共线索已读 ✓' : '确认公共线索已读', 'read', `${round}-0`, false, read)}</article>`
    html += state.shared.filter(id => Number(id.split('-')[0]) === round).map(id => {
      const owner = Number(id.split('-')[1])
      const clue = personalClue(round, owner)
      return `<article class="clue-card"><small>${roleName(owner)}已公开 · 第${round}轮</small><h4>${clue.title}</h4><p>${clue.text}</p></article>`
    }).join('')
  }
  // 个人线索只发给玩家设备：主持端与电脑公共屏只保留公共线索与已公开内容。
  if (endpoint !== 'player') return `${html}</section><section class="clue-card"><h3>个人线索</h3><p>个人线索只在各自玩家设备上显示。</p></section>`
  html += '</section><section id="personal-clue-section"><h3>个人线索</h3>'
  for (let round = 1; round <= roundNumber(); round++) {
    const clue = personalClue(round, player)
    const id = `${round}-${player}`
    const read = state.read[round][player][1]
    const published = state.shared.includes(id)
    html += `<article class="clue-card"><small>第${round}轮 · ${published ? '已向全桌公开' : '本人可见'}</small><h4>${clue.title}</h4><p>${clue.text}</p>${action(read ? '个人线索已读 ✓' : '确认个人线索已读', 'read', `${round}-1`, false, read)}${action(published ? '已公开给全桌' : '公开这条线索', 'share', id, false, published)}${pendingShare === id ? `<div class="share-confirm"><p>确认把这条线索的完整内容公开给全桌吗？公开后会保留。</p>${action('确认公开', 'confirm-share', id, true)}${action('取消', 'cancel-share')}</div>` : ''}</article>`
  }
  return html + '</section>'
}

function lobbyPhone() {
  const role = state.roles[player]
  const sections = [
    ['roles','选择角色',`<p>已进入 <mark>${state.joined.filter(Boolean).length}/5 人</mark> · 已选角色 ${state.roles.filter(value=>value!==null).length}/5 人</p><div class="role-choices">${currentCast().map((member,index)=>`<button data-action="pick-role" data-value="${index}" ${state.roles.includes(index)&&role!==index?'disabled':''} class="${role===index?'selected':''}">${escaped(member.name)}<span>${role===index?'我的角色':state.roles.includes(index)?'已被选择':'可选择'}</span></button>`).join('')}</div>`],
    ['seats','查看与更换座位',`<p>${role===null?'选择角色后随机安排空座。':`你在 <mark>${state.seats[player]+1} 号座位</mark>，开局前可以更换空座。`}</p>${seatList(true)}`],
    ...storySections(selectedScript()).slice(0,2),
    ['my-role','我的角色卡',role===null?'<p>选择角色后在此阅读本人角色卡。</p>':roleCard()],
    ['invitation','扫码进入房间',player===state.roomOwner?invitation():'<p>扫描房主提供的二维码，输入房间码后加入。</p>'],
  ]
  // 房主换本入口放在手风琴上方常驻，避免藏在页脚里找不到。
  const switchBook = player === state.roomOwner
    ? `<div class="lobby-switch-book"><span>想换一个剧本？</span><button type="button" class="leave-room-button" data-action="leave-room">退出房间 · 返回选本</button></div>`
    : ''
  return `<div class="fixed-player-page lobby-page">${switchBook}${accordion(sections)}<footer class="fixed-actions">${action(state.ready[player]?'已准备 ✓':'已读，准备好了','ready','',true,role===null||state.ready[player])}</footer></div>`
}

function discussionPhone() {
  const speaking = state.speaker === player
  const queued = state.queue.includes(player)
  let html = `<h3>${speaking ? '轮到你了' : state.phase === 'intro' && !state.introQueueStarted ? '等待全员准备介绍' : '听一听，也问一问'}</h3><p>${state.phase === 'intro' && !state.introQueueStarted ? `已有 ${state.queue.length}/5 人举手。五人都准备好并加入队列后，才开始介绍。` : state.speaker === null ? '现在没有人举手，可以发起新的提问。' : `${roleName(state.speaker)}正在发言。`}</p><div class="actions">`
  if (speaking) html += action('说完了，下一位', 'next-speaker', '', true)
  else if (state.phase === 'intro' && state.introduced[player]) html += action(state.askQueue.includes(player) ? '取消提问排队' : '排队申请提问', state.askQueue.includes(player) ? 'cancel-ask' : 'queue-ask', '', true)
  else html += action(queued ? '取消排队' : state.phase === 'intro' && !state.introQueueStarted ? '举手加入介绍队列' : '举手发言', queued ? 'cancel-queue' : 'queue', '', true)
  if (state.phase === 'intro' && state.introduced[player] && !speaking) html += `<p class="muted">自我介绍已完成。你可以提前排队提问，听到问题后也能取消。</p>`
  html += '</div>'
  if (speaking && isDiscussion()) html += `<h4>这次想问谁</h4><div class="actions">${castNames().map((_, index) => index === player ? '' : action(roleName(index), 'target', index, state.target === index)).join('')}</div>`
  if (isDiscussion() && state.speaker === null && state.remaining === 0) html += `<h4>讨论结束确认</h4>${action(state.confirmed[player] ? '已确认 ✓' : '我已讨论完毕', 'confirm', '', true, state.confirmed[player])}`
  if (state.phase === 'intro') html += `<p class="muted">你的介绍${state.introduced[player] ? '已完成' : '尚未完成'}。${state.introQueueStarted ? '介绍发言没有个人时限，可以在他人发言时继续排队。' : '介绍发言没有个人时限。'}</p>`
  html += `<div class="phone-queue"><h4>发言队列</h4>${queueMarkup()}</div>`
  return html
}

function stagePhone() {
  const phase = state.phase
  if (phase === 'create') return '<p>请先选本开房。</p>'
  if (['join', 'ready'].includes(phase)) return lobbyPhone()
  if (phase === 'consent') return `<h3>关于录音</h3><p>录音保存在电脑主机，用于回听与阶段总结。全员同意后才开启录音和识别。</p><p>任何一人不同意，游戏仍会正常开始。</p><div class="actions">${action('同意录音', 'consent', 'yes', state.consent[player] === true)}${action('不同意', 'consent', 'no', state.consent[player] === false)}</div><p class="muted">本次浏览器原型不会访问麦克风。</p>`
  if (phase === 'intro' || isDiscussion()) return discussionPhone()
  if (phase === 'clue1' || phase === 'clue2') return clueCards()
  if (phase === 'vote') {
    if (state.votes[player] !== undefined) return '<h3>已提交你的选择</h3><p>请等待大家完成投票。全部结束后统一公开票型。</p>'
    return `<h3>你认为是谁</h3><p>第 ${state.voteRound} 轮投票，可投给任何玩家，也可以弃票。</p><div class="role-choices">${currentCast().map((member, index) => action(escaped(member.name), 'select-vote', index, state.selectedVote === index)).join('')}${action('弃票', 'select-vote', 'abstain', state.selectedVote === 'abstain')}</div><div class="actions" style="margin-top:17px">${action('确认提交', 'submit-vote', '', true, state.selectedVote === null)}</div>`
  }
  if (phase === 'tally') {
    const result = state.history.at(-1)
    const cast = castNames()
    return `<h3>本轮公开票型</h3>${result.votes.map((vote, index) => `<div class="receipt"><span>${roleName(index)}</span><span>${vote === null ? '弃票' : cast[vote]}</span></div>`).join('')}<p>${Boolean(result?.allAbstained ?? state.voteAllAbstained) ? '本轮全员弃票，回到讨论，由所有未出局玩家重新投票。' : state.winner === null ? '重新讨论后复投。' : `${cast[state.winner]}出局。`}</p>`
  }
  if (['exit', 'silence'].includes(phase)) return '<h3>一席落幕</h3><p>请看向公共舞台，真相即将揭晓。</p>'
  if (phase === 'identity') {
    const cast = castNames()
    return `<h3>测试身份揭晓</h3><p>测试凶手为${cast[4]}。</p><p>出局角色为${cast[state.winner]}。</p>`
  }
  if (phase === 'truth') return '<h3>案件真相</h3><p>正式案件的完整真相与线索解释将在这里呈现。</p><p class="muted">当前为空白测试局。</p>'
  if (phase === 'outcome') return `<h3>${state.winner === 4 ? '其他玩家获胜' : '凶手获胜'}</h3><p>本次结果依据测试身份与票型自动计算。</p>`
  return `<h3>这一局，结束了</h3><p>你可以回看已开放线索和阶段总结。正式版本中，这里还会提供主机录音的网页回听。</p>${player === state.roomOwner ? action(state.keptRecording ? '录音处置 · 默认保留' : '录音处置 · 已选删除', 'record-disposition') : ''}`
}

function renderPhone() {
  document.querySelector('#player-switch').innerHTML = castNames().map((_, index) => `<button data-action="player" data-value="${index}" class="${player === index ? 'active' : ''}" aria-label="切换到设备${index + 1}">${state.roles[index] === null ? `设备 ${index + 1}` : roleName(index)}</button>`).join('')
  document.querySelector('#phone-name').textContent = state.phase === 'create' ? '围桌 · 选本' : !hasJoined() ? '加入朋友的房间' : ['join', 'ready'].includes(state.phase) ? '等候入席' : roleName(player)
  document.querySelector('#phone-phase').textContent = state.phase === 'create' ? '线下同桌' : hasJoined() ? byId[state.phase][1] : '扫码入口'
  document.querySelector('#phone-role-label').textContent = state.disconnected[player] ? '设备已离线' : state.phase === 'create' ? '手机游戏入口' : `${player === state.roomOwner ? '房主 · ' : ''}玩家 ${player + 1}`
  document.querySelector('#player-director').innerHTML = `<span>${state.host === 'ai' ? 'AI 幕后主持 · 演示' : '主持提示'}</span><p>${escaped(directorPrompt())}</p>${state.paused ? action('确认继续', 'resume', '', true) : state.host === 'ai' && !['create', 'ended'].includes(state.phase) ? action('请求主持解释／暂停', 'explain') : ''}`
  document.querySelector('#enter-player-scene').disabled = state.roles[player] === null || state.disconnected[player]
  document.querySelector('#player-scene-name').textContent = `${roleName(player)} · 围桌场景`
  const body = document.querySelector('#phone-body')
  const lobby = hasJoined() && ['join','ready'].includes(state.phase) && tab === 'stage'
  document.querySelector('.phone').classList.toggle('lobby-mode', lobby)
  document.querySelector('.phone').classList.toggle('entry-mode', !hasJoined())
  document.querySelector('.phone').classList.toggle('cinema-mode', !hasJoined() && entryMode === 'shelf')
  body.classList.toggle('fixed-content', !hasJoined() || lobby)
  document.querySelector('#phone-room-code').hidden = !hasJoined()
  // 房主在房间头部常驻「换本」，不必翻手风琴找退出入口。
  const switchBookInline = player === state.roomOwner
    ? '<button type="button" class="lobby-switch-inline" data-action="leave-room" title="退出当前房间，返回选本页重新换本">换本</button>'
    : ''
  document.querySelector('#phone-room-code').innerHTML = hasJoined() ? `<span><strong>${state.roomCode}</strong><small>${state.joined.filter(Boolean).length}/5</small></span>${action('复制','copy-room-code')}${switchBookInline}` : ''
  if (!hasJoined()) {
    document.querySelector('#phone-name').textContent = '围桌 · 游戏入口'
    document.querySelector('#phone-role-label').textContent = '线下同桌'
  }
  if (hasJoined() && state.disconnected[player]) body.innerHTML = `<h3>连接已断开</h3><p>重连后恢复当前阶段和本人操作状态。</p>${action('模拟重连', 'reconnect', '', true)}`
  else if (!hasJoined()) {
    body.innerHTML = roomEntry()
    if (entryMode === 'shelf') {
      mountEntryCinema(body, {
        scripts,
        onConfirm: id => {
          scriptDetail = id
          // 选本只进详情页；谁点“创建房间”谁才是房主，这一步不能替玩家决定。
          entryMode = 'library'
          creatingRoom = false
          accordionPanel = 'story'
          render()
        },
        onJoin: () => { entryMode = 'join'; renderPhone() },
      })
    }
  }
  else if (tab === 'public') body.innerHTML = `<div class="phone-public">${publicInformation(true)}</div>`
  else if (tab === 'role') body.innerHTML = roleCard()
  else if (tab === 'clues') body.innerHTML = clueCards()
  else if (tab === 'summary') {
    const rounds = Object.keys(state.summaries)
    body.innerHTML = `<h3>阶段总结</h3>${rounds.length ? rounds.map(round => `<div class="clue-card"><h4>第${round}轮讨论</h4><p>${state.summaries[round] ? escaped(state.summaries[round]) : '总结服务尚未接入，可以手工补记。'}</p>${action('补记或修订', 'edit-summary', round)}</div>`).join('') : '<p>每轮讨论结束后，这里会留下全桌可见的总结。</p>'}${state.versions.length ? `<h4>版本历史</h4>${state.versions.map(version => `<p class="muted">${escaped(version.author)} · 第${version.round}轮 · ${escaped(version.text)}</p>`).join('')}` : ''}`
  } else if (tab === 'help') {
    body.innerHTML = `<h3>请求主持解释</h3>${state.messages.map(message => `<div class="chat-message"><strong>${escaped(message.author)}</strong>${escaped(message.text)}</div>`).join('')}<form id="host-question-form"><label for="host-question">关于当前流程的问题</label><input id="host-question" maxlength="300" required><button type="submit">请求解释并暂停</button></form><p>当前主持回复为预设演示。</p>`
  } else body.innerHTML = stagePhone()
  if (hasJoined() && !lobby && ['role','clues','summary','public'].includes(tab)) {
    const content = body.innerHTML
    const titles = { role:'我的角色卡', clues:'线索资料', summary:'阶段总结', public:'全桌信息' }
    body.classList.add('fixed-content')
    body.innerHTML = `<div class="fixed-player-page">${accordion([[`read-${tab}`,titles[tab],content]])}</div>`
  }
  const unread = cluesUnlocked() ? Array.from({ length: roundNumber() }, (_, index) => state.read[index + 1][player].filter(read => !read).length).reduce((a, b) => a + b, 0) : 0
  const newShares = state.shared.filter(id => !state.seenShared[player].includes(id)).length
  document.querySelector('#clue-notice').innerHTML = cluesUnlocked() ? action(`线索资料 · ${unread + newShares ? `${unread + newShares} 项待查看` : '均已查看'} · 公共 / 个人`, 'tab', 'clues') : '<span>线索入口 · 初始提问后开放</span>'
  const tabs = [['stage', '本轮操作'], ['role', '角色卡'], ['clues', '线索资料'], ['summary', '总结'], ['public', '全桌']]
  document.querySelector('#phone-tabs').innerHTML = tabs.map(([key, label]) => `<button data-action="tab" data-value="${key}" class="${tab === key ? 'active' : ''}">${label}</button>`).join('')
  renderStageDrawer()
}

function renderStageDrawer() {
  const drawer = document.querySelector('.stage-drawer')
  const content = document.querySelector('.stage-drawer-content')
  const title = document.querySelector('#stage-drawer-title')
  const labels = { operation: '本轮操作', role: '角色卡', clues: '线索资料', summary: '阶段总结', public: '全桌信息', invite: '扫码进入房间', settings: '设置' }
  // 电脑主机只展示公共信息和主持状态，不承载玩家的本轮操作。
  // 公共屏不承载任何人的私人角色卡与个人线索。
  if (endpoint === 'computer' && ['operation', 'role', 'clues'].includes(stagePanel)) stagePanel = null
  drawer.hidden = !stagePanel
  if (!stagePanel) return
  title.textContent = labels[stagePanel] || labels.operation
  const drawerHeader = drawer.querySelector('header')
  drawerHeader.querySelector('.stage-drawer-exit')?.remove()
  if (stagePanel === 'operation' && player === state.roomOwner) {
    drawerHeader.querySelector('.stage-drawer-close')?.insertAdjacentHTML('beforebegin', '<button class="small stage-drawer-exit" data-action="leave-room">退出房间</button>')
  }
  if (stagePanel === 'operation') content.innerHTML = stagePhone()
  else if (stagePanel === 'role') content.innerHTML = roleCard()
  else if (stagePanel === 'clues') content.innerHTML = clueCards()
  else if (stagePanel === 'public') content.innerHTML = endpoint === 'computer'
    ? `${document.querySelector('#computer-room').innerHTML}${document.querySelector('#computer-public').innerHTML}<details class="host-panel"><summary>电脑调试记录</summary>${document.querySelector('#computer-events').innerHTML}</details>`
    : `<div class="phone-public">${publicInformation(true)}</div>`
  else if (stagePanel === 'invite') content.innerHTML = `<div class="stage-room-code"><strong>${state.roomCode || '尚未创建房间'}</strong>${hasJoined() ? action('复制房间码', 'copy-room-code') : ''}</div>${invitation()}`
  else if (stagePanel === 'settings') {
    content.innerHTML = settingsPanel()
    content.querySelector('#music-volume')?.addEventListener('input', event => setMusicVolume(Number(event.target.value) / 100))
    content.querySelector('#settings-quality')?.addEventListener('change', event => {
      const select = document.querySelector('#quality')
      if (!select) return
      select.value = event.target.value
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }
  else {
    const rounds = Object.keys(state.summaries)
    content.innerHTML = `<h3>阶段总结</h3>${rounds.length ? rounds.map(round => `<div class="clue-card"><h4>第${round}轮讨论</h4><p>${state.summaries[round] ? escaped(state.summaries[round]) : '总结服务尚未接入，可以手工补记。'}</p>${action('补记或修订', 'edit-summary', round)}</div>`).join('') : '<p>每轮讨论结束后，这里会留下全桌可见的总结。</p>'}${state.versions.length ? `<h4>版本历史</h4>${state.versions.map(version => `<p class="muted">${escaped(version.author)} · 第${version.round}轮 · ${escaped(version.text)}</p>`).join('')}` : ''}`
  }
}

// 三个测试视角（双玩家测试 / 房主 / 受邀 / 总览）共用房主测试会话里的同一个测试房间。
// 房号只从房主设备取：这与“受邀必须手动输码”一致，避免总览把受邀侧直接拉进房。
async function refreshTestRoomTarget() {
  try {
    const response = await fetch('/api/session?testDevice=owner', { cache: 'no-store' })
    if (!response.ok) throw new Error('测试房间会话不可用')
    const data = await response.json()
    testRoomCode = data.roomCode && data.state?.phase !== 'create' ? data.roomCode : ''
    testRoomState = testRoomCode ? data.state : null
  } catch {
    testRoomCode = ''
    testRoomState = null
  }
  refreshCanvasMirrorRoom()
  renderDemoTarget()
}

/* 画布房间同步：只跟随「房主玩家/受邀玩家」单页所在的真实测试房，画布自己不建房 */
function refreshCanvasMirrorRoom() {
  /* 画布还没创建时不记录房间，等画布创建后再同步 */
  if (!canvasBoard) return
  const code = testRoomCode || ''
  /* 每次都把房号交给画布：setRoom 幂等，iframe 收到相同房号会直接忽略，
     可避免“房号已记录但画布没收到”导致工具栏一直停在「暂无房间」 */
  canvasMirrorRoom = code
  canvasBoard.setRoom(code)
}

function renderDemoTarget() {
  const target = document.querySelector('#demo-target')
  if (target) {
    target.textContent = demoDevice
      ? `操作对象：测试房间 ${testRoomCode || '尚未创建'}（房主测试会话）`
      : `操作对象：当前房间 ${state?.roomCode || '尚未进入'}`
  }
  const label = testRoomCode || '测试房间待创建'
  for (const id of ['#owner-target-label', '#invited-target-label']) {
    const node = document.querySelector(id)
    if (node) node.textContent = label
  }
  document.querySelectorAll('.test-flow-helper [data-test-action]:not([data-test-action="create"]), .test-flow-helper [data-test-reset]').forEach(button => {
    button.disabled = !testRoomCode
  })
}

function startTestRoomPolling() {
  if (testRoomPoll) return
  refreshTestRoomTarget()
  testRoomPoll = setInterval(refreshTestRoomTarget, 3000)
}

function stopTestRoomPolling() {
  if (!testRoomPoll) return
  clearInterval(testRoomPoll)
  testRoomPoll = null
}

// 多画面画布：左栏列表 + 可平移缩放的画布。
// 画布只读：四个 iframe 镜像同一场真实房间，不建房、不占席位、不接收操作。
function ensureCanvasBoard() {
  if (!document.querySelector('#canvas-world')) return null
  if (canvasBoard) return canvasBoard
  canvasBoard = initCanvasBoard({ notify })
  refreshCanvasMirrorRoom()
  return canvasBoard
}

function activateFrame(frame) {
  if (!frame || frame.getAttribute('src')) return
  const src = frame.getAttribute('data-src')
  if (src) frame.setAttribute('src', src)
}

/* 房主/受邀单视角的 iframe 兜底：载入前显示浅色占位，失败时给出重载按钮，避免整块黑屏 */
function wireDebugFrame(frame) {
  if (!frame) return
  const wrap = frame.closest('.debug-single-phone')
  const loading = wrap?.querySelector('.debug-frame-loading')
  const state = wrap?.querySelector('.debug-frame-state')
  let timer = 0
  let attempts = 0
  const hideLoading = () => {
    if (loading) loading.hidden = true
  }
  const showError = () => {
    hideLoading()
    if (state) state.hidden = false
  }
  /* 服务重启或瞬时请求失败时，内层页会停在空白；自动重载两次，避免用户手动刷新 */
  function reloadFrame() {
    const current = frame.getAttribute('src') || frame.getAttribute('data-src') || ''
    const base = current.split('&_retry=')[0]
    frame.setAttribute('src', `${base}&_retry=${Date.now()}`)
    scheduleCheck()
  }
  function fail() {
    if (attempts < 2) {
      attempts += 1
      hideLoading()
      reloadFrame()
      return
    }
    showError()
  }
  const check = (final = false) => {
    try {
      const doc = frame.contentDocument
      /* 内嵌页可能长期停在 interactive（音频/长连接），只要有正文就视为可用 */
      if (doc && doc.body) {
        const player = doc.querySelector('#endpoint-player')
        const hasText = doc.body.textContent.trim().length > 20
        if (player && hasText) {
          hideLoading()
          if (state) state.hidden = true
          return true
        }
      }
      if (final) fail()
      return false
    } catch {
      showError()
      return false
    }
  }
  const scheduleCheck = () => {
    clearTimeout(timer)
    timer = setTimeout(() => check(true), 8000)
  }
  frame.addEventListener('load', () => {
    clearTimeout(timer)
    setTimeout(() => check(false), 150)
  })
  frame.addEventListener('error', showError)
  scheduleCheck()
  if (frame.contentDocument?.body) setTimeout(() => check(false), 200)
  /* 轮询到正文出现为止，避免 load 事件被慢资源拖住时一直停在占位层 */
  const poll = setInterval(() => {
    if (check(false)) clearInterval(poll)
  }, 400)
  setTimeout(() => clearInterval(poll), 10000)
  wrap?.querySelector('[data-frame-retry]')?.addEventListener('click', () => {
    if (state) state.hidden = true
    if (loading) loading.hidden = false
    attempts = 0
    reloadFrame()
  })
}

/* 只在单视角调试页接线，避免玩家页里的隐藏 iframe 也触发检查；
   视图切换是 pushState，不再走整页加载，所以接线要放在每次渲染里。 */
function wireDebugFrameOnce(frame) {
  if (!frame || frame.dataset.wired) return
  frame.dataset.wired = '1'
  wireDebugFrame(frame)
}

function renderEndpoints() {
  // 房间刚被创建时（create → join），电脑端自动跟到舞台；
  // 打开页面时就已经存在的旧房间不自动跟，先停在选本页等人确认。
  if (endpoint === 'computer' && (roomSnapshots > 1 || !networked) && lastPhaseForBoard === 'create' && state.phase === 'join' && state.roomCode) setComputerBoard(state.roomCode)
  lastPhaseForBoard = state.phase
  // 电脑主机端/主持端与多画面画布共用同一套房间数据：只有一场房间时自动进入，
  // 不再停留在选本页等“全员准备好”，避免两边看到不同状态。
  if (!demoCast && !embedMode && !testDevice && ['computer', 'host'].includes(endpoint)) {
    const rooms = Array.isArray(lan.rooms) ? lan.rooms : []
    if (state.phase === 'create' && rooms.length === 1 && rooms[0].code) {
      if (autoFollowRoom !== rooms[0].code) {
        autoFollowRoom = rooms[0].code
        if (endpoint === 'computer') setComputerBoard(rooms[0].code)
        connectRoom(rooms[0].code)
      }
    } else if (!rooms.length) {
      autoFollowRoom = ''
    }
  }
  for (const name of ['computer', 'host', 'player', 'test', 'owner', 'invited', 'overview']) {
    const section = document.querySelector(`#endpoint-${name}`)
    if (section) section.hidden = endpoint !== name
  }
  if (endpoint === 'owner') {
    wireDebugFrameOnce(document.querySelector('#owner-view-frame'))
    activateFrame(document.querySelector('#owner-view-frame'))
  }
  if (endpoint === 'invited') {
    wireDebugFrameOnce(document.querySelector('#invited-view-frame'))
    activateFrame(document.querySelector('#invited-view-frame'))
  }
  if (endpoint === 'overview') {
    ensureCanvasBoard()
    /* 画布页保留演示工具：只显示“流程推进”，操作的就是画布镜像的那间测试房 */
    document.body.classList.add('canvas-demo')
    if (lan.localAdmin && !canvasDemoUserClosed && document.querySelector('#demo-panel').hidden) toggleDemo(true)
  } else {
    document.body.classList.remove('canvas-demo')
  }
  document.querySelectorAll('button[data-endpoint]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.endpoint === endpoint)))
  const inRoom = state.phase !== 'create' && hasJoined()
  const showPlayerScene = endpoint === 'player' && inRoom && tab === 'stage'
  // 刷新或新开页面时，房间里已入席的玩家先恢复竖屏围桌；
  // 只恢复一次，之后用户主动“回到全桌视角”不再被拉回。
  if (showPlayerScene && playerSceneBootRestore && sceneView) {
    playerSceneBootRestore = false
    playerSceneOpen = true
    if (document.querySelector('.theatre')?.dataset.immersiveOrientation !== 'portrait') {
      sceneView.enterImmersive('portrait')
    }
  }
  // 玩家端以及双玩家测试的房主 iframe，入席与准备阶段保持竖屏。
  if (showPlayerScene && ['join', 'ready'].includes(state.phase)) {
    playerSceneOpen = true
    if (sceneView && document.querySelector('.theatre')?.dataset.immersiveOrientation !== 'portrait') {
      sceneView.enterImmersive('portrait')
    }
  }
  const theatre = document.querySelector('.theatre')
  document.querySelector('.computer-periphery').hidden = endpoint !== 'computer'
  const mount = document.querySelector(showPlayerScene ? '#player-stage-mount' : '#computer-stage-mount')
  if (theatre.parentElement !== mount) mount.appendChild(theatre)
  document.querySelector('#player-personal').hidden = false
  document.querySelector('#player-scene').hidden = !showPlayerScene
  document.querySelector('#stage-screen-label').textContent = showPlayerScene ? (state.roles[player] === null ? '等候入席' : `${roleName(player)} · ${state.seats[player] + 1} 号座位`) : '公共桌面'
  const roomChip = document.querySelector('#stage-room-chip')
  const roomWaiting = ['join', 'ready'].includes(state.phase) && (endpoint === 'player' || endpoint === 'computer')
  roomChip.hidden = !roomWaiting || !hasJoined()
  roomChip.innerHTML = roomWaiting && hasJoined() ? `${state.roomCode} · ${state.joined.filter(Boolean).length}/5 <button data-action="copy-room-code" aria-label="复制房间码">复制</button>` : ''
  document.querySelector('.view-controls').hidden = !(endpoint === 'computer' || showPlayerScene)
  const labEntry = document.querySelector('#lab-open')
  if (labEntry) labEntry.hidden = false
  // 带 stage=1 的总览电脑副本直接显示舞台，不停在选本页。
  const showBoard = demoCast ? false : (state.phase === 'create' || (!(embedMode && forceComputerStage) && computerBoardRoom !== state.roomCode))
  document.querySelector('#computer-welcome').hidden = !showBoard
  document.querySelector('#computer-stage-mount').hidden = showBoard
  document.querySelector('#computer-room').hidden = showBoard
  document.querySelector('#computer-public').hidden = showBoard
  document.querySelector('#computer-events').closest('details').hidden = showBoard
  document.querySelector('#player-director').hidden = !inRoom
  document.querySelector('#clue-notice').hidden = !inRoom
  document.querySelector('.player-scene-entry').hidden = !showPlayerScene || state.roles[player] === null
  document.querySelector('#phone-tabs').hidden = !inRoom
  document.querySelector('#leave-player-scene').hidden = !playerSceneOpen
  document.querySelector('#enter-player-scene').hidden = playerSceneOpen
  document.querySelector('.phone').classList.toggle('scene-focused', playerSceneOpen && showPlayerScene)
  renderDemoTarget()
  document.querySelector('.test-flow-helper').hidden = !demoDevice
  document.querySelector('#demo-current-room').hidden = isTestEndpoint()
  document.body.dataset.previewEndpoint = endpoint
  document.body.dataset.testDevice = testDevice || ''
  if (endpoint === 'computer' && !computerIdleTimer) {
    showComputerPanels()
    document.body.classList.add('computer-panels-hidden')
  }
  if (demoDevice) startTestRoomPolling()
  else { stopTestRoomPolling(); testRoomCode = '' }
  if (endpoint === 'test') mountPlayerTests()
}

function enterPlayerStage() {
  if (endpoint !== 'player' || !hasJoined() || state.phase === 'create') return
  playerSceneBootRestore = false
  playerSceneOpen = true
  stagePanel = null
  renderPhone()
  renderEndpoints()
  sceneView?.enterImmersive('portrait')
}

function selectEndpoint(name) {
  endpoint = name
  playerSceneOpen = false
  labUI?.close()
  stageLab?.reset()
  const url = new URL(location.href)
  url.searchParams.set('endpoint', name)
  history.replaceState(null, '', url)
  renderEndpoints()
  syncComputerFullscreen()
  if (name === 'computer') {
    sceneView?.exitImmersive()
    sceneView?.setMode('god')
  }
}

function render() {
  renderPublicInformation()
  renderJourney()
  renderStage()
  renderHost()
  renderComputer()
  renderPhone()
  renderEndpoints()
  renderMusicControls()
  if (networked) renderNetworkControls()
  renderFlowMap()
  releaseBootView()
  maybeRunLabDemo()
}

// 首帧启动样式只负责挡住模块脚本加载前的空窗；#phone-body 渲染完成后交回 body[data-device="phone"]，只做一次。
function releaseBootView() {
  if (bootReleased) return
  bootReleased = true
  const root = document.documentElement
  if (!root.hasAttribute('data-boot-view') && !root.hasAttribute('data-boot-device')) return
  requestAnimationFrame(() => {
    root.removeAttribute('data-boot-view')
    root.removeAttribute('data-boot-device')
  })
}

async function handleAction(name, value) {
  if (name === 'note-mode') {
    const notes = readPrivateNotes()
    notes.mode = value === 'paper' ? 'paper' : 'phone'
    localStorage.setItem(privateNotesKey(), JSON.stringify(notes))
    return renderPhone()
  }
  if (name === 'favorite-toggle') {
    const notes = readPrivateNotes()
    notes.favorites = notes.favorites.includes(value) ? notes.favorites.filter(item => item !== value) : [...notes.favorites, value]
    localStorage.setItem(privateNotesKey(), JSON.stringify(notes))
    return renderPhone()
  }
  if (name === 'save-private-notes') {
    const notes = readPrivateNotes()
    notes.text = document.querySelector('#private-notes')?.value || ''
    localStorage.setItem(privateNotesKey(), JSON.stringify(notes))
    notify('个人笔记已保存在这台设备。')
    return
  }
  if (name === 'accordion') {
    accordionPanel = value
    renderPhone()
    // 换分区后内容整体换掉，滚动位置必须归零，否则从长内容切到角色简介时第一个头像会被裁在视口外。
    document.querySelectorAll('.accordion-content').forEach(node => { node.scrollTop = 0 })
    return
  }
  if (name === 'toggle-invite-qr') { invitationQrOpen = !invitationQrOpen; return renderPhone() }
  if (name === 'music-toggle') { toggleMusic(); return }
  if (name === 'music-library') { showMusicLibrary(); return }
  if (name === 'close-music-library') { document.querySelector('#music-library-dialog').close(); return }
  if (name === 'settings-placeholder') { openSettingsDialog(); return }
  if (name === 'close-settings') { document.querySelector('#settings-dialog')?.close(); return }
  if (name === 'cycle-music-rate') {
    // 规定见 主体原型/README.md：倍速只有电脑主机端与主持端可调，服务端同样校验。
    if (!['computer', 'host'].includes(endpoint)) return notify('播放速度只能在电脑主机端或主持端调整。')
    const rate = Number(state?.musicRate || 0.9)
    const next = MUSIC_RATES[(MUSIC_RATES.indexOf(rate) + 1) % MUSIC_RATES.length]
    if (networked) return routeNetworkAction('music-rate', String(next))
    state.musicRate = next
    musicAudio.playbackRate = next
    return renderMusicControls()
  }
  if (name === 'music-rate') {
    if (!['computer', 'host'].includes(endpoint)) return notify('播放速度只能在电脑主机端或主持端调整。')
    if (!networked) { state.musicRate = Number(value); musicAudio.playbackRate = state.musicRate; return renderMusicControls() }
  }
  if (name === 'entry-home') { entryMode = 'shelf'; creatingRoom = false; scriptDetail = null; accordionPanel = 'story'; return renderPhone() }
  if (name === 'entry-replay') { resetEntryCinema(); entryMode = 'shelf'; creatingRoom = false; scriptDetail = null; accordionPanel = 'story'; return renderPhone() }
  if (name === 'entry-create') { entryMode = 'library'; accordionPanel = 'story'; return renderPhone() }
  if (name === 'entry-join') { entryMode = 'join'; return renderPhone() }
  if (name === 'copy-room-code') { copyRoomCode(); return }
  if (name === 'reload-page') { location.reload(); return }
  if (name === 'toggle-fullscreen') { toggleFullscreen(); return }
  // 电脑主机端的选本页只改本地视图，不进房间状态，也不发给服务端。
  if (name === 'computer-pick-script') { computerBoardScript = value; return renderComputer() }
  if (name === 'computer-open-room') {
    if (!value) return
    setComputerBoard(value)
    const url = new URL(location.href)
    url.searchParams.set('room', value)
    url.searchParams.set('endpoint', 'computer')
    location.href = url.toString()
    return
  }
  if (name === 'computer-enter-stage') {
    if (!state.roomCode) return notify('还没有房间，请在手机上选本开房。')
    setComputerBoard(state.roomCode)
    return render()
  }
  if (name === 'leave-room') {
    if (!await askConfirm('退出后会解散当前房间，已加入的其他玩家也会回到入口，然后可以重新选本。确定退出吗？')) return
    return sendRoomAction('leave-room')
  }
  if (networked && await routeNetworkAction(name, value)) return
  const phase = state.phase
  if (name === 'reset') {
    if (!await askConfirm('重新开始将清空这次本机体验，确定吗？')) return
    state = freshState()
    player = 0
    tab = 'stage'
    playerSceneOpen = false
    scriptDetail = null
    entryMode = 'shelf'
    creatingRoom = false
    pendingShare = null
    return render()
  }
  if (name === 'script-detail') { scriptDetail = value; entryMode = 'library'; return render() }
  if (name === 'library-back') { scriptDetail = null; creatingRoom = false; entryMode = 'shelf'; return render() }
  if (name === 'begin-create' && scriptDetail === value) { creatingRoom = true; accordionPanel = 'hosting'; return render() }
  if (name === 'cancel-create') { creatingRoom = false; accordionPanel = 'story'; return render() }
  if (name === 'simulate-scan-room') return joinRoom(state.roomCode)
  if (name === 'player') { player = Number(value); state.selectedVote = null; tab = 'stage'; return render() }
  if (name === 'tab') { tab = value; pendingShare = null; playerSceneOpen = false; if (value === 'clues') state.seenShared[player] = [...state.shared]; return render() }
  if (name === 'explain') { state.paused = true; tab = 'help'; playerSceneOpen = false; return render() }
  if (name === 'resume') { state.paused = false; return render() }
  if (name === 'reconnect') { state.disconnected[player] = false; return render() }
  if (name === 'host-reconnect') { state.hostDisconnected = false; return render() }
  if (name === 'takeover') { state.manualControl = true; state.paused = false; return render() }
  // 没入席时只拦“房间里才能做的动作”；选本、看详情、开房、进房这些入口必须放行，
  // 否则房间还开着的时候，新扫码的人连剧本详情都点不动，只会一直收到“请先加入房间”。
  const entryActions = new Set(['script-detail', 'library-back', 'entry-home', 'entry-replay', 'entry-create', 'entry-join', 'begin-create', 'cancel-create', 'create', 'join', 'copy-room-code', 'reload-page', 'toggle-fullscreen', 'music-toggle', 'cycle-music-rate', 'music-rate', 'music-library', 'close-music-library'])
  if (endpoint === 'player' && phase !== 'create' && !hasJoined() && !entryActions.has(name)) return notify('请先加入房间。')
  if (state.paused || state.hostDisconnected) return notify('请先恢复主持流程。')
  if (name === 'release-host') { state.manualControl = false; return render() }
  if (name === 'pause') { state.paused = true; return render() }
  if (name === 'host' && phase === 'create') state.host = value
  if (name === 'create' && phase === 'create') {
    const script = scripts.find(item => item.id === value)
    if (!script || scriptDetail !== script.id || !creatingRoom) return notify('请先查看剧本详情，再确认开房。')
    state.scriptId = script.id
    state.roomOwner = player
    state.joined[player] = true
    state.roomCode = String(Math.floor(100000 + Math.random() * 900000))
    endpoint = 'player'
    playerSceneOpen = true
    stagePanel = 'operation'
    go('join')
    sceneView?.enterImmersive('portrait')
    return
  }
  if (name === 'pick-role' && ['join', 'ready'].includes(phase)) {
    const role = Number(value)
    if (!Number.isInteger(role) || role < 0 || role >= names.length) return
    if (state.roles.includes(role) && state.roles[player] !== role) return notify('这个角色已经被选择。')
    state.joined[player] = true
    if (state.seats[player] === null) {
      const available = names.map((_, index) => index).filter(seat => !state.seats.includes(seat))
      state.seats[player] = available[Math.floor(Math.random() * available.length)]
    }
    state.roles[player] = role
    record(`${roleName(player)}入席 ${state.seats[player] + 1} 号座位`)
    state.ready[player] = false
  }
  if (name === 'pick-seat' && ['join', 'ready'].includes(phase) && state.roles[player] !== null) {
    const seat = Number(value)
    if (!Number.isInteger(seat) || seat < 0 || seat > 4 || state.seats.includes(seat)) return notify('请选择一个空座位。')
    state.seats[player] = seat
    state.ready[player] = false
    record(`${roleName(player)}换到 ${seat + 1} 号座位`)
  }
  if (name === 'fill-roles' && phase === 'join') state.roles.forEach((role, index) => {
    state.joined[index] = true
    if (role === null) state.roles[index] = names.findIndex((_, candidate) => !state.roles.includes(candidate))
    if (state.seats[index] === null) state.seats[index] = names.findIndex((_, candidate) => !state.seats.includes(candidate))
  })
  if (name === 'demo-start-flow' && ['join', 'ready'].includes(phase)) {
    state.roles.forEach((role, index) => {
      state.joined[index] = true
      if (role === null) state.roles[index] = names.findIndex((_, candidate) => !state.roles.includes(candidate))
      if (state.seats[index] === null) state.seats[index] = names.findIndex((_, candidate) => !state.seats.includes(candidate))
    })
    state.ready.fill(true)
    state.consent.fill(false)
    state.recorded = false
    record('演示工具补齐五名玩家并准备就绪，按未同意录音继续开场。')
    return go('intro')
  }
  if (name === 'to-ready' && state.roles.every(role => role !== null)) return go('ready')
  if (name === 'back-join' && phase === 'ready') return go('join')
  if (name === 'ready' && ['join', 'ready'].includes(phase) && state.roles[player] !== null) state.ready[player] = true
  if (name === 'fill-ready' && phase === 'ready') state.ready.fill(true)
  if (name === 'to-consent' && state.ready.every(Boolean)) return go('consent')
  if (name === 'consent' && phase === 'consent') state.consent[player] = value === 'yes'
  if (name === 'fill-consent' && phase === 'consent') state.consent = state.consent.map(answer => answer ?? true)
  if (name === 'start' && !state.consent.includes(null)) {
    state.recorded = state.consent.every(Boolean)
    notify(state.recorded ? '演示录音未接入时的降级，游戏继续。' : '有人不同意录音，录音与识别均关闭。')
    return go('intro')
  }
  if (name === 'queue' && (phase === 'intro' || isDiscussion())) queuePlayer(player)
  if (name === 'queue-ask' && phase === 'intro' && state.introduced[player]) queueAsk(player)
  if (name === 'cancel-ask') state.askQueue = state.askQueue.filter(index => index !== player)
  if (name === 'cancel-queue') state.queue = state.queue.filter(index => index !== player)
  if (name === 'next-speaker' && state.speaker !== null) nextSpeaker()
  if (name === 'fill-intro' && phase === 'intro') { state.introduced.fill(true); state.introQueueStarted = true; state.speaker = null; state.queue = [] }
  if (name === 'intro-end' && state.introduced.every(Boolean)) return go('ask')
  if (name === 'target' && state.speaker === player) { state.target = Number(value); record(`${roleName(player)}向${roleName(Number(value))}提问`) }
  if (name === 'skip-countdown' && isDiscussion() && state.speaker === null) state.remaining = 0
  if (name === 'confirm' && isDiscussion() && state.remaining === 0) state.confirmed[player] = true
  if (['fill-confirm', 'simulate-confirm'].includes(name) && isDiscussion() && state.remaining === 0) state.confirmed.fill(true)
  if (name === 'discussion-end' && isDiscussion() && state.confirmed.every(Boolean)) return finishDiscussion()
  if (name === 'read') {
    const [round, part] = value.split('-').map(Number)
    if (round <= roundNumber() && !['create', 'join', 'ready', 'consent', 'intro', 'ask'].includes(phase)) state.read[round][player][part] = true
  }
  if (name === 'fill-read' && ['clue1', 'clue2'].includes(phase)) state.read[roundNumber()].forEach(read => read.fill(true))
  if (name === 'clues-end' && state.read[roundNumber()].every(read => read.every(Boolean))) return go(phase === 'clue1' ? 'discuss1' : 'discuss2')
  if (name === 'cancel-share') pendingShare = null
  if (['share', 'confirm-share'].includes(name) && cluesUnlocked()) {
    const [round, owner] = value.split('-').map(Number)
    if (owner !== player || round < 1 || round > roundNumber() || state.shared.includes(value)) return
    if (name === 'share') pendingShare = value
    else if (pendingShare === value) {
      state.shared.push(value)
      state.seenShared[player].push(value)
      pendingShare = null
      record(`${roleName(player)}公开了第${round}轮个人线索`)
      notify('这条线索的完整内容已加入全桌公共线索区。')
    }
  }
  if (name === 'select-vote' && phase === 'vote') state.selectedVote = value === 'abstain' ? 'abstain' : Number(value)
  if (name === 'submit-vote' && phase === 'vote' && state.votes[player] === undefined && state.selectedVote !== null) {
    state.votes[player] = state.selectedVote === 'abstain' ? null : state.selectedVote
    state.selectedVote = null
  }
  if (name === 'fill-votes' && phase === 'vote') {
    if (value === 'abstain') state.votes = state.votes.map(vote => vote === undefined ? null : vote)
    else {
      const votes = value === 'tie' ? [0, 0, 1, 1, null] : [4, 4, 4, 1, 2]
      state.votes = state.votes.map((vote, index) => vote === undefined ? votes[index] : vote)
    }
  }
  if ((name === 'vote-timeout' || state.votes.every(vote => vote !== undefined)) && phase === 'vote') return finishVote()
  if (name === 'tally-next' && phase === 'tally') {
    if (state.winner === null) { state.voteRound++; return go('tie') }
    return go('exit')
  }
  if (name === 'exit-end' && phase === 'exit') return go('silence')
  if (name === 'silence-end' && phase === 'silence' && state.remaining === 0) return go('identity')
  if (name === 'identity-end' && phase === 'identity') return go('truth')
  if (name === 'truth-end' && phase === 'truth') return go('outcome')
  if (name === 'outcome-end' && phase === 'outcome') return go('ended')
  if (name === 'record-disposition' && phase === 'ended') { state.keptRecording = !state.keptRecording; notify('已更新处置选择，当前没有真实录音文件。') }
  if (name === 'disconnect') state.disconnected[player] = true
  if (name === 'host-disconnect' && state.host === 'human') state.hostDisconnected = true
  if (name === 'edit-summary') {
    const text = await askDialog('填写全桌可见的阶段总结', { input: true, value: state.summaries[value] || '' })
    if (text !== null) { state.summaries[value] = text.slice(0, 3000); state.versions.push({ round: value, author: roleName(player), text: text.slice(0, 3000) }) }
  }
  render()
}

document.addEventListener('click', event => {
  const favoriteButton = event.target.closest('.story-highlight[data-action="favorite-toggle"]')
  if (favoriteButton && suppressFavoriteClick) {
    suppressFavoriteClick = false
    return
  }
  const endpointButton = event.target.closest('button[data-endpoint]')
  if (endpointButton) return selectEndpoint(endpointButton.dataset.endpoint)
  if (event.target.closest('.stage-dock-trigger')) {
    const docks = [...document.querySelectorAll('.theatre .stage-dock')]
    const expanded = !event.target.closest('.stage-dock').classList.contains('stage-dock-open')
    docks.forEach(dock => {
      dock.classList.toggle('stage-dock-open', expanded)
      dock.querySelector('.stage-dock-trigger')?.setAttribute('aria-expanded', String(expanded))
    })
    document.querySelector('.theatre')?.classList.remove('controls-hidden')
    return
  }
  if (event.target.closest('.stage-drawer-close')) {
    stagePanel = null
    renderStageDrawer()
    return
  }
  const stagePanelButton = event.target.closest('[data-stage-panel]')
  if (stagePanelButton) {
    stagePanel = stagePanelButton.dataset.stagePanel
    renderStageDrawer()
    return
  }
  const button = event.target.closest('[data-action]')
  if (button && !button.disabled) handleAction(button.dataset.action, button.dataset.value)
  const trackButton = event.target.closest('[data-music-index]')
  if (trackButton) {
    musicTrackIndex = Number(trackButton.dataset.musicIndex)
    preparationLoop = false
    playMusicTrack(musicLibrary[musicTrackIndex])
  }
})
let favoritePressTimer
let favoriteLongPressReady = false
let suppressFavoriteClick = false
document.addEventListener('pointerdown', event => {
  const button = event.target.closest('.story-highlight[data-action="favorite-toggle"]')
  if (!button) return
  clearTimeout(favoritePressTimer)
  favoriteLongPressReady = false
  favoritePressTimer = setTimeout(() => { favoriteLongPressReady = true }, 500)
})
document.addEventListener('pointerup', event => {
  const button = event.target.closest('.story-highlight[data-action="favorite-toggle"]')
  clearTimeout(favoritePressTimer)
  if (!button || !favoriteLongPressReady) return
  event.preventDefault()
  favoriteLongPressReady = false
  suppressFavoriteClick = true
  handleAction(button.dataset.action, button.dataset.value)
})
document.addEventListener('pointercancel', () => {
  clearTimeout(favoritePressTimer)
  favoriteLongPressReady = false
})
document.addEventListener('contextmenu', event => {
  if (event.target.closest('.story-highlight[data-action="favorite-toggle"]')) event.preventDefault()
})
document.querySelector('.theatre').addEventListener('stage-idle', () => {
  stagePanel = null
  renderStageDrawer()
})
/* 电脑主机端待机：30 秒没有任何输入就把画面铺满整屏。
   退出只认“单纯点一下”：滑动、拖拽、长按松手都不算点击，避免触控板滑动被误判。 */
let computerStandbyTimer = null
let computerStandbyPointer = null
/* ?standby=0 关闭待机大屏，便于调试与截图核对 */
const computerStandbyDisabled = params.get('standby') === '0'
function armComputerStandby() {
  if (endpoint !== 'computer' || embedMode || computerStandbyDisabled) return
  clearTimeout(computerStandbyTimer)
  computerStandbyTimer = setTimeout(() => {
    document.body.classList.add('computer-standby')
    // 浏览器要求全屏必须由手势触发；定时器里请求多半会被拒，被拒时退回铺满视口。
    const target = document.querySelector('.theatre')
    if (target?.requestFullscreen && !document.fullscreenElement) target.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
  }, 30000)
}
function noteComputerActivity() {
  if (endpoint !== 'computer' || embedMode) return
  // 已经铺满时，滑动只算“有人在用”，不该把整屏收回去。
  if (document.body.classList.contains('computer-standby')) return
  armComputerStandby()
}
function exitComputerStandby() {
  if (endpoint !== 'computer' || embedMode) return
  document.body.classList.remove('computer-standby')
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  armComputerStandby()
}
document.addEventListener('pointerdown', event => {
  computerStandbyPointer = { x: event.clientX, y: event.clientY, time: performance.now(), moved: false }
  noteComputerActivity()
})
document.addEventListener('pointermove', event => {
  const pointer = computerStandbyPointer
  if (pointer && !pointer.moved && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 10) pointer.moved = true
  noteComputerActivity()
})
document.addEventListener('pointerup', () => {
  const pointer = computerStandbyPointer
  computerStandbyPointer = null
  noteComputerActivity()
  if (!pointer || pointer.moved) return
  if (performance.now() - pointer.time > 600) return
  exitComputerStandby()
})
document.addEventListener('keydown', noteComputerActivity)
/* 完整流程演示：每隔 2 秒点一下当前阶段推荐的测试按钮，直到结束，方便在玩家端观察全流程。 */
const FULL_FLOW_ACTIONS = new Set([
  'demo-start-flow', 'fill-roles', 'to-ready', 'fill-ready', 'to-consent', 'fill-consent', 'start',
  'fill-intro', 'intro-end', 'fill-read', 'clues-end', 'fill-confirm', 'skip-countdown',
  'discussion-end', 'fill-votes', 'vote-timeout', 'next-speaker', 'simulate-scan-room', 'simulate-confirm',
  'takeover', 'release-host',
])
let fullFlowTimer = null
let fullFlowSteps = 0
let fullFlowTarget = ''
function stopFullFlow(message) {
  if (fullFlowTimer) clearInterval(fullFlowTimer)
  fullFlowTimer = null
  const status = document.querySelector('#full-flow-status')
  if (status && message) status.textContent = message
  const button = document.querySelector('#run-full-flow')
  if (button) button.textContent = '从头跑一遍'
}
function fullFlowStep() {
  const phase = state.phase
  if (fullFlowTarget && phase === fullFlowTarget) {
    const reached = byId[fullFlowTarget]?.[1] || fullFlowTarget
    fullFlowTarget = ''
    stopFullFlow(`已到达：${reached}`)
    return
  }
  if (['outcome', 'ended'].includes(phase) || fullFlowSteps > 40) { fullFlowTarget = ''; stopFullFlow(`流程结束（${phase}）`); return }
  fullFlowSteps += 1
  const panel = document.querySelector('#demo-actions')
  const buttons = [...(panel?.querySelectorAll('button') || [])].filter(button => !button.disabled && !button.hidden)
  const target = buttons.find(button => FULL_FLOW_ACTIONS.has(button.dataset.action)) || buttons.find(button => button.classList.contains('primary'))
  const status = document.querySelector('#full-flow-status')
  if (!target) { if (status) status.textContent = `${phase}：等待可推进的操作…`; return }
  if (status) status.textContent = `${phase} → ${target.textContent.trim()}`
  target.click()
}
function startFullFlow() {
  stopFullFlow()
  fullFlowSteps = 0
  const button = document.querySelector('#run-full-flow')
  if (button) button.textContent = '停止完整流程'
  const status = document.querySelector('#full-flow-status')
  if (status) status.textContent = fullFlowTarget ? `推进到「${byId[fullFlowTarget]?.[1] || fullFlowTarget}」（当前 ${state.phase}）` : `开始（${state.phase}）`
  fullFlowTimer = setInterval(fullFlowStep, 2200)
  fullFlowStep()
}
document.querySelector('#run-full-flow')?.addEventListener('click', () => {
  if (fullFlowTimer) stopFullFlow('已停止')
  else { fullFlowTarget = ''; startFullFlow() }
})
/* 全流程线性图：从上到下排列所有阶段，左右交错；点任一节点就从当前状态推进到那一步。 */
let flowMapBuilt = false
function renderFlowMap() {
  const list = document.querySelector('#flow-map')
  if (!list) return
  if (!flowMapBuilt) {
    list.innerHTML = phases.map((phase, index) => `<li><button type="button" class="flow-node${index % 2 ? ' is-right' : ''}" data-phase="${phase[0]}"><span class="flow-dot"></span><span class="flow-label"><b>${escaped(phase[1])}</b><small>${escaped(phase[2])}</small></span></button></li>`).join('')
    flowMapBuilt = true
    list.addEventListener('click', event => {
      const node = event.target.closest('.flow-node')
      if (node) startFullFlowTo(node.dataset.phase)
    })
  }
  const current = phases.findIndex(phase => phase[0] === state.phase)
  ;[...list.querySelectorAll('.flow-node')].forEach((node, index) => {
    node.classList.toggle('is-done', index < current)
    node.classList.toggle('is-current', index === current)
  })
  const active = list.querySelector('.flow-node.is-current')
  if (active && list.scrollHeight > list.clientHeight) list.scrollTop = active.offsetTop - list.clientHeight / 2
}
function startFullFlowTo(target) {
  if (!target || !state) return
  if (state.phase === target) { notify(`已经在这一步：${byId[target]?.[1] || target}`); return }
  const from = phases.findIndex(phase => phase[0] === state.phase)
  const to = phases.findIndex(phase => phase[0] === target)
  if (to < from) { notify('线性流程只能向后推进，要回退请先重置测试房间。'); return }
  fullFlowTarget = target
  startFullFlow()
}
// 全屏里点一下就退回；未全屏时，房间还在就顺手切进全屏。
document.addEventListener('click', () => {
  if (endpoint !== 'computer' || embedMode) return
  if (document.body.classList.contains('computer-standby') || document.fullscreenElement) {
    exitComputerStandby()
    return
  }
  if (!computerBoardRoom) return
  document.querySelector('.theatre')?.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {})
})
armComputerStandby()
document.querySelector('.theatre').addEventListener('click', event => {
  if (event.target.closest('.stage-dock-trigger')) return
  if (document.querySelector('.theatre').dataset.immersive === 'true') document.querySelectorAll('.stage-dock').forEach(dock => dock.classList.add('stage-dock-open'))
})
document.addEventListener('change', event => {
  if (event.target.matches('.music-rate-select')) handleAction('music-rate', event.target.value)
})
document.querySelector('#reset').addEventListener('click', () => handleAction('reset', ''))
document.querySelector('#leave-room-admin').addEventListener('click', () => handleAction('leave-room', ''))
// 动画实验室跨画面桥：画布里的同源 iframe 各自有一份舞台副本，
// 实验室命令用 postMessage 广播过去；只改本机视觉，不写房间阶段/队列/投票。
const LAB_BRIDGE_METHODS = new Set(['playTurn', 'stop', 'reset', 'skip', 'setView', 'setDemoSpeaker', 'setSeatBack', 'setLowerView', 'setSpotlight', 'setPush', 'setFirstCamera', 'setStrictGuard', 'setTimeScale', 'setLoop'])
const labBridgeQueue = []

function broadcastLabCommand(method, args) {
  document.querySelectorAll('iframe').forEach(frame => {
    try { frame.contentWindow?.postMessage({ type: 'weizhuo:lab', method, args }, location.origin) } catch { /* 跨源或已卸载的帧 */ }
  })
}

// 给实验室面板的 lab 套一层代理：本地照常执行，同时把同一命令发给各画面副本。
function withLabBridge(lab) {
  return new Proxy(lab, {
    get(target, key) {
      const value = target[key]
      if (typeof value !== 'function') return value
      const bound = value.bind(target)
      if (!LAB_BRIDGE_METHODS.has(key)) return bound
      return (...args) => {
        const result = bound(...args)
        broadcastLabCommand(key, args)
        return result
      }
    },
  })
}

function applyLabBridgeCommand(method, args) {
  if (!LAB_BRIDGE_METHODS.has(method)) return
  if (!stageLab) {
    labBridgeQueue.push([method, args])
    if (labBridgeQueue.length > 40) labBridgeQueue.shift()
    return
  }
  try {
    stageLab[method](...(Array.isArray(args) ? args : []))
    sceneView?.update()
  } catch { /* 单条命令失败不影响舞台 */ }
}

// 画布把测试房号发给各副本；副本自己重连 SSE，不重载 iframe，页面状态不丢。
async function applyCanvasRoom(room) {
  /* 大厅态镜像不跟随房间：画面重载后由新页面自己接房号 */
  if (lobbyMirror) return
  const code = typeof room === 'string' ? room.trim() : ''
  if (!code || (lan.roomCode === code && lanEventsRoom === code)) return
  await connectRoom(code)
  if (endpoint === 'computer' && state.roomCode === code) setComputerBoard(code)
  if (endpoint === 'player' && !hasJoined()) {
    entryMode = 'join'
    roomCodeDraft = code
    render()
  }
}

window.addEventListener('message', event => {
  if (event.origin !== location.origin || !event.data) return
  if (event.data.type === 'weizhuo:lab') applyLabBridgeCommand(event.data.method, event.data.args)
  else if (event.data.type === 'weizhuo:target-room') applyCanvasRoom(event.data.room)
})
function toggleDemo(open) {
  document.querySelector('#demo-panel').hidden = !open
  document.querySelector('#demo-toggle').setAttribute('aria-expanded', String(open))
  if (open) refreshTestRoomTarget()
}
document.querySelector('#demo-toggle').addEventListener('click', () => {
  const open = document.querySelector('#demo-panel').hidden
  if (!open) canvasDemoUserClosed = true
  toggleDemo(open)
})
document.querySelector('#demo-close').addEventListener('click', () => { canvasDemoUserClosed = true; toggleDemo(false) })
/* 选本页的入场链接按当前局域网地址生成，手机打开就是这台电脑。 */
document.querySelectorAll('#entry-link').forEach(link => {
  link.href = location.origin + '/play'
  link.textContent = location.origin + '/play'
})
/* 演示工具手风琴：单开，点开一组收起其它组。 */
document.querySelectorAll('.demo-group-head').forEach(head => {
  head.addEventListener('click', () => {
    const group = head.closest('.demo-group')
    const wasOpen = group.classList.contains('demo-group-open')
    document.querySelectorAll('.demo-group').forEach(item => {
      item.classList.remove('demo-group-open')
      item.querySelector('.demo-group-head').setAttribute('aria-expanded', 'false')
      item.querySelector('.demo-group-body').hidden = true
    })
    if (wasOpen) return
    group.classList.add('demo-group-open')
    head.setAttribute('aria-expanded', 'true')
    group.querySelector('.demo-group-body').hidden = false
  })
})
/* 三镜演示：一键把画布编排到对应镜头（只改画面，不动房间状态）。 */
document.querySelectorAll('[data-demo-stage]').forEach(button => {
  button.addEventListener('click', () => {
    const stage = Number(button.dataset.demoStage) || 0
    canvasBoard?.demo?.(stage)
    document.querySelectorAll('[data-demo-stage]').forEach(item => {
      item.setAttribute('aria-pressed', String(item === button))
    })
  })
})
const tableSizeInput = document.querySelector('#table-size')
if (tableSizeInput) {
  const tableSizeValue = document.querySelector('#table-size-value')
  const applyTableSize = () => {
    tableScale = THREE.MathUtils.clamp(Number(tableSizeInput.value) || 1, .75, 1.35)
    tableSizeValue.textContent = `${Math.round(tableScale * 100)}%`
    sceneView?.setTableScale(tableScale)
  }
  tableSizeInput.addEventListener('input', applyTableSize)
  applyTableSize()
}
const chairSizeInput = document.querySelector('#chair-size')
if (chairSizeInput) {
  const chairSizeValue = document.querySelector('#chair-size-value')
  const applyChairSize = () => {
    chairScale = THREE.MathUtils.clamp(Number(chairSizeInput.value) || 1, .75, 1.35)
    chairSizeValue.textContent = `${Math.round(chairScale * 100)}%`
    sceneView?.setChairScale(chairScale)
  }
  chairSizeInput.addEventListener('input', applyChairSize)
  applyChairSize()
}
const floorHeightInput = document.querySelector('#floor-height')
if (floorHeightInput) {
  const floorHeightValue = document.querySelector('#floor-height-value')
  const applyFloorHeight = () => {
    floorOffset = THREE.MathUtils.clamp(Number(floorHeightInput.value) || 0, -1.2, 1.2)
    floorHeightValue.textContent = `${floorOffset > 0 ? '+' : ''}${floorOffset.toFixed(1)}`
    sceneView?.setFloorOffset(floorOffset)
  }
  floorHeightInput.addEventListener('input', applyFloorHeight)
  applyFloorHeight()
}
const cwuBrightInput = document.querySelector('#cwu-bright')
if (cwuBrightInput) {
  const cwuBrightValue = document.querySelector('#cwu-bright-value')
  const cwuWelcome = document.querySelector('#computer-welcome')
  const applyCwuBright = () => {
    const value = THREE.MathUtils.clamp(Number(cwuBrightInput.value) || 1, .5, 1.8)
    cwuBrightValue.textContent = `${Math.round(value * 100)}%`
    cwuWelcome?.style.setProperty('--cw-bright', String(value))
    try { localStorage.setItem('weizhuo:cwuBright', String(value)) } catch {}
  }
  try {
    const saved = Number(localStorage.getItem('weizhuo:cwuBright'))
    if (saved >= .5 && saved <= 1.8) cwuBrightInput.value = String(saved)
  } catch {}
  cwuBrightInput.addEventListener('input', applyCwuBright)
  applyCwuBright()
}
document.querySelector('#enter-player-scene').addEventListener('click', () => {
  playerSceneOpen = true
  renderEndpoints()
  stagePanel = null
  sceneView?.enterImmersive('portrait')
})
document.querySelector('#leave-player-scene').addEventListener('click', () => {
  playerSceneOpen = false
  stagePanel = null
  sceneView?.exitImmersive()
  renderEndpoints()
})
function joinRoom(code) {
  roomCodeDraft = code
  if (networked) return sendRoomAction('join', code)
  if (state.phase === 'create' || code !== state.roomCode) {
    const error = document.querySelector('#join-error')
    if (error) error.textContent = '房间码不正确，或朋友尚未创建房间。'
    return
  }
  if (!['join', 'ready'].includes(state.phase) && !hasJoined()) return notify('本局已经开始，请等待下次开房。')
  state.joined[player] = true
  tab = 'stage'
  record(`玩家 ${player + 1} 加入房间`)
  render()
}

document.addEventListener('submit', event => {
  if (event.target.id === 'join-room-form') {
    event.preventDefault()
    return joinRoom(document.querySelector('#room-code').value.trim())
  }
  if (event.target.id !== 'host-question-form') return
  event.preventDefault()
  if (state.disconnected[player]) return
  const input = document.querySelector('#host-question')
  const text = input.value.trim()
  if (!text) return
  if (networked) { sendRoomAction('explain', text); return }
  state.messages.push({ author: roleName(player), text: text.slice(0, 300) })
  if (state.host === 'ai' && !['create', 'ended'].includes(state.phase)) {
    state.paused = true
    state.messages.push({ author: '主持演示回复', text: '已暂停推进。当前可以查看阶段操作与已开放信息，确认后继续。本原型尚未接入真实 AI。' })
  }
  render()
})

function advanceAutomaticHost() {
  if (state.host !== 'ai' || state.manualControl) return false
  let operation
  switch (state.phase) {
    case 'join': if (!state.roles.includes(null)) operation = 'to-ready'; break
    case 'ready': if (state.ready.every(Boolean)) operation = 'to-consent'; break
    case 'consent': if (!state.consent.includes(null)) operation = 'start'; break
    case 'intro': if (state.introduced.every(Boolean)) operation = 'intro-end'; break
    case 'ask':
    case 'discuss1':
    case 'discuss2':
    case 'tie': if (state.confirmed.every(Boolean)) operation = 'discussion-end'; break
    case 'clue1':
    case 'clue2': if (state.read[roundNumber()].every(read => read.every(Boolean))) operation = 'clues-end'; break
    case 'tally': if (state.phaseSeconds >= 5) operation = 'tally-next'; break
    case 'exit': if (state.phaseSeconds >= 4) operation = 'exit-end'; break
    case 'silence': if (state.remaining === 0) operation = 'silence-end'; break
    case 'identity': if (state.phaseSeconds >= 7) operation = 'identity-end'; break
    case 'truth': if (state.phaseSeconds >= 9) operation = 'truth-end'; break
    case 'outcome': if (state.phaseSeconds >= 7) operation = 'outcome-end'; break
  }
  if (!operation) return false
  handleAction(operation, '')
  return true
}

setInterval(() => {
  if (networked || previewMode) return
  if (state.paused || state.hostDisconnected) return
  state.phaseSeconds++
  const timerJustEnded = state.remaining === 1
  if (state.remaining !== null && state.remaining > 0) state.remaining--
  if (state.remaining === 0 && state.phase === 'vote') return finishVote()
  if (advanceAutomaticHost()) return
  renderStage()
  for (const panel of document.querySelectorAll('.public-facts')) {
    const timer = panel.querySelector('[data-role="timer"]')
    if (timer) timer.textContent = `计时　${state.remaining === null ? '当前不限时' : timeText()}`
  }
  renderHostOverview()
  if (timerJustEnded) { renderHost(); renderPhone() }
}, 1000)

function contrast(foreground, background) {
  const luminance = hex => {
    const channels = hex.match(/\w\w/g).map(channel => parseInt(channel, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
  }
  const first = luminance(foreground)
  const second = luminance(background)
  return ((Math.max(first, second) + .05) / (Math.min(first, second) + .05)).toFixed(1)
}
document.querySelector('#contrast').textContent = `文字对比度核验　主文字 ${contrast('e6e8e5', '171a1d')}∶1 · 手机正文 ${contrast('282a29', 'e8e6df')}∶1 · 手机辅助文字 ${contrast('5f6361', 'e8e6df')}∶1。`

state = freshState()
if (previewMode) {
  const previewPhase = params.get('previewPhase')
  const previewScreen = params.get('previewScreen')
  const invited = params.get('previewRole') === 'invited'
  player = invited ? 1 : 0
  state.scriptId = scripts[0].id
  state.manualControl = true
  state.roomOwner = 0
  state.roomCode = '123456'
  if (byId[previewPhase] && previewPhase !== 'create') {
    state.phase = previewPhase
    state.joined.fill(true)
    state.roles = [0, 1, 2, 3, 4]
    state.seats = [0, 1, 2, 3, 4]
    if (previewPhase === 'join') state.roles[player] = null
    state.ready.fill(previewPhase !== 'join')
    state.host = 'human'
    state.paused = false
    state.shared = ['clue2', 'discuss2', 'vote', 'tally', 'tie', 'exit', 'silence', 'identity', 'truth', 'outcome', 'ended'].includes(previewPhase) ? ['1-0', '2-1'] : ['clue1', 'discuss1'].includes(previewPhase) ? ['1-0'] : []
    if (['intro', 'ask', 'discuss1', 'discuss2'].includes(previewPhase)) state.speaker = 0
    if (['tally', 'tie', 'exit', 'silence', 'identity', 'truth', 'outcome', 'ended'].includes(previewPhase)) {
      const tied = previewPhase === 'tie'
      state.votes = tied ? [1, 0, 2, 1, 0] : [1, 1, 2, 1, 3]
      state.winner = tied ? null : 1
      state.history = [{ round: 1, votes: [...state.votes], counts: tied ? [2, 2, 1, 0, 0] : [0, 3, 1, 1, 0], allAbstained: false }]
    }
    computerBoardRoom = state.roomCode
    if (endpoint === 'player' && !['join', 'ready', 'consent'].includes(previewPhase)) playerSceneOpen = true
  } else if (previewScreen === 'hosting') {
    entryMode = 'library'
    scriptDetail = scripts[0].id
    creatingRoom = true
    accordionPanel = 'hosting'
  } else if (previewScreen === 'join-code') {
    entryMode = 'join'
  }
  document.body.dataset.preview = '1'
}
render()
// shelf=1：只做选本预览，不连房间，避免手机刷新后被带回正在进行的房间。
if (networked && !forceShelf) connectRoom()
window.prototypeSnapshot = () => structuredClone({ ...state, player, tab, endpoint, playerSceneOpen })

async function buildStage() {
  const container = document.querySelector('#stage-canvas')
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.setClearColor(0x080d0f)
  container.appendChild(renderer.domElement)
  renderer.domElement.setAttribute('aria-label', '五名立体木偶围坐木桌的三维舞台')
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x080d0f, 18, 32)
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 80)
  camera.position.set(0, 9, 13.8)
  camera.lookAt(0, .8, 0)

  const material = (color, roughness = .85, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
  // 冷夜场景基线：深灰绿木材与石板地面，暖色只留给极小的烛光。
  const wood = material(0x463526)
  const darkWood = material(0x1d1611)
  const brass = material(0x7a6a4f, .62, .3)
  const fabric = material(0x201c16)

  function mesh(geometry, surface, parent, position = [0, 0, 0]) {
    const object = new THREE.Mesh(geometry, surface)
    object.position.set(...position)
    object.castShadow = true
    object.receiveShadow = true
    parent.add(object)
    return object
  }
  function sphere(parent, radius, surface, position, scale = [1, 1, 1]) {
    const object = mesh(new THREE.SphereGeometry(radius, 24, 16), surface, parent, position)
    object.scale.set(...scale)
    return object
  }
  function cylinder(parent, top, bottom, height, surface, position, segments = 40) {
    return mesh(new THREE.CylinderGeometry(top, bottom, height, segments), surface, parent, position)
  }
  function box(parent, width, height, depth, surface, position) {
    return mesh(new THREE.BoxGeometry(width, height, depth), surface, parent, position)
  }

  const ambient = new THREE.HemisphereLight(0xa8bac0, 0x080d0f, .92)
  scene.add(ambient)
  const key = new THREE.DirectionalLight(0xa9bec4, 1.85)
  key.position.set(-4, 10, 6)
  key.castShadow = false
  key.shadow.mapSize.set(1024, 1024)
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: .5, far: 28 })
  key.shadow.normalBias = .04
  scene.add(key)
  // 吊灯：全场唯一的主光点，影子的方向由它决定。
  // 之前只有极弱的环境光加一盏烛火，画面整片死黑，椅子和木偶都看不出轮廓。
  const lampLight = new THREE.PointLight(0xffd2a0, 72, 26, 1.15)
  lampLight.position.set(0, 6.15, 0)
  lampLight.castShadow = true
  lampLight.shadow.mapSize.set(1024, 1024)
  lampLight.shadow.bias = -.0025
  lampLight.shadow.normalBias = .03
  lampLight.shadow.camera.near = .4
  lampLight.shadow.camera.far = 20
  scene.add(lampLight)
  const lampBulb = new THREE.Mesh(
    new THREE.SphereGeometry(.085, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe0b4 })
  )
  lampBulb.position.copy(lampLight.position)
  scene.add(lampBulb)
  const lampHalo = new THREE.Mesh(
    new THREE.SphereGeometry(.26, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xffcf99, transparent: true, opacity: .18, depthWrite: false })
  )
  lampHalo.position.copy(lampLight.position)
  scene.add(lampHalo)
  const lampCord = mesh(new THREE.CylinderGeometry(.008, .008, 1.6, 8), material(0x2a2620), scene, [0, 6.95, 0])
  void lampCord
  const rim = new THREE.PointLight(0x496966, 10, 18)
  rim.position.set(4, 5, -4)
  scene.add(rim)

  const floor = new THREE.Group()
  scene.add(floor)
  cylinder(floor, 5.4, 5.6, .27, darkWood, [0, -.24, 0], 96)
  const floorSlate = material(0x272219, .94)
  const floorGroove = material(0x121009, .96)
  cylinder(floor, 5.35, 5.35, .08, floorSlate, [0, -.06, 0], 96)
  for (let index = -8; index <= 8; index++) {
    const z = index * .59
    const length = Math.sqrt(Math.max(0, 5.25 ** 2 - z ** 2)) * 2
    box(floor, length, .008, .018, floorGroove, [0, -.01, z])
  }
  const edge = mesh(new THREE.TorusGeometry(5.38, .025, 8, 100), brass, floor, [0, -.05, 0])
  edge.rotation.x = Math.PI / 2

  // 按郭老师要求撤掉桌子两侧的长条柱子与幕布，舞台上只留桌子、五把椅子和地面。

  const table = new THREE.Group()
  scene.add(table)
  cylinder(table, 2.25, 2.25, .19, wood, [0, 1.10, 0], 96)
  cylinder(table, 2.14, 2.14, .025, fabric, [0, 1.21, 0], 96)
  const lip = mesh(new THREE.TorusGeometry(2.23, .035, 10, 100), brass, table, [0, 1.17, 0])
  lip.rotation.x = Math.PI / 2
  cylinder(table, .32, .52, .90, darkWood, [0, .55, 0])
  for (let index = 0; index < 4; index++) {
    const foot = box(table, .25, .18, 1.1, wood, [Math.sin(index * Math.PI / 2) * .5, .1, Math.cos(index * Math.PI / 2) * .5])
    foot.rotation.y = index * Math.PI / 2
  }

  const props = new THREE.Group()
  scene.add(props)
  const paper = material(0xb8c1bc)
  const envelope = box(props, .53, .018, .36, paper, [-.45, 1.25, .1])
  envelope.rotation.y = .25
  cylinder(props, .07, .07, .025, material(0x514d43), [-.45, 1.275, .1], 24)
  box(props, .35, .12, .42, darkWood, [.5, 1.29, -.3])
  cylinder(table, .07, .075, .35, material(0x9ba7a1), [0, 1.44, -.15], 24)
  const flame = sphere(table, .07, new THREE.MeshBasicMaterial({ color: 0xc8a56c }), [0, 1.67, -.15], [.6, 1.6, .6])
  const candleLight = new THREE.PointLight(0xc59d63, 1.45, 4.5)
  candleLight.position.set(0, 1.75, -.15)
  scene.add(candleLight)

  /* 入席氛围方案：?mood=candle|night 只换灯光、雾和材质色温，几何与交互完全不变。
     candle＝暗场烛光（几乎全黑，只有桌面一小圈暖光）；night＝夜色窗光（冷蓝月光从后侧压过来）。 */
  const stageMood = params.get('mood')
  if (stageMood === 'candle' || stageMood === 'night') {
    const candle = stageMood === 'candle'
    ambient.color.set(candle ? 0x4a3626 : 0x5d7893)
    ambient.groundColor.set(candle ? 0x060403 : 0x05070d)
    ambient.intensity = candle ? .34 : .62
    key.color.set(candle ? 0x7a6248 : 0xa6c8ee)
    key.intensity = candle ? .4 : 1.3
    key.position.set(candle ? -4 : -7, candle ? 10 : 7, candle ? 6 : -9)
    lampLight.color.set(candle ? 0xffa04f : 0x8fb4d8)
    lampLight.intensity = candle ? 42 : 6
    lampLight.distance = candle ? 11 : 15
    lampLight.decay = candle ? 1.5 : 1.15
    lampBulb.material.color.set(candle ? 0xffb87a : 0x8fb4d8)
    lampHalo.material.color.set(candle ? 0xffab6b : 0x7fa8cc)
    lampHalo.material.opacity = candle ? .12 : .07
    rim.color.set(candle ? 0x2a3a34 : 0x74a8dc)
    rim.intensity = candle ? 3 : 20
    rim.position.set(candle ? 4 : 5, 5, candle ? -4 : -6)
    candleLight.color.set(candle ? 0xff9f4f : 0xd7a86a)
    candleLight.intensity = candle ? 14 : .6
    candleLight.distance = candle ? 8 : 4
    scene.fog.color.set(candle ? 0x0a0704 : 0x050912)
    scene.fog.near = candle ? 20 : 16
    scene.fog.far = candle ? 40 : 36
    renderer.setClearColor(candle ? 0x040302 : 0x04070d)
    renderer.toneMappingExposure = candle ? 1 : .98
    wood.color.set(candle ? 0x33241a : 0x24303f)
    darkWood.color.set(candle ? 0x0f0b07 : 0x0b1016)
    fabric.color.set(candle ? 0x17110a : 0x141b25)
    floorSlate.color.set(candle ? 0x191309 : 0x161d28)
    floorGroove.color.set(candle ? 0x0a0704 : 0x090d12)
    brass.color.set(candle ? 0x6a5943 : 0x5a6672)
  }

  const dolls = []
  const spotlights = []
  // The two front seats and three rear seats keep every puppet visible from the fixed camera.
  // 五席按正五边形均匀分布，相邻座椅夹角 72°；背席固定在正后方，便于竖屏构图。
  const seats = [[-2.90, -.94], [-1.79, 2.47], [0, -3.05], [1.79, 2.47], [2.90, -.94]]
  for (let index = 0; index < 5; index++) {
    const [x, z] = seats[index]
    // 椅子是固定家具，钉在各自的席位上；木偶另起一个轴心，换座时只动人不动椅子。
    // 之前把木偶挂在椅子上、椅子跟着角色走，两个角色坐近就会两把椅子叠在一起。
    const chair = new THREE.Group()
    chair.position.set(x, 0, z)
    chair.rotation.y = Math.atan2(-x, -z)
    scene.add(chair)
    // 西式高背椅：软垫座面、四条细腿、两侧扶手和竖向椅背。
    // 座面比原来的略低 5cm：木偶是坐姿模型，髋部和膝盖刚好压在座面上，不再陷进椅面。
    box(chair, .88, .13, .82, darkWood, [0, .58, 0])
    box(chair, .72, .09, .7, material(0x263937), [0, .68, 0])
    for (const a of [-1, 1]) for (const b of [-1, 1]) box(chair, .075, .56, .075, wood, [a * .34, .26, b * .31])
    box(chair, .9, .1, .12, wood, [0, 1.73, -.37])
    for (const bar of [-2, -1, 0, 1, 2]) box(chair, .055, .86, .07, wood, [bar * .15, 1.28, -.37])
    // 去掉两侧扶手：角色是侧身走进座位坐下的，扶手正好卡在入座路径上，会穿模。

    const pivot = new THREE.Group()
    pivot.position.set(x, 0, z)
    pivot.rotation.y = chair.rotation.y
    scene.add(pivot)
    const doll = buildPuppet(index)
    // 木偶面部朝向 -Z，转过 π 才与椅背同侧、面朝桌面。
    doll.rotation.y = Math.PI
    pivot.add(doll)
    const head = doll.getObjectByName('expressive-head')
    const light = new THREE.SpotLight(0xffe3b8, 0, 8, .46, .65)
    light.position.set(x, 6, z + .6)
    light.target = head
    scene.add(light)
    // 出场淡入要按木偶单独控制材质：先把这只木偶身上的材质收齐，避免动到别人。
    const materials = []
    doll.traverse(node => {
      if (!node.material) return
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (!materials.includes(material)) materials.push(material)
      }
    })
    dolls.push({ seat: pivot, chair, doll, head, base: pivot.position.clone(), phase: index * 1.7, materials, entryActive: false, entryTime: 0, entryAngle: 0, exitTime: 0, appeared: false })
    spotlights.push(light)
  }
  // 演示工具：桌面半径与席位间距按“固定桌边间隙”计算；椅子单独缩放。
  // 桌子变大/变小时，人不会被一起缩小，而是跟着桌边合理外移/内收。
  // 动画实验室复用同一套几何公式：整圈席位按 angle 绕桌心旋转，back 只作用于非发言席。
  let ringAngle = 0
  let ringBack = [0, 0, 0, 0, 0]
  function seatRadius() {
    return 2.25 * tableScale + .36 + (.86 * chairScale) / 2
  }
  function seatWorld(seatIndex, angle) {
    const [x, z] = seats[seatIndex]
    const length = Math.hypot(x, z) || 1
    const rx = x / length * seatRadius()
    const rz = z / length * seatRadius()
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const wx = rx * cos + rz * sin
    const wz = -rx * sin + rz * cos
    const worldLength = Math.hypot(wx, wz) || 1
    return { x: wx, z: wz, facing: Math.atan2(-wx, -wz), outX: wx / worldLength, outZ: wz / worldLength }
  }
  function seatForDoll(index) {
    const owner = state.roles.indexOf(index)
    const playerSeat = owner === -1 ? null : state.seats[owner]
    return Number.isInteger(playerSeat) ? playerSeat : index
  }
  // 出场淡入只改这只木偶自己的材质，不牵连其他角色。
  function setDollFade(item, value) {
    const alpha = THREE.MathUtils.clamp(value, 0, 1)
    const transparent = alpha < .999
    for (const material of item.materials) {
      material.transparent = transparent
      material.opacity = alpha
      material.depthWrite = !transparent
    }
  }
  function layoutRing({ angle = ringAngle, back = ringBack } = {}) {
    ringAngle = angle
    ringBack = back
    table.rotation.y = angle
    for (let index = 0; index < 5; index++) {
      const world = seatWorld(index, angle)
      const chair = dolls[index].chair
      chair.position.set(world.x, 0, world.z)
      chair.rotation.y = world.facing
      chair.scale.setScalar(chairScale)
    }
    dolls.forEach((item, index) => {
      const seatIndex = seatForDoll(index)
      const world = seatWorld(seatIndex, angle)
      const offset = back[seatIndex] || 0
      item.base.set(world.x, 0, world.z)
      item.seat.rotation.y = world.facing
      item.seat.position.set(world.x + world.outX * offset, 0, world.z + world.outZ * offset)
      item.seat.scale.setScalar(chairScale)
      const lightX = .6 * Math.sin(angle)
      const lightZ = .6 * Math.cos(angle)
      spotlights[index].position.set(world.x + lightX, 6, world.z + lightZ)
    })
  }
  function applySeatLayout() {
    layoutRing({ angle: ringAngle, back: ringBack })
  }
  function setTableScale(value) {
    tableScale = THREE.MathUtils.clamp(Number(value) || 1, .75, 1.35)
    table.scale.set(tableScale, 1, tableScale)
    applySeatLayout()
  }
  function setChairScale(value) {
    chairScale = THREE.MathUtils.clamp(Number(value) || 1, .75, 1.35)
    applySeatLayout()
  }

  let eco = false
  let lastTime = 0
  let previousFrame = 0
  let frameId
  const views = createStageViews({
    camera, renderer, container, dolls,
    getPlayer: () => player,
    getRole: () => state.roles[player] ?? player,
    notify,
  })
  function resize() {
    const width = container.clientWidth
    const height = container.clientHeight
    if (width === 0 || height === 0) return
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  new ResizeObserver(resize).observe(container)
  resize()
  document.querySelector('#quality').addEventListener('change', event => {
    eco = event.target.value === 'eco'
    renderer.setPixelRatio(eco ? 1 : Math.min(devicePixelRatio, 1.6))
    renderer.shadowMap.enabled = !eco
    resize()
  })
  const lab = createStageLab({
    dolls, spotlights, views,
    layoutRing,
    getSeatWorld: seatWorld,
    getDollSeatIndex: seatForDoll,
    getOwnRole: () => state.roles[player] ?? player,
  })
  stageLab = lab
  function update() {
    // 实验室演示期间由 stage-lab 接管灯光与席位；退出或复位后本函数按最新 state 恢复。
    if (lab.isActive()) return
    props.visible = ['clue1', 'discuss1', 'clue2', 'discuss2', 'vote', 'tally', 'tie'].includes(state.phase)
    const dim = state.phase === 'vote'
    // 上帝视角看的是整间屋子，暗部多，需要比第一人称更高的环境填充。
    const overheadView = views.getMode ? ['god', 'portrait'].includes(views.getMode()) : true
    ambient.intensity = (dim ? .55 : 1.05) * (overheadView ? 1.34 : 1)
    key.intensity = (dim ? .5 : .85) * (overheadView ? 1.2 : 1)
    candleLight.intensity = dim ? 1.9 : 1.5
    lampLight.intensity = dim ? 30 : 62
    spotlights.forEach((light, index) => { light.intensity = state.speaker !== null && state.roles[state.speaker] === index ? 22 : 0 })
  }
  function animate(timestamp) {
    frameId = requestAnimationFrame(animate)
    if (document.hidden || !container.checkVisibility()) return
    if (timestamp - previousFrame < (eco ? 66 : 32)) return
    const delta = Math.min((timestamp - lastTime) / 1000, .1)
    lastTime = timestamp
    previousFrame = timestamp
    const elapsed = timestamp / 1000
    if (lab.isActive()) {
      lab.update(delta)
    } else {
      const retiring = ['exit', 'silence', 'identity', 'truth', 'outcome', 'ended'].includes(state.phase)
      dolls.forEach((item, index) => {
        const seatIndex = seatForDoll(index)
        const world = seatWorld(seatIndex, ringAngle)
        item.base.set(world.x, 0, world.z)
        // 只转木偶轴心，椅子固定不动；木偶自身的 π 朝向保持不变。
        item.seat.rotation.y = world.facing
        const inPlay = demoCast || state.roles.includes(index)
        const out = retiring && index === state.winner
        // 五个人统一从各自椅子的左侧绕到座位再坐下，绕桌方向一致才显得对称；先后出场时各走各的节奏。
        const side = .46
        // 出场：从舞台外的黑暗里淡入，绕到椅子侧前方，再走进自己的位置。
        if (inPlay && !item.appeared) {
          item.appeared = true
          item.entryActive = true
          item.entryTime = 0
          item.exitTime = 0
          const radius = seatRadius()
          const seatAngle = Math.atan2(item.base.z, item.base.x)
          item.entryAngle = seatAngle + side
          item.seat.position.set(Math.cos(item.entryAngle) * radius * 2.1, 0, Math.sin(item.entryAngle) * radius * 2.1)
          item.lastEntryX = item.seat.position.x
          item.lastEntryZ = item.seat.position.z
          setDollFade(item, 0)
        } else if (!inPlay) {
          item.appeared = false
          item.entryActive = false
          item.exitTime = 0
          item.doll.userData.setWalk?.(0, 0)
          item.chair.position.set(world.x, 0, world.z)
          setDollFade(item, 1)
        }
        if (out) {
          // 退场：先侧身让开椅子，再向外退回黑暗里。
          item.entryActive = false
          item.doll.userData.setWalk?.(0, 0)
          item.chair.position.set(world.x, 0, world.z)
          item.exitTime += delta
          setDollFade(item, 1)
          const progress = Math.min(item.exitTime / 1.8, 1)
          const turned = progress * progress * (3 - 2 * progress)
          const back = THREE.MathUtils.clamp((progress - .35) / .65, 0, 1)
          const backed = back * back * (3 - 2 * back)
          const seatAngle = Math.atan2(item.base.z, item.base.x)
          const radius = THREE.MathUtils.lerp(seatRadius(), seatRadius() * 1.85, backed)
          const angle = seatAngle + side * Math.min(1, turned * 1.6)
          item.seat.position.set(Math.cos(angle) * radius, -.4 * backed, Math.sin(angle) * radius)
        } else if (item.entryActive) {
          item.exitTime = 0
          item.entryTime += delta
          const progress = Math.min(item.entryTime / 3.2, 1)
          const radius = seatRadius()
          const seatAngle = Math.atan2(item.base.z, item.base.x)
          // 前段从黑暗走到椅子侧前方，角度收得慢一些，免得从椅子里穿过去。
          const walk = Math.min(1, progress / .82)
          const walkEased = walk * walk * (3 - 2 * walk)
          const sit = THREE.MathUtils.clamp((progress - .82) / .18, 0, 1)
          const sitEased = sit * sit * (3 - 2 * sit)
          const entryRadius = THREE.MathUtils.lerp(radius * 2.1, radius, walkEased)
          const angleOffset = (item.entryAngle - seatAngle) * Math.pow(1 - walkEased, .45) * (1 - sitEased)
          const entryAngle = seatAngle + angleOffset
          item.seat.position.set(Math.cos(entryAngle) * entryRadius, 0, Math.sin(entryAngle) * entryRadius)
          // 椅子要等人真正走到椅子旁才动：walkEased 过了 .66（刚走完台子外的黑暗、踏到椅子边）才后退。
          const chairStart = THREE.MathUtils.clamp((walkEased - .66) / .29, 0, 1)
          const chairDelay = chairStart * chairStart * (3 - 2 * chairStart)
          const chairBack = .6 * chairDelay * (1 - sitEased)
          item.chair.position.set(world.x + world.outX * chairBack, 0, world.z + world.outZ * chairBack)
          // 朝向跟着脚下的行进方向，站定后转身面朝桌心（也就是椅子的正面）。
          const dx = item.seat.position.x - item.lastEntryX
          const dz = item.seat.position.z - item.lastEntryZ
          if (Math.abs(dx) + Math.abs(dz) > 1e-5) item.seat.rotation.y = Math.atan2(dx, dz)
          if (sitEased > 0) {
            let diff = (world.facing - item.seat.rotation.y) % (Math.PI * 2)
            if (diff > Math.PI) diff -= Math.PI * 2
            if (diff < -Math.PI) diff += Math.PI * 2
            item.seat.rotation.y += diff * Math.min(1, delta * 7)
          }
          item.lastEntryX = item.seat.position.x
          item.lastEntryZ = item.seat.position.z
          item.doll.userData.setWalk?.(item.entryTime * 8.5, 1 - sitEased)
          setDollFade(item, Math.min(1, progress * 2.2))
          if (progress >= 1) {
            item.entryActive = false
            item.doll.userData.setWalk?.(0, 0)
            setDollFade(item, 1)
            item.chair.position.set(world.x, 0, world.z)
          }
        } else {
          item.exitTime = 0
          // 换座沿桌心极坐标圆弧走，绝不横穿桌面与椅子。
          const targetX = item.base.x
          const targetZ = item.base.z
          const from = item.seat.position
          const step = Math.min(delta * 2, 1)
          const fromRadius = Math.hypot(from.x, from.z)
          const toRadius = Math.hypot(targetX, targetZ)
          if (fromRadius > .2 && toRadius > .2) {
            const fromAngle = Math.atan2(from.z, from.x)
            let sweep = Math.atan2(targetZ, targetX) - fromAngle
            while (sweep > Math.PI) sweep -= Math.PI * 2
            while (sweep < -Math.PI) sweep += Math.PI * 2
            const radius = THREE.MathUtils.lerp(fromRadius, toRadius, step)
            const angle = fromAngle + sweep * step
            from.set(Math.cos(angle) * radius, THREE.MathUtils.lerp(from.y, 0, step), Math.sin(angle) * radius)
          } else {
            from.set(targetX, THREE.MathUtils.lerp(from.y, 0, step), targetZ)
          }
        }
        item.doll.scale.lerp(new THREE.Vector3(1, out ? .01 : 1, 1), Math.min(delta * 1.4, 1))
        item.doll.userData.animatePose?.(elapsed, state.speaker !== null && state.roles[state.speaker] === index)
      })
    }
    flame.scale.y = 1.6 + Math.sin(elapsed * 7) * .15
    views.update(delta)
    if (!lab.isActive()) {
      const firstPersonNow = views.getMode ? ['first', 'landscape'].includes(views.getMode()) : false
      // 自己坐的席位来自玩家角色，不是未声明的 seat；第一人称要把自己的木偶藏掉。
      const ownSeat = state.roles[player] ?? player
      dolls.forEach((item, index) => { item.doll.visible = (demoCast || state.roles.includes(index)) && !(firstPersonNow && index === ownSeat) })
    }
    renderer.render(scene, camera)
  }
  // 地板高度同时维护模块级 floorOffset、相机、原演示工具滑块与读数；
  // 实验室调用同一个入口，避免出现“场景变了、读数和回填还是 0”。
  function setFloorOffset(value) {
    floorOffset = THREE.MathUtils.clamp(Number(value) || 0, -1.2, 1.2)
    views.setFloorOffset(floorOffset)
    const input = document.querySelector('#floor-height')
    if (input) input.value = String(floorOffset)
    const output = document.querySelector('#floor-height-value')
    if (output) output.textContent = `${floorOffset > 0 ? '+' : ''}${floorOffset.toFixed(1)}`
  }
  document.querySelector('#graphics-status').hidden = true
  update()
  animate(0)
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frameId); lab.dispose(); views.dispose(); renderer.dispose() }, { once: true })
  return {
    update,
    setMode: views.setMode,
    enterImmersive: views.enterImmersive,
    exitImmersive: views.exitImmersive,
    setTableScale,
    setChairScale,
    setFloorOffset,
    lab,
    getStageSettings: () => ({ tableScale, chairScale, floorOffset }),
  }
}

(previewMode && state.phase === 'create' ? Promise.resolve(null) : buildStage()).then(view => {
  if (!view) return
  sceneView = view
  view.setTableScale(tableScale)
  view.setChairScale(chairScale)
  view.setFloorOffset(floorOffset)
  while (labBridgeQueue.length) {
    const [method, args] = labBridgeQueue.shift()
    applyLabBridgeCommand(method, args)
  }
  if (!phoneMode && !testDevice) {
    labUI = createDemoLab({
      lab: withLabBridge(view.lab),
      stage: view,
      notify,
      roleNames: names,
      mirrorUrl: preset => labMirrorUrl(preset),
      onExit: () => view.update(),
    })
  }
  window.weizhuoLab = {
    play: preset => playLabPreset(view.lab, preset || 'first-two', { endpoint }),
    playPreset: preset => playLabPreset(view.lab, preset, { endpoint }),
    stop: () => view.lab.stop(),
    reset: () => { view.lab.reset(); view.update() },
    state: () => view.lab.snapshot(),
    open: () => labUI?.open(),
    close: () => labUI?.close(),
  }
  if (endpoint === 'player' && hasJoined() && state.phase !== 'create') {
    enterPlayerStage()
  }
  maybeRunLabDemo()
}).catch(error => {
  document.querySelector('#graphics-status').textContent = '三维舞台加载失败，仍可体验右侧完整流程。'
  console.error(error)
})

function labMirrorUrl(preset = 'first-two') {
  const url = new URL(location.href)
  url.searchParams.set('endpoint', 'player')
  url.searchParams.set('phone', '1')
  url.searchParams.set('labDemo', preset)
  return url.toString()
}

function maybeRunLabDemo() {
  const preset = params.get('labDemo')
  if (!preset || labDemoApplied || !stageLab) return
  if (endpoint === 'player' && !(hasJoined() && state.phase !== 'create')) return
  labDemoApplied = true
  const delay = endpoint === 'player' ? 1200 : 500
  setTimeout(() => playLabPreset(stageLab, preset, { endpoint }), delay)
}


// Each browser session has its own server-assigned identity.
async function routeNetworkAction(name, value) {
  if (['script-detail', 'library-back', 'begin-create', 'cancel-create', 'tab', 'host', 'select-vote', 'share', 'cancel-share', 'favorite-toggle', 'save-private-notes', 'note-mode'].includes(name)) return false
  if (name === 'player' || name === 'disconnect' || name === 'host-disconnect' || name === 'reconnect' || name === 'host-reconnect') {
    notify('联机身份由当前设备确定，断线后会自动重连。')
    return true
  }
  if (name === 'reset' && !await askConfirm('清空本局房间，所有设备回到入口，确定吗？')) return true
  if (name === 'create') value = { scriptId: value, host: state.host }
  if (name === 'simulate-scan-room') { name = 'join'; value = state.roomCode }
  if (name === 'submit-vote') {
    if (state.selectedVote === null) { notify('请先选择投票或弃票。'); return true }
    value = String(state.selectedVote)
  }
  if (name === 'edit-summary') {
    const text = await askDialog('补记或修订本轮总结', { input: true, value: state.summaries[value] || '' })
    if (text === null) return true
    value = JSON.stringify({ round: value, text })
  }
  if (name === 'explain') { tab = 'help'; playerSceneOpen = false }
  if (name === 'confirm-share' && pendingShare !== value) return true
  sendRoomAction(name, value)
  return true
}
async function sendRoomAction(name, value) {
  if (!lan.connected) {
    // 断线时先补一次连接再提示，避免用户卡在“请稍候”里反复点。
    connectRoom()
    notify('连接正在恢复，请稍等一秒再点一次。')
    return
  }
  const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
  try {
    const response = await fetch(apiUrl('/api/action'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, value, requestId, roomCode: lan.roomCode || storedRoomCode() || undefined }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    if (name === 'join' || name === 'create') {
      accordionPanel = 'roles'
      roomCodeDraft = ''
      playerSceneOpen = true
      stagePanel = null
    }
    if (name === 'confirm-share') pendingShare = null
    if (name === 'submit-vote') state.selectedVote = null
    acceptRoomSnapshot(data, true)
    adoptRoom(data.roomCode || data.state?.roomCode)
  } catch (error) {
    const inline = name === 'join' && document.querySelector('#join-error')
    if (inline) inline.textContent = error.message
    else notify(error.message || '操作未完成，请重试。')
  }
}
function acceptRoomSnapshot(data, force = false) {
  if (data && typeof data.roomCode === 'string') roomSnapshots += 1
  // 房主退出会解散房间：从房间事件流退回大厅，清掉地址栏与本地房号。
  if (data && data.roomCode === null && lanEventsRoom) {
    lanEvents?.close()
    lanEvents = null
    lanEventsRoom = ''
    lan.roomCode = ''
    try { localStorage.removeItem(roomStorageKey()) } catch { /* 隐私模式 */ }
    const url = new URL(location.href)
    url.searchParams.delete('room')
    history.replaceState(null, '', url)
    entryMode = 'shelf'
    scriptDetail = null
    creatingRoom = false
    accordionPanel = 'story'
    tab = 'stage'
    playerSceneOpen = false
    stagePanel = null
    sceneView?.exitImmersive()
    document.body.classList.remove('stage-immersive')
    openRoomEvents('')
    notify('房间已解散，已回到入口，可以重新选本。')
  }
  const phaseChanged = state.phase !== data.state.phase
  const changed = data.revision !== lan.revision || force
  const localVote = state.selectedVote
  const localHost = state.host
  const seenShared = state.seenShared
  lan = { ...data, connected: true }
  state = data.state
  state.musicRate ??= 0.9
  state.introQueueStarted ??= false
  state.askQueue ??= []
  musicAudio.playbackRate = Number(state.musicRate)
  state.votes = state.votes.map((vote, index) => data.voted[index] ? vote : undefined)
  state.selectedVote = phaseChanged ? null : localVote
  state.seenShared = seenShared
  if (state.phase === 'create') state.host = localHost
  player = data.me ?? 0
  if (phaseChanged) {
    tab = 'stage'
    pendingShare = null
    accordionPanel = 'roles'
    if (state.phase === 'create') { playerSceneOpen = false; stagePanel = null }
    else if (state.phase === 'join') { playerSceneOpen = endpoint === 'player'; stagePanel = null }
    else stagePanel = null
  }
  if (data.state.phase === 'create' && data.me === null && phaseChanged) { entryMode = 'shelf'; scriptDetail = null; creatingRoom = false; accordionPanel = 'story' }
  if (!changed) {
    renderStage()
    renderHostOverview()
    for (const panel of document.querySelectorAll('.public-facts')) {
      const timerNode = panel.querySelector('[data-role="timer"]')
      if (timerNode) timerNode.textContent = `计时　${state.remaining === null ? '当前不限时' : timeText()}`
    }
    renderNetworkStatus()
    return
  }
  const body = document.querySelector('#phone-body')
  const scroll = body.scrollTop
  const active = document.activeElement
  const inputId = active?.tagName === 'INPUT' ? active.id : null
  const draft = inputId ? active.value : null
  const accordionScroll = document.querySelector('.accordion-content')?.scrollTop || 0
  render()
  if (playerSceneOpen && endpoint === 'player' && ['join', 'ready'].includes(state.phase)) sceneView?.enterImmersive('portrait')
  body.scrollTop = phaseChanged ? 0 : scroll
  const expandedContent = document.querySelector('.accordion-content')
  if (expandedContent && !phaseChanged) expandedContent.scrollTop = accordionScroll
  if (inputId) {
    const input = document.getElementById(inputId)
    if (input) { input.value = draft; input.focus() }
  }
}
function renderNetworkStatus() {
  document.body.dataset.networked = "true"
  document.querySelector('.prototype-label').textContent = '本机交互原型'
  document.querySelector('#phone-connection').textContent = ''
}
function renderNetworkControls() {
  renderNetworkStatus()
  const phoneOnly = document.body.dataset.device === 'phone'
  document.querySelector('#player-switch').hidden = true
  document.querySelector('.endpoint-tabs').hidden = phoneOnly || !lan.localAdmin || !!testDevice
  document.querySelector('.header-tools').hidden = phoneOnly
  document.querySelector('#demo-toggle').hidden = phoneOnly || !lan.localAdmin || !!testDevice || !!mirrorMode
  document.querySelector('#reset').hidden = !lan.localAdmin && lan.me !== state.roomOwner
  document.querySelector('#leave-room-admin').hidden = !lan.localAdmin || !state.roomCode || state.phase === 'create'
  if (phoneOnly || !lan.localAdmin || testDevice || mirrorMode) document.querySelector('#demo-panel').hidden = true
  document.querySelector('.brand').href = testDevice ? `?endpoint=player&testDevice=${testDevice}` : '?endpoint=computer'
}
let mirrorPoll = null
function openRoomEvents(roomCode) {
  if (lanEvents) { lanEvents.close(); lanEvents = null }
  if (mirrorPoll) { clearInterval(mirrorPoll); mirrorPoll = null }
  lanEventsRoom = roomCode || ''
  /* 只读镜像改用轮询：画布会同时挂多块画面，SSE 会占满浏览器对同源的 6 条连接，
     把演示工具和页面自己的请求一起堵死。 */
  if (mirrorMode) {
    const pull = () => {
      const query = new URLSearchParams({ mirror: mirrorMode })
      if (lobbyMirror) query.set('lobby', '1')
      else if (lanEventsRoom) query.set('room', lanEventsRoom)
      fetch(apiUrl(`/api/session?${query}`), { cache: 'no-store' })
        .then(response => response.ok ? response.json() : null)
        .then(data => {
          if (!data) return
          lan.connected = true
          renderNetworkStatus()
          acceptRoomSnapshot(data)
        })
        .catch(() => { lan.connected = false; renderNetworkStatus() })
    }
    pull()
    mirrorPoll = setInterval(pull, 1500)
    return
  }
  const queryParams = new URLSearchParams()
  if (lanEventsRoom) queryParams.set('room', lanEventsRoom)
  const query = queryParams.toString() ? '?' + queryParams : ''
  lanEvents = new EventSource(apiUrl('/api/events' + query))
  lanEvents.onmessage = event => acceptRoomSnapshot(JSON.parse(event.data))
  lanEvents.onopen = () => { lan.connected = true; renderNetworkStatus() }
  lanEvents.onerror = () => {
    lan.connected = false
    renderNetworkStatus()
    /* 服务重启后浏览器偶尔会放弃自动重连，这里主动补一次，避免一直停在“连接尚未恢复”。 */
    const source = lanEvents
    setTimeout(() => {
      if (source === lanEvents && source.readyState === EventSource.CLOSED) openRoomEvents(lanEventsRoom)
    }, 2000)
  }
}
// 房间码跟随服务端返回：写回 localStorage 与地址栏，并在房间变化时切换 SSE，避免两个房间串台。
function adoptRoom(roomCode) {
  if (!roomCode) return
  lan.roomCode = roomCode
  rememberRoomCode(roomCode)
  if (roomCode !== lanEventsRoom) openRoomEvents(roomCode)
}
async function connectRoom(roomOverride) {
  const params = new URLSearchParams(location.search)
  const token = params.get('hostToken')
  const fromUrl = (params.get('room') || '').trim()
  const roomCode = lobbyMirror ? '' : (roomOverride || fromUrl || storedRoomCode() || '').trim()
  try {
    const query = new URLSearchParams()
    if (token) query.set('hostToken', token)
    if (roomCode) query.set('room', roomCode)
    if (mirrorMode) query.set('mirror', mirrorMode)
    if (lobbyMirror) query.set('lobby', '1')
    const response = await fetch(apiUrl('/api/session' + (query.toString() ? '?' + query : '')))
    const data = await response.json()
    if (!response.ok) {
      // 房号已散场（如服务端房间缓存被清理）：清掉地址栏与本地记录后回大厅。
      // 否则会话一直 404，lan.localAdmin 拿不到，顶部端切换会被 renderNetworkControls 永久隐藏。
      if (response.status === 404 && roomCode) {
        /* 镜像页不清共享房号、不递归重连：等父画布下一次 setRoom 广播 */
        if (mirrorMode) { lan.roomCode = ''; lanEventsRoom = ''; return }
        try { localStorage.removeItem(roomStorageKey()) } catch { /* 隐私模式 */ }
        lan.roomCode = ''
        lanEventsRoom = ''
        if (fromUrl) {
          const url = new URL(location.href)
          url.searchParams.delete('room')
          history.replaceState(null, '', url)
          entryMode = 'shelf'
          notify('房间不存在或已散场，已回到大厅。')
        }
        return connectRoom()
      }
      throw new Error(data.error)
    }
    acceptRoomSnapshot(data, true)
    const activeRoom = data.roomCode || roomCode
    // shelf=1 是选本预览入口：不把服务端正在开的房间写回地址栏，也不强行跳到加入页。
    if (activeRoom && !forceShelf) { lan.roomCode = activeRoom; rememberRoomCode(activeRoom) }
    if (token) { const url = new URL(location.href); url.searchParams.delete('hostToken'); history.replaceState(null, '', url) }
    openRoomEvents(activeRoom)
    if (activeRoom && data.me === null && data.state?.roomCode && roomCode && !forceShelf) { entryMode = 'join'; render() }
  } catch (error) {
    lan.connected = false
    renderNetworkStatus()
    notify(error.message || '暂时无法连接电脑主机，正在重试。')
    setTimeout(() => connectRoom(lan.roomCode || roomCode || undefined), 4000)
  }
}


function mountPlayerTests() {
  if (testDevice || document.querySelector('#owner-test-frame')) return
  const workspace = document.querySelector('#player-test-workspace')
  workspace.innerHTML = `<section class="test-device"><h2>房主手机</h2><p>扫码后选本、创建房间、邀请朋友。</p><iframe id="owner-test-frame" title="房主完整流程" src="?endpoint=player&testDevice=owner" allow="autoplay; fullscreen; screen-orientation"></iframe></section><section class="test-device"><h2>被邀请玩家手机</h2><p>扫码后手动填写房间码，再选择角色入席。</p><iframe id="invited-test-frame" title="被邀请玩家完整流程" src="?endpoint=player&testDevice=invited" allow="autoplay; fullscreen; screen-orientation"></iframe></section>`
}
/* 画布演示工具的“推进阶段”：按当前阶段发对应的主持动作，身份用本机 computer 调试会话 */
const TEST_HOST_ACTIONS = {
  join: 'to-ready',
  ready: 'to-consent',
  consent: 'start',
  intro: 'intro-end',
  ask: 'discussion-end',
  clue1: 'clues-end',
  discuss1: 'discussion-end',
  clue2: 'clues-end',
  discuss2: 'discussion-end',
  vote: 'vote-timeout',
  tally: 'tally-next',
  tie: 'discussion-end',
  exit: 'exit-end',
  silence: 'silence-end',
  identity: 'identity-end',
  truth: 'truth-end',
  outcome: 'outcome-end',
}
async function sendTestAction(name, value = '', device = 'owner') {
  await refreshTestRoomTarget()
  if (name === 'create') {
    try {
      const response = await fetch('/api/action?testDevice=owner', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'create', value: { scriptId: 'growth-rings', host: 'ai' }, requestId: `test-create-${Date.now()}` }),
      })
      if (!response.ok) throw new Error((await response.json()).error)
      await refreshTestRoomTarget()
      notify('测试房间已重建，房主已入席。')
    } catch (error) { notify(error.message) }
    return
  }
  if (!testRoomCode) {
    notify('测试房间尚未创建：请先在演示工具里点“房主重建房间”。')
    return
  }
  if (name === 'advance') {
    const snapshot = testRoomState
    if (snapshot) {
      if (snapshot.phase === 'join' && snapshot.roles.some(role => role === null || role === undefined)) {
        notify('还有玩家没选角色：先点“补齐其他玩家入席”。')
        return
      }
      if (snapshot.phase === 'ready' && snapshot.ready.some(value => !value)) {
        notify('还有玩家没准备好：先点“全员准备完成”。')
        return
      }
      if (snapshot.phase === 'consent' && snapshot.consent.some(value => value !== true)) {
        notify('录音意愿还没齐：先点“补齐录音意愿”。')
        return
      }
    }
    const hostAction = TEST_HOST_ACTIONS[snapshot?.phase]
    if (!hostAction) { notify('当前阶段没有可推进的动作。'); return }
    name = hostAction
    device = 'computer'
  }
  try {
    const response = await fetch(`/api/action?testDevice=${device}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      // 带上当前测试房号，确保快捷操作只作用于这一个房间。
      body: JSON.stringify({ name, value, roomCode: testRoomCode, requestId: `test-action-${Date.now()}-${Math.random()}` }),
    })
    if (!response.ok) throw new Error((await response.json()).error)
    await refreshTestRoomTarget()
  } catch (error) { notify(error.message) }
}
document.querySelector('#reset-test-room').addEventListener('click', async () => {
  if (await askConfirm('重置双玩家测试房间？')) sendTestAction('reset')
})
document.querySelector('.test-flow-helper').addEventListener('click', async event => {
  const reset = event.target.closest('[data-test-reset]')
  if (reset) {
    if (await askConfirm('重置双玩家测试房间？')) sendTestAction('reset')
    return
  }
  const button = event.target.closest('[data-test-action]')
  if (button) sendTestAction(button.dataset.testAction, button.dataset.testValue || '')
})

// 画布里的 iframe 不再做只读拦截：键盘焦点、鼠标点击都交给画面内部，
// 身份与权限隔离仍由各自的 testDevice 会话和服务端校验负责。

let musicVolume = .7
try { musicVolume = Number(localStorage.getItem('weizhuo:musicVolume') ?? .7) } catch { /* 隐私模式 */ }
function applyMusicVolume() { musicAudio.volume = Math.max(0, Math.min(1, musicVolume)) }
applyMusicVolume()
function setMusicVolume(value) {
  musicVolume = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  applyMusicVolume()
  try { localStorage.setItem('weizhuo:musicVolume', String(musicVolume)) } catch { /* 隐私模式 */ }
}

function askDialog(text, { input = false, value = '' } = {}) {
  const dialog = document.querySelector('#app-dialog')
  if (!dialog?.showModal) return Promise.resolve(input ? null : false)
  document.querySelector('#app-dialog-text').textContent = text
  const field = document.querySelector('#app-dialog-input')
  field.hidden = !input
  field.value = value
  dialog.showModal()
  if (input) { field.focus(); field.select() }
  return new Promise(resolve => {
    const finish = result => {
      dialog.close()
      dialog.removeEventListener('click', onClick)
      dialog.removeEventListener('cancel', onCancel)
      resolve(result)
    }
    const onClick = event => {
      const button = event.target.closest('[data-dialog]')
      if (!button) return
      finish(button.dataset.dialog === 'ok' ? (input ? field.value : true) : (input ? null : false))
    }
    const onCancel = event => { event.preventDefault(); finish(input ? null : false) }
    dialog.addEventListener('click', onClick)
    dialog.addEventListener('cancel', onCancel)
  })
}
async function askConfirm(text) { return (await askDialog(text)) === true }

function openSettingsDialog() {
  const dialog = document.querySelector('#settings-dialog')
  if (!dialog) return
  const content = dialog.querySelector('#settings-dialog-content')
  content.innerHTML = settingsPanel()
  content.querySelector('#music-volume')?.addEventListener('input', event => setMusicVolume(Number(event.target.value) / 100))
  content.querySelector('#settings-quality')?.addEventListener('change', event => {
    const quality = document.querySelector('#quality')
    if (quality) { quality.value = event.target.value; quality.dispatchEvent(new Event('change')) }
  })
  if (!dialog.open) dialog.showModal()
}
/* 手机/主持页的齿轮按钮：用捕获阶段直接接管，避免被其它点击逻辑短路。 */
document.addEventListener('weizhuo:settings', () => openSettingsDialog())
document.addEventListener('click', event => {
  if (!event.target.closest('[data-action="settings-placeholder"]')) return
  event.preventDefault()
  event.stopPropagation()
  openSettingsDialog()
}, true)
function settingsPanel() {
  const rate = Number(state?.musicRate || 0.9)
  const canRate = ['computer', 'host'].includes(endpoint)
  const quality = document.querySelector('#quality')?.value || 'high'
  return `<h3>音乐</h3>
    <div class="settings-row">
      <button type="button" data-action="music-toggle" class="icon-button" aria-pressed="${musicEnabled}" aria-label="${musicEnabled ? '停止音乐' : '播放音乐'}">${musicEnabled ? 'Ⅱ' : '♫'}</button>
      <span>${musicEnabled ? '正在播放' : '未播放'}</span>
      <button type="button" data-action="music-library">曲库</button>
    </div>
    <label class="settings-field"><span>本机音量</span><input id="music-volume" type="range" min="0" max="100" step="5" value="${Math.round(musicVolume * 100)}" aria-label="本机音量"></label>
    ${canRate
      ? `<label class="settings-field"><span>播放倍速 · 全桌</span><select id="settings-rate" class="music-rate-select" aria-label="音乐播放速度">${MUSIC_RATES.map(item => `<option value="${item}" ${item === rate ? 'selected' : ''}>${item}×</option>`).join('')}</select></label>`
      : `<p class="muted">倍速由主持人或电脑主机端统一调整，当前 ${rate}×。</p>`}
    <h3>画面</h3>
    <label class="settings-field"><span>画质</span><select id="settings-quality" aria-label="画质"><option value="high" ${quality === 'high' ? 'selected' : ''}>高画质</option><option value="eco" ${quality === 'eco' ? 'selected' : ''}>省电</option></select></label>
    <div class="settings-row"><button type="button" data-action="toggle-fullscreen">全屏</button><button type="button" data-action="reload-page">刷新页面</button></div>
    <p class="muted">房间码、座位和角色都存在电脑主机，刷新不会丢身份。</p>`
}

// 局域网是 http，装不成 PWA；全屏只能靠用户手势调 requestFullscreen。
// 安卓 Chrome／小米浏览器支持，进入后地址栏和状态栏都会让位。
function syncFullscreenLetterbox() {
  const stage = document.querySelector('#player-stage-mount .theatre')
  const portrait = stage?.dataset.immersiveOrientation === 'portrait'
  const active = fullscreenRequested && !!stage && portrait && innerWidth > innerHeight
  if (stage) {
    if (active) {
      const width = Math.min(innerWidth, innerHeight * 9 / 19.5)
      stage.style.setProperty('width', `${width}px`, 'important')
      stage.style.setProperty('height', `${innerHeight}px`, 'important')
      stage.style.setProperty('left', '50%', 'important')
      stage.style.setProperty('right', 'auto', 'important')
      stage.style.setProperty('transform', 'translateX(-50%)', 'important')
      stage.style.setProperty('outline', '4px solid #c8a35c', 'important')
    } else {
      for (const prop of ['width', 'height', 'left', 'right', 'transform', 'outline']) stage.style.removeProperty(prop)
    }
  }
  document.body.classList.toggle('fullscreen-portrait-letterbox', active)
}
window.addEventListener('resize', syncFullscreenLetterbox)
window.addEventListener('orientationchange', syncFullscreenLetterbox)

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement || fullscreenRequested) {
      fullscreenRequested = false
      syncComputerFullscreen()
      syncFullscreenLetterbox()
      syncFullscreenButtons()
      try { await document.exitFullscreen() } catch { /* 小米浏览器按系统返回退出 */ }
      return
    }
    const playerStage = document.querySelector('#player-stage-mount .theatre')
    const target = endpoint === 'player' && playerStage ? playerStage : document.documentElement
    if (!target.requestFullscreen) return notify('这台浏览器不支持网页全屏，可以把页面添加到主屏幕再打开。')
    const stageOrientation = playerStage?.dataset.immersiveOrientation === 'landscape' ? 'landscape' : 'portrait'
    // 先在用户手势内发起一次方向锁定：部分安卓浏览器（含小米）在 await 全屏后才锁会丢失手势，
    // 结果被强制横屏。锁早了若报“未全屏”，下面再补一次。
    const request = target.requestFullscreen({ navigationUI: 'hide' })
    // 小米浏览器的全屏 Promise 可能迟迟不 resolve，但全屏已经发生；
    // 先置标记并延时同步，避免 await 卡住后信箱布局永远不生效。
    fullscreenRequested = true
    syncFullscreenButtons()
    syncComputerFullscreen()
    syncFullscreenLetterbox()
    setTimeout(syncFullscreenLetterbox, 350)
    let lockPromise = null
    if (playerStage) {
      try { lockPromise = screen.orientation?.lock?.(stageOrientation) } catch { /* 下面重试 */ }
    }
    await request
    // 全屏只放大舞台，不改变当前横/竖屏模式；只有顶部“横屏/竖屏”按钮才切方向。
    if (playerStage) {
      try { await lockPromise } catch { /* 下面再试一次 */ }
      try { await screen.orientation?.lock?.(stageOrientation) } catch { /* 不支持就按当前方向 */ }
    }
  } catch {
    fullscreenRequested = false
    syncComputerFullscreen()
    syncFullscreenLetterbox()
    notify('浏览器拒绝了全屏请求，请再点一次，或把页面添加到主屏幕。')
  }
}
function syncFullscreenButtons() {
  const active = !!document.fullscreenElement || fullscreenRequested
  document.querySelectorAll('[data-action="toggle-fullscreen"]').forEach(button => {
    button.setAttribute('aria-pressed', String(active))
    button.setAttribute('aria-label', active ? '退出全屏' : '全屏')
    button.title = active ? '退出全屏' : '全屏'
  })
}
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) fullscreenRequested = false
  syncFullscreenButtons()
  syncComputerFullscreen()
})
function syncComputerFullscreen() {
  const active = endpoint === 'computer' && (!!document.fullscreenElement || fullscreenRequested)
  if (active === computerFullscreenActive) return
  computerFullscreenActive = active
  document.body.classList.toggle('computer-fullscreen', active)
  if (active) showComputerPanels()
  else {
    clearTimeout(computerIdleTimer)
    computerIdleTimer = null
    document.body.classList.remove('computer-panels-hidden')
  }
}

async function copyRoomCode() {
  const text = String(state.roomCode || '')
  if (!text) return
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) await navigator.clipboard.writeText(text)
    else {
      const field = document.createElement('textarea')
      field.value = text
      field.style.cssText = 'position:fixed;left:0;top:0;opacity:0'
      document.body.appendChild(field)
      field.select()
      field.setSelectionRange(0,text.length)
      const copied = document.execCommand('copy')
      field.remove()
      if (!copied) throw new Error('请长按顶部房间码复制。')
    }
    notify('房间码已复制。')
  } catch (error) { notify('请长按顶部房间码复制。') }
}







/* 设置面板也支持 URL 直达：?panel=settings，便于手机或调试直接打开。 */
if (params.get('panel') === 'settings') openSettingsDialog()
