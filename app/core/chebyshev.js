(function () {
  const App = self.QNMApp;
  const nodeCache = new Map();
  const basisCache = new Map();

  function zeroPoly(order, ctx) {
    const poly = [];
    for (let index = 0; index <= order; index += 1) {
      poly.push(ctx.zero);
    }
    return poly;
  }

  function shiftPoly(poly, order, ctx) {
    const result = zeroPoly(order, ctx);
    for (let index = 0; index < order; index += 1) {
      result[index + 1] = poly[index];
    }
    return result;
  }

  function addPoly(a, b, ctx) {
    const order = Math.min(a.length, b.length) - 1;
    const result = zeroPoly(order, ctx);
    for (let index = 0; index <= order; index += 1) {
      result[index] = a[index].plus(b[index]);
    }
    return result;
  }

  function subPoly(a, b, ctx) {
    const order = Math.min(a.length, b.length) - 1;
    const result = zeroPoly(order, ctx);
    for (let index = 0; index <= order; index += 1) {
      result[index] = a[index].minus(b[index]);
    }
    return result;
  }

  function scalePoly(a, factor, ctx) {
    return a.map((value) => value.times(factor));
  }

  function chebyshevLobattoNodes(degree, ctx) {
    const cacheKey = `${ctx.precision}|${degree}`;
    if (nodeCache.has(cacheKey)) {
      return nodeCache.get(cacheKey);
    }
    const nodes = [];
    if (degree === 0) {
      const result = [ctx.one];
      nodeCache.set(cacheKey, result);
      return result;
    }
    for (let index = 0; index <= degree; index += 1) {
      const angle = ctx.pi.times(index).div(degree);
      nodes.push(angle.cos());
    }
    nodeCache.set(cacheKey, nodes);
    return nodes;
  }

  function chebyshevCoefficients(values, nodes, ctx) {
    const degree = values.length - 1;
    if (degree === 0) {
      return [values[0]];
    }
    const sums = [];
    for (let index = 0; index <= degree; index += 1) {
      sums.push(ctx.zero);
    }
    for (let j = 0; j <= degree; j += 1) {
      const weight = j === 0 || j === degree ? ctx.half : ctx.one;
      const scaledValue = values[j].times(weight);
      const x = nodes[j];
      let tPrev = ctx.one;
      sums[0] = sums[0].plus(scaledValue);
      if (degree >= 1) {
        let tCurr = x;
        sums[1] = sums[1].plus(scaledValue.times(tCurr));
        for (let k = 2; k <= degree; k += 1) {
          const tNext = ctx.two.times(x).times(tCurr).minus(tPrev);
          sums[k] = sums[k].plus(scaledValue.times(tNext));
          tPrev = tCurr;
          tCurr = tNext;
        }
      }
    }
    const coefficients = [];
    for (let k = 0; k <= degree; k += 1) {
      const raw = sums[k].times(ctx.two).div(degree);
      coefficients.push(k === 0 || k === degree ? raw.div(ctx.two) : raw);
    }
    return coefficients;
  }

  function chebyshevPowerBasis(maxDegree, maxOrder, ctx) {
    const cacheKey = `${ctx.precision}|${maxDegree}|${maxOrder}`;
    if (basisCache.has(cacheKey)) {
      return basisCache.get(cacheKey);
    }
    const basis = [];
    const t0 = zeroPoly(maxOrder, ctx);
    t0[0] = ctx.one;
    basis.push(t0);
    if (maxDegree === 0) {
      basisCache.set(cacheKey, basis);
      return basis;
    }
    const t1 = zeroPoly(maxOrder, ctx);
    if (maxOrder >= 1) {
      t1[1] = ctx.one;
    }
    basis.push(t1);
    for (let degree = 1; degree < maxDegree; degree += 1) {
      const next = subPoly(scalePoly(shiftPoly(basis[degree], maxOrder, ctx), ctx.two, ctx), basis[degree - 1], ctx);
      basis.push(next);
    }
    basisCache.set(cacheKey, basis);
    return basis;
  }

  function powerCoefficientsFromChebyshev(coefficients, maxOrder, ctx) {
    const basis = chebyshevPowerBasis(coefficients.length - 1, maxOrder, ctx);
    const result = zeroPoly(maxOrder, ctx);
    for (let index = 0; index < coefficients.length; index += 1) {
      const scaled = scalePoly(basis[index], coefficients[index], ctx);
      for (let power = 0; power <= maxOrder; power += 1) {
        result[power] = result[power].plus(scaled[power]);
      }
    }
    return result;
  }

  function tailRatio(coefficients, ctx) {
    const scale = App.Numerics.absMax(ctx, coefficients);
    if (scale.isZero()) {
      return ctx.zero;
    }
    const tail = coefficients.slice(Math.max(0, coefficients.length - 6));
    return App.Numerics.absMax(ctx, tail).div(scale);
  }

  function differentiateCoefficients(coefficients, ctx) {
    const degree = coefficients.length - 1;
    if (degree <= 0) {
      return [ctx.zero];
    }
    const derivative = [];
    for (let index = 0; index < degree; index += 1) {
      derivative.push(ctx.zero);
    }
    derivative[degree - 1] = ctx.two.times(degree).times(coefficients[degree]);
    if (degree > 1) {
      derivative[degree - 2] = ctx.two.times(degree - 1).times(coefficients[degree - 1]);
      for (let index = degree - 3; index >= 0; index -= 1) {
        derivative[index] = derivative[index + 2].plus(ctx.two.times(index + 1).times(coefficients[index + 1]));
      }
    }
    derivative[0] = derivative[0].div(ctx.two);
    return derivative;
  }

  function evaluateAtZero(coefficients, ctx) {
    let value = ctx.zero;
    for (let index = 0; index < coefficients.length; index += 2) {
      value = index % 4 === 0 ? value.plus(coefficients[index]) : value.minus(coefficients[index]);
    }
    return value;
  }

  function jetFromCoefficients(coefficients, delta, maxOrder, ctx) {
    const jet = [evaluateAtZero(coefficients, ctx)];
    let current = coefficients;
    let deltaPower = ctx.one;
    let factorial = ctx.one;
    for (let order = 1; order <= maxOrder; order += 1) {
      current = differentiateCoefficients(current, ctx);
      deltaPower = deltaPower.times(delta);
      factorial = factorial.times(order);
      jet.push(evaluateAtZero(current, ctx).div(deltaPower.times(factorial)));
    }
    return jet;
  }

  function jetFromPower(power, delta, ctx) {
    const jet = [];
    let deltaPower = ctx.one;
    for (let index = 0; index < power.length; index += 1) {
      jet.push(power[index].div(deltaPower));
      deltaPower = deltaPower.times(delta);
    }
    return jet;
  }

  function analyzeFunction(fn, center, delta, degree, maxOrder, ctx) {
    const nodes = chebyshevLobattoNodes(degree, ctx);
    const values = nodes.map((node) => fn(center.plus(delta.times(node))));
    const coefficients = chebyshevCoefficients(values, nodes, ctx);
    return {
      center,
      delta,
      degree,
      nodes,
      values,
      coefficients,
      jet: jetFromCoefficients(coefficients, delta, maxOrder, ctx),
      tailRatio: tailRatio(coefficients, ctx)
    };
  }

  function jetDifference(a, b, startIndex, ctx) {
    let worst = ctx.zero;
    for (let index = startIndex; index < Math.min(a.length, b.length); index += 1) {
      const diff = App.Numerics.relativeDifference(ctx, a[index], b[index]);
      if (diff.greaterThan(worst)) {
        worst = diff;
      }
    }
    return worst;
  }

  function adaptiveCollocation(fn, center, initialDelta, maxOrder, baseDegree, ctx, options) {
    const deltaFactors = options && options.deltaFactors ? options.deltaFactors : [ctx.one, new ctx.D("0.75"), new ctx.D("0.5")];
    const extraNodes = options && options.extraNodes ? options.extraNodes : 16;
    const targetScore = options && options.targetScore
      ? new ctx.D(options.targetScore)
      : ctx.ten.pow(-Math.max(12, Math.floor(ctx.precision / 3)));
    const candidates = [];
    for (const factor of deltaFactors) {
      const delta = initialDelta.times(factor);
      const low = analyzeFunction(fn, center, delta, baseDegree, maxOrder, ctx);
      const high = analyzeFunction(fn, center, delta, baseDegree + extraNodes, maxOrder, ctx);
      const stability = jetDifference(low.jet, high.jet, 2, ctx);
      const score = App.Numerics.dmax(ctx, low.tailRatio, high.tailRatio, stability);
      candidates.push({
        delta,
        low,
        high,
        stability,
        score
      });
      if (score.lessThanOrEqualTo(targetScore)) {
        return {
          delta,
          degree: high.degree,
          jet: high.jet,
          coefficients: high.coefficients,
          stability,
          tailRatio: high.tailRatio,
          candidates
        };
      }
    }
    candidates.sort((left, right) => left.score.comparedTo(right.score));
    const best = candidates[0];
    return {
      delta: best.delta,
      degree: best.high.degree,
      jet: best.high.jet,
      coefficients: best.high.coefficients,
      stability: best.stability,
      tailRatio: best.high.tailRatio,
      candidates
    };
  }

  App.Chebyshev = {
    chebyshevLobattoNodes,
    chebyshevCoefficients,
    powerCoefficientsFromChebyshev,
    analyzeFunction,
    adaptiveCollocation,
    jetDifference
  };
})();
