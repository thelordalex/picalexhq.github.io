/* Picalex HQ - worker-bg.js
   Runs the background-removal model off the main thread so the UI stays responsive.

   NETWORK NOTE: this worker makes NO network requests. script.js downloads the model and the ONNX Runtime
   files (only after the user taps "Use AI model", cached with the Cache API) and hands them over as
   buffers. The photo is never uploaded.

   Messages in:  { id, type:'init', ort, wasm, model }   ArrayBuffers
                 { id, type:'run',  size, rgba }          rgba = size*size*4 bytes, RGBA
   Messages out: { id, type:'ready' } | { id, type:'mask', alpha } | { id, type:'error', message }
   Model: RMBG-1.4 (quantised ONNX). Input 1x3xSxS, values (x/255 - 0.5). Output 1x1xSxS, 0..1 mask. */
'use strict';
let session = null, inName = '', outName = '';

self.onmessage = async ev => {
  const m = ev.data;
  try {
    if (m.type === 'init') {
      const ortUrl = URL.createObjectURL(new Blob([m.ort], { type: 'text/javascript' }));
      importScripts(ortUrl);
      URL.revokeObjectURL(ortUrl);
      const wasmUrl = URL.createObjectURL(new Blob([m.wasm], { type: 'application/wasm' }));
      self.ort.env.wasm.wasmPaths = { 'ort-wasm-simd.wasm': wasmUrl };
      self.ort.env.wasm.numThreads = 1;          // multi-threading needs cross-origin isolation, not available in WebView
      self.ort.env.wasm.proxy = false;
      session = await self.ort.InferenceSession.create(new Uint8Array(m.model), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      inName = session.inputNames[0]; outName = session.outputNames[0];
      self.postMessage({ id: m.id, type: 'ready' });
    } else if (m.type === 'run') {
      if (!session) throw new Error('model not loaded');
      const S = m.size, N = S * S, px = new Uint8ClampedArray(m.rgba);
      const f = new Float32Array(3 * N);
      for (let p = 0, i = 0; p < N; p++, i += 4) {
        f[p] = px[i] / 255 - 0.5;
        f[N + p] = px[i + 1] / 255 - 0.5;
        f[2 * N + p] = px[i + 2] / 255 - 0.5;
      }
      const out = await session.run({ [inName]: new self.ort.Tensor('float32', f, [1, 3, S, S]) });
      const o = out[outName].data;
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < o.length; i++) { const v = o[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
      const span = hi - lo || 1, a = new Uint8Array(N);
      for (let i = 0; i < N; i++) a[i] = Math.max(0, Math.min(255, Math.round((o[i] - lo) / span * 255)));
      self.postMessage({ id: m.id, type: 'mask', alpha: a.buffer }, [a.buffer]);
    }
  } catch (err) {
    self.postMessage({ id: m.id, type: 'error', message: String(err && err.message || err) });
  }
};
