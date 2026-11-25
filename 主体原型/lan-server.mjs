import http from 'node:http'
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync, createReadStream, statSync } from 'node:fs'
import { resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { networkInterfaces } from 'node:os'
import { randomBytes, randomInt } from 'node:crypto'
import { createRequire } from 'node:module'
import { createRoomEngine } from './room-engine.mjs'
import { scriptCatalog } from './scripts-data.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const project = dirname(root)
const port = Number(process.env.PORT || 5189)
const addresses = Object.values(networkInterfaces()).flat().filter(item => item.family === 'IPv4' && !item.internal)
const lanHost = process.env.LAN_HOST || addresses[0]?.address || '127.0.0.1'
const baseUrl = `http://${lanHost}:${port}/主体原型/`
/* music-fallback-20261120 */
// 音乐是辅助功能：存档缺失/播放清单损坏时降级为空曲库并告警，服务照常启动。
const musicRoot = resolve(process.env.MUSIC_ROOT || 'D:/Work/小程序/剧本杀_存档_20261119/singlebook/音乐策划_20261116/游戏音乐/audio')
const musicPlaylistPath = resolve(process.env.MUSIC_PLAYLIST_PATH || 'D:/Work/小程序/剧本杀_存档_20261119/singlebook/音乐策划_20261116/游戏音乐/playlist.json')
let musicFiles = new Set()
try {
  musicFiles = new Set(JSON.parse(readFileSync(musicPlaylistPath, 'utf8')).map(track => decodeURIComponent(track.src.split('/').at(-1))))
} catch (error) {
  console.warn(`[music] 播放清单不可用，音乐降级为空曲库：${musicPlaylistPath}（${error.message}）；服务继续启动，/api/music/* 将返回 404。`)
}
/* music-fallback-20261120-end */
/* music-fallback-done */
function createRoomHandler(testOnly = false) {
  const cache = resolve(root, '.cache', `lan-rooms-${port}${testOnly ? '-test' : ''}.json`)
  const legacyCache = resolve(root, '.cache', `lan-room-${port}${testOnly ? '-test' : ''}.json`)
  const qr = createRequire(import.meta.url)('./vendor/qrcode.cjs')
  const rooms = new Map()
  const sessions = {}
  const lobbyClients = new Set()
  const lobbyState = createRoomEngine().state
  const entryUrl = testOnly ? `http://127.0.0.1:${port}/play?testDevice=owner` : `http://${lanHost}:${port}/play`
  const roomUrlFor = code => testOnly ? `http://127.0.0.1:${port}/play?room=${code}&testDevice=invited` : `http://${lanHost}:${port}/play?room=${code}`

  function newRoomCode() {
    let code
    do { code = String(randomInt(100000, 1000000)) } while (rooms.has(code))
    return code
  }
  function makeRoom(code, savedState) {
    const room = {
      code,
      engine: createRoomEngine(savedState),
      hostSecret: randomBytes(24).toString('hex'),
      clients: new Set(),
      grace: new Map(),
      seen: new Map(),
      revision: 0,
    }
    rooms.set(code, room)
    return room
  }
  function loadRoom(code, saved) {
    if (!saved?.state) return null
    const state = saved.state
    state.musicRate ??= 0.9
    state.votes = (state.votes || []).map(vote => vote === '__pending__' ? undefined : vote)
    const room = makeRoom(code, state)
    if (saved.hostSecret) room.hostSecret = saved.hostSecret
    state.disconnected = state.joined.map(Boolean)
    state.hostDisconnected = state.host === 'human' && state.phase !== 'create'
    for (const [id, item] of Object.entries(saved.sessions || {})) {
      sessions[id] = { id, roomCode: code, player: item.player ?? null, host: !!item.host, requests: Array.isArray(item.requests) ? item.requests : [] }
      // 刚重启时按"刚刚联系过"计时，给重连留出宽限，避免启动即被当成空房回收。
      room.seen.set(id, Date.now())
    }
    return room
  }
  if (existsSync(cache)) {
    const saved = JSON.parse(readFileSync(cache, 'utf8'))
    for (const [code, item] of Object.entries(saved.rooms || {})) loadRoom(code, item)
  } else if (existsSync(legacyCache)) {
    // 旧的单房间存档：迁移成单房间多房间结构，保留原房间码，旧文件不删除。
    const saved = JSON.parse(readFileSync(legacyCache, 'utf8'))
    const code = String(saved.state?.roomCode || newRoomCode())
    if (saved.state) saved.state.roomCode = code
    loadRoom(code, saved)
    persist()
  }

  /* 真实会话列表：画布镜像会话不占席位，不参与重置、回收与在线判定 */
  function sessionList(room) {
    return Object.values(sessions).filter(item => item.roomCode === room.code && !item.mirror)
  }
  function roomClients(room) {
    return [...room.clients].filter(client => client.session.roomCode === room.code)
  }
  // 房间是否有"在线的人"：该会话已占座或担任主持，且 SSE 仍连着、刚断开在宽限期内，或刚刚发过请求。
  function roomHasOnline(room) {
    const online = new Set(roomClients(room).filter(client => !client.session.mirror).map(client => client.id))
    if (online.size) return true
    return sessionList(room).some(item => (item.player !== null || item.host)
      && (online.has(item.id) || room.grace.has(item.id) || Date.now() - (room.seen.get(item.id) || 0) < 5000))
  }
  // 回收只发生在还没开局的房间（create/join/ready），且期内在宽限窗口没有任何人联系过。
  function recycleRoom(room) {
    if (!room || !rooms.has(room.code)) return false
    if (!['create', 'join', 'ready'].includes(room.engine.state.phase)) return false
    if (roomHasOnline(room)) return false
    for (const item of sessionList(room)) { item.roomCode = null; item.player = null; item.host = false }
    rooms.delete(room.code)
    return true
  }
  function sweepRooms() {
    const now = Date.now()
    for (const room of [...rooms.values()]) {
      /* 只有真实设备在线才阻止回收；画布常开不应让空房永远活着 */
      if (roomClients(room).some(client => !client.session.mirror)) continue
      if (!['create', 'join', 'ready'].includes(room.engine.state.phase)) continue
      if (room.grace.size) continue
      if (sessionList(room).some(item => now - (room.seen.get(item.id) || 0) < 60000)) continue
      recycleRoom(room)
    }
  }
  function roomList() {
    return [...rooms.values()]
      .filter(room => room.engine.state.phase !== 'create')
      .map(room => {
        const state = room.engine.state
        const joined = state.joined.filter(Boolean).length
        return { code: room.code, phase: state.phase, scriptId: state.scriptId, joined, players: joined }
      })
  }
  // 把会话从原房间的席位/主持身份上摘下来，再绑到新房间。
  function releaseRole(session) {
    const old = session.roomCode ? rooms.get(session.roomCode) : null
    if (old) {
      const state = old.engine.state
      if (session.player !== null) {
        if (['join', 'ready'].includes(state.phase)) state.joined[session.player] = false
        else state.disconnected[session.player] = true
      }
      if (session.host && state.host === 'human') state.hostDisconnected = true
    }
    session.player = null
    session.host = false
  }
  function bindSession(session, room) {
    if (session.roomCode === room.code) return
    if (!session.mirror) releaseRole(session)
    session.roomCode = room.code
  }
  /* 只读镜像按房间当前状态映射到真实玩家：房主=roomOwner，受邀=第一个已入席的非房主 */
  function applyMirror(session, room) {
    if (!session.mirror) return
    const state = room.engine.state
    const seat = /^seat([0-4])$/.exec(session.mirror)
    if (session.mirror === 'owner') {
      session.player = state.roomOwner ?? 0
      session.host = false
    } else if (session.mirror === 'invited') {
      const owner = state.roomOwner ?? 0
      const index = state.joined.findIndex((joined, i) => joined && i !== owner)
      session.player = index >= 0 ? index : null
      session.host = false
    } else if (seat) {
      /* 逐席镜像：只读显示该座位的玩家画面；未入席时给空座位视图 */
      const index = Number(seat[1])
      session.player = state.joined[index] ? index : null
      session.host = false
    } else {
      session.player = null
      session.host = session.mirror === 'host'
    }
  }
  function resetRoom(room) {
    room.engine = createRoomEngine()
    room.hostSecret = randomBytes(24).toString('hex')
    for (const item of sessionList(room)) { item.player = null; item.host = false }
  }
  // 房主退出并解散未开局的房间：所有绑定会话回到入口，房间删除。
  function dissolveRoom(room) {
    const clients = [...room.clients]
    for (const item of sessionList(room)) {
      item.roomCode = null
      item.player = null
      item.host = false
    }
    /* 镜像会话不占席位，但房间没了必须断开指向，避免继续渲染已散场的房 */
    for (const item of Object.values(sessions)) {
      if (!item.mirror || item.roomCode !== room.code) continue
      item.roomCode = null
      item.player = null
    }
    for (const timer of room.grace.values()) clearTimeout(timer)
    room.grace.clear()
    rooms.delete(room.code)
    for (const client of clients) {
      if (client.session.roomCode === room.code) {
        client.session.roomCode = null
        client.session.player = null
        client.session.host = false
      }
      send(client, lobbySnapshot(client.session, client.localAdmin))
    }
    room.clients.clear()
  }
  function persist() {
    mkdirSync(dirname(cache), { recursive: true })
    const data = { rooms: {} }
    for (const [code, room] of rooms) {
      const state = { ...room.engine.state, votes: room.engine.state.votes.map(vote => vote === undefined ? '__pending__' : vote) }
      const roomSessions = {}
      for (const item of Object.values(sessions)) {
        if (item.roomCode !== code || item.mirror) continue
        roomSessions[item.id] = { player: item.player, host: item.host, requests: item.requests || [] }
      }
      data.rooms[code] = { state, sessions: roomSessions, hostSecret: room.hostSecret }
    }
    writeFileSync(`${cache}.tmp`, JSON.stringify(data))
    renameSync(`${cache}.tmp`, cache)
  }
  let persistTimer = null
  function schedulePersist() {
    if (persistTimer) return
    persistTimer = setTimeout(() => {
      persistTimer = null
      try { persist() } catch (error) { console.error('Room persist failed', error) }
    }, 200)
  }
  function isLocal(req) {
    return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
  }
  function sessionFor(req, res) {
    // 画布只读镜像：mirror-* 会话不占席位、不写状态，只按真实房间/玩家索引渲染画面。
    const mirror = new URL(req.url, 'http://localhost').searchParams.get('mirror')
    const seatMirror = /^seat([0-4])$/.test(mirror || '')
    if (mirror && (['computer', 'host', 'owner', 'invited'].includes(mirror) || seatMirror)) {
      const id = `mirror-${mirror}`
      sessions[id] ||= { id, roomCode: null, player: null, host: false, requests: [] }
      sessions[id].mirror = mirror
      sessions[id].host = mirror === 'host'
      return [id, sessions[id]]
    }
    // 本机测试身份（五视角调试）固定使用 test-* 会话，和普通房间共用同一套房间数据，
    // 避免“电脑主机端”和“多画面画布”各看一套房间导致状态不一致。
    const device = new URL(req.url, 'http://localhost').searchParams.get('testDevice')
    if (device) {
      const id = `test-${device}`
      sessions[id] ||= { id, roomCode: null, player: null, host: false, requests: [] }
      sessions[id].testDevice = device
      if (device === 'host') sessions[id].host = true
      return [id, sessions[id]]
    }
    if (testOnly) {
      const device = new URL(req.url, 'http://localhost').searchParams.get('testDevice')
      const id = `test-${device}`
      sessions[id] ||= { id, roomCode: null, player: null, host: false, requests: [] }
      sessions[id].testDevice = device
      if (device === 'host') sessions[id].host = true
      return [id, sessions[id]]
    }
    const id = /(?:^|;\s*)weizhuo=([a-f0-9]{48})(?:;|$)/.exec(req.headers.cookie || '')?.[1]
    if (id && sessions[id]) return [id, sessions[id]]
    const next = randomBytes(24).toString('hex')
    sessions[next] = { id: next, roomCode: null, player: null, host: false, requests: [] }
    res.setHeader('Set-Cookie', `weizhuo=${next}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`)
    return [next, sessions[next]]
  }

  function snapshot(session, room, localAdmin) {
    const state = structuredClone(room.engine.state)
    const voted = state.votes.map(vote => vote !== undefined)
    if (state.phase === 'vote') state.votes = state.votes.map((vote, index) => index === session.player ? vote : null)
    return {
      roomCode: room.code,
      state, voted, revision: room.revision, me: session.player, moderator: session.host, localAdmin,
      mirror: session.mirror || null,
      entryUrl,
      roomUrl: roomUrlFor(room.code),
      hostInviteUrl: !session.mirror && session.player === state.roomOwner && state.roomOwner !== null ? `${baseUrl}?endpoint=host&hostToken=${room.hostSecret}` : null,
    }
  }
  function lobbySnapshot(session, localAdmin) {
    const state = structuredClone(lobbyState)
    return {
      roomCode: null,
      state, voted: state.votes.map(() => false), revision: 0, me: null, moderator: session.host, localAdmin,
      entryUrl,
      roomUrl: roomUrlFor(''),
      hostInviteUrl: null,
      // 房间码只给本机看，手机扫码的人不该拿到全部房号。
      rooms: localAdmin ? roomList() : [],
    }
  }
  function send(client, payload) {
    try { client.res.write(`data: ${JSON.stringify(payload)}\n\n`) } catch { /* client already gone */ }
  }
  function broadcast(room, changed = true) {
    if (changed) room.revision++
    for (const client of roomClients(room)) {
      /* 座位/房主是随房间状态变化的，镜像每次广播前重新映射，保证画面跟真实玩家一致 */
      if (client.session.mirror) applyMirror(client.session, room)
      send(client, snapshot(client.session, room, client.localAdmin))
    }
    if (!changed) return
    for (const client of lobbyClients) send(client, lobbySnapshot(client.session, client.localAdmin))
    schedulePersist()
  }
  function reconnect(session, room) {
    if (session.mirror) return
    const state = room.engine.state
    if (session.player !== null) state.disconnected[session.player] = false
    if (session.host) state.hostDisconnected = false
  }
  function disconnect(id, session, room) {
    clearTimeout(room.grace.get(id))
    if (session.mirror) return
    room.grace.set(id, setTimeout(() => {
      room.grace.delete(id)
      if (!rooms.has(room.code)) return
      if ([...room.clients].some(client => client.id === id)) return
      if (session.roomCode !== room.code) return
      if (session.player !== null) room.engine.state.disconnected[session.player] = true
      if (session.host && room.engine.state.host === 'human') room.engine.state.hostDisconnected = true
      broadcast(room)
    }, 15000))
  }
  function json(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(data))
  }
  const playerActions = new Set(['pick-role', 'pick-seat', 'ready', 'consent', 'queue', 'cancel-queue', 'queue-ask', 'cancel-ask', 'next-speaker', 'target', 'confirm', 'read', 'confirm-share', 'submit-vote', 'edit-summary', 'explain', 'resume'])
  const hostActions = new Set(['pause', 'resume', 'takeover', 'release-host', 'to-ready', 'back-join', 'to-consent', 'start', 'next-speaker', 'intro-end', 'discussion-end', 'clues-end', 'tally-next', 'exit-end', 'silence-end', 'identity-end', 'truth-end', 'outcome-end'])
  const debugActions = new Set(['demo-start-flow', 'fill-roles', 'fill-ready', 'fill-consent', 'fill-intro', 'skip-countdown', 'fill-confirm', 'simulate-confirm', 'fill-read', 'fill-votes', 'vote-timeout'])
  function act(room, body, session, localAdmin) {
    const { name, value } = body
    if (name === 'music-rate') {
      if (!localAdmin && !session.host) throw new Error('播放速度只能在电脑主机端或主持端调整。')
      const rate = Number(value)
      if (![0.8, 0.85, 0.9, 0.95, 1].includes(rate)) throw new Error('无效的播放速度。')
      room.engine.state.musicRate = rate
      return room
    }
    if (name === 'create') {
      if (!scriptCatalog.some(item => item.id === value?.scriptId) || !['ai', 'human'].includes(value?.host)) throw new Error('请选择有效剧本和主持方式。')
      if (session.host) throw new Error('主持设备请使用另一浏览器会话担任玩家。')
      releaseRole(session)
      const next = makeRoom(newRoomCode())
      session.roomCode = next.code
      session.player = 0
      session.host = false
      next.seen.set(session.id, Date.now())
      const state = next.engine.state
      state.scriptId = value.scriptId
      state.host = value.host
      state.roomCode = next.code
      state.roomOwner = 0
      state.joined[0] = true
      state.phase = 'join'
      state.hostDisconnected = state.host === 'human'
      state.events.push('房主创建房间，等待玩家入席')
      return next
    }
    const state = room.engine.state
    if (name === 'leave-room') {
      if (session.player === null && !localAdmin) throw new Error('你不在房间里。')
      if (!localAdmin && session.player !== state.roomOwner) throw new Error('只有房主可以退出并解散房间。')
      dissolveRoom(room)
      return null
    }
    if (name === 'join') {
      if (session.player !== null) return room
      if (session.host) throw new Error('主持人使用独立设备，不占玩家席位。')
      if (!state.roomCode) throw new Error('房间码不正确，或房间已散场。')
      if (!['join', 'ready'].includes(state.phase)) throw new Error('本局已开始。')
      const slot = state.joined.indexOf(false)
      if (slot === -1) throw new Error('五个玩家席位已满。')
      session.player = slot
      state.joined[slot] = true
      state.events.push(`玩家 ${slot + 1} 加入房间`)
      return room
    }
    if (name === 'reset') {
      if (!localAdmin && session.player !== state.roomOwner) throw new Error('只有房主可以重新开局。')
      resetRoom(room)
      return room
    }
    if (name === 'record-disposition') {
      if (session.player !== state.roomOwner) throw new Error('只有房主可以处理录音。')
    } else if (debugActions.has(name)) {
      if (!localAdmin) throw new Error('调试操作仅可在电脑本机执行。')
    } else if (hostActions.has(name) && (session.host || (localAdmin && (!session.testDevice || session.testDevice === 'computer')))) {
      // 独立主持或电脑公共屏可以推进流程；owner/invited 测试身份不能冒充主持。
    } else if (!playerActions.has(name) || session.player === null) {
      throw new Error('此设备没有执行该操作的身份权限。')
    }
    if (name === 'next-speaker' && !session.host && !(localAdmin && !session.testDevice) && state.speaker !== session.player) throw new Error('请等待当前玩家完成发言。')
    if (name === 'consent' && !['yes', 'no'].includes(value)) throw new Error('请选择录音意愿。')
    if (['pick-role', 'pick-seat', 'target'].includes(name) && !/^[0-4]$/.test(String(value))) throw new Error('无效选择。')
    room.engine.dispatch(name, value, session.player ?? 0, session.host || localAdmin)
    return room
  }
  function structural(room) {
    const { phaseSeconds, remaining, ...state } = room.engine.state
    return JSON.stringify({ ...state, countdownEnded: remaining === 0 })
  }
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }
  const handler = async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      if (req.method === 'GET' && url.pathname.startsWith('/api/music/')) {
        if (!musicFiles.size) return json(res, 404, { error: '音乐曲库不可用。' })
        const filename = decodeURIComponent(url.pathname.slice('/api/music/'.length))
        if (!musicFiles.has(filename)) return json(res, 404, { error: '曲目不存在。' })
        const file = resolve(musicRoot, filename)
        if (dirname(file) !== musicRoot) return json(res, 400, { error: '无效的曲目路径。' })
        let size
        try { size = statSync(file).size } catch { return json(res, 404, { error: '曲目文件不存在。' }) }
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '')
        if (range) {
          const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
          const end = range[2] ? Number(range[2]) : size - 1
          if (start > end || end >= size) {
            res.writeHead(416, { 'Content-Range': `bytes */${size}` })
            return res.end()
          }
          res.writeHead(206, { 'Content-Type': 'audio/mp4', 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Cache-Control': 'no-store' })
          if (req.method === 'HEAD') return res.end()
          const ranged = createReadStream(file, { start, end })
          ranged.on('error', () => res.destroy())
          return ranged.pipe(res)
        }
        res.writeHead(200, { 'Content-Type': 'audio/mp4', 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' })
        if (req.method === 'HEAD') return res.end()
        const stream = createReadStream(file)
        stream.on('error', () => res.destroy())
        return stream.pipe(res)
      }
      if (url.pathname.startsWith('/api/')) {
        const [id, session] = sessionFor(req, res)
        const localAdmin = isLocal(req)
        // 带 room 参数时以请求为准；否则回落到会话所在的房间。
        // lobby=1 强制取大厅快照：画布大厅态只让电脑端显示扫码入口。
        const pickRoom = () => {
          if (url.searchParams.get('lobby') === '1') return { requested: false, room: null }
          const requested = url.searchParams.get('room')
          if (requested) return { requested: true, room: rooms.get(requested) || null }
          return { requested: false, room: session.roomCode ? rooms.get(session.roomCode) || null : null }
        }
        if (req.method === 'GET' && url.pathname === '/api/session') {
          const { requested, room } = pickRoom()
          if (requested && !room) return json(res, 404, { error: '房间不存在或已散场。' })
          if (url.searchParams.has('hostToken')) {
            if (!room) throw new Error('主持邀请无效。')
            if (url.searchParams.get('hostToken') !== room.hostSecret || room.engine.state.host !== 'human' || room.engine.state.phase === 'create') throw new Error('主持邀请无效。')
            if (session.player !== null) throw new Error('请在独立设备或独立浏览器打开主持邀请。')
            if (Object.values(sessions).some(item => !item.mirror && item !== session && item.roomCode === room.code && item.host)) throw new Error('本局已有指定主持设备。')
            bindSession(session, room)
            session.host = true
            reconnect(session, room)
            room.seen.set(id, Date.now())
            broadcast(room)
          }
          if (!room) return json(res, 200, lobbySnapshot(session, localAdmin))
          bindSession(session, room)
          applyMirror(session, room)
          room.seen.set(id, Date.now())
          return json(res, 200, snapshot(session, room, localAdmin))
        }
        if (req.method === 'GET' && url.pathname === '/api/rooms') {
          sweepRooms()
          if (!isLocal(req)) return json(res, 403, { error: '房间列表只在本机可查。' })
          return json(res, 200, roomList())
        }
        if (req.method === 'GET' && url.pathname === '/api/events') {
          const { requested, room } = pickRoom()
          if (requested && !room) return json(res, 404, { error: '房间不存在或已散场。' })
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
          const client = { id, session, res, localAdmin }
          if (!room) {
            lobbyClients.add(client)
            send(client, lobbySnapshot(session, localAdmin))
            req.on('close', () => lobbyClients.delete(client))
            return
          }
          bindSession(session, room)
          applyMirror(session, room)
          room.clients.add(client)
          clearTimeout(room.grace.get(id))
          room.grace.delete(id)
          room.seen.set(id, Date.now())
          reconnect(session, room)
          broadcast(room)
          req.on('close', () => {
            room.clients.delete(client)
            disconnect(id, session, room)
          })
          return
        }
        if (req.method === 'GET' && url.pathname === '/api/qr') {
          const { requested, room } = pickRoom()
          if (requested && !room) return json(res, 404, { error: '房间不存在或已散场。' })
          const data = room ? snapshot(session, room, localAdmin) : lobbySnapshot(session, localAdmin)
          const kind = url.searchParams.get('kind')
          const target = kind === 'room' ? data.roomUrl : kind === 'host' ? data.hostInviteUrl : data.entryUrl
          if (!target) throw new Error('此设备没有主持邀请。')
          const code = qr(0, 'M')
          code.addData(encodeURI(target))
          code.make()
          const encoded = code.createDataURL(5, 16).split(',')[1]
          res.writeHead(200, { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' })
          return res.end(Buffer.from(encoded, 'base64'))
        }
        if (req.method === 'POST' && url.pathname === '/api/action') {
          if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return json(res, 403, { error: '来源校验失败。' })
          if (session.mirror) return json(res, 403, { error: '画布是只读镜像，不能操作。' })
          let raw = ''
          for await (const chunk of req) {
            raw += chunk
            if (Buffer.byteLength(raw) > 16000) return json(res, 413, { error: '提交内容过长。' })
          }
          const body = JSON.parse(raw)
          if (typeof body.requestId !== 'string' || body.requestId.length > 100) throw new Error('缺少请求编号。')
          const isCreate = body.name === 'create'
          let room = null
          if (!isCreate) {
            // join 以玩家输入的六位码为准，其余动作以 body.roomCode 或会话当前房间为准。
            const typed = body.name === 'join' ? String(body.value ?? '') : ''
            const code = /^\d{6}$/.test(typed) ? typed : String(body.roomCode ?? session.roomCode ?? '')
            room = rooms.get(code) || null
            if (!room) return json(res, 404, { error: body.name === 'join' ? '房间码不正确，或房间已散场。' : '房间不存在或已散场。' })
            bindSession(session, room)
          }
          session.requests ||= []
          if (!session.requests.includes(body.requestId)) {
            const before = room ? structuredClone(room.engine.state) : null
            try {
              const result = act(room, body, session, localAdmin)
              if (result === null) room = null
              else if (result) room = result
            } catch (error) {
              if (room && before) room.engine = createRoomEngine(before)
              throw error
            }
            session.requests = [...session.requests.slice(-49), body.requestId]
            if (room) {
              room.seen.set(id, Date.now())
              reconnect(session, room)
              broadcast(room)
            }
          }
          const current = session.roomCode ? rooms.get(session.roomCode) || null : null
          return json(res, 200, current ? snapshot(session, current, localAdmin) : lobbySnapshot(session, localAdmin))
        }
        return json(res, 404, { error: '接口不存在。' })
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: '请求方法不支持。' })
      let pathname = decodeURIComponent(url.pathname)
      // 英文路径别名：/stage/ 与 /prototype/ 指向同一个原型目录，避免 URL 里出现中文编码。
      const alias = pathname.match(/^\/(?:stage|prototype)(\/.*)?$/)
      if (alias) pathname = '/主体原型' + (alias[1] || '/')
      if (pathname === '/' || pathname === '/play') {
        const target = new URL('/stage/', 'http://localhost')
        target.search = url.search
        if (pathname === '/play') {
          target.searchParams.set('endpoint', 'player')
          target.searchParams.set('phone', '1')
        }
        res.writeHead(302, { Location: target.pathname + target.search })
        return res.end()
      }
      // 只有本机能进电脑主机端/主持端/双玩家测试；局域网里的手机一律落到玩家端。
      const remote = req.socket.remoteAddress || ''
      const localRequest = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1'
      const hostTokenParam = url.searchParams.get('hostToken')
      // 持主持邀请令牌的设备可以进主持端，其余远程设备一律只能进玩家端。
      if (!localRequest && !hostTokenParam && ['/主体原型/', '/主体原型', '/主体原型/index.html'].includes(pathname) && url.searchParams.get('endpoint') !== 'player') {
        res.writeHead(302, { Location: '/stage/?endpoint=player' })
        return res.end()
      }
      if (pathname === '/主体原型/' || pathname === '/主体原型') pathname = '/主体原型/index.html'
      const allowed = /^\/主体原型\/(index\.html|app\.js|canvas-board\.js|scripts-data\.mjs|style\.css|entry-cinema\.css|entry-cinema\.js|entry-transitions\.js|stage-views\.js|puppet-model\.js|music-library\.json)$/.test(pathname)
        || /^\/主体原型\/(cw-atmos\.css|cw-atmos\.js)$/.test(pathname)
        || /^\/主体原型\/创意预览\/(index\.html|preview\.css|preview\.js|legacy-scenes\.js|css-corridor\.html)$/.test(pathname)
        || /^\/主体原型\/创意预览\/covers\/[^/]+\.(png|jpg|webp)$/.test(pathname)
        || /^\/docs\/04_过程稿\/预览库\/2026-11-20_排版_选本页四方案\.html$/.test(pathname)
        || pathname === '/预览网关.html'
        || /^\/舞台原型\/node_modules\/three\/build\/three\.(module|core)\.js$/.test(pathname)
        || /^\/图库素材\/[^/]+\.(png|jpg|webp)$/.test(pathname)
      if (!allowed) return json(res, 404, { error: '资源不存在。' })
      const file = resolve(project, `.${pathname}`)
      const data = readFileSync(file)
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
      res.end(req.method === 'HEAD' ? undefined : data)
    } catch (error) {
      if (!res.headersSent) json(res, error.code === 'ENOENT' ? 404 : 400, { error: error.message })
      else res.end()
    }
  }
  setInterval(() => {
    for (const room of [...rooms.values()]) {
      try {
        const before = structural(room)
        room.engine.tick()
        broadcast(room, before !== structural(room))
      } catch (error) {
        console.error('Room timer failed', error)
        room.engine.state.paused = true
        broadcast(room)
      }
    }
  }, 1000)
  setInterval(() => {
    try { sweepRooms() } catch (error) { console.error('Room sweep failed', error) }
    schedulePersist()
  }, 10000).unref()

  return { handler, persist }
}

const mainRoom = createRoomHandler()
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const device = url.searchParams.get('testDevice')
  if (device !== null) {
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
    if (!local || !['owner', 'invited', 'host', 'computer'].includes(device)) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' })
      return res.end(JSON.stringify({ error: '测试身份仅在电脑本机使用。' }))
    }
  }
  return mainRoom.handler(req, res)
})
server.listen(port, '0.0.0.0', () => {
  console.log(`Computer http://127.0.0.1:${port}/主体原型/?endpoint=computer`)
  console.log(`Player http://${lanHost}:${port}/play`)
})
process.on('SIGTERM', () => {
  mainRoom.persist()
  server.close(() => process.exit(0))
})
