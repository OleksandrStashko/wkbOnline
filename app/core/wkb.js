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
          rowValues.push(coefficients[numeratorDegree + row - column]);
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
    const lower = Math.floor(maxOrder / 2);
    const upper = Math.ceil(maxOrder / 2);
    const pairs = lower === upper
      ? [[lower, upper]]
      : [[lower, upper], [upper, lower]];
    return pairs
      .map(([numeratorDegree, denominatorDegree]) =>
        padeApproximation(coefficients, numeratorDegree, denominatorDegree, ctx)
      )
      .filter(Boolean);
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
    computeSeries
  };
})();
