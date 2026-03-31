(function () {
  const App = self.QNMApp;

  function uniquePush(list, text) {
    if (!list.includes(text)) {
      list.push(text);
    }
  }

  function safeValue(fn, point) {
    try {
      const value = fn(point);
      if (!value || !value.isFinite()) {
        return null;
      }
      return value;
    } catch (error) {
      return null;
    }
  }

  function normalizeConfig(rawConfig) {
    const ell = Math.max(0, Math.floor(Number(rawConfig.ell)));
    return {
      fExpression: rawConfig.fExpression,
      gExpression: rawConfig.gExpression,
      perturbationType: rawConfig.perturbationType,
      ell,
      overtoneMax: Math.max(0, Math.min(ell, Math.floor(Number(rawConfig.overtoneMax)))),
      mainOrder: Math.max(1, Math.min(13, Number(rawConfig.mainOrder))),
      showAllOrders: Boolean(rawConfig.showAllOrders),
      precision: Math.max(40, Number(rawConfig.precision)),
      rMin: rawConfig.rMin,
      rMax: rawConfig.rMax,
      horizonSamples: Math.max(240, Number(rawConfig.horizonSamples || 480)),
      peakSamples: Math.max(400, Number(rawConfig.peakSamples || 900)),
      spectralNodes: Math.max(24, Number(rawConfig.spectralNodes || 64)),
      plotSamples: Math.max(101, Number(rawConfig.plotSamples || 401)),
      parameterSpecs: rawConfig.parameterSpecs || {},
      precisionCheck: rawConfig.precisionCheck !== false,
      storePlots: rawConfig.storePlots !== false
    };
  }

  function parseExpressions(config) {
    const fAst = App.Parser.parseExpression(config.fExpression);
    const gAst = App.Parser.parseExpression(config.gExpression);
    const parameterNames = App.Parser.collectParameters([fAst, gAst]);
    return {
      fAst,
      gAst,
      parameterNames
    };
  }

  function buildParameterGrid(parameterNames, parameterSpecs, ctx) {
    const entries = parameterNames.map((name) => {
      const spec = parameterSpecs[name];
      if (!spec) {
        throw new Error("Не заданы значения или диапазон для параметра \"" + name + "\".");
      }
      return {
        name,
        values: App.Numerics.decimalRangeFromSpec(spec, ctx)
      };
    });
    return App.Numerics.cartesianGrid(entries);
  }

  function findRoots(fn, left, right, sampleCount, ctx) {
    const points = App.Numerics.buildSampleGrid(left, right, sampleCount, ctx);
    const values = points.map((point) => safeValue(fn, point));
    const roots = [];
    for (let index = 0; index < points.length; index += 1) {
      const value = values[index];
      if (!value) {
        continue;
      }
      const tolerance = App.Numerics.scaleEpsilon(ctx, points[index].abs().plus(ctx.one)).times(100);
      if (value.abs().lessThan(tolerance)) {
        roots.push(points[index]);
      }
    }
    for (let index = 0; index < points.length - 1; index += 1) {
      const leftValue = values[index];
      const rightValue = values[index + 1];
      if (!leftValue || !rightValue) {
        continue;
      }
      if (leftValue.isZero()) {
        roots.push(points[index]);
        continue;
      }
      if (rightValue.isZero()) {
        roots.push(points[index + 1]);
        continue;
      }
      if (leftValue.isPositive() !== rightValue.isPositive()) {
        roots.push(App.Numerics.refineBisection(fn, points[index], points[index + 1], ctx, 120));
      }
    }
    return App.Numerics.mergeClose(roots, ctx);
  }

  function selectOuterHorizon(roots, metric, searchMax, ctx) {
    const sorted = roots.slice().sort((a, b) => a.comparedTo(b));
    for (let index = sorted.length - 1; index >= 0; index -= 1) {
      const root = sorted[index];
      const delta = App.Numerics.dmax(
        ctx,
        searchMax.minus(root).div(5000),
        App.Numerics.scaleEpsilon(ctx, root.abs().plus(ctx.one)).times(5000)
      );
      if (!delta.isPositive()) {
        continue;
      }
      const probe = root.plus(delta);
      if (probe.greaterThanOrEqualTo(searchMax)) {
        continue;
      }
      const fProbe = safeValue(metric.f, probe);
      const gProbe = safeValue(metric.g, probe);
      if (fProbe && gProbe && fProbe.isPositive() && gProbe.isPositive()) {
        return root;
      }
    }
    return sorted[sorted.length - 1] || null;
  }

  function locateHorizon(metric, left, right, sampleCount, ctx) {
    const rootsF = findRoots(metric.f, left, right, sampleCount, ctx);
    const rootsG = findRoots(metric.g, left, right, sampleCount, ctx);
    const allRoots = App.Numerics.mergeClose(rootsF.concat(rootsG), ctx);
    return {
      rootsF,
      rootsG,
      allRoots,
      outer: selectOuterHorizon(allRoots, metric, right, ctx)
    };
  }

  function findPeakCandidates(potential, left, right, sampleCount, ctx) {
    const points = App.Numerics.buildLinearGrid(left, right, sampleCount, ctx);
    const values = points.map((point) => safeValue(potential.valueAt, point));
    const candidates = [];
    for (let index = 1; index < points.length - 1; index += 1) {
      const leftValue = values[index - 1];
      const value = values[index];
      const rightValue = values[index + 1];
      if (!leftValue || !value || !rightValue) {
        continue;
      }
      if (value.greaterThan(leftValue) && value.greaterThanOrEqualTo(rightValue)) {
        candidates.push({
          index,
          point: points[index],
          value
        });
      }
    }
    return {
      points,
      values,
      candidates
    };
  }

  function refinePeak(potential, coarse, ctx) {
    if (!coarse.candidates.length) {
      throw new Error("Вне горизонта не найден барьерный максимум эффективного потенциала.");
    }
    const best = coarse.candidates.reduce((current, candidate) => (candidate.value.greaterThan(current.value) ? candidate : current));
    if (best.index <= 0 || best.index >= coarse.points.length - 1) {
      throw new Error("Максимум потенциала оказался на границе исследуемой области.");
    }
    const refined = App.Numerics.goldenMaximum(
      potential.valueAt,
      coarse.points[best.index - 1],
      coarse.points[best.index + 1],
      ctx,
      180
    );
    return {
      coarse,
      index: best.index,
      point: refined.point,
      value: refined.value
    };
  }

  function estimateWindow(peakData, domainLeft, domainRight, ctx) {
    const peakValue = peakData.value;
    const threshold = peakValue.times(new ctx.D("0.88"));
    let leftPoint = null;
    let rightPoint = null;
    for (let index = peakData.index; index >= 0; index -= 1) {
      const value = peakData.coarse.values[index];
      if (value && value.lessThan(threshold)) {
        leftPoint = peakData.coarse.points[index];
        break;
      }
    }
    for (let index = peakData.index; index < peakData.coarse.points.length; index += 1) {
      const value = peakData.coarse.values[index];
      if (value && value.lessThan(threshold)) {
        rightPoint = peakData.coarse.points[index];
        break;
      }
    }
    const localSpacing = peakData.coarse.points[peakData.index + 1].minus(peakData.coarse.points[peakData.index - 1]).div(ctx.two);
    let width = localSpacing.times(3);
    if (leftPoint && rightPoint) {
      width = App.Numerics.dmin(ctx, peakData.point.minus(leftPoint), rightPoint.minus(peakData.point));
    } else if (leftPoint) {
      width = peakData.point.minus(leftPoint);
    } else if (rightPoint) {
      width = rightPoint.minus(peakData.point);
    }
    const boundaryLimit = App.Numerics.dmin(ctx, peakData.point.minus(domainLeft), domainRight.minus(peakData.point)).times(new ctx.D("0.45"));
    width = App.Numerics.dmin(ctx, width, boundaryLimit);
    if (!width.isPositive()) {
      width = localSpacing;
    }
    return App.Numerics.dmax(ctx, width, localSpacing);
  }

  function buildPlotData(metric, potential, horizonPoint, domainLeft, domainRight, plotSamples, ctx) {
    const plotRight = App.Numerics.dmin(ctx, domainRight, horizonPoint.plus(new ctx.D("10")));
    const count = plotSamples % 2 === 0 ? plotSamples + 1 : plotSamples;
    const grid = App.Numerics.buildLinearGrid(domainLeft, plotRight, count, ctx);
    const values = grid.map((point) => potential.valueAt(point));
    return {
      x: grid.map((value) => value.toString()),
      potential: values.map((value) => value.toString()),
      xLabel: "r",
      yLabel: "V(r)"
    };
  }

  function formatComplex(value) {
    return {
      re: value.re.toString(),
      im: value.im.toString()
    };
  }

  function assessWkbSeries(series, mainOrder, ctx, warnings) {
    if (mainOrder < 2) {
      return;
    }
    const current = series.cumulative[mainOrder - 1].omega;
    const previous = series.cumulative[mainOrder - 2].omega;
    const drift = App.Numerics.dmax(
      ctx,
      App.Numerics.relativeDifference(ctx, current.re, previous.re),
      App.Numerics.relativeDifference(ctx, current.im, previous.im)
    );
    if (drift.greaterThan(ctx.ten.pow(-Math.max(4, Math.floor(ctx.precision / 5))))) {
      uniquePush(warnings, "Сходимость WKB по порядку слабая: результат заметно меняется между соседними порядками.");
    }
    if (series.contributions.length >= 2) {
      const last = series.contributions[series.contributions.length - 1].abs(ctx);
      const prev = series.contributions[series.contributions.length - 2].abs(ctx);
      if (last.greaterThanOrEqualTo(prev)) {
        uniquePush(warnings, "Последний вклад WKB не меньше предыдущего; асимптотическая серия ведёт себя неустойчиво.");
      }
    }
  }

  function solveSingleCase(parsed, config, params, ctx, includePlot) {
    const warnings = [];
    if (config.perturbationType === "electromagnetic" && config.ell < 1) {
      throw new Error("Для электромагнитных возмущений требуется ℓ ≥ 1.");
    }
    const metric = App.Potential.createMetricModel(parsed.fAst, parsed.gAst, params, ctx);
    const potential = App.Potential.createPotentialModel(metric, config.perturbationType, config.ell, ctx);
    const searchLeft = new ctx.D(config.rMin);
    const searchRight = new ctx.D(config.rMax);
    if (!searchLeft.isPositive() || !searchRight.greaterThan(searchLeft)) {
      throw new Error("Требуется положительный радиальный интервал поиска с r_max > r_min.");
    }
    const horizon = locateHorizon(metric, searchLeft, searchRight, config.horizonSamples, ctx);
    if (!horizon.outer) {
      throw new Error("Не удалось найти внешний горизонт в заданном радиальном интервале.");
    }
    const domainGap = App.Numerics.dmax(
      ctx,
      App.Numerics.scaleEpsilon(ctx, horizon.outer.abs().plus(ctx.one)).times(5000),
      searchRight.minus(searchLeft).div(config.peakSamples * 20)
    );
    const domainLeft = horizon.outer.plus(domainGap);
    const domainRight = searchRight;
    if (!domainRight.greaterThan(domainLeft)) {
      throw new Error("После внешнего горизонта не осталось доступной области поиска.");
    }
    const coarsePeak = findPeakCandidates(potential, domainLeft, domainRight, config.peakSamples, ctx);
    if (coarsePeak.candidates.length > 1) {
      uniquePush(warnings, "Найдено несколько локальных экстремумов потенциала; выбран глобальный максимум.");
    }
    const peak = refinePeak(potential, coarsePeak, ctx);
    if (!peak.value.isPositive()) {
      throw new Error("Внешний барьер потенциала отсутствует или неположителен.");
    }
    const maxRequestedOrder = config.mainOrder;
    const maxDerivative = 2 * maxRequestedOrder;
    const window = estimateWindow(peak, domainLeft, domainRight, ctx);
    const spectral = App.Chebyshev.adaptiveCollocation(
      potential.valueAt,
      peak.point,
      window,
      maxDerivative,
      config.spectralNodes,
      ctx,
      {
        deltaFactors: [ctx.one, new ctx.D("0.75"), new ctx.D("0.5")],
        extraNodes: 16
      }
    );
    if (spectral.stability.greaterThan(ctx.ten.pow(-Math.max(6, Math.floor(ctx.precision / 4))))) {
      uniquePush(warnings, "Высокие производные зависят от разрешения спектральной сетки.");
    }
    if (spectral.tailRatio.greaterThan(ctx.ten.pow(-Math.max(6, Math.floor(ctx.precision / 4))))) {
      uniquePush(warnings, "Спектральное окно может быть слишком широким или недостаточно гладким.");
    }
    const potentialJet = spectral.jet.slice(0, maxDerivative + 1);
    potentialJet[0] = peak.value;
    const derivativeTolerance = ctx.ten.pow(-Math.max(6, Math.floor(ctx.precision / 4)));
    if (App.Numerics.relativeDifference(ctx, potentialJet[1], ctx.zero).greaterThan(derivativeTolerance)) {
      uniquePush(warnings, "Численно первая производная в точке пика не зануляется с ожидаемой точностью.");
    }
    potentialJet[1] = ctx.zero;
    const metricJets = metric.jetsAt(peak.point, maxDerivative);
    const star = App.Operator.tortoiseDerivatives(potentialJet, metricJets.s, maxDerivative, ctx).values;
    if (!star[2].isNegative()) {
      throw new Error("В точке предполагаемого пика получено V''(r*) ≥ 0, барьерный максимум недействителен.");
    }
    const rows = [];
    const orderList = [];
    for (let order = 1; order <= config.mainOrder; order += 1) {
      orderList.push(order);
    }
    for (let n = 0; n <= config.overtoneMax; n += 1) {
      const series = App.WKB.computeSeries(n, star, config.mainOrder, ctx);
      assessWkbSeries(series, config.mainOrder, ctx, warnings);
      const orders = {};
      for (const item of series.cumulative) {
        orders[item.order] = formatComplex(item.omega);
      }
      rows.push({
        n,
        main: orders[config.mainOrder],
        orders
      });
    }
    if (config.overtoneMax > config.ell) {
      uniquePush(warnings, "Число обертонов превышает ℓ; для высоких n надёжность WKB обычно ухудшается.");
    }
    let plot = null;
    if (includePlot) {
      plot = buildPlotData(metric, potential, horizon.outer, domainLeft, domainRight, config.plotSamples, ctx);
    }
    return {
      params: Object.fromEntries(Object.entries(params).map(([name, value]) => [name, value.toString()])),
      warnings,
      horizon: horizon.outer.toString(),
      peak: peak.point.toString(),
      delta: spectral.delta.toString(),
      stability: spectral.stability.toString(),
      tailRatio: spectral.tailRatio.toString(),
      orders: orderList,
      overtones: rows,
      plot
    };
  }

  function normalizeParams(rawParams, ctx) {
    return Object.fromEntries(
      Object.entries(rawParams || {}).map(([name, value]) => [name, new ctx.D(value)])
    );
  }

  function finalizeCase(parsed, config, params, includePlot) {
    const ctx = App.Numerics.createContext(config.precision);
    const result = solveSingleCase(parsed, config, params, ctx, includePlot === undefined ? config.storePlots : includePlot);
    let sensitivity = "0";
    if (config.precisionCheck) {
      sensitivity = precisionSensitivity(parsed, config, params, result, false);
      if (new ctx.D(sensitivity).greaterThan(ctx.ten.pow(-Math.max(5, Math.floor(ctx.precision / 5))))) {
        uniquePush(result.warnings, "Результат чувствителен к повышению рабочей точности.");
      }
    }
    result.precisionSensitivity = sensitivity;
    return result;
  }

  function precisionSensitivity(parsed, config, params, baseline, includePlot) {
    const higherPrecision = config.precision + 12;
    const ctx = App.Numerics.createContext(higherPrecision);
    const refined = solveSingleCase(parsed, Object.assign({}, config, { precision: higherPrecision }), params, ctx, includePlot);
    const base = baseline.overtones[0].main;
    const test = refined.overtones[0].main;
    const baseCtx = App.Numerics.createContext(config.precision);
    const reDiff = App.Numerics.relativeDifference(baseCtx, new baseCtx.D(base.re), new baseCtx.D(test.re));
    const imDiff = App.Numerics.relativeDifference(baseCtx, new baseCtx.D(base.im), new baseCtx.D(test.im));
    return App.Numerics.dmax(baseCtx, reDiff, imDiff).toString();
  }

  function solveConfiguration(rawConfig, progressCallback) {
    const config = normalizeConfig(rawConfig);
    const ctx = App.Numerics.createContext(config.precision);
    const parsed = parseExpressions(config);
    const grid = buildParameterGrid(parsed.parameterNames, config.parameterSpecs, ctx);
    if (!grid.length) {
      throw new Error("Не удалось построить параметрическую сетку.");
    }
    const cases = [];
    for (let index = 0; index < grid.length; index += 1) {
      cases.push(finalizeCase(parsed, config, grid[index], config.storePlots || index === 0));
      if (progressCallback) {
        progressCallback({
          completed: index + 1,
          total: grid.length
        });
      }
    }
    return {
      parameterNames: parsed.parameterNames,
      mainOrder: config.mainOrder,
      showAllOrders: config.showAllOrders,
      cases
    };
  }

  function solveCase(rawConfig, rawParams) {
    const config = normalizeConfig(rawConfig);
    const ctx = App.Numerics.createContext(config.precision);
    const parsed = parseExpressions(config);
    const params = normalizeParams(rawParams, ctx);
    return finalizeCase(parsed, config, params);
  }

  App.Solver = {
    normalizeConfig,
    parseExpressions,
    buildParameterGrid,
    solveConfiguration,
    solveCase
  };
})();
