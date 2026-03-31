(function () {
  const App = self.QNMApp;

  function createMetricModel(fAst, gAst, params, ctx) {
    const fEval = App.Parser.createEvaluator(fAst);
    const gEval = App.Parser.createEvaluator(gAst);
    const fDualEval = App.Parser.createDualEvaluator(fAst);
    const gDualEval = App.Parser.createDualEvaluator(gAst);
    const pointScope = Object.assign({}, params);
    const dualScope = {};
    for (const [name, value] of Object.entries(params)) {
      dualScope[name] = { v: value, d: ctx.zero };
    }

    function pointValue(astEval, r) {
      pointScope.r = r;
      return astEval(pointScope, ctx.D);
    }

    function jetsAt(r, order) {
      const fJet = App.Jets.evaluateExpressionJet(fAst, params, "r", r, order, ctx);
      const gJet = App.Jets.evaluateExpressionJet(gAst, params, "r", r, order, ctx);
      const fgJet = App.Jets.mul(fJet, gJet, ctx);
      const sJet = App.Jets.sqrtJet(fgJet, ctx);
      return {
        f: fJet,
        g: gJet,
        fg: fgJet,
        s: sJet
      };
    }

    function f(r) {
      return pointValue(fEval, r);
    }

    function g(r) {
      return pointValue(gEval, r);
    }

    function s(r) {
      const product = f(r).times(g(r));
      if (!product.isPositive()) {
        throw new Error("Вне горизонта требуется положительное произведение f(r) g(r).");
      }
      return product.sqrt();
    }

    function fDual(r) {
      dualScope.r = { v: r, d: ctx.one };
      return fDualEval(dualScope, ctx.D);
    }

    function gDual(r) {
      dualScope.r = { v: r, d: ctx.one };
      return gDualEval(dualScope, ctx.D);
    }

    return {
      params,
      fAst,
      gAst,
      f,
      g,
      fDual,
      gDual,
      s,
      jetsAt
    };
  }

  function createPotentialModel(metric, perturbationType, ell, ctx) {
    const l = new ctx.D(ell);
    const angular = l.times(l.plus(ctx.one));

    function valueAt(r) {
      if (perturbationType === "electromagnetic") {
        return metric.f(r).times(angular).div(r.times(r));
      }
      const fDual = metric.fDual(r);
      const gDual = metric.gDual(r);
      const fr = fDual.v;
      const angularPart = fr.times(angular).div(r.times(r));
      const fgPrime = fDual.d.times(gDual.v).plus(fr.times(gDual.d));
      const scalarPart = fgPrime.div(ctx.two.times(r));
      return angularPart.plus(scalarPart);
    }

    return {
      perturbationType,
      ell,
      valueAt
    };
  }

  App.Potential = {
    createMetricModel,
    createPotentialModel
  };
})();
