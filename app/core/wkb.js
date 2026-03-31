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
      throw new Error("Для WKB требуется V''(r*_0) < 0.");
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

  function computeSeries(n, derivatives, maxOrder, ctx) {
    const data = prepareData(ctx);
    if (maxOrder > data.maxOrder) {
      throw new Error("Запрошенный порядок WKB превышает доступный предел.");
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
      cumulative
    };
  }

  App.WKB = {
    prepareData,
    computeSeries
  };
})();
