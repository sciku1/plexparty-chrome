/* PNGLib.js v1.0 */
!(function () {
  function i(i, t) {
    for (var s = 2; s < arguments.length; s++)
      for (var h = 0; h < arguments[s].length; h++)
        i[t++] = arguments[s].charAt(h);
  }
  function t(i) {
    return String.fromCharCode((i >> 8) & 255, 255 & i);
  }
  function s(i) {
    return String.fromCharCode(
      (i >> 24) & 255,
      (i >> 16) & 255,
      (i >> 8) & 255,
      255 & i
    );
  }
  function h(i) {
    return String.fromCharCode(255 & i, (i >> 8) & 255);
  }
  window.PNGlib = function (f, e, r) {
    (this.width = f),
      (this.height = e),
      (this.depth = r),
      (this.pix_size = e * (f + 1)),
      (this.data_size =
        2 +
        this.pix_size +
        5 * Math.floor((65534 + this.pix_size) / 65535) +
        4),
      (this.ihdr_offs = 0),
      (this.ihdr_size = 25),
      (this.plte_offs = this.ihdr_offs + this.ihdr_size),
      (this.plte_size = 8 + 3 * r + 4),
      (this.trns_offs = this.plte_offs + this.plte_size),
      (this.trns_size = 8 + r + 4),
      (this.idat_offs = this.trns_offs + this.trns_size),
      (this.idat_size = 8 + this.data_size + 4),
      (this.iend_offs = this.idat_offs + this.idat_size),
      (this.iend_size = 12),
      (this.buffer_size = this.iend_offs + this.iend_size),
      (this.buffer = new Array()),
      (this.palette = new Object()),
      (this.pindex = 0);
    for (var n = new Array(), o = 0; o < this.buffer_size; o++)
      this.buffer[o] = "\x00";
    i(
      this.buffer,
      this.ihdr_offs,
      s(this.ihdr_size - 12),
      "IHDR",
      s(f),
      s(e),
      "\b"
    ),
      i(this.buffer, this.plte_offs, s(this.plte_size - 12), "PLTE"),
      i(this.buffer, this.trns_offs, s(this.trns_size - 12), "tRNS"),
      i(this.buffer, this.idat_offs, s(this.idat_size - 12), "IDAT"),
      i(this.buffer, this.iend_offs, s(this.iend_size - 12), "IEND");
    var a = 30912;
    (a += 31 - (a % 31)), i(this.buffer, this.idat_offs + 8, t(a));
    for (var o = 0; (o << 16) - 1 < this.pix_size; o++) {
      var d, _;
      o + 65535 < this.pix_size
        ? ((d = 65535), (_ = "\x00"))
        : ((d = this.pix_size - (o << 16) - o), (_ = "")),
        i(
          this.buffer,
          this.idat_offs + 8 + 2 + (o << 16) + (o << 2),
          _,
          h(d),
          h(~d)
        );
    }
    for (var o = 0; 256 > o; o++) {
      for (var u = o, z = 0; 8 > z; z++)
        u =
          1 & u ? -306674912 ^ ((u >> 1) & 2147483647) : (u >> 1) & 2147483647;
      n[o] = u;
    }
    (this.index = function (i, t) {
      var s = t * (this.width + 1) + i + 1,
        h = this.idat_offs + 8 + 2 + 5 * Math.floor(s / 65535 + 1) + s;
      return h;
    }),
      (this.color = function (i, t, s, h) {
        h = h >= 0 ? h : 255;
        var f = (((((h << 8) | i) << 8) | t) << 8) | s;
        if ("undefined" == typeof this.palette[f]) {
          if (this.pindex == this.depth) return "\x00";
          var e = this.plte_offs + 8 + 3 * this.pindex;
          (this.buffer[e + 0] = String.fromCharCode(i)),
            (this.buffer[e + 1] = String.fromCharCode(t)),
            (this.buffer[e + 2] = String.fromCharCode(s)),
            (this.buffer[
              this.trns_offs + 8 + this.pindex
            ] = String.fromCharCode(h)),
            (this.palette[f] = String.fromCharCode(this.pindex++));
        }
        return this.palette[f];
      }),
      (this.getBase64 = function () {
        var i,
          t,
          s,
          h,
          f,
          e,
          r,
          n = this.getDump(),
          o =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
          a = n.length,
          d = 0,
          _ = "";
        do
          (i = n.charCodeAt(d)),
            (h = i >> 2),
            (t = n.charCodeAt(d + 1)),
            (f = ((3 & i) << 4) | (t >> 4)),
            (s = n.charCodeAt(d + 2)),
            (e = d + 2 > a ? 64 : ((15 & t) << 2) | (s >> 6)),
            (r = d + 3 > a ? 64 : 63 & s),
            (_ += o.charAt(h) + o.charAt(f) + o.charAt(e) + o.charAt(r));
        while ((d += 3) < a);
        return _;
      }),
      (this.getDump = function () {
        function t(t, h, f) {
          for (var e = -1, r = 4; f - 4 > r; r += 1)
            e = n[255 & (e ^ t[h + r].charCodeAt(0))] ^ ((e >> 8) & 16777215);
          i(t, h + f - 4, s(-1 ^ e));
        }
        for (
          var h = 65521, f = 5552, e = 1, r = 0, o = f, a = 0;
          a < this.height;
          a++
        )
          for (var d = -1; d < this.width; d++)
            (e += this.buffer[this.index(d, a)].charCodeAt(0)),
              (r += e),
              0 == (o -= 1) && ((e %= h), (r %= h), (o = f));
        return (
          (e %= h),
          (r %= h),
          i(this.buffer, this.idat_offs + this.idat_size - 8, s((r << 16) | e)),
          t(this.buffer, this.ihdr_offs, this.ihdr_size),
          t(this.buffer, this.plte_offs, this.plte_size),
          t(this.buffer, this.trns_offs, this.trns_size),
          t(this.buffer, this.idat_offs, this.idat_size),
          t(this.buffer, this.iend_offs, this.iend_size),
          "PNG\r\n\n" + this.buffer.join("")
        );
      });
  };
})();
