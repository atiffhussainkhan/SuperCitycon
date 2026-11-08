/**
 * V4 — Asset library public surface.
 */

export {
  ASSET_SOURCES,
  IMAGE_PREFIX,
  MODEL_PREFIX,
  PUBLIC_PREFIX,
  QUARANTINE_FILE,
  REPO_ROOT,
  V4_ROOT,
  buildCatalogue,
  createCatalogue,
  fileSize,
  gltfSidecars,
  readQuarantine,
} from './catalogue.js';

export {
  buildManifest,
  hashBuffer,
  sha256File,
  sizeOf,
  verifyManifest,
} from './integrity.js';

export { createAssetLibrary } from './library.js';

export {
  describeRefusals,
  exportLayoutPath,
  exportPack,
  scrubSecrets,
} from './export.js';
