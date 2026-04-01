const workerBase = self.QNMAppWorkerBase || new URL("./", self.location.href).href;
const workerAssetVersion = "20260401d";
const asset = (path) => new URL(`${path}?v=${workerAssetVersion}`, workerBase).href;

self.importScripts(
  asset("../core/namespace.js"),
  asset("../vendor/decimal.js"),
  asset("../core/parser.js"),
  asset("../core/jets.js"),
  asset("../core/numerics.js"),
  asset("../core/chebyshev.js"),
  asset("../core/potential.js"),
  asset("../core/operator.js"),
  asset("../data/wkb-data.js"),
  asset("../core/wkb.js"),
  asset("../core/solver.js")
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
