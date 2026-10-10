// scripts/build.js
// Multi-browser build system for Chromium, Firefox, and Safari

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const esbuild = require('esbuild');

const ROOT_DIR = path.resolve(__dirname, '..');
const BUILDS_DIR = path.join(ROOT_DIR, 'builds');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const TARGETS = ['chromium', 'firefox', 'safari'];

// Base Manifest V3 configuration
const baseManifest = {
  manifest_version: 3,
  name: 'ShiftySearch — Умный AI Островок',
  version: '1.1.0',
  description: 'Минималистичный плавающий AI-островок с поддержкой любой нейросети (Gemini, ChatGPT, Claude, OpenRouter), выбором темы и цвета, поиском ссылок и масштабированием.',
  icons: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png'
  },
  action: {
    default_popup: 'popup/popup.html',
    default_title: 'ShiftySearch AI',
    default_icon: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png'
    }
  },
  options_ui: {
    page: 'options/options.html',
    open_in_tab: true
  },
  permissions: [
    'storage',
    'contextMenus',
    'activeTab'
  ],
  host_permissions: [
    '<all_urls>'
  ],
  commands: {
    'toggle-island': {
      suggested_key: {
        default: 'Alt+Shift+S',
        mac: 'Alt+Shift+S'
      },
      description: 'Открыть/Скрыть AI-островок ShiftySearch'
    },
    'toggle-size': {
      suggested_key: {
        default: 'Alt+Shift+Z',
        mac: 'Alt+Shift+Z'
      },
      description: 'Сменить масштаб островка (Мини / Большой)'
    }
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['content/island.bundle.js'],
      css: ['content/island.css'],
      run_at: 'document_idle'
    }
  ],
  web_accessible_resources: [
    {
      resources: ['content/island.css', 'icons/*'],
      matches: ['<all_urls>']
    }
  ]
};

// Helper to copy directory recursively
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Simple pure-JS zip creator for packaging extensions without external tools
function createZip(sourceDir, outZipPath) {
  // We can write a clean zip file writer using standard PKZIP specification
  const files = [];

  function collectFiles(dir, relPath = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        collectFiles(fullPath, entryRelPath);
      } else {
        files.push({
          relPath: entryRelPath.replace(/\\/g, '/'),
          data: fs.readFileSync(fullPath)
        });
      }
    }
  }

  collectFiles(sourceDir);

  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const file of files) {
    const fileNameBuf = Buffer.from(file.relPath, 'utf8');
    const compressedData = zlib.deflateRawSync(file.data);
    const uncompressedSize = file.data.length;
    const compressedSize = compressedData.length;
    const crc = calcCrc32(file.data);

    // Local file header (30 bytes) + filename + data
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // min version
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(8, 8); // compression method (8 = deflate)
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(crc, 14); // crc32
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(fileNameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra length

    localHeaders.push(localHeader, fileNameBuf, compressedData);

    // Central directory header (46 bytes)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // min version
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(fileNameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra
    centralHeader.writeUInt16LE(0, 32); // comment
    centralHeader.writeUInt16LE(0, 34); // disk start
    centralHeader.writeUInt16LE(0, 36); // internal attr
    centralHeader.writeUInt32LE(0, 38); // external attr
    centralHeader.writeUInt32LE(offset, 42); // relative offset

    centralHeaders.push(centralHeader, fileNameBuf);
    offset += localHeader.length + fileNameBuf.length + compressedData.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const b of centralHeaders) centralDirSize += b.length;

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);

  const fullZipBuf = Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
  fs.writeFileSync(outZipPath, fullZipBuf);
}

function calcCrc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

async function buildAll() {
  console.log('🚀 Starting ShiftySearch Multi-Browser Build...');

  // 1. Ensure icons exist
  const iconsDir = path.join(ROOT_DIR, 'src', 'icons');
  if (!fs.existsSync(path.join(iconsDir, 'icon128.png'))) {
    console.log('Generating icons...');
    require('./generate-icons.js');
  }

  // 2. Bundle content script and options script with esbuild
  const tempBundleDir = path.join(ROOT_DIR, '.bundle-tmp');
  if (!fs.existsSync(tempBundleDir)) fs.mkdirSync(tempBundleDir, { recursive: true });

  console.log('📦 Bundling JavaScript modules with esbuild...');
  await esbuild.build({
    entryPoints: [
      path.join(ROOT_DIR, 'src', 'content', 'island.js'),
      path.join(ROOT_DIR, 'src', 'options', 'options.js'),
      path.join(ROOT_DIR, 'src', 'background', 'background.js')
    ],
    bundle: true,
    outdir: tempBundleDir,
    format: 'iife',
    target: ['chrome100', 'firefox109', 'safari15'],
    loader: {
      '.css': 'text'
    },
    minify: false, // Keep readable for audit
    sourcemap: false
  });

  // Ensure directories
  if (!fs.existsSync(BUILDS_DIR)) fs.mkdirSync(BUILDS_DIR, { recursive: true });
  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });

  // 3. Assemble target builds
  for (const target of TARGETS) {
    const targetDir = path.join(BUILDS_DIR, target);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });

    // Copy icons
    copyDirSync(iconsDir, path.join(targetDir, 'icons'));

    // Copy and create content dir
    const contentTarget = path.join(targetDir, 'content');
    fs.mkdirSync(contentTarget, { recursive: true });
    fs.copyFileSync(path.join(tempBundleDir, 'content', 'island.js'), path.join(contentTarget, 'island.bundle.js'));
    fs.copyFileSync(path.join(ROOT_DIR, 'src', 'content', 'island.css'), path.join(contentTarget, 'island.css'));

    // Copy background
    const bgTarget = path.join(targetDir, 'background');
    fs.mkdirSync(bgTarget, { recursive: true });
    fs.copyFileSync(path.join(tempBundleDir, 'background', 'background.js'), path.join(bgTarget, 'background.js'));

    // Copy popup
    const popupTarget = path.join(targetDir, 'popup');
    fs.mkdirSync(popupTarget, { recursive: true });
    fs.copyFileSync(path.join(ROOT_DIR, 'src', 'popup', 'popup.html'), path.join(popupTarget, 'popup.html'));
    fs.copyFileSync(path.join(ROOT_DIR, 'src', 'popup', 'popup.css'), path.join(popupTarget, 'popup.css'));
    fs.copyFileSync(path.join(ROOT_DIR, 'src', 'popup', 'popup.js'), path.join(popupTarget, 'popup.js'));

    // Copy options
    const optionsTarget = path.join(targetDir, 'options');
    fs.mkdirSync(optionsTarget, { recursive: true });
    fs.copyFileSync(path.join(ROOT_DIR, 'src', 'options', 'options.html'), path.join(optionsTarget, 'options.html'));
    fs.copyFileSync(path.join(ROOT_DIR, 'src', 'options', 'options.css'), path.join(optionsTarget, 'options.css'));
    fs.copyFileSync(path.join(tempBundleDir, 'options', 'options.js'), path.join(optionsTarget, 'options.js'));

    // Adjust options.html in target so it includes bundled options.js (not type=module)
    let optHtml = fs.readFileSync(path.join(optionsTarget, 'options.html'), 'utf8');
    optHtml = optHtml.replace('<script src="options.js" type="module"></script>', '<script src="options.js"></script>');
    fs.writeFileSync(path.join(optionsTarget, 'options.html'), optHtml);

    // Generate tailored manifest.json
    const manifest = JSON.parse(JSON.stringify(baseManifest));

    if (target === 'chromium') {
      manifest.background = {
        service_worker: 'background/background.js'
      };
    } else if (target === 'firefox') {
      manifest.background = {
        scripts: ['background/background.js']
      };
      manifest.browser_specific_settings = {
        gecko: {
          id: 'shiftysearch@hantaty201.github.io',
          strict_min_version: '109.0'
        }
      };
    } else if (target === 'safari') {
      manifest.background = {
        service_worker: 'background/background.js'
      };
      // Safari requires explicit browser action declaration or standard MV3
    }

    fs.writeFileSync(
      path.join(targetDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Package to zip
    const zipPath = path.join(DIST_DIR, `shiftysearch-${target}.zip`);
    createZip(targetDir, zipPath);

    console.log(`✅ Build completed: builds/${target} -> dist/shiftysearch-${target}.zip`);
  }

  // Cleanup temp bundle dir
  if (fs.existsSync(tempBundleDir)) {
    fs.rmSync(tempBundleDir, { recursive: true, force: true });
  }

  // Also write a root manifest.json (Chromium default) for direct root folder loading
  const rootManifest = JSON.parse(JSON.stringify(baseManifest));
  rootManifest.background = { service_worker: 'builds/chromium/background/background.js' };
  rootManifest.content_scripts[0].js = ['builds/chromium/content/island.bundle.js'];
  rootManifest.content_scripts[0].css = ['src/content/island.css'];
  rootManifest.web_accessible_resources[0].resources = ['src/content/island.css', 'src/icons/*'];
  rootManifest.action.default_popup = 'src/popup/popup.html';
  rootManifest.options_ui.page = 'src/options/options.html';
  rootManifest.icons = {
    16: 'src/icons/icon16.png',
    32: 'src/icons/icon32.png',
    48: 'src/icons/icon48.png',
    128: 'src/icons/icon128.png'
  };
  rootManifest.action.default_icon = rootManifest.icons;
  fs.writeFileSync(path.join(ROOT_DIR, 'manifest.json'), JSON.stringify(rootManifest, null, 2));

  console.log('🎉 All builds and packages generated successfully!');
}

buildAll().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
