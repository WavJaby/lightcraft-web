'use strict';

const preferredLanguage = navigator.languages?.[0] || navigator.language || 'en';
const traditionalChinese = /^zh(?:-|$)/i.test(preferredLanguage);
if (traditionalChinese) {
  const translations = {
    badge: '非官方網頁體驗 · v0.4.0',
    source: '原作 GitHub ↗',
    download: '下載官方桌面版 ↗',
    notice: '使用說明',
    placeholder: '閱讀說明後，按「開始體驗」載入編輯器。',
    credit: '原作：ArtCraft + LightCraft contributors · 非官方鏡像 · ',
    licenses: '授權與署名',
    heading: '更方便體驗 LightCraft',
    purpose: '本站只是讓大家不用安裝，就能體驗 LightCraft 原作。軟體由 ArtCraft 團隊與貢獻者開發；本站非官方營運，未獲官方背書。',
    build: '載入官方 v0.4.0 網頁成品，JavaScript／WASM 模組；本站使用獨立單頁啟動器。',
    parity: '網頁版與桌面版共用編輯引擎，但功能並非完全相同。',
    files: '照片與相片庫留在此瀏覽器。請保留原始檔，並使用 File → Back Up Library… 備份；瀏覽器儲存不是備份。',
    persistence: '瀏覽器可能清除或回收本機資料。本站與其他 wavjaby.github.io 專案共用來源；同來源網站的程式可存取這些資料。',
    performance: '大量照片與 RAW 處理會使用記憶體及 GPU。瀏覽器版仍屬實驗性質；正式工作前請評估官方桌面版。',
    alpha: '手機縮放只調整顯示，並非完整觸控介面。本站翻譯說明與載入介面；官方編輯器保留原有語言。',
    evidence: '說明依 v0.4.0 原始碼核對，未逐項驗證所有編輯功能。正式工作前，請另存副本並試用官方桌面版。',
    storage: '瀏覽器不允許儲存此偏好；下次開啟仍會顯示說明。',
    remember: '此瀏覽器不再提醒（仍可從「使用說明」重新開啟）',
    start: '開始體驗',
    navigation: '原作與站點資訊',
    editor: 'LightCraft 編輯器',
    retry: '重新載入',
    zoom: '編輯器縮放',
    fit: '自動寬度',
    rotate: '建議橫向使用',
  };
  document.documentElement.lang = 'zh-Hant';
  document.title = 'LightCraft · 非官方網頁體驗站';
  document.getElementById('host-loading').setAttribute('aria-label', '正在載入 LightCraft');
  document.getElementById('loading-progress').setAttribute('aria-label', '程式下載進度');
  document.querySelector('meta[name="description"]').content = 'LightCraft 非官方網頁體驗站。使用官方 WebAssembly 模組與社群單頁啟動器；原作與所有貢獻歸 ArtCraft 團隊及貢獻者。';
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = translations[element.dataset.i18n];
  }
  for (const element of document.querySelectorAll('[data-i18n-aria]')) {
    element.setAttribute('aria-label', translations[element.dataset.i18nAria]);
  }
}

const notice = document.getElementById('notice');
const remember = document.getElementById('remember-notice');
const storageWarning = document.getElementById('storage-warning');
const preferenceKey = 'lightcraft-mirror.notice.v1';
const config = globalThis.LIGHTCRAFT_DELIVERY;
const badge = document.querySelector('[data-i18n="badge"]');
if (badge) badge.textContent = (traditionalChinese ? '非官方網頁體驗 · v' : 'Unofficial browser experience · v') + config.version;
const loading = document.getElementById('host-loading');
const loadingTitle = document.getElementById('loading-title');
const loadingDetail = document.getElementById('loading-detail');
const loadingNote = document.getElementById('loading-note');
const loadingProgress = document.getElementById('loading-progress');
const words = (english, chinese) => traditionalChinese ? chinese : english;
let editorLoaded = false;


async function prepareDelivery() {
  if (!navigator.serviceWorker) throw new Error('Service workers unavailable');
  const registration = await navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' });
  await registration.update();
  const updating = registration.installing || registration.waiting;
  if (updating && updating.state !== 'activated') {
    await new Promise((resolve, reject) => {
      updating.addEventListener('statechange', () => {
        if (updating.state === 'activated') resolve();
        else if (updating.state === 'redundant') reject(new Error('Worker update failed'));
      });
    });
  }
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {
    await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  }
}

if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', event => {
  const update = event.data;
  if (update?.type !== 'lightcraft-download') return;
  if (update.state === 'receiving') {
    loading.dataset.transport = update.source;
    loadingTitle.textContent = words('Downloading LightCraft…', '正在下載 LightCraft…');
    loadingProgress.value = Math.min(update.received / update.total * 100, 100);
    const mib = bytes => (bytes / (1024 * 1024)).toFixed(1);
    loadingDetail.textContent = `${mib(update.received)} / ${mib(update.total)} MiB · ${Math.floor(loadingProgress.value)}%`;
    if (update.source === 'parts') loadingDetail.textContent += words(' · compressed parts', ' · 壓縮分片');
  } else if (update.state === 'complete') {

    loading.dataset.source = update.source;
    loading.dataset.verified = String(update.verified === true);
    loadingProgress.removeAttribute('value');
    loadingTitle.textContent = words('Starting the editor…', '正在啟動編輯器…');
    loadingDetail.textContent = update.source === 'cache' ? words('Application loaded from local cache.', '已從本機快取取得程式。') : words('Download complete. Compiling WebAssembly and starting the GPU…', '下載完成，正在編譯 WebAssembly 並啟動 GPU…');
  } else if (update.state === 'retrying') {
    loading.dataset.partRetries = String(Number(loading.dataset.partRetries || 0) + 1);
    loadingNote.textContent = words(`Retrying part ${update.part} (attempt ${update.attempt})…`, `正在重試第 ${update.part} 片（第 ${update.attempt} 次）…`);
  } else if (update.state === 'single-file') {
    loading.dataset.singleFile = update.reason;
    loadingNote.textContent = words('Using the original single-file download on this browser or preview.', '此瀏覽器或預覽環境使用原版單檔下載。');
  } else if (update.state === 'cached') {
    loading.dataset.cached = 'true';
  } else if (update.state === 'cache-unavailable') {
    loading.dataset.cacheFailures = String(Number(loading.dataset.cacheFailures || 0) + 1);
    loadingNote.textContent = words('Local caching is unavailable; the editor can still run, but future visits may download again.', '無法使用本機快取；編輯器仍可執行，但下次可能需要重新下載。');
  } else if (update.state === 'failed') {
    loading.dataset.downloadFailures = String(Number(loading.dataset.downloadFailures || 0) + 1);
    loadingTitle.textContent = words('Download failed', '下載失敗');
    loadingDetail.textContent = update.message;
    loadingProgress.removeAttribute('value');
  }
});

async function loadEditor() {
  if (editorLoaded) return;
  editorLoaded = true;
  void import('./hardware-check.js').then(module => module.showHardwareResults(loading, traditionalChinese, config.workerReadyTimeoutMs)).catch(() => {
    loading.dataset.hardwareCheckFailures = String(Number(loading.dataset.hardwareCheckFailures || 0) + 1);
  });
  loading.hidden = false;
  loadingTitle.textContent = words('Preparing LightCraft…', '正在準備 LightCraft…');
  loadingDetail.textContent = words('Preparing the download…', '正在準備下載…');
  loadingNote.textContent = words('The first download is large. Keep this tab open; later visits can use a local cache.', '首次下載檔案較大，請保持此分頁開啟；下次可使用本機快取。');
  let workerDeadline;
  try {
    await Promise.race([prepareDelivery(), new Promise((_, reject) => { workerDeadline = setTimeout(() => reject(new Error('Worker setup timed out')), config.workerReadyTimeoutMs); })]);
  } catch {
    loading.dataset.workerFailures = String(Number(loading.dataset.workerFailures || 0) + 1);
    loadingNote.textContent = words('Loading without local cache or byte progress. Keep this tab open.', '目前無法使用本機快取或位元組進度，請保持此分頁開啟。');
  } finally {
    clearTimeout(workerDeadline);
  }
  const {startEditor} = await import('./app-loader.js');
  const started = performance.now();
  let handle;
  let failed = false;
  const fail = error => {
    if (failed) return;
    failed = true;
    loading.hidden = false;
    loading.dataset.startupFailures = String(Number(loading.dataset.startupFailures || 0) + 1);
    loadingTitle.textContent = words('The editor stopped or could not start', '編輯器停止運作或無法啟動');
    loadingDetail.textContent = String(error);
  };
  document.addEventListener('editor-fatal', event => fail(event.detail));
  const monitor = setInterval(() => {
    const seconds = Math.floor((performance.now() - started) / 1000);
    document.getElementById('loading-time').textContent = words(`Elapsed: ${seconds} seconds`, `已經過 ${seconds} 秒`);
    if (seconds >= config.slowNoticeSeconds && !loading.dataset.verified && !failed) loadingNote.textContent = words('Still loading. Progress measures downloaded bytes, not compilation time.', '仍在載入；進度代表下載資料，不包含編譯時間。');
    if (failed) { clearInterval(monitor); return; }
    if (handle?.state.ready) {
      loading.dataset.started = 'true';
      loading.hidden = true;
      clearInterval(monitor);
    }
  }, config.uiPollMs);
  handle = await startEditor(config);
  if (handle.state.error) fail(handle.state.error);
}

document.getElementById('retry-load').addEventListener('click', () => window.location.reload());

const toolbar = document.getElementById('site-toolbar');
const toolbarToggle = document.getElementById('toggle-toolbar');
const toolbarKey = 'lightcraft-mirror.toolbar.v1';
function setToolbar(collapsed) {
  toolbar.hidden = collapsed;
  document.body.classList.toggle('toolbar-collapsed', collapsed);
  toolbarToggle.setAttribute('aria-expanded', String(!collapsed));
  toolbarToggle.title = collapsed ? words('Show site toolbar', '展開站點工具列') : words('Collapse site toolbar', '收合站點工具列');
  toolbarToggle.setAttribute('aria-label', toolbarToggle.title);
  toolbarToggle.textContent = collapsed ? '▾' : '▴';
}
const mobileControls = document.getElementById('mobile-controls');
const scaleSelect = document.getElementById('editor-scale');
const scaleKey = 'lightcraft-mirror.scale.v1';
const mobileLayout = () => getComputedStyle(mobileControls).display !== 'none';
function fitEditor() {
  const width = document.getElementById('editor-container').clientWidth;
  const scale = mobileLayout() ? scaleSelect.value === 'auto' ? Math.min(1, width / config.mobileEditorWidth) : Number(scaleSelect.value) : 1;
  document.getElementById('editor-host').style.setProperty('--editor-scale', String(scale));
  document.getElementById('editor-scale-value').textContent = `${Math.round(scale * 100)}%`;
}
try {
  const savedScale = localStorage.getItem(scaleKey);
  if (Array.from(scaleSelect.options).some(option => option.value === savedScale)) scaleSelect.value = savedScale;
} catch { storageWarning.hidden = false; }
scaleSelect.addEventListener('change', () => {
  fitEditor();
  try { localStorage.setItem(scaleKey, scaleSelect.value); } catch { storageWarning.hidden = false; }
});
new ResizeObserver(fitEditor).observe(document.getElementById('editor-container'));
fitEditor();
try {
  const savedToolbar = localStorage.getItem(toolbarKey);
  setToolbar(savedToolbar === 'collapsed' || (savedToolbar === null && mobileLayout()));
} catch { setToolbar(mobileLayout()); }
toolbarToggle.addEventListener('click', () => {
  setToolbar(!toolbar.hidden);
  try { localStorage.setItem(toolbarKey, toolbar.hidden ? 'collapsed' : 'expanded'); } catch { storageWarning.hidden = false; }
});

try {
  remember.checked = localStorage.getItem(preferenceKey) === 'dismissed';
} catch {
  storageWarning.hidden = false;
}

document.getElementById('show-notice').addEventListener('click', () => notice.showModal());
notice.addEventListener('close', () => {
  try {
    if (remember.checked) localStorage.setItem(preferenceKey, 'dismissed');
    else localStorage.removeItem(preferenceKey);
  } catch {
    storageWarning.hidden = false;
  }
  loadEditor();
});

if (remember.checked) loadEditor();
else notice.showModal();
