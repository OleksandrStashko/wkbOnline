(function () {
  const mountNode = document.getElementById("root");
  const showFatal = message => {
    if (!mountNode) return;
    mountNode.innerHTML = `<div class="react-fatal"><div class="react-fatal-card"><h2>Interface startup failed</h2><p>${String(message || "Unknown error")}</p></div></div>`;
  };
  try {
    const Core = window.QNMApp;
    const {
      useEffect,
      useMemo,
      useRef,
      useState
    } = React;
    const workerVersion = "20260406a";
    const defaultSpec = {
      mode: "value",
      value: "1",
      start: "0",
      end: "1",
      count: 5
    };
    const defaultRadiation = {
      omegaMin: "0.1",
      omegaMax: "1",
      omegaPoints: 121,
      greybodyEll: 2,
      greybodyEllMin: 2,
      greybodyEllMax: 2,
      ellCutoff: 6
    };
    const presets = {
      custom: {
        label: "Custom",
        values: {
          fExpression: "1 - 2*M/r",
          gExpression: "1 - 2*M/r",
          sameMetric: true,
          perturbationType: "scalar",
          ell: 2,
          overtoneMax: 2,
          mainOrder: 6,
          precision: 70,
          spectralNodes: 64,
          plotSamples: 401,
          rMin: "0.001",
          rMax: "30",
          horizonSamples: 480,
          peakSamples: 900,
          parallelRadiation: false,
          parallelRadiationWorkers: 4,
          parameterSpecs: {
            M: {
              ...defaultSpec
            }
          }
        }
      },
      schwarzschild: {
        label: "Schwarzschild",
        values: {
          fExpression: "1 - 2*M/r",
          gExpression: "1 - 2*M/r",
          sameMetric: true,
          perturbationType: "scalar",
          ell: 2,
          overtoneMax: 2,
          mainOrder: 6,
          precision: 70,
          spectralNodes: 64,
          plotSamples: 401,
          rMin: "0.001",
          rMax: "30",
          horizonSamples: 480,
          peakSamples: 900,
          parallelRadiation: false,
          parallelRadiationWorkers: 4,
          parameterSpecs: {
            M: {
              ...defaultSpec
            }
          }
        }
      },
      reissnerNordstrom: {
        label: "Reissner-Nordstrom",
        values: {
          fExpression: "1 - 2*M/r + Q^2/r^2",
          gExpression: "1 - 2*M/r + Q^2/r^2",
          sameMetric: true,
          perturbationType: "scalar",
          ell: 2,
          overtoneMax: 2,
          mainOrder: 6,
          precision: 76,
          spectralNodes: 72,
          plotSamples: 401,
          rMin: "0.001",
          rMax: "35",
          horizonSamples: 560,
          peakSamples: 980,
          parallelRadiation: false,
          parallelRadiationWorkers: 4,
          parameterSpecs: {
            M: {
              ...defaultSpec
            },
            Q: {
              mode: "value",
              value: "0.4",
              start: "0",
              end: "1",
              count: 5
            }
          }
        }
      }
    };
    const helpItems = [["sqrt(x)", "square root"], ["ln(x)", "natural logarithm"], ["log(x)", "same as ln(x)"], ["log(x, b)", "logarithm with base b"], ["exp(x)", "exponential e^x"], ["sin, cos, tan", "trigonometric functions"], ["asin, acos, atan", "inverse trigonometric functions"], ["sinh, cosh, tanh", "hyperbolic functions"], ["abs(x)", "absolute value"], ["min(a, b), max(a, b)", "minimum and maximum"], ["pow(x, y) or x^y", "power"], ["pi, e", "constants"]];
    const referenceItems = [{
      title: "Konoplya & Zhidenko review",
      href: "https://doi.org/10.1103/RevModPhys.83.793",
      meta: "Rev. Mod. Phys. 83, 793 (2011)"
    }, {
      title: "Padé summation of higher-order WKB terms",
      href: "https://doi.org/10.1103/PhysRevD.100.124006",
      meta: "Matyjasek & Telecka, Phys. Rev. D 100, 124006 (2019)"
    }, {
      title: "Higher-order WKB Mathematica code",
      href: "https://www.sciltp.com/journals/ijgtp/articles/2603003383",
      meta: "Konoplya, Matyjasek & Zhidenko (2026)"
    }];
    const referenceCredits = ["This web application is a web version of the Mathematica package WKB.m, written by Roman Konoplya and Aleksandr Zhidenko."];
    const latexExamples = ["1 - \\frac{2 M}{r}", "1 - \\frac{2 M}{r} + \\frac{Q^2}{r^2}", "\\left(1-\\frac{r_h}{r}\\right)"];
    const compactNumber = text => {
      const value = Number(text);
      if (!Number.isFinite(value)) return text;
      const magnitude = Math.max(Math.abs(value), 1e-12);
      if (magnitude >= 1e4 || magnitude < 1e-4) return value.toExponential(5);
      return value.toFixed(8).replace(/\.?0+$/, "");
    };
    const chartPalette = ["#0e6670", "#c08b2c", "#a33f2f", "#297a4d", "#6a4fb3", "#9a5d16", "#1d5f9b", "#a34774"];
    const chartColor = index => chartPalette[index % chartPalette.length];
    const analysisCurveWindowThreshold = 8;
    const formatRelative = text => text === null || text === undefined || text === "" ? "--" : compactNumber(text);
    const formatComplexInline = value => {
      if (!value) return "--";
      const im = Number(value.im);
      const sign = Number.isFinite(im) ? im < 0 ? "-" : "+" : String(value.im).trim().startsWith("-") ? "-" : "+";
      const absIm = Number.isFinite(im) ? compactNumber(Math.abs(im)) : String(value.im).replace(/^\s*-/, "");
      return `${compactNumber(value.re)} ${sign} ${absIm} i`;
    };
    const uniqueWarnings = items => Array.from(new Set(items || []));
    const pushUnique = (items, value) => {
      if (!items.includes(value)) items.push(value);
    };
    const clampInt = (value, min) => !Number.isFinite(value) ? min : Math.max(min, Math.floor(value));
    const hasScanRange = specs => Object.values(specs || {}).some(spec => spec.mode === "range");
    const csvEscape = value => {
      const text = value === null || value === undefined ? "" : String(value);
      return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
    };
    const estimateCaseCount = config => Object.values(config.parameterSpecs || {}).reduce((total, spec) => total * (spec.mode === "range" ? Math.max(2, Number(spec.count || 2)) : 1), 1);
    const disposeWorker = worker => {
      if (!worker) return;
      worker.terminate();
      if (worker.__blobUrl) URL.revokeObjectURL(worker.__blobUrl);
    };
    const disposeWorkerCollection = workers => {
      (workers || []).forEach(disposeWorker);
    };
    const createWorker = () => {
      const scriptUrl = new URL(`app/worker/worker.js?v=${workerVersion}`, window.location.href).href;
      if (window.location.protocol !== "file:") return new Worker(scriptUrl);
      const baseUrl = new URL("app/worker/", window.location.href).href;
      const bootstrap = `self.QNMAppWorkerBase=${JSON.stringify(baseUrl)};importScripts(${JSON.stringify(scriptUrl)});`;
      const blobUrl = URL.createObjectURL(new Blob([bootstrap], {
        type: "text/javascript"
      }));
      const worker = new Worker(blobUrl);
      worker.__blobUrl = blobUrl;
      return worker;
    };
    const precedence = node => node.kind === "binary" ? node.op === "+" || node.op === "-" ? 1 : node.op === "*" || node.op === "/" ? 2 : node.op === "^" ? 3 : 5 : node.kind === "unary" ? 4 : 5;
    const wrapMath = (html, needed) => needed ? `<span class="math-group">(${html})</span>` : html;
    function renderMathNode(node, parent, right) {
      if (node.kind === "number") return node.value;
      if (node.kind === "identifier") return node.name;
      if (node.kind === "call") return `<span class="math-fn">${node.name}</span><span class="math-group">(${node.args.map(arg => renderMathNode(arg, 0, false)).join(", ")})</span>`;
      if (node.kind === "unary") return wrapMath(`${node.op}${renderMathNode(node.arg, 4, false)}`, precedence(node) < parent);
      if (node.kind !== "binary") return "";
      const own = precedence(node);
      const left = renderMathNode(node.left, node.op === "^" ? own : own + (node.op === "/" ? 1 : 0), false);
      const rightNode = renderMathNode(node.right, node.op === "^" ? own : own + (node.op === "-" || node.op === "/" ? 1 : 0), true);
      const body = node.op === "/" ? `<span class="math-frac"><span class="math-frac-top">${left}</span><span class="math-frac-bottom">${rightNode}</span></span>` : node.op === "^" ? `<span class="math-power">${left}<sup>${rightNode}</sup></span>` : node.op === "*" ? `${left} <span>&middot;</span> ${rightNode}` : `${left} <span>${node.op}</span> ${rightNode}`;
      return wrapMath(body, own < parent || right && node.op === "^" && own <= parent);
    }
    const analyzeExpression = text => {
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
    const FormulaPreview = ({
      preview
    }) => /*#__PURE__*/React.createElement("div", {
      className: "formula-preview-stack"
    }, /*#__PURE__*/React.createElement("div", {
      className: `formula-preview-box${preview.invalid ? " invalid" : ""}`,
      dangerouslySetInnerHTML: {
        __html: preview.html
      }
    }), preview.normalizedChanged && !preview.invalid && /*#__PURE__*/React.createElement("div", {
      className: "formula-normalized-note"
    }, /*#__PURE__*/React.createElement("span", null, "Interpreted as"), /*#__PURE__*/React.createElement("code", null, preview.normalized)));
    const WarningStack = ({
      warnings
    }) => !warnings || !warnings.length ? null : /*#__PURE__*/React.createElement("div", {
      className: "react-warning-stack"
    }, warnings.map((warning, index) => /*#__PURE__*/React.createElement("div", {
      key: `${warning}-${index}`,
      className: "warning-item"
    }, warning)));
    const PotentialChart = ({
      plot
    }) => /*#__PURE__*/React.createElement("div", {
      ref: chartMount(node => Core.Chart.renderPotentialChart(node, plot), [plot]),
      className: "potential-plot-wrap"
    });
    const MetricChart = ({
      plot
    }) => /*#__PURE__*/React.createElement("div", {
      ref: chartMount(node => Core.Chart.renderMetricFunctionsChart(node, plot), [plot]),
      className: "potential-plot-wrap"
    });
    const ScanChart = ({
      data
    }) => /*#__PURE__*/React.createElement("div", {
      ref: chartMount(node => Core.Chart.renderModeScanChart(node, data), [data]),
      className: "scan-plot-wrap"
    });
    const OrderChart = ({
      data
    }) => /*#__PURE__*/React.createElement("div", {
      ref: chartMount(node => Core.Chart.renderOrderTrendChart(node, data), [data]),
      className: "mode-plot-wrap"
    });
    const GreybodyChart = ({
      data
    }) => /*#__PURE__*/React.createElement("div", {
      ref: chartMount(node => Core.Chart.renderGreybodyChart(node, data), [data]),
      className: "scan-plot-wrap"
    });
    const GreybodyOrderSweepChart = ({
      data
    }) => /*#__PURE__*/React.createElement("div", {
      ref: chartMount(node => Core.Chart.renderGreybodyOrderSweepChart(node, data), [data]),
      className: "scan-plot-wrap"
    });
    const GreybodyOrderDifferenceChart = ({
      data
    }) => /*#__PURE__*/React.createElement("div", {
      ref: chartMount(node => Core.Chart.renderGreybodyOrderDifferenceChart(node, data), [data]),
      className: "scan-plot-wrap"
    });
    const HawkingSpectrumChart = ({
      data
    }) => /*#__PURE__*/React.createElement("div", {
      ref: chartMount(node => Core.Chart.renderHawkingSpectrumChart(node, data), [data]),
      className: "scan-plot-wrap"
    });
    const pickPade = items => !items || !items.length ? null : items.slice().sort((a, b) => {
      const da = Number(a.relativeToMain);
      const db = Number(b.relativeToMain);
      const ga = Math.abs(a.numeratorDegree - a.denominatorDegree);
      const gb = Math.abs(b.numeratorDegree - b.denominatorDegree);
      if (Number.isFinite(da) && Number.isFinite(db) && da !== db) return da - db;
      if (ga !== gb) return ga - gb;
      return b.numeratorDegree + b.denominatorDegree - (a.numeratorDegree + a.denominatorDegree);
    })[0];
    const windowFrameConfig = {
      mode: {
        width: 760,
        height: 780,
        top: 84
      },
      editor: {
        width: 1040,
        height: 820,
        top: 56
      },
      analysisCurveManager: {
        width: 430,
        height: 720,
        top: 88
      },
      greybodyCompare: {
        width: 980,
        height: 760,
        top: 52
      },
      help: {
        width: 720,
        height: 720,
        top: 72
      },
      references: {
        width: 760,
        height: 760,
        top: 72
      }
    };
    const getViewportSize = () => {
      if (typeof window === "undefined") {
        return {
          width: 1400,
          height: 920
        };
      }
      return {
        width: window.innerWidth,
        height: window.innerHeight
      };
    };
    const clampWindowPosition = (key, position) => {
      const frame = windowFrameConfig[key] || windowFrameConfig.mode;
      const viewport = getViewportSize();
      const width = Math.min(frame.width, viewport.width - 24);
      const height = Math.min(frame.height, viewport.height - 24);
      return {
        left: Math.min(Math.max(12, position.left), Math.max(12, viewport.width - width - 12)),
        top: Math.min(Math.max(12, position.top), Math.max(12, viewport.height - height - 12))
      };
    };
    const centeredWindowPosition = key => {
      const frame = windowFrameConfig[key] || windowFrameConfig.mode;
      const viewport = getViewportSize();
      return clampWindowPosition(key, {
        left: (viewport.width - Math.min(frame.width, viewport.width - 24)) / 2,
        top: frame.top
      });
    };
    const MetricInputCard = ({
      title,
      description,
      disabled,
      preview,
      onOpenEditor,
      editorDisabled,
      primary = false
    }) => /*#__PURE__*/React.createElement("div", {
      className: `editor-card${disabled ? " mirrored-editor" : ""}${primary ? " editor-card-primary" : ""}`
    }, /*#__PURE__*/React.createElement("div", {
      className: "editor-card-head"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, title), description && /*#__PURE__*/React.createElement("p", null, description)), /*#__PURE__*/React.createElement("div", {
      className: "editor-card-tools"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "ghost-button compact-button",
      disabled: editorDisabled,
      onClick: onOpenEditor
    }, primary ? "Edit Formula" : "Equation Editor"))), /*#__PURE__*/React.createElement("div", {
      className: "preview-label"
    }, "Preview"), /*#__PURE__*/React.createElement(FormulaPreview, {
      preview: preview
    }));
    const DerivedMetricCard = ({
      preview,
      onUnlock
    }) => /*#__PURE__*/React.createElement("div", {
      className: "derived-metric-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "derived-metric-head"
    }, /*#__PURE__*/React.createElement("div", {
      className: "derived-metric-copy"
    }, /*#__PURE__*/React.createElement("h4", null, "g(r)"), /*#__PURE__*/React.createElement("span", {
      className: "editor-inline-note"
    }, "Mirroring f(r) until you unlock a separate expression.")), /*#__PURE__*/React.createElement("div", {
      className: "derived-metric-actions"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "ghost-button compact-button",
      onClick: onUnlock
    }, "Unlock g(r)"))), /*#__PURE__*/React.createElement("div", {
      className: "derived-metric-preview"
    }, /*#__PURE__*/React.createElement(FormulaPreview, {
      preview: preview
    })));
    const FormulaEditorModal = ({
      open,
      fieldLabel,
      draft,
      preview,
      inputRef,
      onDraftChange,
      onOpenHelp,
      onApply,
      onClose,
      windowStyle,
      onMouseDownHeader
    }) => !open ? null : /*#__PURE__*/React.createElement("div", {
      className: "formula-editor-backdrop",
      onClick: event => {
        if (event.target === event.currentTarget) onClose();
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "formula-editor-card",
      style: windowStyle,
      onClick: event => event.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "mode-drawer-head window-drag-handle",
      onMouseDown: onMouseDownHeader
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, "Equation Editor")), /*#__PURE__*/React.createElement("div", {
      className: "window-actions"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "ghost-button compact-button",
      onClick: event => {
        event.stopPropagation();
        onOpenHelp();
      }
    }, "Help"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "ghost-button compact-button",
      onClick: event => {
        event.stopPropagation();
        onClose();
      }
    }, "Close"))), /*#__PURE__*/React.createElement("div", {
      className: "formula-editor-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "formula-editor-pane"
    }, /*#__PURE__*/React.createElement("div", {
      className: "formula-editor-section"
    }, /*#__PURE__*/React.createElement("div", {
      className: "formula-editor-section-head"
    }, /*#__PURE__*/React.createElement("h4", null, "Formula")), /*#__PURE__*/React.createElement("textarea", {
      ref: inputRef,
      className: "formula-input formula-editor-textarea",
      rows: "9",
      spellCheck: "false",
      value: draft,
      onChange: event => onDraftChange(event.target.value)
    }))), /*#__PURE__*/React.createElement("div", {
      className: "formula-editor-pane"
    }, /*#__PURE__*/React.createElement("div", {
      className: "formula-editor-section"
    }, /*#__PURE__*/React.createElement("div", {
      className: "formula-editor-section-head"
    }, /*#__PURE__*/React.createElement("h4", null, "Rendered preview")), /*#__PURE__*/React.createElement(FormulaPreview, {
      preview: preview
    })))), /*#__PURE__*/React.createElement("div", {
      className: "formula-editor-footer"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "ghost-button",
      onClick: onClose
    }, "Cancel"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "primary-button",
      disabled: preview.invalid,
      onClick: onApply
    }, "Insert Formula"))));
    function AppRoot() {
      const initial = presets.schwarzschild.values;
      const maxAvailableWkbOrder = Core.WKBData && Core.WKBData.maxOrder || 16;
      const [config, setConfig] = useState({
        presetKey: "schwarzschild",
        ...initial
      });
      const [parameterSpecs, setParameterSpecs] = useState(initial.parameterSpecs);
      const [status, setStatus] = useState(window.location.protocol === "file:" ? "Opened from a local file; the worker will use the compatibility bootstrap." : "Idle");
      const [progress, setProgress] = useState({
        completed: 0,
        total: 1
      });
      const [error, setError] = useState("");
      const [result, setResult] = useState(null);
      const [analysisStatus, setAnalysisStatus] = useState("Idle");
      const [analysisProgress, setAnalysisProgress] = useState({
        completed: 0,
        total: 1
      });
      const [analysisError, setAnalysisError] = useState("");
      const [analysisResult, setAnalysisResult] = useState(null);
      const [lastRunConfig, setLastRunConfig] = useState(null);
      const [radiationConfig, setRadiationConfig] = useState(defaultRadiation);
      const [greybodyStatus, setGreybodyStatus] = useState("Idle");
      const [greybodyProgress, setGreybodyProgress] = useState({
        completed: 0,
        total: 1
      });
      const [greybodyError, setGreybodyError] = useState("");
      const [greybodyResult, setGreybodyResult] = useState(null);
      const [greybodyCompareOpen, setGreybodyCompareOpen] = useState(false);
      const [greybodyCompareStatus, setGreybodyCompareStatus] = useState("Idle");
      const [greybodyCompareProgress, setGreybodyCompareProgress] = useState({
        completed: 0,
        total: 1
      });
      const [greybodyCompareError, setGreybodyCompareError] = useState("");
      const [greybodyCompareResult, setGreybodyCompareResult] = useState(null);
      const [greybodyCompareSettings, setGreybodyCompareSettings] = useState({
        ell: defaultRadiation.greybodyEll,
        orderMin: Math.max(1, Number(initial.mainOrder) - 2),
        orderMax: Number(initial.mainOrder)
      });
      const [hawkingStatus, setHawkingStatus] = useState("Idle");
      const [hawkingProgress, setHawkingProgress] = useState({
        completed: 0,
        total: 1
      });
      const [hawkingError, setHawkingError] = useState("");
      const [hawkingResult, setHawkingResult] = useState(null);
      const [globalTask, setGlobalTask] = useState(null);
      const [selectedRowIndex, setSelectedRowIndex] = useState(null);
      const [workspaceTab, setWorkspaceTab] = useState("table");
      const [activeTab, setActiveTab] = useState("potential");
      const [radiationTab, setRadiationTab] = useState("greybody");
      const [drawerTab, setDrawerTab] = useState("orders");
      const [modeSource, setModeSource] = useState("wkb");
      const [analysisCurveManagerOpen, setAnalysisCurveManagerOpen] = useState(false);
      const [analysisCurveSelection, setAnalysisCurveSelection] = useState([]);
      const [analysisCurveSliderPosition, setAnalysisCurveSliderPosition] = useState(0);
      const [helpOpen, setHelpOpen] = useState(false);
      const [referencesOpen, setReferencesOpen] = useState(false);
      const [sidebarTab, setSidebarTab] = useState("metric-definition");
      const [formulaEditor, setFormulaEditor] = useState({
        open: false,
        field: "fExpression",
        draft: ""
      });
      const workerRef = useRef(null);
      const analysisWorkerRef = useRef(null);
      const radiationWorkerRef = useRef(null);
      const greybodyCompareWorkerRef = useRef(null);
      const radiationPoolRef = useRef([]);
      const editorInputRef = useRef(null);
      const pendingCaretRef = useRef(null);
      const dragRef = useRef(null);
      const defaultWindowPositions = () => {
        return {
          mode: centeredWindowPosition("mode"),
          editor: centeredWindowPosition("editor"),
          analysisCurveManager: centeredWindowPosition("analysisCurveManager"),
          greybodyCompare: centeredWindowPosition("greybodyCompare"),
          help: centeredWindowPosition("help"),
          references: centeredWindowPosition("references")
        };
      };
      const [windowPositions, setWindowPositions] = useState(defaultWindowPositions);
      const metric = useMemo(() => {
        const fPreview = analyzeExpression(config.fExpression);
        const gText = config.sameMetric ? config.fExpression : config.gExpression;
        const gPreview = analyzeExpression(gText);
        const names = !fPreview.error && !gPreview.error ? Core.Parser.collectParameters([fPreview.ast, gPreview.ast]) : [];
        return {
          fPreview,
          gPreview,
          error: fPreview.error || gPreview.error || null,
          names
        };
      }, [config.fExpression, config.gExpression, config.sameMetric]);
      const singleMetricCaseActive = useMemo(() => !hasScanRange(parameterSpecs), [parameterSpecs]);
      const displayedQnmResult = singleMetricCaseActive && error ? null : result;
      const displayedAnalysisResult = singleMetricCaseActive && analysisError ? null : analysisResult;
      const displayedGreybodyRunResult = singleMetricCaseActive && greybodyError ? null : greybodyResult;
      const displayedHawkingResult = singleMetricCaseActive && hawkingError ? null : hawkingResult;
      const formulaEditorPreview = useMemo(() => analyzeExpression(formulaEditor.draft), [formulaEditor.draft]);
      useEffect(() => {
        setParameterSpecs(prev => Object.fromEntries(metric.names.map(name => [name, {
          ...defaultSpec,
          ...(prev[name] || {})
        }])));
      }, [metric.names.join("|")]);
      useEffect(() => {
        const ellFloor = config.perturbationType === "electromagnetic" ? 1 : 0;
        setRadiationConfig(current => ({
          ...current,
          greybodyEllMin: Math.max(ellFloor, clampInt(Number(current.greybodyEllMin != null ? current.greybodyEllMin : current.greybodyEll), ellFloor)),
          greybodyEllMax: Math.max(Math.max(ellFloor, clampInt(Number(current.greybodyEllMin != null ? current.greybodyEllMin : current.greybodyEll), ellFloor)), clampInt(Number(current.greybodyEllMax != null ? current.greybodyEllMax : current.greybodyEll), ellFloor)),
          ellCutoff: Math.max(ellFloor, clampInt(Number(current.ellCutoff), ellFloor))
        }));
      }, [config.perturbationType]);
      useEffect(() => () => {
        disposeWorker(workerRef.current);
        disposeWorker(analysisWorkerRef.current);
        disposeWorker(radiationWorkerRef.current);
        disposeWorker(greybodyCompareWorkerRef.current);
        disposeWorkerCollection(radiationPoolRef.current);
      }, []);
      useEffect(() => {
        const ellFloor = config.perturbationType === "electromagnetic" ? 1 : 0;
        setGreybodyCompareSettings(current => {
          const orderMin = Math.max(1, Math.min(maxAvailableWkbOrder, clampInt(Number(current.orderMin), 1)));
          const orderMax = Math.max(orderMin, Math.min(maxAvailableWkbOrder, clampInt(Number(current.orderMax), orderMin)));
          return {
            ...current,
            ell: Math.max(ellFloor, clampInt(Number(current.ell), ellFloor)),
            orderMin,
            orderMax
          };
        });
      }, [config.perturbationType, maxAvailableWkbOrder]);
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
          setFormulaEditor({
            open: false,
            field: "fExpression",
            draft: ""
          });
        }
      }, [config.sameMetric, formulaEditor.open, formulaEditor.field]);
      useEffect(() => {
        const onMove = event => {
          const drag = dragRef.current;
          if (!drag) return;
          setWindowPositions(current => ({
            ...current,
            [drag.key]: clampWindowPosition(drag.key, {
              left: event.clientX - drag.offsetX,
              top: event.clientY - drag.offsetY
            })
          }));
        };
        const onUp = () => {
          dragRef.current = null;
        };
        const onResize = () => {
          setWindowPositions(current => Object.fromEntries(Object.entries(current).map(([key, position]) => [key, clampWindowPosition(key, position)])));
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        window.addEventListener("resize", onResize);
        return () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          window.removeEventListener("resize", onResize);
        };
      }, []);
      const flatRows = useMemo(() => !displayedQnmResult ? [] : displayedQnmResult.cases.flatMap((caseData, caseIndex) => caseData.overtones.map((overtone, overtoneIndex) => ({
        caseData,
        caseIndex,
        overtone,
        overtoneIndex
      }))), [displayedQnmResult]);
      const selectedRow = selectedRowIndex === null ? null : flatRows[selectedRowIndex] || null;
      const baseCase = displayedAnalysisResult && displayedAnalysisResult.cases && displayedAnalysisResult.cases.length ? displayedAnalysisResult.cases[0] : null;
      const varying = !displayedQnmResult ? [] : displayedQnmResult.parameterNames.filter(name => displayedQnmResult.cases.some(item => item.params[name] !== displayedQnmResult.cases[0].params[name]));
      const scanChartData = useMemo(() => {
        if (!displayedQnmResult || displayedQnmResult.cases.length < 2 || varying.length !== 1) return null;
        const parameterName = varying[0];
        const rows = displayedQnmResult.cases.map(caseData => ({
          x: Number(caseData.params[parameterName]),
          caseData
        })).filter(item => Number.isFinite(item.x)).sort((a, b) => a.x - b.x);
        if (rows.length < 2) return null;
        const overtones = Array.from(new Set(rows[0].caseData.overtones.map(item => item.n))).sort((a, b) => a - b);
        const branches = overtones.map(n => {
          const values = rows.map(item => {
            const mode = item.caseData.overtones.find(entry => entry.n === n);
            return !mode ? null : modeSource === "pade" ? (pickPade(mode.pade) || {}).value || null : mode.main;
          });
          if (values.some(value => !value)) return null;
          const re = values.map(value => Number(value.re));
          const im = values.map(value => Number(value.im));
          return re.every(Number.isFinite) && im.every(Number.isFinite) ? {
            n,
            re,
            im
          } : null;
        }).filter(Boolean);
        return branches.length ? {
          parameterName,
          x: rows.map(item => item.x),
          branches,
          sourceLabel: modeSource === "pade" ? "Pade" : `WKB ${displayedQnmResult.mainOrder}`
        } : null;
      }, [displayedQnmResult, varying.join("|"), modeSource]);
      const orderChartData = useMemo(() => !selectedRow ? null : {
        overtone: selectedRow.overtone.n,
        orders: selectedRow.caseData.orders.map(Number),
        re: selectedRow.caseData.orders.map(order => Number(selectedRow.overtone.orders[order].re)),
        im: selectedRow.caseData.orders.map(order => Number(selectedRow.overtone.orders[order].im))
      }, [selectedRow]);
      const analysisCases = useMemo(() => !displayedAnalysisResult ? [] : displayedAnalysisResult.cases.map((caseData, caseIndex) => ({
        caseIndex,
        label: Object.entries(caseData.params || {}).map(([name, value]) => `${name}=${compactNumber(value)}`).join(", ") || "default parameters",
        params: caseData.params || {},
        plot: caseData.plot
      })), [displayedAnalysisResult]);
      const analysisParameterNames = useMemo(() => !analysisCases.length ? [] : Array.from(new Set(analysisCases.flatMap(item => Object.keys(item.params || {})))), [analysisCases]);
      const analysisVaryingParameters = useMemo(() => !analysisCases.length ? [] : analysisParameterNames.filter(name => analysisCases.some(item => item.params[name] !== analysisCases[0].params[name])), [analysisCases, analysisParameterNames.join("|")]);
      const analysisCurveControlAvailable = analysisCases.length > 1;
      const analysisCurveManagerNeeded = analysisCases.length > analysisCurveWindowThreshold;
      const analysisSliderData = useMemo(() => {
        if (!analysisCases.length || analysisVaryingParameters.length !== 1) return null;
        const parameterName = analysisVaryingParameters[0];
        const entries = analysisCases.map(item => ({
          caseIndex: item.caseIndex,
          label: item.label,
          value: Number(item.params[parameterName])
        })).filter(item => Number.isFinite(item.value)).sort((a, b) => a.value - b.value);
        return entries.length > 1 ? {
          parameterName,
          entries
        } : null;
      }, [analysisCases, analysisVaryingParameters.join("|")]);
      const analysisSliderEntry = useMemo(() => !analysisSliderData || !analysisSliderData.entries.length ? null : analysisSliderData.entries[Math.max(0, Math.min(analysisCurveSliderPosition, analysisSliderData.entries.length - 1))], [analysisSliderData, analysisCurveSliderPosition]);
      const analysisSliderCaseIndex = analysisSliderEntry ? analysisSliderEntry.caseIndex : null;
      const analysisCurveEntries = useMemo(() => {
        if (!analysisCases.length) return [];
        if (!analysisSliderData) return analysisCases;
        const order = new Map(analysisSliderData.entries.map((item, index) => [item.caseIndex, index]));
        return analysisCases.slice().sort((a, b) => (order.get(a.caseIndex) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.caseIndex) ?? Number.MAX_SAFE_INTEGER));
      }, [analysisCases, analysisSliderData]);
      const visibleAnalysisCaseIndices = useMemo(() => {
        if (!analysisCases.length) return [];
        const visible = new Set(analysisCurveSelection.filter(index => analysisCases.some(item => item.caseIndex === index)));
        if (analysisSliderCaseIndex !== null && analysisSliderCaseIndex !== undefined) {
          visible.add(analysisSliderCaseIndex);
        }
        if (!visible.size) {
          if (analysisCurveManagerNeeded) {
            visible.add(analysisCases[0].caseIndex);
          } else {
            analysisCases.forEach(item => visible.add(item.caseIndex));
          }
        }
        return Array.from(visible).sort((a, b) => a - b);
      }, [analysisCases, analysisCurveManagerNeeded, analysisCurveSelection, analysisSliderCaseIndex]);
      const visibleAnalysisCaseSet = useMemo(() => new Set(visibleAnalysisCaseIndices), [visibleAnalysisCaseIndices]);
      const pinnedAnalysisCaseSet = useMemo(() => new Set(analysisCurveSelection), [analysisCurveSelection]);
      const visibleAnalysisCases = useMemo(() => analysisCases.filter(item => visibleAnalysisCaseSet.has(item.caseIndex)), [analysisCases, visibleAnalysisCaseSet]);
      const analysisPlotData = useMemo(() => !displayedAnalysisResult ? null : {
        sameMetric: config.sameMetric,
        showLegend: !analysisCurveManagerNeeded,
        cases: visibleAnalysisCases.map(caseData => ({
          label: caseData.label,
          plot: caseData.plot
        }))
      }, [displayedAnalysisResult, config.sameMetric, analysisCurveManagerNeeded, visibleAnalysisCases]);
      useEffect(() => {
        if (!analysisSliderData || !analysisSliderData.entries.length) {
          setAnalysisCurveSliderPosition(0);
          return;
        }
        setAnalysisCurveSliderPosition(current => Math.max(0, Math.min(current, analysisSliderData.entries.length - 1)));
      }, [analysisSliderData]);
      useEffect(() => {
        if (!displayedAnalysisResult || !analysisCases.length) {
          setAnalysisCurveSelection([]);
          setAnalysisCurveSliderPosition(0);
          setAnalysisCurveManagerOpen(false);
          return;
        }
        if (analysisCurveManagerNeeded) {
          setAnalysisCurveSelection(analysisSliderData && analysisSliderData.entries.length ? [] : [analysisCases[0].caseIndex]);
          setAnalysisCurveSliderPosition(0);
          setAnalysisCurveManagerOpen(true);
          return;
        }
        setAnalysisCurveSelection(analysisCases.map(item => item.caseIndex));
      }, [displayedAnalysisResult]);
      const displayedGreybodyResult = useMemo(() => {
        if (displayedGreybodyRunResult) {
          return {
            ...displayedGreybodyRunResult,
            derivedFromHawking: false
          };
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
      const greybodyOrderSweepData = useMemo(() => !greybodyCompareResult ? null : greybodyCompareResult.orderComparison, [greybodyCompareResult]);
      const greybodyOrderDifferenceData = useMemo(() => !greybodyCompareResult ? null : greybodyCompareResult.orderDifferences, [greybodyCompareResult]);
      const greybodyCompareWarnings = useMemo(() => uniqueWarnings(greybodyCompareResult ? greybodyCompareResult.warnings : []), [greybodyCompareResult]);
      const greybodyCompareProgressValue = useMemo(() => greybodyCompareProgress && greybodyCompareProgress.total > 0 ? Math.round(greybodyCompareProgress.completed / greybodyCompareProgress.total * 100) : 0, [greybodyCompareProgress]);
      const qnmWarnings = uniqueWarnings((displayedQnmResult ? displayedQnmResult.warnings || [] : []).concat(displayedQnmResult ? displayedQnmResult.cases.flatMap(item => item.warnings) : []));
      const analysisWarnings = uniqueWarnings((displayedAnalysisResult ? displayedAnalysisResult.warnings || [] : []).concat(displayedAnalysisResult ? displayedAnalysisResult.cases.flatMap(item => item.warnings || []) : []));
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
          entries.push({
            label,
            value: text
          });
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
          qnm: {
            status,
            progress
          },
          analysis: {
            status: analysisStatus,
            progress: analysisProgress
          },
          greybody: {
            status: greybodyStatus,
            progress: greybodyProgress
          },
          greybodyCompare: {
            status: greybodyCompareStatus,
            progress: greybodyCompareProgress
          },
          hawking: {
            status: hawkingStatus,
            progress: hawkingProgress
          }
        };
        const selected = globalTask && map[globalTask] ? map[globalTask] : map.qnm;
        const progressValue = selected.progress && selected.progress.total > 0 ? Math.round(selected.progress.completed / selected.progress.total * 100) : 0;
        return {
          status: selected.status,
          progressValue
        };
      }, [globalTask, status, progress, analysisStatus, analysisProgress, greybodyStatus, greybodyProgress, greybodyCompareStatus, greybodyCompareProgress, hawkingStatus, hawkingProgress]);
      useEffect(() => {
        if (!scanChartData && activeTab === "modes") {
          setActiveTab("potential");
        }
      }, [scanChartData, activeTab]);
      const updateConfig = patch => setConfig(current => {
        const next = {
          ...current,
          ...patch
        };
        next.ell = clampInt(Number(next.ell), next.perturbationType === "electromagnetic" ? 1 : 0);
        next.overtoneMax = clampInt(Number(next.overtoneMax), 0);
        if (next.sameMetric) next.gExpression = next.fExpression;
        return next;
      });
      const updateMetricField = (field, value) => {
        if (field === "gExpression") {
          updateConfig({
            gExpression: value,
            presetKey: "custom"
          });
          return;
        }
        updateConfig({
          fExpression: value,
          presetKey: "custom"
        });
      };
      const openFormulaEditor = field => {
        if (field === "gExpression" && config.sameMetric) return;
        const draft = field === "gExpression" ? config.gExpression : config.fExpression;
        pendingCaretRef.current = null;
        setWindowPositions(current => ({
          ...current,
          editor: defaultWindowPositions().editor
        }));
        setFormulaEditor({
          open: true,
          field,
          draft
        });
      };
      const closeFormulaEditor = () => {
        pendingCaretRef.current = null;
        setFormulaEditor({
          open: false,
          field: "fExpression",
          draft: ""
        });
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
      const collectGreybodyOrderComparisonConfig = () => {
        const runConfig = collectConfig();
        if (hasScanRange(parameterSpecs)) {
          throw new Error("Greybody order comparison currently requires fixed parameter values. Set every metric parameter to a single value.");
        }
        const ellFloor = config.perturbationType === "electromagnetic" ? 1 : 0;
        const ellValue = Number(greybodyCompareSettings.ell);
        const orderMinValue = Number(greybodyCompareSettings.orderMin);
        const orderMaxValue = Number(greybodyCompareSettings.orderMax);
        if (!Number.isFinite(ellValue)) {
          throw new Error("Enter a finite ell value for the order comparison.");
        }
        if (!Number.isFinite(orderMinValue) || !Number.isFinite(orderMaxValue)) {
          throw new Error("Enter finite integer bounds for the WKB-order comparison.");
        }
        const ell = Math.max(ellFloor, Math.floor(ellValue));
        const orderMin = Math.max(1, Math.min(maxAvailableWkbOrder, Math.floor(orderMinValue)));
        const orderMax = Math.max(1, Math.min(maxAvailableWkbOrder, Math.floor(orderMaxValue)));
        if (orderMax < orderMin) {
          throw new Error("The upper WKB order must be greater than or equal to the lower order.");
        }
        return {
          runConfig,
          radiation: {
            omegaMin: String(radiationConfig.omegaMin).trim(),
            omegaMax: String(radiationConfig.omegaMax).trim(),
            omegaPoints: clampInt(Number(radiationConfig.omegaPoints), 25),
            greybodyEll: ell,
            greybodyEllMin: ell,
            greybodyEllMax: ell,
            ellCutoff: clampInt(Number(radiationConfig.ellCutoff), ellFloor)
          },
          comparison: {
            ell,
            orderMin,
            orderMax
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
      const clearGreybodyOrderComparison = () => {
        setGreybodyCompareResult(null);
      };
      const clearHawkingComputation = () => {
        setHawkingResult(null);
      };
      const openAnalysisCurveManager = () => {
        setWindowPositions(current => ({
          ...current,
          analysisCurveManager: defaultWindowPositions().analysisCurveManager
        }));
        setAnalysisCurveManagerOpen(true);
      };
      const closeAnalysisCurveManager = () => {
        setAnalysisCurveManagerOpen(false);
      };
      const toggleAnalysisCurveSelection = caseIndex => {
        setAnalysisCurveSelection(current => current.includes(caseIndex) ? current.filter(item => item !== caseIndex) : current.concat(caseIndex).sort((a, b) => a - b));
      };
      const openGreybodyCompareWindow = () => {
        const ellFloor = config.perturbationType === "electromagnetic" ? 1 : 0;
        const defaultEll = Math.max(ellFloor, clampInt(Number(radiationConfig.greybodyEllMin != null ? radiationConfig.greybodyEllMin : radiationConfig.greybodyEll), ellFloor));
        const suggestedMax = Math.max(1, Math.min(maxAvailableWkbOrder, clampInt(Number(config.mainOrder), 1)));
        setGreybodyCompareSettings(current => {
          const nextOrderMax = Math.max(1, Math.min(maxAvailableWkbOrder, clampInt(Number(current.orderMax), suggestedMax)));
          const nextOrderMin = Math.max(1, Math.min(nextOrderMax, clampInt(Number(current.orderMin), Math.max(1, nextOrderMax - 2))));
          return {
            ell: defaultEll,
            orderMin: nextOrderMin,
            orderMax: nextOrderMax
          };
        });
        setWindowPositions(current => ({
          ...current,
          greybodyCompare: defaultWindowPositions().greybodyCompare
        }));
        setGreybodyCompareOpen(true);
      };
      const closeGreybodyCompareWindow = () => {
        setGreybodyCompareOpen(false);
      };
      const onPreset = key => {
        const values = presets[key].values;
        setConfig({
          presetKey: key,
          ...values
        });
        setParameterSpecs(values.parameterSpecs);
      };
      const parallelWorkerCount = () => Math.max(1, clampInt(Number(config.parallelRadiationWorkers), 1));
      const parallelWorkersEnabled = () => !!config.parallelRadiation && parallelWorkerCount() > 1;
      const formatTaskParams = params => Object.entries(params || {}).map(([name, value]) => `${name}=${value}`).join(", ") || "default parameters";
      const buildSerializableParameterGrid = runConfig => {
        const parsed = Core.Solver.parseExpressions(runConfig);
        const ctx = Core.Numerics.createContext(Math.max(40, Number(runConfig.precision)));
        const grid = Core.Solver.buildParameterGrid(parsed.parameterNames, runConfig.parameterSpecs || {}, ctx).map(params => Object.fromEntries(Object.entries(params).map(([name, value]) => [name, value.toString()])));
        return {
          parameterNames: parsed.parameterNames,
          grid
        };
      };
      const buildFixedParameterSpecs = params => Object.fromEntries(Object.entries(params).map(([name, value]) => [name, {
        ...defaultSpec,
        mode: "value",
        value: String(value)
      }]));
      const buildFixedConfig = (runConfig, params, overrides = {}) => ({
        ...runConfig,
        ...overrides,
        parameterSpecs: buildFixedParameterSpecs(params)
      });
      const runSingleQnmComputation = (runConfig, initialStatus) => {
        disposeWorkerCollection(radiationPoolRef.current);
        radiationPoolRef.current = [];
        disposeWorker(workerRef.current);
        workerRef.current = null;
        setGlobalTask("qnm");
        setStatus(initialStatus || "Starting the worker and preparing the computation");
        setProgress({
          completed: 0,
          total: 1
        });
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
        worker.addEventListener("message", event => {
          const message = event.data;
          if (message.type === "ready") {
            ready = true;
            window.clearTimeout(startupTimer);
            setStatus("Worker is running, computation in progress");
            return;
          }
          if (message.type === "progress") {
            setStatus(`Processed ${message.completed} of ${message.total}`);
            setProgress({
              completed: message.completed,
              total: message.total
            });
            return;
          }
          if (message.type === "done") {
            window.clearTimeout(startupTimer);
            setStatus("Computation finished");
            setProgress({
              completed: 1,
              total: 1
            });
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
        worker.postMessage({
          type: "run",
          config: {
            ...runConfig,
            precisionCheck: false,
            storePlots: estimateCaseCount(runConfig) === 1
          }
        });
      };
      const runParallelQnmComputation = runConfig => {
        disposeWorker(workerRef.current);
        workerRef.current = null;
        disposeWorkerCollection(radiationPoolRef.current);
        radiationPoolRef.current = [];
        setGlobalTask("qnm");
        setStatus("Preparing parallel QNM computation");
        setProgress({
          completed: 0,
          total: 1
        });
        let plan;
        try {
          plan = buildSerializableParameterGrid(runConfig);
        } catch (_error) {
          runSingleQnmComputation(runConfig);
          return;
        }
        if (plan.grid.length <= 1) {
          runSingleQnmComputation(runConfig);
          return;
        }
        const queue = plan.grid.map((params, caseIndex) => ({
          caseIndex,
          params
        }));
        const workerCount = Math.min(parallelWorkerCount(), queue.length);
        const pool = [];
        const warnings = [];
        const cases = Array(queue.length).fill(null);
        let finished = false;
        let active = 0;
        let completed = 0;
        let readyWorkers = 0;
        radiationPoolRef.current = pool;
        const finalizeIfDone = () => {
          if (finished || active > 0 || queue.length > 0) {
            return;
          }
          finished = true;
          const validCases = cases.filter(Boolean);
          if (!validCases.length) {
            setStatus("Computation failed");
            setError(uniqueWarnings(warnings)[0] || "No valid parameter points were computed.");
          } else {
            setStatus("Computation finished");
            setProgress({
              completed: 1,
              total: 1
            });
            setResult({
              parameterNames: plan.parameterNames,
              mainOrder: runConfig.mainOrder,
              warnings: uniqueWarnings(warnings),
              cases: validCases
            });
            setSelectedRowIndex(null);
            setDrawerTab("orders");
            setModeSource("wkb");
          }
          disposeWorkerCollection(radiationPoolRef.current);
          radiationPoolRef.current = [];
        };
        const failParallel = () => {
          if (finished) return;
          finished = true;
          disposeWorkerCollection(radiationPoolRef.current);
          radiationPoolRef.current = [];
          runSingleQnmComputation(runConfig, "Parallel QNM computation failed, retrying in single-worker mode");
        };
        const dispatchNext = worker => {
          const next = queue.shift();
          if (!next) {
            finalizeIfDone();
            return;
          }
          active += 1;
          worker.postMessage({
            type: "detail",
            config: {
              ...runConfig,
              precisionCheck: false,
              storePlots: false
            },
            params: next.params,
            caseIndex: next.caseIndex
          });
        };
        const startupTimer = window.setTimeout(() => {
          if (!readyWorkers) {
            failParallel();
          }
        }, 3000);
        for (let index = 0; index < workerCount; index += 1) {
          let worker;
          try {
            worker = createWorker();
          } catch (_error) {
            window.clearTimeout(startupTimer);
            failParallel();
            return;
          }
          pool.push(worker);
          worker.addEventListener("error", () => {
            window.clearTimeout(startupTimer);
            failParallel();
          });
          worker.addEventListener("message", event => {
            const message = event.data;
            if (message.type === "ready") {
              readyWorkers += 1;
              if (readyWorkers) {
                window.clearTimeout(startupTimer);
              }
              dispatchNext(worker);
              return;
            }
            if (finished) {
              return;
            }
            if (message.type === "detailDone") {
              cases[message.caseIndex] = message.caseData;
              completed += 1;
              active -= 1;
              setStatus(`Processed ${completed} of ${cases.length} QNM parameter points in parallel`);
              setProgress({
                completed,
                total: cases.length
              });
              dispatchNext(worker);
              return;
            }
            if (message.type === "detailError") {
              pushUnique(warnings, `[${formatTaskParams(plan.grid[message.caseIndex] || {})}] ${message.message}`);
              completed += 1;
              active -= 1;
              setStatus(`Processed ${completed} of ${cases.length} QNM parameter points in parallel`);
              setProgress({
                completed,
                total: cases.length
              });
              dispatchNext(worker);
            }
          });
        }
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
        setLastRunConfig(runConfig);
        if (parallelWorkersEnabled() && estimateCaseCount(runConfig) > 1) {
          runParallelQnmComputation(runConfig);
          return;
        }
        runSingleQnmComputation(runConfig);
      };
      const onRun = () => runQnmComputation();
      const runSingleAnalysis = (runConfig, initialStatus) => {
        disposeWorkerCollection(radiationPoolRef.current);
        radiationPoolRef.current = [];
        disposeWorker(analysisWorkerRef.current);
        analysisWorkerRef.current = null;
        setGlobalTask("analysis");
        setAnalysisStatus(initialStatus || "Starting the worker and preparing the analysis");
        setAnalysisProgress({
          completed: 0,
          total: 1
        });
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
        worker.addEventListener("message", event => {
          const message = event.data;
          if (message.type === "ready") {
            ready = true;
            window.clearTimeout(startupTimer);
            setAnalysisStatus("Worker is running, analysis in progress");
            return;
          }
          if (message.type === "analysisProgress") {
            setAnalysisStatus(`Processed ${message.completed} of ${message.total} analysis points`);
            setAnalysisProgress({
              completed: message.completed,
              total: message.total
            });
            return;
          }
          if (message.type === "analysisDone") {
            window.clearTimeout(startupTimer);
            setAnalysisStatus("Analysis finished");
            setAnalysisProgress({
              completed: 1,
              total: 1
            });
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
        worker.postMessage({
          type: "runAnalysis",
          config: {
            ...runConfig,
            precisionCheck: false,
            storePlots: true
          }
        });
      };
      const runParallelAnalysis = runConfig => {
        disposeWorker(analysisWorkerRef.current);
        analysisWorkerRef.current = null;
        disposeWorkerCollection(radiationPoolRef.current);
        radiationPoolRef.current = [];
        setGlobalTask("analysis");
        setAnalysisStatus("Preparing parallel analysis");
        setAnalysisProgress({
          completed: 0,
          total: 1
        });
        let plan;
        try {
          plan = buildSerializableParameterGrid(runConfig);
        } catch (_error) {
          runSingleAnalysis(runConfig);
          return;
        }
        if (plan.grid.length <= 1) {
          runSingleAnalysis(runConfig);
          return;
        }
        const queue = plan.grid.map((params, caseIndex) => ({
          caseIndex,
          params
        }));
        const workerCount = Math.min(parallelWorkerCount(), queue.length);
        const pool = [];
        const warnings = [];
        const cases = Array(queue.length).fill(null);
        let finished = false;
        let active = 0;
        let completed = 0;
        let readyWorkers = 0;
        radiationPoolRef.current = pool;
        const finalizeIfDone = () => {
          if (finished || active > 0 || queue.length > 0) {
            return;
          }
          finished = true;
          const validCases = cases.filter(Boolean);
          if (!validCases.length) {
            setAnalysisStatus("Analysis failed");
            setAnalysisError(uniqueWarnings(warnings)[0] || "No valid parameter point was available for analysis.");
          } else {
            setAnalysisStatus("Analysis finished");
            setAnalysisProgress({
              completed: 1,
              total: 1
            });
            setAnalysisResult({
              parameterNames: plan.parameterNames,
              warnings: uniqueWarnings(warnings),
              cases: validCases
            });
          }
          disposeWorkerCollection(radiationPoolRef.current);
          radiationPoolRef.current = [];
        };
        const failParallel = () => {
          if (finished) return;
          finished = true;
          disposeWorkerCollection(radiationPoolRef.current);
          radiationPoolRef.current = [];
          runSingleAnalysis(runConfig, "Parallel analysis failed, retrying in single-worker mode");
        };
        const dispatchNext = worker => {
          const next = queue.shift();
          if (!next) {
            finalizeIfDone();
            return;
          }
          active += 1;
          worker.__task = next;
          worker.postMessage({
            type: "runAnalysis",
            config: {
              ...buildFixedConfig(runConfig, next.params),
              precisionCheck: false,
              storePlots: true
            }
          });
        };
        const startupTimer = window.setTimeout(() => {
          if (!readyWorkers) {
            failParallel();
          }
        }, 3000);
        for (let index = 0; index < workerCount; index += 1) {
          let worker;
          try {
            worker = createWorker();
          } catch (_error) {
            window.clearTimeout(startupTimer);
            failParallel();
            return;
          }
          pool.push(worker);
          worker.addEventListener("error", () => {
            window.clearTimeout(startupTimer);
            failParallel();
          });
          worker.addEventListener("message", event => {
            const message = event.data;
            if (message.type === "ready") {
              readyWorkers += 1;
              if (readyWorkers) {
                window.clearTimeout(startupTimer);
              }
              dispatchNext(worker);
              return;
            }
            if (finished) {
              return;
            }
            if (message.type === "analysisDone") {
              const task = worker.__task;
              const caseData = message.result && message.result.cases && message.result.cases[0] ? message.result.cases[0] : null;
              if (caseData) {
                cases[task.caseIndex] = caseData;
              } else {
                pushUnique(warnings, `[${formatTaskParams(task.params)}] The analysis worker returned no plot data.`);
              }
              if (message.result && Array.isArray(message.result.warnings)) {
                message.result.warnings.forEach(warning => pushUnique(warnings, warning));
              }
              completed += 1;
              active -= 1;
              setAnalysisStatus(`Processed ${completed} of ${cases.length} analysis parameter points in parallel`);
              setAnalysisProgress({
                completed,
                total: cases.length
              });
              dispatchNext(worker);
              return;
            }
            if (message.type === "analysisError") {
              const task = worker.__task;
              pushUnique(warnings, `[${formatTaskParams(task ? task.params : {})}] ${message.message}`);
              completed += 1;
              active -= 1;
              setAnalysisStatus(`Processed ${completed} of ${cases.length} analysis parameter points in parallel`);
              setAnalysisProgress({
                completed,
                total: cases.length
              });
              dispatchNext(worker);
            }
          });
        }
      };
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
        if (parallelWorkersEnabled() && estimateCaseCount(runConfig) > 1) {
          runParallelAnalysis(runConfig);
          return;
        }
        runSingleAnalysis(runConfig);
      };
      const runSingleGreybodyOrderComparison = payload => {
        disposeWorkerCollection(radiationPoolRef.current);
        radiationPoolRef.current = [];
        disposeWorker(greybodyCompareWorkerRef.current);
        greybodyCompareWorkerRef.current = null;
        setGlobalTask("greybodyCompare");
        setGreybodyCompareStatus("Starting the worker in single-worker mode and preparing the greybody order comparison");
        setGreybodyCompareProgress({
          completed: 0,
          total: 1
        });
        let worker;
        try {
          worker = createWorker();
        } catch (_error) {
          setGreybodyCompareStatus("Worker startup failed");
          setGreybodyCompareError(window.location.protocol === "file:" ? "The worker did not start from file://. Serve the project locally with: python -m http.server 8000." : "Could not start the worker.");
          return;
        }
        greybodyCompareWorkerRef.current = worker;
        let ready = false;
        const startupTimer = window.setTimeout(() => {
          if (greybodyCompareWorkerRef.current && !ready) {
            setGreybodyCompareStatus("Worker did not start");
            setGreybodyCompareError(window.location.protocol === "file:" ? "The worker did not start from file://. Serve the project locally with: python -m http.server 8000." : "Could not start the worker.");
            disposeWorker(greybodyCompareWorkerRef.current);
            greybodyCompareWorkerRef.current = null;
          }
        }, 3000);
        worker.addEventListener("error", () => {
          window.clearTimeout(startupTimer);
          setGreybodyCompareStatus("Worker startup failed");
          setGreybodyCompareError(window.location.protocol === "file:" ? "The worker did not start from file://. Serve the project locally with: python -m http.server 8000." : "Could not start the worker.");
          disposeWorker(greybodyCompareWorkerRef.current);
          greybodyCompareWorkerRef.current = null;
        });
        worker.addEventListener("message", event => {
          const message = event.data;
          if (message.type === "ready") {
            ready = true;
            window.clearTimeout(startupTimer);
            setGreybodyCompareStatus("Worker is running, greybody order comparison in progress (single worker)");
            return;
          }
          if (message.type === "greybodyOrderComparisonProgress") {
            setGreybodyCompareStatus(`Processed ${message.completed} of ${message.total} greybody order-comparison points`);
            setGreybodyCompareProgress({
              completed: message.completed,
              total: message.total
            });
            return;
          }
          if (message.type === "greybodyOrderComparisonDone") {
            window.clearTimeout(startupTimer);
            setGreybodyCompareStatus("Greybody order comparison finished");
            setGreybodyCompareProgress({
              completed: 1,
              total: 1
            });
            setGreybodyCompareResult(message.result);
            disposeWorker(greybodyCompareWorkerRef.current);
            greybodyCompareWorkerRef.current = null;
            return;
          }
          if (message.type === "greybodyOrderComparisonError") {
            window.clearTimeout(startupTimer);
            setGreybodyCompareStatus("Greybody order comparison failed");
            setGreybodyCompareError(message.message);
            disposeWorker(greybodyCompareWorkerRef.current);
            greybodyCompareWorkerRef.current = null;
          }
        });
        worker.postMessage({
          type: "runGreybodyOrderComparison",
          config: {
            ...payload.runConfig,
            precisionCheck: false,
            storePlots: true
          },
          radiation: payload.radiation,
          comparison: payload.comparison
        });
      };
      const finalizeParallelGreybodyOrderComparison = (payload, states) => {
        const warnings = [];
        const ctx = Core.Numerics.createContext(Math.max(40, Number(payload.runConfig.precision)));
        const validStates = states.filter(item => {
          if (!item.result) {
            pushUnique(warnings, `[ell=${payload.comparison.ell}] WKB ${item.order} did not finish successfully and was skipped.`);
            return false;
          }
          (item.result.warnings || []).forEach(warning => pushUnique(warnings, warning));
          const curve = item.result.greybody && item.result.greybody.curves && item.result.greybody.curves[0];
          return !!(curve && curve.values && curve.values.some(value => value !== null && value !== undefined));
        });
        if (!validStates.length) {
          throw new Error(uniqueWarnings(warnings)[0] || "No valid greybody order curve was obtained for the requested comparison range.");
        }
        const curves = validStates.map(item => ({
          order: item.order,
          label: `WKB ${item.order}`,
          values: item.result.greybody.curves[0].values
        }));
        const referenceCurve = curves[curves.length - 1];
        if (referenceCurve.order !== payload.comparison.orderMax) {
          pushUnique(warnings, `[ell=${payload.comparison.ell}] The requested highest WKB order ${payload.comparison.orderMax} produced no physical points; differences are shown relative to the highest order with at least one physical point, ${referenceCurve.order}.`);
        }
        const differenceCurves = curves.filter(curve => curve.order !== referenceCurve.order).map(curve => ({
          order: curve.order,
          label: `WKB ${referenceCurve.order} - WKB ${curve.order}`,
          values: curve.values.map((value, index) => value === null || referenceCurve.values[index] === null ? null : new ctx.D(referenceCurve.values[index]).minus(new ctx.D(value)).toString())
        }));
        const firstResult = validStates[0].result;
        return {
          params: firstResult.params,
          parameterNames: firstResult.parameterNames,
          perturbationType: firstResult.perturbationType,
          ell: payload.comparison.ell,
          orderMin: payload.comparison.orderMin,
          orderMax: payload.comparison.orderMax,
          referenceOrder: referenceCurve.order,
          successfulOrders: curves.map(curve => curve.order),
          horizon: firstResult.horizon,
          surfaceGravity: firstResult.surfaceGravity,
          temperature: firstResult.temperature,
          warnings: uniqueWarnings(warnings),
          orderComparison: {
            x: firstResult.greybody.x,
            ell: payload.comparison.ell,
            referenceOrder: referenceCurve.order,
            curves
          },
          orderDifferences: {
            x: firstResult.greybody.x,
            ell: payload.comparison.ell,
            referenceOrder: referenceCurve.order,
            curves: differenceCurves
          },
          diagnostics: Object.assign({}, firstResult.diagnostics, {
            kind: "greybody-order-comparison",
            ell: payload.comparison.ell,
            referenceOrder: referenceCurve.order
          })
        };
      };
      const runParallelGreybodyOrderComparison = payload => {
        disposeWorker(greybodyCompareWorkerRef.current);
        greybodyCompareWorkerRef.current = null;
        disposeWorkerCollection(radiationPoolRef.current);
        radiationPoolRef.current = [];
        setGlobalTask("greybodyCompare");
        setGreybodyCompareStatus("Preparing parallel greybody order comparison");
        const tasks = [];
        for (let order = payload.comparison.orderMin; order <= payload.comparison.orderMax; order += 1) {
          tasks.push({
            order
          });
        }
        if (tasks.length <= 1) {
          runSingleGreybodyOrderComparison(payload);
          return;
        }
        setGreybodyCompareProgress({
          completed: 0,
          total: tasks.length
        });
        const workerCount = Math.min(parallelWorkerCount(), tasks.length);
        const queue = tasks.slice();
        const states = tasks.map(task => ({
          order: task.order,
          result: null
        }));
        const pool = [];
        let finished = false;
        let active = 0;
        let completed = 0;
        let readyWorkers = 0;
        radiationPoolRef.current = pool;
        const finalizeIfDone = () => {
          if (finished || active > 0 || queue.length > 0) {
            return;
          }
          finished = true;
          try {
            const aggregate = finalizeParallelGreybodyOrderComparison(payload, states);
            setGreybodyCompareStatus("Greybody order comparison finished");
            setGreybodyCompareProgress({
              completed: 1,
              total: 1
            });
            setGreybodyCompareResult(aggregate);
          } catch (aggregateError) {
            setGreybodyCompareStatus("Greybody order comparison failed");
            setGreybodyCompareError(aggregateError.message || String(aggregateError));
          }
          disposeWorkerCollection(radiationPoolRef.current);
          radiationPoolRef.current = [];
        };
        const failParallel = () => {
          if (finished) return;
          finished = true;
          disposeWorkerCollection(radiationPoolRef.current);
          radiationPoolRef.current = [];
          runSingleGreybodyOrderComparison(payload);
        };
        const dispatchNext = worker => {
          const next = queue.shift();
          if (!next) {
            finalizeIfDone();
            return;
          }
          active += 1;
          worker.__task = next;
          worker.postMessage({
            type: "runGreybody",
            config: {
              ...payload.runConfig,
              mainOrder: next.order,
              precisionCheck: false,
              storePlots: true
            },
            radiation: payload.radiation
          });
        };
        const startupTimer = window.setTimeout(() => {
          if (!readyWorkers) {
            failParallel();
          }
        }, 3000);
        for (let index = 0; index < workerCount; index += 1) {
          let worker;
          try {
            worker = createWorker();
          } catch (_error) {
            window.clearTimeout(startupTimer);
            failParallel();
            return;
          }
          pool.push(worker);
          worker.addEventListener("error", () => {
            window.clearTimeout(startupTimer);
            failParallel();
          });
          worker.addEventListener("message", event => {
            const message = event.data;
            if (message.type === "ready") {
              readyWorkers += 1;
              if (readyWorkers) {
                window.clearTimeout(startupTimer);
              }
              dispatchNext(worker);
              return;
            }
            if (finished) {
              return;
            }
            if (message.type === "greybodyDone") {
              const task = worker.__task;
              const state = states.find(item => item.order === task.order);
              if (state) {
                state.result = message.result;
              }
              completed += 1;
              active -= 1;
              setGreybodyCompareStatus(`Processed ${completed} of ${states.length} WKB orders in parallel`);
              setGreybodyCompareProgress({
                completed,
                total: states.length
              });
              dispatchNext(worker);
              return;
            }
            if (message.type === "greybodyError") {
              completed += 1;
              active -= 1;
              setGreybodyCompareStatus(`Processed ${completed} of ${states.length} WKB orders in parallel`);
              setGreybodyCompareProgress({
                completed,
                total: states.length
              });
              dispatchNext(worker);
            }
          });
        }
      };
      const runGreybodyOrderComparison = () => {
        setGreybodyCompareError("");
        if (isCurrentMetricSingleCase()) {
          clearGreybodyOrderComparison();
        }
        let payload;
        try {
          payload = collectGreybodyOrderComparisonConfig();
        } catch (runError) {
          setGreybodyCompareError(runError.message || String(runError));
          return;
        }
        if (parallelWorkersEnabled() && payload.comparison.orderMax > payload.comparison.orderMin) {
          runParallelGreybodyOrderComparison(payload);
          return;
        }
        runSingleGreybodyOrderComparison(payload);
      };
      const runSingleRadiationTask = (task, payload, setters, initialStatus) => {
        disposeWorkerCollection(radiationPoolRef.current);
        radiationPoolRef.current = [];
        setters.setError("");
        disposeWorker(radiationWorkerRef.current);
        setters.setStatus(initialStatus || `Starting the worker and preparing the ${task} computation`);
        setters.setProgress({
          completed: 0,
          total: 1
        });
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
        worker.addEventListener("message", event => {
          const message = event.data;
          if (message.type === "ready") {
            ready = true;
            window.clearTimeout(startupTimer);
            setters.setStatus(`Worker is running, ${task} computation in progress`);
            return;
          }
          if (message.type === `${task}Progress`) {
            setters.setStatus(`Processed ${message.completed} of ${message.total} ${task} points`);
            setters.setProgress({
              completed: message.completed,
              total: message.total
            });
            return;
          }
          if (message.type === `${task}Done`) {
            window.clearTimeout(startupTimer);
            setters.setStatus(`${task === "greybody" ? "Greybody" : "Hawking radiation"} computation finished`);
            setters.setProgress({
              completed: 1,
              total: 1
            });
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
          config: {
            ...payload.runConfig,
            precisionCheck: false,
            storePlots: true
          },
          radiation: payload.radiation
        });
      };
      const runRadiationTask = (task, payload, setters) => {
        if (parallelWorkersEnabled()) {
          runParallelRadiationTask(task, payload, setters);
          return;
        }
        runSingleRadiationTask(task, payload, setters);
      };
      const pushTransmissionInvalidWarning = (warnings, prefix, state) => {
        const reasons = [];
        if (state.imagResidualWarning) reasons.push("non-negligible imaginary part after GBFactor");
        if (state.intervalWarning) reasons.push("outside [0,1] after GBFactor");
        if (!reasons.length) {
          return;
        }
        const requestedOrder = state.requestedOrder != null ? state.requestedOrder : "requested";
        pushUnique(warnings, `${prefix} The WKB transmission coefficient is non-physical at requested order ${requestedOrder} (${reasons.join("; ")}); non-physical points were removed from physical output.`);
      };
      const finalizeParallelGreybody = (plan, taskStates) => {
        const warnings = uniqueWarnings(plan.warnings || []);
        const curves = plan.tasks.map(task => ({
          task,
          state: taskStates.get(task.id)
        })).filter(({
          task,
          state
        }) => {
          const complete = state && !state.failed;
          const hasNonPhysicalPoints = complete && (state.imagResidualWarning || state.intervalWarning);
          const hasPhysicalPoints = complete && state.values.some(value => value !== null && value !== undefined);
          if (!complete) {
            pushUnique(warnings, `${task.label} did not finish successfully and was skipped.`);
          }
          if (hasNonPhysicalPoints) {
            pushTransmissionInvalidWarning(warnings, `[${Object.entries(task.params).map(([name, value]) => `${name}=${value}`).join(", ") || "default parameters"}]`, state);
          }
          if (complete && !hasPhysicalPoints) {
            pushUnique(warnings, `${task.label} produced no physical greybody points and was skipped.`);
          }
          return hasPhysicalPoints;
        }).map(({
          task,
          state
        }) => {
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
        const availableTasks = plan.tasks.map(task => ({
          task,
          state: taskStates.get(task.id)
        })).filter(({
          task,
          state
        }) => {
          const complete = state && !state.failed;
          if (!complete) {
            pushUnique(warnings, `[ell=${task.ell}] The contribution did not finish successfully and was skipped.`);
          }
          return complete;
        });
        const successfulTasks = availableTasks.filter(({
          task,
          state
        }) => {
          const hasNonPhysicalPoints = state.imagResidualWarning || state.intervalWarning;
          const hasPhysicalPoints = state.values.some(value => value !== null && value !== undefined) && state.transmissions.some(value => value !== null && value !== undefined);
          if (hasNonPhysicalPoints) {
            pushTransmissionInvalidWarning(warnings, `[ell=${task.ell}]`, state);
          }
          if (!hasPhysicalPoints) {
            pushUnique(warnings, `[ell=${task.ell}] This contribution produced no physical transmission points and was excluded from the Hawking spectrum.`);
          }
          return hasPhysicalPoints;
        });
        if (!successfulTasks.length) {
          throw new Error(warnings[0] || "No valid ell contribution was obtained for the Hawking spectrum.");
        }
        const ctx = Core.Numerics.createContext(plan.precision);
        const partials = successfulTasks.map(({
          task,
          state
        }) => {
          return {
            ell: task.ell,
            values: state.values
          };
        });
        const total = plan.omegaGrid.map((_, index) => {
          let hasPhysicalPoint = false;
          const totalAtOmega = successfulTasks.reduce((sum, {
            state
          }) => {
            if (state.values[index] === null || state.values[index] === undefined) {
              return sum;
            }
            hasPhysicalPoint = true;
            return sum.plus(new ctx.D(state.values[index]));
          }, ctx.zero);
          return hasPhysicalPoint ? totalAtOmega.toString() : null;
        });
        return {
          params: plan.params,
          parameterNames: plan.parameterNames,
          perturbationType: plan.perturbationType,
          mainOrder: plan.mainOrder,
          ellCutoff: plan.ellCutoff,
          successfulElls: partials.map(item => item.ell),
          horizon: plan.horizon,
          surfaceGravity: plan.surfaceGravity,
          temperature: plan.temperature,
          warnings,
          greybodyProfile: {
            x: plan.omegaGrid,
            curves: successfulTasks.map(({
              task,
              state
            }) => ({
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
        setters.setProgress({
          completed: 0,
          total: 1
        });
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
        const failParallel = message => {
          if (finished) return;
          finished = true;
          window.clearTimeout(startupTimer);
          disposeWorker(radiationWorkerRef.current);
          radiationWorkerRef.current = null;
          disposeWorkerCollection(radiationPoolRef.current);
          radiationPoolRef.current = [];
          runSingleRadiationTask(task, payload, setters, `Parallel ${task === "greybody" ? "greybody" : "Hawking radiation"} failed, retrying in single-worker mode`);
        };
        prepWorker.addEventListener("error", () => {
          failParallel(window.location.protocol === "file:" ? "The worker did not start from file://. Serve the project locally with: python -m http.server 8000." : "Could not start the worker.");
        });
        prepWorker.addEventListener("message", event => {
          const message = event.data;
          if (message.type === "ready") {
            ready = true;
            window.clearTimeout(startupTimer);
            setters.setStatus(`Preparing WKB kernels for parallel ${label}`);
            prepWorker.postMessage({
              type: task === "greybody" ? "prepareGreybodyParallelPlan" : "prepareHawkingParallelPlan",
              config: {
                ...payload.runConfig,
                precisionCheck: false,
                storePlots: true
              },
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
          setters.setProgress({
            completed: 0,
            total: totalPoints
          });
          const taskStates = new Map(plan.tasks.map(taskEntry => [taskEntry.id, {
            task: taskEntry,
            values: Array(plan.omegaGrid.length).fill(null),
            transmissions: Array(plan.omegaGrid.length).fill(null),
            imagResidualWarning: false,
            intervalWarning: false,
            requestedOrder: plan.mainOrder,
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
              const aggregate = task === "greybody" ? finalizeParallelGreybody(plan, taskStates) : finalizeParallelHawking(plan, taskStates);
              setters.setStatus(`${task === "greybody" ? "Greybody" : "Hawking radiation"} computation finished`);
              setters.setProgress({
                completed: 1,
                total: 1
              });
              setters.setResult(aggregate);
            } catch (aggregateError) {
              setters.setStatus(`${task === "greybody" ? "Greybody" : "Hawking radiation"} computation failed`);
              setters.setError(aggregateError.message || String(aggregateError));
            }
            disposeWorkerCollection(radiationPoolRef.current);
            radiationPoolRef.current = [];
          };
          const dispatchNext = worker => {
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
            worker.addEventListener("message", chunkEvent => {
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
                  if (resultChunk.requestedOrder !== null && resultChunk.requestedOrder !== undefined) {
                    state.requestedOrder = resultChunk.requestedOrder;
                  }
                }
                completed += resultChunk.end - resultChunk.start;
                active -= resultChunk.end - resultChunk.start;
                setters.setStatus(`Processed ${completed} of ${totalPoints} ${label} points in parallel`);
                setters.setProgress({
                  completed,
                  total: totalPoints
                });
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
                const failedTask = plan.tasks.find(item => item.id === chunkMessage.taskId);
                if (failedTask) {
                  const prefix = task === "greybody" ? failedTask.label : `[ell=${failedTask.ell}]`;
                  const warning = `${prefix} ${chunkMessage.message}`;
                  const currentWarnings = plan.warnings || [];
                  if (!currentWarnings.includes(warning)) {
                    currentWarnings.push(warning);
                  }
                }
                setters.setStatus(`Processed ${completed} of ${totalPoints} ${label} points in parallel`);
                setters.setProgress({
                  completed,
                  total: totalPoints
                });
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
        const rows = flatRows.map(row => [...displayedQnmResult.parameterNames.map(name => row.caseData.params[name]), row.overtone.n, row.overtone.main.re, row.overtone.main.im]);
        const body = `\ufeff${[headers, ...rows].map(line => line.map(csvEscape).join(",")).join("\r\n")}`;
        const blob = new Blob([body], {
          type: "text/csv;charset=utf-8"
        });
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
        const rows = displayedGreybodyResult.greybody.curves.flatMap(curve => displayedGreybodyResult.greybody.x.map((omega, index) => [...(displayedGreybodyResult.parameterNames || []).map(name => curve.params[name]), curve.ell, omega, curve.values[index]]));
        const body = `\ufeff${[headers, ...rows].map(line => line.map(csvEscape).join(",")).join("\r\n")}`;
        const blob = new Blob([body], {
          type: "text/csv;charset=utf-8"
        });
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
        const headers = ["omega", "total", ...hawkingResult.spectrum.partials.map(item => `ell=${item.ell}`)];
        const rows = hawkingResult.spectrum.x.map((omega, index) => [omega, hawkingResult.spectrum.total[index], ...hawkingResult.spectrum.partials.map(item => item.values[index])]);
        const body = `\ufeff${[headers, ...rows].map(line => line.map(csvEscape).join(",")).join("\r\n")}`;
        const blob = new Blob([body], {
          type: "text/csv;charset=utf-8"
        });
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
      const metricTab = /*#__PURE__*/React.createElement("div", {
        className: "metric-section section-card sidebar-panel"
      }, /*#__PURE__*/React.createElement("div", {
        className: "section-scroll"
      }, /*#__PURE__*/React.createElement("div", {
        className: "section-head"
      }, /*#__PURE__*/React.createElement("div", {
        className: "section-copy"
      }, /*#__PURE__*/React.createElement("h3", null, "Metric Definition"), /*#__PURE__*/React.createElement("p", null, "Choose a preset and edit the metric functions used across all solvers."))), /*#__PURE__*/React.createElement("div", {
        className: "metric-block"
      }, /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "Preset"), /*#__PURE__*/React.createElement("select", {
        value: config.presetKey,
        onChange: event => onPreset(event.target.value)
      }, Object.entries(presets).map(([key, item]) => /*#__PURE__*/React.createElement("option", {
        key: key,
        value: key
      }, item.label)))), /*#__PURE__*/React.createElement("label", {
        className: "toggle-inline metric-toggle-top"
      }, /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: config.sameMetric,
        onChange: event => updateConfig({
          sameMetric: event.target.checked,
          presetKey: "custom"
        })
      }), /*#__PURE__*/React.createElement("span", null, "Mirror g(r) from f(r)")), /*#__PURE__*/React.createElement("div", {
        className: "formula-grid-react"
      }, /*#__PURE__*/React.createElement(MetricInputCard, {
        title: "f(r)",
        description: "Primary metric function used for the horizon and potential setup.",
        disabled: false,
        preview: metric.fPreview,
        onOpenEditor: () => openFormulaEditor("fExpression"),
        editorDisabled: false,
        primary: true
      }), /*#__PURE__*/React.createElement("div", null, config.sameMetric ? /*#__PURE__*/React.createElement(DerivedMetricCard, {
        preview: metric.gPreview,
        onUnlock: () => updateConfig({
          sameMetric: false,
          presetKey: "custom"
        })
      }) : /*#__PURE__*/React.createElement(MetricInputCard, {
        title: "g(r)",
        description: "Independent radial component of the metric.",
        disabled: false,
        preview: metric.gPreview,
        onOpenEditor: () => openFormulaEditor("gExpression"),
        editorDisabled: false
      }))))));
      const parametersTab = /*#__PURE__*/React.createElement("div", {
        className: "section-card sidebar-panel"
      }, /*#__PURE__*/React.createElement("div", {
        className: "section-scroll"
      }, /*#__PURE__*/React.createElement("div", {
        className: "section-head"
      }, /*#__PURE__*/React.createElement("div", {
        className: "section-copy"
      }, /*#__PURE__*/React.createElement("h3", null, "Parameters"), /*#__PURE__*/React.createElement("p", null, "Define fixed values or parameter scans detected from the current metric."))), metric.error ? /*#__PURE__*/React.createElement("div", {
        className: "empty-state"
      }, "Fix the metric expressions to detect parameters.") : metric.names.length ? /*#__PURE__*/React.createElement("div", {
        className: "parameter-editor-grid"
      }, metric.names.map(name => {
        const spec = parameterSpecs[name] || defaultSpec;
        const range = spec.mode === "range";
        return /*#__PURE__*/React.createElement("div", {
          key: name,
          className: "parameter-row-react"
        }, /*#__PURE__*/React.createElement("div", {
          className: "parameter-row-react-head"
        }, /*#__PURE__*/React.createElement("div", {
          className: "parameter-name"
        }, name), /*#__PURE__*/React.createElement("select", {
          value: spec.mode,
          onChange: event => setParameterSpecs(current => ({
            ...current,
            [name]: {
              ...spec,
              mode: event.target.value
            }
          }))
        }, /*#__PURE__*/React.createElement("option", {
          value: "value"
        }, "Fixed value"), /*#__PURE__*/React.createElement("option", {
          value: "range"
        }, "Range"))), /*#__PURE__*/React.createElement("div", {
          className: `parameter-controls-grid${range ? "" : " compact"}`
        }, !range && /*#__PURE__*/React.createElement("label", {
          className: "field"
        }, /*#__PURE__*/React.createElement("span", {
          className: "field-label"
        }, "Value"), /*#__PURE__*/React.createElement("input", {
          type: "text",
          value: spec.value || "",
          onChange: event => setParameterSpecs(current => ({
            ...current,
            [name]: {
              ...spec,
              value: event.target.value
            }
          }))
        })), range && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("label", {
          className: "field"
        }, /*#__PURE__*/React.createElement("span", {
          className: "field-label"
        }, "Start"), /*#__PURE__*/React.createElement("input", {
          type: "text",
          value: spec.start || "",
          onChange: event => setParameterSpecs(current => ({
            ...current,
            [name]: {
              ...spec,
              start: event.target.value
            }
          }))
        })), /*#__PURE__*/React.createElement("label", {
          className: "field"
        }, /*#__PURE__*/React.createElement("span", {
          className: "field-label"
        }, "End"), /*#__PURE__*/React.createElement("input", {
          type: "text",
          value: spec.end || "",
          onChange: event => setParameterSpecs(current => ({
            ...current,
            [name]: {
              ...spec,
              end: event.target.value
            }
          }))
        })), /*#__PURE__*/React.createElement("label", {
          className: "field"
        }, /*#__PURE__*/React.createElement("span", {
          className: "field-label"
        }, "Points"), /*#__PURE__*/React.createElement("input", {
          type: "number",
          min: "2",
          step: "1",
          value: spec.count || 5,
          onChange: event => setParameterSpecs(current => ({
            ...current,
            [name]: {
              ...spec,
              count: Number(event.target.value)
            }
          }))
        })))));
      })) : /*#__PURE__*/React.createElement("div", {
        className: "empty-state"
      }, "No parameters other than r were detected.")));
      const wkbSettingsTab = /*#__PURE__*/React.createElement("div", {
        className: "section-card sidebar-panel"
      }, /*#__PURE__*/React.createElement("div", {
        className: "section-scroll"
      }, /*#__PURE__*/React.createElement("div", {
        className: "section-head"
      }, /*#__PURE__*/React.createElement("div", {
        className: "section-copy"
      }, /*#__PURE__*/React.createElement("h3", null, "WKB Settings"), /*#__PURE__*/React.createElement("p", null, "Choose perturbation settings and the approximation order used by the solver."))), /*#__PURE__*/React.createElement("div", {
        className: "field-group wkb-primary-grid"
      }, /*#__PURE__*/React.createElement("label", {
        className: "field field-span-full"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "Perturbation"), /*#__PURE__*/React.createElement("select", {
        value: config.perturbationType,
        onChange: event => updateConfig({
          perturbationType: event.target.value,
          presetKey: "custom"
        })
      }, /*#__PURE__*/React.createElement("option", {
        value: "scalar"
      }, "Scalar field"), /*#__PURE__*/React.createElement("option", {
        value: "electromagnetic"
      }, "Electromagnetic field"))), /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "ell"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        min: config.perturbationType === "electromagnetic" ? 1 : 0,
        step: "1",
        value: config.ell,
        onChange: event => updateConfig({
          ell: event.target.value,
          presetKey: "custom"
        })
      })), /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "Max overtone N"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        min: "0",
        step: "1",
        value: config.overtoneMax,
        onChange: event => updateConfig({
          overtoneMax: event.target.value,
          presetKey: "custom"
        })
      }))), /*#__PURE__*/React.createElement("div", {
        className: "field-group wkb-secondary-grid"
      }, /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "Main WKB order"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        min: "1",
        max: "16",
        step: "1",
        value: config.mainOrder,
        onChange: event => updateConfig({
          mainOrder: event.target.value,
          presetKey: "custom"
        })
      })))));
      const numericsTab = /*#__PURE__*/React.createElement("div", {
        className: "numeric-section section-card sidebar-panel"
      }, /*#__PURE__*/React.createElement("div", {
        className: "section-scroll"
      }, /*#__PURE__*/React.createElement("div", {
        className: "section-head"
      }, /*#__PURE__*/React.createElement("div", {
        className: "section-copy"
      }, /*#__PURE__*/React.createElement("h3", null, "Numerics"), /*#__PURE__*/React.createElement("p", null, "Control precision, search windows, and worker settings for heavier computations."))), /*#__PURE__*/React.createElement("div", {
        className: "field-group three-columns"
      }, /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "Decimal precision"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        min: "40",
        step: "1",
        value: config.precision,
        onChange: event => updateConfig({
          precision: event.target.value,
          presetKey: "custom"
        })
      })), /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "Chebyshev nodes"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        min: "32",
        max: "160",
        step: "2",
        value: config.spectralNodes,
        onChange: event => updateConfig({
          spectralNodes: event.target.value,
          presetKey: "custom"
        })
      })), /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "Plot samples"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        min: "101",
        max: "1201",
        step: "20",
        value: config.plotSamples,
        onChange: event => updateConfig({
          plotSamples: event.target.value,
          presetKey: "custom"
        })
      }))), /*#__PURE__*/React.createElement("div", {
        className: "field-group three-columns"
      }, /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "Search r_min"), /*#__PURE__*/React.createElement("input", {
        type: "text",
        value: config.rMin,
        onChange: event => updateConfig({
          rMin: event.target.value,
          presetKey: "custom"
        })
      })), /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "Search r_max"), /*#__PURE__*/React.createElement("input", {
        type: "text",
        value: config.rMax,
        onChange: event => updateConfig({
          rMax: event.target.value,
          presetKey: "custom"
        })
      })), /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "Horizon scan points"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        min: "160",
        step: "40",
        value: config.horizonSamples,
        onChange: event => updateConfig({
          horizonSamples: event.target.value,
          presetKey: "custom"
        })
      }))), /*#__PURE__*/React.createElement("div", {
        className: "field-group"
      }, /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "Peak scan points"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        min: "400",
        step: "100",
        value: config.peakSamples,
        onChange: event => updateConfig({
          peakSamples: event.target.value,
          presetKey: "custom"
        })
      }))), /*#__PURE__*/React.createElement("div", {
        className: "field-group"
      }, /*#__PURE__*/React.createElement("label", {
        className: "field checkbox-field checkbox-card"
      }, /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: !!config.parallelRadiation,
        onChange: event => updateConfig({
          parallelRadiation: event.target.checked,
          presetKey: "custom"
        })
      }), /*#__PURE__*/React.createElement("span", null, "Enable parallel workers for all supported computations")), /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "Parallel workers"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        min: "1",
        max: "16",
        step: "1",
        disabled: !config.parallelRadiation,
        value: config.parallelRadiationWorkers,
        onChange: event => updateConfig({
          parallelRadiationWorkers: event.target.value,
          presetKey: "custom"
        })
      })))));
      const radiationView = /*#__PURE__*/React.createElement("div", {
        className: "workspace-view workspace-radiation-view"
      }, /*#__PURE__*/React.createElement("div", {
        className: "tab-bar"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `tab-button${radiationTab === "greybody" ? " active" : ""}`,
        onClick: () => setRadiationTab("greybody")
      }, "Greybody"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `tab-button${radiationTab === "hawking" ? " active" : ""}`,
        onClick: () => setRadiationTab("hawking")
      }, "Hawking Radiation")), /*#__PURE__*/React.createElement("div", {
        className: "tab-panel"
      }, /*#__PURE__*/React.createElement("div", {
        className: "tab-panel-inner"
      }, radiationTab === "greybody" && /*#__PURE__*/React.createElement("div", {
        className: "radiation-pane"
      }, /*#__PURE__*/React.createElement("div", {
        className: "card-head card-head-split"
      }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, "Greybody factors")), /*#__PURE__*/React.createElement("div", {
        className: "card-head-tools"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "ghost-button compact-button",
        onClick: openGreybodyCompareWindow
      }, "Compare Orders"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "ghost-button compact-button",
        disabled: !displayedGreybodyResult,
        onClick: exportGreybody
      }, "Export Greybody CSV"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "primary-button",
        onClick: onRunGreybody
      }, "Compute Greybody"))), /*#__PURE__*/React.createElement("div", {
        className: "radiation-controls-grid"
      }, /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "omega min"), /*#__PURE__*/React.createElement("input", {
        type: "text",
        value: radiationConfig.omegaMin,
        onChange: event => setRadiationConfig(current => ({
          ...current,
          omegaMin: event.target.value
        }))
      })), /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "omega max"), /*#__PURE__*/React.createElement("input", {
        type: "text",
        value: radiationConfig.omegaMax,
        onChange: event => setRadiationConfig(current => ({
          ...current,
          omegaMax: event.target.value
        }))
      })), /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "Frequency points"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        min: "25",
        step: "2",
        value: radiationConfig.omegaPoints,
        onChange: event => setRadiationConfig(current => ({
          ...current,
          omegaPoints: event.target.value
        }))
      })), /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "ell min"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        min: config.perturbationType === "electromagnetic" ? 1 : 0,
        step: "1",
        value: radiationConfig.greybodyEllMin != null ? radiationConfig.greybodyEllMin : radiationConfig.greybodyEll,
        onChange: event => setRadiationConfig(current => ({
          ...current,
          greybodyEllMin: event.target.value
        }))
      })), /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "ell max"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        min: config.perturbationType === "electromagnetic" ? 1 : 0,
        step: "1",
        value: radiationConfig.greybodyEllMax != null ? radiationConfig.greybodyEllMax : radiationConfig.greybodyEll,
        onChange: event => setRadiationConfig(current => ({
          ...current,
          greybodyEllMax: event.target.value
        }))
      })), /*#__PURE__*/React.createElement("div", {
        className: "summary-card radiation-order-card"
      }, /*#__PURE__*/React.createElement("span", null, "Main WKB order"), /*#__PURE__*/React.createElement("strong", null, config.mainOrder))), greybodyError && /*#__PURE__*/React.createElement("div", {
        className: "warning-box"
      }, greybodyError), !displayedGreybodyResult ? /*#__PURE__*/React.createElement("div", {
        className: "empty-panel"
      }, "Run the greybody solver to generate transmission profiles for fixed ell or ell ranges.") : /*#__PURE__*/React.createElement("div", {
        className: "section-card radiation-chart-card full-width-card"
      }, /*#__PURE__*/React.createElement("div", {
        className: "section-head"
      }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, "Greybody profile"))), /*#__PURE__*/React.createElement("div", {
        className: "chart-area-fixed"
      }, /*#__PURE__*/React.createElement(GreybodyChart, {
        data: radiationGreybodyData
      })))), radiationTab === "hawking" && /*#__PURE__*/React.createElement("div", {
        className: "radiation-pane"
      }, /*#__PURE__*/React.createElement("div", {
        className: "card-head card-head-split"
      }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, "Hawking radiation")), /*#__PURE__*/React.createElement("div", {
        className: "card-head-tools"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "ghost-button compact-button",
        disabled: !hawkingResult,
        onClick: exportHawking
      }, "Export Hawking CSV"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "primary-button",
        onClick: onRunHawking
      }, "Compute Hawking Radiation"))), /*#__PURE__*/React.createElement("div", {
        className: "radiation-controls-grid"
      }, /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "omega min"), /*#__PURE__*/React.createElement("input", {
        type: "text",
        value: radiationConfig.omegaMin,
        onChange: event => setRadiationConfig(current => ({
          ...current,
          omegaMin: event.target.value
        }))
      })), /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "omega max"), /*#__PURE__*/React.createElement("input", {
        type: "text",
        value: radiationConfig.omegaMax,
        onChange: event => setRadiationConfig(current => ({
          ...current,
          omegaMax: event.target.value
        }))
      })), /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "Frequency points"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        min: "25",
        step: "2",
        value: radiationConfig.omegaPoints,
        onChange: event => setRadiationConfig(current => ({
          ...current,
          omegaPoints: event.target.value
        }))
      })), /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "ell cutoff"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        min: config.perturbationType === "electromagnetic" ? 1 : 0,
        step: "1",
        value: radiationConfig.ellCutoff,
        onChange: event => setRadiationConfig(current => ({
          ...current,
          ellCutoff: event.target.value
        }))
      })), /*#__PURE__*/React.createElement("div", {
        className: "summary-card radiation-order-card"
      }, /*#__PURE__*/React.createElement("span", null, "Main WKB order"), /*#__PURE__*/React.createElement("strong", null, config.mainOrder))), hawkingError && /*#__PURE__*/React.createElement("div", {
        className: "warning-box"
      }, hawkingError), !hawkingResult ? /*#__PURE__*/React.createElement("div", {
        className: "empty-panel"
      }, "Run the Hawking solver to build the summed radiation spectrum.") : /*#__PURE__*/React.createElement("div", {
        className: "section-card radiation-chart-card full-width-card"
      }, /*#__PURE__*/React.createElement("div", {
        className: "section-head"
      }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, "Hawking spectrum"))), /*#__PURE__*/React.createElement("div", {
        className: "chart-area-fixed"
      }, /*#__PURE__*/React.createElement(HawkingSpectrumChart, {
        data: radiationSpectrumData
      })))))));
      const diagnosticsView = /*#__PURE__*/React.createElement("div", {
        className: "workspace-view workspace-diagnostics-view"
      }, /*#__PURE__*/React.createElement("div", {
        className: "tab-panel diagnostics-panel"
      }, /*#__PURE__*/React.createElement("div", {
        className: "tab-panel-inner"
      }, /*#__PURE__*/React.createElement("div", {
        className: "diagnostic-stack"
      }, !!allDiagnosticsWarnings.length && /*#__PURE__*/React.createElement(WarningStack, {
        warnings: allDiagnosticsWarnings
      }), !!diagnosticsEntries.length && /*#__PURE__*/React.createElement("div", {
        className: "diagnostic-grid"
      }, diagnosticsEntries.map(item => /*#__PURE__*/React.createElement("div", {
        key: `${item.label}-${item.value}`,
        className: "summary-card"
      }, /*#__PURE__*/React.createElement("span", null, item.label), /*#__PURE__*/React.createElement("strong", null, item.value)))), !result && !analysisResult && !greybodyResult && !hawkingResult && /*#__PURE__*/React.createElement("div", {
        className: "empty-panel"
      }, "Diagnostics will appear after a successful computation.")))));
      return /*#__PURE__*/React.createElement("div", {
        className: "react-shell"
      }, /*#__PURE__*/React.createElement("header", {
        className: "topbar"
      }, /*#__PURE__*/React.createElement("div", {
        className: "topbar-title"
      }, /*#__PURE__*/React.createElement("div", {
        className: "topbar-title-row"
      }, /*#__PURE__*/React.createElement("h1", null, "WKBpackage"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "title-icon-button",
        title: "Open references and credits",
        onClick: () => {
          setWindowPositions(current => ({
            ...current,
            references: defaultWindowPositions().references
          }));
          setReferencesOpen(true);
        }
      }, "i")), /*#__PURE__*/React.createElement("p", null, "Higher-order WKB workspace for quasinormal modes, effective potentials, greybody factors, and Hawking radiation.")), /*#__PURE__*/React.createElement("div", {
        className: "topbar-actions"
      }, /*#__PURE__*/React.createElement("div", {
        className: "status-cluster"
      }, /*#__PURE__*/React.createElement("div", {
        className: "status-kicker"
      }, "Computation status"), /*#__PURE__*/React.createElement("div", {
        className: "status-line"
      }, globalStatusDisplay.status), /*#__PURE__*/React.createElement("div", {
        className: "progress-wrap compact-progress"
      }, /*#__PURE__*/React.createElement("div", {
        className: "progress-track"
      }, /*#__PURE__*/React.createElement("div", {
        className: "progress-bar",
        style: {
          width: `${globalStatusDisplay.progressValue}%`
        }
      })), /*#__PURE__*/React.createElement("div", {
        className: "progress-text"
      }, globalStatusDisplay.progressValue, "%"))))), /*#__PURE__*/React.createElement("div", {
        className: "workspace-grid"
      }, /*#__PURE__*/React.createElement("section", {
        className: "sidebar-column"
      }, /*#__PURE__*/React.createElement("div", {
        className: "sidebar-tab-bar"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `tab-button${sidebarTab === "metric-definition" ? " active" : ""}`,
        onClick: () => setSidebarTab("metric-definition")
      }, "Metric Definition"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `tab-button${sidebarTab === "parameters" ? " active" : ""}`,
        onClick: () => setSidebarTab("parameters")
      }, "Parameters"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `tab-button${sidebarTab === "wkb-settings" ? " active" : ""}`,
        onClick: () => setSidebarTab("wkb-settings")
      }, "WKB Settings"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `tab-button${sidebarTab === "numerics" ? " active" : ""}`,
        onClick: () => setSidebarTab("numerics")
      }, "Numerics")), sidebarTab === "metric-definition" ? metricTab : sidebarTab === "parameters" ? parametersTab : sidebarTab === "wkb-settings" ? wkbSettingsTab : numericsTab), /*#__PURE__*/React.createElement("section", {
        className: "main-column"
      }, /*#__PURE__*/React.createElement("div", {
        className: "results-layout"
      }, /*#__PURE__*/React.createElement("div", {
        className: "card workspace-card"
      }, /*#__PURE__*/React.createElement("div", {
        className: "workspace-primary-tabs"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `tab-button${workspaceTab === "table" ? " active" : ""}`,
        onClick: () => setWorkspaceTab("table")
      }, "QNMs"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `tab-button${workspaceTab === "analysis" ? " active" : ""}`,
        onClick: () => setWorkspaceTab("analysis")
      }, "Analysis"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `tab-button${workspaceTab === "radiation" ? " active" : ""}`,
        onClick: () => setWorkspaceTab("radiation")
      }, "Radiation"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `tab-button${workspaceTab === "diagnostics" ? " active" : ""}`,
        onClick: () => setWorkspaceTab("diagnostics")
      }, "Diagnostics")), /*#__PURE__*/React.createElement("div", {
        className: "workspace-panel"
      }, workspaceTab === "table" && /*#__PURE__*/React.createElement("div", {
        className: "workspace-view workspace-table-view"
      }, /*#__PURE__*/React.createElement("div", {
        className: "card-head card-head-split"
      }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, "QNMs"), /*#__PURE__*/React.createElement("p", null, "Click a row to inspect one overtone and open its WKB/Pade values.")), /*#__PURE__*/React.createElement("div", {
        className: "card-head-tools"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "primary-button",
        onClick: onRun
      }, "Compute QNMs"), displayedQnmResult && lastRunConfig && hasScanRange(lastRunConfig.parameterSpecs) && displayedQnmResult.cases.length > 1 && /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "ghost-button compact-button",
        onClick: exportScan
      }, "Export scan CSV"))), /*#__PURE__*/React.createElement("div", {
        className: "workspace-table-body"
      }, error && /*#__PURE__*/React.createElement("div", {
        className: "warning-box"
      }, error), !displayedQnmResult ? /*#__PURE__*/React.createElement("div", {
        className: "empty-panel"
      }, "No QNM computation has been run yet.") : /*#__PURE__*/React.createElement("div", {
        className: "table-wrap result-table-scroll"
      }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, displayedQnmResult.parameterNames.map(name => /*#__PURE__*/React.createElement("th", {
        key: name
      }, name)), /*#__PURE__*/React.createElement("th", null, "n"), /*#__PURE__*/React.createElement("th", null, `omega (WKB ${displayedQnmResult.mainOrder})`), /*#__PURE__*/React.createElement("th", null, "Pade"))), /*#__PURE__*/React.createElement("tbody", null, flatRows.map((row, index) => {
        const pade = pickPade(row.overtone.pade);
        const toggle = () => {
          setSelectedRowIndex(selectedRowIndex === index ? null : index);
          setDrawerTab("orders");
        };
        return /*#__PURE__*/React.createElement("tr", {
          key: `${row.caseIndex}-${row.overtone.n}`,
          className: `${selectedRowIndex === index ? "selected-row" : ""} ${index > 0 && flatRows[index - 1].caseIndex !== row.caseIndex ? "group-divider" : ""}`.trim()
        }, displayedQnmResult.parameterNames.map(name => /*#__PURE__*/React.createElement("td", {
          key: name
        }, compactNumber(row.caseData.params[name]))), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("button", {
          type: "button",
          className: "table-row-button",
          onClick: toggle
        }, row.overtone.n)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("button", {
          type: "button",
          className: "table-row-button",
          title: formatComplexInline(row.overtone.main),
          onClick: toggle
        }, formatComplexInline(row.overtone.main))), /*#__PURE__*/React.createElement("td", {
          title: pade ? `${pade.label}: ${formatComplexInline(pade.value)}` : "No Pade value"
        }, pade ? formatComplexInline(pade.value) : "--"));
      })))))), workspaceTab === "analysis" && /*#__PURE__*/React.createElement("div", {
        className: "workspace-view workspace-analysis-view"
      }, /*#__PURE__*/React.createElement("div", {
        className: "tab-bar"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `tab-button${activeTab === "potential" ? " active" : ""}`,
        onClick: () => setActiveTab("potential")
      }, "Potential"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `tab-button${activeTab === "solution" ? " active" : ""}`,
        onClick: () => setActiveTab("solution")
      }, "Metric Functions"), isSingleScan && /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `tab-button${activeTab === "modes" ? " active" : ""}`,
        onClick: () => setActiveTab("modes")
      }, "Mode Curves")), /*#__PURE__*/React.createElement("div", {
        className: "tabs-toolbar"
      }, /*#__PURE__*/React.createElement("div", {
        className: "toolbar-cluster"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "primary-button",
        onClick: onRunAnalysis
      }, "Compute Potential and Solution"), analysisCurveControlAvailable && activeTab !== "modes" && /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `ghost-button compact-button${analysisCurveManagerOpen ? " is-active" : ""}`,
        onClick: openAnalysisCurveManager
      }, analysisCurveManagerNeeded ? `Curves (${visibleAnalysisCaseIndices.length}/${analysisCases.length})` : "Curves"), isSingleScan && activeTab === "modes" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `ghost-button compact-button${modeSource === "wkb" ? " is-active" : ""}`,
        onClick: () => setModeSource("wkb")
      }, "WKB"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `ghost-button compact-button${modeSource === "pade" ? " is-active" : ""}`,
        onClick: () => setModeSource("pade")
      }, "Pade")))), analysisError && /*#__PURE__*/React.createElement("div", {
        className: "warning-box"
      }, analysisError), /*#__PURE__*/React.createElement("div", {
        className: "tab-panel"
      }, /*#__PURE__*/React.createElement("div", {
        className: "tab-panel-inner"
      }, activeTab === "potential" && (!analysisPlotData ? /*#__PURE__*/React.createElement("div", {
        className: "empty-panel action-empty-panel"
      }, /*#__PURE__*/React.createElement("div", {
        className: "empty-panel-copy"
      }, /*#__PURE__*/React.createElement("strong", null, "Potential profile not generated yet."), /*#__PURE__*/React.createElement("span", null, "Use the action above to build the effective potential and related diagnostic curves for the current configuration."))) : /*#__PURE__*/React.createElement(PotentialChart, {
        plot: analysisPlotData
      })), activeTab === "solution" && (!analysisPlotData ? /*#__PURE__*/React.createElement("div", {
        className: "empty-panel action-empty-panel"
      }, /*#__PURE__*/React.createElement("div", {
        className: "empty-panel-copy"
      }, /*#__PURE__*/React.createElement("strong", null, "Metric functions are not available yet."), /*#__PURE__*/React.createElement("span", null, "Run the analysis once to render the current f(r) and g(r) profiles in this workspace."))) : /*#__PURE__*/React.createElement(MetricChart, {
        plot: analysisPlotData
      })), activeTab === "modes" && isSingleScan && /*#__PURE__*/React.createElement(ScanChart, {
        data: scanChartData
      })))), workspaceTab === "radiation" && radiationView, workspaceTab === "diagnostics" && diagnosticsView))))), /*#__PURE__*/React.createElement("div", {
        className: "drawer-layer"
      }, selectedRow && /*#__PURE__*/React.createElement("div", {
        className: "drawer-backdrop",
        onClick: () => setSelectedRowIndex(null)
      }), /*#__PURE__*/React.createElement("div", {
        className: `mode-drawer${selectedRow ? "" : " closed"}`,
        style: windowPositions.mode
      }, selectedRow && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
        className: "mode-drawer-head window-drag-handle",
        onMouseDown: event => beginWindowDrag("mode", event)
      }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, `Mode n = ${selectedRow.overtone.n}`), /*#__PURE__*/React.createElement("p", null, formatComplexInline(selectedRow.overtone.main))), /*#__PURE__*/React.createElement("div", {
        className: "window-actions"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "ghost-button compact-button",
        onClick: event => {
          event.stopPropagation();
          setSelectedRowIndex(null);
        }
      }, "Close"))), /*#__PURE__*/React.createElement("div", {
        className: "drawer-tab-bar"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `tab-button${drawerTab === "orders" ? " active" : ""}`,
        onClick: () => setDrawerTab("orders")
      }, "Orders"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `tab-button${drawerTab === "pade" ? " active" : ""}`,
        onClick: () => setDrawerTab("pade")
      }, "Pade"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: `tab-button${drawerTab === "plot" ? " active" : ""}`,
        onClick: () => setDrawerTab("plot")
      }, "Plot")), /*#__PURE__*/React.createElement("div", {
        className: "drawer-body"
      }, /*#__PURE__*/React.createElement("div", {
        className: "drawer-scroll"
      }, drawerTab === "orders" && /*#__PURE__*/React.createElement("div", {
        className: "table-wrap"
      }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Method"), /*#__PURE__*/React.createElement("th", null, "omega"), /*#__PURE__*/React.createElement("th", null, "Relative drift"))), /*#__PURE__*/React.createElement("tbody", null, selectedRow.caseData.orders.map(order => /*#__PURE__*/React.createElement("tr", {
        key: order
      }, /*#__PURE__*/React.createElement("td", null, `WKB ${order}`), /*#__PURE__*/React.createElement("td", null, formatComplexInline(selectedRow.overtone.orders[order])), /*#__PURE__*/React.createElement("td", null, formatRelative(selectedRow.overtone.orderAccuracy[order]))))))), drawerTab === "pade" && (!(selectedRow.overtone.pade && selectedRow.overtone.pade.length) ? /*#__PURE__*/React.createElement("div", {
        className: "empty-panel"
      }, "No Pade values are available for this mode.") : /*#__PURE__*/React.createElement("div", {
        className: "table-wrap"
      }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Method"), /*#__PURE__*/React.createElement("th", null, "omega"), /*#__PURE__*/React.createElement("th", null, "Relative drift"))), /*#__PURE__*/React.createElement("tbody", null, selectedRow.overtone.pade.map(item => /*#__PURE__*/React.createElement("tr", {
        key: item.label
      }, /*#__PURE__*/React.createElement("td", null, item.label), /*#__PURE__*/React.createElement("td", null, formatComplexInline(item.value)), /*#__PURE__*/React.createElement("td", null, formatRelative(item.relativeToMain)))))))), drawerTab === "plot" && (orderChartData ? /*#__PURE__*/React.createElement(OrderChart, {
        data: orderChartData
      }) : /*#__PURE__*/React.createElement("div", {
        className: "empty-panel"
      }, "Could not build the WKB-order plot."))))))), /*#__PURE__*/React.createElement(FormulaEditorModal, {
        open: formulaEditor.open,
        fieldLabel: formulaEditor.field === "gExpression" ? "g(r)" : "f(r)",
        draft: formulaEditor.draft,
        preview: formulaEditorPreview,
        inputRef: editorInputRef,
        onDraftChange: value => setFormulaEditor(current => ({
          ...current,
          draft: value
        })),
        onOpenHelp: () => {
          setWindowPositions(current => ({
            ...current,
            help: defaultWindowPositions().help
          }));
          setHelpOpen(true);
        },
        onApply: applyFormulaEditor,
        onClose: closeFormulaEditor,
        windowStyle: windowPositions.editor,
        onMouseDownHeader: event => beginWindowDrag("editor", event)
      }), analysisCurveManagerOpen && analysisCurveControlAvailable && workspaceTab === "analysis" && activeTab !== "modes" && /*#__PURE__*/React.createElement("div", {
        className: "floating-window-layer"
      }, /*#__PURE__*/React.createElement("div", {
        className: "analysis-curve-manager-card",
        style: windowPositions.analysisCurveManager,
        onClick: event => event.stopPropagation()
      }, /*#__PURE__*/React.createElement("div", {
        className: "mode-drawer-head window-drag-handle",
        onMouseDown: event => beginWindowDrag("analysisCurveManager", event)
      }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, "Visible Curves"), /*#__PURE__*/React.createElement("p", null, "Click any curve to add or remove it. When the slider is available, the current slider preview always stays visible.")), /*#__PURE__*/React.createElement("div", {
        className: "window-actions"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "ghost-button compact-button",
        onClick: () => setAnalysisCurveSelection(analysisSliderData ? [] : [analysisCases[0].caseIndex])
      }, analysisSliderData ? "Only Slider" : "Single Curve"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "ghost-button compact-button",
        onClick: () => setAnalysisCurveSelection(analysisCases.map(item => item.caseIndex))
      }, "Show All"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "ghost-button compact-button",
        onClick: closeAnalysisCurveManager
      }, "Close"))), /*#__PURE__*/React.createElement("div", {
        className: "analysis-curve-manager-body"
      }, analysisSliderData && analysisSliderEntry && /*#__PURE__*/React.createElement("div", {
        className: "analysis-curve-slider-card"
      }, /*#__PURE__*/React.createElement("div", {
        className: "analysis-curve-slider-head"
      }, /*#__PURE__*/React.createElement("strong", null, "Slider preview"), /*#__PURE__*/React.createElement("span", null, `${analysisSliderData.parameterName} = ${compactNumber(analysisSliderEntry.value)}`)), /*#__PURE__*/React.createElement("input", {
        className: "analysis-curve-slider-range",
        type: "range",
        min: "0",
        max: Math.max(0, analysisSliderData.entries.length - 1),
        step: "1",
        value: analysisCurveSliderPosition,
        onChange: event => setAnalysisCurveSliderPosition(Number(event.target.value))
      }), /*#__PURE__*/React.createElement("div", {
        className: "analysis-curve-slider-meta"
      }, /*#__PURE__*/React.createElement("span", null, compactNumber(analysisSliderData.entries[0].value)), /*#__PURE__*/React.createElement("span", null, analysisSliderData.parameterName), /*#__PURE__*/React.createElement("span", null, compactNumber(analysisSliderData.entries[analysisSliderData.entries.length - 1].value)))), /*#__PURE__*/React.createElement("div", {
        className: "analysis-curve-manager-toolbar"
      }, /*#__PURE__*/React.createElement("span", {
        className: "analysis-curve-manager-count"
      }, `Showing ${visibleAnalysisCaseIndices.length} of ${analysisCases.length} scanned cases`)), /*#__PURE__*/React.createElement("div", {
        className: "analysis-curve-list"
      }, analysisCurveEntries.map(item => {
        const isPinned = pinnedAnalysisCaseSet.has(item.caseIndex);
        const isPreview = analysisSliderCaseIndex === item.caseIndex;
        const isVisible = visibleAnalysisCaseSet.has(item.caseIndex);
        return /*#__PURE__*/React.createElement("button", {
          key: item.caseIndex,
          type: "button",
          className: `analysis-curve-list-button${isVisible ? " is-active" : ""}${isPreview ? " is-preview" : ""}`,
          onClick: () => toggleAnalysisCurveSelection(item.caseIndex)
        }, /*#__PURE__*/React.createElement("div", {
          className: "analysis-curve-list-head"
        }, /*#__PURE__*/React.createElement("div", {
          className: "analysis-curve-swatch-row"
        }, /*#__PURE__*/React.createElement("span", {
          className: "analysis-curve-swatch",
          style: {
            background: chartColor(config.sameMetric ? item.caseIndex : item.caseIndex * 2)
          }
        }), !config.sameMetric && /*#__PURE__*/React.createElement("span", {
          className: "analysis-curve-swatch",
          style: {
            background: chartColor(item.caseIndex * 2 + 1)
          }
        })), /*#__PURE__*/React.createElement("div", {
          className: "analysis-curve-list-meta"
        }, isPreview && /*#__PURE__*/React.createElement("span", null, "slider"), isPinned && /*#__PURE__*/React.createElement("span", null, "selected"), !isPinned && !isPreview && isVisible && /*#__PURE__*/React.createElement("span", null, "visible"))), /*#__PURE__*/React.createElement("div", {
          className: "analysis-curve-list-title"
        }, item.label));
      }))))), greybodyCompareOpen && /*#__PURE__*/React.createElement("div", {
        className: "help-modal-backdrop",
        onClick: event => {
          if (event.target === event.currentTarget) closeGreybodyCompareWindow();
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "greybody-compare-card",
        style: windowPositions.greybodyCompare,
        onClick: event => event.stopPropagation()
      }, /*#__PURE__*/React.createElement("div", {
        className: "mode-drawer-head window-drag-handle",
        onMouseDown: event => beginWindowDrag("greybodyCompare", event)
      }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, "Greybody WKB Order Comparison"), /*#__PURE__*/React.createElement("p", null, "Compute the greybody factor between two WKB orders for one ell and compare everything to the highest valid order.")), /*#__PURE__*/React.createElement("div", {
        className: "window-actions"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "primary-button",
        onClick: event => {
          event.stopPropagation();
          runGreybodyOrderComparison();
        }
      }, "Compute"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "ghost-button compact-button",
        onClick: event => {
          event.stopPropagation();
          closeGreybodyCompareWindow();
        }
      }, "Close"))), /*#__PURE__*/React.createElement("div", {
        className: "greybody-compare-scroll"
      }, /*#__PURE__*/React.createElement("div", {
        className: "greybody-compare-controls"
      }, /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "ell"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        min: config.perturbationType === "electromagnetic" ? 1 : 0,
        step: "1",
        value: greybodyCompareSettings.ell,
        onChange: event => setGreybodyCompareSettings(current => ({
          ...current,
          ell: event.target.value
        }))
      })), /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "Order from"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        min: "1",
        max: maxAvailableWkbOrder,
        step: "1",
        value: greybodyCompareSettings.orderMin,
        onChange: event => setGreybodyCompareSettings(current => ({
          ...current,
          orderMin: event.target.value
        }))
      })), /*#__PURE__*/React.createElement("label", {
        className: "field"
      }, /*#__PURE__*/React.createElement("span", {
        className: "field-label"
      }, "Order to"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        min: "1",
        max: maxAvailableWkbOrder,
        step: "1",
        value: greybodyCompareSettings.orderMax,
        onChange: event => setGreybodyCompareSettings(current => ({
          ...current,
          orderMax: event.target.value
        }))
      })), /*#__PURE__*/React.createElement("div", {
        className: "summary-card radiation-order-card"
      }, /*#__PURE__*/React.createElement("span", null, "Current main order"), /*#__PURE__*/React.createElement("strong", null, config.mainOrder))), /*#__PURE__*/React.createElement("div", {
        className: "greybody-compare-status"
      }, /*#__PURE__*/React.createElement("strong", null, greybodyCompareStatus), /*#__PURE__*/React.createElement("span", null, greybodyCompareProgressValue, "%")), greybodyCompareError && /*#__PURE__*/React.createElement("div", {
        className: "warning-box"
      }, greybodyCompareError), !!greybodyCompareWarnings.length && /*#__PURE__*/React.createElement(WarningStack, {
        warnings: greybodyCompareWarnings
      }), !greybodyCompareResult ? /*#__PURE__*/React.createElement("div", {
        className: "empty-panel"
      }, "Run the comparison to build one plot with all requested orders and another with the differences relative to the highest valid order.") : /*#__PURE__*/React.createElement("div", {
        className: "greybody-compare-chart-stack"
      }, /*#__PURE__*/React.createElement("div", {
        className: "section-card radiation-chart-card full-width-card"
      }, /*#__PURE__*/React.createElement("div", {
        className: "section-head"
      }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, "All requested orders"))), /*#__PURE__*/React.createElement("div", {
        className: "chart-area-fixed"
      }, /*#__PURE__*/React.createElement(GreybodyOrderSweepChart, {
        data: greybodyOrderSweepData
      }))), /*#__PURE__*/React.createElement("div", {
        className: "section-card radiation-chart-card full-width-card"
      }, /*#__PURE__*/React.createElement("div", {
        className: "section-head"
      }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, `Difference relative to WKB ${greybodyCompareResult.referenceOrder}`))), /*#__PURE__*/React.createElement("div", {
        className: "chart-area-fixed"
      }, /*#__PURE__*/React.createElement(GreybodyOrderDifferenceChart, {
        data: greybodyOrderDifferenceData
      }))))))), helpOpen && /*#__PURE__*/React.createElement("div", {
        className: "help-modal-backdrop",
        onClick: event => {
          if (event.target === event.currentTarget) setHelpOpen(false);
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "help-modal-card",
        style: windowPositions.help,
        onClick: event => event.stopPropagation()
      }, /*#__PURE__*/React.createElement("div", {
        className: "mode-drawer-head window-drag-handle",
        onMouseDown: event => beginWindowDrag("help", event)
      }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, "Formula Help"), /*#__PURE__*/React.createElement("p", null, "Supported analytic functions, constants, and LaTeX fragments for the metric editor.")), /*#__PURE__*/React.createElement("div", {
        className: "window-actions"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "ghost-button compact-button",
        onClick: event => {
          event.stopPropagation();
          setHelpOpen(false);
        }
      }, "Close"))), /*#__PURE__*/React.createElement("div", {
        className: "help-grid-scroll"
      }, /*#__PURE__*/React.createElement("div", {
        className: "help-grid"
      }, helpItems.map(item => /*#__PURE__*/React.createElement("div", {
        key: item[0],
        className: "help-item"
      }, /*#__PURE__*/React.createElement("code", null, item[0]), /*#__PURE__*/React.createElement("div", null, item[1])))), /*#__PURE__*/React.createElement("div", {
        className: "help-subsection"
      }, /*#__PURE__*/React.createElement("h4", null, "LaTeX paste examples"), /*#__PURE__*/React.createElement("div", {
        className: "latex-example-list static"
      }, latexExamples.map(example => /*#__PURE__*/React.createElement("div", {
        key: example,
        className: "help-item latex-example-card"
      }, /*#__PURE__*/React.createElement("code", null, example)))))))), referencesOpen && /*#__PURE__*/React.createElement("div", {
        className: "help-modal-backdrop",
        onClick: event => {
          if (event.target === event.currentTarget) setReferencesOpen(false);
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "help-modal-card references-modal-card",
        style: windowPositions.references,
        onClick: event => event.stopPropagation()
      }, /*#__PURE__*/React.createElement("div", {
        className: "mode-drawer-head window-drag-handle",
        onMouseDown: event => beginWindowDrag("references", event)
      }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, "References")), /*#__PURE__*/React.createElement("div", {
        className: "window-actions"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "ghost-button compact-button",
        onClick: event => {
          event.stopPropagation();
          setReferencesOpen(false);
        }
      }, "Close"))), /*#__PURE__*/React.createElement("div", {
        className: "help-grid-scroll"
      }, /*#__PURE__*/React.createElement("div", {
        className: "reference-credits"
      }, referenceCredits.map(item => /*#__PURE__*/React.createElement("p", {
        key: item
      }, item))), /*#__PURE__*/React.createElement("div", {
        className: "reference-list modal-reference-list"
      }, referenceItems.map(item => /*#__PURE__*/React.createElement("a", {
        key: item.href,
        className: "reference-item",
        href: item.href,
        target: "_blank",
        rel: "noreferrer"
      }, /*#__PURE__*/React.createElement("strong", null, item.title), /*#__PURE__*/React.createElement("span", null, item.meta))))))));
    }
    if (!window.React || !window.ReactDOM) throw new Error("React runtime is not loaded.");
    if (!Core || !Core.Parser || !Core.Chart) throw new Error("One of the core browser modules did not load.");
    if (!mountNode) throw new Error("Root element #root was not found.");
    ReactDOM.createRoot(mountNode).render(/*#__PURE__*/React.createElement(AppRoot, null));
  } catch (error) {
    showFatal(error && error.message ? error.message : String(error));
  }
})();