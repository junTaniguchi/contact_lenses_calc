const LENS_DURATION_DAYS = 14;
const START_DATE_KEY = 'CONTACT_LENS_START_DATE_ISO';
const REPLACEMENT_DATE_KEY = 'CONTACT_LENS_REPLACEMENT_DATE_ISO';
const EVENT_ID_KEY = 'CONTACT_LENS_EVENT_ID';
const USER_PROPS = PropertiesService.getUserProperties();

function doGet(e) {
  const path = (e && e.pathInfo ? String(e.pathInfo) : '').replace(/^\/+/, '');

  if (path === 'manifest.webmanifest') {
    return serveManifest();
  }

  if (path === 'sw.js') {
    return serveServiceWorker();
  }

  const template = HtmlService.createTemplateFromFile('index');
  template.scriptTimeZone = Session.getScriptTimeZone();
  template.lensDurationDays = LENS_DURATION_DAYS;

  return template
    .evaluate()
    .setTitle('2weekコンタクト管理')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function serveManifest() {
  const manifest = {
    name: '2weekコンタクト管理',
    short_name: 'レンズ管理',
    start_url: '.',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    icons: [
      {
        src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%230ea5e9"/><stop offset="100%" stop-color="%236367f2"/></linearGradient></defs><rect width="256" height="256" rx="56" fill="%230f172a"/><path fill="url(%23g)" d="M64 88c0-18 14-32 32-32h64c18 0 32 14 32 32 0 48-28 88-64 88s-64-40-64-88Z"/><circle cx="128" cy="116" r="22" fill="%23e0f2fe"/></svg>',
        sizes: '192x192',
        type: 'image/svg+xml'
      },
      {
        src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%230ea5e9"/><stop offset="100%" stop-color="%236367f2"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="%230f172a"/><path fill="url(%23g)" d="M128 176c0-36 28-64 64-64h128c36 0 64 28 64 64 0 96-56 176-128 176s-128-80-128-176Z"/><circle cx="256" cy="232" r="44" fill="%23e0f2fe"/></svg>',
        sizes: '512x512',
        type: 'image/svg+xml'
      }
    ]
  };

  return ContentService.createTextOutput(JSON.stringify(manifest))
    .setMimeType(ContentService.MimeType.JSON);
}

function serveServiceWorker() {
  const sw = HtmlService.createTemplateFromFile('sw').evaluate().getContent();
  return ContentService.createTextOutput(sw)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function getState() {
  return {
    startDate: USER_PROPS.getProperty(START_DATE_KEY) || '',
    replacementDate: USER_PROPS.getProperty(REPLACEMENT_DATE_KEY) || '',
    durationDays: LENS_DURATION_DAYS,
    calendarEventId: USER_PROPS.getProperty(EVENT_ID_KEY) || '',
    timezone: Session.getScriptTimeZone()
  };
}

function saveStartDate(isoDate) {
  if (!isoDate) {
    throw new Error('開始日を指定してください。');
  }

  const startDate = parseIsoDate(isoDate);
  const replacementDate = addDays(startDate, LENS_DURATION_DAYS);
  const replacementIso = formatIsoDate(replacementDate);

  const eventId = upsertCalendarEvent({
    startIso: isoDate,
    replacementDate
  });

  USER_PROPS.setProperties({
    [START_DATE_KEY]: isoDate,
    [REPLACEMENT_DATE_KEY]: replacementIso,
    [EVENT_ID_KEY]: eventId || ''
  });

  return {
    startDate: isoDate,
    replacementDate: replacementIso,
    durationDays: LENS_DURATION_DAYS,
    calendarEventId: eventId || '',
    timezone: Session.getScriptTimeZone()
  };
}

function upsertCalendarEvent(payload) {
  const calendar = CalendarApp.getDefaultCalendar();
  const previousId = USER_PROPS.getProperty(EVENT_ID_KEY);

  if (previousId) {
    try {
      const existing = calendar.getEventById(previousId);
      if (existing) {
        existing.deleteEvent();
      }
    } catch (err) {
      console.warn('既存イベントの削除に失敗', err);
    }
  }

  try {
    const description = '2weekコンタクトの交換日です。\n開始日: ' + payload.startIso;
    const event = calendar.createAllDayEvent('コンタクト交換', payload.replacementDate, {
      description
    });
    return event.getId();
  } catch (err) {
    console.error('カレンダー登録に失敗', err);
    return '';
  }
}

function parseIsoDate(isoDate) {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(function (part) { return isNaN(part); })) {
    throw new Error('日付の形式が正しくありません。');
  }
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  return [year, month, day].join('-');
}
