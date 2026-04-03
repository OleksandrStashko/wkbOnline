const workerBase = self.QNMAppWorkerBase || new URL("./", self.location.href).href;
const workerAssetVersion = "20260403x";
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
    return;
  }
  if (message.type === "runAnalysis") {
    try {
      const result = self.QNMApp.Solver.solveAnalysis(message.config, (progress) => {
        self.postMessage({
          type: "analysisProgress",
          completed: progress.completed,
          total: progress.total
        });
      });
      self.postMessage({
        type: "analysisDone",
        result
      });
    } catch (error) {
      self.postMessage({
        type: "analysisError",
        message: error && error.message ? error.message : String(error)
      });
    }
    return;
  }
  if (message.type === "runRadiation") {
    try {
      const result = self.QNMApp.Solver.solveRadiation(message.config, message.radiation, (progress) => {
        self.postMessage({
          type: "radiationProgress",
          completed: progress.completed,
          total: progress.total
        });
      });
      self.postMessage({
        type: "radiationDone",
        result
      });
    } catch (error) {
      self.postMessage({
        type: "radiationError",
        message: error && error.message ? error.message : String(error)
      });
    }
    return;
  }
  if (message.type === "runGreybody") {
    try {
      const result = self.QNMApp.Solver.solveGreybody(message.config, message.radiation, (progress) => {
        self.postMessage({
          type: "greybodyProgress",
          completed: progress.completed,
          total: progress.total
        });
      });
      self.postMessage({
        type: "greybodyDone",
        result
      });
    } catch (error) {
      self.postMessage({
        type: "greybodyError",
        message: error && error.message ? error.message : String(error)
      });
    }
    return;
  }
  if (message.type === "prepareGreybodyParallelPlan") {
    try {
      const result = self.QNMApp.Solver.prepareGreybodyParallelPlan(message.config, message.radiation);
      self.postMessage({
        type: "prepareGreybodyParallelPlanDone",
        result
      });
    } catch (error) {
      self.postMessage({
        type: "prepareGreybodyParallelPlanError",
        message: error && error.message ? error.message : String(error)
      });
    }
    return;
  }
  if (message.type === "prepareHawkingParallelPlan") {
    try {
      const result = self.QNMApp.Solver.prepareHawkingParallelPlan(message.config, message.radiation);
      self.postMessage({
        type: "prepareHawkingParallelPlanDone",
        result
      });
    } catch (error) {
      self.postMessage({
        type: "prepareHawkingParallelPlanError",
        message: error && error.message ? error.message : String(error)
      });
    }
    return;
  }
  if (message.type === "evaluateRadiationChunk") {
    try {
      const result = self.QNMApp.Solver.evaluateRadiationChunk(message.chunk);
      self.postMessage({
        type: "evaluateRadiationChunkDone",
        result
      });
    } catch (error) {
      self.postMessage({
        type: "evaluateRadiationChunkError",
        taskId: message.chunk && message.chunk.taskId,
        start: message.chunk && message.chunk.start,
        end: message.chunk && message.chunk.end,
        message: error && error.message ? error.message : String(error)
      });
    }
    return;
  }
  if (message.type === "runHawking") {
    try {
      const result = self.QNMApp.Solver.solveHawking(message.config, message.radiation, (progress) => {
        self.postMessage({
          type: "hawkingProgress",
          completed: progress.completed,
          total: progress.total
        });
      });
      self.postMessage({
        type: "hawkingDone",
        result
      });
    } catch (error) {
      self.postMessage({
        type: "hawkingError",
        message: error && error.message ? error.message : String(error)
      });
    }
  }
});
