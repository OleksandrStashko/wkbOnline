(function () {
  const App = self.QNMApp;

  function applyStarOperator(functionJet, sJet, ctx) {
    return App.Jets.mul(sJet, App.Jets.derivative(functionJet, ctx), ctx);
  }

  function tortoiseDerivatives(valueJet, sJet, maxOrder, ctx) {
    const jets = [App.Jets.cloneJet(valueJet)];
    const values = [valueJet[0]];
    let current = App.Jets.cloneJet(valueJet);
    for (let order = 1; order <= maxOrder; order += 1) {
      current = applyStarOperator(current, sJet, ctx);
      jets.push(current);
      values.push(current[0]);
    }
    return {
      jets,
      values
    };
  }

  App.Operator = {
    applyStarOperator,
    tortoiseDerivatives
  };
})();
