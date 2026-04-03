(function () {
  const App = self.QNMApp;

  function createContext(precision) {
    const D = self.Decimal.clone({
      precision,
      rounding: self.Decimal.ROUND_HALF_EVEN,
      toExpNeg: -1e9,
      toExpPos: 1e9,
      modulo: self.Decimal.EUCLID,
      crypto: false
    });
    const pi = D.acos(-1);
    return {
      D,
      precision,
      zero: new D(0),
      one: new D(1),
      two: new D(2),
      half: new D(0.5),
      three: new D(3),
      four: new D(4),
      five: new D(5),
      six: new D(6),
      eight: new D(8),
      ten: new D(10),
      pi
    };
  }

  function dmax(ctx, ...values) {
    if (!values.length) {
      return ctx.zero;
    }
    let best = values[0];
    for (let index = 1; index < values.length; index += 1) {
      if (values[index].greaterThan(best)) {
        best = values[index];
      }
    }
    return best;
  }

  function dmin(ctx, ...values) {
    if (!values.length) {
      return ctx.zero;
    }
    let best = values[0];
    for (let index = 1; index < values.length; index += 1) {
      if (values[index].lessThan(best)) {
        best = values[index];
      }
    }
    return best;
  }

  function absMax(ctx, values) {
    let best = ctx.zero;
    for (const value of values) {
      const current = value.abs();
      if (current.greaterThan(best)) {
        best = current;
      }
    }
    return best;
  }

  function pow10(ctx, exponent) {
    return ctx.ten.pow(exponent);
  }

  function scaleEpsilon(ctx, scale) {
    const floorDigits = Math.max(10, Math.min(32, Math.floor(ctx.precision / 2)));
    const absolute = pow10(ctx, -floorDigits);
    const relative = scale.abs().plus(ctx.one).times(pow10(ctx, -Math.max(8, Math.min(24, floorDigits - 4))));
    return absolute.greaterThan(relative) ? absolute : relative;
  }

  function toPlain(value) {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    return value.toString();
  }

  class ComplexDecimal {
    constructor(re, im) {
      this.re = re;
      this.im = im;
    }

    add(other) {
      return new ComplexDecimal(this.re.plus(other.re), this.im.plus(other.im));
    }

    sub(other) {
      return new ComplexDecimal(this.re.minus(other.re), this.im.minus(other.im));
    }

    neg() {
      return new ComplexDecimal(this.re.neg(), this.im.neg());
    }

    scale(factor) {
      return new ComplexDecimal(this.re.times(factor), this.im.times(factor));
    }

    mul(other) {
      return new ComplexDecimal(
        this.re.times(other.re).minus(this.im.times(other.im)),
        this.re.times(other.im).plus(this.im.times(other.re))
      );
    }

    div(other) {
      const denom = other.re.times(other.re).plus(other.im.times(other.im));
      return new ComplexDecimal(
        this.re.times(other.re).plus(this.im.times(other.im)).div(denom),
        this.im.times(other.re).minus(this.re.times(other.im)).div(denom)
      );
    }

    abs(ctx) {
      return this.re.times(this.re).plus(this.im.times(this.im)).sqrt();
    }

    sqrt(ctx) {
      if (this.im.isZero()) {
        if (this.re.isNegative()) {
          return new ComplexDecimal(ctx.zero, this.re.neg().sqrt());
        }
        return new ComplexDecimal(this.re.sqrt(), ctx.zero);
      }
      const modulus = this.abs(ctx);
      const rePart = modulus.plus(this.re).div(ctx.two).sqrt();
      const imMagnitude = modulus.minus(this.re).div(ctx.two).sqrt();
      const imPart = this.im.isNegative() ? imMagnitude.neg() : imMagnitude;
      return new ComplexDecimal(rePart, imPart);
    }

    exp(ctx) {
      const expRe = this.re.exp();
      return new ComplexDecimal(
        expRe.times(this.im.cos()),
        expRe.times(this.im.sin())
      );
    }
  }

  function chooseQnmBranch(z, ctx) {
    let root = z.sqrt(ctx);
    if (root.re.isNegative()) {
      root = root.neg();
    }
    return root;
  }

  function decimalRangeFromSpec(spec, ctx) {
    const D = ctx.D;
    if (spec.mode === "value") {
      return [new D(spec.value)];
    }
    const start = new D(spec.start);
    const end = new D(spec.end);
    const count = Math.max(2, Number(spec.count || 2));
    if (count === 1) {
      return [start];
    }
    const step = end.minus(start).div(new D(count - 1));
    const result = [];
    for (let index = 0; index < count; index += 1) {
      result.push(start.plus(step.times(index)));
    }
    return result;
  }

  function cartesianGrid(entries) {
    if (!entries.length) {
      return [{}];
    }
    let rows = [{}];
    for (const entry of entries) {
      const next = [];
      for (const row of rows) {
        for (const value of entry.values) {
          const clone = Object.assign({}, row);
          clone[entry.name] = value;
          next.push(clone);
        }
      }
      rows = next;
    }
    return rows;
  }

  function buildLinearGrid(minValue, maxValue, count, ctx) {
    const D = ctx.D;
    const total = Math.max(2, count);
    if (total === 2) {
      return [minValue, maxValue];
    }
    const step = maxValue.minus(minValue).div(new D(total - 1));
    const result = [];
    for (let index = 0; index < total; index += 1) {
      result.push(minValue.plus(step.times(index)));
    }
    return result;
  }

  function buildSampleGrid(minValue, maxValue, count, ctx) {
    const linear = buildLinearGrid(minValue, maxValue, count, ctx);
    const points = linear.slice();
    if (minValue.greaterThan(ctx.zero) && maxValue.greaterThan(minValue) && count >= 8) {
      const logCount = Math.max(6, Math.floor(count / 2));
      const ratio = maxValue.div(minValue).pow(new ctx.D(1).div(new ctx.D(logCount - 1)));
      let current = minValue;
      for (let index = 0; index < logCount; index += 1) {
        points.push(current);
        current = current.times(ratio);
      }
    }
    points.sort((a, b) => a.comparedTo(b));
    const unique = [];
    const tolerance = scaleEpsilon(ctx, maxValue.minus(minValue));
    for (const point of points) {
      if (!unique.length || point.minus(unique[unique.length - 1]).abs().greaterThan(tolerance)) {
        unique.push(point);
      }
    }
    if (unique[0].greaterThan(minValue)) {
      unique.unshift(minValue);
    }
    if (unique[unique.length - 1].lessThan(maxValue)) {
      unique.push(maxValue);
    }
    return unique;
  }

  function refineBisection(fn, left, right, ctx, maxIterations) {
    let a = left;
    let b = right;
    let fa = fn(a);
    let fb = fn(b);
    if (fa.isZero()) {
      return a;
    }
    if (fb.isZero()) {
      return b;
    }
    if (fa.isPositive() === fb.isPositive()) {
      throw new Error("The interval does not contain a sign change.");
    }
    const tolerance = scaleEpsilon(ctx, b.minus(a));
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const mid = a.plus(b).div(ctx.two);
      const fm = fn(mid);
      if (fm.isZero() || b.minus(a).abs().lessThan(tolerance)) {
        return mid;
      }
      if (fa.isPositive() === fm.isPositive()) {
        a = mid;
        fa = fm;
      } else {
        b = mid;
        fb = fm;
      }
    }
    return a.plus(b).div(ctx.two);
  }

  function goldenMaximum(fn, left, right, ctx, maxIterations, toleranceOverride) {
    const gr = new ctx.D("0.61803398874989484820458683436563811772030917980576");
    let a = left;
    let b = right;
    let c = b.minus(b.minus(a).times(gr));
    let d = a.plus(b.minus(a).times(gr));
    let fc = fn(c);
    let fd = fn(d);
    const tolerance = toleranceOverride || scaleEpsilon(ctx, b.minus(a));
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      if (b.minus(a).abs().lessThan(tolerance)) {
        break;
      }
      if (fc.greaterThan(fd)) {
        b = d;
        d = c;
        fd = fc;
        c = b.minus(b.minus(a).times(gr));
        fc = fn(c);
      } else {
        a = c;
        c = d;
        fc = fd;
        d = a.plus(b.minus(a).times(gr));
        fd = fn(d);
      }
    }
    const point = a.plus(b).div(ctx.two);
    return {
      point,
      value: fn(point),
      finalWidth: b.minus(a).abs(),
      tolerance
    };
  }

  function simpsonEstimate(fa, fm, fb, interval, ctx) {
    return interval.times(fa.plus(fb).plus(fm.times(ctx.four))).div(ctx.six || new ctx.D(6));
  }

  function adaptiveSimpson(fn, left, right, ctx, tolerance, maxDepth) {
    const interval = right.minus(left);
    const mid = left.plus(right).div(ctx.two);
    const fa = fn(left);
    const fm = fn(mid);
    const fb = fn(right);
    const whole = simpsonEstimate(fa, fm, fb, interval, ctx);
    const limit = tolerance || scaleEpsilon(ctx, interval);
    const depth = maxDepth || 18;

    function recurse(a, b, fa0, fm0, fb0, whole0, eps, remaining) {
      const m = a.plus(b).div(ctx.two);
      const leftMid = a.plus(m).div(ctx.two);
      const rightMid = m.plus(b).div(ctx.two);
      const fLeftMid = fn(leftMid);
      const fRightMid = fn(rightMid);
      const leftPart = simpsonEstimate(fa0, fLeftMid, fm0, m.minus(a), ctx);
      const rightPart = simpsonEstimate(fm0, fRightMid, fb0, b.minus(m), ctx);
      const delta = leftPart.plus(rightPart).minus(whole0).abs();
      if (remaining <= 0 || delta.lessThan(eps.times(15))) {
        return leftPart.plus(rightPart).plus(leftPart.plus(rightPart).minus(whole0).div(15));
      }
      const next = eps.div(ctx.two);
      return recurse(a, m, fa0, fLeftMid, fm0, leftPart, next, remaining - 1).plus(
        recurse(m, b, fm0, fRightMid, fb0, rightPart, next, remaining - 1)
      );
    }

    return recurse(left, right, fa, fm, fb, whole, limit, depth);
  }

  function relativeDifference(ctx, a, b) {
    const denom = dmax(ctx, ctx.one, a.abs(), b.abs());
    return a.minus(b).abs().div(denom);
  }

  function mergeClose(values, ctx) {
    const sorted = values.slice().sort((a, b) => a.comparedTo(b));
    const merged = [];
    const scale = sorted.length ? sorted[sorted.length - 1].abs().plus(ctx.one) : ctx.one;
    const tolerance = scaleEpsilon(ctx, scale);
    for (const value of sorted) {
      if (!merged.length || value.minus(merged[merged.length - 1]).abs().greaterThan(tolerance)) {
        merged.push(value);
      }
    }
    return merged;
  }

  App.Numerics = {
    createContext,
    ComplexDecimal,
    chooseQnmBranch,
    dmax,
    dmin,
    absMax,
    pow10,
    scaleEpsilon,
    toPlain,
    decimalRangeFromSpec,
    cartesianGrid,
    buildLinearGrid,
    buildSampleGrid,
    refineBisection,
    goldenMaximum,
    adaptiveSimpson,
    relativeDifference,
    mergeClose
  };
})();
