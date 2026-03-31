const workerBase = self.QNMAppWorkerBase || new URL("./", self.location.href).href;

self.importScripts(
  new URL("../core/namespace.js", workerBase).href,
  new URL("../vendor/decimal.js", workerBase).href,
  new URL("../core/parser.js", workerBase).href,
  new URL("../core/jets.js", workerBase).href,
  new URL("../core/numerics.js", workerBase).href,
  new URL("../core/chebyshev.js", workerBase).href,
  new URL("../core/potential.js", workerBase).href,
  new URL("../core/operator.js", workerBase).href,
  new URL("../data/wkb-data.js", workerBase).href,
  new URL("../core/wkb.js", workerBase).href,
  new URL("../core/solver.js", workerBase).href
);

self.postMessage({
  type: "ready"
});

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message) {
    return;
  }
  if (message.type === "run") {
    try {
      const result = self.QNMApp.Solver.solveConfiguration(message.config, (progress) => {
        self.postMessage({
          type: "progress",
          completed: progress.completed,
          total: progress.total
        });
      });
      self.postMessage({
        type: "done",
        result
      });
    } catch (error) {
      self.postMessage({
        type: "error",
        message: error && error.message ? error.message : String(error)
      });
    }
    return;
  }
  if (message.type === "detail") {
    try {
      const caseData = self.QNMApp.Solver.solveCase(message.config, message.params);
      self.postMessage({
        type: "detailDone",
        caseIndex: message.caseIndex,
        caseData
      });
    } catch (error) {
      self.postMessage({
        type: "detailError",
        caseIndex: message.caseIndex,
        message: error && error.message ? error.message : String(error)
      });
    }
  }
});
