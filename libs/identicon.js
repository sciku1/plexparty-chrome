/* Identicon.js v1.0 */
!(function () {
  (Identicon = function (n, t, r) {
    (this.hash = n), (this.size = t || 64), (this.margin = r || 0);
  }),
    (Identicon.prototype = {
      hash: null,
      size: null,
      margin: null,
      render: function () {
        var n,
          t,
          r = this.hash,
          e = this.size,
          i = Math.floor(e * this.margin),
          s = Math.floor((e - 2 * i) / 5),
          o = new PNGlib(e, e, 256),
          h = o.color(0, 0, 0, 0),
          a = this.hsl2rgb(parseInt(r.substr(-7), 16) / 268435455, 0.5, 0.7),
          c = o.color(255 * a[0], 255 * a[1], 255 * a[2]);
        for (n = 0; 15 > n; n++)
          (t = parseInt(r.charAt(n), 16) % 2 ? h : c),
            5 > n
              ? this.rectangle(2 * s + i, n * s + i, s, s, t, o)
              : 10 > n
              ? (this.rectangle(1 * s + i, (n - 5) * s + i, s, s, t, o),
                this.rectangle(3 * s + i, (n - 5) * s + i, s, s, t, o))
              : 15 > n &&
                (this.rectangle(0 * s + i, (n - 10) * s + i, s, s, t, o),
                this.rectangle(4 * s + i, (n - 10) * s + i, s, s, t, o));
        return o;
      },
      rectangle: function (n, t, r, e, i, s) {
        var o, h;
        for (o = n; n + r > o; o++)
          for (h = t; t + e > h; h++) s.buffer[s.index(o, h)] = i;
      },
      hsl2rgb: function (n, t, r) {
        return (
          (n *= 6),
          (t = [
            (r += t *= 0.5 > r ? r : 1 - r),
            r - (n % 1) * t * 2,
            (r -= t *= 2),
            r,
            r + (n % 1) * t,
            r + t,
          ]),
          [t[~~n % 6], t[(16 | n) % 6], t[(8 | n) % 6]]
        );
      },
      toString: function () {
        return this.render().getBase64();
      },
    }),
    (window.Identicon = Identicon);
})();
