import { castOf } from './scripts-data.mjs'

// all-abstain-20261120
export const names = castOf(null).map(member => member.name)
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
const byId = Object.fromEntries(phases.map(phase => [phase[0], phase]))

// Room state and timers are owned by the computer's Node.js process.
export function createRoomEngine(saved) {
  let state = saved || freshState()
  state.introQueueStarted ??= false
  state.askQueue ??= []
  state.voteAllAbstained ??= false
  let player = 0
  let tab = 'stage'
  const render = () => {}
  const notify = message => { throw new Error(message) }
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

function roleName(index) {
  const cast = castOf(state.scriptId)
  return (cast[state.roles[index] ?? index] || cast[index] || castOf(null)[index]).name
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
  state.queue = []
  if (phase === 'ask') state.queue = [...(state.askQueue || [])]
  state.askQueue = []
  state.introQueueStarted = false
  state.speaker = null
  if (phase === 'ask') state.speaker = state.queue.shift() ?? null
  state.target = null
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

  function dispatch(name, value, actor = 0, moderator = false) {
    player = actor
    const phase = state.phase
    value = String(value ?? '')
    if (name === 'takeover') { state.manualControl = true; state.paused = false; return }
    if (name === 'resume') { state.paused = false; return }
    if (name === 'pause') { state.paused = true; return }
    if (name === 'release-host') { state.manualControl = false; return }
    if (name === 'edit-summary') {
      const { round, text } = JSON.parse(value)
      if (!Object.hasOwn(state.summaries, round) || typeof text !== 'string') throw new Error('总结尚未开放。')
      state.summaries[round] = text.slice(0, 3000)
      state.versions.push({ round, author: roleName(player), text: text.slice(0, 3000) })
      return
    }
    if (name === 'explain') {
      state.paused = true
      state.messages.push({ author: roleName(player), text: value.slice(0, 300) || '请求暂停并解释当前流程。' })
      state.messages.push({ author: '主持流程演示', text: '流程已暂停，可以阅读当前阶段说明，确认后继续。真实文本 AI 待接入。' })
      return
    }
    if (state.paused || (state.hostDisconnected && !['join', 'ready', 'consent'].includes(phase))) throw new Error('主持流程已暂停。')
  if (name === 'host' && phase === 'create') state.host = value
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
  if (name === 'to-ready' && phase === 'join' && state.roles.every(role => role !== null)) return go('ready')
  if (name === 'back-join' && phase === 'ready') return go('join')
  if (name === 'ready' && ['join', 'ready'].includes(phase) && state.roles[player] !== null) state.ready[player] = true
  if (name === 'fill-ready' && phase === 'ready') state.ready.fill(true)
  if (name === 'to-consent' && phase === 'ready' && state.ready.every(Boolean)) return go('consent')
  if (name === 'consent' && phase === 'consent') state.consent[player] = value === 'yes'
  if (name === 'fill-consent' && phase === 'consent') state.consent = state.consent.map(answer => answer ?? true)
  if (name === 'start' && phase === 'consent' && !state.consent.includes(null)) {
    // LAN 原型没有接录音，无论是否同意都按未录音处理；保留上一行会让两端文案不一致。
    state.recorded = false
    return go('intro')
  }
  if (name === 'queue' && (phase === 'intro' || isDiscussion())) queuePlayer(player)
  if (name === 'queue-ask' && phase === 'intro' && state.introduced[player]) queueAsk(player)
  if (name === 'cancel-ask') state.askQueue = state.askQueue.filter(index => index !== player)
  if (name === 'cancel-queue') state.queue = state.queue.filter(index => index !== player)
  if (name === 'next-speaker' && state.speaker !== null && (moderator || state.speaker === player)) nextSpeaker()
  if (name === 'fill-intro' && phase === 'intro') { state.introduced.fill(true); state.introQueueStarted = true; state.speaker = null; state.queue = [] }
  if (name === 'intro-end' && phase === 'intro' && state.introduced.every(Boolean)) return go('ask')
  if (name === 'target' && state.speaker === player && /^[0-4]$/.test(value)) { state.target = Number(value); record(`${roleName(player)}向${roleName(Number(value))}提问`) }
  if (name === 'skip-countdown' && isDiscussion() && state.speaker === null) state.remaining = 0
  if (name === 'confirm' && isDiscussion() && state.remaining === 0) state.confirmed[player] = true
  if (['fill-confirm', 'simulate-confirm'].includes(name) && isDiscussion() && state.remaining === 0) state.confirmed.fill(true)
  if (name === 'discussion-end' && isDiscussion() && state.confirmed.every(Boolean)) return finishDiscussion()
  if (name === 'read') {
    if (!/^[12]-[01]$/.test(value)) throw new Error('无效阅读确认。')
    const [round, part] = value.split('-').map(Number)
    if (round <= roundNumber() && !['create', 'join', 'ready', 'consent', 'intro', 'ask'].includes(phase)) state.read[round][player][part] = true
  }
  if (name === 'fill-read' && ['clue1', 'clue2'].includes(phase)) state.read[roundNumber()].forEach(read => read.fill(true))
  if (name === 'clues-end' && ['clue1', 'clue2'].includes(phase) && state.read[roundNumber()].every(read => read.every(Boolean))) return go(phase === 'clue1' ? 'discuss1' : 'discuss2')
  if (name === 'confirm-share' && !['create', 'join', 'ready', 'consent', 'intro', 'ask'].includes(phase)) {
    if (!/^[12]-[0-4]$/.test(value)) throw new Error('无效线索。')
    const [round, owner] = value.split('-').map(Number)
    if (owner !== player || round > roundNumber()) throw new Error('这条线索尚未开放。')
    if (!state.shared.includes(value)) { state.shared.push(value); record(`${roleName(player)}公开第${round}轮个人线索`) }
  }
  if (name === 'submit-vote' && phase === 'vote' && state.votes[player] === undefined) {
    if (value !== 'abstain' && !/^[0-4]$/.test(value)) throw new Error('请选择有效投票。')
    state.votes[player] = value === 'abstain' ? null : Number(value)
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
    // 当前每局只淘汰一人且发生在最终投票后，复投时五人都未出局；
    // 若未来支持中途淘汰，再引入未出局过滤（只允许未出局玩家投票与被投）。
    if (state.winner === null) { state.voteRound++; return go('tie') }
    return go('exit')
  }
  if (name === 'exit-end' && phase === 'exit') return go('silence')
  if (name === 'silence-end' && phase === 'silence' && state.remaining === 0) return go('identity')
  if (name === 'identity-end' && phase === 'identity') return go('truth')
  if (name === 'truth-end' && phase === 'truth') return go('outcome')
  if (name === 'outcome-end' && phase === 'outcome') return go('ended')
  if (name === 'record-disposition' && phase === 'ended') { state.keptRecording = !state.keptRecording }

  }

  function tick() {
    if (state.phase === 'create' || state.paused || state.hostDisconnected) return
    state.phaseSeconds++
    if (state.remaining !== null && state.remaining > 0) state.remaining--
    if (state.phase === 'vote' && state.remaining === 0) return finishVote()
    if (state.host !== 'ai' || state.manualControl) return
    let operation
    const phase = state.phase
    if (phase === 'join' && state.roles.every(role => role !== null)) operation = 'to-ready'
    if (phase === 'ready' && state.ready.every(Boolean)) operation = 'to-consent'
    if (phase === 'consent' && state.consent.every(answer => answer !== null)) operation = 'start'
    if (phase === 'intro' && state.introduced.every(Boolean)) operation = 'intro-end'
    if (isDiscussion() && state.confirmed.every(Boolean)) operation = 'discussion-end'
    if (['clue1', 'clue2'].includes(phase) && state.read[roundNumber()].every(read => read.every(Boolean))) operation = 'clues-end'
    const timed = { tally: [5, 'tally-next'], exit: [4, 'exit-end'], identity: [7, 'identity-end'], truth: [9, 'truth-end'], outcome: [7, 'outcome-end'] }
    if (timed[phase] && state.phaseSeconds >= timed[phase][0]) operation = timed[phase][1]
    if (phase === 'silence' && state.remaining === 0) operation = 'silence-end'
    if (operation) dispatch(operation, '', 0, true)
  }
  return { get state() { return state }, dispatch, tick }
}
