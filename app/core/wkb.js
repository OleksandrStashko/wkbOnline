(function () {
  const App = self.QNMApp;
  const preparedDataCache = new Map();

  function prepareData(ctx, maxOrder) {
    const requestedOrder = Math.max(1, Math.min(Number(maxOrder || App.WKBData.maxOrder), App.WKBData.maxOrder));
    const cacheKey = `${ctx.precision}|${requestedOrder}`;
    if (preparedDataCache.has(cacheKey)) {
      return preparedDataCache.get(cacheKey);
    }
    const orders = App.WKBData.orders.slice(0, requestedOrder).map((entry) => {
      if (entry.order === 1) {
        return {
          order: 1,
          oddFactor: "eikonal",
          maxPowers: [1]
        };
      }
      return {
        order: entry.order,
        oddFactor: entry.oddFactor,
        v2Power: entry.v2Power,
        denConst: new ctx.D(entry.denConst),
        groups: prepareGroups(entry, ctx),
        maxPowers: collectMaxPowers(entry)
      };
    });
    const preparedData = {
      maxOrder: App.WKBData.maxOrder,
      orders,
      sharedMaxPowers: mergeMaxPowers(orders)
    };
    preparedDataCache.set(cacheKey, preparedData);
    return preparedData;
  }

  function termFactors(term) {
    if (term.factors) {
      return term.factors;
    }
    return term.powers
      .map((power, index) => (power === 0 ? null : [index, power]))
      .filter(Boolean);
  }

  function factorKey(factors) {
    return factors.map((factor) => `${factor[0]}:${factor[1]}`).join("|");
  }

  function groupTerms(entry, ctx) {
    const groups = new Map();
    for (const term of entry.terms) {
      const coeff = new ctx.D(term.coeff);
      let kPower = 0;
      const rest = [];
      for (const factor of termFactors(term)) {
        if (factor[0] === 0) {
          kPower += factor[1];
        } else {
          rest.push([factor[0], factor[1]]);
        }
      }
      const key = factorKey(rest);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          factors: rest.map((factor) => ({ index: factor[0], power: factor[1] })),
          coeffs: []
        });
      }
      const group = groups.get(key);
      group.coeffs[kPower] = (group.coeffs[kPower] || ctx.zero).plus(coeff);
    }
    return Array.from(groups.values());
  }

  function prepareGroups(entry, ctx) {
    if (!entry.groups) {
      return groupTerms(entry, ctx);
    }
    return entry.groups.map((group) => ({
      key: group.key || factorKey(group.factors || []),
      factors: (group.factors || []).map((factor) => ({ index: factor[0], power: factor[1] })),
      coeffs: (group.coeffs || []).map((coeff) => (coeff == null ? null : new ctx.D(coeff)))
    }));
  }

  function collectMaxPowers(entry) {
    const maxPowers = [];
    if (entry.terms) {
      for (const term of entry.terms) {
        for (const factor of termFactors(term)) {
          maxPowers[factor[0]] = Math.max(maxPowers[factor[0]] || 0, factor[1]);
        }
      }
    } else if (entry.groups) {
      for (const group of entry.groups) {
        for (const factor of group.factors || []) {
          maxPowers[factor[0]] = Math.max(maxPowers[factor[0]] || 0, factor[1]);
        }
        const kDegree = (group.coeffs || []).length - 1;
        if (kDegree >= 0) {
          maxPowers[0] = Math.max(maxPowers[0] || 0, kDegree);
        }
      }
    }
    maxPowers[1] = Math.max(maxPowers[1] || 0, entry.v2Power || 0);
    return maxPowers;
  }

  function buildVariablePowers(variables, maxPowers, ctx) {
    return variables.map((value, index) => {
      const maxPower = maxPowers[index] || 0;
      if (maxPower <= 0) {
        return null;
      }
      const powers = [ctx.one, value];
      for (let power = 2; power <= maxPower; power += 1) {
        powers[power] = powers[power - 1].times(value);
      }
      return powers;
    });
  }

  function buildFixedVariablePowers(derivatives, maxPowers, ctx) {
    const powers = [null];
    for (let index = 1; index < maxPowers.length; index += 1) {
      const maxPower = maxPowers[index] || 0;
      if (maxPower <= 0) {
        powers[index] = null;
        continue;
      }
      const value = derivatives[index + 1];
      const table = [ctx.one, value];
      for (let power = 2; power <= maxPower; power += 1) {
        table[power] = table[power - 1].times(value);
      }
      powers[index] = table;
    }
    return powers;
  }

  function mergeMaxPowers(orderDataList) {
    const maxPowers = [];
    for (const orderData of orderDataList) {
      const orderPowers = orderData.maxPowers || [];
      for (let index = 0; index < orderPowers.length; index += 1) {
        maxPowers[index] = Math.max(maxPowers[index] || 0, orderPowers[index] || 0);
      }
    }
    return maxPowers;
  }

  function evaluatePolynomial(orderData, variablePowers, ctx) {
    let numerator = ctx.zero;
    for (const group of orderData.groups) {
      let monomial = ctx.one;
      for (const factor of group.factors) {
        monomial = monomial.times(variablePowers[factor.index][factor.power]);
      }
      for (let index = 0; index < group.coeffs.length; index += 1) {
        if (!group.coeffs[index]) {
          continue;
        }
        numerator = numerator.plus(group.coeffs[index].times(monomial).times(variablePowers[0][index] || ctx.one));
      }
    }
    return numerator.div(orderData.denConst.times(variablePowers[1][orderData.v2Power]));
  }

  function barrierScale(variables, ctx) {
    const v2 = variables[1];
    if (!v2.isNegative()) {
      throw new Error("WKB requires V''(r*_0) < 0.");
    }
    return variables[0].times(v2.times(-2).sqrt());
  }

  function contribution(orderData, variables, variablePowers, ctx) {
    if (orderData.order === 1) {
      return new App.Numerics.ComplexDecimal(ctx.zero, barrierScale(variables, ctx).neg());
    }
    const normalized = evaluatePolynomial(orderData, variablePowers, ctx);
    if (orderData.oddFactor === "barrier") {
      return new App.Numerics.ComplexDecimal(ctx.zero, barrierScale(variables, ctx).times(normalized).neg());
    }
    return new App.Numerics.ComplexDecimal(normalized, ctx.zero);
  }

  function polynomialMaxDegree(coeffs) {
    for (let degree = coeffs.length - 1; degree >= 0; degree -= 1) {
      if (coeffs[degree] && !coeffs[degree].isZero()) {
        return degree;
      }
    }
    return 0;
  }

  function evaluateRealPolynomial(coeffs, x, ctx) {
    const degree = polynomialMaxDegree(coeffs);
    let value = ctx.zero;
    for (let index = degree; index >= 0; index -= 1) {
      value = value.times(x).plus(coeffs[index] || ctx.zero);
    }
    return value;
  }

  function complexFromReal(value, ctx) {
    return new App.Numerics.ComplexDecimal(value, ctx.zero);
  }

  function complexFromImag(value, ctx) {
    return new App.Numerics.ComplexDecimal(ctx.zero, value);
  }

  function complexPolynomialDegree(coeffs, ctx) {
    for (let degree = coeffs.length - 1; degree >= 0; degree -= 1) {
      const coeff = coeffs[degree];
      if (coeff && coeff.abs(ctx).greaterThan(ctx.zero)) {
        return degree;
      }
    }
    return 0;
  }

  function evaluateComplexPolynomial(coeffs, z, ctx) {
    const degree = complexPolynomialDegree(coeffs, ctx);
    let value = complexZero(ctx);
    for (let index = degree; index >= 0; index -= 1) {
      value = value.mul(z).add(coeffs[index] || complexZero(ctx));
    }
    return value;
  }

  function evaluateComplexPolynomialWithDerivative(coeffs, z, ctx) {
    const degree = complexPolynomialDegree(coeffs, ctx);
    let value = coeffs[degree] || complexZero(ctx);
    let derivative = complexZero(ctx);
    for (let index = degree - 1; index >= 0; index -= 1) {
      derivative = derivative.mul(z).add(value);
      value = value.mul(z).add(coeffs[index] || complexZero(ctx));
    }
    return {
      value,
      derivative
    };
  }

  function monomialValue(group, fixedPowers, cache, ctx) {
    if (cache.has(group.key)) {
      return cache.get(group.key);
    }
    let value = ctx.one;
    for (const factor of group.factors) {
      value = value.times(fixedPowers[factor.index][factor.power]);
    }
    cache.set(group.key, value);
    return value;
  }

  function buildOrderPolynomial(orderData, fixedPowers, barrierRoot, cache, ctx) {
    if (orderData.order === 1) {
      return {
        order: 1,
        kind: "imag",
        coeffs: [ctx.zero, barrierRoot.neg()]
      };
    }
    const denominator = orderData.denConst.times(fixedPowers[1][orderData.v2Power]);
    const denominatorInverse = ctx.one.div(denominator);
    const coeffs = [];
    for (const group of orderData.groups) {
      const value = monomialValue(group, fixedPowers, cache, ctx);
      for (let index = 0; index < group.coeffs.length; index += 1) {
        if (!group.coeffs[index]) {
          continue;
        }
        coeffs[index] = (coeffs[index] || ctx.zero).plus(group.coeffs[index].times(value));
      }
    }
    if (orderData.oddFactor === "barrier") {
      const shifted = [];
      for (let index = 0; index < coeffs.length; index += 1) {
        if (!coeffs[index]) {
          continue;
        }
        shifted[index + 1] = coeffs[index].times(denominatorInverse).times(barrierRoot).neg();
      }
      return {
        order: orderData.order,
        kind: "imag",
        coeffs: shifted
      };
    }
    const normalized = [];
    for (let index = 0; index < coeffs.length; index += 1) {
      if (!coeffs[index]) {
        continue;
      }
      normalized[index] = coeffs[index].times(denominatorInverse);
    }
    return {
      order: orderData.order,
      kind: "real",
      coeffs: normalized
    };
  }

  function orderPolynomialToComplexCoefficients(order, ctx) {
    const coeffs = [];
    for (let index = 0; index < order.coeffs.length; index += 1) {
      const coeff = order.coeffs[index];
      if (!coeff) {
        continue;
      }
      coeffs[index] = order.kind === "imag"
        ? complexFromImag(coeff, ctx)
        : complexFromReal(coeff, ctx);
    }
    return coeffs;
  }

  function addComplexPolynomials(left, right, ctx) {
    const length = Math.max(left.length, right.length);
    const sum = [];
    for (let index = 0; index < length; index += 1) {
      const leftCoeff = left[index] || complexZero(ctx);
      const rightCoeff = right[index] || complexZero(ctx);
      const value = leftCoeff.add(rightCoeff);
      if (value.abs(ctx).greaterThan(ctx.zero)) {
        sum[index] = value;
      }
    }
    return sum;
  }

  function buildCumulativePolynomials(prepared, derivatives, ctx) {
    let cumulative = [complexFromReal(derivatives[0], ctx)];
    return prepared.orders.map((order) => {
      cumulative = addComplexPolynomials(cumulative, orderPolynomialToComplexCoefficients(order, ctx), ctx);
      return {
        order: order.order,
        coeffs: cumulative.slice()
      };
    });
  }

  function eikonalGuess(derivatives, omegaSquared, ctx) {
    const barrierRoot = derivatives[2].times(-2).sqrt();
    if (barrierRoot.isZero()) {
      throw new Error("The barrier curvature vanishes, so the scattering coefficient cannot be initialized.");
    }
    return new App.Numerics.ComplexDecimal(
      ctx.zero,
      omegaSquared.minus(derivatives[0]).div(barrierRoot)
    );
  }

  function solveComplexPolynomialRoot(coeffs, target, initial, ctx) {
    const targetComplex = complexFromReal(target, ctx);
    const scale = App.Numerics.dmax(ctx, ctx.one, target.abs());
    const residualTolerance = ctx.ten.pow(-Math.max(12, Math.floor(ctx.precision * 0.6))).times(scale);
    const derivativeTolerance = ctx.ten.pow(-Math.max(12, Math.floor(ctx.precision / 2)));
    const offset = App.Numerics.dmax(ctx, new ctx.D("0.05"), initial.abs(ctx).times(new ctx.D("0.05")));
    const starts = [
      initial,
      initial.scale(new ctx.D("0.9")),
      initial.scale(new ctx.D("1.1")),
      initial.add(complexFromImag(offset, ctx)),
      initial.sub(complexFromImag(offset, ctx)),
      initial.add(complexFromReal(offset, ctx)),
      initial.sub(complexFromReal(offset, ctx))
    ];
    let best = null;
    for (const start of starts) {
      let current = start;
      let currentResidual = null;
      for (let iteration = 0; iteration < 80; iteration += 1) {
        const evaluated = evaluateComplexPolynomialWithDerivative(coeffs, current, ctx);
        const residual = evaluated.value.sub(targetComplex);
        const residualAbs = residual.abs(ctx);
        if (!best || residualAbs.lessThan(best.residual)) {
          best = {
            root: current,
            residual: residualAbs,
            iterations: iteration + 1
          };
        }
        if (residualAbs.lessThan(residualTolerance)) {
          return {
            root: current,
            residual: residualAbs,
            iterations: iteration + 1
          };
        }
        const derivativeAbs = evaluated.derivative.abs(ctx);
        if (!derivativeAbs.greaterThan(derivativeTolerance)) {
          break;
        }
        let step = residual.div(evaluated.derivative);
        let candidate = current.sub(step);
        let candidateResidual = evaluateComplexPolynomial(coeffs, candidate, ctx).sub(targetComplex).abs(ctx);
        if (candidateResidual.greaterThan(residualAbs)) {
          let improved = false;
          for (const factor of [new ctx.D("0.5"), new ctx.D("0.25"), new ctx.D("0.125"), new ctx.D("0.0625")]) {
            const damped = current.sub(step.scale(factor));
            const dampedResidual = evaluateComplexPolynomial(coeffs, damped, ctx).sub(targetComplex).abs(ctx);
            if (dampedResidual.lessThan(candidateResidual)) {
              candidate = damped;
              candidateResidual = dampedResidual;
              improved = true;
            }
            if (dampedResidual.lessThan(residualAbs)) {
              break;
            }
          }
          if (!improved && candidateResidual.greaterThan(residualAbs) && currentResidual && residualAbs.greaterThanOrEqualTo(currentResidual)) {
            break;
          }
        }
        current = candidate;
        currentResidual = candidateResidual;
      }
    }
    if (!best) {
      throw new Error("The WKB scattering equation could not be initialized.");
    }
    return best;
  }

  function greybodyFromK(k, ctx) {
    const exponent = complexFromImag(ctx.two.times(ctx.pi), ctx).mul(k);
    const transmissionComplex = complexOne(ctx).div(complexOne(ctx).add(exponent.exp(ctx)));
    const imagResidual = transmissionComplex.im.abs();
    const tolerance = ctx.ten.pow(-Math.max(8, Math.floor(ctx.precision / 3)));
    let transmission = transmissionComplex.re;
    if (imagResidual.lessThan(tolerance)) {
      transmission = transmissionComplex.re;
    }
    if (transmission.isNegative() && transmission.abs().lessThan(tolerance)) {
      transmission = ctx.zero;
    }
    if (transmission.greaterThan(ctx.one) && transmission.minus(ctx.one).abs().lessThan(tolerance)) {
      transmission = ctx.one;
    }
    return {
      value: transmission,
      complexValue: transmissionComplex,
      imagResidual
    };
  }

  function prepareOrderPolynomials(derivatives, maxOrder, ctx) {
    const data = prepareData(ctx, maxOrder);
    const fixedPowers = buildFixedVariablePowers(derivatives, data.sharedMaxPowers, ctx);
    const barrierRoot = derivatives[2].times(-2).sqrt();
    const monomialCache = new Map();
    const orders = data.orders.map((orderData) => buildOrderPolynomial(orderData, fixedPowers, barrierRoot, monomialCache, ctx));
    let maxKDegree = 1;
    for (const order of orders) {
      maxKDegree = Math.max(maxKDegree, polynomialMaxDegree(order.coeffs));
    }
    return {
      maxOrder,
      orders,
      maxKDegree
    };
  }

  function createTransmissionEvaluator(derivatives, maxOrder, ctx) {
    const prepared = prepareOrderPolynomials(derivatives, maxOrder, ctx);
    const cumulativePolynomials = buildCumulativePolynomials(prepared, derivatives, ctx);
    return function evaluateTransmission(omega) {
      const omegaSquared = omega.times(omega);
      const initial = eikonalGuess(derivatives, omegaSquared, ctx);
      const orders = cumulativePolynomials.map((item) => {
        const solved = solveComplexPolynomialRoot(item.coeffs, omegaSquared, initial, ctx);
        const greybody = greybodyFromK(solved.root, ctx);
        return {
          order: item.order,
          k: solved.root,
          residual: solved.residual,
          iterations: solved.iterations,
          transmission: greybody.value,
          transmissionComplex: greybody.complexValue,
          transmissionImagResidual: greybody.imagResidual
        };
      });
      return {
        omegaSquared,
        initialK: initial,
        orders,
        main: orders[orders.length - 1]
      };
    };
  }

  function serializeComplex(value) {
    return {
      re: value.re.toString(),
      im: value.im.toString()
    };
  }

  function deserializeComplex(data, ctx) {
    return new App.Numerics.ComplexDecimal(new ctx.D(data.re), new ctx.D(data.im));
  }

  function prepareTransmissionKernel(derivatives, maxOrder, ctx) {
    const prepared = prepareOrderPolynomials(derivatives, maxOrder, ctx);
    const cumulativePolynomials = buildCumulativePolynomials(prepared, derivatives, ctx);
    const main = cumulativePolynomials[cumulativePolynomials.length - 1];
    return {
      maxOrder,
      v0: derivatives[0].toString(),
      v2: derivatives[2].toString(),
      coeffs: main.coeffs.map((coeff) => (coeff ? serializeComplex(coeff) : null))
    };
  }

  function evaluateTransmissionKernel(kernel, omega, ctx) {
    const omegaSquared = omega.times(omega);
    const v0 = new ctx.D(kernel.v0);
    const barrierRoot = new ctx.D(kernel.v2).times(-2).sqrt();
    const coeffs = kernel.coeffs.map((coeff) => (coeff ? deserializeComplex(coeff, ctx) : null));
    const initial = new App.Numerics.ComplexDecimal(
      ctx.zero,
      omegaSquared.minus(v0).div(barrierRoot)
    );
    const solved = solveComplexPolynomialRoot(coeffs, omegaSquared, initial, ctx);
    const greybody = greybodyFromK(solved.root, ctx);
    return {
      omegaSquared,
      initialK: initial,
      order: kernel.maxOrder,
      k: solved.root,
      residual: solved.residual,
      iterations: solved.iterations,
      transmission: greybody.value,
      transmissionComplex: greybody.complexValue,
      transmissionImagResidual: greybody.imagResidual
    };
  }

  function createSeriesEvaluator(derivatives, maxOrder, ctx) {
    const prepared = prepareOrderPolynomials(derivatives, maxOrder, ctx);
    return function evaluateSeries(n) {
      const k = new ctx.D(n).plus(ctx.half);
      const cumulative = [];
      const contributions = [];
      let omegaSquared = new App.Numerics.ComplexDecimal(derivatives[0], ctx.zero);
      for (const order of prepared.orders) {
        const value = evaluateRealPolynomial(order.coeffs, k, ctx);
        const term = order.kind === "imag"
          ? new App.Numerics.ComplexDecimal(ctx.zero, value)
          : new App.Numerics.ComplexDecimal(value, ctx.zero);
        contributions.push(term);
        omegaSquared = omegaSquared.add(term);
        cumulative.push({
          order: order.order,
          omegaSquared,
          omega: App.Numerics.chooseQnmBranch(omegaSquared, ctx)
        });
      }
      return {
        contributions,
        cumulative,
        pade: computePadeApproximants(derivatives, contributions, prepared.maxOrder, ctx)
      };
    };
  }

  function buildVariables(n, derivatives, ctx) {
    const vars = [new ctx.D(n).plus(ctx.half)];
    for (let order = 2; order < derivatives.length; order += 1) {
      vars.push(derivatives[order]);
    }
    return vars;
  }

  function complexZero(ctx) {
    return new App.Numerics.ComplexDecimal(ctx.zero, ctx.zero);
  }

  function complexOne(ctx) {
    return new App.Numerics.ComplexDecimal(ctx.one, ctx.zero);
  }

  function solveComplexSystem(matrix, rhs, ctx) {
    const size = matrix.length;
    const tolerance = ctx.ten.pow(-Math.max(10, Math.floor(ctx.precision / 2)));
    const a = matrix.map((row) => row.slice());
    const b = rhs.slice();
    for (let column = 0; column < size; column += 1) {
      let pivot = column;
      let pivotAbs = a[column][column].abs(ctx);
      for (let row = column + 1; row < size; row += 1) {
        const currentAbs = a[row][column].abs(ctx);
        if (currentAbs.greaterThan(pivotAbs)) {
          pivot = row;
          pivotAbs = currentAbs;
        }
      }
      if (!pivotAbs.greaterThan(tolerance)) {
        return null;
      }
      if (pivot !== column) {
        const tempRow = a[column];
        a[column] = a[pivot];
        a[pivot] = tempRow;
        const tempValue = b[column];
        b[column] = b[pivot];
        b[pivot] = tempValue;
      }
      for (let row = column + 1; row < size; row += 1) {
        const factor = a[row][column].div(a[column][column]);
        for (let index = column; index < size; index += 1) {
          a[row][index] = a[row][index].sub(factor.mul(a[column][index]));
        }
        b[row] = b[row].sub(factor.mul(b[column]));
      }
    }
    const solution = Array.from({ length: size }, () => complexZero(ctx));
    for (let row = size - 1; row >= 0; row -= 1) {
      let value = b[row];
      for (let column = row + 1; column < size; column += 1) {
        value = value.sub(a[row][column].mul(solution[column]));
      }
      if (!a[row][row].abs(ctx).greaterThan(tolerance)) {
        return null;
      }
      solution[row] = value.div(a[row][row]);
    }
    return solution;
  }

  function buildSeriesCoefficients(derivatives, contributions, ctx) {
    return [new App.Numerics.ComplexDecimal(derivatives[0], ctx.zero)].concat(contributions);
  }

  function padeApproximation(coefficients, numeratorDegree, denominatorDegree, ctx) {
    if (coefficients.length < numeratorDegree + denominatorDegree + 1) {
      return null;
    }
    const denominator = [complexOne(ctx)];
    if (denominatorDegree > 0) {
      const matrix = [];
      const rhs = [];
      for (let row = 1; row <= denominatorDegree; row += 1) {
        const rowValues = [];
        for (let column = 1; column <= denominatorDegree; column += 1) {
          rowValues.push(coefficients[numeratorDegree + row - column] || complexZero(ctx));
        }
        matrix.push(rowValues);
        rhs.push(coefficients[numeratorDegree + row].neg());
      }
      const tail = solveComplexSystem(matrix, rhs, ctx);
      if (!tail) {
        return null;
      }
      denominator.push(...tail);
    }
    const numerator = [];
    for (let index = 0; index <= numeratorDegree; index += 1) {
      let value = complexZero(ctx);
      const upper = Math.min(index, denominatorDegree);
      for (let j = 0; j <= upper; j += 1) {
        value = value.add(denominator[j].mul(coefficients[index - j]));
      }
      numerator.push(value);
    }
    let numeratorValue = complexZero(ctx);
    for (const coeff of numerator) {
      numeratorValue = numeratorValue.add(coeff);
    }
    let denominatorValue = complexZero(ctx);
    for (const coeff of denominator) {
      denominatorValue = denominatorValue.add(coeff);
    }
    const tolerance = ctx.ten.pow(-Math.max(10, Math.floor(ctx.precision / 2)));
    if (!denominatorValue.abs(ctx).greaterThan(tolerance)) {
      return null;
    }
    const omegaSquared = numeratorValue.div(denominatorValue);
    return {
      numeratorDegree,
      denominatorDegree,
      omegaSquared,
      omega: App.Numerics.chooseQnmBranch(omegaSquared, ctx)
    };
  }

  function computePadeApproximants(derivatives, contributions, maxOrder, ctx) {
    if (maxOrder < 2) {
      return [];
    }
    const coefficients = buildSeriesCoefficients(derivatives, contributions, ctx);
    const approximants = [];
    for (let totalDegree = 2; totalDegree <= maxOrder; totalDegree += 1) {
      for (let numeratorDegree = totalDegree; numeratorDegree >= 1; numeratorDegree -= 1) {
        const denominatorDegree = totalDegree - numeratorDegree;
        const approximant = padeApproximation(coefficients, numeratorDegree, denominatorDegree, ctx);
        if (approximant) {
          approximants.push(approximant);
        }
      }
    }
    return approximants;
  }

  function computeSeries(n, derivatives, maxOrder, ctx) {
    const data = prepareData(ctx, maxOrder);
    if (maxOrder > data.maxOrder) {
      throw new Error("The requested WKB order exceeds the available limit.");
    }
    return createSeriesEvaluator(derivatives, maxOrder, ctx)(n);
  }

  App.WKB = {
    prepareData,
    buildVariables,
    buildVariablePowers,
    contribution,
    createSeriesEvaluator,
    createTransmissionEvaluator,
    prepareTransmissionKernel,
    evaluateTransmissionKernel,
    computeSeries
  };
})();
