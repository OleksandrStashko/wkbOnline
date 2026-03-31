(function () {
  const App = self.QNMApp;

  function createMetricModel(fAst, gAst, params, ctx) {
    const fEval = App.Parser.createEvaluator(fAst);
    const gEval = App.Parser.createEvaluator(gAst);

    function scopeWithRadius(r) {
      const scope = Object.assign({}, params);
      scope.r = r;
      return scope;
    }

    function pointValue(astEval, r) {
      return astEval(scopeWithRadius(r), ctx.D);
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

    return {
      params,
      fAst,
      gAst,
      f,
      g,
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
      const jets = metric.jetsAt(r, 1);
      const fr = jets.f[0];
      const angularPart = fr.times(angular).div(r.times(r));
      const scalarPart = jets.fg[1].div(ctx.two.times(r));
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
