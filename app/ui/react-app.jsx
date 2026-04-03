(function () {
  const mountNode = document.getElementById("root");
  const showFatal = (message) => {
    if (!mountNode) return;
    mountNode.innerHTML = `<div class="react-fatal"><div class="react-fatal-card"><h2>Interface startup failed</h2><p>${String(message || "Unknown error")}</p></div></div>`;
  };
  try {
    const Core = window.QNMApp;
    const { useEffect, useMemo, useRef, useState } = React;
const workerVersion = "20260403x";
    const defaultSpec = { mode: "value", value: "1", start: "0", end: "1", count: 5 };
    const defaultRadiation = { omegaMin: "0.1", omegaMax: "1", omegaPoints: 121, greybodyEll: 2, greybodyEllMin: 2, greybodyEllMax: 2, ellCutoff: 6 };
    const presets = {
      custom: { label: "Custom", values: { fExpression: "1 - 2*M/r", gExpression: "1 - 2*M/r", sameMetric: true, perturbationType: "scalar", ell: 2, overtoneMax: 2, mainOrder: 6, showAllOrders: true, precision: 70, spectralNodes: 64, plotSamples: 401, rMin: "0.001", rMax: "30", horizonSamples: 480, peakSamples: 900, parallelRadiation: false, parallelRadiationWorkers: 4, parameterSpecs: { M: { ...defaultSpec } } } },
      schwarzschild: { label: "Schwarzschild", values: { fExpression: "1 - 2*M/r", gExpression: "1 - 2*M/r", sameMetric: true, perturbationType: "scalar", ell: 2, overtoneMax: 2, mainOrder: 6, showAllOrders: true, precision: 70, spectralNodes: 64, plotSamples: 401, rMin: "0.001", rMax: "30", horizonSamples: 480, peakSamples: 900, parallelRadiation: false, parallelRadiationWorkers: 4, parameterSpecs: { M: { ...defaultSpec } } } },
      reissnerNordstrom: { label: "Reissner-Nordstrom", values: { fExpression: "1 - 2*M/r + Q^2/r^2", gExpression: "1 - 2*M/r + Q^2/r^2", sameMetric: true, perturbationType: "scalar", ell: 2, overtoneMax: 2, mainOrder: 6, showAllOrders: true, precision: 76, spectralNodes: 72, plotSamples: 401, rMin: "0.001", rMax: "35", horizonSamples: 560, peakSamples: 980, parallelRadiation: false, parallelRadiationWorkers: 4, parameterSpecs: { M: { ...defaultSpec }, Q: { mode: "value", value: "0.4", start: "0", end: "1", count: 5 } } } }
    };
const helpItems = [
      ["sqrt(x)", "square root"],
      ["ln(x)", "natural logarithm"],
      ["log(x)", "same as ln(x)"],
      ["log(x, b)", "logarithm with base b"],
      ["exp(x)", "exponential e^x"],
      ["sin, cos, tan", "trigonometric functions"],
      ["asin, acos, atan", "inverse trigonometric functions"],
      ["sinh, cosh, tanh", "hyperbolic functions"],
      ["abs(x)", "absolute value"],
      ["min(a, b), max(a, b)", "minimum and maximum"],
  ["pow(x, y) or x^y", "power"],
  ["pi, e", "constants"]
];
const referenceItems = [
  {
    title: "Konoplya & Zhidenko review",
    href: "https://doi.org/10.1103/RevModPhys.83.793",
    meta: "Rev. Mod. Phys. 83, 793 (2011)"
  },
  {
    title: "Padé summation of higher-order WKB terms",
    href: "https://doi.org/10.1103/PhysRevD.100.124006",
    meta: "Matyjasek & Telecka, Phys. Rev. D 100, 124006 (2019)"
  },
  {
    title: "Higher-order WKB Mathematica code",
    href: "https://www.sciltp.com/journals/ijgtp/articles/2603003383",
    meta: "Konoplya, Matyjasek & Zhidenko (2026)"
  }
];
const referenceCredits = [
  "This web application is a web version of the Mathematica package WKB.m, written by Roman Konoplya and Aleksandr Zhidenko."
];
    const latexExamples = [
      "1 - \\frac{2 M}{r}",
      "1 - \\frac{2 M}{r} + \\frac{Q^2}{r^2}",
      "\\left(1-\\frac{r_h}{r}\\right)"
    ];
    const compactNumber = (text) => {
      const value = Number(text);
      if (!Number.isFinite(value)) return text;
      const magnitude = Math.max(Math.abs(value), 1e-12);
      if (magnitude >= 1e4 || magnitude < 1e-4) return value.toExponential(5);
      return value.toFixed(8).replace(/\.?0+$/, "");
    };
    const formatRelative = (text) => text === null || text === undefined || text === "" ? "--" : compactNumber(text);
    const formatComplexInline = (value) => {
      if (!value) return "--";
      const im = Number(value.im);
      const sign = Number.isFinite(im) ? (im < 0 ? "-" : "+") : (String(value.im).trim().startsWith("-") ? "-" : "+");
      const absIm = Number.isFinite(im) ? compactNumber(Math.abs(im)) : String(value.im).replace(/^\s*-/, "");
      return `${compactNumber(value.re)} ${sign} ${absIm} i`;
    };
    const uniqueWarnings = (items) => Array.from(new Set(items || []));
    const pushUnique = (items, value) => {
      if (!items.includes(value)) items.push(value);
    };
    const clampInt = (value, min) => !Number.isFinite(value) ? min : Math.max(min, Math.floor(value));
    const hasScanRange = (specs) => Object.values(specs || {}).some((spec) => spec.mode === "range");
    const csvEscape = (value) => {
      const text = value === null || value === undefined ? "" : String(value);
      return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
    };
    const estimateCaseCount = (config) => Object.values(config.parameterSpecs || {}).reduce((total, spec) => total * (spec.mode === "range" ? Math.max(2, Number(spec.count || 2)) : 1), 1);
    const disposeWorker = (worker) => {
      if (!worker) return;
      worker.terminate();
      if (worker.__blobUrl) URL.revokeObjectURL(worker.__blobUrl);
    };
    const disposeWorkerCollection = (workers) => {
      (workers || []).forEach(disposeWorker);
    };
    const createWorker = () => {
      const scriptUrl = new URL(`app/worker/worker.js?v=${workerVersion}`, window.location.href).href;
      if (window.location.protocol !== "file:") return new Worker(scriptUrl);
      const baseUrl = new URL("app/worker/", window.location.href).href;
      const bootstrap = `self.QNMAppWorkerBase=${JSON.stringify(baseUrl)};importScripts(${JSON.stringify(scriptUrl)});`;
      const blobUrl = URL.createObjectURL(new Blob([bootstrap], { type: "text/javascript" }));
      const worker = new Worker(blobUrl);
      worker.__blobUrl = blobUrl;
      return worker;
    };

    const precedence = (node) => node.kind === "binary" ? (node.op === "+" || node.op === "-" ? 1 : node.op === "*" || node.op === "/" ? 2 : node.op === "^" ? 3 : 5) : node.kind === "unary" ? 4 : 5;
    const wrapMath = (html, needed) => needed ? `<span class="math-group">(${html})</span>` : html;

    function renderMathNode(node, parent, right) {
      if (node.kind === "number") return node.value;
      if (node.kind === "identifier") return node.name;
      if (node.kind === "call") return `<span class="math-fn">${node.name}</span><span class="math-group">(${node.args.map((arg) => renderMathNode(arg, 0, false)).join(", ")})</span>`;
      if (node.kind === "unary") return wrapMath(`${node.op}${renderMathNode(node.arg, 4, false)}`, precedence(node) < parent);
      if (node.kind !== "binary") return "";
      const own = precedence(node);
      const left = renderMathNode(node.left, node.op === "^" ? own : own + (node.op === "/" ? 1 : 0), false);
      const rightNode = renderMathNode(node.right, node.op === "^" ? own : own + (node.op === "-" || node.op === "/" ? 1 : 0), true);
      const body = node.op === "/" ? `<span class="math-frac"><span class="math-frac-top">${left}</span><span class="math-frac-bottom">${rightNode}</span></span>` : node.op === "^" ? `<span class="math-power">${left}<sup>${rightNode}</sup></span>` : node.op === "*" ? `${left} <span>&middot;</span> ${rightNode}` : `${left} <span>${node.op}</span> ${rightNode}`;
      return wrapMath(body, own < parent || (right && node.op === "^" && own <= parent));
    }

    const analyzeExpression = (text) => {
      const value = text.trim();
      if (!value) {
        return {
          ast: null,
          normalized: "",
          normalizedChanged: false,
          error: "Enter an analytic expression.",
          html: `<div class="math-error">Enter an analytic expression.</div>`,
          invalid: true
        };
      }
      try {
        const parsed = Core.Parser.parseUserExpression(value);
        return {
          ast: parsed.ast,
          normalized: parsed.normalized,
          normalizedChanged: parsed.normalized !== value,
          error: null,
          html: `<div class="math-view">${renderMathNode(parsed.ast, 0, false)}</div>`,
          invalid: false
        };
      } catch (error) {
        return {
          ast: null,
          normalized: "",
          normalizedChanged: false,
          error: error.message || String(error),
          html: `<div class="math-error">${error.message || String(error)}</div>`,
          invalid: true
        };
      }
    };
const chartMount = (renderer, deps) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      renderer(ref.current);
    } catch (error) {
      ref.current.className = "chart-wrap empty-state";
      ref.current.textContent = error && error.message ? error.message : String(error);
    }
  }, deps);
  return ref;
};
    const FormulaPreview = ({ preview }) => <div className="formula-preview-stack"><div className={`formula-preview-box${preview.invalid ? " invalid" : ""}`} dangerouslySetInnerHTML={{ __html: preview.html }} />{preview.normalizedChanged && !preview.invalid && <div className="formula-normalized-note"><span>Interpreted as</span><code>{preview.normalized}</code></div>}</div>;
    const WarningStack = ({ warnings }) => !warnings || !warnings.length ? null : <div className="react-warning-stack">{warnings.map((warning, index) => <div key={`${warning}-${index}`} className="warning-item">{warning}</div>)}</div>;
    const PotentialChart = ({ plot }) => <div ref={chartMount((node) => Core.Chart.renderPotentialChart(node, plot), [plot])} className="potential-plot-wrap" />;
    const MetricChart = ({ plot }) => <div ref={chartMount((node) => Core.Chart.renderMetricFunctionsChart(node, plot), [plot])} className="potential-plot-wrap" />;
    const ScanChart = ({ data }) => <div ref={chartMount((node) => Core.Chart.renderModeScanChart(node, data), [data])} className="scan-plot-wrap" />;
    const OrderChart = ({ data }) => <div ref={chartMount((node) => Core.Chart.renderOrderTrendChart(node, data), [data])} className="mode-plot-wrap" />;
    const GreybodyChart = ({ data }) => <div ref={chartMount((node) => Core.Chart.renderGreybodyChart(node, data), [data])} className="scan-plot-wrap" />;
    const HawkingSpectrumChart = ({ data }) => <div ref={chartMount((node) => Core.Chart.renderHawkingSpectrumChart(node, data), [data])} className="scan-plot-wrap" />;
    const pickPade = (items) => !items || !items.length ? null : items.slice().sort((a, b) => {
      const da = Number(a.relativeToMain);
      const db = Number(b.relativeToMain);
      const ga = Math.abs(a.numeratorDegree - a.denominatorDegree);
      const gb = Math.abs(b.numeratorDegree - b.denominatorDegree);
      if (Number.isFinite(da) && Number.isFinite(db) && da !== db) return da - db;
      if (ga !== gb) return ga - gb;
      return (b.numeratorDegree + b.denominatorDegree) - (a.numeratorDegree + a.denominatorDegree);
    })[0];
    const MetricInputCard = ({ title, description, disabled, preview, onOpenEditor, editorDisabled }) => <div className={`editor-card${disabled ? " mirrored-editor" : ""}`}><div className="editor-card-head"><div><h4>{title}</h4></div><div className="editor-card-tools"><button type="button" className="ghost-button compact-button" disabled={editorDisabled} onClick={onOpenEditor}>Equation Editor</button></div></div><div className="preview-label">Preview</div><FormulaPreview preview={preview} /></div>;
    const FormulaEditorModal = ({ open, fieldLabel, draft, preview, inputRef, onDraftChange, onOpenHelp, onApply, onClose, windowStyle, onMouseDownHeader }) => !open ? null : <div className="formula-editor-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="formula-editor-card" style={windowStyle} onClick={(event) => event.stopPropagation()}><div className="mode-drawer-head window-drag-handle" onMouseDown={onMouseDownHeader}><div><h3>Equation Editor</h3></div><div className="window-actions"><button type="button" className="ghost-button compact-button" onClick={(event) => { event.stopPropagation(); onOpenHelp(); }}>Help</button><button type="button" className="ghost-button compact-button" onClick={(event) => { event.stopPropagation(); onClose(); }}>Close</button></div></div><div className="formula-editor-body"><div className="formula-editor-pane"><div className="formula-editor-section"><div className="formula-editor-section-head"><h4>Formula</h4></div><textarea ref={inputRef} className="formula-input formula-editor-textarea" rows="9" spellCheck="false" value={draft} onChange={(event) => onDraftChange(event.target.value)} /></div></div><div className="formula-editor-pane"><div className="formula-editor-section"><div className="formula-editor-section-head"><h4>Rendered preview</h4></div><FormulaPreview preview={preview} /></div></div></div><div className="formula-editor-footer"><button type="button" className="ghost-button" onClick={onClose}>Cancel</button><button type="button" className="primary-button" disabled={preview.invalid} onClick={onApply}>Insert Formula</button></div></div></div>;

    function AppRoot() {
      const initial = presets.schwarzschild.values;
      const [config, setConfig] = useState({ presetKey: "schwarzschild", ...initial });
      const [parameterSpecs, setParameterSpecs] = useState(initial.parameterSpecs);
      const [status, setStatus] = useState(window.location.protocol === "file:" ? "Opened from a local file; the worker will use the compatibility bootstrap." : "Idle");
      const [progress, setProgress] = useState({ completed: 0, total: 1 });
      const [error, setError] = useState("");
      const [result, setResult] = useState(null);
      const [analysisStatus, setAnalysisStatus] = useState("Idle");
      const [analysisProgress, setAnalysisProgress] = useState({ completed: 0, total: 1 });
      const [analysisError, setAnalysisError] = useState("");
      const [analysisResult, setAnalysisResult] = useState(null);
      const [lastRunConfig, setLastRunConfig] = useState(null);
      const [radiationConfig, setRadiationConfig] = useState(defaultRadiation);
      const [greybodyStatus, setGreybodyStatus] = useState("Idle");
      const [greybodyProgress, setGreybodyProgress] = useState({ completed: 0, total: 1 });
      const [greybodyError, setGreybodyError] = useState("");
      const [greybodyResult, setGreybodyResult] = useState(null);
      const [hawkingStatus, setHawkingStatus] = useState("Idle");
      const [hawkingProgress, setHawkingProgress] = useState({ completed: 0, total: 1 });
      const [hawkingError, setHawkingError] = useState("");
      const [hawkingResult, setHawkingResult] = useState(null);
      const [globalTask, setGlobalTask] = useState(null);
      const [selectedRowIndex, setSelectedRowIndex] = useState(null);
      const [workspaceTab, setWorkspaceTab] = useState("table");
      const [activeTab, setActiveTab] = useState("potential");
      const [radiationTab, setRadiationTab] = useState("greybody");
      const [drawerTab, setDrawerTab] = useState("orders");
      const [modeSource, setModeSource] = useState("wkb");
      const [helpOpen, setHelpOpen] = useState(false);
      const [referencesOpen, setReferencesOpen] = useState(false);
      const [sidebarTab, setSidebarTab] = useState("metric-definition");
      const [formulaEditor, setFormulaEditor] = useState({ open: false, field: "fExpression", draft: "" });
      const workerRef = useRef(null);
      const analysisWorkerRef = useRef(null);
      const radiationWorkerRef = useRef(null);
      const radiationPoolRef = useRef([]);
      const editorInputRef = useRef(null);
      const pendingCaretRef = useRef(null);
      const dragRef = useRef(null);
      const defaultWindowPositions = () => {
        const width = typeof window === "undefined" ? 1400 : window.innerWidth;
        return {
          mode: { top: 92, left: Math.max(24, (width - Math.min(760, width - 64)) / 2) },
          editor: { top: 72, left: Math.max(28, (width - Math.min(1080, width - 56)) / 2) },
          help: { top: 96, left: Math.max(20, (width - Math.min(720, width - 40)) / 2) },
          references: { top: 88, left: Math.max(24, (width - Math.min(760, width - 48)) / 2) }
        };
      };
      const [windowPositions, setWindowPositions] = useState(defaultWindowPositions);
      const metric = useMemo(() => {
        const fPreview = analyzeExpression(config.fExpression);
        const gText = config.sameMetric ? config.fExpression : config.gExpression;
        const gPreview = analyzeExpression(gText);
        const names = !fPreview.error && !gPreview.error ? Core.Parser.collectParameters([fPreview.ast, gPreview.ast]) : [];
        return { fPreview, gPreview, error: fPreview.error || gPreview.error || null, names };
      }, [config.fExpression, config.gExpression, config.sameMetric]);
      const singleMetricCaseActive = useMemo(() => !hasScanRange(parameterSpecs), [parameterSpecs]);
      const displayedQnmResult = singleMetricCaseActive && error ? null : result;
      const displayedAnalysisResult = singleMetricCaseActive && analysisError ? null : analysisResult;
      const displayedGreybodyRunResult = singleMetricCaseActive && greybodyError ? null : greybodyResult;
      const displayedHawkingResult = singleMetricCaseActive && hawkingError ? null : hawkingResult;
      const formulaEditorPreview = useMemo(() => analyzeExpression(formulaEditor.draft), [formulaEditor.draft]);
      useEffect(() => {
        setParameterSpecs((prev) => Object.fromEntries(metric.names.map((name) => [name, { ...defaultSpec, ...(prev[name] || {}) }])));
      }, [metric.names.join("|")]);
      useEffect(() => {
        const ellFloor = config.perturbationType === "electromagnetic" ? 1 : 0;
        setRadiationConfig((current) => ({
          ...current,
          greybodyEllMin: Math.max(ellFloor, clampInt(Number(current.greybodyEllMin != null ? current.greybodyEllMin : current.greybodyEll), ellFloor)),
          greybodyEllMax: Math.max(
            Math.max(ellFloor, clampInt(Number(current.greybodyEllMin != null ? current.greybodyEllMin : current.greybodyEll), ellFloor)),
            clampInt(Number(current.greybodyEllMax != null ? current.greybodyEllMax : current.greybodyEll), ellFloor)
          ),
          ellCutoff: Math.max(ellFloor, clampInt(Number(current.ellCutoff), ellFloor))
        }));
      }, [config.perturbationType]);
      useEffect(() => () => {
        disposeWorker(workerRef.current);
        disposeWorker(analysisWorkerRef.current);
        disposeWorker(radiationWorkerRef.current);
        disposeWorkerCollection(radiationPoolRef.current);
      }, []);
      useEffect(() => {
        if (!formulaEditor.open || !editorInputRef.current) return;
        editorInputRef.current.focus();
        const caret = pendingCaretRef.current;
        if (caret !== null && caret !== undefined) {
          editorInputRef.current.setSelectionRange(caret, caret);
          pendingCaretRef.current = null;
        } else {
          const end = formulaEditor.draft.length;
          editorInputRef.current.setSelectionRange(end, end);
        }
      }, [formulaEditor.open, formulaEditor.draft]);
      useEffect(() => {
        if (config.sameMetric && formulaEditor.open && formulaEditor.field === "gExpression") {
          setFormulaEditor({ open: false, field: "fExpression", draft: "" });
        }
      }, [config.sameMetric, formulaEditor.open, formulaEditor.field]);
      useEffect(() => {
        const onMove = (event) => {
          const drag = dragRef.current;
          if (!drag) return;
          setWindowPositions((current) => ({
            ...current,
            [drag.key]: {
              left: Math.max(12, event.clientX - drag.offsetX),
              top: Math.max(12, event.clientY - drag.offsetY)
            }
          }));
        };
        const onUp = () => {
          dragRef.current = null;
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
      }, []);
      const flatRows = useMemo(() => !displayedQnmResult ? [] : displayedQnmResult.cases.flatMap((caseData, caseIndex) => caseData.overtones.map((overtone, overtoneIndex) => ({ caseData, caseIndex, overtone, overtoneIndex }))), [displayedQnmResult]);
      const selectedRow = selectedRowIndex === null ? null : flatRows[selectedRowIndex] || null;
      const baseCase = displayedAnalysisResult && displayedAnalysisResult.cases && displayedAnalysisResult.cases.length ? displayedAnalysisResult.cases[0] : null;
      const varying = !displayedQnmResult ? [] : displayedQnmResult.parameterNames.filter((name) => displayedQnmResult.cases.some((item) => item.params[name] !== displayedQnmResult.cases[0].params[name]));
      const scanChartData = useMemo(() => {
        if (!displayedQnmResult || displayedQnmResult.cases.length < 2 || varying.length !== 1) return null;
        const parameterName = varying[0];
        const rows = displayedQnmResult.cases.map((caseData) => ({ x: Number(caseData.params[parameterName]), caseData })).filter((item) => Number.isFinite(item.x)).sort((a, b) => a.x - b.x);
        if (rows.length < 2) return null;
        const overtones = Array.from(new Set(rows[0].caseData.overtones.map((item) => item.n))).sort((a, b) => a - b);
        const branches = overtones.map((n) => {
          const values = rows.map((item) => {
            const mode = item.caseData.overtones.find((entry) => entry.n === n);
            return !mode ? null : modeSource === "pade" ? ((pickPade(mode.pade) || {}).value || null) : mode.main;
          });
          if (values.some((value) => !value)) return null;
          const re = values.map((value) => Number(value.re));
          const im = values.map((value) => Number(value.im));
          return re.every(Number.isFinite) && im.every(Number.isFinite) ? { n, re, im } : null;
        }).filter(Boolean);
        return branches.length ? { parameterName, x: rows.map((item) => item.x), branches, sourceLabel: modeSource === "pade" ? "Pade" : `WKB ${displayedQnmResult.mainOrder}` } : null;
      }, [displayedQnmResult, varying.join("|"), modeSource]);
      const orderChartData = useMemo(() => !selectedRow ? null : {
        overtone: selectedRow.overtone.n,
        orders: selectedRow.caseData.orders.map(Number),
        re: selectedRow.caseData.orders.map((order) => Number(selectedRow.overtone.orders[order].re)),
        im: selectedRow.caseData.orders.map((order) => Number(selectedRow.overtone.orders[order].im))
      }, [selectedRow]);
const analysisPlotData = useMemo(() => !displayedAnalysisResult ? null : {
  sameMetric: config.sameMetric,
  cases: displayedAnalysisResult.cases.map((caseData) => ({
    label: Object.entries(caseData.params || {}).map(([name, value]) => `${name}=${compactNumber(value)}`).join(", ") || "default parameters",
    plot: caseData.plot
  }))
}, [displayedAnalysisResult, config.sameMetric]);
const displayedGreybodyResult = useMemo(() => {
  if (displayedGreybodyRunResult) {
    return { ...displayedGreybodyRunResult, derivedFromHawking: false };
  }
  if (!displayedHawkingResult || !displayedHawkingResult.greybodyProfile) {
    return null;
  }
  return {
    params: displayedHawkingResult.params,
    parameterNames: displayedHawkingResult.parameterNames,
    perturbationType: displayedHawkingResult.perturbationType,
    mainOrder: displayedHawkingResult.mainOrder,
    ell: displayedHawkingResult.successfulElls && displayedHawkingResult.successfulElls.length ? displayedHawkingResult.successfulElls[0] : null,
    successfulCurveCount: displayedHawkingResult.greybodyProfile.curves.length,
    horizon: displayedHawkingResult.horizon,
    surfaceGravity: displayedHawkingResult.surfaceGravity,
    temperature: displayedHawkingResult.temperature,
    warnings: [],
    diagnostics: displayedHawkingResult.diagnostics,
    greybody: displayedHawkingResult.greybodyProfile,
    derivedFromHawking: true
  };
}, [displayedGreybodyRunResult, displayedHawkingResult]);
const radiationGreybodyData = useMemo(() => !displayedGreybodyResult ? null : {
  x: displayedGreybodyResult.greybody.x,
  selectedEll: displayedGreybodyResult.ell,
  curves: displayedGreybodyResult.greybody.curves
}, [displayedGreybodyResult]);
const radiationSpectrumData = useMemo(() => !displayedHawkingResult ? null : displayedHawkingResult.spectrum, [displayedHawkingResult]);
      const qnmWarnings = uniqueWarnings((displayedQnmResult ? displayedQnmResult.warnings || [] : []).concat(displayedQnmResult ? displayedQnmResult.cases.flatMap((item) => item.warnings) : []));
      const analysisWarnings = uniqueWarnings((displayedAnalysisResult ? displayedAnalysisResult.warnings || [] : []).concat(displayedAnalysisResult ? displayedAnalysisResult.cases.flatMap((item) => item.warnings || []) : []));
      const greybodyWarnings = uniqueWarnings(displayedGreybodyRunResult ? displayedGreybodyRunResult.warnings : []);
      const hawkingWarnings = uniqueWarnings(displayedHawkingResult ? displayedHawkingResult.warnings : []);
      const allDiagnosticsWarnings = uniqueWarnings(qnmWarnings.concat(analysisWarnings, greybodyWarnings, hawkingWarnings));
      const diagnosticsEntries = useMemo(() => {
        const seen = new Set();
        const entries = [];
        const add = (label, value) => {
          if (value === null || value === undefined || value === "") {
            return;
          }
          const text = String(value);
          const key = `${label}|${text}`;
          if (seen.has(key)) {
            return;
          }
          seen.add(key);
          entries.push({ label, value: text });
        };
        if (displayedQnmResult && displayedQnmResult.cases && displayedQnmResult.cases.length > 0) {
          const item = displayedQnmResult.cases[0];
          add("Horizon", compactNumber(item.horizon));
          add("Peak", compactNumber(item.peak));
          add("Peak bracket width", compactNumber(item.peakBracketWidth));
          add("Peak bracket tolerance", compactNumber(item.peakBracketTolerance));
          add("Spectral window Delta", compactNumber(item.delta));
          add("Stability", compactNumber(item.stability));
          add("Tail ratio", compactNumber(item.tailRatio));
          add("Precision sensitivity", compactNumber(item.precisionSensitivity));
          add("|V'(r_peak)|", compactNumber(item.peakDerivativeAbs));
          add("|V''(r_peak)|", compactNumber(item.peakCurvatureAbs));
          add("|V'/V''|", compactNumber(item.peakShiftEstimate));
          add("|V'/V''| / Delta", compactNumber(item.peakShiftOverDelta));
        }
        if (displayedAnalysisResult && displayedAnalysisResult.cases && displayedAnalysisResult.cases.length > 0) {
          const item = displayedAnalysisResult.cases[0];
          add("Successful profiles", compactNumber(displayedAnalysisResult.cases.length));
          add("Horizon", compactNumber(item.horizon));
          add("Peak", compactNumber(item.peak));
          add("Peak bracket width", compactNumber(item.peakBracketWidth));
          add("Peak bracket tolerance", compactNumber(item.peakBracketTolerance));
          add("Spectral window Delta", compactNumber(item.delta));
          add("Stability", compactNumber(item.stability));
          add("Tail ratio", compactNumber(item.tailRatio));
          add("|V'(r_peak)|", compactNumber(item.peakDerivativeAbs));
          add("|V''(r_peak)|", compactNumber(item.peakCurvatureAbs));
        }
        if (displayedGreybodyRunResult) {
          add("Representative ell", compactNumber(displayedGreybodyRunResult.diagnostics.ell));
          add("Successful curves", compactNumber(displayedGreybodyRunResult.successfulCurveCount));
          add("Horizon", compactNumber(displayedGreybodyRunResult.horizon));
          add("Surface gravity", compactNumber(displayedGreybodyRunResult.surfaceGravity));
          add("Temperature", compactNumber(displayedGreybodyRunResult.temperature));
          add("Peak", compactNumber(displayedGreybodyRunResult.diagnostics.peak));
          add("Peak bracket width", compactNumber(displayedGreybodyRunResult.diagnostics.peakBracketWidth));
          add("Peak bracket tolerance", compactNumber(displayedGreybodyRunResult.diagnostics.peakBracketTolerance));
          add("Spectral window Delta", compactNumber(displayedGreybodyRunResult.diagnostics.delta));
          add("Stability", compactNumber(displayedGreybodyRunResult.diagnostics.stability));
          add("Tail ratio", compactNumber(displayedGreybodyRunResult.diagnostics.tailRatio));
        }
        if (displayedHawkingResult) {
          add("Representative ell", compactNumber(displayedHawkingResult.diagnostics.ell));
          add("Successful ell values", displayedHawkingResult.successfulElls.join(", "));
          add("Horizon", compactNumber(displayedHawkingResult.horizon));
          add("Surface gravity", compactNumber(displayedHawkingResult.surfaceGravity));
          add("Temperature", compactNumber(displayedHawkingResult.temperature));
          add("Peak", compactNumber(displayedHawkingResult.diagnostics.peak));
          add("Peak bracket width", compactNumber(displayedHawkingResult.diagnostics.peakBracketWidth));
          add("Peak bracket tolerance", compactNumber(displayedHawkingResult.diagnostics.peakBracketTolerance));
          add("Spectral window Delta", compactNumber(displayedHawkingResult.diagnostics.delta));
          add("Stability", compactNumber(displayedHawkingResult.diagnostics.stability));
          add("Tail ratio", compactNumber(displayedHawkingResult.diagnostics.tailRatio));
        }
        return entries;
      }, [displayedQnmResult, displayedAnalysisResult, displayedGreybodyRunResult, displayedHawkingResult]);
      const globalStatusDisplay = useMemo(() => {
        const map = {
          qnm: { status, progress },
          analysis: { status: analysisStatus, progress: analysisProgress },
          greybody: { status: greybodyStatus, progress: greybodyProgress },
          hawking: { status: hawkingStatus, progress: hawkingProgress }
        };
        const selected = globalTask && map[globalTask] ? map[globalTask] : map.qnm;
        const progressValue = selected.progress && selected.progress.total > 0
          ? Math.round((selected.progress.completed / selected.progress.total) * 100)
          : 0;
        return {
          status: selected.status,
          progressValue
        };
      }, [globalTask, status, progress, analysisStatus, analysisProgress, greybodyStatus, greybodyProgress, hawkingStatus, hawkingProgress]);
      useEffect(() => {
        if (!scanChartData && activeTab === "modes") {
          setActiveTab("potential");
        }
      }, [scanChartData, activeTab]);
const updateConfig = (patch) => setConfig((current) => {
        const next = { ...current, ...patch };
        next.ell = clampInt(Number(next.ell), next.perturbationType === "electromagnetic" ? 1 : 0);
        next.overtoneMax = clampInt(Number(next.overtoneMax), 0);
        if (next.sameMetric) next.gExpression = next.fExpression;
        return next;
      });
      const updateMetricField = (field, value) => {
        if (field === "gExpression") {
          updateConfig({ gExpression: value, presetKey: "custom" });
          return;
        }
        updateConfig({ fExpression: value, presetKey: "custom" });
      };
      const openFormulaEditor = (field) => {
        if (field === "gExpression" && config.sameMetric) return;
        const draft = field === "gExpression" ? config.gExpression : config.fExpression;
        pendingCaretRef.current = null;
        setWindowPositions((current) => ({ ...current, editor: defaultWindowPositions().editor }));
        setFormulaEditor({ open: true, field, draft });
      };
      const closeFormulaEditor = () => {
        pendingCaretRef.current = null;
        setFormulaEditor({ open: false, field: "fExpression", draft: "" });
      };
      const applyFormulaEditor = () => {
        if (formulaEditorPreview.invalid) return;
        updateMetricField(formulaEditor.field, formulaEditor.draft);
        closeFormulaEditor();
      };
      const beginWindowDrag = (key, event) => {
        if (event.button !== 0) return;
        if (event.target.closest("button, input, textarea, select")) return;
        const rect = event.currentTarget.parentElement.getBoundingClientRect();
        dragRef.current = {
          key,
          offsetX: event.clientX - rect.left,
          offsetY: event.clientY - rect.top
        };
        event.preventDefault();
      };
      const collectConfig = () => {
        if (metric.error) throw new Error(metric.error);
        return {
          fExpression: config.fExpression.trim(),
          gExpression: (config.sameMetric ? config.fExpression : config.gExpression).trim(),
          perturbationType: config.perturbationType,
          ell: clampInt(Number(config.ell), config.perturbationType === "electromagnetic" ? 1 : 0),
          overtoneMax: clampInt(Number(config.overtoneMax), 0),
          mainOrder: Number(config.mainOrder),
          showAllOrders: !!config.showAllOrders,
          precision: Number(config.precision),
          spectralNodes: Number(config.spectralNodes),
          plotSamples: Number(config.plotSamples),
          rMin: String(config.rMin).trim(),
          rMax: String(config.rMax).trim(),
          horizonSamples: Number(config.horizonSamples),
          peakSamples: Number(config.peakSamples),
          parameterSpecs
        };
      };
      const collectGreybodyConfig = () => {
        const runConfig = collectConfig();
        const ellFloor = config.perturbationType === "electromagnetic" ? 1 : 0;
        const ellMin = clampInt(Number(radiationConfig.greybodyEllMin != null ? radiationConfig.greybodyEllMin : radiationConfig.greybodyEll), ellFloor);
        const ellMax = Math.max(ellMin, clampInt(Number(radiationConfig.greybodyEllMax != null ? radiationConfig.greybodyEllMax : radiationConfig.greybodyEll), ellFloor));
        return {
          runConfig,
          radiation: {
            omegaMin: String(radiationConfig.omegaMin).trim(),
            omegaMax: String(radiationConfig.omegaMax).trim(),
            omegaPoints: clampInt(Number(radiationConfig.omegaPoints), 25),
            greybodyEll: ellMin,
            greybodyEllMin: ellMin,
            greybodyEllMax: ellMax,
            ellCutoff: clampInt(Number(radiationConfig.ellCutoff), ellFloor)
          }
        };
      };
        const collectHawkingConfig = () => {
          const runConfig = collectConfig();
          if (hasScanRange(parameterSpecs)) {
            throw new Error("Hawking radiation currently requires fixed parameter values. Set every metric parameter to a single value.");
        }
        const ellFloor = config.perturbationType === "electromagnetic" ? 1 : 0;
        return {
          runConfig,
          radiation: {
            omegaMin: String(radiationConfig.omegaMin).trim(),
            omegaMax: String(radiationConfig.omegaMax).trim(),
            omegaPoints: clampInt(Number(radiationConfig.omegaPoints), 25),
            greybodyEll: Math.max(ellFloor, clampInt(Number(radiationConfig.greybodyEllMin != null ? radiationConfig.greybodyEllMin : radiationConfig.greybodyEll), ellFloor)),
            greybodyEllMin: Math.max(ellFloor, clampInt(Number(radiationConfig.greybodyEllMin != null ? radiationConfig.greybodyEllMin : radiationConfig.greybodyEll), ellFloor)),
            greybodyEllMax: Math.max(ellFloor, clampInt(Number(radiationConfig.greybodyEllMax != null ? radiationConfig.greybodyEllMax : radiationConfig.greybodyEll), ellFloor)),
            ellCutoff: clampInt(Number(radiationConfig.ellCutoff), ellFloor)
            }
          };
        };
        const isCurrentMetricSingleCase = () => !hasScanRange(parameterSpecs);
        const clearQnmResult = () => {
          setResult(null);
          setSelectedRowIndex(null);
        };
        const clearAnalysisComputation = () => {
          setAnalysisResult(null);
        };
        const clearGreybodyComputation = () => {
          setGreybodyResult(null);
        };
        const clearHawkingComputation = () => {
          setHawkingResult(null);
        };
        const onPreset = (key) => {
          const values = presets[key].values;
          setConfig({ presetKey: key, ...values });
          setParameterSpecs(values.parameterSpecs);
        };
        const runQnmComputation = () => {
          setError("");
          if (isCurrentMetricSingleCase()) {
            clearQnmResult();
          }
          let runConfig;
          try {
            runConfig = collectConfig();
          } catch (runError) {
          setError(runError.message || String(runError));
          return;
        }
        disposeWorker(workerRef.current);
        setGlobalTask("qnm");
        setStatus("Starting the worker and preparing the computation");
        setProgress({ completed: 0, total: 1 });
        setLastRunConfig(runConfig);
        let worker;
        try {
          worker = createWorker();
        } catch (_error) {
          setStatus("Worker startup failed");
          setError(window.location.protocol === "file:" ? "The worker did not start from file://. Serve the project locally with: python -m http.server 8000." : "Could not start the worker.");
          return;
        }
        workerRef.current = worker;
        let ready = false;
        const startupTimer = window.setTimeout(() => {
          if (workerRef.current && !ready) {
            setStatus("Worker did not start");
            setError(window.location.protocol === "file:" ? "The worker did not start from file://. Serve the project locally with: python -m http.server 8000." : "Could not start the worker.");
            disposeWorker(workerRef.current);
            workerRef.current = null;
          }
        }, 3000);
        worker.addEventListener("error", () => {
          window.clearTimeout(startupTimer);
          setStatus("Worker startup failed");
          setError(window.location.protocol === "file:" ? "The worker did not start from file://. Serve the project locally with: python -m http.server 8000." : "Could not start the worker.");
          disposeWorker(workerRef.current);
          workerRef.current = null;
        });
        worker.addEventListener("message", (event) => {
          const message = event.data;
          if (message.type === "ready") {
            ready = true;
            window.clearTimeout(startupTimer);
            setStatus("Worker is running, computation in progress");
            return;
          }
          if (message.type === "progress") {
            setStatus(`Processed ${message.completed} of ${message.total}`);
            setProgress({ completed: message.completed, total: message.total });
            return;
          }
          if (message.type === "done") {
            window.clearTimeout(startupTimer);
            setStatus("Computation finished");
            setProgress({ completed: 1, total: 1 });
            setResult(message.result);
            setSelectedRowIndex(null);
            setDrawerTab("orders");
            setModeSource("wkb");
            disposeWorker(workerRef.current);
            workerRef.current = null;
            return;
          }
          if (message.type === "error") {
            window.clearTimeout(startupTimer);
            setStatus("Computation failed");
            setError(message.message);
            disposeWorker(workerRef.current);
            workerRef.current = null;
          }
        });
        worker.postMessage({ type: "run", config: { ...runConfig, precisionCheck: false, storePlots: estimateCaseCount(runConfig) === 1 } });
      };
        const onRun = () => runQnmComputation();
        const onRunAnalysis = () => {
          setAnalysisError("");
          if (isCurrentMetricSingleCase()) {
            clearAnalysisComputation();
          }
          let runConfig;
          try {
            runConfig = collectConfig();
          } catch (runError) {
            setAnalysisError(runError.message || String(runError));
          return;
        }
        disposeWorker(analysisWorkerRef.current);
        setGlobalTask("analysis");
        setAnalysisStatus("Starting the worker and preparing the analysis");
        setAnalysisProgress({ completed: 0, total: 1 });
        let worker;
        try {
          worker = createWorker();
        } catch (_error) {
          setAnalysisStatus("Worker startup failed");
          setAnalysisError(window.location.protocol === "file:" ? "The worker did not start from file://. Serve the project locally with: python -m http.server 8000." : "Could not start the worker.");
          return;
        }
        analysisWorkerRef.current = worker;
        let ready = false;
        const startupTimer = window.setTimeout(() => {
          if (analysisWorkerRef.current && !ready) {
            setAnalysisStatus("Worker did not start");
            setAnalysisError(window.location.protocol === "file:" ? "The worker did not start from file://. Serve the project locally with: python -m http.server 8000." : "Could not start the worker.");
            disposeWorker(analysisWorkerRef.current);
            analysisWorkerRef.current = null;
          }
        }, 3000);
        worker.addEventListener("error", () => {
          window.clearTimeout(startupTimer);
          setAnalysisStatus("Worker startup failed");
          setAnalysisError(window.location.protocol === "file:" ? "The worker did not start from file://. Serve the project locally with: python -m http.server 8000." : "Could not start the worker.");
          disposeWorker(analysisWorkerRef.current);
          analysisWorkerRef.current = null;
        });
        worker.addEventListener("message", (event) => {
          const message = event.data;
          if (message.type === "ready") {
            ready = true;
            window.clearTimeout(startupTimer);
            setAnalysisStatus("Worker is running, analysis in progress");
            return;
          }
          if (message.type === "analysisProgress") {
            setAnalysisStatus(`Processed ${message.completed} of ${message.total} analysis points`);
            setAnalysisProgress({ completed: message.completed, total: message.total });
            return;
          }
          if (message.type === "analysisDone") {
            window.clearTimeout(startupTimer);
            setAnalysisStatus("Analysis finished");
            setAnalysisProgress({ completed: 1, total: 1 });
            setAnalysisResult(message.result);
            disposeWorker(analysisWorkerRef.current);
            analysisWorkerRef.current = null;
            return;
          }
          if (message.type === "analysisError") {
            window.clearTimeout(startupTimer);
            setAnalysisStatus("Analysis failed");
            setAnalysisError(message.message);
            disposeWorker(analysisWorkerRef.current);
            analysisWorkerRef.current = null;
          }
        });
        worker.postMessage({ type: "runAnalysis", config: { ...runConfig, precisionCheck: false, storePlots: true } });
      };
        const runSingleRadiationTask = (task, payload, setters, initialStatus) => {
          disposeWorkerCollection(radiationPoolRef.current);
          radiationPoolRef.current = [];
          setters.setError("");
          disposeWorker(radiationWorkerRef.current);
          setters.setStatus(initialStatus || `Starting the worker and preparing the ${task} computation`);
          setters.setProgress({ completed: 0, total: 1 });
          let worker;
          try {
          worker = createWorker();
        } catch (_error) {
          setters.setStatus("Worker startup failed");
          setters.setError(window.location.protocol === "file:" ? "The worker did not start from file://. Serve the project locally with: python -m http.server 8000." : "Could not start the worker.");
          return;
        }
        radiationWorkerRef.current = worker;
        let ready = false;
        const startupTimer = window.setTimeout(() => {
          if (radiationWorkerRef.current && !ready) {
            setters.setStatus("Worker did not start");
            setters.setError(window.location.protocol === "file:" ? "The worker did not start from file://. Serve the project locally with: python -m http.server 8000." : "Could not start the worker.");
            disposeWorker(radiationWorkerRef.current);
            radiationWorkerRef.current = null;
          }
        }, 3000);
        worker.addEventListener("error", () => {
          window.clearTimeout(startupTimer);
          setters.setStatus("Worker startup failed");
          setters.setError(window.location.protocol === "file:" ? "The worker did not start from file://. Serve the project locally with: python -m http.server 8000." : "Could not start the worker.");
          disposeWorker(radiationWorkerRef.current);
          radiationWorkerRef.current = null;
        });
        worker.addEventListener("message", (event) => {
          const message = event.data;
          if (message.type === "ready") {
            ready = true;
            window.clearTimeout(startupTimer);
            setters.setStatus(`Worker is running, ${task} computation in progress`);
            return;
          }
          if (message.type === `${task}Progress`) {
            setters.setStatus(`Processed ${message.completed} of ${message.total} ${task} points`);
            setters.setProgress({ completed: message.completed, total: message.total });
            return;
          }
          if (message.type === `${task}Done`) {
            window.clearTimeout(startupTimer);
            setters.setStatus(`${task === "greybody" ? "Greybody" : "Hawking radiation"} computation finished`);
            setters.setProgress({ completed: 1, total: 1 });
            setters.setResult(message.result);
            disposeWorker(radiationWorkerRef.current);
            radiationWorkerRef.current = null;
            return;
          }
          if (message.type === `${task}Error`) {
            window.clearTimeout(startupTimer);
            setters.setStatus(`${task === "greybody" ? "Greybody" : "Hawking radiation"} computation failed`);
            setters.setError(message.message);
            disposeWorker(radiationWorkerRef.current);
            radiationWorkerRef.current = null;
          }
        });
          worker.postMessage({
            type: task === "greybody" ? "runGreybody" : "runHawking",
            config: { ...payload.runConfig, precisionCheck: false, storePlots: true },
            radiation: payload.radiation
          });
        };
        const runRadiationTask = (task, payload, setters) => {
          if (config.parallelRadiation && Math.max(1, clampInt(Number(config.parallelRadiationWorkers), 1)) > 1) {
            runParallelRadiationTask(task, payload, setters);
            return;
          }
          runSingleRadiationTask(task, payload, setters);
        };
      const finalizeParallelGreybody = (plan, taskStates) => {
        const warnings = uniqueWarnings(plan.warnings || []);
        const curves = plan.tasks
          .map((task) => ({ task, state: taskStates.get(task.id) }))
          .filter(({ task, state }) => {
            const complete = state && !state.failed && state.values.every((value) => value !== null);
            if (!complete) {
              pushUnique(warnings, `${task.label} did not finish successfully and was skipped.`);
            }
            return complete;
          })
          .map(({ task, state }) => {
            if (state.imagResidualWarning) {
              pushUnique(warnings, `[${Object.entries(task.params).map(([name, value]) => `${name}=${value}`).join(", ") || "default parameters"}] The WKB transmission coefficient has a noticeable imaginary residual after applying GBFactor.`);
            }
            if (state.intervalWarning) {
              pushUnique(warnings, `[${Object.entries(task.params).map(([name, value]) => `${name}=${value}`).join(", ") || "default parameters"}] The WKB transmission coefficient moved outside the physical [0,1] interval.`);
            }
            return {
              params: task.params,
              ell: task.ell,
              label: task.label,
              values: state.values
            };
          });
        if (!curves.length) {
          throw new Error(warnings[0] || "No valid greybody curve was obtained for the requested parameter/ell range.");
        }
        return {
          params: plan.params,
          parameterNames: plan.parameterNames,
          perturbationType: plan.perturbationType,
          mainOrder: plan.mainOrder,
          ell: plan.ell,
          ellMin: plan.ellMin,
          ellMax: plan.ellMax,
          successfulCurveCount: curves.length,
          horizon: plan.horizon,
          surfaceGravity: plan.surfaceGravity,
          temperature: plan.temperature,
          warnings,
          greybody: {
            x: plan.omegaGrid,
            curves
          },
          diagnostics: plan.diagnostics
        };
      };
      const finalizeParallelHawking = (plan, taskStates) => {
        const warnings = uniqueWarnings(plan.warnings || []);
        const successfulTasks = plan.tasks
          .map((task) => ({ task, state: taskStates.get(task.id) }))
          .filter(({ task, state }) => {
            const complete = state && !state.failed && state.values.every((value) => value !== null) && state.transmissions.every((value) => value !== null);
            if (!complete) {
              pushUnique(warnings, `[ell=${task.ell}] The contribution did not finish successfully and was skipped.`);
            }
            return complete;
          });
        if (!successfulTasks.length) {
          throw new Error(warnings[0] || "No valid ell contribution was obtained for the Hawking spectrum.");
        }
        const ctx = Core.Numerics.createContext(plan.precision);
        const partials = successfulTasks.map(({ task, state }) => {
          if (state.imagResidualWarning) {
            pushUnique(warnings, `[ell=${task.ell}] The WKB transmission coefficient has a noticeable imaginary residual after applying GBFactor.`);
          }
          if (state.intervalWarning) {
            pushUnique(warnings, `[ell=${task.ell}] The WKB transmission coefficient moved outside the physical [0,1] interval.`);
          }
          return {
            ell: task.ell,
            values: state.values
          };
        });
        const total = plan.omegaGrid.map((_, index) => partials.reduce((sum, item) => sum.plus(new ctx.D(item.values[index])), ctx.zero).toString());
        return {
          params: plan.params,
          parameterNames: plan.parameterNames,
          perturbationType: plan.perturbationType,
          mainOrder: plan.mainOrder,
          ellCutoff: plan.ellCutoff,
          successfulElls: partials.map((item) => item.ell),
          horizon: plan.horizon,
          surfaceGravity: plan.surfaceGravity,
          temperature: plan.temperature,
          warnings,
          greybodyProfile: {
            x: plan.omegaGrid,
            curves: successfulTasks.map(({ task, state }) => ({
              ell: task.ell,
              label: task.label,
              params: task.params,
              values: state.transmissions
            }))
          },
          spectrum: {
            x: plan.omegaGrid,
            total,
            partials
          },
          diagnostics: plan.diagnostics
        };
      };
      const runParallelRadiationTask = (task, payload, setters) => {
        setters.setError("");
        disposeWorker(radiationWorkerRef.current);
        radiationWorkerRef.current = null;
        disposeWorkerCollection(radiationPoolRef.current);
        radiationPoolRef.current = [];
        const label = task === "greybody" ? "greybody" : "Hawking radiation";
        setters.setStatus(`Preparing parallel ${label} computation`);
        setters.setProgress({ completed: 0, total: 1 });
        let prepWorker;
        try {
          prepWorker = createWorker();
        } catch (_error) {
          setters.setStatus("Worker startup failed");
          setters.setError(window.location.protocol === "file:" ? "The worker did not start from file://. Serve the project locally with: python -m http.server 8000." : "Could not start the worker.");
          return;
        }
        radiationWorkerRef.current = prepWorker;
        let ready = false;
        let finished = false;
        const startupTimer = window.setTimeout(() => {
          if (radiationWorkerRef.current && !ready) {
            setters.setStatus("Worker did not start");
            setters.setError(window.location.protocol === "file:" ? "The worker did not start from file://. Serve the project locally with: python -m http.server 8000." : "Could not start the worker.");
            disposeWorker(radiationWorkerRef.current);
            radiationWorkerRef.current = null;
          }
        }, 3000);
          const failParallel = (message) => {
            if (finished) return;
            finished = true;
            window.clearTimeout(startupTimer);
            disposeWorker(radiationWorkerRef.current);
            radiationWorkerRef.current = null;
            disposeWorkerCollection(radiationPoolRef.current);
            radiationPoolRef.current = [];
            runSingleRadiationTask(
              task,
              payload,
              setters,
              `Parallel ${task === "greybody" ? "greybody" : "Hawking radiation"} failed, retrying in single-worker mode`
            );
          };
        prepWorker.addEventListener("error", () => {
          failParallel(window.location.protocol === "file:" ? "The worker did not start from file://. Serve the project locally with: python -m http.server 8000." : "Could not start the worker.");
        });
        prepWorker.addEventListener("message", (event) => {
          const message = event.data;
          if (message.type === "ready") {
            ready = true;
            window.clearTimeout(startupTimer);
            setters.setStatus(`Preparing WKB kernels for parallel ${label}`);
            prepWorker.postMessage({
              type: task === "greybody" ? "prepareGreybodyParallelPlan" : "prepareHawkingParallelPlan",
              config: { ...payload.runConfig, precisionCheck: false, storePlots: true },
              radiation: payload.radiation
            });
            return;
          }
          if (message.type === `${task === "greybody" ? "prepareGreybodyParallelPlan" : "prepareHawkingParallelPlan"}Error`) {
            failParallel(message.message);
            return;
          }
          if (message.type !== `${task === "greybody" ? "prepareGreybodyParallelPlan" : "prepareHawkingParallelPlan"}Done`) {
            return;
          }
          window.clearTimeout(startupTimer);
          disposeWorker(radiationWorkerRef.current);
          radiationWorkerRef.current = null;
          const plan = message.result;
          const maxWorkers = Math.max(1, clampInt(Number(config.parallelRadiationWorkers), 1));
          const workerCount = maxWorkers;
          const chunkSize = Math.max(8, Math.ceil(plan.omegaGrid.length / Math.max(1, workerCount * 4)));
          const queue = [];
          for (const taskEntry of plan.tasks) {
            for (let start = 0; start < plan.omegaGrid.length; start += chunkSize) {
              queue.push({
                taskId: taskEntry.id,
                kind: task,
                ell: taskEntry.ell,
                temperature: taskEntry.temperature,
                kernel: taskEntry.kernel,
                start,
                end: Math.min(plan.omegaGrid.length, start + chunkSize),
                omegas: plan.omegaGrid.slice(start, Math.min(plan.omegaGrid.length, start + chunkSize))
              });
            }
          }
          const totalPoints = plan.tasks.length * plan.omegaGrid.length;
          setters.setStatus(`Running parallel ${label} computation on ${workerCount} workers`);
          setters.setProgress({ completed: 0, total: totalPoints });
          const taskStates = new Map(plan.tasks.map((taskEntry) => [taskEntry.id, {
            task: taskEntry,
            values: Array(plan.omegaGrid.length).fill(null),
            transmissions: Array(plan.omegaGrid.length).fill(null),
            imagResidualWarning: false,
            intervalWarning: false,
            failed: false
          }]));
          const failedTaskIds = new Set();
          let active = 0;
          let completed = 0;
          const pool = [];
          radiationPoolRef.current = pool;
          const finalizeIfDone = () => {
            if (finished || active > 0 || queue.length > 0) {
              return;
            }
            finished = true;
            try {
              const aggregate = task === "greybody"
                ? finalizeParallelGreybody(plan, taskStates)
                : finalizeParallelHawking(plan, taskStates);
              setters.setStatus(`${task === "greybody" ? "Greybody" : "Hawking radiation"} computation finished`);
              setters.setProgress({ completed: 1, total: 1 });
              setters.setResult(aggregate);
            } catch (aggregateError) {
              setters.setStatus(`${task === "greybody" ? "Greybody" : "Hawking radiation"} computation failed`);
              setters.setError(aggregateError.message || String(aggregateError));
            }
            disposeWorkerCollection(radiationPoolRef.current);
            radiationPoolRef.current = [];
          };
          const dispatchNext = (worker) => {
            while (queue.length) {
              const next = queue.shift();
              if (failedTaskIds.has(next.taskId)) {
                continue;
              }
              active += next.end - next.start;
              worker.postMessage({
                type: "evaluateRadiationChunk",
                chunk: {
                  ...next,
                  precision: plan.precision
                }
              });
              return;
            }
            finalizeIfDone();
          };
          for (let index = 0; index < workerCount; index += 1) {
            let worker;
            try {
              worker = createWorker();
            } catch (_error) {
              failParallel(window.location.protocol === "file:" ? "The worker did not start from file://. Serve the project locally with: python -m http.server 8000." : "Could not start the worker.");
              return;
            }
            pool.push(worker);
            let chunkWorkerReady = false;
            worker.addEventListener("error", () => {
              failParallel(window.location.protocol === "file:" ? "The worker did not start from file://. Serve the project locally with: python -m http.server 8000." : "Could not start the worker.");
            });
            worker.addEventListener("message", (chunkEvent) => {
              const chunkMessage = chunkEvent.data;
              if (chunkMessage.type === "ready") {
                chunkWorkerReady = true;
                dispatchNext(worker);
                return;
              }
              if (!chunkWorkerReady || finished) {
                return;
              }
              if (chunkMessage.type === "evaluateRadiationChunkDone") {
                const resultChunk = chunkMessage.result;
                const state = taskStates.get(resultChunk.taskId);
                if (state && !state.failed) {
                  for (let pointIndex = resultChunk.start; pointIndex < resultChunk.end; pointIndex += 1) {
                    const localIndex = pointIndex - resultChunk.start;
                    state.values[pointIndex] = resultChunk.values[localIndex];
                    state.transmissions[pointIndex] = resultChunk.transmissions[localIndex];
                  }
                  state.imagResidualWarning = state.imagResidualWarning || resultChunk.imagResidualWarning;
                  state.intervalWarning = state.intervalWarning || resultChunk.intervalWarning;
                }
                completed += resultChunk.end - resultChunk.start;
                active -= resultChunk.end - resultChunk.start;
                setters.setStatus(`Processed ${completed} of ${totalPoints} ${label} points in parallel`);
                setters.setProgress({ completed, total: totalPoints });
                dispatchNext(worker);
                return;
              }
              if (chunkMessage.type === "evaluateRadiationChunkError") {
                const failedLength = Math.max(0, Number(chunkMessage.end || 0) - Number(chunkMessage.start || 0));
                completed += failedLength;
                active -= failedLength;
                const state = taskStates.get(chunkMessage.taskId);
                if (state) {
                  state.failed = true;
                  failedTaskIds.add(chunkMessage.taskId);
                }
                const failedTask = plan.tasks.find((item) => item.id === chunkMessage.taskId);
                if (failedTask) {
                  const prefix = task === "greybody" ? failedTask.label : `[ell=${failedTask.ell}]`;
                  const warning = `${prefix} ${chunkMessage.message}`;
                  const currentWarnings = plan.warnings || [];
                  if (!currentWarnings.includes(warning)) {
                    currentWarnings.push(warning);
                  }
                }
                setters.setStatus(`Processed ${completed} of ${totalPoints} ${label} points in parallel`);
                setters.setProgress({ completed, total: totalPoints });
                dispatchNext(worker);
              }
            });
          }
        });
        };
        const onRunGreybody = () => {
          setGreybodyError("");
          if (isCurrentMetricSingleCase()) {
            clearGreybodyComputation();
          }
          let payload;
          try {
            payload = collectGreybodyConfig();
          } catch (runError) {
            setGreybodyError(runError.message || String(runError));
            return;
          }
          setGlobalTask("greybody");
          runRadiationTask("greybody", payload, {
            setError: setGreybodyError,
            setStatus: setGreybodyStatus,
            setProgress: setGreybodyProgress,
            setResult: setGreybodyResult
          });
        };
        const onRunHawking = () => {
          setHawkingError("");
          if (isCurrentMetricSingleCase()) {
            clearHawkingComputation();
          }
          let payload;
          try {
            payload = collectHawkingConfig();
          } catch (runError) {
            setHawkingError(runError.message || String(runError));
            return;
          }
          setGlobalTask("hawking");
          runRadiationTask("hawking", payload, {
            setError: setHawkingError,
            setStatus: setHawkingStatus,
            setProgress: setHawkingProgress,
            setResult: setHawkingResult
          });
        };
      const exportScan = () => {
        if (!displayedQnmResult || !lastRunConfig || !hasScanRange(lastRunConfig.parameterSpecs)) return;
        const headers = [...displayedQnmResult.parameterNames, "n", `Re omega (WKB ${displayedQnmResult.mainOrder})`, `Im omega (WKB ${displayedQnmResult.mainOrder})`];
        const rows = flatRows.map((row) => [...displayedQnmResult.parameterNames.map((name) => row.caseData.params[name]), row.overtone.n, row.overtone.main.re, row.overtone.main.im]);
        const body = `\ufeff${[headers, ...rows].map((line) => line.map(csvEscape).join(",")).join("\r\n")}`;
        const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `qnm_scan_${new Date().toISOString().replace(/[:]/g, "-").replace(/\..+$/, "")}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      };
const exportGreybody = () => {
  if (!displayedGreybodyResult) return;
  const headers = [...(displayedGreybodyResult.parameterNames || []), "ell", "omega", "T_l(omega)"];
  const rows = displayedGreybodyResult.greybody.curves.flatMap((curve) =>
    displayedGreybodyResult.greybody.x.map((omega, index) => [
      ...(displayedGreybodyResult.parameterNames || []).map((name) => curve.params[name]),
      curve.ell,
      omega,
      curve.values[index]
          ])
        );
        const body = `\ufeff${[headers, ...rows].map((line) => line.map(csvEscape).join(",")).join("\r\n")}`;
        const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `greybody_${new Date().toISOString().replace(/[:]/g, "-").replace(/\..+$/, "")}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      };
      const exportHawking = () => {
        if (!hawkingResult) return;
        const headers = ["omega", "total", ...hawkingResult.spectrum.partials.map((item) => `ell=${item.ell}`)];
        const rows = hawkingResult.spectrum.x.map((omega, index) => [
          omega,
          hawkingResult.spectrum.total[index],
          ...hawkingResult.spectrum.partials.map((item) => item.values[index])
        ]);
        const body = `\ufeff${[headers, ...rows].map((line) => line.map(csvEscape).join(",")).join("\r\n")}`;
        const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `hawking_${new Date().toISOString().replace(/[:]/g, "-").replace(/\..+$/, "")}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      };
      const isSingleScan = !!scanChartData;
      const metricTab = <div className="metric-section section-card sidebar-panel"><div className="section-scroll"><div className="section-head"><div><h3>Metric Definition</h3></div></div><div className="metric-block"><label className="field"><span className="field-label">Preset</span><select value={config.presetKey} onChange={(event) => onPreset(event.target.value)}>{Object.entries(presets).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label><label className="toggle-inline metric-toggle-top"><input type="checkbox" checked={config.sameMetric} onChange={(event) => updateConfig({ sameMetric: event.target.checked, presetKey: "custom" })} /><span>Use f(r) for g(r)</span></label><div className="formula-grid-react"><MetricInputCard title="f(r)" description="Time component and horizon function." disabled={false} preview={metric.fPreview} onOpenEditor={() => openFormulaEditor("fExpression")} editorDisabled={false} /><MetricInputCard title="g(r)" description="Radial component of the metric." disabled={config.sameMetric} preview={metric.gPreview} onOpenEditor={() => openFormulaEditor("gExpression")} editorDisabled={config.sameMetric} /></div></div></div></div>;
      const parametersTab = <div className="section-card sidebar-panel"><div className="section-scroll"><div className="section-head"><div><h3>Parameters</h3></div></div>{metric.error ? <div className="empty-state">Fix the metric expressions to detect parameters.</div> : metric.names.length ? <div className="parameter-editor-grid">{metric.names.map((name) => { const spec = parameterSpecs[name] || defaultSpec; const range = spec.mode === "range"; return <div key={name} className="parameter-row-react"><div className="parameter-row-react-head"><div className="parameter-name">{name}</div><select value={spec.mode} onChange={(event) => setParameterSpecs((current) => ({ ...current, [name]: { ...spec, mode: event.target.value } }))}><option value="value">Fixed value</option><option value="range">Range</option></select></div><div className={`parameter-controls-grid${range ? "" : " compact"}`}>{!range && <label className="field"><span className="field-label">Value</span><input type="text" value={spec.value || ""} onChange={(event) => setParameterSpecs((current) => ({ ...current, [name]: { ...spec, value: event.target.value } }))} /></label>}{range && <><label className="field"><span className="field-label">Start</span><input type="text" value={spec.start || ""} onChange={(event) => setParameterSpecs((current) => ({ ...current, [name]: { ...spec, start: event.target.value } }))} /></label><label className="field"><span className="field-label">End</span><input type="text" value={spec.end || ""} onChange={(event) => setParameterSpecs((current) => ({ ...current, [name]: { ...spec, end: event.target.value } }))} /></label><label className="field"><span className="field-label">Points</span><input type="number" min="2" step="1" value={spec.count || 5} onChange={(event) => setParameterSpecs((current) => ({ ...current, [name]: { ...spec, count: Number(event.target.value) } }))} /></label></>}</div></div>; })}</div> : <div className="empty-state">No parameters other than r were detected.</div>}</div></div>;
      const wkbSettingsTab = <div className="section-card sidebar-panel"><div className="section-scroll"><div className="section-head"><div><h3>WKB Settings</h3></div></div><div className="field-group"><label className="field"><span className="field-label">Perturbation</span><select value={config.perturbationType} onChange={(event) => updateConfig({ perturbationType: event.target.value, presetKey: "custom" })}><option value="scalar">Scalar field</option><option value="electromagnetic">Electromagnetic field</option></select></label><label className="field"><span className="field-label">ell</span><input type="number" min={config.perturbationType === "electromagnetic" ? 1 : 0} step="1" value={config.ell} onChange={(event) => updateConfig({ ell: event.target.value, presetKey: "custom" })} /></label><label className="field"><span className="field-label">Max overtone N</span><input type="number" min="0" step="1" value={config.overtoneMax} onChange={(event) => updateConfig({ overtoneMax: event.target.value, presetKey: "custom" })} /></label></div><div className="field-group"><label className="field"><span className="field-label">Main WKB order</span><input type="number" min="1" max="16" step="1" value={config.mainOrder} onChange={(event) => updateConfig({ mainOrder: event.target.value, presetKey: "custom" })} /></label><label className="field checkbox-field checkbox-card"><input type="checkbox" checked={config.showAllOrders} onChange={(event) => updateConfig({ showAllOrders: event.target.checked, presetKey: "custom" })} /><span>Show all orders up to the selected one</span></label></div></div></div>;
      const numericsTab = <div className="numeric-section section-card sidebar-panel"><div className="section-scroll"><div className="section-head"><div><h3>Numerics</h3></div></div><div className="field-group three-columns"><label className="field"><span className="field-label">Decimal precision</span><input type="number" min="40" step="1" value={config.precision} onChange={(event) => updateConfig({ precision: event.target.value, presetKey: "custom" })} /></label><label className="field"><span className="field-label">Chebyshev nodes</span><input type="number" min="32" max="160" step="2" value={config.spectralNodes} onChange={(event) => updateConfig({ spectralNodes: event.target.value, presetKey: "custom" })} /></label><label className="field"><span className="field-label">Plot samples</span><input type="number" min="101" max="1201" step="20" value={config.plotSamples} onChange={(event) => updateConfig({ plotSamples: event.target.value, presetKey: "custom" })} /></label></div><div className="field-group three-columns"><label className="field"><span className="field-label">Search r_min</span><input type="text" value={config.rMin} onChange={(event) => updateConfig({ rMin: event.target.value, presetKey: "custom" })} /></label><label className="field"><span className="field-label">Search r_max</span><input type="text" value={config.rMax} onChange={(event) => updateConfig({ rMax: event.target.value, presetKey: "custom" })} /></label><label className="field"><span className="field-label">Horizon scan points</span><input type="number" min="160" step="40" value={config.horizonSamples} onChange={(event) => updateConfig({ horizonSamples: event.target.value, presetKey: "custom" })} /></label></div><div className="field-group"><label className="field"><span className="field-label">Peak scan points</span><input type="number" min="400" step="100" value={config.peakSamples} onChange={(event) => updateConfig({ peakSamples: event.target.value, presetKey: "custom" })} /></label></div><div className="field-group"><label className="field checkbox-field checkbox-card"><input type="checkbox" checked={!!config.parallelRadiation} onChange={(event) => updateConfig({ parallelRadiation: event.target.checked, presetKey: "custom" })} /><span>Enable parallel workers for Greybody and Hawking</span></label><label className="field"><span className="field-label">Radiation workers</span><input type="number" min="1" max="16" step="1" disabled={!config.parallelRadiation} value={config.parallelRadiationWorkers} onChange={(event) => updateConfig({ parallelRadiationWorkers: event.target.value, presetKey: "custom" })} /></label></div></div></div>;
const radiationView = <div className="workspace-view workspace-radiation-view"><div className="tab-bar"><button type="button" className={`tab-button${radiationTab === "greybody" ? " active" : ""}`} onClick={() => setRadiationTab("greybody")}>Greybody</button><button type="button" className={`tab-button${radiationTab === "hawking" ? " active" : ""}`} onClick={() => setRadiationTab("hawking")}>Hawking Radiation</button></div><div className="tab-panel"><div className="tab-panel-inner">{radiationTab === "greybody" && <div className="radiation-pane"><div className="card-head card-head-split"><div><h3>Greybody factors</h3></div><div className="card-head-tools"><button type="button" className="ghost-button compact-button" disabled={!displayedGreybodyResult} onClick={exportGreybody}>Export Greybody CSV</button><button type="button" className="primary-button" onClick={onRunGreybody}>Compute Greybody</button></div></div><div className="radiation-controls-grid"><label className="field"><span className="field-label">omega min</span><input type="text" value={radiationConfig.omegaMin} onChange={(event) => setRadiationConfig((current) => ({ ...current, omegaMin: event.target.value }))} /></label><label className="field"><span className="field-label">omega max</span><input type="text" value={radiationConfig.omegaMax} onChange={(event) => setRadiationConfig((current) => ({ ...current, omegaMax: event.target.value }))} /></label><label className="field"><span className="field-label">Frequency points</span><input type="number" min="25" step="2" value={radiationConfig.omegaPoints} onChange={(event) => setRadiationConfig((current) => ({ ...current, omegaPoints: event.target.value }))} /></label><label className="field"><span className="field-label">ell min</span><input type="number" min={config.perturbationType === "electromagnetic" ? 1 : 0} step="1" value={radiationConfig.greybodyEllMin != null ? radiationConfig.greybodyEllMin : radiationConfig.greybodyEll} onChange={(event) => setRadiationConfig((current) => ({ ...current, greybodyEllMin: event.target.value }))} /></label><label className="field"><span className="field-label">ell max</span><input type="number" min={config.perturbationType === "electromagnetic" ? 1 : 0} step="1" value={radiationConfig.greybodyEllMax != null ? radiationConfig.greybodyEllMax : radiationConfig.greybodyEll} onChange={(event) => setRadiationConfig((current) => ({ ...current, greybodyEllMax: event.target.value }))} /></label><div className="summary-card radiation-order-card"><span>Main WKB order</span><strong>{config.mainOrder}</strong></div></div>{greybodyError && <div className="warning-box">{greybodyError}</div>}{!displayedGreybodyResult ? <div className="empty-panel">Run the greybody solver to generate transmission profiles for fixed ell or ell ranges.</div> : <div className="section-card radiation-chart-card full-width-card"><div className="section-head"><div><h3>Greybody profile</h3></div></div><div className="chart-area-fixed"><GreybodyChart data={radiationGreybodyData} /></div></div>}</div>}{radiationTab === "hawking" && <div className="radiation-pane"><div className="card-head card-head-split"><div><h3>Hawking radiation</h3></div><div className="card-head-tools"><button type="button" className="ghost-button compact-button" disabled={!hawkingResult} onClick={exportHawking}>Export Hawking CSV</button><button type="button" className="primary-button" onClick={onRunHawking}>Compute Hawking Radiation</button></div></div><div className="radiation-controls-grid"><label className="field"><span className="field-label">omega min</span><input type="text" value={radiationConfig.omegaMin} onChange={(event) => setRadiationConfig((current) => ({ ...current, omegaMin: event.target.value }))} /></label><label className="field"><span className="field-label">omega max</span><input type="text" value={radiationConfig.omegaMax} onChange={(event) => setRadiationConfig((current) => ({ ...current, omegaMax: event.target.value }))} /></label><label className="field"><span className="field-label">Frequency points</span><input type="number" min="25" step="2" value={radiationConfig.omegaPoints} onChange={(event) => setRadiationConfig((current) => ({ ...current, omegaPoints: event.target.value }))} /></label><label className="field"><span className="field-label">ell cutoff</span><input type="number" min={config.perturbationType === "electromagnetic" ? 1 : 0} step="1" value={radiationConfig.ellCutoff} onChange={(event) => setRadiationConfig((current) => ({ ...current, ellCutoff: event.target.value }))} /></label><div className="summary-card radiation-order-card"><span>Main WKB order</span><strong>{config.mainOrder}</strong></div></div>{hawkingError && <div className="warning-box">{hawkingError}</div>}{!hawkingResult ? <div className="empty-panel">Run the Hawking solver to build the summed radiation spectrum.</div> : <div className="section-card radiation-chart-card full-width-card"><div className="section-head"><div><h3>Hawking spectrum</h3></div></div><div className="chart-area-fixed"><HawkingSpectrumChart data={radiationSpectrumData} /></div></div>}</div>}</div></div></div>;
      const diagnosticsView = <div className="workspace-view workspace-diagnostics-view"><div className="tab-panel diagnostics-panel"><div className="tab-panel-inner"><div className="diagnostic-stack">{!!allDiagnosticsWarnings.length && <WarningStack warnings={allDiagnosticsWarnings} />}{!!diagnosticsEntries.length && <div className="diagnostic-grid">{diagnosticsEntries.map((item) => <div key={`${item.label}-${item.value}`} className="summary-card"><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>}{!result && !analysisResult && !greybodyResult && !hawkingResult && <div className="empty-panel">Diagnostics will appear after a successful computation.</div>}</div></div></div></div>;
      return <div className="react-shell">
        <header className="topbar">
          <div className="topbar-title"><div className="topbar-title-row"><h1>WKBpackage</h1><button type="button" className="title-icon-button" title="Open references and credits" onClick={() => { setWindowPositions((current) => ({ ...current, references: defaultWindowPositions().references })); setReferencesOpen(true); }}>i</button></div></div>
          <div className="topbar-actions">
              <div className="status-cluster">
                <div className="status-line">{globalStatusDisplay.status}</div>
                <div className="progress-wrap compact-progress">
                  <div className="progress-track"><div className="progress-bar" style={{ width: `${globalStatusDisplay.progressValue}%` }} /></div>
                  <div className="progress-text">{globalStatusDisplay.progressValue}%</div>
                </div>
              </div>
          </div>
        </header>
        <div className="workspace-grid">
          <section className="sidebar-column">
            <div className="sidebar-tab-bar">
              <button type="button" className={`tab-button${sidebarTab === "metric-definition" ? " active" : ""}`} onClick={() => setSidebarTab("metric-definition")}>Metric Definition</button>
              <button type="button" className={`tab-button${sidebarTab === "parameters" ? " active" : ""}`} onClick={() => setSidebarTab("parameters")}>Parameters</button>
              <button type="button" className={`tab-button${sidebarTab === "wkb-settings" ? " active" : ""}`} onClick={() => setSidebarTab("wkb-settings")}>WKB Settings</button>
              <button type="button" className={`tab-button${sidebarTab === "numerics" ? " active" : ""}`} onClick={() => setSidebarTab("numerics")}>Numerics</button>
            </div>
            {sidebarTab === "metric-definition" ? metricTab : sidebarTab === "parameters" ? parametersTab : sidebarTab === "wkb-settings" ? wkbSettingsTab : numericsTab}
          </section>
          <section className="main-column">
            <div className="results-layout">
              <div className="card workspace-card">
                <div className="workspace-primary-tabs">
                  <button type="button" className={`tab-button${workspaceTab === "table" ? " active" : ""}`} onClick={() => setWorkspaceTab("table")}>QNMs</button>
                  <button type="button" className={`tab-button${workspaceTab === "analysis" ? " active" : ""}`} onClick={() => setWorkspaceTab("analysis")}>Mics</button>
                  <button type="button" className={`tab-button${workspaceTab === "radiation" ? " active" : ""}`} onClick={() => setWorkspaceTab("radiation")}>Radiation & Greybody</button>
                  <button type="button" className={`tab-button${workspaceTab === "diagnostics" ? " active" : ""}`} onClick={() => setWorkspaceTab("diagnostics")}>Diagnostics</button>
                </div>
                <div className="workspace-panel">
                  {workspaceTab === "table" && <div className="workspace-view workspace-table-view">
                    <div className="card-head card-head-split">
                      <div><h3>QNMs</h3><p>Click a row to inspect one overtone and open its WKB/Pade values.</p></div>
                      <div className="card-head-tools"><button type="button" className="primary-button" onClick={onRun}>Compute QNMs</button>{displayedQnmResult && lastRunConfig && hasScanRange(lastRunConfig.parameterSpecs) && displayedQnmResult.cases.length > 1 && <button type="button" className="ghost-button compact-button" onClick={exportScan}>Export scan CSV</button>}</div>
                      </div>
                      <div className="workspace-table-body">{error && <div className="warning-box">{error}</div>}{!displayedQnmResult ? <div className="empty-panel">No QNM computation has been run yet.</div> : <div className="table-wrap result-table-scroll"><table><thead><tr>{displayedQnmResult.parameterNames.map((name) => <th key={name}>{name}</th>)}<th>n</th><th>{`omega (WKB ${displayedQnmResult.mainOrder})`}</th><th>Pade</th></tr></thead><tbody>{flatRows.map((row, index) => { const pade = pickPade(row.overtone.pade); const toggle = () => { setSelectedRowIndex(selectedRowIndex === index ? null : index); setDrawerTab("orders"); }; return <tr key={`${row.caseIndex}-${row.overtone.n}`} className={`${selectedRowIndex === index ? "selected-row" : ""} ${index > 0 && flatRows[index - 1].caseIndex !== row.caseIndex ? "group-divider" : ""}`.trim()}>{displayedQnmResult.parameterNames.map((name) => <td key={name}>{compactNumber(row.caseData.params[name])}</td>)}<td><button type="button" className="table-row-button" onClick={toggle}>{row.overtone.n}</button></td><td><button type="button" className="table-row-button" title={formatComplexInline(row.overtone.main)} onClick={toggle}>{formatComplexInline(row.overtone.main)}</button></td><td title={pade ? `${pade.label}: ${formatComplexInline(pade.value)}` : "No Pade value"}>{pade ? formatComplexInline(pade.value) : "--"}</td></tr>; })}</tbody></table></div>}</div>
                  </div>}
                  {workspaceTab === "analysis" && <div className="workspace-view workspace-analysis-view">
                    <div className="tab-bar">
                      <button type="button" className={`tab-button${activeTab === "potential" ? " active" : ""}`} onClick={() => setActiveTab("potential")}>Potential</button>
                      <button type="button" className={`tab-button${activeTab === "solution" ? " active" : ""}`} onClick={() => setActiveTab("solution")}>Metric Functions</button>
                      {isSingleScan && <button type="button" className={`tab-button${activeTab === "modes" ? " active" : ""}`} onClick={() => setActiveTab("modes")}>Mode Curves</button>}
                    </div>
                    <div className="tabs-toolbar">
                      <div className="toolbar-cluster"><button type="button" className="primary-button" onClick={onRunAnalysis}>Compute Potential and Solution</button>{isSingleScan && activeTab === "modes" && <><button type="button" className={`ghost-button compact-button${modeSource === "wkb" ? " is-active" : ""}`} onClick={() => setModeSource("wkb")}>WKB</button><button type="button" className={`ghost-button compact-button${modeSource === "pade" ? " is-active" : ""}`} onClick={() => setModeSource("pade")}>Pade</button></>}</div>
                    </div>
                    {analysisError && <div className="warning-box">{analysisError}</div>}
                    <div className="tab-panel"><div className="tab-panel-inner">{activeTab === "potential" && (!analysisPlotData ? <div className="empty-panel action-empty-panel"><div>Potential profiles will appear after analysis.</div><button type="button" className="primary-button" onClick={onRunAnalysis}>Compute Potential and Solution</button></div> : <PotentialChart plot={analysisPlotData} />)}{activeTab === "solution" && (!analysisPlotData ? <div className="empty-panel action-empty-panel"><div>Run analysis to generate the metric-function graph.</div><button type="button" className="primary-button" onClick={onRunAnalysis}>Compute Potential and Solution</button></div> : <MetricChart plot={analysisPlotData} />)}{activeTab === "modes" && isSingleScan && <ScanChart data={scanChartData} />}</div></div>
                  </div>}
                  {workspaceTab === "radiation" && radiationView}
                  {workspaceTab === "diagnostics" && diagnosticsView}
                </div>
              </div>
            </div>
          </section>
        </div>
        <div className="drawer-layer">{selectedRow && <div className="drawer-backdrop" onClick={() => setSelectedRowIndex(null)} /> }<div className={`mode-drawer${selectedRow ? "" : " closed"}`} style={windowPositions.mode}>{selectedRow && <><div className="mode-drawer-head window-drag-handle" onMouseDown={(event) => beginWindowDrag("mode", event)}><div><h3>{`Mode n = ${selectedRow.overtone.n}`}</h3><p>{formatComplexInline(selectedRow.overtone.main)}</p></div><div className="window-actions"><button type="button" className="ghost-button compact-button" onClick={(event) => { event.stopPropagation(); setSelectedRowIndex(null); }}>Close</button></div></div><div className="drawer-tab-bar"><button type="button" className={`tab-button${drawerTab === "orders" ? " active" : ""}`} onClick={() => setDrawerTab("orders")}>Orders</button><button type="button" className={`tab-button${drawerTab === "pade" ? " active" : ""}`} onClick={() => setDrawerTab("pade")}>Pade</button><button type="button" className={`tab-button${drawerTab === "plot" ? " active" : ""}`} onClick={() => setDrawerTab("plot")}>Plot</button></div><div className="drawer-body"><div className="drawer-scroll">{drawerTab === "orders" && <div className="table-wrap"><table><thead><tr><th>Method</th><th>omega</th><th>Relative drift</th></tr></thead><tbody>{selectedRow.caseData.orders.map((order) => <tr key={order}><td>{`WKB ${order}`}</td><td>{formatComplexInline(selectedRow.overtone.orders[order])}</td><td>{formatRelative(selectedRow.overtone.orderAccuracy[order])}</td></tr>)}</tbody></table></div>}{drawerTab === "pade" && (!(selectedRow.overtone.pade && selectedRow.overtone.pade.length) ? <div className="empty-panel">No Pade values are available for this mode.</div> : <div className="table-wrap"><table><thead><tr><th>Method</th><th>omega</th><th>Relative drift</th></tr></thead><tbody>{selectedRow.overtone.pade.map((item) => <tr key={item.label}><td>{item.label}</td><td>{formatComplexInline(item.value)}</td><td>{formatRelative(item.relativeToMain)}</td></tr>)}</tbody></table></div>)}{drawerTab === "plot" && (orderChartData ? <OrderChart data={orderChartData} /> : <div className="empty-panel">Could not build the WKB-order plot.</div>)}</div></div></>}</div></div>
        <FormulaEditorModal open={formulaEditor.open} fieldLabel={formulaEditor.field === "gExpression" ? "g(r)" : "f(r)"} draft={formulaEditor.draft} preview={formulaEditorPreview} inputRef={editorInputRef} onDraftChange={(value) => setFormulaEditor((current) => ({ ...current, draft: value }))} onOpenHelp={() => { setWindowPositions((current) => ({ ...current, help: defaultWindowPositions().help })); setHelpOpen(true); }} onApply={applyFormulaEditor} onClose={closeFormulaEditor} windowStyle={windowPositions.editor} onMouseDownHeader={(event) => beginWindowDrag("editor", event)} />
        {helpOpen && <div className="help-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}><div className="help-modal-card" style={windowPositions.help} onClick={(event) => event.stopPropagation()}><div className="mode-drawer-head window-drag-handle" onMouseDown={(event) => beginWindowDrag("help", event)}><div><h3>Formula Help</h3><p>Supported analytic functions, constants, and LaTeX fragments for the metric editor.</p></div><div className="window-actions"><button type="button" className="ghost-button compact-button" onClick={(event) => { event.stopPropagation(); setHelpOpen(false); }}>Close</button></div></div><div className="help-grid-scroll"><div className="help-grid">{helpItems.map((item) => <div key={item[0]} className="help-item"><code>{item[0]}</code><div>{item[1]}</div></div>)}</div><div className="help-subsection"><h4>LaTeX paste examples</h4><div className="latex-example-list static">{latexExamples.map((example) => <div key={example} className="help-item latex-example-card"><code>{example}</code></div>)}</div></div></div></div></div>}
        {referencesOpen && <div className="help-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setReferencesOpen(false); }}><div className="help-modal-card references-modal-card" style={windowPositions.references} onClick={(event) => event.stopPropagation()}><div className="mode-drawer-head window-drag-handle" onMouseDown={(event) => beginWindowDrag("references", event)}><div><h3>References</h3></div><div className="window-actions"><button type="button" className="ghost-button compact-button" onClick={(event) => { event.stopPropagation(); setReferencesOpen(false); }}>Close</button></div></div><div className="help-grid-scroll"><div className="reference-credits">{referenceCredits.map((item) => <p key={item}>{item}</p>)}</div><div className="reference-list modal-reference-list">{referenceItems.map((item) => <a key={item.href} className="reference-item" href={item.href} target="_blank" rel="noreferrer"><strong>{item.title}</strong><span>{item.meta}</span></a>)}</div></div></div></div>}
      </div>;
    }

    if (!window.React || !window.ReactDOM) throw new Error("React runtime is not loaded.");
    if (!Core || !Core.Parser || !Core.Chart) throw new Error("One of the core browser modules did not load.");
    if (!mountNode) throw new Error("Root element #root was not found.");
    ReactDOM.createRoot(mountNode).render(<AppRoot />);
  } catch (error) {
    showFatal(error && error.message ? error.message : String(error));
  }
})();
