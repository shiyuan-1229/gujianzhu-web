/** 源自 splendid-china-3d / utils/noise.js */
var F2 = 0.5 * (Math.sqrt(3) - 1);
var G2 = (3 - Math.sqrt(3)) / 6;

var grad3 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1]
];

export function createNoise2D(seed) {
  seed = seed || 42;
  var perm = new Uint8Array(512);
  var p = new Uint8Array(256);
  var s = seed;

  function rand() {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  }

  var i;
  for (i = 0; i < 256; i++) p[i] = i;
  for (i = 255; i > 0; i--) {
    var j = Math.floor(rand() * (i + 1));
    var tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  for (i = 0; i < 512; i++) perm[i] = p[i & 255];

  return function noise2D(x, y) {
    var sx = (x + y) * F2;
    var ix = Math.floor(x + sx);
    var iy = Math.floor(y + sx);
    var t = (ix + iy) * G2;
    var X0 = ix - t;
    var Y0 = iy - t;
    var x0 = x - X0;
    var y0 = y - Y0;
    var i1;
    var j1;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }
    var x1 = x0 - i1 + G2;
    var y1 = y0 - j1 + G2;
    var x2 = x0 - 1.0 + 2.0 * G2;
    var y2 = y0 - 1.0 + 2.0 * G2;
    var ii = ix & 255;
    var jj = iy & 255;
    var n0 = 0;
    var n1 = 0;
    var n2 = 0;
    var t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      var g0 = grad3[perm[ii + perm[jj]] % 8];
      n0 = t0 * t0 * (g0[0] * x0 + g0[1] * y0);
    }
    t0 = 0.5 - x1 * x1 - y1 * y1;
    if (t0 >= 0) {
      t0 *= t0;
      var g1 = grad3[perm[ii + i1 + perm[jj + j1]] % 8];
      n1 = t0 * t0 * (g1[0] * x1 + g1[1] * y1);
    }
    t0 = 0.5 - x2 * x2 - y2 * y2;
    if (t0 >= 0) {
      t0 *= t0;
      var g2 = grad3[perm[ii + 1 + perm[jj + 1]] % 8];
      n2 = t0 * t0 * (g2[0] * x2 + g2[1] * y2);
    }
    return 70.0 * (n0 + n1 + n2);
  };
}

export function fbm(noiseFn, x, y, octaves, lacunarity, gain) {
  octaves = octaves || 6;
  lacunarity = lacunarity || 2.0;
  gain = gain || 0.5;
  var value = 0;
  var amplitude = 1;
  var frequency = 1;
  var maxVal = 0;
  var o;
  for (o = 0; o < octaves; o++) {
    value += amplitude * noiseFn(x * frequency, y * frequency);
    maxVal += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return value / maxVal;
}
