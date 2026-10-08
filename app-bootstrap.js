// Community bootstrap; official bindings, Wasm and worker remain byte-identical.
const config = parent.LIGHTCRAFT_DELIVERY;
document.documentElement.lang = parent.document.documentElement.lang;
const report = detail => parent.postMessage({type: 'lightcraft-startup', ...detail}, location.origin);
const fatal = error => report({error: String(error?.stack || error)});
addEventListener('error', event => fatal(event.error || event.message));
addEventListener('unhandledrejection', event => fatal(event.reason));
try {
  const bindings = await import(new URL('./lightcraft_web.js', location.href));
  const wasmUrl = new URL('./lightcraft_web_bg.wasm', location.href);
  wasmUrl.searchParams.set('v', config.revision);
  const module = await WebAssembly.compileStreaming(fetch(wasmUrl));
  globalThis.lightcraftModule = module;
  await bindings.default({module_or_path: module});
  globalThis.lightcraft = {command: bindings.command};
  bindings.start();
  const timer = setInterval(() => {
    const canvas = document.getElementById('lightcraft_canvas');
    const loading = document.getElementById('lightcraft_loading');
    const status = document.getElementById('lightcraft_status');
    if (status?.textContent.includes('failed to start')) { fatal(status.textContent); clearInterval(timer); }
    else if (canvas?.hasAttribute('tabindex') && canvas.width > 0 && canvas.height > 0 && !loading) {
      report({ready: true});
      clearInterval(timer);
    }
  }, config.uiPollMs);
} catch (error) { fatal(error); }
