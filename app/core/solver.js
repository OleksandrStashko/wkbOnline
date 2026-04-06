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

  function availableWkbMaxOrder() {
    if (App.WKBData && Number.isFinite(Number(App.WKBData.maxOrder))) {
      return Math.max(1, Math.floor(Number(App.WKBData.maxOrder)));
    }
    if (App.WKBData && Array.isArray(App.WKBData.orders) && App.WKBData.orders.length) {
      return Math.max(1, App.WKBData.orders.length);
    }
    return 16;
  }

  function hasAnyPhysicalTransmission(values) {
    return (values || []).some((value) => value !== null && value !== undefined);
  }

  function normalizeConfig(rawConfig) {
    const ell = Math.max(0, Math.floor(Number(rawConfig.ell)));
    const maxOrder = availableWkbMaxOrder();
    return {
      fExpression: rawConfig.fExpression,
      gExpression: rawConfig.gExpression,
      perturbationType: rawConfig.perturbationType,
      ell,
      overtoneMax: Math.max(0, Math.floor(Number(rawConfig.overtoneMax))),
      mainOrder: Math.max(1, Math.min(maxOrder, Math.floor(Number(rawConfig.mainOrder)))),
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

  function normalizeRadiationConfig(rawConfig, perturbationType) {
    const ellFloor = perturbationType === "electromagnetic" ? 1 : 0;
    const greybodyEll = Math.max(ellFloor, Math.floor(Number(rawConfig.greybodyEll)));
    const greybodyEllMin = Math.max(ellFloor, Math.floor(Number(rawConfig.greybodyEllMin != null ? rawConfig.greybodyEllMin : greybodyEll)));
    const greybodyEllMax = Math.max(greybodyEllMin, Math.floor(Number(rawConfig.greybodyEllMax != null ? rawConfig.greybodyEllMax : greybodyEll)));
    const ellCutoff = Math.max(ellFloor, Math.floor(Number(rawConfig.ellCutoff)));
    return {
      omegaMin: rawConfig.omegaMin,
      omegaMax: rawConfig.omegaMax,
      omegaPoints: Math.max(25, Math.floor(Number(rawConfig.omegaPoints || 121))),
      greybodyEll,
      greybodyEllMin,
      greybodyEllMax,
      ellCutoff
    };
  }

  function parseExpressions(config) {
    const fAst = App.Parser.parseUserExpression(config.fExpression).ast;
    const gAst = App.Parser.parseUserExpression(config.gExpression).ast;
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
        throw new Error(`No value or scan range was provided for parameter "${name}".`);
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
      if (fProbe && fProbe.isPositive()) {
        return root;
      }
    }
    return sorted[sorted.length - 1] || null;
  }

  function locateHorizon(metric, left, right, sampleCount, ctx) {
    const rootsF = findRoots(metric.f, left, right, sampleCount, ctx);
    return {
      rootsF,
      rootsG: [],
      allRoots: rootsF,
      outer: selectOuterHorizon(rootsF, metric, right, ctx)
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
      throw new Error("No barrier maximum of the effective potential was found outside the horizon.");
    }
    const best = coarse.candidates.reduce((current, candidate) => (candidate.value.greaterThan(current.value) ? candidate : current));
    if (best.index <= 0 || best.index >= coarse.points.length - 1) {
      throw new Error("The potential maximum lies on the boundary of the search interval.");
    }
    const bracketLeft = coarse.points[best.index - 1];
    const bracketRight = coarse.points[best.index + 1];
    const initialBracketWidth = bracketRight.minus(bracketLeft);
    const bracketDigits = Math.min(50, Math.max(20, Math.floor(ctx.precision / 2)));
    const bracketTolerance = ctx.ten.pow(-bracketDigits);
    const refined = App.Numerics.goldenMaximum(
      potential.valueAt,
      bracketLeft,
      bracketRight,
      ctx,
      320,
      bracketTolerance
    );
    return {
      coarse,
      index: best.index,
      bracketLeft,
      bracketRight,
      initialBracketWidth,
      bracketWidth: refined.finalWidth,
      bracketTolerance: refined.tolerance,
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

  function refinePeakSpectrally(potential, peakData, domainLeft, domainRight, baseDegree, maxDerivative, ctx) {
    const refinementOrder = Math.min(maxDerivative, 6);
    const deltaFactors = [ctx.one, new ctx.D("0.75"), new ctx.D("0.5")];
    const extraNodes = 16;
    let current = {
      ...peakData,
      point: peakData.point,
      value: peakData.value
    };
    let lastShift = ctx.zero;
    let iterations = 0;
    for (let iteration = 0; iteration < 3; iteration += 1) {
      const window = estimateWindow(current, domainLeft, domainRight, ctx);
      const local = App.Chebyshev.adaptiveCollocation(
        potential.valueAt,
        current.point,
        window,
        refinementOrder,
        baseDegree,
        ctx,
        {
          deltaFactors,
          extraNodes
        }
      );
      const v1 = local.jet[1];
      const v2 = local.jet[2];
      if (!v2 || v2.isZero()) {
        break;
      }
      let shift = v1.neg().div(v2);
      const maxShift = local.delta.abs().times(new ctx.D("0.2"));
      if (shift.abs().greaterThan(maxShift)) {
        shift = shift.isNegative() ? maxShift.neg() : maxShift;
      }
      lastShift = shift;
      iterations = iteration + 1;
      const nextPointRaw = current.point.plus(shift);
      const nextPoint = nextPointRaw.lessThan(current.bracketLeft)
        ? current.bracketLeft
        : nextPointRaw.greaterThan(current.bracketRight)
          ? current.bracketRight
          : nextPointRaw;
      const stepTolerance = App.Numerics.dmax(
        ctx,
        App.Numerics.scaleEpsilon(ctx, current.point.abs().plus(ctx.one)).times(100),
        local.delta.abs().times(ctx.ten.pow(-Math.max(12, Math.min(40, Math.floor(ctx.precision / 3)))))
      );
      const actualShift = nextPoint.minus(current.point).abs();
      current = {
        ...current,
        point: nextPoint,
        value: potential.valueAt(nextPoint)
      };
      if (actualShift.lessThan(stepTolerance) || shift.abs().lessThan(stepTolerance)) {
        break;
      }
    }
    return {
      peak: current,
      refinementShift: lastShift,
      refinementIterations: iterations
    };
  }

  function buildPlotData(metric, potential, plotLeft, plotRight, plotSamples, ctx) {
    const count = plotSamples % 2 === 0 ? plotSamples + 1 : plotSamples;
    const grid = App.Numerics.buildLinearGrid(plotLeft, plotRight, count, ctx);
    const rows = [];
    for (let index = 0; index < grid.length; index += 1) {
      const point = grid[index];
      const potentialValue = safeValue(potential.valueAt, point);
      const fValue = safeValue(metric.f, point);
      const gValue = safeValue(metric.g, point);
      if (!potentialValue || !fValue || !gValue) {
        continue;
      }
      rows.push({
        x: point.toString(),
        potential: potentialValue.toString(),
        f: fValue.toString(),
        g: gValue.toString()
      });
    }
    return {
      x: rows.map((row) => row.x),
      potential: rows.map((row) => row.potential),
      f: rows.map((row) => row.f),
      g: rows.map((row) => row.g),
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

  function relativeComplexDifference(ctx, left, right) {
    return App.Numerics.dmax(
      ctx,
      App.Numerics.relativeDifference(ctx, left.re, right.re),
      App.Numerics.relativeDifference(ctx, left.im, right.im)
    );
  }

  function assessWkbSeries(series, mainOrder, ctx, warnings) {
    if (mainOrder < 2) {
      return;
    }
    if (series.contributions.length >= 2) {
      const last = series.contributions[series.contributions.length - 1].abs(ctx);
      const prev = series.contributions[series.contributions.length - 2].abs(ctx);
      if (last.greaterThanOrEqualTo(prev)) {
        uniquePush(warnings, "The last WKB contribution is not smaller than the previous one; the asymptotic series looks unstable.");
      }
    }
  }

  function minimumEll(perturbationType) {
    return perturbationType === "electromagnetic" ? 1 : 0;
  }

  function normalizeGreybodyOrderComparison(rawComparison, perturbationType) {
    const maxOrder = availableWkbMaxOrder();
    const ellFloor = minimumEll(perturbationType);
    const rawEll = rawComparison && rawComparison.ell != null
      ? rawComparison.ell
      : rawComparison && rawComparison.greybodyEll != null
        ? rawComparison.greybodyEll
        : ellFloor;
    const rawOrderMin = rawComparison && rawComparison.orderMin != null ? rawComparison.orderMin : 1;
    const rawOrderMax = rawComparison && rawComparison.orderMax != null ? rawComparison.orderMax : maxOrder;
    const ellValue = Number(rawEll);
    const orderMinValue = Number(rawOrderMin);
    const orderMaxValue = Number(rawOrderMax);
    if (!Number.isFinite(ellValue)) {
      throw new Error("Greybody order comparison requires a finite ell value.");
    }
    if (!Number.isFinite(orderMinValue) || !Number.isFinite(orderMaxValue)) {
      throw new Error("Greybody order comparison requires finite integer order bounds.");
    }
    const ell = Math.max(ellFloor, Math.floor(ellValue));
    const orderMin = Math.max(1, Math.min(maxOrder, Math.floor(orderMinValue)));
    const orderMax = Math.max(1, Math.min(maxOrder, Math.floor(orderMaxValue)));
    if (orderMax < orderMin) {
      throw new Error("The upper WKB order must be greater than or equal to the lower order.");
    }
    return {
      ell,
      orderMin,
      orderMax,
      maxOrder
    };
  }

  function prepareBarrierCase(parsed, config, params, ell, ctx, includePlot) {
    const warnings = [];
    if (config.perturbationType === "electromagnetic" && ell < 1) {
      throw new Error("Electromagnetic perturbations require ell >= 1.");
    }
    const metric = App.Potential.createMetricModel(parsed.fAst, parsed.gAst, params, ctx);
    const potential = App.Potential.createPotentialModel(metric, config.perturbationType, ell, ctx);
    const searchLeft = new ctx.D(config.rMin);
    const searchRight = new ctx.D(config.rMax);
    if (!searchLeft.isPositive() || !searchRight.greaterThan(searchLeft)) {
      throw new Error("A positive radial search interval with r_max > r_min is required.");
    }
    const horizon = locateHorizon(metric, searchLeft, searchRight, config.horizonSamples, ctx);
    if (!horizon.outer) {
      throw new Error("Could not locate the outer horizon in the requested radial interval.");
    }
    const domainGap = App.Numerics.dmax(
      ctx,
      App.Numerics.scaleEpsilon(ctx, horizon.outer.abs().plus(ctx.one)).times(5000),
      searchRight.minus(searchLeft).div(config.peakSamples * 20)
    );
    const domainLeft = horizon.outer.plus(domainGap);
    const domainRight = searchRight;
    if (!domainRight.greaterThan(domainLeft)) {
      throw new Error("No searchable domain remains outside the outer horizon.");
    }
    const coarsePeak = findPeakCandidates(potential, domainLeft, domainRight, config.peakSamples, ctx);
    if (coarsePeak.candidates.length > 1) {
      uniquePush(warnings, "Several local extrema of the potential were found; the global maximum was selected.");
    }
    const maxRequestedOrder = config.mainOrder;
    const maxDerivative = 2 * maxRequestedOrder;
    const coarseRefinedPeak = refinePeak(potential, coarsePeak, ctx);
    const peakRefinement = refinePeakSpectrally(
      potential,
      coarseRefinedPeak,
      domainLeft,
      domainRight,
      config.spectralNodes,
      maxDerivative,
      ctx
    );
    const peak = peakRefinement.peak;
    if (!peak.value.isPositive()) {
      throw new Error("The outer potential barrier is absent or non-positive.");
    }
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
      uniquePush(warnings, "High-order derivatives depend noticeably on the spectral resolution.");
    }
    if (spectral.tailRatio.greaterThan(ctx.ten.pow(-Math.max(6, Math.floor(ctx.precision / 4))))) {
      uniquePush(warnings, "The spectral window may be too wide or the local profile may be insufficiently smooth.");
    }
    const potentialJet = spectral.jet.slice(0, maxDerivative + 1);
    potentialJet[0] = peak.value;
    const derivativeTolerance = ctx.ten.pow(-Math.max(6, Math.floor(ctx.precision / 4)));
    const peakDerivativeAbs = potentialJet[1].abs();
    const peakDerivativeRelative = App.Numerics.relativeDifference(ctx, potentialJet[1], ctx.zero);
    const peakCurvatureAbs = potentialJet[2].abs();
    const peakShiftEstimate = peakCurvatureAbs.isZero() ? null : peakDerivativeAbs.div(peakCurvatureAbs);
    const peakShiftOverDelta = peakShiftEstimate ? peakShiftEstimate.div(spectral.delta.abs()) : null;
    const peakShiftWarningThreshold = new ctx.D("1e-8");
    if (peakShiftOverDelta && peakShiftOverDelta.greaterThan(peakShiftWarningThreshold)) {
      uniquePush(warnings, "The estimated peak-position error is not negligible compared with the spectral window.");
    }
    potentialJet[1] = ctx.zero;
    const metricJets = metric.jetsAt(peak.point, maxDerivative);
    const star = App.Operator.tortoiseDerivatives(potentialJet, metricJets.s, maxDerivative, ctx).values;
    if (!star[2].isNegative()) {
      throw new Error("At the candidate peak, V''(r*) >= 0 was obtained, so the barrier maximum is invalid.");
    }
    const plot = includePlot
      ? buildPlotData(metric, potential, searchLeft, searchRight, config.plotSamples, ctx)
      : null;
    return {
      metric,
      potential,
      params,
      ell,
      warnings,
      horizon: horizon.outer,
      peak,
      peakRefinement,
      spectral,
      star,
      derivativeTolerance,
      peakDerivativeAbs,
      peakDerivativeRelative,
      peakCurvatureAbs,
      peakShiftEstimate,
      peakShiftOverDelta,
      peakShiftWarningThreshold,
      plot
    };
  }

  function finalizeBarrierCase(barrier) {
    return {
      warnings: barrier.warnings,
      horizon: barrier.horizon.toString(),
      peak: barrier.peak.point.toString(),
      peakBracketWidth: barrier.peak.bracketWidth.toString(),
      peakBracketTolerance: barrier.peak.bracketTolerance.toString(),
      peakRefinementShift: barrier.peakRefinement.refinementShift.toString(),
      peakRefinementIterations: String(barrier.peakRefinement.refinementIterations),
      delta: barrier.spectral.delta.toString(),
      stability: barrier.spectral.stability.toString(),
      tailRatio: barrier.spectral.tailRatio.toString(),
      peakDerivativeAbs: barrier.peakDerivativeAbs.toString(),
      peakDerivativeRelative: barrier.peakDerivativeRelative.toString(),
      peakDerivativeTolerance: barrier.derivativeTolerance.toString(),
      peakCurvatureAbs: barrier.peakCurvatureAbs.toString(),
      peakShiftEstimate: barrier.peakShiftEstimate ? barrier.peakShiftEstimate.toString() : null,
      peakShiftOverDelta: barrier.peakShiftOverDelta ? barrier.peakShiftOverDelta.toString() : null,
      peakShiftWarningThreshold: barrier.peakShiftWarningThreshold.toString(),
      plot: barrier.plot
    };
  }

  function surfaceGravity(metric, horizonPoint, ctx) {
    const jets = metric.jetsAt(horizonPoint, 1);
    const product = jets.f[1].times(jets.g[1]);
    if (product.isNegative()) {
      throw new Error("The surface gravity is not real at the located horizon.");
    }
    return product.sqrt().div(ctx.two);
  }

  function thermalFactor(omega, temperature, ctx) {
    if (omega.isZero()) {
      return temperature;
    }
    const ratio = omega.div(temperature);
    return omega.div(ratio.exp().minus(ctx.one));
  }

  function solveSingleCase(parsed, config, params, ctx, includePlot) {
    const barrier = prepareBarrierCase(parsed, config, params, config.ell, ctx, includePlot);
    const warnings = barrier.warnings;
    const seriesEvaluator = App.WKB.createSeriesEvaluator(barrier.star, config.mainOrder, ctx);
    const rows = [];
    const orderList = [];
    for (let order = 1; order <= config.mainOrder; order += 1) {
      orderList.push(order);
    }
    for (let n = 0; n <= config.overtoneMax; n += 1) {
      const series = seriesEvaluator(n);
      assessWkbSeries(series, config.mainOrder, ctx, warnings);
      const orders = {};
      const orderAccuracy = {};
      let previousOmega = null;
      for (const item of series.cumulative) {
        orders[item.order] = formatComplex(item.omega);
        orderAccuracy[item.order] = previousOmega
          ? relativeComplexDifference(ctx, item.omega, previousOmega).toString()
          : null;
        previousOmega = item.omega;
      }
      const mainOmega = series.cumulative[series.cumulative.length - 1].omega;
      const pade = series.pade.map((item) => ({
        label: `Pade [${item.numeratorDegree}/${item.denominatorDegree}]`,
        numeratorDegree: item.numeratorDegree,
        denominatorDegree: item.denominatorDegree,
        value: formatComplex(item.omega),
        relativeToMain: relativeComplexDifference(ctx, item.omega, mainOmega).toString()
      }));
      rows.push({
        n,
        main: orders[config.mainOrder],
        orders,
        orderAccuracy,
        pade
      });
    }
    if (config.overtoneMax > config.ell) {
      uniquePush(warnings, "The overtone count exceeds ell; WKB reliability usually degrades at high n.");
    }
    return Object.assign({
      params: Object.fromEntries(Object.entries(params).map(([name, value]) => [name, value.toString()])),
      warnings,
      orders: orderList,
      overtones: rows
    }, finalizeBarrierCase(barrier));
  }

  function normalizeParams(rawParams, ctx) {
    return Object.fromEntries(
      Object.entries(rawParams || {}).map(([name, value]) => [name, new ctx.D(App.Numerics.toPlain(value))])
    );
  }

  function finalizeCase(parsed, config, params, includePlot) {
    const ctx = App.Numerics.createContext(config.precision);
    const result = solveSingleCase(parsed, config, params, ctx, includePlot === undefined ? config.storePlots : includePlot);
    let sensitivity = "0";
    if (config.precisionCheck) {
      sensitivity = precisionSensitivity(parsed, config, params, result, false);
      if (new ctx.D(sensitivity).greaterThan(ctx.ten.pow(-Math.max(5, Math.floor(ctx.precision / 5))))) {
        uniquePush(result.warnings, "The result is sensitive to an increase in the working precision.");
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

  function formatParamsForWarning(params) {
    const parts = Object.entries(params).map(([name, value]) => `${name}=${value.toString()}`);
    return parts.length ? parts.join(", ") : "default parameters";
  }

  function prepareFixedRadiationInputs(rawConfig, rawRadiationConfig) {
    const config = normalizeConfig(rawConfig);
    const radiation = normalizeRadiationConfig(rawRadiationConfig || {}, config.perturbationType);
    const ctx = App.Numerics.createContext(config.precision);
    const parsed = parseExpressions(config);
    const grid = buildParameterGrid(parsed.parameterNames, config.parameterSpecs, ctx);
    if (grid.length !== 1) {
      throw new Error("Radiation & Greybody currently requires fixed parameter values. Remove parameter scan ranges before running it.");
    }
    const params = grid[0];
    const omegaMin = new ctx.D(radiation.omegaMin);
    const omegaMax = new ctx.D(radiation.omegaMax);
    if (omegaMin.isNegative() || !omegaMax.greaterThan(omegaMin)) {
      throw new Error("A non-negative frequency range with omega_max > omega_min is required.");
    }
    return {
      config,
      radiation,
      ctx,
      parsed,
      params,
      omegaGrid: App.Numerics.buildLinearGrid(omegaMin, omegaMax, radiation.omegaPoints, ctx),
      ellFloor: minimumEll(config.perturbationType)
    };
  }

  function warningPrefix(params, ell) {
    return `[${formatParamsForWarning(params)}${ell !== undefined ? `, ell=${ell}` : ""}]`;
  }

  function buildTransmissionWarnings(ell, evaluations) {
    const warnings = [];
    const invalid = evaluations.filter((item) => item && item.physical === false);
    if (!invalid.length) {
      return warnings;
    }
    const requestedOrders = Array.from(new Set(
      invalid
        .map((item) => (item.requestedMain ? item.requestedMain.order : null))
        .filter((item) => item !== null && item !== undefined)
    )).sort((left, right) => left - right);
    const reasons = Array.from(new Set(invalid.flatMap((item) => item.nonPhysicalReasons || [])));
    if (!requestedOrders.length) {
      return warnings;
    }
    let message = `[ell=${ell}] The WKB transmission coefficient is non-physical at requested order`;
    message += requestedOrders.length === 1 ? ` ${requestedOrders[0]}` : `s ${requestedOrders.join(", ")}`;
    if (reasons.length) {
      message += ` (${reasons.join("; ")})`;
    }
    message += "; non-physical points were removed from physical output.";
    uniquePush(warnings, message);
    return warnings;
  }

  function serializeParams(params) {
    return Object.fromEntries(Object.entries(params).map(([name, value]) => [name, value.toString()]));
  }

  function prepareGreybodyParallelPlan(rawConfig, rawRadiationConfig) {
    const config = normalizeConfig(rawConfig);
    const radiation = normalizeRadiationConfig(rawRadiationConfig || {}, config.perturbationType);
    const ctx = App.Numerics.createContext(config.precision);
    const parsed = parseExpressions(config);
    const grid = buildParameterGrid(parsed.parameterNames, config.parameterSpecs, ctx);
    if (!grid.length) {
      throw new Error("Could not build the parameter grid.");
    }
    const omegaMin = new ctx.D(radiation.omegaMin);
    const omegaMax = new ctx.D(radiation.omegaMax);
    if (omegaMin.isNegative() || !omegaMax.greaterThan(omegaMin)) {
      throw new Error("A non-negative frequency range with omega_max > omega_min is required.");
    }
    const omegaGrid = App.Numerics.buildLinearGrid(omegaMin, omegaMax, radiation.omegaPoints, ctx);
    const ellValues = [];
    for (let ell = radiation.greybodyEllMin; ell <= radiation.greybodyEllMax; ell += 1) {
      ellValues.push(ell);
    }
    const warnings = [];
    const tasks = [];
    let diagnosticBarrier = null;
    let diagnosticKappa = null;
    let diagnosticTemperature = null;
    let diagnosticParams = null;
    let diagnosticEll = null;
    for (const params of grid) {
      for (const ell of ellValues) {
        try {
          const barrier = prepareBarrierCase(parsed, config, params, ell, ctx, !diagnosticBarrier);
          const kappa = surfaceGravity(barrier.metric, barrier.horizon, ctx);
          const temperature = kappa.div(ctx.two.times(ctx.pi));
          barrier.warnings.forEach((warning) => uniquePush(warnings, `${warningPrefix(params, ell)} ${warning}`));
          tasks.push({
            id: `${tasks.length}`,
            ell,
            params: serializeParams(params),
            label: `${formatParamsForWarning(params)}, ell=${ell}`,
            kernel: App.WKB.prepareTransmissionKernel(barrier.star, config.mainOrder, ctx)
          });
          if (!diagnosticBarrier) {
            diagnosticBarrier = barrier;
            diagnosticKappa = kappa;
            diagnosticTemperature = temperature;
            diagnosticParams = params;
            diagnosticEll = ell;
          }
        } catch (error) {
          uniquePush(warnings, `${warningPrefix(params, ell)} ${error && error.message ? error.message : String(error)}`);
        }
      }
    }
    if (!tasks.length || !diagnosticBarrier || !diagnosticKappa || !diagnosticTemperature || !diagnosticParams) {
      throw new Error("No valid greybody curve was obtained for the requested parameter/ell range.");
    }
    return {
      kind: "greybody",
      precision: config.precision,
      parameterNames: parsed.parameterNames,
      perturbationType: config.perturbationType,
      mainOrder: config.mainOrder,
      ell: diagnosticEll,
      ellMin: radiation.greybodyEllMin,
      ellMax: radiation.greybodyEllMax,
      horizon: diagnosticBarrier.horizon.toString(),
      surfaceGravity: diagnosticKappa.toString(),
      temperature: diagnosticTemperature.toString(),
      params: serializeParams(diagnosticParams),
      omegaGrid: omegaGrid.map((item) => item.toString()),
      warnings,
      tasks,
      diagnostics: Object.assign({
        kind: "greybody",
        ell: diagnosticEll,
        params: serializeParams(diagnosticParams)
      }, finalizeBarrierCase(diagnosticBarrier))
    };
  }

  function prepareHawkingParallelPlan(rawConfig, rawRadiationConfig) {
    const prepared = prepareFixedRadiationInputs(rawConfig, rawRadiationConfig);
    const { config, radiation, ctx, parsed, params, omegaGrid, ellFloor } = prepared;
    const warnings = [];
    const tasks = [];
    let diagnosticBarrier = null;
    let diagnosticKappa = null;
    let diagnosticTemperature = null;
    for (let ell = ellFloor; ell <= radiation.ellCutoff; ell += 1) {
      try {
        const barrier = prepareBarrierCase(parsed, config, params, ell, ctx, !diagnosticBarrier);
        const kappa = surfaceGravity(barrier.metric, barrier.horizon, ctx);
        const temperature = kappa.div(ctx.two.times(ctx.pi));
        if (!temperature.isPositive()) {
          throw new Error("The Hawking temperature is non-positive.");
        }
        barrier.warnings.forEach((warning) => uniquePush(warnings, `[ell=${ell}] ${warning}`));
        tasks.push({
          id: `${tasks.length}`,
          ell,
          params: serializeParams(params),
          label: `ell=${ell}`,
          temperature: temperature.toString(),
          kernel: App.WKB.prepareTransmissionKernel(barrier.star, config.mainOrder, ctx)
        });
        if (!diagnosticBarrier) {
          diagnosticBarrier = barrier;
          diagnosticKappa = kappa;
          diagnosticTemperature = temperature;
        }
      } catch (error) {
        uniquePush(warnings, `[ell=${ell}] ${error && error.message ? error.message : String(error)}`);
      }
    }
    if (!tasks.length || !diagnosticBarrier || !diagnosticKappa || !diagnosticTemperature) {
      throw new Error("No valid ell contribution was obtained for the Hawking spectrum.");
    }
    return {
      kind: "hawking",
      precision: config.precision,
      parameterNames: parsed.parameterNames,
      perturbationType: config.perturbationType,
      mainOrder: config.mainOrder,
      ellCutoff: radiation.ellCutoff,
      params: serializeParams(params),
      omegaGrid: omegaGrid.map((item) => item.toString()),
      horizon: diagnosticBarrier.horizon.toString(),
      surfaceGravity: diagnosticKappa.toString(),
      temperature: diagnosticTemperature.toString(),
      warnings,
      tasks,
      diagnostics: Object.assign({
        kind: "hawking",
        ell: tasks[0].ell
      }, finalizeBarrierCase(diagnosticBarrier))
    };
  }

  function prepareGreybodyOrderComparisonParallelPlan(rawConfig, rawRadiationConfig, rawComparisonConfig) {
    const baseConfig = normalizeConfig(rawConfig);
    const comparison = normalizeGreybodyOrderComparison(rawComparisonConfig || {}, baseConfig.perturbationType);
    const config = Object.assign({}, baseConfig, { mainOrder: comparison.orderMax });
    const radiation = normalizeRadiationConfig(rawRadiationConfig || {}, config.perturbationType);
    const ctx = App.Numerics.createContext(config.precision);
    const parsed = parseExpressions(config);
    const grid = buildParameterGrid(parsed.parameterNames, config.parameterSpecs, ctx);
    if (grid.length !== 1) {
      throw new Error("Greybody order comparison currently requires fixed parameter values. Remove parameter scan ranges before running it.");
    }
    const params = grid[0];
    const omegaMin = new ctx.D(radiation.omegaMin);
    const omegaMax = new ctx.D(radiation.omegaMax);
    if (omegaMin.isNegative() || !omegaMax.greaterThan(omegaMin)) {
      throw new Error("A non-negative frequency range with omega_max > omega_min is required.");
    }
    const omegaGrid = App.Numerics.buildLinearGrid(omegaMin, omegaMax, radiation.omegaPoints, ctx);
    const barrier = prepareBarrierCase(parsed, config, params, comparison.ell, ctx, true);
    const kappa = surfaceGravity(barrier.metric, barrier.horizon, ctx);
    const temperature = kappa.div(ctx.two.times(ctx.pi));
    const warnings = [];
    barrier.warnings.forEach((warning) => uniquePush(warnings, `${warningPrefix(params, comparison.ell)} ${warning}`));
    const tasks = [];
    for (let order = comparison.orderMin; order <= comparison.orderMax; order += 1) {
      tasks.push({
        id: `${tasks.length}`,
        order,
        ell: comparison.ell,
        params: serializeParams(params),
        label: `${formatParamsForWarning(params)}, ell=${comparison.ell}, WKB ${order}`,
        kernel: App.WKB.prepareTransmissionKernel(barrier.star, order, ctx)
      });
    }
    return {
      kind: "greybody-order-comparison",
      precision: config.precision,
      parameterNames: parsed.parameterNames,
      perturbationType: config.perturbationType,
      params: serializeParams(params),
      ell: comparison.ell,
      orderMin: comparison.orderMin,
      orderMax: comparison.orderMax,
      omegaGrid: omegaGrid.map((item) => item.toString()),
      horizon: barrier.horizon.toString(),
      surfaceGravity: kappa.toString(),
      temperature: temperature.toString(),
      warnings,
      tasks,
      diagnostics: Object.assign({
        kind: "greybody-order-comparison",
        ell: comparison.ell,
        params: serializeParams(params)
      }, finalizeBarrierCase(barrier))
    };
  }

  function evaluateRadiationChunk(chunk) {
    const ctx = App.Numerics.createContext(chunk.precision);
    const omegaGrid = chunk.omegas.map((item) => new ctx.D(item));
    const values = [];
    const transmissions = [];
    let imagResidualWarning = false;
    let intervalWarning = false;
    let requestedOrder = null;
    for (const omega of omegaGrid) {
      const evaluation = App.WKB.evaluateTransmissionKernel(chunk.kernel, omega, ctx);
      if (evaluation.requestedMain) {
        requestedOrder = evaluation.requestedMain.order;
      }
      if (!evaluation.physical) {
        transmissions.push(null);
        values.push(null);
        imagResidualWarning = imagResidualWarning || (evaluation.nonPhysicalReasons || []).includes("non-negligible imaginary part after GBFactor");
        intervalWarning = intervalWarning || (evaluation.nonPhysicalReasons || []).includes("outside [0,1] after GBFactor");
        continue;
      }
      const selected = evaluation.main;
      transmissions.push(selected.transmission.toString());
      if (chunk.kind === "hawking") {
        const temperature = new ctx.D(chunk.temperature);
        const emission = new ctx.D(2 * chunk.ell + 1)
          .times(selected.transmission)
          .times(thermalFactor(omega, temperature, ctx))
          .div(ctx.two.times(ctx.pi));
        values.push(emission.toString());
      } else {
        values.push(selected.transmission.toString());
      }
    }
    return {
      taskId: chunk.taskId,
      start: chunk.start,
      end: chunk.end,
      values,
      transmissions,
      imagResidualWarning,
      intervalWarning,
      requestedOrder
    };
  }

  function solveConfiguration(rawConfig, progressCallback) {
    const config = normalizeConfig(rawConfig);
    const ctx = App.Numerics.createContext(config.precision);
    const parsed = parseExpressions(config);
    const grid = buildParameterGrid(parsed.parameterNames, config.parameterSpecs, ctx);
    if (!grid.length) {
      throw new Error("Could not build the parameter grid.");
    }
    const cases = [];
    const warnings = [];
    let plotAssigned = false;
    for (let index = 0; index < grid.length; index += 1) {
      try {
        const caseData = finalizeCase(parsed, config, grid[index], config.storePlots || !plotAssigned);
        if (caseData.plot) {
          plotAssigned = true;
        }
        cases.push(caseData);
      } catch (error) {
        uniquePush(warnings, `[${formatParamsForWarning(grid[index])}] ${error && error.message ? error.message : String(error)}`);
      }
      if (progressCallback) {
        progressCallback({
          completed: index + 1,
          total: grid.length
        });
      }
    }
    if (!cases.length) {
      throw new Error(warnings[0] || "No valid parameter points were computed.");
    }
    return {
      parameterNames: parsed.parameterNames,
      mainOrder: config.mainOrder,
      warnings,
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

  function solveAnalysis(rawConfig, progressCallback) {
    const config = normalizeConfig(rawConfig);
    const ctx = App.Numerics.createContext(config.precision);
    const parsed = parseExpressions(config);
    const grid = buildParameterGrid(parsed.parameterNames, config.parameterSpecs, ctx);
    if (!grid.length) {
      throw new Error("Could not build the parameter grid.");
      }
      const warnings = [];
      const cases = [];
      const plotLeft = new ctx.D(config.rMin);
      const plotRight = new ctx.D(config.rMax);
      if (!plotLeft.isPositive() || !plotRight.greaterThan(plotLeft)) {
        throw new Error("A positive radial plotting interval with r_max > r_min is required.");
      }
      for (let index = 0; index < grid.length; index += 1) {
        try {
          const metric = App.Potential.createMetricModel(parsed.fAst, parsed.gAst, grid[index], ctx);
          const potential = App.Potential.createPotentialModel(metric, config.perturbationType, config.ell, ctx);
          cases.push({
            params: Object.fromEntries(Object.entries(grid[index]).map(([name, value]) => [name, value.toString()])),
            warnings: [],
            plot: buildPlotData(metric, potential, plotLeft, plotRight, config.plotSamples, ctx)
          });
        } catch (error) {
          uniquePush(warnings, `[${formatParamsForWarning(grid[index])}] ${error && error.message ? error.message : String(error)}`);
        }
        if (progressCallback) {
        progressCallback({
          completed: index + 1,
          total: grid.length
        });
      }
    }
    if (!cases.length) {
      throw new Error(warnings[0] || "No valid parameter point was available for analysis.");
    }
    return {
      parameterNames: parsed.parameterNames,
      warnings,
      cases
    };
  }

  function solveGreybody(rawConfig, rawRadiationConfig, progressCallback) {
    const config = normalizeConfig(rawConfig);
    const radiation = normalizeRadiationConfig(rawRadiationConfig || {}, config.perturbationType);
    const ctx = App.Numerics.createContext(config.precision);
    const parsed = parseExpressions(config);
    const grid = buildParameterGrid(parsed.parameterNames, config.parameterSpecs, ctx);
    if (!grid.length) {
      throw new Error("Could not build the parameter grid.");
    }
    const omegaMin = new ctx.D(radiation.omegaMin);
    const omegaMax = new ctx.D(radiation.omegaMax);
    if (omegaMin.isNegative() || !omegaMax.greaterThan(omegaMin)) {
      throw new Error("A non-negative frequency range with omega_max > omega_min is required.");
    }
    const omegaGrid = App.Numerics.buildLinearGrid(omegaMin, omegaMax, radiation.omegaPoints, ctx);
    const ellValues = [];
    for (let ell = radiation.greybodyEllMin; ell <= radiation.greybodyEllMax; ell += 1) {
      ellValues.push(ell);
    }
    const total = grid.length * ellValues.length * omegaGrid.length;
    let completed = 0;
    const warnings = [];
    const curves = [];
    let diagnosticBarrier = null;
    let diagnosticKappa = null;
    let diagnosticTemperature = null;
    let diagnosticParams = null;
    let diagnosticEll = null;
    for (const params of grid) {
      for (const ell of ellValues) {
        let processedPoints = 0;
        try {
          const barrier = prepareBarrierCase(parsed, config, params, ell, ctx, !diagnosticBarrier);
          const kappa = surfaceGravity(barrier.metric, barrier.horizon, ctx);
          const temperature = kappa.div(ctx.two.times(ctx.pi));
          const transmissionEvaluator = App.WKB.createTransmissionEvaluator(barrier.star, config.mainOrder, ctx);
          const evaluations = [];
          const values = [];
          for (const omega of omegaGrid) {
            const evaluation = transmissionEvaluator(omega);
            const selected = evaluation.main;
            evaluations.push(evaluation);
            values.push(evaluation.physical ? selected.transmission.toString() : null);
            processedPoints += 1;
            completed += 1;
            if (progressCallback) {
              progressCallback({
                completed,
                total
              });
            }
          }
          barrier.warnings.forEach((warning) => uniquePush(warnings, `${warningPrefix(params, ell)} ${warning}`));
          buildTransmissionWarnings(ell, evaluations).forEach((warning) => uniquePush(warnings, `${warningPrefix(params)} ${warning.replace(/^\[ell=\d+\]\s*/, "")}`));
          if (!hasAnyPhysicalTransmission(values)) {
            uniquePush(warnings, `${warningPrefix(params, ell)} This greybody curve produced no physical transmission points and was excluded.`);
            continue;
          }
          curves.push({
            params: Object.fromEntries(Object.entries(params).map(([name, value]) => [name, value.toString()])),
            ell,
            label: `${formatParamsForWarning(params)}, ell=${ell}`,
            values
          });
          if (!diagnosticBarrier) {
            diagnosticBarrier = barrier;
            diagnosticKappa = kappa;
            diagnosticTemperature = temperature;
            diagnosticParams = params;
            diagnosticEll = ell;
          }
        } catch (error) {
          completed += omegaGrid.length - processedPoints;
          if (progressCallback) {
            progressCallback({
              completed,
              total
            });
          }
          uniquePush(warnings, `${warningPrefix(params, ell)} ${error && error.message ? error.message : String(error)}`);
        }
      }
    }
    if (!curves.length || !diagnosticBarrier || !diagnosticKappa || !diagnosticTemperature || !diagnosticParams) {
      throw new Error(warnings[0] || "No valid greybody curve was obtained for the requested parameter/ell range.");
    }
    return {
      params: Object.fromEntries(Object.entries(diagnosticParams).map(([name, value]) => [name, value.toString()])),
      parameterNames: parsed.parameterNames,
      perturbationType: config.perturbationType,
      mainOrder: config.mainOrder,
      ell: diagnosticEll,
      ellMin: radiation.greybodyEllMin,
      ellMax: radiation.greybodyEllMax,
      successfulCurveCount: curves.length,
      horizon: diagnosticBarrier.horizon.toString(),
      surfaceGravity: diagnosticKappa.toString(),
      temperature: diagnosticTemperature.toString(),
      warnings,
      greybody: {
        x: omegaGrid.map((item) => item.toString()),
        curves
      },
      diagnostics: Object.assign({
        kind: "greybody",
        ell: diagnosticEll,
        params: Object.fromEntries(Object.entries(diagnosticParams).map(([name, value]) => [name, value.toString()]))
      }, finalizeBarrierCase(diagnosticBarrier))
    };
  }

  function solveGreybodyOrderComparison(rawConfig, rawRadiationConfig, rawComparisonConfig, progressCallback) {
    const baseConfig = normalizeConfig(rawConfig);
    const comparison = normalizeGreybodyOrderComparison(rawComparisonConfig || {}, baseConfig.perturbationType);
    const config = {
      ...baseConfig,
      mainOrder: comparison.orderMax
    };
    const radiation = normalizeRadiationConfig(rawRadiationConfig || {}, config.perturbationType);
    const ctx = App.Numerics.createContext(config.precision);
    const parsed = parseExpressions(config);
    const grid = buildParameterGrid(parsed.parameterNames, config.parameterSpecs, ctx);
    if (grid.length !== 1) {
      throw new Error("Greybody order comparison currently requires fixed parameter values. Remove parameter scan ranges before running it.");
    }
    const params = grid[0];
    const omegaMin = new ctx.D(radiation.omegaMin);
    const omegaMax = new ctx.D(radiation.omegaMax);
    if (omegaMin.isNegative() || !omegaMax.greaterThan(omegaMin)) {
      throw new Error("A non-negative frequency range with omega_max > omega_min is required.");
    }
    const omegaGrid = App.Numerics.buildLinearGrid(omegaMin, omegaMax, radiation.omegaPoints, ctx);
    const total = (comparison.orderMax - comparison.orderMin + 1) * omegaGrid.length;
    let completed = 0;
    const warnings = [];
    const barrier = prepareBarrierCase(parsed, config, params, comparison.ell, ctx, true);
    const kappa = surfaceGravity(barrier.metric, barrier.horizon, ctx);
    const temperature = kappa.div(ctx.two.times(ctx.pi));
    const curves = [];
    barrier.warnings.forEach((warning) => uniquePush(warnings, `${warningPrefix(params, comparison.ell)} ${warning}`));
    for (let order = comparison.orderMin; order <= comparison.orderMax; order += 1) {
      const transmissionEvaluator = App.WKB.createTransmissionEvaluator(barrier.star, order, ctx);
      const evaluations = [];
      const values = [];
      for (const omega of omegaGrid) {
        const evaluation = transmissionEvaluator(omega);
        const selected = evaluation.main;
        evaluations.push(evaluation);
        values.push(evaluation.physical ? selected.transmission.toString() : null);
        completed += 1;
        if (progressCallback) {
          progressCallback({
            completed,
            total
          });
        }
      }
      buildTransmissionWarnings(comparison.ell, evaluations).forEach((warning) => uniquePush(warnings, `${warningPrefix(params)} ${warning.replace(/^\[ell=\d+\]\s*/, "")}`));
      if (!hasAnyPhysicalTransmission(values)) {
        uniquePush(warnings, `${warningPrefix(params, comparison.ell)} WKB ${order} produced no physical transmission points and was excluded from the comparison.`);
        continue;
      }
      curves.push({
        order,
        label: `WKB ${order}`,
        values
      });
    }
    if (!curves.length) {
      throw new Error(warnings[0] || "No valid greybody order curve was obtained for the requested comparison range.");
    }
    const referenceCurve = curves[curves.length - 1];
    if (referenceCurve.order !== comparison.orderMax) {
      uniquePush(
        warnings,
        `${warningPrefix(params, comparison.ell)} The requested highest WKB order ${comparison.orderMax} was excluded from the comparison; differences are shown relative to the highest valid order ${referenceCurve.order}.`
      );
    }
    const differenceCurves = curves
      .filter((curve) => curve.order !== referenceCurve.order)
      .map((curve) => ({
        order: curve.order,
        label: `WKB ${referenceCurve.order} - WKB ${curve.order}`,
        values: curve.values.map((value, index) => value === null || referenceCurve.values[index] === null ? null : new ctx.D(referenceCurve.values[index]).minus(new ctx.D(value)).toString())
      }));
    if (!differenceCurves.length) {
      uniquePush(warnings, `${warningPrefix(params, comparison.ell)} Only one physical WKB order remained in the requested range; the difference plot is empty.`);
    }
    return {
      params: serializeParams(params),
      parameterNames: parsed.parameterNames,
      perturbationType: config.perturbationType,
      ell: comparison.ell,
      orderMin: comparison.orderMin,
      orderMax: comparison.orderMax,
      referenceOrder: referenceCurve.order,
      successfulOrders: curves.map((curve) => curve.order),
      horizon: barrier.horizon.toString(),
      surfaceGravity: kappa.toString(),
      temperature: temperature.toString(),
      warnings,
      orderComparison: {
        x: omegaGrid.map((item) => item.toString()),
        ell: comparison.ell,
        referenceOrder: referenceCurve.order,
        curves
      },
      orderDifferences: {
        x: omegaGrid.map((item) => item.toString()),
        ell: comparison.ell,
        referenceOrder: referenceCurve.order,
        curves: differenceCurves
      },
      diagnostics: Object.assign({
        kind: "greybody-order-comparison",
        ell: comparison.ell,
        params: serializeParams(params),
        referenceOrder: referenceCurve.order
      }, finalizeBarrierCase(barrier))
    };
  }

  function solveHawking(rawConfig, rawRadiationConfig, progressCallback) {
    const prepared = prepareFixedRadiationInputs(rawConfig, rawRadiationConfig);
    const { config, radiation, ctx, parsed, params, omegaGrid, ellFloor } = prepared;
    const totalSteps = (radiation.ellCutoff - ellFloor + 1) * omegaGrid.length;
    let completed = 0;
    const warnings = [];
    const partials = [];
    const greybodyCurves = [];
    let diagnosticBarrier = null;
    let diagnosticKappa = null;
    let diagnosticTemperature = null;
    const successfulElls = [];
    for (let ell = ellFloor; ell <= radiation.ellCutoff; ell += 1) {
      let processedPoints = 0;
      try {
        const barrier = prepareBarrierCase(parsed, config, params, ell, ctx, !diagnosticBarrier);
        const kappa = surfaceGravity(barrier.metric, barrier.horizon, ctx);
        const temperature = kappa.div(ctx.two.times(ctx.pi));
        if (!temperature.isPositive()) {
          throw new Error("The Hawking temperature is non-positive.");
        }
        const transmissionEvaluator = App.WKB.createTransmissionEvaluator(barrier.star, config.mainOrder, ctx);
        const evaluations = [];
        const values = [];
        for (let index = 0; index < omegaGrid.length; index += 1) {
          const omega = omegaGrid[index];
          const evaluation = transmissionEvaluator(omega);
          const selected = evaluation.main;
          evaluations.push(evaluation);
          if (!evaluation.physical) {
            values.push(null);
          } else {
            const degeneracy = new ctx.D(2 * ell + 1);
            const emission = degeneracy
              .times(selected.transmission)
              .times(thermalFactor(omega, temperature, ctx))
              .div(ctx.two.times(ctx.pi));
            values.push(emission.toString());
          }
          processedPoints += 1;
          completed += 1;
          if (progressCallback) {
            progressCallback({
              completed,
              total: totalSteps
            });
          }
        }
        barrier.warnings.forEach((warning) => uniquePush(warnings, `[ell=${ell}] ${warning}`));
        buildTransmissionWarnings(ell, evaluations).forEach((warning) => uniquePush(warnings, warning));
        const transmissionValues = evaluations.map((item) => (item.physical ? item.main.transmission.toString() : null));
        if (!hasAnyPhysicalTransmission(transmissionValues)) {
          uniquePush(warnings, `[ell=${ell}] This contribution produced no physical transmission points and was excluded from the Hawking spectrum.`);
          continue;
        }
        partials.push({
          ell,
          values
        });
        greybodyCurves.push({
          ell,
          label: `ell=${ell}`,
          params: Object.fromEntries(Object.entries(params).map(([name, value]) => [name, value.toString()])),
          values: transmissionValues
        });
        successfulElls.push(ell);
        if (!diagnosticBarrier) {
          diagnosticBarrier = barrier;
          diagnosticKappa = kappa;
          diagnosticTemperature = temperature;
        }
      } catch (error) {
        completed += omegaGrid.length - processedPoints;
        if (progressCallback) {
          progressCallback({
            completed,
            total: totalSteps
          });
        }
        uniquePush(warnings, `[ell=${ell}] ${error && error.message ? error.message : String(error)}`);
      }
    }
    if (!partials.length || !diagnosticBarrier || !diagnosticKappa || !diagnosticTemperature || !successfulElls.length) {
      throw new Error(warnings[0] || "No valid ell contribution was obtained for the Hawking spectrum.");
    }
    const totalSpectrum = omegaGrid.map((_, index) => {
      let hasPhysicalPoint = false;
      const total = partials.reduce((sum, item) => {
        if (item.values[index] === null || item.values[index] === undefined) {
          return sum;
        }
        hasPhysicalPoint = true;
        return sum.plus(new ctx.D(item.values[index]));
      }, ctx.zero);
      return hasPhysicalPoint ? total.toString() : null;
    });
    return {
      params: Object.fromEntries(Object.entries(params).map(([name, value]) => [name, value.toString()])),
      parameterNames: parsed.parameterNames,
      perturbationType: config.perturbationType,
      mainOrder: config.mainOrder,
      ellCutoff: radiation.ellCutoff,
      successfulElls,
      horizon: diagnosticBarrier.horizon.toString(),
      surfaceGravity: diagnosticKappa.toString(),
      temperature: diagnosticTemperature.toString(),
      warnings,
      greybodyProfile: {
        x: omegaGrid.map((item) => item.toString()),
        curves: greybodyCurves
      },
      spectrum: {
        x: omegaGrid.map((item) => item.toString()),
        total: totalSpectrum,
        partials
      },
      diagnostics: Object.assign({
        kind: "hawking",
        ell: successfulElls[0]
      }, finalizeBarrierCase(diagnosticBarrier))
    };
  }

  function solveRadiation(rawConfig, rawRadiationConfig, progressCallback) {
    const greybody = solveGreybody(rawConfig, rawRadiationConfig, null);
    const hawking = solveHawking(rawConfig, rawRadiationConfig, progressCallback);
    return {
      params: hawking.params,
      parameterNames: hawking.parameterNames,
      perturbationType: hawking.perturbationType,
      mainOrder: hawking.mainOrder,
      greybodyEll: greybody.ell,
      ellCutoff: hawking.ellCutoff,
      horizon: hawking.horizon,
      surfaceGravity: hawking.surfaceGravity,
      temperature: hawking.temperature,
      warnings: Array.from(new Set(greybody.warnings.concat(hawking.warnings))),
      greybody: {
        x: greybody.greybody.x,
        curves: greybody.greybody.curves
      },
      spectrum: hawking.spectrum,
      diagnostics: hawking.diagnostics
    };
  }

  App.Solver = {
    normalizeConfig,
    normalizeRadiationConfig,
    parseExpressions,
    buildParameterGrid,
    solveConfiguration,
    solveCase,
    solveAnalysis,
    solveGreybody,
    solveGreybodyOrderComparison,
    solveHawking,
    solveRadiation,
    prepareGreybodyParallelPlan,
    prepareGreybodyOrderComparisonParallelPlan,
    prepareHawkingParallelPlan,
    evaluateRadiationChunk
  };
})();
