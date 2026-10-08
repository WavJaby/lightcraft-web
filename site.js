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
let noticeStorage;
let noticeStorageFailures = 0;
const countStorageFailure = () => {
  noticeStorageFailures += 1;
  notice.dataset.storageFailures = String(noticeStorageFailures);
};

try {
  noticeStorage = window.localStorage;
  if (noticeStorage.getItem(noticeKey) === 'dismissed') notice.hidden = true;
} catch {
  countStorageFailure();
}

if (window.location.hostname.toLowerCase().endsWith('.github.io')) {
  document.getElementById('github-origin-notice').hidden = false;
}

document.getElementById('dismiss-notice').addEventListener('click', () => {
  notice.hidden = true;
  if (!noticeStorage) return;
  try {
    noticeStorage.setItem(noticeKey, 'dismissed');
  } catch {
    countStorageFailure();
  }
});

document.getElementById('show-notice').addEventListener('click', () => {
  notice.hidden = false;
  document.getElementById('dismiss-notice').focus();
});
