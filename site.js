'use strict';

const languageTags = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
const traditionalChinese = languageTags.some(tag => /^zh(?:-|$)/i.test(tag));
const language = traditionalChinese ? 'zh-Hant' : 'en';
document.documentElement.lang = language;

for (const element of document.querySelectorAll('[data-en][data-zh-hant]')) {
  element.textContent = element.dataset[traditionalChinese ? 'zhHant' : 'en'];
}
for (const element of document.querySelectorAll('[data-aria-en][data-aria-zh-hant]')) {
  element.setAttribute('aria-label', element.dataset[`aria${language === 'zh-Hant' ? 'ZhHant' : 'En'}`]);
}
for (const element of document.querySelectorAll('[data-title-en][data-title-zh-hant]')) {
  element.title = element.dataset[language === 'zh-Hant' ? 'titleZhHant' : 'titleEn'];
}

const frame = document.getElementById('lightcraft-frame');
const frameUrl = new URL(frame.dataset.appPath, document.baseURI);
frameUrl.search = window.location.search;
frameUrl.hash = window.location.hash;
frame.src = frameUrl.href;

const notice = document.getElementById('storage-notice');
const noticeKey = 'lightcraft-web.notice.v1';
const siteChrome = document.getElementById('site-chrome');
const toolbarToggle = document.getElementById('toggle-toolbar');
const toolbarKey = 'lightcraft-web.toolbar.v1';
let hostStorage;
let hostStorageFailures = 0;
const countStorageFailure = () => {
  hostStorageFailures += 1;
  document.documentElement.dataset.storageFailures = String(hostStorageFailures);
};

function setToolbar(collapsed) {
  siteChrome.hidden = collapsed;
  document.body.classList.toggle('toolbar-collapsed', collapsed);
  toolbarToggle.setAttribute('aria-expanded', String(!collapsed));
  toolbarToggle.title = collapsed
    ? (traditionalChinese ? '展開站點工具列' : 'Show site toolbar')
    : (traditionalChinese ? '收合站點工具列' : 'Collapse site toolbar');
  toolbarToggle.setAttribute('aria-label', toolbarToggle.title);
  toolbarToggle.textContent = collapsed ? '▾' : '▴';
}

try {
  hostStorage = window.localStorage;
  if (hostStorage.getItem(noticeKey) === 'dismissed') notice.hidden = true;
  setToolbar(hostStorage.getItem(toolbarKey) === 'collapsed');
} catch {
  countStorageFailure();
  setToolbar(false);
}

toolbarToggle.addEventListener('click', () => {
  setToolbar(!siteChrome.hidden);
  if (!hostStorage) return;
  try {
    hostStorage.setItem(toolbarKey, siteChrome.hidden ? 'collapsed' : 'expanded');
  } catch {
    countStorageFailure();
  }
});

if (window.location.hostname.toLowerCase().endsWith('.github.io')) {
  document.getElementById('github-origin-notice').hidden = false;
}

document.getElementById('dismiss-notice').addEventListener('click', () => {
  notice.hidden = true;
  if (!hostStorage) return;
  try {
    hostStorage.setItem(noticeKey, 'dismissed');
  } catch {
    countStorageFailure();
  }
});

document.getElementById('show-notice').addEventListener('click', () => {
  notice.hidden = false;
  document.getElementById('dismiss-notice').focus();
});
