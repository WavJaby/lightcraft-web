// Versioned document preserves official worker URLs and library query parameters.
export async function startEditor(config) {
  const state = {ready: false, error: null};
  const frame = document.createElement('iframe');
  frame.id = 'editor-surface';
  frame.title = document.documentElement.lang === 'zh-Hant' ? 'LightCraft 相片編輯器' : 'LightCraft photo editor';
  frame.allow = 'fullscreen; clipboard-read; clipboard-write';
  const host = document.getElementById('editor-host');
  const url = new URL('experience.html', new URL(host.dataset.appPath, location.href));
  url.search = location.search;
  url.hash = location.hash;
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.type !== 'lightcraft-startup') return;
    if (event.data.error) {
      state.error = event.data.error;
      document.dispatchEvent(new CustomEvent('editor-fatal', {detail: state.error}));
    } else if (event.data.ready) state.ready = true;
  });
  frame.src = url.href;
  host.replaceChildren(frame);
  return {state};
}
