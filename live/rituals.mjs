// Original implementation for Len Chua Online. No code copied from Temple RPC.
// Aggregates are stored; names, user IDs and private prayers are NEVER persisted.
import fs from 'node:fs';
import path from 'node:path';

export const RITUAL_METHODS = Object.freeze([
  'temple.burnIncense', 'temple.bow', 'temple.sendPrayer',
  'temple.ringBell', 'temple.strikeWoodenFish', 'temple.drawFortune',
  'temple.offerLotus'
]);

const REFLECTIONS = Object.freeze([
  { title: 'Lắng nghe', text: 'Hít thở bình thản, lắng nghe tâm mình trước khi nói và làm.' },
  { title: 'Từ bi', text: 'Một lời nói dịu dàng có thể làm nhẹ đi nỗi buồn của người khác.' },
  { title: 'Biết đủ', text: 'Trân trọng điều đang có, dành thời gian cho những người thương.' },
  { title: 'Chánh niệm', text: 'Quay về với hơi thở, nhận biết từng bước chân hiện tại.' },
  { title: 'Nhẫn nại', text: 'Khi gặp khó khăn, giữ lòng bình tĩnh trước khi quyết định.' },
  { title: 'Tri ân', text: 'Ghi nhớ ơn cha mẹ, thầy bạn và những người đã giúp đỡ mình.' },
  { title: 'Buông xả', text: 'Nhẹ nhàng buông những điều không thể thay đổi.' },
  { title: 'Tinh tấn', text: 'Mỗi ngày tiến một bước nhỏ trên con đường sống thiện lành.' }
]);

export function cleanText(value, max = 140) {
  return String(value ?? '').normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s.,!?-]/gu, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, max);
}
export function foldVietnamese(value) {
  return cleanText(value, 200).toLowerCase().replace(/đ/g, 'd')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
export function parseRitualComment(value) {
  const t = foldVietnamese(value);
  if (!t) return null;
  if (/\b(xin xam|gieo que|rut que|loi quan chieu)\b/.test(t)) return 'temple.drawFortune';
  if (/\b(thap huong|dang huong|thap nhang)\b/.test(t)) return 'temple.burnIncense';
  if (/\b(lay phat|bai phat|danh le|tam bai)\b/.test(t)) return 'temple.bow';
  if (/\b(thinh chuong|danh chuong)\b/.test(t)) return 'temple.ringBell';
  if (/\b(go mo)\b/.test(t)) return 'temple.strikeWoodenFish';
  if (/\b(hoa dang|cau nguyen|nguyen cau|cau binh an|cau cho)\b/.test(t)) return 'temple.sendPrayer';
  return null; // ordinary chat still enters and keeps its original seat/skin
}
const blankTotals = () => ({ incense: 0, bows: 0, lanterns: 0, bells: 0, woodenFish: 0, reflections: 0, lotuses: 0 });
const quantities = {
  'temple.burnIncense': ['incense', 3],
  'temple.bow': ['bows', 3],
  'temple.sendPrayer': ['lanterns', 1],
  'temple.ringBell': ['bells', 1],
  'temple.strikeWoodenFish': ['woodenFish', 1],
  'temple.drawFortune': ['reflections', 1],
  'temple.offerLotus': ['lotuses', 1]
};
const titles = {
  'temple.burnIncense': 'Dâng hương',
  'temple.bow': 'Đảnh lễ Tam Bái',
  'temple.sendPrayer': 'Hoa đăng cầu nguyện',
  'temple.ringBell': 'Thỉnh chuông',
  'temple.strikeWoodenFish': 'Gõ mõ',
  'temple.drawFortune': 'Lời quán chiếu',
  'temple.offerLotus': 'Dâng hoa sen'
};
export function createRitualEngine({ filePath, emit = () => {}, speak = () => {}, now = Date.now } = {}) {
  let totals = blankTotals(), version = 1, sequence = 0;
  const cooldowns = new Map();
  if (filePath) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (parsed?.version === 1 && parsed.totals && typeof parsed.totals === 'object') {
        for (const key of Object.keys(totals)) {
          const n = parsed.totals[key];
          if (Number.isSafeInteger(n) && n >= 0) totals[key] = n;
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn('[rituals] Không đọc được trạng thái:', err.message);
    }
  }
  const getState = () => ({ version, totals: { ...totals } });
  let timer = null, writing = Promise.resolve();
  function persist() {
    if (!filePath) return Promise.resolve();
    const json = JSON.stringify(getState(), null, 2) + '\n';
    writing = writing.catch(() => {}).then(async () => {
      const dir = path.dirname(filePath);
      await fs.promises.mkdir(dir, { recursive: true });
      const tmp = filePath + '.tmp';
      await fs.promises.writeFile(tmp, json, { mode: 0o600 });
      await fs.promises.rename(tmp, filePath);
    }).catch(err => console.error('[rituals] Lưu trạng thái thất bại:', err.message));
    return writing;
  }
  const scheduleSave = () => {
    clearTimeout(timer);
    timer = setTimeout(persist, 250);
  };
  function perform(method, params = {}, options = {}) {
    if (!Object.hasOwn(quantities, method)) throw new Error('Unknown ritual method');
    if (!params || Array.isArray(params) || typeof params !== 'object') throw new Error('Invalid params');
    const user = cleanText(params.user || 'Phật tử hữu duyên', 24) || 'Phật tử hữu duyên';
    const wish = cleanText(params.wish || '', 140);
    const [key, defaults] = quantities[method];
    const numeric = Number(params.count);
    const count = method === 'temple.burnIncense' ? Math.min(3, Math.max(1, Number.isFinite(numeric) ? Math.floor(numeric) : defaults))
      : method === 'temple.strikeWoodenFish' ? Math.min(3, Math.max(1, Number.isFinite(numeric) ? Math.floor(numeric) : defaults))
      : defaults;
    const reflection = method === 'temple.drawFortune' ? { ...REFLECTIONS[totals.reflections % REFLECTIONS.length] } : null;
    totals[key] += count;
    const event = {
      id: 'ritual-' + now() + '-' + (++sequence),
      type: method.slice('temple.'.length), title: titles[method],
      user, wish, count, reflection, at: now()
    };
    scheduleSave();
    emit(event);
    const canSpeak = options.speak !== false && method !== 'temple.strikeWoodenFish'
      && method !== 'temple.offerLotus';
    if (canSpeak) {
      const line = method === 'temple.drawFortune'
        ? user + ', lời quán chiếu hôm nay: ' + reflection.title + '. ' + reflection.text
        : method === 'temple.sendPrayer'
          ? 'Nam mô A Di Đà Phật. ' + user + ' gửi lời cầu nguyện. ' + (wish || 'Nguyện cho mọi người bình an.')
          : method === 'temple.bow'
            ? 'Nam mô A Di Đà Phật. ' + user + ' thành tâm dâng hương.'
            : method === 'temple.bow'
              ? 'Nam mô A Di Đà Phật. ' + user + ' đảnh lễ Tam Bái.'
              : 'Nam mô A Di Đà Phật. ' + user + ' thỉnh chuông.';
      speak(line, { tag: 'ritual' });
    }
    return { event, state: getState() };
  }
  function fromComment({ id, user, text, speak: withVoice = true } = {}) {
    const method = parseRitualComment(text);
    if (!method) return null;
    const key = cleanText(id || user || 'anonymous', 80);
    const ts = now();
    if (ts - (cooldowns.get(key) ?? -Infinity) < 6000) return null;
    cooldowns.set(key, ts);
    if (cooldowns.size > 1000) cooldowns.delete(cooldowns.keys().next().value);
    return perform(method, { user, wish: method === 'temple.sendPrayer' ? text : '' }, { speak: withVoice });
  }
  async function flush() { clearTimeout(timer); await persist(); }
  return { getState, perform, fromComment, flush };
}
