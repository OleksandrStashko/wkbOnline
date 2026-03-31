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
        plotSamples: 61,
        rMin: "0.8",
        rMax: "30",
        horizonSamples: 320,
        peakSamples: 420,
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
        plotSamples: 61,
        rMin: "0.8",
        rMax: "30",
        horizonSamples: 320,
        peakSamples: 420,
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
        plotSamples: 61,
        rMin: "0.6",
        rMax: "35",
        horizonSamples: 360,
        peakSamples: 460,
        parameterSpecs: {
          M: { mode: "value", value: "1" },
          Q: { mode: "value", value: "0.4" }
        }
      }
    }
  };

  let worker = null;
  let detailWorker = null;
  let currentResult = null;
  let flatRows = [];
  let selectedRow = null;
  let lastRunConfig = null;

  function $(id) {
    return document.getElementById(id);
  }

  const elements = {
    presetSelect: $("preset-select"),
    fExpression: $("f-expression"),
    gExpression: $("g-expression"),
    perturbationType: $("perturbation-type"),
    ellInput: $("ell-input"),
    overtoneInput: $("overtone-input"),
    orderInput: $("order-input"),
    showAllOrders: $("show-all-orders"),
    precisionInput: $("precision-input"),
    spectralNodesInput: $("spectral-nodes-input"),
    plotSamplesInput: $("plot-samples-input"),
    rMinInput: $("r-min-input"),
    rMaxInput: $("r-max-input"),
    horizonSamplesInput: $("horizon-samples-input"),
    peakSamplesInput: $("peak-samples-input"),
    detectParameters: $("detect-parameters"),
    parameterList: $("parameter-list"),
    runButton: $("run-button"),
    statusLine: $("status-line"),
    progressBar: $("progress-bar"),
    progressText: $("progress-text"),
    inputError: $("input-error"),
    summaryLine: $("summary-line"),
    globalWarnings: $("global-warnings"),
    resultTableWrap: $("result-table-wrap"),
    selectionMeta: $("selection-meta"),
    caseWarnings: $("case-warnings"),
    diagnosticsBox: $("diagnostics-box"),
    orderTableWrap: $("order-table-wrap"),
    chartWrap: $("chart-wrap")
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

  function detectParameters(overrideSpecs) {
    clearInputError();
    try {
      const fAst = App.Parser.parseExpression(elements.fExpression.value.trim());
      const gAst = App.Parser.parseExpression(elements.gExpression.value.trim());
      const names = App.Parser.collectParameters([fAst, gAst]);
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
      showInputError(error.message || String(error));
      return null;
    }
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
    detectParameters(values.parameterSpecs);
  }

  function collectConfig() {
    const names = detectParameters();
    if (!names) {
      throw new Error("Не удалось разобрать выражения метрики.");
    }
    return {
      fExpression: elements.fExpression.value.trim(),
      gExpression: elements.gExpression.value.trim(),
      perturbationType: elements.perturbationType.value,
      ell: Number(elements.ellInput.value),
      overtoneMax: Number(elements.overtoneInput.value),
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

  function workerStartupErrorText() {
    if (window.location.protocol === "file:") {
      return "Worker не запустился при открытии через file://. Если браузер продолжит блокировать запуск, откройте папку проекта через локальный сервер: python -m http.server 8000, затем перейдите на http://localhost:8000.";
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
    elements.summaryLine.textContent = "Идёт расчёт.";
    renderWarningStack(elements.globalWarnings, []);
    renderWarningStack(elements.caseWarnings, []);
    elements.resultTableWrap.className = "table-wrap empty-state";
    elements.resultTableWrap.textContent = "Идёт расчёт.";
    elements.orderTableWrap.className = "table-wrap empty-state";
    elements.orderTableWrap.textContent = "Нет данных по порядкам.";
    elements.diagnosticsBox.className = "diagnostics-box empty-state";
    elements.diagnosticsBox.textContent = "Нет диагностических данных.";
    elements.chartWrap.className = "chart-wrap empty-state";
    elements.chartWrap.textContent = "График станет доступен после расчёта.";
    elements.selectionMeta.textContent = "Строка не выбрана.";
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
      button.addEventListener("click", () => selectRow(Number(button.dataset.rowIndex)));
    });
  }

  function buildOrderTable(resultRow) {
    const rows = resultRow.caseData.orders
      .map((order) => {
        const value = resultRow.overtone.orders[order];
        return `
          <tr>
            <td>${order}</td>
            <td title="${value.re}">${compactNumber(value.re)}</td>
            <td title="${value.im}">${compactNumber(value.im)}</td>
          </tr>
        `;
      })
      .join("");
    elements.orderTableWrap.className = "table-wrap";
    elements.orderTableWrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Порядок</th>
            <th>Re ω</th>
            <th>Im ω</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function buildDiagnostics(caseData, resultRow) {
    elements.diagnosticsBox.className = "diagnostics-box";
    elements.diagnosticsBox.innerHTML = `
      <div class="diagnostic-row"><span>Горизонт</span><strong title="${caseData.horizon || ""}">${compactNumber(caseData.horizon || "ожидание")}</strong></div>
      <div class="diagnostic-row"><span>Пик потенциала</span><strong title="${caseData.peak || ""}">${compactNumber(caseData.peak || "ожидание")}</strong></div>
      <div class="diagnostic-row"><span>Спектральное окно Δ</span><strong title="${caseData.delta || ""}">${compactNumber(caseData.delta || "ожидание")}</strong></div>
      <div class="diagnostic-row"><span>Стабильность производных</span><strong title="${caseData.stability || ""}">${compactNumber(caseData.stability || "ожидание")}</strong></div>
      <div class="diagnostic-row"><span>Хвост спектра</span><strong title="${caseData.tailRatio || ""}">${compactNumber(caseData.tailRatio || "ожидание")}</strong></div>
      <div class="diagnostic-row"><span>Чувствительность к точности</span><strong title="${caseData.precisionSensitivity || "ожидание"}">${caseData.detailPending ? "вычисляется" : compactNumber(caseData.precisionSensitivity || "ожидание")}</strong></div>
      <div class="diagnostic-row"><span>Обертон</span><strong>${resultRow.overtone.n}</strong></div>
    `;
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
    if (!caseData || caseData.detailLoaded || caseData.detailPending || !lastRunConfig) {
      return;
    }
    caseData.detailPending = true;
    if (selectedRow !== null) {
      buildDiagnostics(caseData, flatRows[selectedRow]);
    }
    elements.chartWrap.className = "chart-wrap empty-state";
    elements.chartWrap.textContent = "Догружаются подробности выбранного случая.";
    elements.orderTableWrap.className = "table-wrap empty-state";
    elements.orderTableWrap.textContent = "Догружается полная диагностическая информация.";
    stopDetailWorker();
    try {
      detailWorker = createAppWorker();
    } catch (error) {
      caseData.detailPending = false;
      caseData.warnings = uniqueWarnings(caseData.warnings.concat([workerStartupErrorText()]));
      if (selectedRow !== null) {
        selectRow(selectedRow);
      }
      return;
    }
    let ready = false;
    const startupTimer = setTimeout(() => {
      if (detailWorker && !ready) {
        caseData.detailPending = false;
        caseData.warnings = uniqueWarnings(caseData.warnings.concat([workerStartupErrorText()]));
        if (selectedRow !== null) {
          selectRow(selectedRow);
        }
        stopDetailWorker();
      }
    }, 3000);
    detailWorker.addEventListener("error", () => {
      clearTimeout(startupTimer);
      caseData.detailPending = false;
      caseData.warnings = uniqueWarnings(caseData.warnings.concat([workerStartupErrorText()]));
      if (selectedRow !== null) {
        selectRow(selectedRow);
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
          detailPending: false
        });
        rebuildFlatRows();
        if (selectedRow !== null) {
          selectRow(selectedRow);
        }
        stopDetailWorker();
        return;
      }
      if (message.type === "detailError" && message.caseIndex === caseIndex) {
        clearTimeout(startupTimer);
        currentResult.cases[caseIndex].detailPending = false;
        currentResult.cases[caseIndex].detailLoaded = false;
        currentResult.cases[caseIndex].warnings = uniqueWarnings(
          currentResult.cases[caseIndex].warnings.concat([message.message])
        );
        if (selectedRow !== null) {
          selectRow(selectedRow);
        }
        stopDetailWorker();
      }
    });
    detailWorker.postMessage({
      type: "detail",
      caseIndex,
      config: Object.assign({}, lastRunConfig, {
        precisionCheck: true,
        storePlots: true
      }),
      params: caseData.params
    });
  }

  function selectRow(index) {
    selectedRow = index;
    buildResultsTable(currentResult);
    const row = flatRows[index];
    if (!row) {
      return;
    }
    elements.selectionMeta.textContent = `Параметры: ${currentResult.parameterNames.map((name) => `${name}=${compactNumber(row.caseData.params[name])}`).join(", ")}; n=${row.overtone.n}`;
    renderWarningStack(elements.caseWarnings, row.caseData.warnings);
    buildDiagnostics(row.caseData, row);
    if (currentResult.showAllOrders && row.caseData.detailLoaded) {
      buildOrderTable(row);
    } else if (currentResult.showAllOrders) {
      elements.orderTableWrap.className = "table-wrap empty-state";
      elements.orderTableWrap.textContent = "Подробные данные по порядкам догружаются для выбранного случая.";
    } else {
      elements.orderTableWrap.className = "table-wrap empty-state";
      elements.orderTableWrap.textContent = "Показ по порядкам отключён.";
    }
    if (row.caseData.detailLoaded) {
      App.Chart.renderPotentialChart(elements.chartWrap, row.caseData.plot);
    }
    requestCaseDetail(row.caseIndex);
  }

  function renderResult(result) {
    currentResult = result;
    currentResult.cases = currentResult.cases.map((caseData) => Object.assign({}, caseData, { detailLoaded: false, detailPending: false }));
    rebuildFlatRows();
    elements.summaryLine.textContent = `Рассчитано наборов параметров: ${result.cases.length}; строк в таблице: ${flatRows.length}.`;
    renderWarningStack(elements.globalWarnings, uniqueWarnings(result.cases.flatMap((item) => item.warnings)));
    buildResultsTable(result);
    if (flatRows.length) {
      selectRow(0);
    }
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
        storePlots: false
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
    elements.detectParameters.addEventListener("click", () => detectParameters());
    elements.runButton.addEventListener("click", runComputation);
  }

  document.addEventListener("DOMContentLoaded", () => {
    populatePresetSelect();
    attachEvents();
    applyPreset("schwarzschild");
    if (window.location.protocol === "file:") {
      setStatus("Открыт локальный файл; worker запускается в совместимом режиме");
    }
  });
})();
