(function () {
  const App = self.QNMApp;

  function zeroJet(order, ctx) {
    const jet = [];
    for (let index = 0; index <= order; index += 1) {
      jet.push(ctx.zero);
    }
    return jet;
  }

  function constantJet(value, order, ctx) {
    const jet = zeroJet(order, ctx);
    jet[0] = value;
    return jet;
  }

  function variableJet(value, order, ctx) {
    const jet = constantJet(value, order, ctx);
    if (order >= 1) {
      jet[1] = ctx.one;
    }
    return jet;
  }

  function cloneJet(jet) {
    return jet.slice();
  }

  function isConstantJet(jet) {
    for (let index = 1; index < jet.length; index += 1) {
      if (!jet[index].isZero()) {
        return false;
      }
    }
    return true;
  }

  function add(a, b, ctx) {
    const order = Math.min(a.length, b.length) - 1;
    const result = [];
    for (let index = 0; index <= order; index += 1) {
      result.push(a[index].plus(b[index]));
    }
    return result;
  }

  function sub(a, b, ctx) {
    const order = Math.min(a.length, b.length) - 1;
    const result = [];
    for (let index = 0; index <= order; index += 1) {
      result.push(a[index].minus(b[index]));
    }
    return result;
  }

  function neg(a, ctx) {
    return a.map((value) => value.neg());
  }

  function scale(a, factor, ctx) {
    return a.map((value) => value.times(factor));
  }

  function mul(a, b, ctx) {
    const order = Math.min(a.length, b.length) - 1;
    const result = zeroJet(order, ctx);
    for (let n = 0; n <= order; n += 1) {
      let sum = ctx.zero;
      for (let k = 0; k <= n; k += 1) {
        sum = sum.plus(a[k].times(b[n - k]));
      }
      result[n] = sum;
    }
    return result;
  }

  function derivative(a, ctx) {
    const order = a.length - 1;
    const result = zeroJet(order, ctx);
    for (let n = 0; n < order; n += 1) {
      result[n] = a[n + 1].times(n + 1);
    }
    return result;
  }

  function integral(a, constant, ctx) {
    const order = a.length - 1;
    const result = zeroJet(order, ctx);
    result[0] = constant;
    for (let n = 0; n < order; n += 1) {
      result[n + 1] = a[n].div(n + 1);
    }
    return result;
  }

  function reciprocal(a, ctx) {
    const order = a.length - 1;
    if (a[0].isZero()) {
      throw new Error("Невозможно построить обратный ряд при нулевом свободном члене.");
    }
    const result = zeroJet(order, ctx);
    result[0] = ctx.one.div(a[0]);
    for (let n = 1; n <= order; n += 1) {
      let sum = ctx.zero;
      for (let k = 1; k <= n; k += 1) {
        sum = sum.plus(a[k].times(result[n - k]));
      }
      result[n] = sum.neg().div(a[0]);
    }
    return result;
  }

  function div(a, b, ctx) {
    return mul(a, reciprocal(b, ctx), ctx);
  }

  function expJet(a, ctx) {
    const order = a.length - 1;
    const result = zeroJet(order, ctx);
    result[0] = a[0].exp();
    for (let n = 1; n <= order; n += 1) {
      let sum = ctx.zero;
      for (let k = 1; k <= n; k += 1) {
        sum = sum.plus(new ctx.D(k).times(a[k]).times(result[n - k]));
      }
      result[n] = sum.div(n);
    }
    return result;
  }

  function logJet(a, ctx) {
    if (a[0].isZero()) {
      throw new Error("Логарифм не определён для ряда с нулевым свободным членом.");
    }
    const quotient = div(derivative(a, ctx), a, ctx);
    return integral(quotient, a[0].ln(), ctx);
  }

  function sqrtJet(a, ctx) {
    const order = a.length - 1;
    if (a[0].isNegative()) {
      throw new Error("Квадратный корень требует неотрицательного свободного члена.");
    }
    const result = zeroJet(order, ctx);
    result[0] = a[0].sqrt();
    if (result[0].isZero() && order > 0) {
      throw new Error("Квадратный корень вырожден и не допускает устойчивого ряда в этой точке.");
    }
    for (let n = 1; n <= order; n += 1) {
      let sum = ctx.zero;
      for (let k = 1; k < n; k += 1) {
        sum = sum.plus(result[k].times(result[n - k]));
      }
      result[n] = a[n].minus(sum).div(result[0].times(ctx.two));
    }
    return result;
  }

  function sinCosJet(a, ctx) {
    const order = a.length - 1;
    const sinJet = zeroJet(order, ctx);
    const cosJet = zeroJet(order, ctx);
    sinJet[0] = a[0].sin();
    cosJet[0] = a[0].cos();
    const ap = derivative(a, ctx);
    for (let n = 0; n < order; n += 1) {
      let sinCoeff = ctx.zero;
      let cosCoeff = ctx.zero;
      for (let k = 0; k <= n; k += 1) {
        sinCoeff = sinCoeff.plus(cosJet[k].times(ap[n - k]));
        cosCoeff = cosCoeff.minus(sinJet[k].times(ap[n - k]));
      }
      sinJet[n + 1] = sinCoeff.div(n + 1);
      cosJet[n + 1] = cosCoeff.div(n + 1);
    }
    return { sinJet, cosJet };
  }

  function sinhCoshJet(a, ctx) {
    const order = a.length - 1;
    const sinhJet = zeroJet(order, ctx);
    const coshJet = zeroJet(order, ctx);
    sinhJet[0] = a[0].sinh();
    coshJet[0] = a[0].cosh();
    const ap = derivative(a, ctx);
    for (let n = 0; n < order; n += 1) {
      let sinhCoeff = ctx.zero;
      let coshCoeff = ctx.zero;
      for (let k = 0; k <= n; k += 1) {
        sinhCoeff = sinhCoeff.plus(coshJet[k].times(ap[n - k]));
        coshCoeff = coshCoeff.plus(sinhJet[k].times(ap[n - k]));
      }
      sinhJet[n + 1] = sinhCoeff.div(n + 1);
      coshJet[n + 1] = coshCoeff.div(n + 1);
    }
    return { sinhJet, coshJet };
  }

  function square(a, ctx) {
    return mul(a, a, ctx);
  }

  function asinJet(a, ctx) {
    const order = a.length - 1;
    const oneMinus = sub(constantJet(ctx.one, order, ctx), square(a, ctx), ctx);
    const denom = sqrtJet(oneMinus, ctx);
    return integral(div(derivative(a, ctx), denom, ctx), a[0].asin(), ctx);
  }

  function acosJet(a, ctx) {
    const series = asinJet(a, ctx);
    series[0] = ctx.pi.div(ctx.two).minus(series[0]);
    for (let index = 1; index < series.length; index += 1) {
      series[index] = series[index].neg();
    }
    return series;
  }

  function atanJet(a, ctx) {
    const order = a.length - 1;
    const denom = add(constantJet(ctx.one, order, ctx), square(a, ctx), ctx);
    return integral(div(derivative(a, ctx), denom, ctx), a[0].atan(), ctx);
  }

  function asinhJet(a, ctx) {
    const order = a.length - 1;
    const denom = sqrtJet(add(constantJet(ctx.one, order, ctx), square(a, ctx), ctx), ctx);
    return integral(div(derivative(a, ctx), denom, ctx), a[0].asinh(), ctx);
  }

  function acoshJet(a, ctx) {
    const order = a.length - 1;
    const left = sqrtJet(sub(a, constantJet(ctx.one, order, ctx), ctx), ctx);
    const right = sqrtJet(add(a, constantJet(ctx.one, order, ctx), ctx), ctx);
    return integral(div(derivative(a, ctx), mul(left, right, ctx), ctx), a[0].acosh(), ctx);
  }

  function atanhJet(a, ctx) {
    const order = a.length - 1;
    const denom = sub(constantJet(ctx.one, order, ctx), square(a, ctx), ctx);
    return integral(div(derivative(a, ctx), denom, ctx), a[0].atanh(), ctx);
  }

  function integerPowerJet(a, exponent, ctx) {
    if (exponent === 0) {
      return constantJet(ctx.one, a.length - 1, ctx);
    }
    if (exponent < 0) {
      return reciprocal(integerPowerJet(a, -exponent, ctx), ctx);
    }
    let result = constantJet(ctx.one, a.length - 1, ctx);
    let base = cloneJet(a);
    let power = exponent;
    while (power > 0) {
      if (power % 2 === 1) {
        result = mul(result, base, ctx);
      }
      power = Math.floor(power / 2);
      if (power > 0) {
        base = mul(base, base, ctx);
      }
    }
    return result;
  }

  function powJet(a, b, ctx) {
    if (isConstantJet(b)) {
      const exponent = b[0];
      if (exponent.isInteger()) {
        return integerPowerJet(a, exponent.toNumber(), ctx);
      }
      return expJet(scale(logJet(a, ctx), exponent, ctx), ctx);
    }
    return expJet(mul(logJet(a, ctx), b, ctx), ctx);
  }

  function evaluateAstJet(ast, env, ctx, order) {
    switch (ast.kind) {
      case "number":
        return constantJet(new ctx.D(ast.value), order, ctx);
      case "identifier":
        if (ast.name === "pi") {
          return constantJet(ctx.pi, order, ctx);
        }
        if (ast.name === "e") {
          return constantJet(ctx.D.exp(1), order, ctx);
        }
        if (!(ast.name in env)) {
          throw new Error("Не задан параметр \"" + ast.name + "\".");
        }
        return cloneJet(env[ast.name]);
      case "unary": {
        const arg = evaluateAstJet(ast.arg, env, ctx, order);
        return ast.op === "-" ? neg(arg, ctx) : arg;
      }
      case "binary": {
        const left = evaluateAstJet(ast.left, env, ctx, order);
        const right = evaluateAstJet(ast.right, env, ctx, order);
        if (ast.op === "+") {
          return add(left, right, ctx);
        }
        if (ast.op === "-") {
          return sub(left, right, ctx);
        }
        if (ast.op === "*") {
          return mul(left, right, ctx);
        }
        if (ast.op === "/") {
          return div(left, right, ctx);
        }
        if (ast.op === "^") {
          return powJet(left, right, ctx);
        }
        throw new Error("Неизвестная операция \"" + ast.op + "\".");
      }
      case "call": {
        const args = ast.args.map((arg) => evaluateAstJet(arg, env, ctx, order));
        const name = ast.name;
        if (name === "sqrt") {
          return sqrtJet(args[0], ctx);
        }
        if (name === "exp") {
          return expJet(args[0], ctx);
        }
        if (name === "ln") {
          return logJet(args[0], ctx);
        }
        if (name === "log") {
          if (args.length === 1) {
            return logJet(args[0], ctx);
          }
          return div(logJet(args[0], ctx), logJet(args[1], ctx), ctx);
        }
        if (name === "sin") {
          return sinCosJet(args[0], ctx).sinJet;
        }
        if (name === "cos") {
          return sinCosJet(args[0], ctx).cosJet;
        }
        if (name === "tan") {
          const pair = sinCosJet(args[0], ctx);
          return div(pair.sinJet, pair.cosJet, ctx);
        }
        if (name === "sinh") {
          return sinhCoshJet(args[0], ctx).sinhJet;
        }
        if (name === "cosh") {
          return sinhCoshJet(args[0], ctx).coshJet;
        }
        if (name === "tanh") {
          const pair = sinhCoshJet(args[0], ctx);
          return div(pair.sinhJet, pair.coshJet, ctx);
        }
        if (name === "asin") {
          return asinJet(args[0], ctx);
        }
        if (name === "acos") {
          return acosJet(args[0], ctx);
        }
        if (name === "atan") {
          return atanJet(args[0], ctx);
        }
        if (name === "asinh") {
          return asinhJet(args[0], ctx);
        }
        if (name === "acosh") {
          return acoshJet(args[0], ctx);
        }
        if (name === "atanh") {
          return atanhJet(args[0], ctx);
        }
        if (name === "pow") {
          return powJet(args[0], args[1], ctx);
        }
        if (name === "abs" || name === "min" || name === "max") {
          throw new Error("Функция \"" + name + "\" не допускает аналитические производные нужного порядка.");
        }
        throw new Error("Неизвестная функция \"" + name + "\".");
      }
      default:
        throw new Error("Неизвестный тип AST.");
    }
  }

  function evaluateExpressionJet(ast, values, variableName, point, order, ctx) {
    const env = {};
    for (const [name, value] of Object.entries(values)) {
      env[name] = constantJet(value, order, ctx);
    }
    env[variableName] = variableJet(point, order, ctx);
    return evaluateAstJet(ast, env, ctx, order);
  }

  App.Jets = {
    zeroJet,
    constantJet,
    variableJet,
    cloneJet,
    isConstantJet,
    add,
    sub,
    neg,
    scale,
    mul,
    derivative,
    integral,
    reciprocal,
    div,
    expJet,
    logJet,
    sqrtJet,
    sinCosJet,
    sinhCoshJet,
    integerPowerJet,
    powJet,
    evaluateAstJet,
    evaluateExpressionJet
  };
})();
