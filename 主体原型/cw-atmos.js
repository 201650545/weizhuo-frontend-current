/* 电脑主机端首屏：六本剧照循环的氛围层。
   只负责场景（等比铺满 + 切换），组件显隐仍由 app.js 的 computer-panels-hidden 控制。 */
const box = document.querySelector('#computer-welcome .cwa')
const stage = document.querySelector('#computer-welcome .cwa-stage')
const scenes = [...document.querySelectorAll('#computer-welcome .cws')]
const welcome = document.querySelector('#computer-welcome')
try {
  const savedBright = Number(localStorage.getItem('weizhuo:cwuBright'))
  if (savedBright >= .5 && savedBright <= 1.8) welcome?.style.setProperty('--cw-bright', String(savedBright))
} catch {}

if (box && stage && scenes.length) {
  const DESIGN_W = 1440
  const DESIGN_H = 810
  const fit = () => {
    const scale = Math.max(box.clientWidth / DESIGN_W, box.clientHeight / DESIGN_H)
    stage.style.setProperty('--cw-scale', scale.toFixed(4))
  }
  new ResizeObserver(fit).observe(box)
  fit()

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const books = () => [...document.querySelectorAll('#computer-catalog .board-book')]
  let index = Math.max(0, books().findIndex(book => book.classList.contains('active')))
  const show = next => {
    index = (next + scenes.length) % scenes.length
    scenes.forEach((scene, i) => scene.classList.toggle('on', i === index))
  }
  show(index)

  /* 书架点哪本，画面就换哪本；画面循环时也反过来点书架，让标题/简介/入场券跟着这本走。 */
  document.querySelector('#computer-catalog')?.addEventListener('click', event => {
    const book = event.target.closest('.board-book')
    if (!book) return
    const at = books().indexOf(book)
    if (at >= 0) show(at)
  })
  if (!reduced) setInterval(() => {
    const list = books()
    if (list.length) list[(index + 1) % list.length].click()
  }, 12000)

  /* 画面切到哪一本，左下文案/标签与入席牌就跟着换成本那一本 */
  const INFO = {
    'rainy-old-studio': { key: 'rainy', num: '第 〇 幕 · 入 席', seal: '雨', note: '暗房在三楼，别单独上楼',
      lead: '暴雨封路，五名故人受邀回到即将拆除的旧照相馆。晚宴前，邀请人死在暗房里。一张尚未冲洗完成的底片，把众人重新牵回十年前的一次失踪案。' },
    'fog-harbor-letter': { key: 'fog', num: '第 一 幕 · 等 信', seal: '雾', note: '雾散前，别开朝向港口的窗',
      lead: '一艘没有起航记录的货轮停在港口外。五封信在同一天寄到，落款都是三年前溺亡的邮差。雾散之前，谁都得留在灯塔下。' },
    'seventh-night-lamp': { key: 'lamp', num: '第 二 幕 · 灭 灯', seal: '灯', note: '灯灭的七分钟，别数秒',
      lead: '每晚十二点，楼道的灯会亮一次，亮七分钟。第七个夜晚，灯没有灭。五个人轮流守在灯下，没人承认自己按过开关。' },
    'river-bride': { key: 'bride', num: '第 三 幕 · 迎 亲', seal: '河', note: '红帖上的名字，别念出声',
      lead: '水乡每隔十年为河神送一次亲。今年被选中的姑娘在婚礼前夜失踪，河面上却多出一盏不该出现的河灯。' },
    'unsent-summer': { key: 'summer', num: '第 四 幕 · 未 寄', seal: '夏', note: '信按日期读，别跳页',
      lead: '毕业那年的信，一封都没寄出去。十年后同学重聚，旧教室的风扇还在转，窗台上摆着五封没有邮戳的信。' },
    'growth-rings': { key: 'rings', num: '第 五 幕 · 回 声', seal: '轮', note: '起风时，别回头',
      lead: '一张只在雨夜播放的唱片，录着三十年前的一场争吵。五次播放，五个人的记忆却各不相同。' }
  }
  const tNum = document.getElementById('cwuNum')
  const tTitle = document.getElementById('cwuTitle')
  const tLead = document.getElementById('cwuLead')
  const tTags = document.getElementById('cwuTags')
  const ticket = document.getElementById('entryTicket')
  const tSub = document.getElementById('tkSub')
  const tSeal2 = document.getElementById('tkSeal2')
  const tSub2 = document.getElementById('tkSub2')
  const tCode = document.getElementById('tkCode')
  let initialized = false
  const syncTicket = () => {
    const book = document.querySelector('#computer-catalog .board-book.active')
    if (!book) return
    if (!initialized) {
      const at = books().indexOf(book)
      if (at >= 0) { initialized = true; show(at) }
    }
    const info = INFO[book.dataset.value] || INFO['rainy-old-studio']
    const title = book.querySelector('.board-book-title')?.textContent?.trim() || info.num
    const meta = book.querySelector('.board-book-meta')?.textContent || ''
    const code = document.querySelector('#computer-room-card .board-room-code')?.textContent?.trim() || ''
    if (tNum) tNum.textContent = info.num
    if (tTitle) tTitle.textContent = title
    if (tLead) tLead.textContent = info.lead
    if (tTags) {
      const tags = meta.split('·').map(part => part.trim()).filter(Boolean)
      tTags.innerHTML = tags.map((tag, i) => '<li>' + (i === 0 ? tag + '本' : tag) + '</li>').join('')
    }
    if (ticket) ticket.dataset.t = info.key
    if (tSub) tSub.textContent = title + ' · 房间码 ' + (code || '待创建')
    if (tSeal2) tSeal2.textContent = info.seal
    if (tSub2) tSub2.textContent = title + ' · ' + info.note
    if (tCode) tCode.textContent = code || '扫 码 进 入'
  }
  syncTicket()
  const catalog = document.querySelector('#computer-catalog')
  if (catalog) new MutationObserver(syncTicket).observe(catalog, { subtree: true, childList: true, attributes: true })
  const card = document.querySelector('#computer-room-card')
  if (card) new MutationObserver(syncTicket).observe(card, { subtree: true, childList: true })

  /* 小码点开大码 */
  const modal = document.getElementById('tkModal')
  const closeModal = () => { if (modal) modal.hidden = true }
  ticket?.addEventListener('click', () => { if (modal) modal.hidden = false })
  document.getElementById('tkClose')?.addEventListener('click', closeModal)
  modal?.addEventListener('click', event => { if (event.target === modal) closeModal() })
  window.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal() })

  /* 雨、雨溅、尘埃 */
  document.querySelectorAll('#computer-welcome [data-rain]').forEach(el => {
    let html = ''
    const n = +el.dataset.rain
    for (let i = 0; i < n; i++) {
      html += '<i style="left:' + (Math.random() * 116).toFixed(2) + '%;animation-duration:' + (0.7 + Math.random() * 0.85).toFixed(2)
        + 's;animation-delay:' + (-Math.random() * 2).toFixed(2) + 's;opacity:' + (0.12 + Math.random() * 0.42).toFixed(2) + '"></i>'
    }
    el.innerHTML = html
  })
  document.querySelectorAll('#computer-welcome [data-splash]').forEach(el => {
    let html = ''
    const n = +el.dataset.splash
    for (let i = 0; i < n; i++) {
      const bottom = (4 + Math.random() * 30)
      html += '<i style="left:' + (3 + Math.random() * 94).toFixed(2) + '%;bottom:' + bottom.toFixed(2)
        + '%;width:' + (16 + (38 - bottom) * 1.2).toFixed(0) + 'px;animation-duration:' + (1.9 + Math.random() * 1.4).toFixed(2)
        + 's;animation-delay:' + (-Math.random() * 3).toFixed(2) + 's"></i>'
    }
    el.innerHTML = html
  })
  document.querySelectorAll('#computer-welcome [data-dust]').forEach(el => {
    let html = ''
    const n = +el.dataset.dust
    for (let i = 0; i < n; i++) {
      html += '<i style="left:' + (Math.random() * 100).toFixed(2) + '%;top:' + (26 + Math.random() * 68).toFixed(2)
        + '%;animation-duration:' + (10 + Math.random() * 15).toFixed(1) + 's;animation-delay:' + (-Math.random() * 18).toFixed(1) + 's"></i>'
    }
    el.innerHTML = html
  })
}
