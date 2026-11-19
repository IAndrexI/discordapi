const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 lookup table for valid PNG chunk checksums
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodeRGBAtoPNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 1; // Sub filter for compact compression
    for (let x = 0; x < stride; x++) {
      const cur = rgba[y * stride + x];
      const left = x >= 4 ? rgba[y * stride + x - 4] : 0;
      raw[rowStart + 1 + x] = (cur - left) & 0xff;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePNG(filePath) {
  const buf = fs.readFileSync(filePath);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== sig[i]) {
      throw new Error(`Invalid PNG signature in ${filePath}`);
    }
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  const idatChunks = [];

  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    offset += 12 + len;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG format (${bitDepth}-bit, colorType=${colorType})`);
  }

  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const pixels = new Uint8Array(width * height * bpp);

  for (let y = 0; y < height; y++) {
    const filter = inflated[y * (stride + 1)];
    const srcRow = y * (stride + 1) + 1;
    const dstRow = y * stride;

    for (let x = 0; x < stride; x++) {
      const rawVal = inflated[srcRow + x];
      const a = x >= bpp ? pixels[dstRow + x - bpp] : 0;
      const b = y > 0 ? pixels[dstRow - stride + x] : 0;
      const c = x >= bpp && y > 0 ? pixels[dstRow - stride + x - bpp] : 0;

      let recon = rawVal;
      if (filter === 1) recon = (rawVal + a) & 0xff;
      else if (filter === 2) recon = (rawVal + b) & 0xff;
      else if (filter === 3) recon = (rawVal + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) recon = (rawVal + paethPredictor(a, b, c)) & 0xff;

      pixels[dstRow + x] = recon;
    }
  }

  // Convert to RGBA buffer
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, p = 0; i < width * height; i++, p += bpp) {
    rgba[i * 4] = pixels[p];
    rgba[i * 4 + 1] = pixels[p + 1];
    rgba[i * 4 + 2] = pixels[p + 2];
    rgba[i * 4 + 3] = bpp === 4 ? pixels[p + 3] : 255;
  }

  return { width, height, rgba };
}

function sampleEmblemInk(src, sx, sy) {
  const x0 = Math.max(0, Math.min(src.width - 1, Math.floor(sx)));
  const y0 = Math.max(0, Math.min(src.height - 1, Math.floor(sy)));
  const x1 = Math.max(0, Math.min(src.width - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(src.height - 1, y0 + 1));
  const fx = sx - x0;
  const fy = sy - y0;

  const sampleAt = (x, y) => {
    const idx = (y * src.width + x) * 4;
    const r = src.rgba[idx];
    const g = src.rgba[idx + 1];
    const b = src.rgba[idx + 2];
    const a = src.rgba[idx + 3] / 255;
    // Extract dark emblem strokes from light paper background
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const ink = Math.max(0, Math.min(1, (226 - lum) / 135)) * a;
    return ink;
  };

  const i00 = sampleAt(x0, y0);
  const i10 = sampleAt(x1, y0);
  const i01 = sampleAt(x0, y1);
  const i11 = sampleAt(x1, y1);

  return i00 * (1 - fx) * (1 - fy) + i10 * fx * (1 - fy) + i01 * (1 - fx) * fy + i11 * fx * fy;
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function blendPixel(rgba, idx, r, g, b, a) {
  const alpha = Math.max(0, Math.min(1, a));
  const inv = 1 - alpha;
  rgba[idx] = clampByte(rgba[idx] * inv + r * alpha);
  rgba[idx + 1] = clampByte(rgba[idx + 1] * inv + g * alpha);
  rgba[idx + 2] = clampByte(rgba[idx + 2] * inv + b * alpha);
  rgba[idx + 3] = clampByte(Math.max(rgba[idx + 3], alpha * 255));
}

function roundedRectDist(x, y, left, top, w, h, radius) {
  const cx = left + w / 2;
  const cy = top + h / 2;
  const dx = Math.abs(x - cx) - (w / 2 - radius);
  const dy = Math.abs(y - cy) - (h / 2 - radius);
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - radius;
}

function generateTile({ width, height, emblemScale, srcIcon, isWide }) {
  const rgba = new Uint8Array(width * height * 4);

  // 1. Background (#090d16 base with subtle radial cyan/indigo ambient glow)
  const glowCx = isWide ? width * 0.36 : width * 0.5;
  const glowCy = height * 0.45;
  const maxRadius = Math.hypot(width, height) * 0.55;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dist = Math.hypot(x - glowCx, y - glowCy);
      const glow = Math.max(0, 1 - dist / maxRadius);
      const diag = (x / width + y / height) * 0.5;

      const bgR = 9 + diag * 9 + glow * 8;
      const bgG = 13 + diag * 15 + glow * 28;
      const bgB = 22 + diag * 26 + glow * 44;

      rgba[idx] = clampByte(bgR);
      rgba[idx + 1] = clampByte(bgG);
      rgba[idx + 2] = clampByte(bgB);
      rgba[idx + 3] = 255;
    }
  }

  // 2. Subtle cyber frame border inside tile
  const pad = Math.max(2, Math.round(Math.min(width, height) * 0.045));
  const cornerR = Math.max(4, Math.round(Math.min(width, height) * 0.14));
  const borderWidth = Math.max(1.2, Math.min(width, height) * 0.018);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = roundedRectDist(x + 0.5, y + 0.5, pad, pad, width - pad * 2, height - pad * 2, cornerR);
      if (Math.abs(d) <= borderWidth) {
        const t = x / width;
        const borderAlpha = (1 - Math.abs(d) / borderWidth) * 0.45;
        const r = 0 * (1 - t) + 99 * t;
        const g = 242 * (1 - t) + 102 * t;
        const b = 254 * (1 - t) + 241 * t;
        blendPixel(rgba, (y * width + x) * 4, r, g, b, borderAlpha);
      }
    }
  }

  // 3. For wide tile, draw sleek cyan telemetry accent bars to the right of the emblem
  const emblemSize = Math.round(Math.min(width, height) * emblemScale);
  const emblemX = isWide
    ? Math.round(width * 0.28 - emblemSize / 2)
    : Math.round((width - emblemSize) / 2);
  const emblemY = Math.round((height - emblemSize) / 2);

  if (isWide) {
    const barStartX = emblemX + emblemSize + 18;
    const barMaxW = width - barStartX - 28;
    const rows = [
      { y: Math.round(height * 0.36), w: barMaxW * 0.92, h: 7, c1: [248, 250, 252], c2: [56, 189, 248], a: 0.95 },
      { y: Math.round(height * 0.50), w: barMaxW * 0.72, h: 5, c1: [0, 242, 254], c2: [99, 102, 241], a: 0.75 },
      { y: Math.round(height * 0.62), w: barMaxW * 0.54, h: 4, c1: [16, 185, 129], c2: [0, 242, 254], a: 0.65 },
    ];

    for (const bar of rows) {
      for (let y = bar.y; y < bar.y + bar.h; y++) {
        for (let x = barStartX; x < barStartX + bar.w; x++) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            const d = roundedRectDist(x + 0.5, y + 0.5, barStartX, bar.y, bar.w, bar.h, bar.h / 2);
            if (d <= 0.5) {
              const t = (x - barStartX) / Math.max(1, bar.w);
              const aa = Math.max(0, Math.min(1, 0.5 - d)) * bar.a;
              blendPixel(
                rgba,
                (y * width + x) * 4,
                bar.c1[0] * (1 - t) + bar.c2[0] * t,
                bar.c1[1] * (1 - t) + bar.c2[1] * t,
                bar.c1[2] * (1 - t) + bar.c2[2] * t,
                aa
              );
            }
          }
        }
      }
    }
  }

  // 4. Composite scaled Protutech emblem with luminous white-cyan gradient
  if (srcIcon) {
    const scaleRatio = srcIcon.width / emblemSize;
    // Supersample for crisp downscaling at small sizes (44x44, 50x50)
    const subSamples = scaleRatio > 2.5 ? 3 : 2;

    for (let py = 0; py < emblemSize; py++) {
      for (let px = 0; px < emblemSize; px++) {
        const destX = emblemX + px;
        const destY = emblemY + py;
        if (destX < 0 || destX >= width || destY < 0 || destY >= height) continue;

        let inkSum = 0;
        for (let sy = 0; sy < subSamples; sy++) {
          for (let sx = 0; sx < subSamples; sx++) {
            const u = (px + (sx + 0.5) / subSamples) / emblemSize;
            const v = (py + (sy + 0.5) / subSamples) / emblemSize;
            inkSum += sampleEmblemInk(srcIcon, u * (srcIcon.width - 1), v * (srcIcon.height - 1));
          }
        }
        const ink = Math.min(1, (inkSum / (subSamples * subSamples)) * 1.25);

        if (ink > 0.02) {
          const v = py / emblemSize;
          // Crisp luminous white -> electric cyan -> sky blurple vertical sheen
          const fgR = 248 * (1 - v) + 56 * v;
          const fgG = 250 * (1 - v) + 225 * v;
          const fgB = 252 * (1 - v) + 254 * v;
          blendPixel(rgba, (destY * width + destX) * 4, fgR, fgG, fgB, ink);
        }
      }
    }
  } else {
    // Procedural fallback emblem if source icon not found
    const cx = emblemX + emblemSize / 2;
    const cy = emblemY + emblemSize / 2;
    const outerR = emblemSize * 0.42;
    const innerR = emblemSize * 0.24;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= outerR && d >= innerR) {
          blendPixel(rgba, (y * width + x) * 4, 0, 242, 254, 0.92);
        }
      }
    }
  }

  return encodeRGBAtoPNG(width, height, rgba);
}

function main() {
  const rootDir = path.resolve(__dirname, '..');
  const outDir = path.join(rootDir, 'build', 'appx');
  fs.mkdirSync(outDir, { recursive: true });

  const iconCandidates = [
    path.join(rootDir, 'electron', 'icon.png'),
    path.join(rootDir, 'public', 'protutech_logo.png'),
    path.join(rootDir, 'public', 'icon.png'),
  ];

  let srcIcon = null;
  for (const candidate of iconCandidates) {
    if (fs.existsSync(candidate)) {
      try {
        srcIcon = decodePNG(candidate);
        console.log(`Loaded source icon: ${path.relative(rootDir, candidate)} (${srcIcon.width}x${srcIcon.height})`);
        break;
      } catch (err) {
        console.warn(`Could not decode ${candidate}:`, err.message);
      }
    }
  }

  const targets = [
    { name: 'StoreLogo.png', width: 50, height: 50, emblemScale: 0.78, isWide: false },
    { name: 'Square44x44Logo.png', width: 44, height: 44, emblemScale: 0.78, isWide: false },
    { name: 'Square150x150Logo.png', width: 150, height: 150, emblemScale: 0.76, isWide: false },
    { name: 'Wide310x150Logo.png', width: 310, height: 150, emblemScale: 0.74, isWide: true },
  ];

  for (const t of targets) {
    const png = generateTile({
      width: t.width,
      height: t.height,
      emblemScale: t.emblemScale,
      srcIcon,
      isWide: t.isWide,
    });
    const outPath = path.join(outDir, t.name);
    fs.writeFileSync(outPath, png);
    const parsedW = png.readUInt32BE(16);
    const parsedH = png.readUInt32BE(20);
    console.log(`Generated ${t.name}: ${parsedW}x${parsedH} RGBA (${png.length} bytes) -> ${outPath}`);
  }
}

main();
