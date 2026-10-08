const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function open(languages) {
  const nodes = new Map();
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, {dataset: {}, style: {setProperty() {}}, options: [{value: 'auto'}], value: 'auto', clientWidth: 1200, hidden: false, events: {}, attributes: {}, setAttribute(key, value) {this.attributes[key] = value;}, removeAttribute(key) {delete this.attributes[key];}, addEventListener(name, fn) {this.events[name] = fn;}, showModal() {this.open = true;}});
    return nodes.get(id);
  };
  const translated = ['notice', 'start', 'remember', 'files'].map(key => ({dataset: {i18n: key}}));
  const workerEvents = {};
  const preferences = new Map();
  const document = {documentElement: {lang: 'en'}, body: {classList: {toggle() {}}}, getElementById: element, querySelector: element, querySelectorAll: selector => selector === '[data-i18n]' ? translated : []};
  const context = vm.createContext({document, navigator: {languages, serviceWorker: {addEventListener(name, fn) {workerEvents[name] = fn;}}}, LIGHTCRAFT_DELIVERY: {version: '0.2.1', mobileEditorWidth: 960}, localStorage: {getItem: key => preferences.get(key) ?? null, setItem: (key, value) => preferences.set(key, value)}, ResizeObserver: class {observe() {}}, getComputedStyle: () => ({display: 'none'}), performance});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../site.js'), 'utf8'), context);
  return {document, element, translated, workerEvents, preferences};
}

test('Chinese first preference localizes title, notices and progress accessibility', () => {
  const page = open(['zh-TW', 'en']);
  assert.equal(page.document.documentElement.lang, 'zh-Hant');
  assert.equal(page.document.title, 'LightCraft · 非官方網頁體驗站');
  assert.equal(page.translated.find(node => node.dataset.i18n === 'start').textContent, '開始體驗');
  assert.equal(page.element('loading-progress').attributes['aria-label'], '程式下載進度');
  assert.equal(page.element('notice').open, true);
});

test('English first preference keeps English even when Chinese is secondary', () => {
  assert.equal(open(['en-US', 'zh-TW']).document.documentElement.lang, 'en');
});

test('real transferred byte messages drive progress, compilation stays indeterminate', () => {
  const page = open(['zh-TW']);
  page.workerEvents.message({data: {type: 'lightcraft-download', state: 'receiving', received: 1024, total: 4096, source: 'parts'}});
  assert.equal(page.element('loading-progress').value, 25); // 1024 / 4096 of the requested transfer.
  assert.match(page.element('loading-detail').textContent, /25%/);
  page.workerEvents.message({data: {type: 'lightcraft-download', state: 'complete', source: 'parts', verified: true}});
  assert.equal(page.element('loading-title').textContent, '正在啟動編輯器…');
  assert.equal(page.element('host-loading').dataset.verified, 'true');
});

test('toolbar toggles visibility, accessible label and saved preference', () => {
  const page = open(['zh-TW']);
  page.element('toggle-toolbar').events.click();
  assert.equal(page.element('site-toolbar').hidden, true);
  assert.equal(page.element('toggle-toolbar').attributes['aria-expanded'], 'false');
  assert.equal(page.element('toggle-toolbar').title, '展開站點工具列');
  assert.equal(page.preferences.get('lightcraft-mirror.toolbar.v1'), 'collapsed');
  page.element('toggle-toolbar').events.click();
  assert.equal(page.element('site-toolbar').hidden, false);
});
