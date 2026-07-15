const STORAGE_KEY = 'freelanceTrackerData';

const EVENT_TYPES = ['客户', '自媒体']; // 预置类型 value；自建类型用自定义 id
const MAX_EVENT_TYPES = 10; // 含 2 个预置
const MAX_CUSTOM_EVENT_TYPES = MAX_EVENT_TYPES - EVENT_TYPES.length;

const CUSTOM_TYPE_COLORS = [
  '#0f766e', '#b45309', '#1d4ed8', '#7c3aed', '#be123c', '#15803d', '#c2410c', '#0369a1',
];

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp >= 0 && hp < 1) {
    r1 = c;
    g1 = x;
  } else if (hp < 2) {
    r1 = x;
    g1 = c;
  } else if (hp < 3) {
    g1 = c;
    b1 = x;
  } else if (hp < 4) {
    g1 = x;
    b1 = c;
  } else if (hp < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }
  const m = l - c / 2;
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

const MEDIA_ACCENT = '#d51b4f';

const CLIENT_BILLING = { TIME: 'time', FLAT: 'flat' };

const TIME_BILLING_SCHEMES = {
  REMAINDER_LADDER: 'remainder_ladder', // 默认：不到 30 秒半分钟，超过 1 分钟
  REMAINDER_TIERS: 'remainder_tiers', // 自定义：满 A 秒→0.5，满 B 秒→1
};

const DEFAULT_SETTINGS = {
  accent: MEDIA_ACCENT,
  /** 全局：关闭=客户按金额；打开=客户按时长（默认关闭） */
  timeBillingEnabled: false,
  timeBilling: {
    scheme: TIME_BILLING_SCHEMES.REMAINDER_LADDER,
    thresholdSeconds: 30,
    lowMinutes: 0.5,
    highMinutes: 1,
    // 自定义：满 tier1 秒 → 0.5 分；满 tier2 秒 → 1 分（≥）
    tier1OverSeconds: 10,
    tier1Minutes: 0.5,
    tier2OverSeconds: 30,
    tier2Minutes: 1,
  },
  eventTypes: {
    client: { label: '客户剪辑', color: '#000000' },
    social: { label: '自媒体', color: MEDIA_ACCENT },
  },
  customEventTypes: [],
};

const STATUS_EMOJIS = {
  已排期: '📅',
  剪辑中: '✂️',
  审核中: '👀',
  已交付: '✅',
  未完成: '🕒',
  已完成: '✅',
};

const CLIENT_STATUSES = ['已排期', '剪辑中', '审核中', '已交付'];
const DELIVERY_MATCHABLE_CLIENT_STATUSES = ['审核中'];
const MEDIA_STATUSES = ['脚本', '拍摄', '剪辑', '发布'];
const CUSTOM_STATUSES = ['未完成', '已完成'];
const EVENT_STATUSES = CLIENT_STATUSES;

const CATEGORY_TO_TYPE = {
  design: '剪辑',
  dev: '脚本',
  consulting: '客户',
  writing: '发布',
  other: '拍摄',
};

const OLD_STATUS_TO_NEW = {
  scheduled: '已排期',
  completed: '已交付',
  cancelled: '已排期',
};

const INCOME_TYPES = {
  CLIENT: 'client',
  SOCIAL: 'social',
  CUSTOM: 'custom',
};

const INCOME_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
};

const INCOME_SOURCE = {
  AUTO: 'auto',
  MANUAL: 'manual',
};

const DEFAULT_DATA = {
  events: [],
  clients: [],
  incomes: [],
  categories: [
    { id: 'design', label: '设计', color: '#6366f1' },
    { id: 'dev', label: '开发', color: '#0891b2' },
    { id: 'consulting', label: '咨询', color: '#d97706' },
    { id: 'writing', label: '写作', color: '#16a34a' },
    { id: 'other', label: '其他', color: '#64748b' },
  ],
  profile: {
    name: '创作者',
    avatar: '',
  },
  settings: structuredClone(DEFAULT_SETTINGS),
};

function normalizeHexColor(value, fallback) {
  const s = String(value || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return `#${s.slice(1).toLowerCase()}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  }
  return fallback;
}

function clampBillingSeconds(value, fallback, min = 0, max = 59) {
  let n = Number(value);
  if (!Number.isFinite(n)) n = fallback;
  n = Math.floor(n);
  if (n < min) n = min;
  if (n > max) n = max;
  return n;
}

function clampPositiveMinutes(value, fallback) {
  let n = Number(value);
  if (!Number.isFinite(n) || n < 0) n = fallback;
  return n;
}

function normalizeTimeBilling(raw) {
  const d = DEFAULT_SETTINGS.timeBilling;
  let scheme = raw?.scheme;

  // 旧版无 scheme / 匀速块 → 默认推荐规则
  if (!scheme || scheme === 'block') {
    scheme = d.scheme;
  }
  if (
    scheme !== TIME_BILLING_SCHEMES.REMAINDER_LADDER
    && scheme !== TIME_BILLING_SCHEMES.REMAINDER_TIERS
  ) {
    scheme = d.scheme;
  }

  return {
    scheme,
    thresholdSeconds: d.thresholdSeconds,
    lowMinutes: d.lowMinutes,
    highMinutes: d.highMinutes,
    tier1OverSeconds: clampBillingSeconds(raw?.tier1OverSeconds, d.tier1OverSeconds, 1, 58),
    tier1Minutes: d.tier1Minutes,
    tier2OverSeconds: clampBillingSeconds(raw?.tier2OverSeconds, d.tier2OverSeconds, 2, 59),
    tier2Minutes: d.tier2Minutes,
  };
}

function normalizeCustomEventType(raw, index = 0) {
  const id = String(raw?.id || '').trim() || crypto.randomUUID();
  const label = String(raw?.label || '').trim() || `类型${index + 1}`;
  const color = normalizeHexColor(
    raw?.color,
    CUSTOM_TYPE_COLORS[index % CUSTOM_TYPE_COLORS.length],
  );
  return { id, label, color };
}

function normalizeCustomEventTypes(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    if (out.length >= MAX_CUSTOM_EVENT_TYPES) break;
    const item = normalizeCustomEventType(list[i], i);
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function normalizeSettings(raw) {
  const d = DEFAULT_SETTINGS;
  return {
    accent: normalizeHexColor(raw?.accent, d.accent),
    timeBillingEnabled: Boolean(raw?.timeBillingEnabled),
    timeBilling: normalizeTimeBilling(raw?.timeBilling),
    eventTypes: {
      // 预置：名称锁死，只允许改颜色
      client: {
        label: d.eventTypes.client.label,
        color: normalizeHexColor(
          raw?.eventTypes?.client?.color,
          d.eventTypes.client.color,
        ),
      },
      social: {
        label: d.eventTypes.social.label,
        color: normalizeHexColor(
          raw?.eventTypes?.social?.color,
          d.eventTypes.social.color,
        ),
      },
    },
    customEventTypes: normalizeCustomEventTypes(raw?.customEventTypes),
  };
}

function getCustomEventTypes() {
  return getSettings().customEventTypes || [];
}

function findCustomTypeById(id) {
  if (!id) return null;
  return getCustomEventTypes().find((t) => t.id === id) || null;
}

function isCustomEventType(type) {
  return Boolean(findCustomTypeById(type));
}

function isValidEventType(type) {
  return type === '客户' || type === '自媒体' || isCustomEventType(type);
}

function getEventTypeOptions() {
  return [
    { value: '客户', label: getTypeLabel('client') },
    { value: '自媒体', label: getTypeLabel('social') },
    ...getCustomEventTypes().map((t) => ({ value: t.id, label: t.label })),
  ];
}

function getStatusesForEventType(type) {
  if (type === '客户') return CLIENT_STATUSES;
  if (type === '自媒体') return MEDIA_STATUSES;
  if (isCustomEventType(type)) return CUSTOM_STATUSES;
  return MEDIA_STATUSES;
}

function getDefaultStatusForEventType(type) {
  if (type === '客户') return '已排期';
  if (type === '自媒体') return '剪辑';
  if (isCustomEventType(type)) return '未完成';
  return '剪辑';
}

function getCustomTypeColor(typeId) {
  return findCustomTypeById(typeId)?.color || CUSTOM_TYPE_COLORS[0];
}

function getCustomTypeLabel(typeId) {
  return findCustomTypeById(typeId)?.label || '自定义';
}

function countEventTypesTotal() {
  return 2 + getCustomEventTypes().length;
}

function getTimeBillingRule() {
  return getSettings().timeBilling;
}

function isTimeBillingEnabled() {
  return Boolean(getSettings().timeBillingEnabled);
}

/** 客户：全局关闭按时 → 一律金额；开启后看本档 clientBillingMode（默认按时） */
function getScheduleBillingMode(schedule) {
  if (!schedule) {
    return isTimeBillingEnabled() ? CLIENT_BILLING.TIME : CLIENT_BILLING.FLAT;
  }
  const incomeType = schedule.incomeType || eventTypeToIncomeType(schedule.type);
  if (
    incomeType === INCOME_TYPES.SOCIAL
    || schedule.type === '自媒体'
    || incomeType === INCOME_TYPES.CUSTOM
    || isCustomEventType(schedule.type)
  ) {
    return CLIENT_BILLING.FLAT;
  }
  if (!isTimeBillingEnabled()) return CLIENT_BILLING.FLAT;
  if (schedule.clientBillingMode === CLIENT_BILLING.FLAT) return CLIENT_BILLING.FLAT;
  if (schedule.clientBillingMode === CLIENT_BILLING.TIME) return CLIENT_BILLING.TIME;
  // 旧数据：有金额无时长 → 当作一口价
  const hasFlat = schedule.clientFlatAmount != null && Number(schedule.clientFlatAmount) > 0;
  const hasDuration = Number(schedule.durationSeconds) > 0;
  if (hasFlat && !hasDuration) return CLIENT_BILLING.FLAT;
  return CLIENT_BILLING.TIME;
}

/** loadData 过程中临时挂载，供 normalizeEvent 识别自定义类型 */
let settingsCacheDuringLoad = null;

function getSettings() {
  if (settingsCacheDuringLoad) return settingsCacheDuringLoad;
  appData.settings = normalizeSettings(appData.settings);
  return appData.settings;
}

function getTypeColor(key) {
  const types = getSettings().eventTypes;
  return types[key]?.color || DEFAULT_SETTINGS.eventTypes[key]?.color || MEDIA_ACCENT;
}

function getTypeLabel(key) {
  const types = getSettings().eventTypes;
  return types[key]?.label || DEFAULT_SETTINGS.eventTypes[key]?.label || key;
}

function hexToRgb(hex) {
  const h = normalizeHexColor(hex, '#000000').slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function darkenHex(hex, amount = 0.15) {
  const { r, g, b } = hexToRgb(hex);
  const d = (v) => Math.max(0, Math.round(v * (1 - amount)));
  return `#${[d(r), d(g), d(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** t=0 偏向 hexA，t=1 偏向 hexB */
function mixHex(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const w = Math.min(1, Math.max(0, Number(t) || 0));
  const m = (x, y) => Math.round(x + (y - x) * w);
  return `#${[m(a.r, b.r), m(a.g, b.g), m(a.b, b.b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

function colorLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function contrastTextColor(bgHex) {
  return colorLuminance(bgHex) > 0.72 ? '#111111' : '#FFFFFF';
}

/** 自媒体状态色：由类型色派生深浅（脚本最浅 → 发布为原色） */
function getSocialStatusColor(status) {
  const base = getTypeColor('social');
  switch (status) {
    case '脚本':
      return mixHex(base, '#ffffff', 0.82);
    case '拍摄':
      return mixHex(base, '#ffffff', 0.55);
    case '剪辑':
      return mixHex(base, '#ffffff', 0.28);
    case '发布':
      return base;
    default:
      return mixHex(base, '#ffffff', 0.28);
  }
}

function accentToSoft(hex, alpha = 0.12) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function applyThemeFromSettings() {
  const { accent } = getSettings();
  const root = document.documentElement;
  const hover = darkenHex(accent);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-hover', hover);
  root.style.setProperty('--primary', accent);
  root.style.setProperty('--primary-hover', hover);
  root.style.setProperty('--accent-soft', accentToSoft(accent));
}

let appData = loadData();
let calendar = null;
let incomeChart = null;
let workDaysMonthChart = null;
let workDaysYearChart = null;
let incomeChartPeriod = 'month';
let currentViewDate = new Date();
let selectedDate = startOfDay(new Date());
let incomeArchiveTrendChart = null;
let archiveViewYear = new Date().getFullYear();
let showIncomeViewPanel = null;
let syncMainViewHeight = null;
const mainViewHeightByMonth = new Map();

function getMainViewMonthKey(date = currentViewDate) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

const QUICK_ADD_PANEL_HEIGHT = 140;

function getQuickAddReserveHeight() {
  const el = $('#quickAddPanel');
  if (!el) return QUICK_ADD_PANEL_HEIGHT;
  if (!el.hidden && el.offsetHeight > 0) return el.offsetHeight;
  return QUICK_ADD_PANEL_HEIGHT;
}

function applyMainViewHeight(px) {
  const calendarWrap = $('#calendarWrap');
  const incomeView = $('#incomeView');
  if (!px || px <= 0) return;
  const base = Math.ceil(px);
  if (calendarWrap) calendarWrap.style.height = `${base}px`;
  if (incomeView) {
    // 收入页隐藏「快速添加」时补足同高，避免左侧变矮连带侧栏图表缩小
    const incomeH = base + getQuickAddReserveHeight();
    incomeView.style.height = `${incomeH}px`;
  }
}

function resizeSidebarCharts() {
  incomeChart?.resize?.();
  workDaysMonthChart?.resize?.();
  workDaysYearChart?.resize?.();
}

/** 测量前先放开固定高度，避免读到被裁剪后的 offsetHeight */
function readCalendarNaturalHeight(calendarWrap = $('#calendarWrap')) {
  if (!calendarWrap || !calendar) return null;

  const lockedHeight = calendarWrap.style.height;
  calendarWrap.style.height = 'auto';
  calendar.updateSize();
  const height = Math.ceil(calendarWrap.scrollHeight || calendarWrap.offsetHeight);
  calendarWrap.style.height = lockedHeight;

  return height > 0 ? height : null;
}

function measureCalendarWrapHeight() {
  const calendarWrap = $('#calendarWrap');
  const incomeView = $('#incomeView');
  const calendarContainer = document.querySelector('.calendar-container');
  if (!calendarWrap || !calendar) return null;

  const calWasHidden = calendarWrap.hidden;
  const incWasHidden = incomeView?.hidden ?? true;

  calendarWrap.hidden = false;
  if (incomeView) incomeView.hidden = true;

  const width = calendarContainer?.clientWidth || calendarWrap.offsetWidth;
  const saved = {
    visibility: calendarWrap.style.visibility,
    position: calendarWrap.style.position,
    left: calendarWrap.style.left,
    right: calendarWrap.style.right,
    width: calendarWrap.style.width,
    pointerEvents: calendarWrap.style.pointerEvents,
  };

  if (calWasHidden) {
    calendarWrap.style.visibility = 'hidden';
    calendarWrap.style.position = 'absolute';
    calendarWrap.style.left = '0';
    calendarWrap.style.right = '0';
    calendarWrap.style.width = width ? `${width}px` : '';
    calendarWrap.style.pointerEvents = 'none';
  }

  const height = readCalendarNaturalHeight(calendarWrap);

  calendarWrap.style.visibility = saved.visibility;
  calendarWrap.style.position = saved.position;
  calendarWrap.style.left = saved.left;
  calendarWrap.style.right = saved.right;
  calendarWrap.style.width = saved.width;
  calendarWrap.style.pointerEvents = saved.pointerEvents;
  calendarWrap.hidden = calWasHidden;
  if (incomeView) incomeView.hidden = incWasHidden;

  if (height > 0) {
    mainViewHeightByMonth.set(getMainViewMonthKey(), height);
  }
  return height > 0 ? height : null;
}

function syncMainViewHeightNow() {
  const calendarWrap = $('#calendarWrap');
  if (!calendarWrap) return;

  let height = null;
  if (!calendarWrap.hidden) {
    height = readCalendarNaturalHeight(calendarWrap);
  } else {
    height = measureCalendarWrapHeight();
  }

  if (!height) {
    height = mainViewHeightByMonth.get(getMainViewMonthKey()) ?? null;
  }

  if (height > 0) {
    applyMainViewHeight(height);
    mainViewHeightByMonth.set(getMainViewMonthKey(), height);
    requestAnimationFrame(resizeSidebarCharts);
  }
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function normalizeProfile(profile) {
  const fallback = DEFAULT_DATA.profile;
  return {
    name: (profile?.name || fallback.name).trim() || fallback.name,
    avatar: typeof profile?.avatar === 'string' ? profile.avatar : fallback.avatar,
  };
}

function eventTypeToIncomeType(type) {
  if (type === '客户') return INCOME_TYPES.CLIENT;
  if (type === '自媒体') return INCOME_TYPES.SOCIAL;
  if (isCustomEventType(type)) return INCOME_TYPES.CUSTOM;
  return INCOME_TYPES.SOCIAL;
}

function normalizeClient(client) {
  return {
    id: client?.id || crypto.randomUUID(),
    name: String(client?.name || '').trim(),
    ratePerMinute: Math.max(0, Number(client?.ratePerMinute) || 0),
  };
}

function normalizeIncome(income) {
  let incomeType = INCOME_TYPES.CLIENT;
  if (income?.incomeType === INCOME_TYPES.SOCIAL) incomeType = INCOME_TYPES.SOCIAL;
  else if (income?.incomeType === INCOME_TYPES.CUSTOM) incomeType = INCOME_TYPES.CUSTOM;

  let status = income?.status === INCOME_STATUS.PAID ? INCOME_STATUS.PAID : INCOME_STATUS.PENDING;
  if (incomeType === INCOME_TYPES.SOCIAL) {
    status = INCOME_STATUS.PAID;
  }

  let customTypeId = null;
  if (incomeType === INCOME_TYPES.CUSTOM) {
    customTypeId = String(income?.customTypeId || '').trim() || null;
  }

  return {
    id: income?.id || crypto.randomUUID(),
    scheduleId: income?.scheduleId != null && income.scheduleId !== ''
      ? income.scheduleId
      : null,
    date: typeof income?.date === 'string' ? income.date.split('T')[0] : '',
    incomeType,
    customTypeId,
    clientName: String(income?.clientName || '').trim(),
    ratePerMinute: income?.ratePerMinute != null ? Number(income.ratePerMinute) : null,
    durationSeconds: income?.durationSeconds != null ? Number(income.durationSeconds) : null,
    billedMinutes: income?.billedMinutes != null ? Number(income.billedMinutes) : null,
    finalPrice: Math.max(0, Number(income?.finalPrice) || 0),
    status,
    source: income?.source === INCOME_SOURCE.MANUAL ? INCOME_SOURCE.MANUAL : INCOME_SOURCE.AUTO,
  };
}

function isSocialIncomeStatusLocked(income) {
  return income?.incomeType === INCOME_TYPES.SOCIAL;
}

function calculateRemainderMinutes(remainderSeconds, rule) {
  const rem = Math.max(0, Math.floor(Number(remainderSeconds) || 0));
  if (rem <= 0) return 0;

  if (rule.scheme === TIME_BILLING_SCHEMES.REMAINDER_TIERS) {
    let t1 = Number(rule.tier1OverSeconds);
    let t2 = Number(rule.tier2OverSeconds);
    if (!Number.isFinite(t1)) t1 = 10;
    if (!Number.isFinite(t2)) t2 = 30;
    if (t2 < t1) {
      const swap = t1;
      t1 = t2;
      t2 = swap;
    }
    // 满（≥）多少秒算多少：与设置文案一致
    let billed = 0;
    if (rem >= t1) billed = Number(rule.tier1Minutes) || 0;
    if (rem >= t2) billed = Number(rule.tier2Minutes) || 0;
    return billed;
  }

  // 默认：不到 30 秒算半分钟，超过 30 秒算 1 分钟
  const threshold = Number(rule.thresholdSeconds) || 30;
  if (rem <= threshold) return Number(rule.lowMinutes) || 0;
  return Number(rule.highMinutes) || 0;
}

/** 按时计费：完整分钟 + 零头进位（标准来自设置） */
function calculateBilledMinutes(durationSeconds) {
  const seconds = Number(durationSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  const rule = getTimeBillingRule();
  const wholeMinutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return wholeMinutes + calculateRemainderMinutes(remainder, rule);
}

function calculateClientFinalPrice(durationSeconds, ratePerMinute) {
  const billedMinutes = calculateBilledMinutes(durationSeconds);
  const rate = Number(ratePerMinute);
  if (!Number.isFinite(rate) || rate <= 0 || billedMinutes <= 0) return 0;
  return billedMinutes * rate;
}

function buildIncomeSnapshotFromSchedule(schedule, overrides = {}) {
  const incomeType = schedule.incomeType || eventTypeToIncomeType(schedule.type);
  const base = {
    scheduleId: schedule.id,
    date: schedule.date,
    incomeType,
    clientName: incomeType === INCOME_TYPES.CLIENT
      ? (schedule.clientName || schedule.client || '')
      : (schedule.socialProject || schedule.projectName || ''),
    ratePerMinute: null,
    durationSeconds: null,
    billedMinutes: null,
    finalPrice: 0,
    status: INCOME_STATUS.PENDING,
    source: INCOME_SOURCE.AUTO,
  };
  return normalizeIncome({ ...base, ...overrides });
}

function needsScheduleSchemaMigration(events) {
  return events.some(
    (evt) =>
      evt.incomeType === undefined
      || evt.incomeGenerated === undefined
      || evt.clientName === undefined
  );
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_DATA);
    const parsed = JSON.parse(raw);
    settingsCacheDuringLoad = normalizeSettings(parsed.settings);
    const rawEvents = Array.isArray(parsed.events) ? parsed.events : [];
    const events = migrateEvents(rawEvents);
    const wasLegacy = rawEvents.some(
      (e) => e.projectName === undefined && (e.title || e.start)
    );
    const clients = Array.isArray(parsed.clients)
      ? parsed.clients.map(normalizeClient).filter((c) => c.name)
      : [];
    const incomes = Array.isArray(parsed.incomes)
      ? parsed.incomes.map(normalizeIncome)
      : [];
    const data = {
      events,
      clients,
      incomes,
      categories: Array.isArray(parsed.categories) ? parsed.categories : DEFAULT_DATA.categories,
      profile: normalizeProfile(parsed.profile),
      settings: settingsCacheDuringLoad,
    };
    settingsCacheDuringLoad = null;
    const shouldPersist = wasLegacy
      || !parsed.profile
      || !parsed.settings
      || !Array.isArray(parsed.clients)
      || !Array.isArray(parsed.incomes)
      || needsScheduleSchemaMigration(rawEvents);
    if (shouldPersist) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    return data;
  } catch {
    settingsCacheDuringLoad = null;
    return structuredClone(DEFAULT_DATA);
  }
}

function migrateEvents(events) {
  return events.map(migrateEvent);
}

function migrateEvent(evt) {
  if (evt.type && evt.date !== undefined && evt.projectName !== undefined) {
    return normalizeEvent(evt);
  }

  const date = evt.start ? toDateString(new Date(evt.start)) : toDateString(new Date());

  return normalizeEvent({
    id: evt.id || crypto.randomUUID(),
    projectName: evt.title || evt.projectName || '',
    client: evt.client || '',
    type: CATEGORY_TO_TYPE[evt.category] || '剪辑',
    status: OLD_STATUS_TO_NEW[evt.status] || evt.status || '已排期',
    date,
    income: evt.income,
    notes: evt.notes,
  });
}

function normalizeStatus(type, status) {
  if (type === '客户') {
    return CLIENT_STATUSES.includes(status) ? status : '已排期';
  }
  if (type === '自媒体') {
    if (MEDIA_STATUSES.includes(status)) return status;
    if (MEDIA_STATUSES.includes(type)) return type;
    return '剪辑';
  }
  if (isCustomEventType(type)) {
    return CUSTOM_STATUSES.includes(status) ? status : '未完成';
  }
  if (MEDIA_STATUSES.includes(status)) return status;
  return '剪辑';
}

function normalizeEvent(evt) {
  let type = evt.type || '自媒体';
  if (!isValidEventType(type)) {
    type = EVENT_TYPES.includes(type) ? type : '自媒体';
  }

  let incomeType = eventTypeToIncomeType(type);
  if (
    evt.incomeType === INCOME_TYPES.SOCIAL
    || evt.incomeType === INCOME_TYPES.CLIENT
    || evt.incomeType === INCOME_TYPES.CUSTOM
  ) {
    // 仅在与 type 推导一致时保留（避免脏数据）
    const derived = eventTypeToIncomeType(type);
    incomeType = derived;
  }

  const legacyIncome = Number(evt.income) || 0;
  const isClient = incomeType === INCOME_TYPES.CLIENT;
  const isSocial = incomeType === INCOME_TYPES.SOCIAL;
  const isCustom = incomeType === INCOME_TYPES.CUSTOM;

  let socialAmount = null;
  if (isSocial) {
    if (evt.socialAmount != null && evt.socialAmount !== '') {
      socialAmount = Number(evt.socialAmount) || 0;
    } else if (legacyIncome > 0) {
      socialAmount = legacyIncome;
    }
  }

  let clientFlatAmount = null;
  if (isClient || isCustom) {
    if (evt.clientFlatAmount != null && evt.clientFlatAmount !== '') {
      clientFlatAmount = Number(evt.clientFlatAmount);
      if (!Number.isFinite(clientFlatAmount) || clientFlatAmount <= 0) clientFlatAmount = null;
    } else if (isCustom && legacyIncome > 0) {
      clientFlatAmount = legacyIncome;
    }
  }

  return {
    id: evt.id || crypto.randomUUID(),
    projectName: evt.projectName || '',
    client: evt.client || '',
    type,
    status: normalizeStatus(type, evt.status),
    date: typeof evt.date === 'string' ? evt.date.split('T')[0] : toDateString(getEventDate(evt)),
    income: legacyIncome,
    notes: evt.notes || '',
    clientId: evt.clientId || null,
    clientName: String(
      evt.clientName ?? (
        isClient
          ? (evt.client || '')
          : (evt.socialProject || evt.projectName || '')
      )
    ).trim(),
    durationSeconds: isClient && evt.durationSeconds != null ? Number(evt.durationSeconds) : null,
    clientFlatAmount,
    clientBillingMode: isClient
      ? (
        evt.clientBillingMode === CLIENT_BILLING.FLAT || evt.clientBillingMode === CLIENT_BILLING.TIME
          ? evt.clientBillingMode
          : null
      )
      : null,
    incomeType,
    socialProject: isSocial ? String(evt.socialProject || evt.projectName || '').trim() : null,
    socialAmount,
    incomeGenerated: Boolean(evt.incomeGenerated),
  };
}

function getEventDate(evt) {
  if (evt.date) {
    const [y, m, d] = evt.date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  if (evt.start) return startOfDay(new Date(evt.start));
  return startOfDay(new Date());
}

function toDateString(date) {
  const d = startOfDay(date instanceof Date ? date : new Date(date));
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toDateInputValue(dateOrEvt) {
  const d = dateOrEvt instanceof Date ? dateOrEvt : getEventDate(dateOrEvt);
  return toDateString(d);
}

function formatEventTitle(evt) {
  const type = evt.type || '剪辑';
  if (type === '客户') {
    const name = evt.client || evt.projectName || '客户';
    const status = EVENT_STATUSES.includes(evt.status) ? evt.status : '已排期';
    const emoji = STATUS_EMOJIS[status] || STATUS_EMOJIS['已排期'];
    return `${emoji} ${name}`;
  }
  if (isCustomEventType(type)) {
    const name = evt.projectName || getCustomTypeLabel(type);
    const status = CUSTOM_STATUSES.includes(evt.status) ? evt.status : '未完成';
    const emoji = STATUS_EMOJIS[status] || '';
    return emoji ? `${emoji} ${name}` : name;
  }
  const name = evt.projectName || '';
  const typeLabel = type === '自媒体' ? getTypeLabel('social') : type;
  return name ? `${name}·${typeLabel}` : typeLabel;
}

function getEventColor(type, status) {
  if (type === '客户') {
    return getTypeColor('client');
  }
  if (isCustomEventType(type)) {
    return getCustomTypeColor(type);
  }
  const mediaStatus = MEDIA_STATUSES.includes(status) ? status : '剪辑';
  return getSocialStatusColor(mediaStatus);
}

function getEventTextColor(type, status) {
  return contrastTextColor(getEventColor(type, status));
}

function getEventTypeColor(typeOrEvt, status) {
  if (typeof typeOrEvt === 'object' && typeOrEvt !== null) {
    return getEventColor(typeOrEvt.type, typeOrEvt.status);
  }
  return getEventColor(typeOrEvt, status);
}

function saveData() {
  if (!Array.isArray(appData.clients)) appData.clients = [];
  if (!Array.isArray(appData.incomes)) appData.incomes = [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

/** 备份并重置收入数据（控制台：backupAndResetIncomeData()） */
function backupAndResetIncomeData({ clientStatus = '已排期', downloadBackup = true } = {}) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupKey = `${STORAGE_KEY}_backup_${timestamp}`;
  const backup = structuredClone(appData);
  const before = {
    incomes: appData.incomes.length,
    incomeGeneratedTrue: appData.events.filter((e) => e.incomeGenerated).length,
    clientSchedules: appData.events.filter((e) => isClientSchedule(e)).length,
  };

  localStorage.setItem(backupKey, JSON.stringify(backup));

  if (downloadBackup) {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `freelanceTrackerData-backup-${timestamp}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  appData.incomes = [];
  appData.events = appData.events.map((evt) => {
    const normalized = normalizeEvent(evt);
    const patch = { incomeGenerated: false };
    if (isClientSchedule(normalized)) {
      patch.status = CLIENT_STATUSES.includes(clientStatus) ? clientStatus : '已排期';
    }
    return normalizeEvent({ ...normalized, ...patch });
  });

  saveData();
  refreshUI();

  const after = {
    incomes: appData.incomes.length,
    incomeGeneratedTrue: appData.events.filter((e) => e.incomeGenerated).length,
    clientStatusCounts: appData.events
      .filter((e) => isClientSchedule(e))
      .reduce((acc, e) => {
        const s = getClientScheduleStatus(e);
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {}),
  };

  const summary = { ok: true, backupKey, before, after };
  console.log('[data-reset] 完成', summary);
  return summary;
}

function findClientById(clientId) {
  return appData.clients.find((c) => c.id === clientId) || null;
}

function normalizeNameKey(name) {
  return String(name || '').trim().toLowerCase();
}

/** 名称宽松匹配：相等或互相包含（不区分大小写，支持英文） */
function namesLooselyMatch(a, b) {
  const na = normalizeNameKey(a);
  const nb = normalizeNameKey(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function findClientsByNameLoose(name) {
  const target = normalizeNameKey(name);
  if (!target) return [];
  const exact = appData.clients.filter((c) => normalizeNameKey(c.name) === target);
  if (exact.length > 0) return exact;
  return appData.clients.filter((c) => namesLooselyMatch(c.name, target));
}

function findClientByName(name) {
  const matches = findClientsByNameLoose(name);
  if (matches.length === 0) return null;
  const target = normalizeNameKey(name);
  return matches.find((c) => normalizeNameKey(c.name) === target) || matches[0];
}

function getScheduleById(scheduleId) {
  return appData.events.find((e) => e.id === scheduleId) || null;
}

function hasIncomeForSchedule(scheduleId) {
  if (!scheduleId) return false;
  return appData.incomes.some((i) => i.scheduleId === scheduleId);
}

function isClientSchedule(schedule) {
  return (schedule?.incomeType || eventTypeToIncomeType(schedule?.type)) === INCOME_TYPES.CLIENT;
}

function isSocialSchedule(schedule) {
  return (schedule?.incomeType || eventTypeToIncomeType(schedule?.type)) === INCOME_TYPES.SOCIAL;
}

function isCustomSchedule(schedule) {
  return (schedule?.incomeType || eventTypeToIncomeType(schedule?.type)) === INCOME_TYPES.CUSTOM;
}

function isScheduleDelivered(schedule) {
  if (!schedule) return false;
  if (isCustomSchedule(schedule)) return schedule.status === '已完成';
  return schedule.status === '已交付';
}

/** 规范化客户档期状态（兼容旧数据/空白） */
function getClientScheduleStatus(schedule) {
  if (!schedule) return '';
  const raw = String(schedule.status || '').trim();
  if (!isClientSchedule(schedule)) return raw;
  return CLIENT_STATUSES.includes(raw) ? raw : normalizeStatus('客户', raw);
}

/** 客户档期是否允许通过交付确认关联收入：仅审核中 + 未生成收入 */
function isClientScheduleIncomeMatchable(schedule) {
  if (!isClientSchedule(schedule)) return false;
  if (schedule.incomeGenerated) return false;
  if (hasIncomeForSchedule(schedule.id)) return false;
  return DELIVERY_MATCHABLE_CLIENT_STATUSES.includes(getClientScheduleStatus(schedule));
}

const CN_DIGITS = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

const DELIVERY_NOISE_WORDS = /剪辑完成|已完成|交付完成|时长|交付|完成/g;

let deliveryPickResolver = null;

function parseChineseNumberToken(token) {
  const s = String(token || '').trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (s === '十') return 10;
  if (s.includes('十')) {
    const parts = s.split('十');
    const tens = parts[0] === '' ? 1 : (CN_DIGITS[parts[0]] ?? parseInt(parts[0], 10));
    const ones = parts[1] ? (CN_DIGITS[parts[1]] ?? parseInt(parts[1], 10) ?? 0) : 0;
    if (Number.isFinite(tens) && Number.isFinite(ones)) return tens * 10 + ones;
  }
  if (CN_DIGITS[s] !== undefined) return CN_DIGITS[s];
  const num = parseInt(s, 10);
  return Number.isFinite(num) ? num : null;
}

/** 从交付文本解析视频时长（秒），支持「三分42秒」「3分30秒」「3:42」等 */
function parseDurationSecondsFromText(text) {
  const raw = String(text || '');

  const fenMiao = raw.match(
    /(?:时长\s*)?([一二三四五六七八九十两〇零\d]+)\s*分\s*([一二三四五六七八九十两〇零\d]+)\s*秒/
  );
  if (fenMiao) {
    const minutes = parseChineseNumberToken(fenMiao[1]);
    const seconds = parseChineseNumberToken(fenMiao[2]);
    if (minutes != null && seconds != null) return minutes * 60 + seconds;
  }

  const colon = raw.match(/(\d+)\s*[:：]\s*(\d+)/);
  if (colon) return parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10);

  const minutesOnly = raw.match(/([一二三四五六七八九十两〇零\d]+)\s*分(?!\s*[一二三四五六七八九十两〇零\d])/);
  if (minutesOnly) {
    const minutes = parseChineseNumberToken(minutesOnly[1]);
    if (minutes != null) return minutes * 60;
  }

  const arabicSec = raw.match(/(?:时长\s*)?(\d+)\s*秒/);
  if (arabicSec) return parseInt(arabicSec[1], 10);

  const cnSec = raw.match(/(?:时长\s*)?([一二三四五六七八九十两〇零\d]+)\s*秒/);
  if (cnSec) {
    const sec = parseChineseNumberToken(cnSec[1]);
    if (sec != null) return sec;
  }

  return null;
}

function extractDeliveryDateFromText(raw, refDate = new Date()) {
  const today = startOfDay(refDate);
  const monthDayRe = /(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/;
  const m = raw.match(monthDayRe);
  if (!m) return { date: null, matched: '' };
  const d = resolveMonthDayForDelivery(parseInt(m[1], 10), parseInt(m[2], 10), today);
  return { date: d, matched: m[0] };
}

function parseSocialDeliveryAmount(raw) {
  const m = raw.trim().match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*元?$/);
  if (!m) return null;
  const project = m[1].trim();
  const amount = parseFloat(m[2]);
  if (!project || !Number.isFinite(amount) || amount <= 0) return null;
  return { projectName: project, amount };
}

/** 解析 Mac 语音交付确认文本：日期 + 客户名 + 时长 */
function parseDeliveryText(text, refDate = new Date()) {
  const raw = String(text || '').trim();
  if (!raw) return { ok: false, error: '请输入交付确认内容' };

  const durationSeconds = parseDurationSecondsFromText(raw);
  if (durationSeconds == null || durationSeconds <= 0) {
    const social = parseSocialDeliveryAmount(raw);
    if (social) {
      const { date } = extractDeliveryDateFromText(raw, refDate);
      return { ok: true, kind: 'social', ...social, date };
    }
    return { ok: false, error: '无法识别视频时长，请确认格式如「三分42秒」' };
  }

  const { date, matched: datePart } = extractDeliveryDateFromText(raw, refDate);
  let cleaned = raw;
  if (datePart) cleaned = cleaned.replace(datePart, ' ');
  cleaned = cleaned.replace(
    /(?:时长\s*)?([一二三四五六七八九十两〇零\d]+)\s*分\s*([一二三四五六七八九十两〇零\d]+)\s*秒/g,
    ' '
  );
  cleaned = cleaned.replace(/(\d+)\s*[:：]\s*(\d+)/g, ' ');
  cleaned = cleaned.replace(
    /([一二三四五六七八九十两〇零\d]+)\s*分(?!\s*[一二三四五六七八九十两〇零\d])/g,
    ' '
  );
  cleaned = cleaned.replace(/(?:时长\s*)?\d+\s*秒/g, ' ');
  cleaned = cleaned.replace(
    /(?:时长\s*)?([一二三四五六七八九十两〇零\d]+)\s*秒/g,
    ' '
  );
  cleaned = cleaned.replace(DELIVERY_NOISE_WORDS, ' ');
  cleaned = cleaned.replace(/[、，,.\s]+/g, ' ').trim();

  // 英文名 / 中文名 / 中英混合（如 David、杠金、A品牌）
  const nameMatch = cleaned.match(
    /[A-Za-z][A-Za-z0-9\-']*(?:\s+[A-Za-z][A-Za-z0-9\-']*){0,3}|[\u4e00-\u9fa5]{1,12}|[A-Za-z\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5\-']{0,31}/
  );
  if (!nameMatch) {
    return { ok: false, error: '无法识别客户名称' };
  }

  return {
    ok: true,
    kind: 'client',
    clientName: nameMatch[0].trim(),
    date,
    durationSeconds,
  };
}

function getScheduleDisplayName(schedule) {
  if (isSocialSchedule(schedule)) {
    return (schedule.socialProject || schedule.projectName || schedule.clientName || '').trim();
  }
  return (schedule.clientName || schedule.client || schedule.projectName || '').trim();
}

function schedulesMatchClientName(schedule, clientName) {
  const target = String(clientName || '').trim();
  if (!target) return false;

  const aliases = [
    getScheduleDisplayName(schedule),
    schedule.clientName,
    schedule.client,
    schedule.projectName,
  ]
    .map((s) => String(s || '').trim())
    .filter(Boolean);

  if (aliases.some((alias) => namesLooselyMatch(alias, target))) return true;

  const linked = resolveClientForSchedule(schedule, target);
  return Boolean(linked && namesLooselyMatch(linked.name, target));
}

function getUnpublishedSocialSchedules() {
  return appData.events.filter((e) => isSocialSchedule(e) && e.status !== '发布');
}

function schedulesMatchSocialProject(schedule, projectName) {
  const target = String(projectName || '').trim();
  const name = (schedule.socialProject || schedule.projectName || '').trim();
  if (!target || !name) return false;
  return name === target || name.includes(target) || target.includes(name);
}

function getSocialProjectKey(projectName) {
  return String(projectName || '').trim();
}

function scheduleDatesInSameMonth(dateStrA, dateStrB) {
  if (!dateStrA || !dateStrB) return false;
  return dateStrA.slice(0, 7) === dateStrB.slice(0, 7);
}

function getSocialProjectDisplayName(schedule) {
  return getSocialProjectKey(schedule?.socialProject || schedule?.projectName || '');
}

function parseMonthAnchorFromDateStr(dateStr) {
  if (!dateStr) return null;
  const [y, m] = dateStr.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return new Date(y, m - 1, 1);
}

function findSocialIncomeForSchedule(scheduleId) {
  if (!scheduleId) return null;
  return findAutoIncomeForSchedule(scheduleId)
    || appData.incomes.find(
      (i) => i.scheduleId === scheduleId && i.incomeType === INCOME_TYPES.SOCIAL,
    )
    || null;
}

/** 同项目同月是否已由其他档期/收入归档；当前档期若为归档主记录则返回 null */
function findSocialProjectArchiveForSchedule(projectName, scheduleDateStr, currentScheduleId = null) {
  const key = getSocialProjectKey(projectName);
  if (!key || !scheduleDateStr) return null;

  const owners = [];

  for (const evt of appData.events) {
    if (!isSocialSchedule(evt)) continue;
    if (getSocialProjectDisplayName(evt) !== key) continue;
    if (!scheduleDatesInSameMonth(evt.date, scheduleDateStr)) continue;

    const amount = Number(evt.socialAmount);
    const hasAmount = Number.isFinite(amount) && amount > 0;
    const income = findSocialIncomeForSchedule(evt.id);
    if (!hasAmount && !income && !evt.incomeGenerated) continue;

    owners.push({
      scheduleId: evt.id,
      schedule: evt,
      income,
      amount: hasAmount ? amount : income?.finalPrice ?? null,
    });
  }

  const monthAnchor = parseMonthAnchorFromDateStr(scheduleDateStr);
  if (monthAnchor) {
    for (const income of incomesInMonth(monthAnchor)) {
      if (income.incomeType !== INCOME_TYPES.SOCIAL) continue;
      if (getSocialProjectKey(income.clientName) !== key) continue;
      if (owners.some((o) => o.income?.id === income.id)) continue;
      if (income.scheduleId && owners.some((o) => o.scheduleId === income.scheduleId)) continue;

      owners.push({
        scheduleId: income.scheduleId || null,
        schedule: income.scheduleId ? getScheduleById(income.scheduleId) : null,
        income,
        amount: income.finalPrice,
      });
    }
  }

  if (owners.length === 0) return null;
  if (currentScheduleId && owners.some((o) => o.scheduleId === currentScheduleId)) return null;
  return owners[0];
}

function clearSiblingSocialAmounts(ownerSchedule) {
  if (!isSocialSchedule(ownerSchedule)) return;
  const key = getSocialProjectDisplayName(ownerSchedule);
  const monthDate = ownerSchedule.date;
  if (!key || !monthDate) return;

  for (let i = 0; i < appData.events.length; i += 1) {
    const evt = appData.events[i];
    if (evt.id === ownerSchedule.id || !isSocialSchedule(evt)) continue;
    if (getSocialProjectDisplayName(evt) !== key) continue;
    if (!scheduleDatesInSameMonth(evt.date, monthDate)) continue;
    if (evt.socialAmount == null || evt.socialAmount === '') continue;
    appData.events[i] = normalizeEvent({ ...evt, socialAmount: null });
  }
}

function matchSchedulesForSocialDelivery({ projectName, amount, date }) {
  let pool = getUnpublishedSocialSchedules().filter((s) => schedulesMatchSocialProject(s, projectName));
  if (pool.length === 0) return { type: 'none' };

  if (amount > 0) {
    const byAmount = pool.filter((s) => Number(s.socialAmount) === amount);
    if (byAmount.length > 0) pool = byAmount;
  }

  if (date) {
    const dateStr = toDateString(date);
    const onDate = pool.filter((s) => s.date === dateStr);
    if (onDate.length === 1) return { type: 'single', schedule: onDate[0] };
    if (onDate.length > 1) return { type: 'multiple', schedules: onDate };
    return { type: 'fallback', schedule: pickNearestScheduleByDate(pool, date) };
  }

  if (pool.length === 1) return { type: 'single', schedule: pool[0] };

  const ref = currentViewDate || new Date();
  const nearest = pickNearestScheduleByDate(pool, ref);
  const sameDay = pool.filter((s) => s.date === nearest.date);
  if (sameDay.length === 1) return { type: 'single', schedule: sameDay[0] };
  return { type: 'multiple', schedules: sameDay };
}

function formatSocialDeliveryErrorMessage(parsed) {
  const dateLabel = parsed.date
    ? parsed.date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
    : '指定日期';
  return `未找到「${parsed.projectName}」在${dateLabel}的未发布档期，请先在月视图创建自媒体档期并填写一口价金额。`;
}

function confirmSocialDelivery(schedule) {
  if (!schedule || !isSocialSchedule(schedule)) {
    return { ok: false, message: '非自媒体档期' };
  }
  if (schedule.status === '发布') {
    return { ok: false, message: '该档期已是发布状态' };
  }
  if (!hasAutoIncomeForSchedule(schedule.id)) {
    const amount = Number(schedule.socialAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        ok: false,
        message: '该档期尚未生成收入，请先在档期中填写一口价金额并保存。',
      };
    }
  }

  updateScheduleInStore(schedule.id, { status: '发布' });
  return { ok: true, scheduleId: schedule.id };
}

async function processSocialDeliveryConfirmation(parsed) {
  const match = matchSchedulesForSocialDelivery(parsed);
  if (match.type === 'none') {
    return { ok: false, message: formatSocialDeliveryErrorMessage(parsed) };
  }

  let schedule;
  if (match.type === 'single' || match.type === 'fallback') {
    schedule = match.schedule;
  } else if (match.type === 'multiple') {
    schedule = await openDeliveryPickModal(match.schedules);
    if (!schedule) return { ok: false, message: '已取消选择' };
  }

  const result = confirmSocialDelivery(schedule);
  if (!result.ok) return { ok: false, message: result.message };

  saveData();
  refreshUI();
  return { ok: true, message: '已匹配档期并更新为发布', scheduleId: schedule.id };
}

function getMatchableClientSchedulesForDelivery() {
  return appData.events.filter(isClientScheduleIncomeMatchable);
}

function daysBetweenDateStr(dateStr, targetDate) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const a = new Date(y, m - 1, d);
  const b = startOfDay(targetDate);
  return Math.abs(a.getTime() - b.getTime()) / 86400000;
}

function pickNearestScheduleByDate(schedules, targetDate) {
  if (!schedules.length) return null;
  return [...schedules].sort(
    (a, b) => daysBetweenDateStr(a.date, targetDate) - daysBetweenDateStr(b.date, targetDate)
  )[0];
}

function toDeliveryMatchLog(schedule) {
  return {
    id: schedule.id,
    clientName: getScheduleDisplayName(schedule),
    date: schedule.date,
    status: getClientScheduleStatus(schedule),
    incomeGenerated: Boolean(schedule.incomeGenerated),
    hasIncome: hasIncomeForSchedule(schedule.id),
    type: schedule.type,
  };
}

/** 交付确认日期匹配：先精确到 YYYY-MM-DD，再回退到 MM-DD（避免年份解析偏差） */
function scheduleMatchesDeliveryDate(schedule, date) {
  if (!schedule?.date || !date) return false;
  const target = toDateString(date);
  if (schedule.date === target) return true;
  const [, sm, sd] = schedule.date.split('-');
  const [, tm, td] = target.split('-');
  return sm === tm && sd === td;
}

function getEligibleClientSchedulesForDelivery(clientName) {
  const target = String(clientName || '').trim();
  const byName = appData.events.filter(
    (e) => isClientSchedule(e) && schedulesMatchClientName(e, target)
  );

  console.log('[delivery-match] ① 客户名匹配', {
    clientName: target,
    count: byName.length,
    schedules: byName.map(toDeliveryMatchLog),
  });

  const eligible = byName.filter((s) => {
    const status = getClientScheduleStatus(s);
    const statusOk = DELIVERY_MATCHABLE_CLIENT_STATUSES.includes(status);
    const incomeOk = !s.incomeGenerated && !hasIncomeForSchedule(s.id);
    const ok = statusOk && incomeOk;
    console.log('[delivery-match] ② 审核中过滤', {
      ...toDeliveryMatchLog(s),
      statusOk,
      incomeOk,
      eligible: ok,
    });
    return ok;
  });

  console.log('[delivery-match] ③ 可关联审核中档期', {
    count: eligible.length,
    schedules: eligible.map(toDeliveryMatchLog),
  });

  return eligible;
}

function sortSchedulesForPick(schedules) {
  return [...schedules].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 交付确认匹配（日期可选）：
 * - 无日期：该客户所有审核中档期 → 1条自动 / 多条弹窗
 * - 有日期：优先该日 → 未命中则选离语音日期最近的审核中档期
 */
function matchSchedulesForDelivery({ clientName, date }) {
  console.log('[delivery-match] 开始', {
    clientName,
    date: date ? toDateString(date) : null,
  });

  const eligible = getEligibleClientSchedulesForDelivery(clientName);
  if (eligible.length === 0) return { type: 'none' };

  if (!date) {
    if (eligible.length === 1) {
      console.log('[delivery-match] ⑤ 无日期·自动选中', toDeliveryMatchLog(eligible[0]));
      return { type: 'single', schedule: eligible[0] };
    }
    const schedules = sortSchedulesForPick(eligible);
    console.log('[delivery-match] ⑤ 无日期·需用户选择', schedules.map(toDeliveryMatchLog));
    return { type: 'multiple', schedules };
  }

  const voiceDateStr = toDateString(date);
  const onDate = eligible.filter((s) => scheduleMatchesDeliveryDate(s, date));
  console.log('[delivery-match] ④ 日期优先', {
    voiceDate: voiceDateStr,
    count: onDate.length,
    schedules: onDate.map(toDeliveryMatchLog),
  });

  if (onDate.length === 1) {
    console.log('[delivery-match] ⑤ 日期命中·自动选中', toDeliveryMatchLog(onDate[0]));
    return { type: 'single', schedule: onDate[0] };
  }
  if (onDate.length > 1) {
    const schedules = sortSchedulesForPick(onDate);
    console.log('[delivery-match] ⑤ 日期命中·需用户选择', schedules.map(toDeliveryMatchLog));
    return { type: 'multiple', schedules };
  }

  const nearest = pickNearestScheduleByDate(eligible, date);
  if (nearest) {
    console.log('[delivery-match] ⑤ 日期未命中·最近审核中', toDeliveryMatchLog(nearest));
    return { type: 'fallback', schedule: nearest };
  }

  return { type: 'none' };
}

function resetScheduleIncomeGenerated(scheduleId) {
  if (!scheduleId) return;
  const schedule = getScheduleById(scheduleId);
  if (!schedule || !schedule.incomeGenerated) return;
  updateScheduleInStore(scheduleId, { incomeGenerated: false });
}

function formatDeliveryPickLabel(schedule) {
  const name = getScheduleDisplayName(schedule);
  const status = getClientScheduleStatus(schedule);
  const idShort = String(schedule.id || '').slice(0, 8);
  const note = schedule.notes ? ` · ${schedule.notes}` : '';
  return `${schedule.date} · ${name} · ${status}${note} · #${idShort}`;
}

function canDeleteIncomeFromList(income) {
  if (income.source === INCOME_SOURCE.MANUAL) return true;
  return income.source === INCOME_SOURCE.AUTO
    && (
      income.incomeType === INCOME_TYPES.CLIENT
      || income.incomeType === INCOME_TYPES.SOCIAL
      || income.incomeType === INCOME_TYPES.CUSTOM
    );
}

function deleteIncomeById(incomeId) {
  const income = appData.incomes.find((i) => i.id === incomeId);
  if (!income || !canDeleteIncomeFromList(income)) return;

  const message = income.scheduleId
    ? '确定删除这条收入吗？关联档期将允许重新录入，档期状态保持不变。'
    : '确定删除这条收入吗？';
  if (!confirm(message)) return;

  const { scheduleId } = income;
  appData.incomes = appData.incomes.filter((i) => i.id !== incomeId);
  resetScheduleIncomeGenerated(scheduleId);
  saveData();
  closeManualIncomeModal();
  closeIncomeEditModal();
  refreshUI();
}

function hasAutoIncomeForSchedule(scheduleId) {
  return appData.incomes.some(
    (i) => i.scheduleId === scheduleId && i.source === INCOME_SOURCE.AUTO
  );
}

function findAutoIncomeForSchedule(scheduleId) {
  return appData.incomes.find(
    (i) => i.scheduleId === scheduleId && i.source === INCOME_SOURCE.AUTO
  ) || null;
}

function removeAutoIncomesForSchedule(scheduleId) {
  appData.incomes = appData.incomes.filter(
    (i) => !(i.scheduleId === scheduleId && i.source === INCOME_SOURCE.AUTO)
  );
}

function updateScheduleInStore(scheduleId, patch) {
  const idx = appData.events.findIndex((e) => e.id === scheduleId);
  if (idx === -1) return null;
  appData.events[idx] = normalizeEvent({ ...appData.events[idx], ...patch });
  return appData.events[idx];
}

function resolveClientForSchedule(schedule, clientName) {
  const name = clientName || schedule.clientName || schedule.client;
  if (schedule.clientId) {
    const byId = findClientById(schedule.clientId);
    if (byId) return byId;
  }
  return findClientByName(name);
}

function syncScheduleOnClientIncomePaid(income) {
  if (!income?.scheduleId || income.incomeType !== INCOME_TYPES.CLIENT) return;
  if (income.status !== INCOME_STATUS.PAID) return;

  const schedule = getScheduleById(income.scheduleId);
  if (!schedule || !isClientSchedule(schedule)) return;

  const patch = {};
  if (schedule.status !== '已交付') {
    patch.status = '已交付';
  }
  if (!schedule.incomeGenerated) {
    patch.incomeGenerated = true;
  }
  if (Object.keys(patch).length > 0) {
    updateScheduleInStore(income.scheduleId, patch);
  }
}

function syncScheduleOnCustomIncomePaid(income) {
  if (!income?.scheduleId || income.incomeType !== INCOME_TYPES.CUSTOM) return;
  if (income.status !== INCOME_STATUS.PAID) return;

  const schedule = getScheduleById(income.scheduleId);
  if (!schedule || !isCustomSchedule(schedule)) return;

  const patch = {};
  if (schedule.status !== '已完成') {
    patch.status = '已完成';
  }
  if (!schedule.incomeGenerated) {
    patch.incomeGenerated = true;
  }
  if (Object.keys(patch).length > 0) {
    updateScheduleInStore(income.scheduleId, patch);
  }
}

function syncScheduleOnIncomePaid(income) {
  if (income?.incomeType === INCOME_TYPES.CLIENT) {
    syncScheduleOnClientIncomePaid(income);
    return;
  }
  if (income?.incomeType === INCOME_TYPES.CUSTOM) {
    syncScheduleOnCustomIncomePaid(income);
  }
}

function createClientIncomeFromDelivery(schedule, { durationSeconds, clientRecord } = {}) {
  if (!schedule) return { ok: false, error: '档期不存在' };
  if (!isClientSchedule(schedule)) return { ok: false, error: '非客户档期' };
  if (getClientScheduleStatus(schedule) !== '审核中') {
    const statusLabel = getClientScheduleStatus(schedule) || '未知';
    return { ok: false, error: `该档期状态为「${statusLabel}」，按时计费需先改为审核中` };
  }

  const existing = findAutoIncomeForSchedule(schedule.id);
  if (existing?.status === INCOME_STATUS.PAID) {
    return { ok: false, error: '该档期收入已到账，无法再用时长覆盖' };
  }
  if (!existing && hasIncomeForSchedule(schedule.id)) {
    return { ok: false, error: '该档期已有收入记录，请先删除后再重新录入' };
  }

  const client = clientRecord || resolveClientForSchedule(schedule);
  const seconds = durationSeconds != null
    ? Number(durationSeconds)
    : Number(schedule.durationSeconds) || 0;
  const ratePerMinute = client?.ratePerMinute ?? 0;

  let billedMinutes = null;
  let finalPrice = 0;

  if (seconds > 0 && ratePerMinute > 0) {
    billedMinutes = calculateBilledMinutes(seconds);
    finalPrice = calculateClientFinalPrice(seconds, ratePerMinute);
  } else if (schedule.income > 0) {
    finalPrice = schedule.income;
  } else if (seconds > 0 && !client) {
    return { ok: false, error: '未找到客户档案，无法按费率计费，请先在客户管理中建档' };
  } else if (seconds > 0 && ratePerMinute <= 0) {
    const name = client?.name || getScheduleDisplayName(schedule);
    return { ok: false, error: `客户「${name}」未设置费率，无法自动计费` };
  } else {
    return { ok: false, error: '缺少有效时长或金额，无法生成收入' };
  }

  const patchBase = {
    scheduleId: schedule.id,
    date: schedule.date,
    incomeType: INCOME_TYPES.CLIENT,
    clientName: schedule.clientName || schedule.client || client?.name || '',
    ratePerMinute: ratePerMinute > 0 ? ratePerMinute : null,
    durationSeconds: seconds > 0 ? seconds : null,
    billedMinutes,
    finalPrice,
    status: INCOME_STATUS.PENDING,
    source: INCOME_SOURCE.AUTO,
  };

  let income;
  if (existing) {
    const idx = appData.incomes.findIndex((i) => i.id === existing.id);
    income = normalizeIncome({ ...existing, ...patchBase, id: existing.id });
    if (idx !== -1) appData.incomes[idx] = income;
  } else {
    income = normalizeIncome(patchBase);
    appData.incomes.push(income);
  }

  updateScheduleInStore(schedule.id, {
    durationSeconds: seconds > 0 ? seconds : schedule.durationSeconds,
    clientId: client?.id || schedule.clientId,
    clientName: schedule.clientName || schedule.client || client?.name || '',
    incomeGenerated: true,
  });

  return { ok: true, income };
}

function upsertClientFlatIncomeFromSchedule(schedule) {
  if (!schedule || !isClientSchedule(schedule)) return { ok: false, error: '非客户档期' };
  const amount = Number(schedule.clientFlatAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: '缺少有效一口价金额' };
  }

  const existing = findAutoIncomeForSchedule(schedule.id);
  if (existing?.status === INCOME_STATUS.PAID) {
    return { ok: true, income: existing, skipped: true };
  }
  if (!existing && hasIncomeForSchedule(schedule.id)) {
    return { ok: false, error: '该档期已有收入记录，请先删除后再重新录入' };
  }

  const client = resolveClientForSchedule(schedule);
  const patchBase = {
    scheduleId: schedule.id,
    date: schedule.date,
    incomeType: INCOME_TYPES.CLIENT,
    clientName: schedule.clientName || schedule.client || client?.name || '',
    ratePerMinute: null,
    durationSeconds: null,
    billedMinutes: null,
    finalPrice: amount,
    status: INCOME_STATUS.PENDING,
    source: INCOME_SOURCE.AUTO,
  };

  let income;
  if (existing) {
    const idx = appData.incomes.findIndex((i) => i.id === existing.id);
    income = normalizeIncome({ ...existing, ...patchBase, id: existing.id });
    if (idx !== -1) appData.incomes[idx] = income;
  } else {
    income = normalizeIncome(patchBase);
    appData.incomes.push(income);
  }

  updateScheduleInStore(schedule.id, {
    clientId: client?.id || schedule.clientId,
    clientName: schedule.clientName || schedule.client || client?.name || '',
    clientFlatAmount: amount,
    incomeGenerated: true,
  });

  return { ok: true, income };
}

function syncClientTimeScheduleIncome(current) {
  if (!isClientSchedule(current)) return { ok: true, skipped: true };
  if (getClientScheduleStatus(current) !== '审核中') return { ok: true, skipped: true };
  const seconds = Number(current.durationSeconds) || 0;
  if (seconds <= 0) return { ok: true, skipped: true };
  return createClientIncomeFromDelivery(current, { durationSeconds: seconds });
}

function syncClientFlatScheduleIncome(current) {
  if (!isClientSchedule(current)) return { ok: true, skipped: true };
  const amount = Number(current.clientFlatAmount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: true, skipped: true };
  return upsertClientFlatIncomeFromSchedule(current);
}

function upsertCustomFlatIncomeFromSchedule(schedule) {
  if (!schedule || !isCustomSchedule(schedule)) return { ok: false, error: '非自定义类型档期' };
  const amount = Number(schedule.clientFlatAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: '缺少有效金额' };
  }

  const existing = findAutoIncomeForSchedule(schedule.id);
  if (existing?.status === INCOME_STATUS.PAID) {
    return { ok: true, income: existing, skipped: true };
  }
  if (!existing && hasIncomeForSchedule(schedule.id)) {
    return { ok: false, error: '该档期已有收入记录，请先删除后再重新录入' };
  }

  const name = schedule.projectName || schedule.clientName || getCustomTypeLabel(schedule.type);
  const patchBase = {
    scheduleId: schedule.id,
    date: schedule.date,
    incomeType: INCOME_TYPES.CUSTOM,
    customTypeId: schedule.type,
    clientName: name,
    ratePerMinute: null,
    durationSeconds: null,
    billedMinutes: null,
    finalPrice: amount,
    status: INCOME_STATUS.PENDING,
    source: INCOME_SOURCE.AUTO,
  };

  let income;
  if (existing) {
    const idx = appData.incomes.findIndex((i) => i.id === existing.id);
    income = normalizeIncome({ ...existing, ...patchBase, id: existing.id });
    if (idx !== -1) appData.incomes[idx] = income;
  } else {
    income = normalizeIncome(patchBase);
    appData.incomes.push(income);
  }

  updateScheduleInStore(schedule.id, {
    clientName: name,
    clientFlatAmount: amount,
    incomeGenerated: true,
  });

  return { ok: true, income };
}

function syncCustomFlatScheduleIncome(current) {
  if (!isCustomSchedule(current)) return { ok: true, skipped: true };
  const amount = Number(current.clientFlatAmount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: true, skipped: true };
  return upsertCustomFlatIncomeFromSchedule(current);
}

function createSocialIncomeFromSchedule(schedule) {
  if (!schedule || !isSocialSchedule(schedule)) return null;
  const amount = Number(schedule.socialAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (hasAutoIncomeForSchedule(schedule.id)) return findAutoIncomeForSchedule(schedule.id);

  const income = normalizeIncome({
    scheduleId: schedule.id,
    date: schedule.date,
    incomeType: INCOME_TYPES.SOCIAL,
    clientName: schedule.socialProject || schedule.projectName || '',
    finalPrice: amount,
    status: INCOME_STATUS.PAID,
    source: INCOME_SOURCE.AUTO,
  });

  appData.incomes.push(income);
  updateScheduleInStore(schedule.id, { incomeGenerated: true });
  return income;
}

function syncSocialScheduleIncome(previous, current) {
  if (!isSocialSchedule(current)) return;
  const amount = Number(current.socialAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    if (hasAutoIncomeForSchedule(current.id)) {
      removeAutoIncomesForSchedule(current.id);
      resetScheduleIncomeGenerated(current.id);
    }
    return;
  }

  const projectName = current.socialProject || current.projectName || '';
  const existing = findAutoIncomeForSchedule(current.id);
  if (existing) {
    const idx = appData.incomes.findIndex((i) => i.id === existing.id);
    if (idx !== -1) {
      appData.incomes[idx] = normalizeIncome({
        ...existing,
        date: current.date,
        clientName: projectName,
        finalPrice: amount,
        status: INCOME_STATUS.PAID,
      });
    }
    if (!current.incomeGenerated) {
      updateScheduleInStore(current.id, { incomeGenerated: true });
    }
    clearSiblingSocialAmounts(current);
    return;
  }

  if (!current.incomeGenerated) {
    createSocialIncomeFromSchedule(current);
  }
  clearSiblingSocialAmounts(current);
}

function handlePostScheduleSave(previous, current) {
  if (isSocialSchedule(current)) {
    syncSocialScheduleIncome(previous, current);
    return { ok: true };
  }

  if (isCustomSchedule(current)) {
    return syncCustomFlatScheduleIncome(current);
  }

  if (!isClientSchedule(current)) return { ok: true };

  if (getScheduleBillingMode(current) === CLIENT_BILLING.FLAT) {
    return syncClientFlatScheduleIncome(current);
  }
  return syncClientTimeScheduleIncome(current);
}

function formatDeliveryErrorMessage(parsed) {
  const dateLabel = parsed.date
    ? parsed.date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
    : null;
  const target = String(parsed.clientName || '').trim();
  const byName = appData.events.filter(
    (e) => isClientSchedule(e) && schedulesMatchClientName(e, target)
  );
  const byNameDate = parsed.date
    ? byName.filter((e) => scheduleMatchesDeliveryDate(e, parsed.date))
    : byName;

  if (byNameDate.length > 0) {
    const reviewing = byNameDate.filter((e) => getClientScheduleStatus(e) === '审核中');
    if (reviewing.length === 0) {
      const statuses = [...new Set(byNameDate.map((e) => getClientScheduleStatus(e)))].join('、');
      return dateLabel
        ? `找到「${target}」在${dateLabel}的档期，但状态为「${statuses}」，需先改为审核中后再录入收入。`
        : `找到「${target}」档期，但状态为「${statuses}」，需先改为审核中后再录入收入。`;
    }

    const blockedByIncome = reviewing.filter(
      (e) => e.incomeGenerated || hasIncomeForSchedule(e.id)
    );
    if (blockedByIncome.length === reviewing.length) {
      return `「${target}」在${dateLabel || '对应日期'}的审核中档期已生成收入，请勿重复确认。如需重新录入，请先删除对应收入记录。`;
    }
  }

  if (byName.length === 0) {
    return `未找到该客户「${target}」，请检查名称或手动补录收入。`;
  }

  if (dateLabel) {
    return `未找到「${target}」的可关联审核中档期（${dateLabel} 无匹配，且无其他审核中档期可回退），请检查状态或手动补录收入。`;
  }
  return `未找到「${target}」的可关联审核中档期，请确认已有审核中档期且尚未生成收入，或手动补录。`;
}

function openDeliveryPickModal(schedules) {
  return new Promise((resolve) => {
    const modal = $('#deliveryPickModal');
    const list = $('#deliveryPickList');
    if (!modal || !list) {
      resolve(schedules[0] || null);
      return;
    }

    list.innerHTML = schedules.map((s) => {
      const label = formatDeliveryPickLabel(s);
      return `<button type="button" class="delivery-pick__item" data-id="${s.id}">${escapeHtml(label)}</button>`;
    }).join('');

    deliveryPickResolver = resolve;
    modal.showModal();
  });
}

function closeDeliveryPickModal(result) {
  const modal = $('#deliveryPickModal');
  if (modal?.open) modal.close();
  if (deliveryPickResolver) {
    deliveryPickResolver(result);
    deliveryPickResolver = null;
  }
}

function initDeliveryPickModal() {
  const modal = $('#deliveryPickModal');
  const cancel = $('#btnCancelDeliveryPick');
  const close = $('#btnCloseDeliveryPick');
  const list = $('#deliveryPickList');
  if (!modal) return;

  cancel?.addEventListener('click', () => closeDeliveryPickModal(null));
  close?.addEventListener('click', () => closeDeliveryPickModal(null));
  list?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (!btn) return;
    const schedule = appData.events.find((ev) => ev.id === btn.dataset.id);
    closeDeliveryPickModal(schedule || null);
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeDeliveryPickModal(null);
  });
}

async function processDeliveryConfirmation(text) {
  const parsed = parseDeliveryText(text, currentViewDate);
  console.log('[delivery-match] 解析结果', parsed);
  if (!parsed.ok) return { ok: false, message: parsed.error };

  if (parsed.kind === 'social') {
    const result = await processSocialDeliveryConfirmation(parsed);
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, message: result.message, scheduleId: result.scheduleId };
  }

  const match = matchSchedulesForDelivery(parsed);
  if (match.type === 'none') {
    return { ok: false, message: formatDeliveryErrorMessage(parsed) };
  }

  let schedule;
  if (match.type === 'single' || match.type === 'fallback') {
    schedule = match.schedule;
  } else if (match.type === 'multiple') {
    schedule = await openDeliveryPickModal(match.schedules);
    if (!schedule) return { ok: false, message: '已取消选择' };
  }

  console.log('[delivery-match] ⑥ 用户确认选中', toDeliveryMatchLog(schedule));

  const result = createClientIncomeFromDelivery(schedule, {
    durationSeconds: parsed.durationSeconds,
    clientRecord: resolveClientForSchedule(schedule, parsed.clientName),
  });

  if (!result.ok) {
    return { ok: false, message: result.error };
  }

  saveData();
  refreshUI();
  return { ok: true, income: result.income, scheduleId: schedule.id };
}

const DELIVERY_CONFIRM_HINT_DEFAULT = '仅匹配审核中的客户档期';

function resetDeliveryConfirmHint() {
  const feedback = $('#deliveryConfirmFeedback');
  if (!feedback) return;
  feedback.textContent = DELIVERY_CONFIRM_HINT_DEFAULT;
  delete feedback.dataset.state;
}

function initDeliveryConfirmation() {
  const input = $('#deliveryConfirmInput');
  const btn = $('#btnDeliveryConfirm');
  const feedback = $('#deliveryConfirmFeedback');
  if (!input || !btn) return;

  resetDeliveryConfirmHint();

  const run = async () => {
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }
    btn.disabled = true;
    const result = await processDeliveryConfirmation(text);
    btn.disabled = false;
    if (feedback) {
      feedback.textContent = result.ok
        ? (result.message || '交付确认成功，收入已生成')
        : result.message;
      feedback.dataset.state = result.ok ? 'ok' : 'err';
    } else if (!result.ok) {
      alert(result.message);
    }
    if (result.ok) {
      input.value = '';
      renderIncomeView();
    }
  };

  btn.addEventListener('click', run);
  input.addEventListener('input', resetDeliveryConfirmHint);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      run();
    }
  });
}

function incomesInMonth(date) {
  const { start, end } = getMonthRange(date);
  return appData.incomes.filter((income) => {
    if (!income.date) return false;
    const [y, m, d] = income.date.split('-').map(Number);
    const incomeDate = new Date(y, m - 1, d);
    return incomeDate >= start && incomeDate <= end;
  });
}

function incomesInYear(date) {
  const y = date.getFullYear();
  const start = new Date(y, 0, 1);
  const end = new Date(y, 11, 31, 23, 59, 59, 999);
  return appData.incomes.filter((income) => {
    if (!income.date) return false;
    const [year, m, d] = income.date.split('-').map(Number);
    const incomeDate = new Date(year, m - 1, d);
    return incomeDate >= start && incomeDate <= end;
  });
}

function getIncomeSliceKey(income) {
  if (income.incomeType === INCOME_TYPES.CLIENT) return 'client';
  if (income.incomeType === INCOME_TYPES.SOCIAL) return 'social';
  if (income.incomeType === INCOME_TYPES.CUSTOM) {
    return `custom:${income.customTypeId || 'unknown'}`;
  }
  return 'other';
}

function getIncomeSliceMeta(key) {
  if (key === 'client') {
    return { label: getTypeLabel('client'), color: getTypeColor('client') };
  }
  if (key === 'social') {
    return { label: getTypeLabel('social'), color: getTypeColor('social') };
  }
  if (key.startsWith('custom:')) {
    const id = key.slice('custom:'.length);
    const t = findCustomTypeById(id);
    return {
      label: t?.label || '自定义',
      color: t?.color || CUSTOM_TYPE_COLORS[0],
    };
  }
  return { label: '其他', color: '#94a3b8' };
}

function getIncomeDistributionTotals(incomes) {
  const paid = incomes.filter((i) => i.status === INCOME_STATUS.PAID);
  const clientTotal = paid
    .filter((i) => i.incomeType === INCOME_TYPES.CLIENT)
    .reduce((sum, i) => sum + i.finalPrice, 0);
  const socialTotal = paid
    .filter((i) => i.incomeType === INCOME_TYPES.SOCIAL)
    .reduce((sum, i) => sum + i.finalPrice, 0);
  const customTotal = paid
    .filter((i) => i.incomeType === INCOME_TYPES.CUSTOM)
    .reduce((sum, i) => sum + i.finalPrice, 0);
  return { clientTotal, socialTotal, customTotal };
}

/** 饼图分片：预置 + 各自定义类型（仅已到账，与本月收入口径一致） */
function getIncomeDistributionSlices(incomes) {
  const totals = new Map();
  incomes.forEach((income) => {
    if (income.status !== INCOME_STATUS.PAID) return;
    const key = getIncomeSliceKey(income);
    totals.set(key, (totals.get(key) || 0) + (Number(income.finalPrice) || 0));
  });

  const order = ['client', 'social', ...getCustomEventTypes().map((t) => `custom:${t.id}`)];
  const slices = [];
  order.forEach((key) => {
    const total = totals.get(key) || 0;
    if (total <= 0) return;
    const meta = getIncomeSliceMeta(key);
    slices.push({ key, total, label: meta.label, color: meta.color });
    totals.delete(key);
  });
  totals.forEach((total, key) => {
    if (total <= 0) return;
    const meta = getIncomeSliceMeta(key);
    slices.push({ key, total, label: meta.label, color: meta.color });
  });
  return slices;
}

function getMonthIncomeTotal(date) {
  const { total } = getMonthPaidBreakdown(date);
  return total;
}

function getMonthPaidBreakdown(date) {
  const monthIncomes = incomesInMonth(date);
  const client = monthIncomes
    .filter((i) => i.incomeType === INCOME_TYPES.CLIENT && i.status === INCOME_STATUS.PAID)
    .reduce((sum, i) => sum + i.finalPrice, 0);
  const social = monthIncomes
    .filter((i) => i.incomeType === INCOME_TYPES.SOCIAL && i.status === INCOME_STATUS.PAID)
    .reduce((sum, i) => sum + i.finalPrice, 0);
  const custom = monthIncomes
    .filter((i) => i.incomeType === INCOME_TYPES.CUSTOM && i.status === INCOME_STATUS.PAID)
    .reduce((sum, i) => sum + i.finalPrice, 0);
  return { total: client + social + custom, client, social, custom };
}

function getYearPaidBreakdown(year) {
  let total = 0;
  let client = 0;
  let social = 0;
  let custom = 0;
  for (let month = 0; month < 12; month += 1) {
    const breakdown = getMonthPaidBreakdown(new Date(year, month, 1));
    total += breakdown.total;
    client += breakdown.client;
    social += breakdown.social;
    custom += breakdown.custom;
  }
  return { total, client, social, custom };
}

function getYearMonthlyArchive(year) {
  return Array.from({ length: 12 }, (_, monthIndex) => {
    const breakdown = getMonthPaidBreakdown(new Date(year, monthIndex, 1));
    return {
      month: monthIndex + 1,
      ...breakdown,
    };
  });
}

function getArchiveYears() {
  const currentYear = new Date().getFullYear();
  const years = new Set([currentYear]);
  appData.incomes.forEach((income) => {
    if (!income.date) return;
    const year = Number(income.date.slice(0, 4));
    if (!Number.isFinite(year) || year > currentYear) return;
    years.add(year);
  });
  return [...years].sort((a, b) => a - b);
}

function formatArchiveAmount(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return '--';
  return formatCurrency(amount);
}

function clampArchiveViewYear(year) {
  const years = getArchiveYears();
  if (!years.length) return new Date().getFullYear();
  if (years.includes(year)) return year;
  return years[years.length - 1];
}

function getCategory(id) {
  return appData.categories.find((c) => c.id === id) || appData.categories.at(-1);
}

function formatCurrency(amount) {
  return `¥${Number(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toLocalDatetimeValue(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function createDefaultEventTimes(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

function updateQuickAddDateHint() {
  const hint = $('#quickAddDateHint');
  if (!hint) return;
  const today = startOfDay(new Date());
  const sel = startOfDay(selectedDate);
  const label = sel.getTime() === today.getTime()
    ? '今天'
    : selectedDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  hint.textContent = `将添加到：${label}`;
}

function resolveMonthDay(month, day, refDate) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const year = refDate.getFullYear();
  let d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  if (startOfDay(d) < startOfDay(refDate)) {
    d = new Date(year + 1, month - 1, day);
  }
  return startOfDay(d);
}

/** 交付确认专用：取离参考日最近的同月日（避免「7月11日」在 7月12 日被推到明年） */
function resolveMonthDayForDelivery(month, day, refDate) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const ref = startOfDay(refDate);
  const year = ref.getFullYear();
  const candidates = [year - 1, year, year + 1]
    .map((y) => startOfDay(new Date(y, month - 1, day)))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (!candidates.length) return null;
  return candidates.sort((a, b) => Math.abs(a - ref) - Math.abs(b - ref))[0];
}

function resolveWeekday(char, refDate) {
  const weekdayMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };
  const target = weekdayMap[char];
  if (target === undefined) return null;
  const d = startOfDay(refDate);
  const current = d.getDay();
  let diff = target - current;
  if (diff < 0) diff += 7;
  d.setDate(d.getDate() + diff);
  return d;
}

const WORK_TYPES = ['剪辑', '脚本', '拍摄', '发布'];

const QUICK_ADD_RELATIVE_SCAN = [
  { pattern: /大后天/g, offset: 3 },
  { pattern: /后天/g, offset: 2 },
  { pattern: /明天/g, offset: 1 },
  { pattern: /今天/g, offset: 0 },
];

function removeDateTokens(text, matchedParts) {
  let cleaned = text;
  [...matchedParts]
    .sort((a, b) => b.length - a.length)
    .forEach((part) => {
      cleaned = cleaned.replace(part, '');
    });
  return cleaned;
}

function detectMediaStatus(raw) {
  if (/脚本|写/.test(raw)) return '脚本';
  if (/拍摄|拍/.test(raw)) return '拍摄';
  if (/剪辑|剪/.test(raw)) return '剪辑';
  if (/发布|发/.test(raw)) return '发布';
  return '剪辑';
}

function extractQuickAddDates(raw, today = startOfDay(new Date())) {
  let lastMonth = today.getMonth() + 1;
  const candidates = [];

  QUICK_ADD_RELATIVE_SCAN.forEach((rule) => {
    const re = new RegExp(rule.pattern.source, 'g');
    let m;
    while ((m = re.exec(raw)) !== null) {
      candidates.push({
        index: m.index,
        len: m[0].length,
        part: m[0],
        kind: 'relative',
        offset: rule.offset,
      });
    }
  });

  const monthDayRe = /(\d{1,2})\s*月\s*(\d{1,2})(?:\s*[日号])?/g;
  let m;
  while ((m = monthDayRe.exec(raw)) !== null) {
    candidates.push({
      index: m.index,
      len: m[0].length,
      part: m[0],
      kind: 'monthDay',
      month: parseInt(m[1], 10),
      day: parseInt(m[2], 10),
    });
  }

  const dayRe = /(\d{1,2})[日号]/g;
  while ((m = dayRe.exec(raw)) !== null) {
    candidates.push({
      index: m.index,
      len: m[0].length,
      part: m[0],
      kind: 'dayOnly',
      day: parseInt(m[1], 10),
    });
  }

  candidates.sort((a, b) => a.index - b.index || b.len - a.len);
  const selected = [];
  candidates.forEach((c) => {
    const end = c.index + c.len;
    const overlaps = selected.some((s) => c.index < s.index + s.len && end > s.index);
    if (!overlaps) selected.push(c);
  });
  selected.sort((a, b) => a.index - b.index);

  const dates = [];
  const matchedParts = [];
  selected.forEach((c) => {
    if (c.kind === 'relative') {
      const d = new Date(today);
      d.setDate(d.getDate() + c.offset);
      dates.push(startOfDay(d));
    } else if (c.kind === 'monthDay') {
      lastMonth = c.month;
      const d = resolveMonthDay(c.month, c.day, today);
      if (d) dates.push(d);
    } else {
      const d = resolveMonthDay(lastMonth, c.day, today);
      if (d) dates.push(d);
    }
    matchedParts.push(c.part);
  });

  return { dates, matchedParts };
}

function normalizeQuickAddName(text) {
  return String(text || '')
    .replace(/[：:]/g, ' ')
    .replace(/[、，,\s]+/g, ' ')
    .trim();
}

function removeKeywordOnce(text, keyword) {
  const src = String(text || '');
  const key = String(keyword || '');
  if (!key) return src;
  const idx = src.indexOf(key);
  if (idx === -1) return src;
  return `${src.slice(0, idx)}${src.slice(idx + key.length)}`;
}

function stripMediaStatusTokens(text, status) {
  let body = String(text || '');
  if (status === '脚本') body = body.replace(/脚本|写/g, '');
  else if (status === '拍摄') body = body.replace(/拍摄|拍/g, '');
  else if (status === '剪辑') body = body.replace(/剪辑|剪/g, '');
  else if (status === '发布') body = body.replace(/发布|发/g, '');
  return normalizeQuickAddName(body);
}

/** 在文本中找类型关键词；更长的优先（避免「大客户」被拆成「客户」） */
function resolveQuickAddTypeKeyword(remainder, compact) {
  const candidates = [];

  if (compact.includes('自媒体')) {
    candidates.push({ kind: 'social', key: '自媒体', compactKey: '自媒体', len: 3 });
  }
  if (compact.includes('客户')) {
    candidates.push({ kind: 'client', key: '客户', compactKey: '客户', len: 2 });
  }

  getCustomEventTypes().forEach((type) => {
    const label = String(type.label || '').trim();
    if (!label) return;
    const compactLabel = label.replace(/\s+/g, '');
    if (!compactLabel) return;
    if (compact.includes(compactLabel) || remainder.includes(label)) {
      candidates.push({
        kind: 'custom',
        type,
        key: label,
        compactKey: compactLabel,
        len: compactLabel.length,
      });
    }
  });

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.len - a.len || a.kind.localeCompare(b.kind));
  return candidates[0];
}

/**
 * 关键词识别（语序不限）：
 * - 客户 + 名称 + 日期（可多日期）
 * - 自媒体 + 项目 + 日期 + 状态
 * - 自定义类型名 + 项目 + 日期（可与项目紧贴；默认未完成）
 */
function parseEventText(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return { ok: false, error: '请输入档期内容' };
  }

  const today = startOfDay(new Date());
  const { dates, matchedParts } = extractQuickAddDates(raw, today);
  const remainder = normalizeQuickAddName(removeDateTokens(raw, matchedParts));
  const compact = remainder.replace(/\s+/g, '');
  const hit = resolveQuickAddTypeKeyword(remainder, compact);

  if (!hit) {
    return {
      ok: false,
      error: '无法识别类型关键词。请包含：客户 / 自媒体 / 自定义类型名，以及项目（或客户）名与日期',
    };
  }

  if (hit.kind === 'client') {
    let name = normalizeQuickAddName(removeKeywordOnce(remainder, hit.key));
    if (name === remainder) name = normalizeQuickAddName(removeKeywordOnce(compact, hit.compactKey));
    if (!name) {
      return { ok: false, error: '客户句式需包含客户名/ID。例如：客户张三 3月20日 / 张三客户明天' };
    }
    const clientName = name.replace(/\s+/g, '');
    return {
      ok: true,
      dates,
      type: '客户',
      customer: clientName,
      brand: null,
      title: clientName,
      status: '已排期',
    };
  }

  if (hit.kind === 'social') {
    let body = normalizeQuickAddName(removeKeywordOnce(remainder, hit.key));
    if (body === remainder) body = normalizeQuickAddName(removeKeywordOnce(compact, hit.compactKey));
    const status = detectMediaStatus(body) || detectMediaStatus(raw);
    body = stripMediaStatusTokens(body, status);
    if (!body) {
      return { ok: false, error: '自媒体句式需包含项目名。例如：自媒体品牌A 3月20日 剪辑 / 品牌A自媒体剪辑明天' };
    }
    const projectName = body.replace(/\s+/g, '');
    return {
      ok: true,
      dates,
      type: '自媒体',
      customer: null,
      brand: projectName,
      title: projectName,
      status,
    };
  }

  const label = hit.key;
  let body = normalizeQuickAddName(removeKeywordOnce(remainder, label));
  if (body === remainder) body = normalizeQuickAddName(removeKeywordOnce(compact, hit.compactKey));
  body = normalizeQuickAddName(body.replace(/未完成|已完成|✅/g, ''));
  if (!body) {
    return { ok: false, error: `自定义句式需包含项目名。例如：${label}项目A 3月20日 / 项目A${label}明天` };
  }
  const projectName = body.replace(/\s+/g, ' ').trim();
  return {
    ok: true,
    dates,
    type: hit.type.id,
    customer: null,
    brand: projectName,
    title: projectName,
    status: '未完成',
  };
}

function quickAddEvent() {
  const input = $('#quickAddInput');
  const rawText = input.value.trim();
  if (!rawText) {
    input.focus();
    return;
  }

  const parsed = parseEventText(rawText);
  if (!parsed.ok) {
    alert(parsed.error || '无法识别输入');
    input.focus();
    return;
  }

  const datesToUse = parsed.dates.length > 0 ? parsed.dates : [startOfDay(selectedDate)];
  let addedCount = 0;

  for (const eventDate of datesToUse) {
    try {
      const dateObj = startOfDay(eventDate);
      const viewYear = currentViewDate.getFullYear();
      const dateStr = dateObj.getMonth() === currentViewDate.getMonth()
        ? toDateString(new Date(viewYear, dateObj.getMonth(), dateObj.getDate()))
        : toDateString(dateObj);

      const event = normalizeEvent({
        id: crypto.randomUUID(),
        projectName: parsed.brand || '',
        client: parsed.customer || '',
        type: parsed.type,
        status: parsed.status,
        date: dateStr,
        income: 0,
        notes: '',
      });

      appData.events.push(event);
      handlePostScheduleSave(null, event);
      addedCount += 1;
    } catch (err) {
      console.warn('快速添加事件失败，已跳过:', eventDate, err);
    }
  }

  if (addedCount > 0) {
    saveData();
    refreshUI();
  }

  input.value = '';
  input.focus();
}

function eventsInYear(date) {
  const y = date.getFullYear();
  const start = new Date(y, 0, 1);
  const end = new Date(y, 11, 31, 23, 59, 59, 999);
  return appData.events.filter((e) => {
    const eventDate = getEventDate(e);
    return eventDate >= start && eventDate <= end;
  });
}

function countUniqueWorkDays(events) {
  const days = new Set();
  events.forEach((e) => days.add(toDateString(getEventDate(e))));
  return days.size;
}

function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getDaysInYear(date) {
  const y = date.getFullYear();
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
}

function createRingChart(canvasId, workDays, totalDays, existingChart) {
  const ctx = $(canvasId);
  if (!ctx) return existingChart;
  if (existingChart) existingChart.destroy();

  const idleDays = Math.max(totalDays - workDays, 0);
  const hasWork = workDays > 0;

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['工作', '空闲'],
      datasets: [{
        data: hasWork ? [workDays, idleDays] : [0, totalDays],
        backgroundColor: ['#6B7280', '#e2e8f0'],
        borderWidth: 2,
        borderColor: '#ffffff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      events: [],
    },
  });
}

function initIncomePeriodToggle() {
  if ($('#incomePeriodToolbar')) return;

  const header = document.querySelector('.panel--chart .panel__header');
  const toolbar = document.createElement('div');
  toolbar.id = 'incomePeriodToolbar';
  toolbar.className = 'chart-panel__toolbar';
  toolbar.innerHTML = `
    <div id="incomePeriodToggle" class="chart-panel__period-tabs chart-panel__btn-group">
      <button type="button" class="sidebar-toggle__btn sidebar-toggle__btn--active" id="incomePeriodMonth">月收入</button>
      <button type="button" class="sidebar-toggle__btn" id="incomePeriodYear">年收入</button>
    </div>
    <div class="chart-panel__archive-group chart-panel__btn-group">
      <button type="button" class="sidebar-toggle__btn chart-panel__archive-btn" id="btnIncomeArchive">📊 收入档案</button>
    </div>
  `;
  header.appendChild(toolbar);

  $('#incomePeriodMonth').addEventListener('click', () => {
    incomeChartPeriod = 'month';
    $('#incomePeriodMonth').classList.add('sidebar-toggle__btn--active');
    $('#incomePeriodYear').classList.remove('sidebar-toggle__btn--active');
    renderChart();
  });
  $('#incomePeriodYear').addEventListener('click', () => {
    incomeChartPeriod = 'year';
    $('#incomePeriodYear').classList.add('sidebar-toggle__btn--active');
    $('#incomePeriodMonth').classList.remove('sidebar-toggle__btn--active');
    renderChart();
  });
  $('#btnIncomeArchive')?.addEventListener('click', openIncomeArchiveModal);

  if (!document.getElementById('sidebarToggleStyle')) {
    const style = document.createElement('style');
    style.id = 'sidebarToggleStyle';
    style.textContent = `
      .sidebar-toggle__btn {
        padding: 0.25rem 0.625rem;
        font-size: 0.75rem;
        font-family: inherit;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: #888888;
        cursor: pointer;
      }
      .sidebar-toggle__btn--active {
        background: #d51b4f;
        border-color: #d51b4f;
        color: #ffffff;
      }
      .work-days-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
        padding: 1rem 1.25rem 1.25rem;
      }
      .work-days-card {
        text-align: center;
      }
      .work-days-card canvas {
        max-width: 120px;
        margin: 0 auto;
      }
      .work-days-card__label {
        margin: 0.5rem 0 0.25rem;
        font-size: 0.75rem;
        color: #64748b;
      }
      .work-days-card__value {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 600;
        color: #0f172a;
      }
    `;
    document.head.appendChild(style);
  }
}

const archiveTrendLabelPlugin = {
  id: 'archiveTrendLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const dataset = chart.data.datasets[0];
    const meta = chart.getDatasetMeta(0);
    if (!dataset || !meta) return;

    meta.data.forEach((point, index) => {
      const value = dataset.data[index];
      if (!Number.isFinite(value) || value <= 0) return;
      const { x, y } = point.getProps(['x', 'y'], true);
      const text = formatCurrency(value);
      const chartArea = chart.chartArea;
      const labelY = chartArea
        ? Math.min(y - 14, chartArea.bottom - 24)
        : y - 14;

      ctx.save();
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#111111';
      ctx.fillText(text, x, labelY);
      ctx.restore();
    });
  },
};

function renderIncomeArchiveTrendChart() {
  const canvas = $('#incomeArchiveTrendChart');
  if (!canvas) return;

  const years = getArchiveYears();
  const totals = years.map((year) => getYearPaidBreakdown(year).total);

  if (incomeArchiveTrendChart) {
    incomeArchiveTrendChart.destroy();
    incomeArchiveTrendChart = null;
  }

  incomeArchiveTrendChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: years.map((year) => `${year}`),
      datasets: [{
        data: totals,
        borderColor: getSettings().accent,
        backgroundColor: accentToSoft(getSettings().accent, 0.08),
        borderWidth: 2,
        pointBackgroundColor: getSettings().accent,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.25,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 24, bottom: 12 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `收入 ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          offset: years.length === 1,
          grid: { display: false },
          ticks: {
            padding: 4,
            font: { size: 11, weight: '600' },
            color: '#888888',
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            font: { size: 10 },
            color: '#888888',
            callback: (value) => {
              const n = Number(value);
              if (n >= 1000) return `¥${Math.round(n / 1000)}k`;
              return `¥${n}`;
            },
          },
          grid: { color: 'rgba(0, 0, 0, 0.06)' },
        },
      },
    },
    plugins: [archiveTrendLabelPlugin],
  });
}

function renderIncomeArchiveYearNav() {
  const years = getArchiveYears();
  const yearLabel = $('#incomeArchiveYearLabel');
  const prevBtn = $('#btnArchivePrevYear');
  const nextBtn = $('#btnArchiveNextYear');
  const currentIndex = years.indexOf(archiveViewYear);

  if (yearLabel) yearLabel.textContent = `${archiveViewYear}年`;
  if (prevBtn) prevBtn.disabled = currentIndex <= 0;
  if (nextBtn) nextBtn.disabled = currentIndex === -1 || currentIndex >= years.length - 1;
}

function getYearCustomTypePaidSlices(year) {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  const totals = new Map();

  appData.incomes.forEach((income) => {
    if (income.incomeType !== INCOME_TYPES.CUSTOM) return;
    if (income.status !== INCOME_STATUS.PAID) return;
    if (!income.date) return;
    const [y, m, d] = income.date.split('-').map(Number);
    const incomeDate = new Date(y, m - 1, d);
    if (incomeDate < start || incomeDate > end) return;
    const id = income.customTypeId || 'unknown';
    totals.set(id, (totals.get(id) || 0) + (Number(income.finalPrice) || 0));
  });

  const slices = [];
  getCustomEventTypes().forEach((type) => {
    const total = totals.get(type.id) || 0;
    if (total <= 0) return;
    slices.push({ id: type.id, label: type.label, total });
    totals.delete(type.id);
  });
  totals.forEach((total, id) => {
    if (total <= 0) return;
    slices.push({ id, label: '自定义', total });
  });
  return slices;
}

function renderIncomeArchiveMonths(year) {
  const grid = $('#incomeArchiveMonthGrid');
  const title = $('#incomeArchiveYearTitle');
  const summary = $('#incomeArchiveYearSummary');
  if (!grid) return;

  const months = getYearMonthlyArchive(year);
  const yearBreakdown = getYearPaidBreakdown(year);
  const customSlices = getYearCustomTypePaidSlices(year);
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const isCurrentYear = year === now.getFullYear();

  if (title) title.textContent = `${year}年各月收入`;

  grid.innerHTML = months.map((item) => {
    const label = `${item.month}月`;
    const valueText = formatArchiveAmount(item.total);
    const currentClass = isCurrentYear && item.month === currentMonth
      ? ' income-archive__month--current'
      : '';
    if (item.total > 0) {
      return `
        <button
          type="button"
          class="income-archive__month-btn${currentClass}"
          data-archive-month="${item.month}"
          aria-label="${label} ${valueText}${currentClass ? '（本月）' : ''}"
        >
          <span class="income-archive__month-label">${label}</span>
          <span class="income-archive__month-value">${valueText}</span>
        </button>
      `;
    }
    return `
      <div class="income-archive__month income-archive__month--empty${currentClass}" aria-label="${label} 无数据${currentClass ? '（本月）' : ''}">
        <span class="income-archive__month-label">${label}</span>
        <span class="income-archive__month-value">--</span>
      </div>
    `;
  }).join('');

  if (summary) {
    const customParts = customSlices.length > 0
      ? customSlices
        .map((s) => `<span class="income-archive__summary-item income-archive__summary-item--muted">${s.label} ${formatArchiveAmount(s.total)}</span>`)
        .join('')
      : (yearBreakdown.custom > 0
        ? `<span class="income-archive__summary-item income-archive__summary-item--muted">自定义 ${formatArchiveAmount(yearBreakdown.custom)}</span>`
        : '');
    summary.innerHTML = `
      <span class="income-archive__summary-item">合计：${formatArchiveAmount(yearBreakdown.total)}</span>
      <span class="income-archive__summary-item income-archive__summary-item--muted">客户 ${formatArchiveAmount(yearBreakdown.client)}</span>
      <span class="income-archive__summary-item income-archive__summary-item--muted">自媒体 ${formatArchiveAmount(yearBreakdown.social)}</span>
      ${customParts}
    `;
  }
}

function renderIncomeArchive() {
  archiveViewYear = clampArchiveViewYear(archiveViewYear);
  renderIncomeArchiveMonths(archiveViewYear);
  renderIncomeArchiveYearNav();
  renderIncomeArchiveTrendChart();
}

function openIncomeArchiveModal() {
  archiveViewYear = clampArchiveViewYear(currentViewDate.getFullYear());
  renderIncomeArchive();
  $('#incomeArchiveModal')?.showModal();
}

function closeIncomeArchiveModal() {
  if (incomeArchiveTrendChart) {
    incomeArchiveTrendChart.destroy();
    incomeArchiveTrendChart = null;
  }
  $('#incomeArchiveModal')?.close();
}

function shiftArchiveViewYear(delta) {
  const years = getArchiveYears();
  const currentIndex = years.indexOf(archiveViewYear);
  if (currentIndex === -1) return;
  const nextIndex = currentIndex + delta;
  if (nextIndex < 0 || nextIndex >= years.length) return;
  archiveViewYear = years[nextIndex];
  renderIncomeArchive();
}

function navigateToIncomeMonth(year, month) {
  currentViewDate = new Date(year, month - 1, 1);
  if (showIncomeViewPanel) showIncomeViewPanel();
  if (calendar) calendar.gotoDate(currentViewDate);
  renderStats();
  renderChart();
  renderWorkDays();
  renderIncomeView();
  closeIncomeArchiveModal();
}

function initIncomeArchiveModal() {
  const modal = $('#incomeArchiveModal');
  if (!modal) return;

  $('#btnCloseIncomeArchive')?.addEventListener('click', closeIncomeArchiveModal);
  $('#btnArchivePrevYear')?.addEventListener('click', () => shiftArchiveViewYear(-1));
  $('#btnArchiveNextYear')?.addEventListener('click', () => shiftArchiveViewYear(1));

  $('#incomeArchiveMonthGrid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-archive-month]');
    if (!btn) return;
    navigateToIncomeMonth(archiveViewYear, Number(btn.dataset.archiveMonth));
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeIncomeArchiveModal();
  });

  modal.addEventListener('close', () => {
    if (incomeArchiveTrendChart) {
      incomeArchiveTrendChart.destroy();
      incomeArchiveTrendChart = null;
    }
  });
}

function ensureWorkDaysPanel() {
  const panel = document.querySelector('.panel--list');
  if (!panel) return null;

  const title = panel.querySelector('.panel__title');
  if (title) title.textContent = '📅 工作天数';

  const header = panel.querySelector('.panel__header');
  if (header && !$('#workDaysPeriodLabel')) {
    const hint = document.createElement('p');
    hint.className = 'panel__hint';
    hint.id = 'workDaysPeriodLabel';
    hint.textContent = '—';
    header.appendChild(hint);
  }

  let container = $('#workDaysPanel');
  if (container) return container;

  const oldList = $('#upcomingList');
  container = document.createElement('div');
  container.id = 'workDaysPanel';
  container.className = 'work-days-grid';
  container.innerHTML = `
    <div class="work-days-card">
      <canvas id="workDaysMonthChart"></canvas>
      <p class="work-days-card__label">月工作天数</p>
      <p class="work-days-card__value" id="workDaysMonthValue">0 / 0 天</p>
    </div>
    <div class="work-days-card">
      <canvas id="workDaysYearChart"></canvas>
      <p class="work-days-card__label">年工作天数</p>
      <p class="work-days-card__value" id="workDaysYearValue">0 / 0 天</p>
    </div>
  `;
  if (oldList) oldList.replaceWith(container);
  else panel.appendChild(container);
  return container;
}

function getMonthRange(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  return {
    start: new Date(y, m, 1),
    end: new Date(y, m + 1, 0, 23, 59, 59, 999),
  };
}

function eventsInMonth(date) {
  const { start, end } = getMonthRange(date);
  return appData.events.filter((e) => {
    const eventDate = getEventDate(e);
    return eventDate >= start && eventDate <= end;
  });
}

function formatCalendarEventTitle(evt) {
  if (evt.type === '客户' || isCustomEventType(evt.type)) {
    return formatEventTitle(evt);
  }
  if (evt.type === '自媒体') {
    const name = evt.projectName || '';
    const status = MEDIA_STATUSES.includes(evt.status) ? evt.status : '剪辑';
    return name ? `${name}·${status}` : status;
  }
  return formatEventTitle(evt);
}

function eventToCalendarEvent(evt) {
  const color = getEventColor(evt.type, evt.status);
  const textColor = getEventTextColor(evt.type, evt.status);
  const classNames = [];
  if (evt.type === '自媒体') {
    classNames.push('fc-event--media');
    const status = MEDIA_STATUSES.includes(evt.status) ? evt.status : '剪辑';
    classNames.push(`fc-event--status-${status}`);
  }
  return {
    id: evt.id,
    title: formatCalendarEventTitle(evt),
    start: evt.date || toDateString(getEventDate(evt)),
    allDay: true,
    displayEventTime: false,
    backgroundColor: color,
    borderColor: color,
    textColor,
    classNames,
    extendedProps: { raw: evt },
  };
}

function syncEventFromCalendar(fcEvent) {
  const idx = appData.events.findIndex((e) => e.id === fcEvent.id);
  if (idx === -1) return;
  appData.events[idx].date = toDateString(fcEvent.start);
  saveData();
  refreshUI();
}

function updateSocialAmountFieldState() {
  const formType = $('#eventType')?.value;
  const isClient = formType === '客户';
  const socialAmountInput = $('#eventSocialAmount');
  const hint = $('#eventSocialAmountHint');
  if (!socialAmountInput || isClient) {
    if (hint) hint.hidden = true;
    return;
  }

  const projectName = $('#eventProjectName')?.value.trim();
  const scheduleDate = $('#eventDate')?.value;
  const scheduleId = $('#eventId')?.value || null;
  const archive = findSocialProjectArchiveForSchedule(projectName, scheduleDate, scheduleId);

  socialAmountInput.required = false;

  if (archive) {
    socialAmountInput.disabled = true;
    socialAmountInput.value = '';
    if (hint) {
      const parts = ['已归档于本月收入'];
      if (archive.amount != null) parts.push(formatCurrency(archive.amount));
      if (archive.schedule?.date) parts.push(archive.schedule.date);
      if (archive.schedule?.status) parts.push(archive.schedule.status);
      hint.textContent = parts.length > 1
        ? `${parts[0]}（${parts.slice(1).join(' · ')}）`
        : parts[0];
      hint.hidden = false;
    }
    return;
  }

  socialAmountInput.disabled = false;
  if (hint) hint.hidden = true;
}

function readDurationSecondsFromForm() {
  const minutes = Number($('#eventDurationMin')?.value);
  const seconds = Number($('#eventDurationSec')?.value);
  const minPart = Number.isFinite(minutes) && minutes > 0 ? Math.floor(minutes) : 0;
  const secPart = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const total = minPart * 60 + secPart;
  return total > 0 ? total : null;
}

function fillDurationFields(durationSeconds) {
  const minEl = $('#eventDurationMin');
  const secEl = $('#eventDurationSec');
  if (!minEl || !secEl) return;
  const total = Number(durationSeconds);
  if (!Number.isFinite(total) || total <= 0) {
    minEl.value = '';
    secEl.value = '';
    return;
  }
  minEl.value = String(Math.floor(total / 60));
  secEl.value = String(Math.floor(total % 60));
}

let eventFormClientBillingDraft = CLIENT_BILLING.FLAT;

function resolveClientFormBillingDraft(data = {}) {
  if (!isTimeBillingEnabled()) return CLIENT_BILLING.FLAT;
  if (data.clientBillingMode === CLIENT_BILLING.FLAT || data.clientBillingMode === CLIENT_BILLING.TIME) {
    return data.clientBillingMode;
  }
  return getScheduleBillingMode({
    type: '客户',
    incomeType: INCOME_TYPES.CLIENT,
    clientBillingMode: data.clientBillingMode,
    clientFlatAmount: data.clientFlatAmount,
    durationSeconds: data.durationSeconds,
  });
}

function syncEventClientBillingUI() {
  const formType = $('#eventType')?.value;
  const isClient = formType === '客户';
  const isCustom = isCustomEventType(formType);
  const toggleGroup = $('#eventClientBillingToggleGroup');
  const durationGroup = $('#eventDurationGroup');
  const clientAmountGroup = $('#eventClientAmountGroup');
  const switchBtn = $('#btnEventClientBillingSwitch');
  const billingHint = $('#eventClientBillingHint');
  const amountLabel = $('#eventClientFlatAmountLabel');
  const amountHint = $('#eventClientAmountGroup .event-form__hint');

  if (!isClient) {
    if (toggleGroup) toggleGroup.hidden = true;
    if (durationGroup) durationGroup.hidden = true;
    if (clientAmountGroup) clientAmountGroup.hidden = !isCustom;
    if (amountLabel) amountLabel.textContent = '金额（元）';
    if (amountHint) {
      amountHint.textContent = isCustom
        ? '可选：填写后保存将生成待收款明细；到账后档期变为已完成'
        : '填写金额并保存后进入待收款；在收入里标为已到账后计入收入，档期变为已交付';
    }
    return;
  }

  const timeEnabled = isTimeBillingEnabled();
  if (!timeEnabled) {
    eventFormClientBillingDraft = CLIENT_BILLING.FLAT;
    if (toggleGroup) toggleGroup.hidden = true;
    if (durationGroup) durationGroup.hidden = true;
    if (clientAmountGroup) clientAmountGroup.hidden = false;
    if (amountLabel) amountLabel.textContent = '金额（元）';
    if (amountHint) {
      amountHint.textContent = '填写金额并保存后进入待收款；在收入里标为已到账后计入收入，档期变为已交付';
    }
    return;
  }

  if (toggleGroup) toggleGroup.hidden = false;
  const useTime = eventFormClientBillingDraft === CLIENT_BILLING.TIME;
  if (durationGroup) durationGroup.hidden = !useTime;
  if (clientAmountGroup) clientAmountGroup.hidden = useTime;
  if (switchBtn) switchBtn.textContent = useTime ? '改为一口价' : '改回按时';
  if (billingHint) {
    billingHint.textContent = useTime
      ? '当前：按时计费（成片时长）'
      : '当前：一口价（本档单独按金额）';
  }
  if (amountLabel) amountLabel.textContent = '一口价金额（元）';
  if (amountHint) {
    amountHint.textContent = '填写金额并保存后进入待收款；在收入里标为已到账后计入收入，档期变为已交付';
  }
}

function toggleEventClientBillingMode() {
  if ($('#eventType')?.value !== '客户' || !isTimeBillingEnabled()) return;
  eventFormClientBillingDraft = eventFormClientBillingDraft === CLIENT_BILLING.TIME
    ? CLIENT_BILLING.FLAT
    : CLIENT_BILLING.TIME;
  if (eventFormClientBillingDraft === CLIENT_BILLING.FLAT) {
    fillDurationFields(null);
  } else {
    const amountEl = $('#eventClientFlatAmount');
    if (amountEl) amountEl.value = '';
  }
  syncEventClientBillingUI();
}

function updateEventFormForType(type) {
  const isClient = type === '客户';
  const isSocial = type === '自媒体';
  const isCustom = isCustomEventType(type);
  const clientGroup = $('#eventClient')?.closest('.form-group');
  const socialAmountGroup = $('#eventSocialAmountGroup');
  const incomeGroup = $('#eventIncomeGroup');
  const clientInput = $('#eventClient');
  const projectInput = $('#eventProjectName');

  if (clientGroup) clientGroup.hidden = !isClient;
  if (socialAmountGroup) socialAmountGroup.hidden = !isSocial;
  if (incomeGroup) incomeGroup.hidden = true;

  if (clientInput) clientInput.required = isClient;
  if (projectInput) {
    projectInput.required = isSocial || isCustom;
    projectInput.placeholder = isCustom ? '项目 / 事项名称' : '自媒体项目';
  }

  if (!isClient) {
    eventFormClientBillingDraft = CLIENT_BILLING.FLAT;
  } else if (!isTimeBillingEnabled()) {
    eventFormClientBillingDraft = CLIENT_BILLING.FLAT;
  }

  syncEventClientBillingUI();
  updateSocialAmountFieldState();
}

function formTypeValue(type) {
  if (type === '客户' || type === '自媒体') return type;
  if (isCustomEventType(type)) return type;
  return '自媒体';
}

function populateStatusSelect(type, selectedValue) {
  const select = $('#eventStatus');
  const options = getStatusesForEventType(type);
  select.innerHTML = options
    .map((s) => {
      const emoji = STATUS_EMOJIS[s] ? `${STATUS_EMOJIS[s]} ` : '';
      return `<option value="${s}">${emoji}${s}</option>`;
    })
    .join('');
  const fallback = getDefaultStatusForEventType(type);
  select.value = options.includes(selectedValue) ? selectedValue : fallback;
}

function populateTypeSelect(selectedValue) {
  const select = $('#eventType');
  if (!select) return;
  const options = getEventTypeOptions();
  select.innerHTML = options
    .map((t) => `<option value="${t.value}">${escapeHtml(t.label)}</option>`)
    .join('');
  if (selectedValue && options.some((o) => o.value === selectedValue)) {
    select.value = selectedValue;
  }
}

function populateIncomeFilterTypeOptions() {
  const select = $('#incomeFilterType');
  if (!select) return;
  const current = select.value || incomeFilterType || 'all';
  const options = [
    { value: 'all', label: '全部类型' },
    { value: 'client', label: getTypeLabel('client') },
    { value: 'social', label: getTypeLabel('social') },
    ...getCustomEventTypes().map((t) => ({ value: `custom:${t.id}`, label: t.label })),
  ];
  select.innerHTML = options
    .map((o) => `<option value="${o.value}">${escapeHtml(o.label)}</option>`)
    .join('');
  select.value = options.some((o) => o.value === current) ? current : 'all';
  incomeFilterType = select.value;
}

function openModal(data = {}) {
  const modal = $('#eventModal');
  const isEdit = Boolean(data.id);

  $('#modalTitle').textContent = isEdit ? '编辑档期' : '新建档期';
  $('#eventId').value = data.id || '';
  $('#eventProjectName').value = data.projectName || data.title || '';
  $('#eventClient').value = data.client || '';
  populateTypeSelect(formTypeValue(data.type));
  const formType = formTypeValue(data.type);
  $('#eventType').value = formType;
  populateStatusSelect(formType, data.status || getDefaultStatusForEventType(formType));
  eventFormClientBillingDraft = formType === '客户'
    ? resolveClientFormBillingDraft(data)
    : CLIENT_BILLING.FLAT;
  updateEventFormForType(formType);
  const socialAmount = data.socialAmount ?? (formType === '自媒体' ? data.income : null);
  $('#eventSocialAmount').value = socialAmount != null && socialAmount !== '' ? socialAmount : '';
  $('#eventClientFlatAmount').value = data.clientFlatAmount != null && data.clientFlatAmount !== ''
    ? data.clientFlatAmount
    : '';
  fillDurationFields(data.durationSeconds);
  $('#eventIncome').value = data.income ?? '';
  $('#eventNotes').value = data.notes || '';

  if (data.date) {
    $('#eventDate').value = typeof data.date === 'string' ? data.date.split('T')[0] : toDateInputValue(data.date);
  } else if (data.start) {
    $('#eventDate').value = toDateInputValue(new Date(data.start));
  } else {
    $('#eventDate').value = toDateString(selectedDate);
  }

  $('#btnDeleteEvent').hidden = !isEdit;
  updateSocialAmountFieldState();
  modal.showModal();
}

function closeModal() {
  $('#eventModal').close();
  $('#eventForm').reset();
}

function saveEventFromForm(e) {
  e.preventDefault();

  const id = $('#eventId').value;
  const formType = $('#eventType').value;
  const projectName = $('#eventProjectName').value.trim();
  const scheduleDate = $('#eventDate').value;
  const status = $('#eventStatus').value;
  let socialAmount = null;
  let durationSeconds = null;
  let clientFlatAmount = null;

  if (formType === '自媒体') {
    const archive = findSocialProjectArchiveForSchedule(projectName, scheduleDate, id || null);
    const rawAmount = $('#eventSocialAmount').value.trim();
    if (rawAmount !== '') {
      if (archive) {
        alert('已归档于本月收入');
        return;
      }
      socialAmount = parseFloat(rawAmount);
      if (!Number.isFinite(socialAmount) || socialAmount < 0) {
        alert('请填写有效的一口价金额');
        return;
      }
      if (socialAmount === 0) socialAmount = null;
    }
    if (archive && socialAmount != null) {
      alert('已归档于本月收入');
      return;
    }
  }

  const isCustom = isCustomEventType(formType);
  const clientUsesTime = formType === '客户'
    && isTimeBillingEnabled()
    && eventFormClientBillingDraft === CLIENT_BILLING.TIME;

  if (formType === '客户') {
    if (clientUsesTime) {
      durationSeconds = readDurationSecondsFromForm();
      if (status === '审核中' && !(durationSeconds > 0)) {
        alert('按时计费：状态为「审核中」时请填写成片时长');
        return;
      }
    } else {
      const rawFlat = $('#eventClientFlatAmount')?.value.trim() || '';
      if (rawFlat !== '') {
        clientFlatAmount = parseFloat(rawFlat);
        if (!Number.isFinite(clientFlatAmount) || clientFlatAmount < 0) {
          alert('请填写有效金额');
          return;
        }
        if (clientFlatAmount === 0) clientFlatAmount = null;
      }
    }
  } else if (isCustom) {
    const rawFlat = $('#eventClientFlatAmount')?.value.trim() || '';
    if (rawFlat !== '') {
      clientFlatAmount = parseFloat(rawFlat);
      if (!Number.isFinite(clientFlatAmount) || clientFlatAmount < 0) {
        alert('请填写有效金额');
        return;
      }
      if (clientFlatAmount === 0) clientFlatAmount = null;
    }
  }

  const previous = id ? appData.events.find((ev) => ev.id === id) || null : null;

  const payload = normalizeEvent({
    id: id || crypto.randomUUID(),
    projectName: $('#eventProjectName').value.trim(),
    client: $('#eventClient').value.trim(),
    type: formType,
    status,
    date: $('#eventDate').value,
    income: 0,
    socialAmount,
    durationSeconds: clientUsesTime
      ? (durationSeconds ?? previous?.durationSeconds ?? null)
      : null,
    clientFlatAmount: (formType === '客户' && !clientUsesTime) || isCustom
      ? clientFlatAmount
      : null,
    clientBillingMode: formType === '客户'
      ? (isTimeBillingEnabled()
        ? (clientUsesTime ? CLIENT_BILLING.TIME : CLIENT_BILLING.FLAT)
        : CLIENT_BILLING.FLAT)
      : null,
    clientId: previous?.clientId || null,
    incomeGenerated: previous?.incomeGenerated || false,
    notes: $('#eventNotes').value.trim(),
  });

  if (!payload.date) {
    alert('请选择日期');
    return;
  }

  if (payload.type === '客户' && !payload.client) {
    alert('客户类型请填写客户名称');
    return;
  }

  if ((payload.type === '自媒体' || isCustomEventType(payload.type)) && !payload.projectName) {
    alert('请填写项目名称');
    return;
  }

  if (id) {
    const idx = appData.events.findIndex((ev) => ev.id === id);
    if (idx !== -1) appData.events[idx] = payload;
  } else {
    appData.events.push(payload);
  }

  const postResult = handlePostScheduleSave(previous, payload);
  if (postResult && postResult.ok === false && postResult.error) {
    alert(postResult.error);
  }

  saveData();
  closeModal();
  refreshUI();
}

function deleteEvent() {
  const id = $('#eventId').value;
  if (!id || !confirm('确定删除这个档期吗？')) return;
  removeAutoIncomesForSchedule(id);
  appData.events = appData.events.filter((e) => e.id !== id);
  saveData();
  closeModal();
  refreshUI();
}

function formatEventDate(evt) {
  const d = getEventDate(evt);
  return d.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatIncomeMonthLabel(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return `${y}年${m}月`;
}

function formatIncomeDisplayDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function formatIncomeTypeLabel(incomeOrType, customTypeId) {
  if (incomeOrType && typeof incomeOrType === 'object') {
    return formatIncomeTypeLabel(incomeOrType.incomeType, incomeOrType.customTypeId);
  }
  if (incomeOrType === INCOME_TYPES.SOCIAL) return getTypeLabel('social');
  if (incomeOrType === INCOME_TYPES.CLIENT) return getTypeLabel('client');
  if (incomeOrType === INCOME_TYPES.CUSTOM) return getCustomTypeLabel(customTypeId);
  return '其他';
}

function formatDurationShort(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return '';
  const minutes = Math.floor(s / 60);
  const remainder = s % 60;
  if (minutes > 0 && remainder > 0) return `${minutes}分${remainder}秒`;
  if (minutes > 0) return `${minutes}分`;
  return `${remainder}秒`;
}

function buildIncomeRowMeta(income) {
  const parts = [];
  if (income.incomeType === INCOME_TYPES.CLIENT && income.durationSeconds) {
    parts.push(formatDurationShort(income.durationSeconds));
  }
  if (income.incomeType === INCOME_TYPES.CLIENT && income.billedMinutes) {
    parts.push(`${income.billedMinutes} 计费分钟`);
  }
  if (income.source === INCOME_SOURCE.MANUAL) {
    parts.push('手动补录');
  }
  return parts.join(' · ');
}

function sortIncomesForDisplay(incomes) {
  return [...incomes].sort((a, b) => {
    const dateCmp = (b.date || '').localeCompare(a.date || '');
    if (dateCmp !== 0) return dateCmp;
    return (b.finalPrice || 0) - (a.finalPrice || 0);
  });
}

function shiftCurrentViewMonth(delta) {
  const d = new Date(currentViewDate);
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  currentViewDate = d;
  if (calendar) {
    calendar.gotoDate(d);
  } else {
    renderStats();
    renderChart();
    renderWorkDays();
    renderIncomeView();
  }
}

function toggleIncomeStatus(incomeId) {
  const idx = appData.incomes.findIndex((i) => i.id === incomeId);
  if (idx === -1) return;
  const income = appData.incomes[idx];
  if (isSocialIncomeStatusLocked(income)) return;
  const wasPaid = income.status === INCOME_STATUS.PAID;
  const nextStatus = wasPaid ? INCOME_STATUS.PENDING : INCOME_STATUS.PAID;
  appData.incomes[idx] = normalizeIncome({ ...income, status: nextStatus });
  if (!wasPaid && nextStatus === INCOME_STATUS.PAID) {
    syncScheduleOnIncomePaid(appData.incomes[idx]);
  }
  saveData();
  refreshUI();
}

let incomeFilterType = 'all';
let incomeFilterStatus = 'all';
let incomeFilterQuery = '';

function getFilteredIncomesForView(anchor = currentViewDate) {
  const typeFilter = incomeFilterType;
  const statusFilter = incomeFilterStatus;
  const query = String(incomeFilterQuery || '').trim().toLowerCase();
  return sortIncomesForDisplay(incomesInMonth(anchor)).filter((income) => {
    if (typeFilter === 'client' && income.incomeType !== INCOME_TYPES.CLIENT) return false;
    if (typeFilter === 'social' && income.incomeType !== INCOME_TYPES.SOCIAL) return false;
    if (typeFilter.startsWith('custom:')) {
      const id = typeFilter.slice('custom:'.length);
      if (income.incomeType !== INCOME_TYPES.CUSTOM || income.customTypeId !== id) return false;
    }
    if (statusFilter === 'pending' && income.status !== INCOME_STATUS.PENDING) return false;
    if (statusFilter === 'paid' && income.status !== INCOME_STATUS.PAID) return false;
    if (query) {
      const name = String(income.clientName || '').toLowerCase();
      if (!name.includes(query)) return false;
    }
    return true;
  });
}

function updateIncomeFilterSubtotals(filteredIncomes) {
  const el = $('#incomeFilterSubtotals');
  if (!el) return;
  const pending = filteredIncomes
    .filter((i) => i.status === INCOME_STATUS.PENDING)
    .reduce((sum, i) => sum + (Number(i.finalPrice) || 0), 0);
  const paid = filteredIncomes
    .filter((i) => i.status === INCOME_STATUS.PAID)
    .reduce((sum, i) => sum + (Number(i.finalPrice) || 0), 0);
  el.textContent = `待收款 ${formatCurrency(pending)} · 已到账 ${formatCurrency(paid)}`;
}

function renderIncomeView() {
  const labelEl = $('#incomeMonthLabel');
  const body = $('#incomeTableBody');
  const empty = $('#incomeTableEmpty');
  if (!labelEl || !body) return;

  populateIncomeFilterTypeOptions();

  const anchor = currentViewDate;
  labelEl.textContent = formatIncomeMonthLabel(anchor);

  const monthIncomes = incomesInMonth(anchor);
  const rows = getFilteredIncomesForView(anchor);
  updateIncomeFilterSubtotals(rows);

  if (rows.length === 0) {
    body.innerHTML = '';
    if (empty) {
      empty.hidden = false;
      empty.textContent = monthIncomes.length === 0
        ? '本月暂无收入记录'
        : '没有符合筛选条件的记录';
    }
    return;
  }
  if (empty) empty.hidden = true;

  body.innerHTML = rows.map((income) => {
    const isSocial = isSocialIncomeStatusLocked(income);
    const isPaid = income.status === INCOME_STATUS.PAID;
    const statusClass = isPaid ? 'income-status-dot--paid' : 'income-status-dot--pending';
    const statusTitle = isSocial
      ? '已到账（自媒体平台自动结算）'
      : (isPaid ? '已到账，点击标为待收' : '待收款，点击标为已到账');
    const typeClass = income.incomeType === INCOME_TYPES.CLIENT
      ? 'income-type-badge--client'
      : (income.incomeType === INCOME_TYPES.CUSTOM ? 'income-type-badge--custom' : '');
    const typeLabel = formatIncomeTypeLabel(income);
    const meta = buildIncomeRowMeta(income);
    const name = income.clientName || '—';

    const statusCell = isSocial
      ? `<span class="income-status-dot ${statusClass} income-status-dot--locked" title="${statusTitle}" aria-label="${statusTitle}"></span>`
      : `<button
            type="button"
            class="income-status-dot ${statusClass}"
            data-income-id="${income.id}"
            title="${statusTitle}"
            aria-label="${statusTitle}"
          ></button>`;

    return `
      <tr class="income-table__row" data-income-row="${income.id}">
        <td>
          ${statusCell}
        </td>
        <td>${formatIncomeDisplayDate(income.date)}</td>
        <td>
          <span class="income-table__name">${escapeHtml(name)}</span>
          ${meta ? `<span class="income-table__meta">${escapeHtml(meta)}</span>` : ''}
        </td>
        <td><span class="income-type-badge ${typeClass}">${typeLabel}</span></td>
        <td class="income-table__col-amount">${formatCurrency(income.finalPrice)}</td>
        <td class="income-table__col-actions">
          <div class="income-table__actions">
            <button
              type="button"
              class="btn btn--ghost income-table__edit-btn"
              data-income-edit="${income.id}"
              title="编辑"
              aria-label="编辑"
            >✏️</button>
            ${canDeleteIncomeFromList(income)
    ? `<button type="button" class="btn btn--ghost income-table__edit-btn" data-income-delete="${income.id}" title="删除" aria-label="删除">🗑️</button>`
    : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function isClientNameTaken(name, excludeId = null) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return false;
  return appData.clients.some((c) => c.name === trimmed && c.id !== excludeId);
}

let editingClientId = null;

function validateClientInput(name, ratePerMinute, excludeId = null) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    return { ok: false, error: '请填写客户ID' };
  }
  if (!Number.isFinite(ratePerMinute) || ratePerMinute < 0) {
    return { ok: false, error: '请填写有效的单价' };
  }
  if (isClientNameTaken(trimmedName, excludeId)) {
    return { ok: false, error: '该客户ID已存在' };
  }
  return { ok: true, name: trimmedName, ratePerMinute };
}

function resetClientAddRow() {
  const nameInput = $('#clientAddName');
  const rateInput = $('#clientAddRate');
  if (nameInput) nameInput.value = '';
  if (rateInput) rateInput.value = '';
}

function renderClientRow(client) {
  if (editingClientId === client.id) {
    return `
      <tr class="client-table__row client-table__row--editing" data-client-id="${client.id}">
        <td>
          <input type="text" class="client-table__input" id="clientEditName" value="${escapeHtml(client.name)}" autocomplete="off">
        </td>
        <td>
          <input type="number" class="client-table__input" id="clientEditRate" min="0" step="0.01" value="${client.ratePerMinute}" autocomplete="off">
        </td>
        <td class="client-table__col-actions">
          <button type="button" class="client-table__icon-btn" data-client-save="${client.id}" aria-label="保存">✓</button>
          <button type="button" class="client-table__icon-btn" data-client-cancel-edit aria-label="取消">✕</button>
        </td>
      </tr>
    `;
  }

  return `
    <tr class="client-table__row" data-client-id="${client.id}">
      <td>${escapeHtml(client.name)}</td>
      <td>${formatCurrency(client.ratePerMinute)}</td>
      <td class="client-table__col-actions">
        <button type="button" class="client-table__icon-btn" data-client-edit="${client.id}" aria-label="编辑">✏️</button>
        <button type="button" class="client-table__icon-btn" data-client-delete="${client.id}" aria-label="删除">🗑️</button>
      </td>
    </tr>
  `;
}

function renderClientList() {
  const body = $('#clientTableBody');
  if (!body) return;

  const clients = [...appData.clients].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  body.innerHTML = clients.map((client) => renderClientRow(client)).join('');

  if (editingClientId) {
    $('#clientEditName')?.focus();
  }
}

function openClientModal() {
  editingClientId = null;
  renderClientList();
  resetClientAddRow();
  $('#clientModal')?.showModal();
}

function closeClientModal() {
  $('#clientModal')?.close();
  editingClientId = null;
  resetClientAddRow();
}

function startEditClient(clientId) {
  if (!findClientById(clientId)) return;
  editingClientId = clientId;
  renderClientList();
}

function cancelEditClient() {
  editingClientId = null;
  renderClientList();
}

function saveEditClient(clientId) {
  const validation = validateClientInput(
    $('#clientEditName')?.value,
    Number($('#clientEditRate')?.value),
    clientId,
  );
  if (!validation.ok) {
    alert(validation.error);
    return;
  }

  const idx = appData.clients.findIndex((c) => c.id === clientId);
  if (idx === -1) return;

  appData.clients[idx] = normalizeClient({
    id: clientId,
    name: validation.name,
    ratePerMinute: validation.ratePerMinute,
  });
  saveData();
  editingClientId = null;
  renderClientList();
}

function saveNewClientFromAddRow() {
  const validation = validateClientInput(
    $('#clientAddName')?.value,
    Number($('#clientAddRate')?.value),
  );
  if (!validation.ok) {
    alert(validation.error);
    return;
  }

  appData.clients.push(normalizeClient({
    id: crypto.randomUUID(),
    name: validation.name,
    ratePerMinute: validation.ratePerMinute,
  }));
  saveData();
  resetClientAddRow();
  renderClientList();
  $('#clientAddName')?.focus();
}

function deleteClientById(clientId) {
  const client = findClientById(clientId);
  if (!client) return;

  const usedInSchedules = appData.events.some(
    (evt) => isClientSchedule(evt)
      && ((evt.clientName || evt.client || '').trim() === client.name)
  );
  const message = usedInSchedules
    ? `确定删除客户「${client.name}」吗？已有档期仍保留该客户名快照。`
    : `确定删除客户「${client.name}」吗？`;

  if (!confirm(message)) return;

  appData.clients = appData.clients.filter((c) => c.id !== clientId);
  saveData();
  if (editingClientId === clientId) editingClientId = null;
  renderClientList();
}

function initClientModal() {
  const modal = $('#clientModal');
  if (!modal) return;

  $('#btnCloseClientModal')?.addEventListener('click', closeClientModal);
  $('#btnClientAddConfirm')?.addEventListener('click', saveNewClientFromAddRow);
  $('#btnClientAddCancel')?.addEventListener('click', resetClientAddRow);

  $('#clientTableBody')?.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('[data-client-save]');
    if (saveBtn) {
      saveEditClient(saveBtn.dataset.clientSave);
      return;
    }
    const cancelEditBtn = e.target.closest('[data-client-cancel-edit]');
    if (cancelEditBtn) {
      cancelEditClient();
      return;
    }
    const editBtn = e.target.closest('[data-client-edit]');
    if (editBtn) {
      startEditClient(editBtn.dataset.clientEdit);
      return;
    }
    const deleteBtn = e.target.closest('[data-client-delete]');
    if (deleteBtn) deleteClientById(deleteBtn.dataset.clientDelete);
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeClientModal();
  });
}

function populateManualIncomeTypeSelect(selectedValue) {
  const select = $('#manualIncomeType');
  if (!select) return;
  const current = selectedValue || select.value || INCOME_TYPES.CLIENT;
  const options = [
    { value: INCOME_TYPES.CLIENT, label: getTypeLabel('client') },
    { value: INCOME_TYPES.SOCIAL, label: getTypeLabel('social') },
    ...getCustomEventTypes().map((t) => ({ value: `custom:${t.id}`, label: t.label })),
  ];
  select.innerHTML = options
    .map((o) => `<option value="${o.value}">${escapeHtml(o.label)}</option>`)
    .join('');
  select.value = options.some((o) => o.value === current) ? current : INCOME_TYPES.CLIENT;
}

function updateManualIncomeTypeFields() {
  const type = $('#manualIncomeType')?.value;
  const isClient = type === INCOME_TYPES.CLIENT;
  const isSocial = type === INCOME_TYPES.SOCIAL;
  const isCustom = String(type || '').startsWith('custom:');
  const clientFields = $('#manualIncomeClientFields');
  const socialFields = $('#manualIncomeSocialFields');
  const statusGroup = $('#manualIncomeStatusGroup');
  if (clientFields) clientFields.hidden = !isClient;
  if (socialFields) socialFields.hidden = !(isSocial || isCustom);
  if (statusGroup) statusGroup.hidden = isSocial;
  if (isSocial) {
    $('#manualIncomeStatus').value = INCOME_STATUS.PAID;
  } else if (isCustom && !$('#manualIncomeStatus').value) {
    $('#manualIncomeStatus').value = INCOME_STATUS.PENDING;
  }
}

function setManualIncomeFormMode(mode) {
  const isAutoEdit = mode === 'auto';
  const isEdit = mode === 'edit' || isAutoEdit;

  $('#manualIncomeModalTitle').textContent = isAutoEdit
    ? '编辑收入'
    : (isEdit ? '编辑补录' : '手动补录');
  $('#manualIncomeAutoHint').hidden = !isAutoEdit;
  $('#manualIncomeDateGroup').hidden = isAutoEdit;
  $('#manualIncomeTypeGroup').hidden = isAutoEdit;
  $('#manualIncomePriceGroup').hidden = !isAutoEdit;
  $('#manualIncomeStatusGroup').hidden = false;
  $('#btnDeleteManualIncome').hidden = !isEdit || isAutoEdit;

  const typeSelect = $('#manualIncomeType');
  if (typeSelect) typeSelect.disabled = isAutoEdit;

  if (isAutoEdit) {
    $('#manualIncomeClientFields').hidden = true;
    $('#manualIncomeSocialFields').hidden = true;
  } else {
    updateManualIncomeTypeFields();
  }
}

function openManualIncomeModal(income = null, options = {}) {
  const modal = $('#manualIncomeModal');
  if (!modal) return;

  const mode = options.mode || (income ? 'edit' : 'create');
  const isAutoEdit = mode === 'auto' || income?.source === INCOME_SOURCE.AUTO;
  const actualMode = isAutoEdit ? 'auto' : (income ? 'edit' : 'create');

  $('#manualIncomeForm')?.reset();
  $('#manualIncomeId').value = income?.id || '';
  $('#manualIncomeSource').value = income?.source || INCOME_SOURCE.MANUAL;
  populateManualIncomeTypeSelect(
    income?.incomeType === INCOME_TYPES.CUSTOM && income.customTypeId
      ? `custom:${income.customTypeId}`
      : income?.incomeType,
  );

  if (actualMode === 'auto' && income) {
    setManualIncomeFormMode('auto');
    $('#manualIncomeFinalPrice').value = income.finalPrice;
    $('#manualIncomeStatus').value = income.status;
  } else if (income) {
    setManualIncomeFormMode('edit');
    $('#manualIncomeDate').value = income.date || toDateString(currentViewDate);
    $('#manualIncomeType').value = income.incomeType === INCOME_TYPES.CUSTOM && income.customTypeId
      ? `custom:${income.customTypeId}`
      : income.incomeType;
    $('#manualIncomeStatus').value = income.status;

    if (income.incomeType === INCOME_TYPES.CLIENT) {
      $('#manualIncomeClientName').value = income.clientName || '';
      $('#manualIncomeDuration').value = income.durationSeconds ?? '';
      $('#manualIncomeRate').value = income.ratePerMinute ?? '';
    } else {
      $('#manualIncomeProject').value = income.clientName || '';
      $('#manualIncomeAmount').value = income.finalPrice ?? '';
    }
    updateManualIncomeTypeFields();
  } else {
    setManualIncomeFormMode('create');
    $('#manualIncomeDate').value = toDateString(currentViewDate);
    $('#manualIncomeType').value = INCOME_TYPES.CLIENT;
    updateManualIncomeTypeFields();
    $('#manualIncomeStatus').value = INCOME_STATUS.PENDING;
  }

  modal.showModal();
}

function closeManualIncomeModal() {
  $('#manualIncomeModal')?.close();
  setManualIncomeFormMode('create');
}

function buildManualIncomePayload() {
  const source = $('#manualIncomeSource').value;
  const id = $('#manualIncomeId').value;
  const isAutoEdit = source === INCOME_SOURCE.AUTO && id;

  if (isAutoEdit) {
    const finalPrice = Number($('#manualIncomeFinalPrice').value);
    if (!Number.isFinite(finalPrice) || finalPrice < 0) {
      alert('请填写有效的金额');
      return null;
    }
    const existing = appData.incomes.find((i) => i.id === id);
    if (!existing) return null;
    return normalizeIncome({
      ...existing,
      finalPrice,
      status: $('#manualIncomeStatus').value,
    });
  }

  const date = $('#manualIncomeDate').value;
  if (!date) {
    alert('请选择日期');
    return null;
  }

  const incomeTypeRaw = $('#manualIncomeType').value;
  const isCustomManual = String(incomeTypeRaw || '').startsWith('custom:');
  const incomeType = isCustomManual
    ? INCOME_TYPES.CUSTOM
    : incomeTypeRaw;
  const status = incomeType === INCOME_TYPES.SOCIAL
    ? INCOME_STATUS.PAID
    : $('#manualIncomeStatus').value;

  if (incomeType === INCOME_TYPES.CLIENT) {
    const clientName = $('#manualIncomeClientName').value.trim();
    const durationSeconds = Number($('#manualIncomeDuration').value);
    const ratePerMinute = Number($('#manualIncomeRate').value);

    if (!clientName) {
      alert('请填写客户名');
      return null;
    }
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      alert('请填写有效的时长（秒）');
      return null;
    }
    if (!Number.isFinite(ratePerMinute) || ratePerMinute <= 0) {
      alert('请填写有效的单价');
      return null;
    }

    const billedMinutes = calculateBilledMinutes(durationSeconds);
    const finalPrice = calculateClientFinalPrice(durationSeconds, ratePerMinute);
    if (finalPrice <= 0) {
      alert('无法根据时长和单价计算金额');
      return null;
    }

    return normalizeIncome({
      id: id || crypto.randomUUID(),
      scheduleId: null,
      date,
      incomeType: INCOME_TYPES.CLIENT,
      clientName,
      ratePerMinute,
      durationSeconds,
      billedMinutes,
      finalPrice,
      status,
      source: INCOME_SOURCE.MANUAL,
    });
  }

  const projectName = $('#manualIncomeProject').value.trim();
  const finalPrice = Number($('#manualIncomeAmount').value);
  if (!projectName) {
    alert('请填写项目名');
    return null;
  }
  if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
    alert('请填写有效的金额');
    return null;
  }

  if (isCustomManual) {
    const customTypeId = incomeTypeRaw.slice('custom:'.length);
    if (!findCustomTypeById(customTypeId)) {
      alert('自定义类型不存在，请重新选择');
      return null;
    }
    return normalizeIncome({
      id: id || crypto.randomUUID(),
      scheduleId: null,
      date,
      incomeType: INCOME_TYPES.CUSTOM,
      customTypeId,
      clientName: projectName,
      finalPrice,
      status: status === INCOME_STATUS.PAID ? INCOME_STATUS.PAID : INCOME_STATUS.PENDING,
      source: INCOME_SOURCE.MANUAL,
    });
  }

  return normalizeIncome({
    id: id || crypto.randomUUID(),
    scheduleId: null,
    date,
    incomeType: INCOME_TYPES.SOCIAL,
    clientName: projectName,
    finalPrice,
    status,
    source: INCOME_SOURCE.MANUAL,
  });
}

function saveManualIncomeFromForm(e) {
  e.preventDefault();
  const payload = buildManualIncomePayload();
  if (!payload) return;

  const idx = appData.incomes.findIndex((i) => i.id === payload.id);
  if (idx !== -1) {
    appData.incomes[idx] = payload;
  } else {
    appData.incomes.push(payload);
  }

  saveData();
  closeManualIncomeModal();
  refreshUI();
}

function deleteManualIncomeById(incomeId) {
  deleteIncomeById(incomeId);
}

function openIncomeEditModal(incomeId) {
  const income = appData.incomes.find((i) => i.id === incomeId);
  const modal = $('#incomeEditModal');
  if (!income || !modal) return;

  const isClient = income.incomeType === INCOME_TYPES.CLIENT;
  const sourceLabel = income.source === INCOME_SOURCE.AUTO ? '自动生成' : '手动补录';
  const scheduleGroup = $('#incomeEditScheduleGroup');
  const scheduleInput = $('#incomeEditScheduleId');

  $('#incomeEditId').value = income.id;
  $('#incomeEditDate').value = income.date || '';
  $('#incomeEditName').value = income.clientName || '';
  $('#incomeEditFinalPrice').value = income.finalPrice;
  $('#incomeEditDuration').value = income.durationSeconds ?? '';
  $('#incomeEditStatus').value = income.status;
  $('#incomeEditDurationGroup').hidden = !isClient;
  $('#incomeEditNameLabel').textContent = isClient ? '客户名' : '项目名';
  $('#incomeEditTypeHint').textContent = `${formatIncomeTypeLabel(income)} · ${sourceLabel}`;
  const statusGroup = $('#incomeEditStatusGroup');
  if (statusGroup) statusGroup.hidden = !isClient;
  if (!isClient) {
    $('#incomeEditStatus').value = INCOME_STATUS.PAID;
  }

  if (scheduleGroup && scheduleInput) {
    if (income.scheduleId) {
      scheduleGroup.hidden = false;
      scheduleInput.value = income.scheduleId;
    } else {
      scheduleGroup.hidden = true;
      scheduleInput.value = '';
    }
  }

  modal.showModal();
}

function closeIncomeEditModal() {
  $('#incomeEditModal')?.close();
}

function saveIncomeEditFromForm(e) {
  e.preventDefault();

  const id = $('#incomeEditId').value;
  const existing = appData.incomes.find((i) => i.id === id);
  if (!existing) return;

  const date = $('#incomeEditDate').value;
  const clientName = $('#incomeEditName').value.trim();
  const finalPrice = Number($('#incomeEditFinalPrice').value);
  const status = existing.incomeType === INCOME_TYPES.SOCIAL
    ? INCOME_STATUS.PAID
    : $('#incomeEditStatus').value;

  if (!date) {
    alert('请选择日期');
    return;
  }
  if (!clientName) {
    alert('请填写名称');
    return;
  }
  if (!Number.isFinite(finalPrice) || finalPrice < 0) {
    alert('请填写有效的总价');
    return;
  }

  let durationSeconds = existing.durationSeconds;
  let billedMinutes = existing.billedMinutes;

  if (existing.incomeType === INCOME_TYPES.CLIENT) {
    const rawDuration = $('#incomeEditDuration').value;
    if (rawDuration === '' || rawDuration == null) {
      durationSeconds = null;
      billedMinutes = null;
    } else {
      const seconds = Number(rawDuration);
      if (!Number.isFinite(seconds) || seconds < 0) {
        alert('请填写有效的时长');
        return;
      }
      durationSeconds = seconds > 0 ? seconds : null;
      billedMinutes = seconds > 0 ? calculateBilledMinutes(seconds) : null;
    }
  }

  const idx = appData.incomes.findIndex((i) => i.id === id);
  const updated = normalizeIncome({
    ...existing,
    id: existing.id,
    scheduleId: existing.scheduleId,
    source: existing.source,
    incomeType: existing.incomeType,
    customTypeId: existing.customTypeId,
    ratePerMinute: existing.ratePerMinute,
    date,
    clientName,
    finalPrice,
    durationSeconds,
    billedMinutes,
    status,
  });
  appData.incomes[idx] = updated;
  if (existing.status !== INCOME_STATUS.PAID && status === INCOME_STATUS.PAID) {
    syncScheduleOnIncomePaid(updated);
  }

  saveData();
  closeIncomeEditModal();
  refreshUI();
}

function initIncomeEditModal() {
  const modal = $('#incomeEditModal');
  if (!modal) return;

  $('#btnCloseIncomeEdit')?.addEventListener('click', closeIncomeEditModal);
  $('#btnCancelIncomeEdit')?.addEventListener('click', closeIncomeEditModal);
  $('#incomeEditForm')?.addEventListener('submit', saveIncomeEditFromForm);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeIncomeEditModal();
  });
}

function deleteManualIncomeFromModal() {
  const id = $('#manualIncomeId').value;
  if (!id) return;
  deleteManualIncomeById(id);
}

function initManualIncomeModal() {
  const modal = $('#manualIncomeModal');
  if (!modal) return;

  $('#btnCloseManualIncomeModal')?.addEventListener('click', closeManualIncomeModal);
  $('#btnCancelManualIncome')?.addEventListener('click', closeManualIncomeModal);
  $('#btnDeleteManualIncome')?.addEventListener('click', deleteManualIncomeFromModal);
  $('#manualIncomeForm')?.addEventListener('submit', saveManualIncomeFromForm);
  $('#manualIncomeType')?.addEventListener('change', updateManualIncomeTypeFields);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeManualIncomeModal();
  });
}

function initIncomeToolbar() {
  $('#btnClientManage')?.addEventListener('click', openClientModal);
  $('#btnManualIncome')?.addEventListener('click', () => openManualIncomeModal());

  const typeEl = $('#incomeFilterType');
  const statusEl = $('#incomeFilterStatus');
  const searchEl = $('#incomeFilterSearch');
  if (typeEl) {
    typeEl.value = incomeFilterType;
    typeEl.addEventListener('change', () => {
      incomeFilterType = typeEl.value || 'all';
      renderIncomeView();
    });
  }
  if (statusEl) {
    statusEl.value = incomeFilterStatus;
    statusEl.addEventListener('change', () => {
      incomeFilterStatus = statusEl.value || 'all';
      renderIncomeView();
    });
  }
  if (searchEl) {
    searchEl.value = incomeFilterQuery;
    searchEl.addEventListener('input', () => {
      incomeFilterQuery = searchEl.value || '';
      renderIncomeView();
    });
  }
}

function initIncomeView() {
  $('#btnIncomePrevMonth')?.addEventListener('click', () => shiftCurrentViewMonth(-1));
  $('#btnIncomeNextMonth')?.addEventListener('click', () => shiftCurrentViewMonth(1));

  $('#incomeTableBody')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-income-edit]');
    if (editBtn) {
      openIncomeEditModal(editBtn.dataset.incomeEdit);
      return;
    }

    const deleteBtn = e.target.closest('[data-income-delete]');
    if (deleteBtn) {
      deleteIncomeById(deleteBtn.dataset.incomeDelete);
      return;
    }

    const statusBtn = e.target.closest('.income-status-dot[data-income-id]');
    if (statusBtn) toggleIncomeStatus(statusBtn.dataset.incomeId);
  });

  $('#incomeTableBody')?.addEventListener('dblclick', (e) => {
    if (e.target.closest('.income-status-dot, [data-income-delete], [data-income-edit]')) return;
    const row = e.target.closest('[data-income-row]');
    if (!row) return;
    openIncomeEditModal(row.dataset.incomeRow);
  });
}

function renderStats() {
  const monthEvents = eventsInMonth(currentViewDate);
  const trackable = monthEvents.filter((e) => isClientSchedule(e) || isCustomSchedule(e));
  const completed = trackable.filter((e) => isScheduleDelivered(e));
  const pending = trackable.filter((e) => !isScheduleDelivered(e));
  const income = getMonthIncomeTotal(currentViewDate);

  $('#statMonthIncome').textContent = formatCurrency(income);
  $('#statMonthEvents').textContent = monthEvents.length;
  $('#statCompleted').textContent = completed.length;
  $('#statPending').textContent = pending.length;
}

function renderChart() {
  const chartTitle = document.querySelector('.panel--chart .panel__title');
  if (chartTitle) chartTitle.textContent = '💰 收入分布';

  const isMonth = incomeChartPeriod === 'month';
  const periodIncomes = isMonth
    ? incomesInMonth(currentViewDate)
    : incomesInYear(currentViewDate);

  const y = currentViewDate.getFullYear();
  const m = currentViewDate.getMonth() + 1;
  $('#chartPeriodLabel').textContent = isMonth
    ? `${y} 年 ${m} 月 · 收入统计`
    : `${y} 年 · 收入统计`;

  const slices = getIncomeDistributionSlices(periodIncomes);
  const grandTotal = slices.reduce((sum, s) => sum + s.total, 0);
  const hasData = grandTotal > 0 && slices.length > 0;

  const labels = slices.map((s) => s.label);
  const values = slices.map((s) => s.total);
  const colors = slices.map((s) => s.color);

  if (!hasData) {
    labels.push('暂无收入数据');
    values.push(1);
    colors.push('#e2e8f0');
  }

  const ctx = $('#incomeChart');
  if (incomeChart) incomeChart.destroy();

  incomeChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#ffffff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: hasData,
          displayColors: false,
          caretSize: 0,
          caretPadding: 8,
          cornerRadius: 8,
          padding: { top: 8, right: 10, bottom: 8, left: 10 },
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          titleColor: '#111111',
          bodyColor: '#555555',
          borderColor: 'rgba(0, 0, 0, 0.08)',
          borderWidth: 1,
          titleFont: { size: 12, weight: '600' },
          bodyFont: { size: 12, weight: '500' },
          callbacks: {
            title(items) {
              return items[0]?.label || '';
            },
            label(ctx) {
              const value = Number(ctx.raw) || 0;
              const total = (ctx.dataset.data || []).reduce((sum, v) => sum + (Number(v) || 0), 0);
              const pct = total > 0 ? Math.round((value / total) * 100) : 0;
              return `${formatCurrency(value)}（${pct}%）`;
            },
          },
        },
      },
    },
  });

  const legendEl = $('#chartLegend');
  if (grandTotal <= 0 || slices.length === 0) {
    legendEl.innerHTML = '<span class="chart-legend__empty">暂无收入数据</span>';
  } else {
    legendEl.innerHTML = slices
      .map((item) => {
        const pct = Math.round((item.total / grandTotal) * 100);
        return `<span class="chart-legend__item">
            <span class="chart-legend__dot" style="background:${item.color}"></span>
            ${item.label} ${formatCurrency(item.total)} (${pct}%)
          </span>`;
      })
      .join('');
  }
}

function renderWorkDays() {
  ensureWorkDaysPanel();

  const y = currentViewDate.getFullYear();
  const m = currentViewDate.getMonth() + 1;
  const hintEl = $('#workDaysPeriodLabel');
  if (hintEl) hintEl.textContent = `${y} 年 ${m} 月 · 工时统计`;

  const monthEvents = eventsInMonth(currentViewDate);
  const yearEvents = eventsInYear(currentViewDate);
  const monthWorkDays = countUniqueWorkDays(monthEvents);
  const yearWorkDays = countUniqueWorkDays(yearEvents);
  const monthTotal = getDaysInMonth(currentViewDate);
  const yearTotal = getDaysInYear(currentViewDate);

  $('#workDaysMonthValue').textContent = `${monthWorkDays} / ${monthTotal} 天`;
  $('#workDaysYearValue').textContent = `${yearWorkDays} / ${yearTotal} 天`;

  workDaysMonthChart = createRingChart(
    '#workDaysMonthChart',
    monthWorkDays,
    monthTotal,
    workDaysMonthChart
  );
  workDaysYearChart = createRingChart(
    '#workDaysYearChart',
    yearWorkDays,
    yearTotal,
    workDaysYearChart
  );
}

function refreshUI() {
  if (calendar) calendar.refetchEvents();
  renderStats();
  renderChart();
  renderWorkDays();
  const incomeView = $('#incomeView');
  if (incomeView && !incomeView.hidden) {
    renderIncomeView();
  }
  const calendarWrap = $('#calendarWrap');
  if (calendarWrap && !calendarWrap.hidden && calendar) {
    requestAnimationFrame(() => {
      calendar.updateSize();
    });
  }
}

function getProfileInitial(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return '创';
  return trimmed.charAt(0).toUpperCase();
}

function renderProfile() {
  if (!appData.profile) {
    appData.profile = structuredClone(DEFAULT_DATA.profile);
  }
  const { name, avatar } = normalizeProfile(appData.profile);
  appData.profile = { name, avatar };

  const nameEl = $('#userName');
  const imgEl = $('#userAvatarImg');
  const initialEl = $('#userAvatarInitial');
  if (!nameEl || !imgEl || !initialEl) return;

  if (document.activeElement !== nameEl) {
    nameEl.textContent = name;
  }
  initialEl.textContent = getProfileInitial(name);

  if (avatar) {
    imgEl.src = avatar;
    imgEl.hidden = false;
    initialEl.hidden = true;
  } else {
    imgEl.removeAttribute('src');
    imgEl.hidden = true;
    initialEl.hidden = false;
  }
}

function saveProfileName() {
  const nameEl = $('#userName');
  if (!nameEl) return;
  const name = nameEl.textContent.replace(/\s+/g, ' ').trim() || DEFAULT_DATA.profile.name;
  appData.profile.name = name;
  nameEl.textContent = name;
  saveData();
  renderProfile();
}

function resizeAvatarDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 128;
      const scale = Math.min(max / img.width, max / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = dataUrl;
  });
}

async function handleAvatarFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('图片请小于 5MB');
    return;
  }

  const reader = new FileReader();
  const dataUrl = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('读取失败'));
    reader.readAsDataURL(file);
  });

  try {
    appData.profile.avatar = await resizeAvatarDataUrl(dataUrl);
    saveData();
    renderProfile();
  } catch {
    alert('头像处理失败，请换一张图片试试');
  }
}

function initProfile() {
  if (!appData.profile) {
    appData.profile = structuredClone(DEFAULT_DATA.profile);
  }
  renderProfile();

  const avatarBtn = $('#btnAvatar');
  const avatarInput = $('#avatarInput');
  const nameEl = $('#userName');

  avatarBtn?.addEventListener('click', () => avatarInput?.click());

  avatarInput?.addEventListener('change', () => {
    const file = avatarInput.files?.[0];
    if (file) handleAvatarFile(file);
    avatarInput.value = '';
  });

  nameEl?.addEventListener('blur', saveProfileName);

  nameEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nameEl.blur();
    }
  });

  nameEl?.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertText', false, text.replace(/\n/g, ' '));
  });
}

function refreshMonthViewCalendar() {
  if (!calendar) return;
  calendar.updateSize();
  calendar.refetchEvents();
}

function initViewToggle() {
  const monthBtn = $('#viewToggleMonth');
  const incomeBtn = $('#viewToggleIncome');
  const monthViewToggle = $('#viewToggle');
  const incomeViewToggleMonth = $('#incomeViewToggleMonth');
  const incomeViewToggleIncome = $('#incomeViewToggleIncome');
  const calendarWrap = $('#calendarWrap');
  const incomeView = $('#incomeView');
  const calendarContainer = document.querySelector('.calendar-container');
  const quickAddPanel = $('#quickAddPanel');

  function setToggleActive(isMonth) {
    monthBtn?.classList.toggle('view-toggle__btn--active', isMonth);
    incomeBtn?.classList.toggle('view-toggle__btn--active', !isMonth);
    incomeViewToggleMonth?.classList.toggle('view-toggle__btn--active', isMonth);
    incomeViewToggleIncome?.classList.toggle('view-toggle__btn--active', !isMonth);
  }

  function showMonthView() {
    calendarWrap.hidden = false;
    incomeView.hidden = true;
    if (quickAddPanel) quickAddPanel.hidden = false;
    if (monthViewToggle) monthViewToggle.hidden = false;
    calendarContainer?.classList.remove('calendar-container--income');
    setToggleActive(true);
    requestAnimationFrame(() => {
      refreshMonthViewCalendar();
      syncMainViewHeightNow();
      requestAnimationFrame(resizeSidebarCharts);
    });
  }

  function showIncomeView() {
    if (!calendarWrap.hidden) {
      const measured = readCalendarNaturalHeight(calendarWrap);
      if (measured > 0) {
        mainViewHeightByMonth.set(getMainViewMonthKey(), measured);
        applyMainViewHeight(measured);
      }
    } else {
      syncMainViewHeightNow();
    }

    calendarWrap.hidden = true;
    incomeView.hidden = false;
    if (quickAddPanel) quickAddPanel.hidden = true;
    if (monthViewToggle) monthViewToggle.hidden = true;
    calendarContainer?.classList.add('calendar-container--income');
    setToggleActive(false);
    requestAnimationFrame(() => {
      syncMainViewHeightNow();
      requestAnimationFrame(resizeSidebarCharts);
    });
  }

  syncMainViewHeight = syncMainViewHeightNow;

  monthBtn?.addEventListener('click', showMonthView);
  incomeBtn?.addEventListener('click', () => {
    showIncomeView();
    renderIncomeView();
  });
  incomeViewToggleMonth?.addEventListener('click', showMonthView);
  incomeViewToggleIncome?.addEventListener('click', () => {
    showIncomeView();
    renderIncomeView();
  });
  showIncomeViewPanel = showIncomeView;
  showMonthView();
}

function initCalendar() {
  const calendarEl = $('#calendar');

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'zh-cn',
    expandRows: false,
    fixedWeekCount: false,
    height: 'auto',
    displayEventTime: false,
    headerToolbar: {
      left: 'prev,next',
      center: 'title',
      right: '',
    },
    editable: true,
    eventStartEditable: true,
    eventDurationEditable: false,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: 3,
    events: (_info, success) => {
      const anchor = calendar?.view?.currentStart ?? currentViewDate;
      success(eventsInMonth(anchor).map(eventToCalendarEvent));
    },
    dateClick: (info) => {
      selectedDate = info.date;
      updateQuickAddDateHint();
    },
    select: (info) => {
      selectedDate = info.start;
      updateQuickAddDateHint();
      openModal({
        date: toDateString(info.start),
      });
    },
    eventClick: (info) => {
      openModal(info.event.extendedProps.raw);
    },
    eventDrop: (info) => syncEventFromCalendar(info.event),
    datesSet: (info) => {
      currentViewDate = info.view.currentStart;
      calendar.refetchEvents();
      renderStats();
      renderChart();
      renderWorkDays();
      const incomeView = $('#incomeView');
      if (incomeView && !incomeView.hidden) renderIncomeView();
      requestAnimationFrame(() => {
        syncMainViewHeightNow();
      });
    },
  });

  calendar.render();
  requestAnimationFrame(() => {
    syncMainViewHeightNow();
  });
}

function seedDemoData() {
  if (appData.events.length > 0) return;

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  appData.events = [
    normalizeEvent({
      id: crypto.randomUUID(),
      projectName: '西号',
      client: '星火科技',
      type: '剪辑',
      date: toDateString(new Date(y, m, 8)),
      income: 12000,
      status: '已交付',
      notes: '已交付源文件',
    }),
    normalizeEvent({
      id: crypto.randomUUID(),
      projectName: '东号',
      client: '云端工作室',
      type: '拍摄',
      date: toDateString(new Date(y, m, 15)),
      income: 25000,
      status: '已排期',
      notes: '外景拍摄',
    }),
    normalizeEvent({
      id: crypto.randomUUID(),
      projectName: '',
      client: '张三',
      type: '客户',
      date: toDateString(new Date(y, m, 22)),
      income: 0,
      status: '已排期',
      notes: '',
    }),
  ];
  saveData();
}

function getSelectedTimeBillingSchemeFromForm() {
  if ($('#settingsBillingCustom')?.checked) return TIME_BILLING_SCHEMES.REMAINDER_TIERS;
  return TIME_BILLING_SCHEMES.REMAINDER_LADDER;
}

function syncSettingsTimeBillingEnabledVisibility() {
  const enabled = Boolean($('#settingsTimeBillingEnabled')?.checked);
  const details = $('#settingsTimeBillingDetails');
  if (details) details.hidden = !enabled;
  if (enabled) syncSettingsTimeBillingSchemeVisibility();
}

function syncSettingsTimeBillingSchemeVisibility() {
  const scheme = getSelectedTimeBillingSchemeFromForm();
  const tiers = $('#settingsTimeBillingTierFields');
  if (tiers) tiers.hidden = scheme !== TIME_BILLING_SCHEMES.REMAINDER_TIERS;
}

function fillSettingsTimeBillingForm(
  rule = getSettings().timeBilling,
  enabled = isTimeBillingEnabled(),
) {
  const enabledEl = $('#settingsTimeBillingEnabled');
  if (enabledEl) enabledEl.checked = Boolean(enabled);

  const scheme = rule.scheme === TIME_BILLING_SCHEMES.REMAINDER_TIERS
    ? TIME_BILLING_SCHEMES.REMAINDER_TIERS
    : TIME_BILLING_SCHEMES.REMAINDER_LADDER;
  const defaultRadio = $('#settingsBillingDefault');
  const customRadio = $('#settingsBillingCustom');
  if (defaultRadio && customRadio) {
    defaultRadio.checked = scheme === TIME_BILLING_SCHEMES.REMAINDER_LADDER;
    customRadio.checked = scheme === TIME_BILLING_SCHEMES.REMAINDER_TIERS;
  }

  const t1Over = $('#settingsBillingTier1Over');
  const t2Over = $('#settingsBillingTier2Over');
  if (t1Over) t1Over.value = String(rule.tier1OverSeconds ?? 10);
  if (t2Over) t2Over.value = String(rule.tier2OverSeconds ?? 30);

  syncSettingsTimeBillingEnabledVisibility();
}

function readTimeBillingFromForm() {
  const timeBillingEnabled = Boolean($('#settingsTimeBillingEnabled')?.checked);
  const scheme = getSelectedTimeBillingSchemeFromForm();
  const base = { ...DEFAULT_SETTINGS.timeBilling, scheme };

  if (!timeBillingEnabled || scheme === TIME_BILLING_SCHEMES.REMAINDER_LADDER) {
    return {
      ok: true,
      timeBillingEnabled,
      timeBilling: normalizeTimeBilling(
        timeBillingEnabled ? base : getSettings().timeBilling,
      ),
    };
  }

  const tier1OverSeconds = Number($('#settingsBillingTier1Over')?.value);
  const tier2OverSeconds = Number($('#settingsBillingTier2Over')?.value);
  if (!Number.isFinite(tier1OverSeconds) || tier1OverSeconds < 1 || tier1OverSeconds > 58) {
    return { ok: false, error: '请填写第一档「满多少秒」（1–58）' };
  }
  if (!Number.isFinite(tier2OverSeconds) || tier2OverSeconds < 2 || tier2OverSeconds > 59) {
    return { ok: false, error: '请填写第二档「满多少秒」（2–59）' };
  }
  if (tier2OverSeconds <= tier1OverSeconds) {
    return { ok: false, error: '第二档秒数必须大于第一档' };
  }

  return {
    ok: true,
    timeBillingEnabled,
    timeBilling: normalizeTimeBilling({
      ...base,
      tier1OverSeconds: Math.floor(tier1OverSeconds),
      tier2OverSeconds: Math.floor(tier2OverSeconds),
    }),
  };
}

let settingsCustomTypesDraft = [];

function isCustomTypeInUse(typeId) {
  if (!typeId) return false;
  const usedByEvent = appData.events.some((e) => e.type === typeId);
  const usedByIncome = appData.incomes.some(
    (i) => i.incomeType === INCOME_TYPES.CUSTOM && i.customTypeId === typeId,
  );
  return usedByEvent || usedByIncome;
}

function renderSettingsCustomTypesList() {
  const list = $('#settingsCustomTypesList');
  const hint = $('#settingsCustomTypesHint');
  if (!list) return;

  if (settingsCustomTypesDraft.length === 0) {
    list.innerHTML = '';
    if (hint) {
      hint.hidden = false;
      hint.textContent = '尚未添加自定义类型';
    }
    return;
  }
  if (hint) hint.hidden = true;

  list.innerHTML = settingsCustomTypesDraft.map((t, index) => `
    <div class="settings-custom-type-row" data-custom-type-id="${t.id}">
      <input
        type="text"
        class="settings-custom-type-row__name"
        value="${escapeHtml(t.label)}"
        maxlength="20"
        aria-label="类型名称"
        data-custom-type-name
      >
      <input type="color" class="settings-color" value="${t.color}" aria-label="类型颜色" data-custom-type-color>
      <span class="settings-color-hex">${t.color}</span>
      <button type="button" class="btn btn--ghost settings-custom-type-row__delete" data-custom-type-delete="${t.id}" title="删除" aria-label="删除">−</button>
      <span class="settings-locked">未完成 / ✅已完成</span>
    </div>
  `).join('');
}

function syncCustomTypesDraftFromDom() {
  const list = $('#settingsCustomTypesList');
  if (!list) return settingsCustomTypesDraft;
  settingsCustomTypesDraft = [...list.querySelectorAll('[data-custom-type-id]')].map((row, index) => {
    const id = row.dataset.customTypeId;
    const label = row.querySelector('[data-custom-type-name]')?.value;
    const color = row.querySelector('[data-custom-type-color]')?.value;
    return normalizeCustomEventType({ id, label, color }, index);
  });
  return settingsCustomTypesDraft;
}

function addCustomTypeToDraft() {
  syncCustomTypesDraftFromDom();
  if (2 + settingsCustomTypesDraft.length >= MAX_EVENT_TYPES) {
    alert(`最多 ${MAX_EVENT_TYPES} 个事件类型（含客户剪辑、自媒体）`);
    return;
  }
  const index = settingsCustomTypesDraft.length;
  settingsCustomTypesDraft.push(normalizeCustomEventType({
    id: crypto.randomUUID(),
    label: `新类型${index + 1}`,
    color: CUSTOM_TYPE_COLORS[index % CUSTOM_TYPE_COLORS.length],
  }, index));
  renderSettingsCustomTypesList();
}

function removeCustomTypeFromDraft(typeId) {
  if (isCustomTypeInUse(typeId)) {
    alert('该类型已有关联档期或收入，请先删除或改类型后再删此类型');
    return;
  }
  syncCustomTypesDraftFromDom();
  settingsCustomTypesDraft = settingsCustomTypesDraft.filter((t) => t.id !== typeId);
  renderSettingsCustomTypesList();
}

function fillSettingsForm() {
  const s = getSettings();
  const accentEl = $('#settingsAccent');
  const clientEl = $('#settingsClientColor');
  const socialEl = $('#settingsSocialColor');
  if (accentEl) accentEl.value = s.accent;
  if (clientEl) clientEl.value = s.eventTypes.client.color;
  if (socialEl) socialEl.value = s.eventTypes.social.color;
  const accentHex = $('#settingsAccentHex');
  const clientHex = $('#settingsClientColorHex');
  const socialHex = $('#settingsSocialColorHex');
  if (accentHex) accentHex.textContent = s.accent;
  if (clientHex) clientHex.textContent = s.eventTypes.client.color;
  if (socialHex) socialHex.textContent = s.eventTypes.social.color;
  fillSettingsTimeBillingForm(s.timeBilling, s.timeBillingEnabled);
  settingsCustomTypesDraft = normalizeCustomEventTypes(s.customEventTypes);
  renderSettingsCustomTypesList();
}

function syncSettingsColorLabels() {
  const accentEl = $('#settingsAccent');
  const clientEl = $('#settingsClientColor');
  const socialEl = $('#settingsSocialColor');
  const accentHex = $('#settingsAccentHex');
  const clientHex = $('#settingsClientColorHex');
  const socialHex = $('#settingsSocialColorHex');
  if (accentEl && accentHex) accentHex.textContent = accentEl.value;
  if (clientEl && clientHex) clientHex.textContent = clientEl.value;
  if (socialEl && socialHex) socialHex.textContent = socialEl.value;
}

function showSettingsPanel(panelId) {
  const id = panelId || 'theme';
  $$('#settingsNav [data-settings-panel]').forEach((btn) => {
    const active = btn.dataset.settingsPanel === id;
    btn.classList.toggle('settings-nav__item--active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  $$('.settings-panel[data-settings-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.settingsPanel !== id;
  });
}

function openSettingsModal() {
  fillSettingsForm();
  showSettingsPanel('theme');
  $('#settingsModal')?.showModal();
}

function closeSettingsModal() {
  $('#settingsModal')?.close();
}

function saveSettingsFromForm() {
  const accent = normalizeHexColor($('#settingsAccent')?.value, DEFAULT_SETTINGS.accent);
  const clientColor = normalizeHexColor(
    $('#settingsClientColor')?.value,
    DEFAULT_SETTINGS.eventTypes.client.color,
  );
  const socialColor = normalizeHexColor(
    $('#settingsSocialColor')?.value,
    DEFAULT_SETTINGS.eventTypes.social.color,
  );
  const billingResult = readTimeBillingFromForm();
  if (!billingResult.ok) {
    alert(billingResult.error);
    return;
  }

  const customEventTypes = syncCustomTypesDraftFromDom();
  const emptyName = customEventTypes.find((t) => !String(t.label || '').trim());
  if (emptyName) {
    alert('自定义类型名称不能为空');
    return;
  }

  appData.settings = normalizeSettings({
    accent,
    timeBillingEnabled: billingResult.timeBillingEnabled,
    timeBilling: billingResult.timeBilling,
    eventTypes: {
      client: { label: '客户剪辑', color: clientColor },
      social: { label: '自媒体', color: socialColor },
    },
    customEventTypes,
  });
  saveData();
  applyThemeFromSettings();
  populateTypeSelect();
  populateIncomeFilterTypeOptions();
  populateManualIncomeTypeSelect();
  renderChart();
  if (calendar) calendar.refetchEvents();
  const archiveOpen = $('#incomeArchiveModal')?.open;
  if (archiveOpen) renderIncomeArchive();
  closeSettingsModal();
}

function initSettingsModal() {
  $('#btnOpenSettings')?.addEventListener('click', openSettingsModal);
  $('#btnCloseSettings')?.addEventListener('click', closeSettingsModal);
  $('#btnCancelSettings')?.addEventListener('click', closeSettingsModal);
  $('#settingsNav')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-settings-panel]');
    if (!btn) return;
    showSettingsPanel(btn.dataset.settingsPanel);
  });
  $('#btnResetSettings')?.addEventListener('click', () => {
    const d = DEFAULT_SETTINGS;
    const accentEl = $('#settingsAccent');
    const clientEl = $('#settingsClientColor');
    const socialEl = $('#settingsSocialColor');
    if (accentEl) accentEl.value = d.accent;
    if (clientEl) clientEl.value = d.eventTypes.client.color;
    if (socialEl) socialEl.value = d.eventTypes.social.color;
    fillSettingsTimeBillingForm(d.timeBilling, d.timeBillingEnabled);
    settingsCustomTypesDraft = [];
    renderSettingsCustomTypesList();
    syncSettingsColorLabels();
  });
  ['settingsAccent', 'settingsClientColor', 'settingsSocialColor'].forEach((id) => {
    $(`#${id}`)?.addEventListener('input', syncSettingsColorLabels);
  });
  $('#settingsTimeBillingEnabled')?.addEventListener('change', syncSettingsTimeBillingEnabledVisibility);
  ['settingsBillingDefault', 'settingsBillingCustom'].forEach((id) => {
    $(`#${id}`)?.addEventListener('change', syncSettingsTimeBillingSchemeVisibility);
  });
  $('#btnAddCustomType')?.addEventListener('click', addCustomTypeToDraft);
  $('#settingsCustomTypesList')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-custom-type-delete]');
    if (!btn) return;
    removeCustomTypeFromDraft(btn.dataset.customTypeDelete);
  });
  $('#settingsCustomTypesList')?.addEventListener('input', (e) => {
    const colorInput = e.target.closest('[data-custom-type-color]');
    if (colorInput) {
      const hex = colorInput.parentElement?.querySelector('.settings-color-hex');
      if (hex) hex.textContent = colorInput.value;
    }
  });
  $('#settingsForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettingsFromForm();
  });
  $('#settingsModal')?.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeSettingsModal();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  populateTypeSelect();
  populateStatusSelect('自媒体', '剪辑');
  updateEventFormForType('自媒体');
  populateManualIncomeTypeSelect();
  populateIncomeFilterTypeOptions();
  seedDemoData();
  applyThemeFromSettings();
  initSettingsModal();
  initCalendar();
  initViewToggle();
  initIncomeView();
  initIncomeToolbar();
  initClientModal();
  initManualIncomeModal();
  initIncomeEditModal();
  initIncomePeriodToggle();
  initIncomeArchiveModal();
  initProfile();
  refreshUI();

  updateQuickAddDateHint();

  $('#btnQuickAdd').addEventListener('click', quickAddEvent);
  $('#quickAddInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      quickAddEvent();
    }
  });
  $('#btnCloseModal').addEventListener('click', closeModal);
  $('#btnCancelModal').addEventListener('click', closeModal);
  $('#btnDeleteEvent').addEventListener('click', deleteEvent);
  $('#eventForm').addEventListener('submit', saveEventFromForm);
  $('#eventType').addEventListener('change', () => {
    const type = $('#eventType').value;
    populateStatusSelect(type, null);
    if (type === '客户' && isTimeBillingEnabled()) {
      eventFormClientBillingDraft = CLIENT_BILLING.TIME;
    } else {
      eventFormClientBillingDraft = CLIENT_BILLING.FLAT;
    }
    updateEventFormForType(type);
  });
  $('#btnEventClientBillingSwitch')?.addEventListener('click', toggleEventClientBillingMode);
  $('#eventStatus')?.addEventListener('change', () => {
    updateEventFormForType($('#eventType').value);
  });
  $('#eventProjectName')?.addEventListener('input', updateSocialAmountFieldState);
  $('#eventDate')?.addEventListener('change', updateSocialAmountFieldState);

  $('#eventModal').addEventListener('click', (e) => {
    if (e.target === $('#eventModal')) closeModal();
  });

  window.backupAndResetIncomeData = backupAndResetIncomeData;
});
