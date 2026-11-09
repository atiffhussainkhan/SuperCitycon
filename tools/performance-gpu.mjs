/** Classify the actual WebGL renderer; launch mode alone is not GPU evidence. */
export function classifyHardwareRenderer(context, systemInfo) {
  const renderer = String(context?.unmasked_renderer || '');
  const vendor = String(context?.unmasked_vendor || '');
  const glStatus = String(systemInfo?.gpu?.featureStatus?.webgl || '');
  const software = /swiftshader|llvmpipe|softpipe|lavapipe|software|basic render|\bwarp\b|virgl/i;
  if (software.test(renderer) || software.test(glStatus)) {
    return { kind: 'software', verified: false, reason: 'Actual WebGL renderer or browser WebGL feature status identifies software rendering.' };
  }
  if (!renderer || !/\b(?:AMD|ATI|Intel|NVIDIA|Apple)\b|Radeon|GeForce|ANGLE Metal Renderer/i.test(renderer)) {
    return { kind: 'unknown', verified: false, reason: 'Actual WebGL context exposes no recognized physical GPU renderer.' };
  }
  if (!Array.isArray(systemInfo?.gpu?.devices) || !systemInfo.gpu.devices.length) {
    return { kind: 'unknown', verified: false, reason: 'Browser GPU device metadata is unavailable; hardware evidence is incomplete.' };
  }
  return { kind: 'hardware', verified: true, reason: 'Actual WebGL context names a physical GPU and browser GPU device metadata is present.', renderer, vendor };
}

export function withTimeout(promise, milliseconds, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${milliseconds} ms`)), milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Close only the preview process this probe started. */
export async function stopPreview(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  try {
    await withTimeout(exited, 5000, 'preview shutdown');
  } catch {
    child.kill('SIGKILL');
    await withTimeout(exited, 1000, 'preview force shutdown');
  }
}
