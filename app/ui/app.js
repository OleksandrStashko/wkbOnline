(function () {
  const App = self.QNMApp;

  const presets = {
    custom: {
      label: "Пользовательский",
      values: {
        fExpression: "1 - 2*M/r",
        gExpression: "1 - 2*M/r",
        perturbationType: "scalar",
        ell: 2,
        overtoneMax: 2,
        mainOrder: 6,
        showAllOrders: true,
        precision: 70,
        spectralNodes: 64,
        plotSamples: 401,
        rMin: "0.8",
        rMax: "30",
        horizonSamples: 480,
        peakSamples: 900,
        parameterSpecs: {
          M: { mode: "value", value: "1" }
        }
      }
    },
    schwarzschild: {
      label: "Шварцшильд",
      values: {
        fExpression: "1 - 2*M/r",
        gExpression: "1 - 2*M/r",
        perturbationType: "scalar",
        ell: 2,
        overtoneMax: 2,
        mainOrder: 6,
        showAllOrders: true,
        precision: 70,
        spectralNodes: 64,
        plotSamples: 401,
        rMin: "0.8",
        rMax: "30",
        horizonSamples: 480,
        peakSamples: 900,
        parameterSpecs: {
          M: { mode: "value", value: "1" }
        }
      }
    },
    reissnerNordstrom: {
      label: "Рейсснер-Нордстрём",
      values: {
        fExpression: "1 - 2*M/r + Q^2/r^2",
        gExpression: "1 - 2*M/r + Q^2/r^2",
        perturbationType: "scalar",
        ell: 2,
        overtoneMax: 2,
        mainOrder: 6,
        showAllOrders: true,
        precision: 76,
        spectralNodes: 72,
        plotSamples: 401,
        rMin: "0.6",
        rMax: "35",
        horizonSamples: 560,
        peakSamples: 980,
        parameterSpecs: {
          M: { mode: "value", value: "1" },
          Q: { mode: "value", value: "0.4" }
        }
      }
    }
  };

  const helpItems = [
    { expr: "sqrt(x)", text: "квадратный корень" },
    { expr: "ln(x)", text: "натуральный логарифм" },
    { expr: "log(x)", text: "то же, что ln(x)" },
    { expr: "log(x, b)", text: "логарифм по основанию b" },
    { expr: "exp(x)", text: "экспонента e^x" },
    { expr: "sin(x), cos(x), tan(x)", text: "тригонометрические функции" },
    { expr: "asin(x), acos(x), atan(x)", text: "обратные тригонометрические функции" },
    { expr: "sinh(x), cosh(x), tanh(x)", text: "гиперболические функции" },
    { expr: "asinh(x), acosh(x), atanh(x)", text: "обратные гиперболические функции" },
    { expr: "abs(x)", text: "модуль" },
    { expr: "min(a, b), max(a, b)", text: "минимум и максимум двух аргументов" },
    { expr: "pow(x, y) или x^y", text: "степень" },
    { expr: "pi, e", text: "математические константы" }
  ];

  let worker = null;
  let detailWorker = null;
  let currentResult = null;
  let flatRows = [];
  let selectedRow = null;
  let lastRunConfig = null;
  let baseCaseIndex = null;
  let metricRefreshTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function resolveElement(id, fallbackId) {
    return $(id) || (fallbackId ? $(fallbackId) : null) || document.createElement("div");
  }

  const elements = {
    presetSelect: resolveElement("preset-select"),
    fExpression: resolveElement("f-expression"),
    gExpression: resolveElement("g-expression"),
    fPreview: resolveElement("f-preview"),
    gPreview: resolveElement("g-preview"),
    openHelp: resolveElement("open-help"),
    helpDialog: resolveElement("formula-help-dialog"),
    closeHelp: resolveElement("close-help"),
    formulaHelp: resolveElement("formula-help"),
    perturbationType: resolveElement("perturbation-type"),
    ellInput: resolveElement("ell-input"),
    overtoneInput: resolveElement("overtone-input"),
    orderInput: resolveElement("order-input"),
    showAllOrders: resolveElement("show-all-orders"),
    precisionInput: resolveElement("precision-input"),
    spectralNodesInput: resolveElement("spectral-nodes-input"),
    plotSamplesInput: resolveElement("plot-samples-input"),
    rMinInput: resolveElement("r-min-input"),
    rMaxInput: resolveElement("r-max-input"),
    horizonSamplesInput: resolveElement("horizon-samples-input"),
    peakSamplesInput: resolveElement("peak-samples-input"),
    detectParameters: resolveElement("detect-parameters"),
    parameterList: resolveElement("parameter-list"),
    runButton: resolveElement("run-button"),
    statusLine: resolveElement("status-line"),
    progressBar: resolveElement("progress-bar"),
    progressText: resolveElement("progress-text"),
    inputError: resolveElement("input-error"),
    summaryLine: resolveElement("summary-line"),
    globalWarnings: resolveElement("global-warnings"),
    caseMeta: resolveElement("case-meta", "selection-meta"),
    caseWarnings: resolveElement("case-warnings"),
    caseSummaryWrap: resolveElement("case-summary-wrap", "diagnostics-box"),
    resultTableWrap: resolveElement("result-table-wrap"),
    selectionMeta: resolveElement("selection-meta"),
    clearSelection: resolveElement("clear-selection"),
    orderTableWrap: resolveElement("order-table-wrap"),
    chartWrap: resolveElement("chart-wrap"),
    modeChartWrap: resolveElement("mode-chart-wrap")
  };

  function compactNumber(text) {
    const value = Number(text);
    if (!Number.isFinite(value)) {
      return text;
    }
    const magnitude = Math.max(Math.abs(value), 1e-12);
    if (magnitude >= 1e4 || magnitude < 1e-4) {
      return value.toExponential(5);
    }
    return value.toFixed(8).replace(/\.?0+$/, "");
  }

  function formatRelative(text) {
    if (text === null || text === undefined || text === "") {
      return "—";
    }
    return compactNumber(text);
  }

  function clampInteger(value, minimum) {
    if (!Number.isFinite(value)) {
      return minimum;
    }
    return Math.max(minimum, Math.floor(value));
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;");
  }

  function nodePrecedence(node) {
    if (node.kind === "binary") {
      if (node.op === "+" || node.op === "-") {
        return 1;
      }
      if (node.op === "*" || node.op === "/") {
        return 2;
      }
      if (node.op === "^") {
        return 3;
      }
    }
    if (node.kind === "unary") {
      return 4;
    }
    return 5;
  }

  function wrapMath(html, required) {
    return required ? `<span class="math-group">(${html})</span>` : html;
  }

  function renderMathNode(node, parentPrecedence, rightBranch) {
    if (node.kind === "number") {
      return escapeHtml(node.value);
    }
    if (node.kind === "identifier") {
      return escapeHtml(node.name);
    }
    if (node.kind === "call") {
      return `<span class="math-fn">${escapeHtml(node.name)}</span><span class="math-group">(${node.args.map((arg) => renderMathNode(arg, 0, false)).join(", ")})</span>`;
    }
    if (node.kind === "unary") {
      const body = `${escapeHtml(node.op)}${renderMathNode(node.arg, 4, false)}`;
      return wrapMath(body, nodePrecedence(node) < parentPrecedence);
    }
    if (node.kind === "binary") {
      const own = nodePrecedence(node);
      const left = renderMathNode(node.left, node.op === "^" ? own : own + (node.op === "/" ? 1 : 0), false);
      const right = renderMathNode(node.right, node.op === "^" ? own : own + (node.op === "-" || node.op === "/" ? 1 : 0), true);
      let body = "";
      if (node.op === "/") {
        body = `<span class="math-frac"><span class="math-frac-top">${left}</span><span class="math-frac-bottom">${right}</span></span>`;
      } else if (node.op === "^") {
        body = `<span class="math-power">${left}<sup>${right}</sup></span>`;
      } else if (node.op === "*") {
        body = `${left} <span>&middot;</span> ${right}`;
      } else {
        body = `${left} <span>${escapeHtml(node.op)}</span> ${right}`;
      }
      const needWrap = own < parentPrecedence || (rightBranch && node.op === "^" && own <= parentPrecedence);
      return wrapMath(body, needWrap);
    }
    return "";
  }

  function renderExpressionPreview(text, container) {
    const value = text.trim();
    if (!value) {
      container.className = "formula-preview-box invalid";
      container.innerHTML = `<div class="math-error">Введите аналитическое выражение.</div>`;
      return null;
    }
    try {
      const ast = App.Parser.parseExpression(value);
      container.className = "formula-preview-box";
      container.innerHTML = `<div class="math-view">${renderMathNode(ast, 0, false)}</div>`;
      return ast;
    } catch (error) {
      container.className = "formula-preview-box invalid";
      container.innerHTML = `<div class="math-error">${escapeHtml(error.message || String(error))}</div>`;
      return { error };
    }
  }

  function renderFormulaHelp() {
    elements.formulaHelp.innerHTML = helpItems
      .map(
        (item) => `
          <div class="help-item">
            <code>${escapeHtml(item.expr)}</code>
            <div>${escapeHtml(item.text)}</div>
          </div>
        `
      )
      .join("");
  }

  function openHelpDialog() {
    if (elements.helpDialog.open) {
      return;
    }
    if (typeof elements.helpDialog.showModal === "function") {
      elements.helpDialog.showModal();
      return;
    }
    elements.helpDialog.setAttribute("open", "open");
  }

  function closeHelpDialog() {
    if (!elements.helpDialog.open && !elements.helpDialog.hasAttribute("open")) {
      return;
    }
    if (typeof elements.helpDialog.close === "function") {
      elements.helpDialog.close();
      return;
    }
    elements.helpDialog.removeAttribute("open");
  }

  function setStatus(text) {
    elements.statusLine.textContent = text;
  }

  function setProgress(completed, total) {
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    elements.progressBar.style.width = `${percent}%`;
    elements.progressText.textContent = `${percent}%`;
  }

  function showInputError(message) {
    elements.inputError.classList.remove("hidden");
    elements.inputError.textContent = message;
  }

  function clearInputError() {
    elements.inputError.classList.add("hidden");
    elements.inputError.textContent = "";
  }

  function uniqueWarnings(items) {
    return Array.from(new Set(items));
  }

  function renderWarningStack(container, warnings) {
    if (!warnings.length) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = warnings.map((warning) => `<div class="warning-item">${warning}</div>`).join("");
  }

  function setEmptyState(container, text, extraClass) {
    container.className = extraClass || container.className;
    container.classList.add("empty-state");
    container.textContent = text;
  }

  function createParameterRow(name, spec) {
    const row = document.createElement("div");
    row.className = "parameter-row";
    row.dataset.name = name;
    row.innerHTML = `
      <div class="parameter-row-top">
        <div class="parameter-name">${name}</div>
        <select class="param-mode">
          <option value="value">Фиксированное значение</option>
          <option value="range">Диапазон</option>
        </select>
      </div>
      <div class="parameter-controls">
        <label class="field">
          <span class="field-label">Значение</span>
          <input class="param-value" type="text">
        </label>
        <label class="field">
          <span class="field-label">Начало</span>
          <input class="param-start" type="text">
        </label>
        <label class="field">
          <span class="field-label">Конец</span>
          <input class="param-end" type="text">
        </label>
        <label class="field">
          <span class="field-label">Число точек</span>
          <input class="param-count" type="number" min="2" step="1">
        </label>
      </div>
    `;
    const mode = row.querySelector(".param-mode");
    const controls = row.querySelector(".parameter-controls");
    const valueInput = row.querySelector(".param-value");
    const startInput = row.querySelector(".param-start");
    const endInput = row.querySelector(".param-end");
    const countInput = row.querySelector(".param-count");
    mode.value = spec.mode || "value";
    valueInput.value = spec.value || "1";
    startInput.value = spec.start || "0";
    endInput.value = spec.end || "1";
    countInput.value = spec.count || 5;

    function syncVisibility() {
      const rangeMode = mode.value === "range";
      controls.classList.toggle("compact", !rangeMode);
      valueInput.closest(".field").style.display = rangeMode ? "none" : "grid";
      startInput.closest(".field").style.display = rangeMode ? "grid" : "none";
      endInput.closest(".field").style.display = rangeMode ? "grid" : "none";
      countInput.closest(".field").style.display = rangeMode ? "grid" : "none";
    }

    mode.addEventListener("change", syncVisibility);
    syncVisibility();
    return row;
  }

  function gatherParameterSpecs() {
    const rows = Array.from(elements.parameterList.querySelectorAll(".parameter-row"));
    const specs = {};
    for (const row of rows) {
      const name = row.dataset.name;
      const mode = row.querySelector(".param-mode").value;
      if (mode === "value") {
        specs[name] = {
          mode,
          value: row.querySelector(".param-value").value.trim()
        };
      } else {
        specs[name] = {
          mode,
          start: row.querySelector(".param-start").value.trim(),
          end: row.querySelector(".param-end").value.trim(),
          count: Number(row.querySelector(".param-count").value)
        };
      }
    }
    return specs;
  }

  function detectParameters(overrideSpecs, silent) {
    const fResult = renderExpressionPreview(elements.fExpression.value, elements.fPreview);
    const gResult = renderExpressionPreview(elements.gExpression.value, elements.gPreview);
    const firstError = fResult && fResult.error ? fResult.error : gResult && gResult.error ? gResult.error : null;
    if (firstError) {
      if (!silent) {
        showInputError(firstError.message || String(firstError));
      }
      return null;
    }
    clearInputError();
    try {
      const names = App.Parser.collectParameters([fResult, gResult]);
      const specMap = overrideSpecs || gatherParameterSpecs();
      elements.parameterList.innerHTML = "";
      if (!names.length) {
        elements.parameterList.innerHTML = `<div class="empty-state">Параметры, кроме r, не обнаружены.</div>`;
        return names;
      }
      for (const name of names) {
        const spec = specMap[name] || { mode: "value", value: "1", start: "0", end: "1", count: 5 };
        elements.parameterList.appendChild(createParameterRow(name, spec));
      }
      return names;
    } catch (error) {
      if (!silent) {
        showInputError(error.message || String(error));
      }
      return null;
    }
  }

  function scheduleMetricRefresh() {
    if (metricRefreshTimer) {
      clearTimeout(metricRefreshTimer);
    }
    const specMap = gatherParameterSpecs();
    metricRefreshTimer = setTimeout(() => {
      metricRefreshTimer = null;
      detectParameters(specMap, true);
    }, 220);
  }

  function syncAngularConstraints() {
    const perturbationType = elements.perturbationType.value;
    const ellMinimum = perturbationType === "electromagnetic" ? 1 : 0;
    const ell = clampInteger(Number(elements.ellInput.value), ellMinimum);
    const overtone = clampInteger(Number(elements.overtoneInput.value), 0);
    elements.ellInput.min = String(ellMinimum);
    elements.ellInput.value = String(ell);
    elements.overtoneInput.min = "0";
    elements.overtoneInput.max = String(ell);
    elements.overtoneInput.value = String(Math.min(overtone, ell));
  }

  function applyPreset(key) {
    const preset = presets[key] || presets.custom;
    const values = preset.values;
    elements.fExpression.value = values.fExpression;
    elements.gExpression.value = values.gExpression;
    elements.perturbationType.value = values.perturbationType;
    elements.ellInput.value = values.ell;
    elements.overtoneInput.value = values.overtoneMax;
    elements.orderInput.value = values.mainOrder;
    elements.precisionInput.value = values.precision;
    elements.spectralNodesInput.value = values.spectralNodes;
    elements.plotSamplesInput.value = values.plotSamples;
    elements.rMinInput.value = values.rMin;
    elements.rMaxInput.value = values.rMax;
    elements.horizonSamplesInput.value = values.horizonSamples;
    elements.peakSamplesInput.value = values.peakSamples;
    elements.showAllOrders.checked = values.showAllOrders !== false;
    syncAngularConstraints();
    detectParameters(values.parameterSpecs, true);
  }

  function collectConfig() {
    const names = detectParameters();
    if (!names) {
      throw new Error("Не удалось разобрать выражения метрики.");
    }
    syncAngularConstraints();
    const perturbationType = elements.perturbationType.value;
    const ellMinimum = perturbationType === "electromagnetic" ? 1 : 0;
    const ell = clampInteger(Number(elements.ellInput.value), ellMinimum);
    const overtoneMax = Math.min(clampInteger(Number(elements.overtoneInput.value), 0), ell);
    return {
      fExpression: elements.fExpression.value.trim(),
      gExpression: elements.gExpression.value.trim(),
      perturbationType,
      ell,
      overtoneMax,
      mainOrder: Number(elements.orderInput.value),
      showAllOrders: elements.showAllOrders.checked,
      precision: Number(elements.precisionInput.value),
      spectralNodes: Number(elements.spectralNodesInput.value),
      plotSamples: Number(elements.plotSamplesInput.value),
      rMin: elements.rMinInput.value.trim(),
      rMax: elements.rMaxInput.value.trim(),
      horizonSamples: Number(elements.horizonSamplesInput.value),
      peakSamples: Number(elements.peakSamplesInput.value),
      parameterSpecs: gatherParameterSpecs()
    };
  }

  function estimateCaseCount(config) {
    let total = 1;
    for (const spec of Object.values(config.parameterSpecs || {})) {
      if (spec.mode === "range") {
        total *= Math.max(2, Number(spec.count || 2));
      }
    }
    return total;
  }

  function workerStartupErrorText() {
    if (window.location.protocol === "file:") {
      return "Worker не запустился при открытии через file://. Если браузер блокирует запуск, откройте проект через локальный сервер: python -m http.server 8000 и затем http://localhost:8000.";
    }
    return "Не удалось запустить worker. Проверьте консоль браузера и повторите запуск.";
  }

  function createAppWorker() {
    const scriptUrl = new URL("app/worker/worker.js", window.location.href).href;
    if (window.location.protocol !== "file:") {
      return new Worker(scriptUrl);
    }
    const baseUrl = new URL("app/worker/", window.location.href).href;
    const bootstrap = `self.QNMAppWorkerBase=${JSON.stringify(baseUrl)};importScripts(${JSON.stringify(scriptUrl)});`;
    const blobUrl = URL.createObjectURL(new Blob([bootstrap], { type: "text/javascript" }));
    const instance = new Worker(blobUrl);
    instance.__blobUrl = blobUrl;
    return instance;
  }

  function disposeWorkerInstance(instance) {
    if (!instance) {
      return;
    }
    instance.terminate();
    if (instance.__blobUrl) {
      URL.revokeObjectURL(instance.__blobUrl);
    }
  }

  function stopWorker() {
    if (worker) {
      disposeWorkerInstance(worker);
      worker = null;
    }
  }

  function stopDetailWorker() {
    if (detailWorker) {
      disposeWorkerInstance(detailWorker);
      detailWorker = null;
    }
  }

  function resetOutput() {
    currentResult = null;
    lastRunConfig = null;
    flatRows = [];
    selectedRow = null;
    baseCaseIndex = null;
    elements.summaryLine.textContent = "Расчёт ещё не выполнялся.";
    elements.caseMeta.textContent = "Базовый случай ещё не построен.";
    renderWarningStack(elements.globalWarnings, []);
    renderWarningStack(elements.caseWarnings, []);
    setEmptyState(elements.caseSummaryWrap, "Сводка геометрии появится после расчёта.", "case-summary-grid");
    setEmptyState(elements.resultTableWrap, "Нет данных.", "table-wrap");
    setEmptyState(elements.orderTableWrap, "Выберите строку таблицы, чтобы сравнить порядок-за-порядком.", "table-wrap");
    setEmptyState(elements.chartWrap, "График потенциала появится сразу после расчёта базового случая.", "chart-wrap");
    setEmptyState(elements.modeChartWrap, "График мод появится после расчёта: для скана по параметру или по клику на обертон.", "chart-wrap");
    elements.selectionMeta.textContent = "Строка не выбрана.";
    elements.clearSelection.disabled = true;
  }

  function buildResultsTable(result) {
    const headers = [
      ...result.parameterNames.map((name) => `<th>${name}</th>`),
      "<th>n</th>",
      `<th>Re ω (WKB ${result.mainOrder})</th>`,
      `<th>Im ω (WKB ${result.mainOrder})</th>`,
      "<th>Предупреждения</th>"
    ];
    const body = flatRows
      .map(
        (row, index) => `
          <tr class="${selectedRow === index ? "selected-row" : ""}">
            ${result.parameterNames.map((name) => `<td>${compactNumber(row.caseData.params[name])}</td>`).join("")}
            <td><button class="table-row-button" type="button" data-row-index="${index}">${row.overtone.n}</button></td>
            <td><button class="table-row-button" type="button" data-row-index="${index}" title="${row.overtone.main.re}">${compactNumber(row.overtone.main.re)}</button></td>
            <td><button class="table-row-button" type="button" data-row-index="${index}" title="${row.overtone.main.im}">${compactNumber(row.overtone.main.im)}</button></td>
            <td>${row.caseData.warnings.length}</td>
          </tr>
        `
      )
      .join("");
    elements.resultTableWrap.className = "table-wrap";
    elements.resultTableWrap.innerHTML = `
      <table>
        <thead>
          <tr>${headers.join("")}</tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    `;
    elements.resultTableWrap.querySelectorAll(".table-row-button").forEach((button) => {
      button.addEventListener("click", () => selectRow(Number(button.dataset.rowIndex), true));
    });
  }

  function buildOrderTable(resultRow) {
    if (!currentResult.showAllOrders) {
      setEmptyState(elements.orderTableWrap, "Показ по порядкам отключён.", "table-wrap");
      return;
    }
    const wkbRows = resultRow.caseData.orders
      .map((order) => {
        const value = resultRow.overtone.orders[order];
        const diff = resultRow.overtone.orderAccuracy[order];
        return `
          <tr>
            <td>WKB ${order}</td>
            <td title="${value.re}">${compactNumber(value.re)}</td>
            <td title="${value.im}">${compactNumber(value.im)}</td>
            <td title="${diff || ""}">${formatRelative(diff)}</td>
          </tr>
        `;
      })
      .join("");
    const padeRows = (resultRow.overtone.pade || [])
      .map(
        (item) => `
          <tr>
            <td>${item.label}</td>
            <td title="${item.value.re}">${compactNumber(item.value.re)}</td>
            <td title="${item.value.im}">${compactNumber(item.value.im)}</td>
            <td title="${item.relativeToMain}">${formatRelative(item.relativeToMain)}</td>
          </tr>
        `
      )
      .join("");
    elements.orderTableWrap.className = "table-wrap";
    elements.orderTableWrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Схема</th>
            <th>Re ω</th>
            <th>Im ω</th>
            <th>Отн. отличие</th>
          </tr>
        </thead>
        <tbody>${wkbRows}${padeRows}</tbody>
      </table>
    `;
  }

  function buildCaseSummary(caseData) {
    const paramText = currentResult.parameterNames.map((name) => `${name}=${compactNumber(caseData.params[name])}`).join(", ");
    if (currentResult.cases.length > 1) {
      elements.caseMeta.textContent = `Базовый случай: ${paramText || "без дополнительных параметров"}`;
    } else {
      elements.caseMeta.textContent = paramText || "Параметров кроме r нет.";
    }
    renderWarningStack(elements.caseWarnings, caseData.warnings);
    elements.caseSummaryWrap.className = "case-summary-grid";
    elements.caseSummaryWrap.innerHTML = `
      <div class="summary-chip"><span>Горизонт</span><strong title="${caseData.horizon}">${compactNumber(caseData.horizon)}</strong></div>
      <div class="summary-chip"><span>Пик потенциала</span><strong title="${caseData.peak}">${compactNumber(caseData.peak)}</strong></div>
      <div class="summary-chip"><span>Спектральное окно Δ</span><strong title="${caseData.delta}">${compactNumber(caseData.delta)}</strong></div>
      <div class="summary-chip"><span>Стабильность</span><strong title="${caseData.stability}">${compactNumber(caseData.stability)}</strong></div>
    `;
  }

  function renderBaseCase(caseIndex) {
    if (!currentResult || !currentResult.cases[caseIndex]) {
      return;
    }
    baseCaseIndex = caseIndex;
    const caseData = currentResult.cases[caseIndex];
    buildCaseSummary(caseData);
    if (caseData.plot) {
      App.Chart.renderPotentialChart(elements.chartWrap, caseData.plot);
      return;
    }
    if (caseData.detailFailed) {
      setEmptyState(elements.chartWrap, "Не удалось построить график потенциала для базового случая.", "chart-wrap");
      return;
    }
    elements.chartWrap.className = "chart-wrap empty-state";
    elements.chartWrap.textContent = currentResult.cases.length > 1
      ? "Строится график потенциала для базового случая."
      : "Строится график потенциала.";
    requestCaseDetail(caseIndex);
  }

  function varyingParameterNames(result) {
    return result.parameterNames.filter((name) => {
      if (!result.cases.length) {
        return false;
      }
      const first = result.cases[0].params[name];
      return result.cases.some((caseData) => caseData.params[name] !== first);
    });
  }

  function renderModeScanChart() {
    if (!currentResult || currentResult.cases.length < 2) {
      setEmptyState(elements.modeChartWrap, "График мод доступен при скане параметра.", "chart-wrap");
      return;
    }
    const varying = varyingParameterNames(currentResult);
    if (varying.length !== 1) {
      setEmptyState(elements.modeChartWrap, "График мод строится только при скане одного параметра.", "chart-wrap");
      return;
    }
    const parameterName = varying[0];
    const rows = currentResult.cases
      .map((caseData) => ({
        x: Number(caseData.params[parameterName]),
        caseData
      }))
      .filter((item) => Number.isFinite(item.x))
      .sort((left, right) => left.x - right.x);
    if (rows.length < 2) {
      setEmptyState(elements.modeChartWrap, "Недостаточно точек для графика мод.", "chart-wrap");
      return;
    }
    const overtones = Array.from(new Set(rows[0].caseData.overtones.map((item) => item.n))).sort((left, right) => left - right);
    const branches = overtones
      .map((n) => ({
        n,
        re: rows.map((item) => Number(item.caseData.overtones.find((mode) => mode.n === n).main.re)),
        im: rows.map((item) => Number(item.caseData.overtones.find((mode) => mode.n === n).main.im))
      }))
      .filter((branch) => branch.re.every(Number.isFinite) && branch.im.every(Number.isFinite));
    if (!branches.length) {
      setEmptyState(elements.modeChartWrap, "Не удалось собрать ветви мод для графика.", "chart-wrap");
      return;
    }
    App.Chart.renderModeScanChart(elements.modeChartWrap, {
      parameterName,
      x: rows.map((item) => item.x),
      branches
    });
  }

  function renderOrderTrendChart(resultRow) {
    if (!resultRow) {
      setEmptyState(elements.modeChartWrap, "Выберите строку таблицы, чтобы построить график по порядкам WKB.", "chart-wrap");
      return;
    }
    const orders = resultRow.caseData.orders.map((order) => Number(order));
    const re = resultRow.caseData.orders.map((order) => Number(resultRow.overtone.orders[order].re));
    const im = resultRow.caseData.orders.map((order) => Number(resultRow.overtone.orders[order].im));
    if (!orders.every(Number.isFinite) || !re.every(Number.isFinite) || !im.every(Number.isFinite)) {
      setEmptyState(elements.modeChartWrap, "Не удалось построить график по порядкам WKB.", "chart-wrap");
      return;
    }
    App.Chart.renderOrderTrendChart(elements.modeChartWrap, {
      overtone: resultRow.overtone.n,
      orders,
      re,
      im
    });
  }

  function rebuildFlatRows() {
    flatRows = [];
    currentResult.cases.forEach((caseData, caseIndex) => {
      caseData.overtones.forEach((overtone, overtoneIndex) => {
        flatRows.push({
          caseIndex,
          overtoneIndex,
          caseData,
          overtone
        });
      });
    });
  }

  function requestCaseDetail(caseIndex) {
    const caseData = currentResult.cases[caseIndex];
    if (!caseData || caseData.detailLoaded || caseData.detailPending || caseData.detailFailed || !lastRunConfig) {
      return;
    }
    caseData.detailPending = true;
    if (caseIndex === baseCaseIndex) {
      elements.chartWrap.className = "chart-wrap empty-state";
      elements.chartWrap.textContent = "Догружается график потенциала для базового случая.";
    }
    stopDetailWorker();
    try {
      detailWorker = createAppWorker();
    } catch (error) {
      caseData.detailPending = false;
      caseData.warnings = uniqueWarnings(caseData.warnings.concat([workerStartupErrorText()]));
      if (selectedRow !== null) {
        selectRow(selectedRow, false);
      }
      return;
    }
    let ready = false;
    const startupTimer = setTimeout(() => {
      if (detailWorker && !ready) {
        caseData.detailPending = false;
        caseData.warnings = uniqueWarnings(caseData.warnings.concat([workerStartupErrorText()]));
        if (selectedRow !== null) {
          selectRow(selectedRow, false);
        }
        stopDetailWorker();
      }
    }, 3000);
    detailWorker.addEventListener("error", () => {
      clearTimeout(startupTimer);
      caseData.detailPending = false;
      caseData.warnings = uniqueWarnings(caseData.warnings.concat([workerStartupErrorText()]));
      if (selectedRow !== null) {
        selectRow(selectedRow, false);
      }
      stopDetailWorker();
    });
    detailWorker.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "ready") {
        ready = true;
        clearTimeout(startupTimer);
        return;
      }
      if (message.type === "detailDone" && message.caseIndex === caseIndex) {
        clearTimeout(startupTimer);
        currentResult.cases[caseIndex] = Object.assign({}, currentResult.cases[caseIndex], message.caseData, {
          detailLoaded: true,
          detailPending: false,
          detailFailed: false
        });
        rebuildFlatRows();
        if (baseCaseIndex === caseIndex) {
          renderBaseCase(caseIndex);
        }
        if (selectedRow !== null) {
          selectRow(selectedRow, false);
        }
        stopDetailWorker();
        return;
      }
      if (message.type === "detailError" && message.caseIndex === caseIndex) {
        clearTimeout(startupTimer);
        currentResult.cases[caseIndex].detailPending = false;
        currentResult.cases[caseIndex].detailLoaded = false;
        currentResult.cases[caseIndex].detailFailed = true;
        currentResult.cases[caseIndex].warnings = uniqueWarnings(
          currentResult.cases[caseIndex].warnings.concat([message.message])
        );
        if (baseCaseIndex === caseIndex) {
          buildCaseSummary(currentResult.cases[caseIndex]);
          setEmptyState(elements.chartWrap, "Не удалось построить график потенциала для базового случая.", "chart-wrap");
        }
        if (selectedRow !== null) {
          selectRow(selectedRow, false);
        }
        stopDetailWorker();
      }
    });
    detailWorker.postMessage({
      type: "detail",
      caseIndex,
      config: Object.assign({}, lastRunConfig, {
        precisionCheck: false,
        storePlots: true
      }),
      params: caseData.params
    });
  }

  function clearSelection() {
    selectedRow = null;
    if (currentResult) {
      buildResultsTable(currentResult);
    }
    elements.selectionMeta.textContent = "Строка не выбрана.";
    elements.clearSelection.disabled = true;
    setEmptyState(elements.orderTableWrap, "Выберите строку таблицы, чтобы сравнить порядки WKB и Padé.", "table-wrap");
    if (currentResult && currentResult.cases.length > 1) {
      renderModeScanChart();
    } else {
      setEmptyState(elements.modeChartWrap, "Щёлкните по строке таблицы, чтобы построить график моды по порядку WKB.", "chart-wrap");
    }
  }

  function selectRow(index, loadDetails) {
    if (selectedRow === index) {
      clearSelection();
      return;
    }
    selectedRow = index;
    buildResultsTable(currentResult);
    const row = flatRows[index];
    if (!row) {
      return;
    }
    elements.clearSelection.disabled = false;
    elements.selectionMeta.textContent = `Выбрано: n=${row.overtone.n}, Re ω=${compactNumber(row.overtone.main.re)}, Im ω=${compactNumber(row.overtone.main.im)}`;
    buildOrderTable(row);
    if (currentResult.cases.length < 2) {
      renderOrderTrendChart(row);
    }
  }

  function renderResult(result) {
    currentResult = result;
    currentResult.cases = currentResult.cases.map((caseData) =>
      Object.assign({}, caseData, { detailLoaded: Boolean(caseData.plot), detailPending: false, detailFailed: false })
    );
    rebuildFlatRows();
    elements.summaryLine.textContent = `Рассчитано наборов параметров: ${result.cases.length}; строк в таблице: ${flatRows.length}.`;
    renderWarningStack(elements.globalWarnings, uniqueWarnings(result.cases.flatMap((item) => item.warnings)));
    buildResultsTable(result);
    renderBaseCase(0);
    if (currentResult.cases.length > 1) {
      renderModeScanChart();
    }
    if (flatRows.length) {
      selectRow(0, false);
      return;
    }
    elements.selectionMeta.textContent = "Строка не выбрана.";
  }

  function runComputation() {
    clearInputError();
    let config;
    try {
      config = collectConfig();
    } catch (error) {
      showInputError(error.message || String(error));
      return;
    }
    stopWorker();
    stopDetailWorker();
    resetOutput();
    setStatus("Запуск worker и подготовка расчёта");
    setProgress(0, 1);
    lastRunConfig = Object.assign({}, config);
    const storePlots = estimateCaseCount(config) === 1;
    try {
      worker = createAppWorker();
    } catch (error) {
      setStatus("Ошибка запуска worker");
      showInputError(workerStartupErrorText());
      return;
    }
    let ready = false;
    const startupTimer = setTimeout(() => {
      if (worker && !ready) {
        setStatus("Worker не запустился");
        showInputError(workerStartupErrorText());
        stopWorker();
      }
    }, 3000);
    worker.addEventListener("error", () => {
      clearTimeout(startupTimer);
      setStatus("Ошибка запуска worker");
      showInputError(workerStartupErrorText());
      stopWorker();
    });
    worker.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "ready") {
        ready = true;
        clearTimeout(startupTimer);
        setStatus("Worker запущен, идёт расчёт");
        return;
      }
      if (message.type === "progress") {
        setStatus(`Обработано ${message.completed} из ${message.total}`);
        setProgress(message.completed, message.total);
        return;
      }
      if (message.type === "done") {
        clearTimeout(startupTimer);
        setStatus("Расчёт завершён");
        setProgress(1, 1);
        renderResult(message.result);
        stopWorker();
        return;
      }
      if (message.type === "error") {
        clearTimeout(startupTimer);
        setStatus("Расчёт завершился с ошибкой");
        showInputError(message.message);
        stopWorker();
      }
    });
    worker.postMessage({
      type: "run",
      config: Object.assign({}, config, {
        precisionCheck: false,
        storePlots
      })
    });
  }

  function populatePresetSelect() {
    elements.presetSelect.innerHTML = Object.entries(presets)
      .map(([key, preset]) => `<option value="${key}">${preset.label}</option>`)
      .join("");
  }

  function attachEvents() {
    elements.presetSelect.addEventListener("change", () => applyPreset(elements.presetSelect.value));
    elements.detectParameters.addEventListener("click", () => detectParameters(undefined, false));
    elements.runButton.addEventListener("click", runComputation);
    elements.perturbationType.addEventListener("change", syncAngularConstraints);
    elements.ellInput.addEventListener("input", syncAngularConstraints);
    elements.overtoneInput.addEventListener("input", syncAngularConstraints);
    elements.fExpression.addEventListener("input", scheduleMetricRefresh);
    elements.gExpression.addEventListener("input", scheduleMetricRefresh);
    elements.clearSelection.addEventListener("click", clearSelection);
    elements.openHelp.addEventListener("click", openHelpDialog);
    elements.closeHelp.addEventListener("click", closeHelpDialog);
    elements.helpDialog.addEventListener("click", (event) => {
      if (event.target === elements.helpDialog) {
        closeHelpDialog();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderFormulaHelp();
    populatePresetSelect();
    attachEvents();
    applyPreset("schwarzschild");
    elements.clearSelection.disabled = true;
    if (window.location.protocol === "file:") {
      setStatus("Открыт локальный файл; worker запускается в совместимом режиме");
    }
  });
})();
