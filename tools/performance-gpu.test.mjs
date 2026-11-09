import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyHardwareRenderer, withTimeout } from './performance-gpu.mjs';

const gpu = { gpu: { devices: [{ vendorString: 'AMD', deviceString: 'AMD Radeon Pro 5500M' }], featureStatus: { webgl: 'enabled' } } };
test('recognizes actual AMD Metal context with browser device evidence', () => {
  assert.equal(classifyHardwareRenderer({ unmasked_renderer: 'ANGLE (AMD, ANGLE Metal Renderer: AMD Radeon Pro 5500M, Unspecified Version)', unmasked_vendor: 'Google Inc. (AMD)' }, gpu).verified, true);
});
test('software identity takes precedence over vendor or Metal-like claims', () => {
  assert.equal(classifyHardwareRenderer({ unmasked_renderer: 'ANGLE (Google, Vulkan SwiftShader Device, Metal)', unmasked_vendor: 'Intel' }, gpu).kind, 'software');
  assert.equal(classifyHardwareRenderer({ unmasked_renderer: 'llvmpipe (LLVM)' }, gpu).verified, false);
});
test('masked renderer or missing device metadata cannot establish hardware', () => {
  assert.equal(classifyHardwareRenderer({ unmasked_renderer: 'WebKit WebGL', unmasked_vendor: 'Intel' }, gpu).kind, 'unknown');
  assert.equal(classifyHardwareRenderer({ unmasked_renderer: 'Intel UHD Graphics 630' }, null).kind, 'unknown');
});
test('software WebGL feature status blocks a physical-looking renderer', () => {
  assert.equal(classifyHardwareRenderer({ unmasked_renderer: 'AMD Radeon Pro 5500M' }, { gpu: { devices: gpu.gpu.devices, featureStatus: { webgl: 'unavailable_software' } } }).kind, 'software');
});
test('deadline rejects stalled operations', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 5, 'fixture'), /fixture exceeded/);
});
