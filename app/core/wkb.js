(function () {
  const App = self.QNMApp;
  let preparedData = null;

  function prepareData(ctx) {
    if (preparedData) {
      return preparedData;
    }
    preparedData = {
      maxOrder: App.WKBData.maxOrder,
      orders: App.WKBData.orders.map((entry) => {
        if (entry.order === 1) {
          return {
            order: 1,
            oddFactor: "eikonal"
          };
        }
        return {
          order: entry.order,
          oddFactor: entry.oddFactor,
          v2Power: entry.v2Power,
          denConst: new ctx.D(entry.denConst),
          terms: entry.terms.map((term) => ({
            coeff: new ctx.D(term.coeff),
            factors: term.powers
              .map((power, index) => ({ index, power }))
              .filter((item) => item.power !== 0)
          }))
        };
      })
    };
    return preparedData;
  }

  function evaluatePolynomial(orderData, variables, ctx) {
    let numerator = ctx.zero;
    for (const term of orderData.terms) {
      let value = term.coeff;
      for (const factor of term.factors) {
        value = value.times(variables[factor.index].pow(factor.power));
      }
      numerator = numerator.plus(value);
    }
    return numerator.div(orderData.denConst.times(variables[1].pow(orderData.v2Power)));
  }

  function barrierScale(variables, ctx) {
    const v2 = variables[1];
    if (!v2.isNegative()) {
      throw new Error("WKB requires V''(r*_0) < 0.");
    }
    return variables[0].times(v2.times(-2).sqrt());
  }

  function contribution(orderData, variables, ctx) {
    if (orderData.order === 1) {
      return new App.Numerics.ComplexDecimal(ctx.zero, barrierScale(variables, ctx).neg());
    }
    const normalized = evaluatePolynomial(orderData, variables, ctx);
    if (orderData.oddFactor === "barrier") {
      return new App.Numerics.ComplexDecimal(ctx.zero, barrierScale(variables, ctx).times(normalized).neg());
    }
    return new App.Numerics.ComplexDecimal(normalized, ctx.zero);
  }

  function buildVariables(n, derivatives, ctx) {
    const vars = [new ctx.D(n).plus(ctx.half)];
    for (let order = 2; order <= 26; order += 1) {
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
    const data = prepareData(ctx);
    if (maxOrder > data.maxOrder) {
      throw new Error("The requested WKB order exceeds the available limit.");
    }
    const variables = buildVariables(n, derivatives, ctx);
    const cumulative = [];
    const contributions = [];
    let omegaSquared = new App.Numerics.ComplexDecimal(derivatives[0], ctx.zero);
    for (let order = 1; order <= maxOrder; order += 1) {
      const term = contribution(data.orders[order - 1], variables, ctx);
      contributions.push(term);
      omegaSquared = omegaSquared.add(term);
      cumulative.push({
        order,
        omegaSquared,
        omega: App.Numerics.chooseQnmBranch(omegaSquared, ctx)
      });
    }
    return {
      contributions,
      cumulative,
      pade: computePadeApproximants(derivatives, contributions, maxOrder, ctx)
    };
  }

  App.WKB = {
    prepareData,
    computeSeries
  };
})();
