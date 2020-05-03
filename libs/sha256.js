/* SHA256 (Chris Veness) */
var Sha256 = {};
(Sha256.hash = function (t) {
  t = t.utf8Encode();
  var r = [
      1116352408,
      1899447441,
      3049323471,
      3921009573,
      961987163,
      1508970993,
      2453635748,
      2870763221,
      3624381080,
      310598401,
      607225278,
      1426881987,
      1925078388,
      2162078206,
      2614888103,
      3248222580,
      3835390401,
      4022224774,
      264347078,
      604807628,
      770255983,
      1249150122,
      1555081692,
      1996064986,
      2554220882,
      2821834349,
      2952996808,
      3210313671,
      3336571891,
      3584528711,
      113926993,
      338241895,
      666307205,
      773529912,
      1294757372,
      1396182291,
      1695183700,
      1986661051,
      2177026350,
      2456956037,
      2730485921,
      2820302411,
      3259730800,
      3345764771,
      3516065817,
      3600352804,
      4094571909,
      275423344,
      430227734,
      506948616,
      659060556,
      883997877,
      958139571,
      1322822218,
      1537002063,
      1747873779,
      1955562222,
      2024104815,
      2227730452,
      2361852424,
      2428436474,
      2756734187,
      3204031479,
      3329325298,
    ],
    e = [
      1779033703,
      3144134277,
      1013904242,
      2773480762,
      1359893119,
      2600822924,
      528734635,
      1541459225,
    ];
  t += String.fromCharCode(128);
  for (
    var n = t.length / 4 + 2, o = Math.ceil(n / 16), a = new Array(o), h = 0;
    o > h;
    h++
  ) {
    a[h] = new Array(16);
    for (var S = 0; 16 > S; S++)
      a[h][S] =
        (t.charCodeAt(64 * h + 4 * S) << 24) |
        (t.charCodeAt(64 * h + 4 * S + 1) << 16) |
        (t.charCodeAt(64 * h + 4 * S + 2) << 8) |
        t.charCodeAt(64 * h + 4 * S + 3);
  }
  (a[o - 1][14] = (8 * (t.length - 1)) / Math.pow(2, 32)),
    (a[o - 1][14] = Math.floor(a[o - 1][14])),
    (a[o - 1][15] = (8 * (t.length - 1)) & 4294967295);
  for (var u, f, c, i, d, R, p, y, x = new Array(64), h = 0; o > h; h++) {
    for (var O = 0; 16 > O; O++) x[O] = a[h][O];
    for (var O = 16; 64 > O; O++)
      x[O] =
        (Sha256.σ1(x[O - 2]) + x[O - 7] + Sha256.σ0(x[O - 15]) + x[O - 16]) &
        4294967295;
    (u = e[0]),
      (f = e[1]),
      (c = e[2]),
      (i = e[3]),
      (d = e[4]),
      (R = e[5]),
      (p = e[6]),
      (y = e[7]);
    for (var O = 0; 64 > O; O++) {
      var T = y + Sha256.Σ1(d) + Sha256.Ch(d, R, p) + r[O] + x[O],
        s = Sha256.Σ0(u) + Sha256.Maj(u, f, c);
      (y = p),
        (p = R),
        (R = d),
        (d = (i + T) & 4294967295),
        (i = c),
        (c = f),
        (f = u),
        (u = (T + s) & 4294967295);
    }
    (e[0] = (e[0] + u) & 4294967295),
      (e[1] = (e[1] + f) & 4294967295),
      (e[2] = (e[2] + c) & 4294967295),
      (e[3] = (e[3] + i) & 4294967295),
      (e[4] = (e[4] + d) & 4294967295),
      (e[5] = (e[5] + R) & 4294967295),
      (e[6] = (e[6] + p) & 4294967295),
      (e[7] = (e[7] + y) & 4294967295);
  }
  return (
    Sha256.toHexStr(e[0]) +
    Sha256.toHexStr(e[1]) +
    Sha256.toHexStr(e[2]) +
    Sha256.toHexStr(e[3]) +
    Sha256.toHexStr(e[4]) +
    Sha256.toHexStr(e[5]) +
    Sha256.toHexStr(e[6]) +
    Sha256.toHexStr(e[7])
  );
}),
  (Sha256.ROTR = function (t, r) {
    return (r >>> t) | (r << (32 - t));
  }),
  (Sha256.Σ0 = function (t) {
    return Sha256.ROTR(2, t) ^ Sha256.ROTR(13, t) ^ Sha256.ROTR(22, t);
  }),
  (Sha256.Σ1 = function (t) {
    return Sha256.ROTR(6, t) ^ Sha256.ROTR(11, t) ^ Sha256.ROTR(25, t);
  }),
  (Sha256.σ0 = function (t) {
    return Sha256.ROTR(7, t) ^ Sha256.ROTR(18, t) ^ (t >>> 3);
  }),
  (Sha256.σ1 = function (t) {
    return Sha256.ROTR(17, t) ^ Sha256.ROTR(19, t) ^ (t >>> 10);
  }),
  (Sha256.Ch = function (t, r, e) {
    return (t & r) ^ (~t & e);
  }),
  (Sha256.Maj = function (t, r, e) {
    return (t & r) ^ (t & e) ^ (r & e);
  }),
  (Sha256.toHexStr = function (t) {
    for (var r, e = "", n = 7; n >= 0; n--)
      (r = (t >>> (4 * n)) & 15), (e += r.toString(16));
    return e;
  }),
  "undefined" == typeof String.prototype.utf8Encode &&
    (String.prototype.utf8Encode = function () {
      return unescape(encodeURIComponent(this));
    }),
  "undefined" == typeof String.prototype.utf8Decode &&
    (String.prototype.utf8Decode = function () {
      try {
        return decodeURIComponent(escape(this));
      } catch (t) {
        return this;
      }
    }),
  "undefined" != typeof module && module.exports && (module.exports = Sha256),
  "function" == typeof define &&
    define.amd &&
    define([], function () {
      return Sha256;
    });
