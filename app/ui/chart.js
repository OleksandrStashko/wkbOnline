(function () {
  const App = self.QNMApp;

  function extent(values) {
    let min = Infinity;
    let max = -Infinity;
    for (const value of values) {
      if (Number.isFinite(value)) {
        if (value < min) {
          min = value;
        }
        if (value > max) {
          max = value;
        }
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return null;
    }
    return { min, max };
  }

  function formatTick(value) {
    if (!Number.isFinite(value)) {
      return "";
    }
    const magnitude = Math.max(Math.abs(value), 1e-12);
    if (magnitude >= 1e4 || magnitude < 1e-3) {
      return value.toExponential(3);
    }
    return value.toFixed(6).replace(/\.?0+$/, "");
  }

  function buildTicks(min, max, count) {
    const ticks = [];
    const total = Math.max(2, count);
    if (max === min) {
      for (let index = 0; index < total; index += 1) {
        ticks.push(min);
      }
      return ticks;
    }
    const step = (max - min) / (total - 1);
    for (let index = 0; index < total; index += 1) {
      ticks.push(min + step * index);
    }
    return ticks;
  }

  function percentile(sortedValues, fraction) {
    if (!sortedValues.length) {
      return null;
    }
    const clamped = Math.min(1, Math.max(0, fraction));
    const position = (sortedValues.length - 1) * clamped;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) {
      return sortedValues[lower];
    }
    const weight = position - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  function robustExtent(values) {
    const finite = values.filter(Number.isFinite).slice().sort((left, right) => left - right);
    if (!finite.length) {
      return null;
    }
    if (finite.length < 12) {
      return extent(finite);
    }
    const low = percentile(finite, 0.02);
    const high = percentile(finite, 0.98);
    if (!Number.isFinite(low) || !Number.isFinite(high) || low === high) {
      return extent(finite);
    }
    return { min: low, max: high };
  }

  function palette(index) {
    const colors = [
      "#0e6670",
      "#c08b2c",
      "#a33f2f",
      "#297a4d",
      "#6a4fb3",
      "#9a5d16",
      "#1d5f9b",
      "#a34774"
    ];
    return colors[index % colors.length];
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function nearestIndex(values, target) {
    let best = 0;
    let distance = Infinity;
    for (let index = 0; index < values.length; index += 1) {
      const current = Math.abs(values[index] - target);
      if (current < distance) {
        distance = current;
        best = index;
      }
    }
    return best;
  }

  function renderLineChart(container, config) {
    const width = 980;
    const height = 380;
    const margin = config.compact ? { top: 18, right: 22, bottom: 58, left: 92 } : { top: 30, right: 28, bottom: 64, left: 110 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const normalizedSeries = config.series.map((item) => ({
      ...item,
      xValues: item.xValues || config.x || []
    }));
    const xExtent = extent(normalizedSeries.flatMap((item) => item.xValues));
    const yExtent = config.robustRange ? robustExtent(normalizedSeries.flatMap((item) => item.values)) : extent(normalizedSeries.flatMap((item) => item.values));
    if (!xExtent || !yExtent) {
      container.className = "chart-wrap empty-state";
      container.textContent = config.emptyText || "Not enough data are available for the plot.";
      return;
    }
    const xPadding = (xExtent.max - xExtent.min || 1) * 0.02;
    const yPadding = (yExtent.max - yExtent.min || 1) * 0.08;
    const baseXMin = xExtent.min;
    const baseXMax = xExtent.max;
    const baseYMin = yExtent.min - yPadding;
    const baseYMax = yExtent.max + yPadding;
    const defaultXMin = Number.isFinite(config.initialXMin) ? config.initialXMin : baseXMin;
    const defaultXMax = Number.isFinite(config.initialXMax) ? config.initialXMax : baseXMax;
    const defaultYMin = Number.isFinite(config.initialYMin) ? config.initialYMin : baseYMin;
    const defaultYMax = Number.isFinite(config.initialYMax) ? config.initialYMax : baseYMax;
    const outerFactor = Number.isFinite(config.outerRangeFactor) ? Math.max(1.5, config.outerRangeFactor) : 8;
    const defaultXSpan = defaultXMax - defaultXMin || 1;
    const defaultYSpan = defaultYMax - defaultYMin || 1;
    const outerXMin = Number.isFinite(config.outerXMin) ? config.outerXMin : Math.min(baseXMin, defaultXMin) - Math.max(defaultXSpan, baseXMax - baseXMin || 1) * (outerFactor - 1) * 0.5 - xPadding;
    const outerXMax = Number.isFinite(config.outerXMax) ? config.outerXMax : Math.max(baseXMax, defaultXMax) + Math.max(defaultXSpan, baseXMax - baseXMin || 1) * (outerFactor - 1) * 0.5 + xPadding;
    const outerYMin = Number.isFinite(config.outerYMin) ? config.outerYMin : Math.min(baseYMin, defaultYMin) - Math.max(defaultYSpan, baseYMax - baseYMin || 1) * (outerFactor - 1) * 0.5;
    const outerYMax = Number.isFinite(config.outerYMax) ? config.outerYMax : Math.max(baseYMax, defaultYMax) + Math.max(defaultYSpan, baseYMax - baseYMin || 1) * (outerFactor - 1) * 0.5;
    let viewXMin = defaultXMin;
    let viewXMax = defaultXMax;
    let viewYMin = defaultYMin;
    let viewYMax = defaultYMax;
    const xScale = (value) => margin.left + ((value - viewXMin) / (viewXMax - viewXMin || 1)) * innerWidth;
    const yScale = (value) => margin.top + innerHeight - ((value - viewYMin) / (viewYMax - viewYMin || 1)) * innerHeight;
    const xFromPixel = (pixel) => viewXMin + ((Math.min(margin.left + innerWidth, Math.max(margin.left, pixel)) - margin.left) / innerWidth) * (viewXMax - viewXMin || 1);
    const yFromPixel = (pixel) => viewYMax - ((Math.min(margin.top + innerHeight, Math.max(margin.top, pixel)) - margin.top) / innerHeight) * (viewYMax - viewYMin || 1);
    const title = config.title ? `<div class="chart-title">${config.title}</div>` : "";
    const showLegend = config.showLegend !== false && config.series.length > 1;
    const clipId = `chart-clip-${Math.random().toString(36).slice(2)}`;
    container.className = "chart-wrap interactive-chart";
    container.innerHTML = `
      ${title}
      ${showLegend ? '<div class="chart-legend interactive-legend"></div>' : ""}
      <div class="chart-stage">
        <button type="button" class="chart-reset hidden">Reset view</button>
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${config.ariaLabel}"></svg>
        <div class="chart-tooltip hidden"></div>
      </div>
    `;
    const svg = container.querySelector("svg");
    const legend = container.querySelector(".chart-legend");
    const stage = container.querySelector(".chart-stage");
    const tooltip = container.querySelector(".chart-tooltip");
    const resetButton = container.querySelector(".chart-reset");
    const visibility = normalizedSeries.map(() => true);
    let activeXValue = null;
    let panState = null;

    const resetView = () => {
      viewXMin = defaultXMin;
      viewXMax = defaultXMax;
      viewYMin = defaultYMin;
      viewYMax = defaultYMax;
      activeXValue = null;
      tooltip.classList.add("hidden");
      renderSvg();
    };

    const buildLegend = () => {
      if (!showLegend || !legend) {
        return;
      }
      legend.innerHTML = normalizedSeries
        .map(
          (series, seriesIndex) => `
            <button type="button" class="chart-legend-button${visibility[seriesIndex] ? "" : " muted"}" data-series-index="${seriesIndex}">
              <span class="chart-legend-swatch" style="background:${series.color}"></span>
              <span>${escapeHtml(series.label)}</span>
            </button>
          `
        )
        .join("");
      legend.querySelectorAll(".chart-legend-button").forEach((button) => {
        button.addEventListener("click", () => {
          const index = Number(button.getAttribute("data-series-index"));
          if (visibility.filter(Boolean).length === 1 && visibility[index]) {
            return;
          }
          visibility[index] = !visibility[index];
          renderSvg();
          buildLegend();
        });
      });
    };

    const buildPath = (series) =>
      series.xValues
        .map((xValue, pointIndex) => {
          const yValue = series.values[pointIndex];
          return `${pointIndex === 0 ? "M" : "L"} ${xScale(xValue).toFixed(2)} ${yScale(yValue).toFixed(2)}`;
        })
        .join(" ");

    const updateTooltip = (xValue, clientX, clientY) => {
      const visibleSeries = normalizedSeries.filter((_, seriesIndex) => visibility[seriesIndex]);
      if (!visibleSeries.length) {
        tooltip.classList.add("hidden");
        return;
      }
      const lines = visibleSeries
        .slice(0, 8)
        .map((series) => {
          const index = nearestIndex(series.xValues, xValue);
          return `<div><span class="tooltip-key">${escapeHtml(series.label)}</span><strong>${formatTick(series.values[index])}</strong></div>`;
        })
        .join("");
      const more = visibleSeries.length > 8 ? `<div class="tooltip-more">+ ${visibleSeries.length - 8} more series</div>` : "";
      tooltip.innerHTML = `<div class="tooltip-title">${escapeHtml(config.xLabel)} = ${formatTick(xValue)}</div>${lines}${more}`;
      tooltip.classList.remove("hidden");
      const bounds = stage.getBoundingClientRect();
      const tooltipBounds = tooltip.getBoundingClientRect();
      let left = clientX - bounds.left + 16;
      let top = clientY - bounds.top + 16;
      if (left + tooltipBounds.width > bounds.width - 12) {
        left = Math.max(12, left - tooltipBounds.width - 32);
      }
      if (top + tooltipBounds.height > bounds.height - 12) {
        top = Math.max(12, top - tooltipBounds.height - 32);
      }
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    };

    const renderSvg = () => {
      const xTicks = buildTicks(viewXMin, viewXMax, 5);
      const yTicks = buildTicks(viewYMin, viewYMax, 5);
      const isResetView =
        Math.abs(viewXMin - defaultXMin) < 1e-12 &&
        Math.abs(viewXMax - defaultXMax) < 1e-12 &&
        Math.abs(viewYMin - defaultYMin) < 1e-12 &&
        Math.abs(viewYMax - defaultYMax) < 1e-12;
      const lines = normalizedSeries
        .map((series, seriesIndex) => visibility[seriesIndex] ? `<path class="chart-line chart-line-${seriesIndex}" stroke="${series.color}" d="${buildPath(series)}"></path>` : "")
        .join("");
      const markers = activeXValue === null
        ? ""
        : normalizedSeries
          .map((series, seriesIndex) => {
            if (!visibility[seriesIndex] || !series.xValues.length) {
              return "";
            }
            const index = nearestIndex(series.xValues, activeXValue);
            return `<circle class="chart-point" cx="${xScale(series.xValues[index]).toFixed(2)}" cy="${yScale(series.values[index]).toFixed(2)}" r="4.5" fill="${series.color}"></circle>`;
          })
          .join("");
      const cursorLine = activeXValue === null
        ? ""
        : `<line class="chart-cursor-line" x1="${xScale(activeXValue).toFixed(2)}" y1="${margin.top}" x2="${xScale(activeXValue).toFixed(2)}" y2="${margin.top + innerHeight}"></line>`;
      if (resetButton) {
        resetButton.classList.toggle("hidden", isResetView);
      }
      svg.innerHTML = `
        <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="rgba(255,255,255,0.42)"></rect>
        <defs>
          <clipPath id="${clipId}">
            <rect x="${margin.left}" y="${margin.top}" width="${innerWidth}" height="${innerHeight}" rx="12"></rect>
          </clipPath>
        </defs>
        ${xTicks
          .map(
            (tick) => `
              <line class="chart-grid" x1="${xScale(tick)}" y1="${margin.top}" x2="${xScale(tick)}" y2="${margin.top + innerHeight}"></line>
              <text class="chart-label" x="${xScale(tick)}" y="${height - 12}" text-anchor="middle">${formatTick(tick)}</text>
            `
          )
          .join("")}
        ${yTicks
          .map(
            (tick) => `
              <line class="chart-grid" x1="${margin.left}" y1="${yScale(tick)}" x2="${margin.left + innerWidth}" y2="${yScale(tick)}"></line>
              <text class="chart-label" x="${margin.left - 12}" y="${yScale(tick) + 4}" text-anchor="end">${formatTick(tick)}</text>
            `
          )
          .join("")}
        <line class="chart-axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + innerHeight}"></line>
        <line class="chart-axis" x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${margin.left + innerWidth}" y2="${margin.top + innerHeight}"></line>
        ${cursorLine}
        <g clip-path="url(#${clipId})">
          ${lines}
          ${markers}
        </g>
        <rect class="chart-hit-area" x="${margin.left - 44}" y="${margin.top - 18}" width="${innerWidth + 64}" height="${innerHeight + 44}" fill="transparent"></rect>
        <text class="chart-label" x="${width / 2}" y="${height - 4}" text-anchor="middle">${config.xLabel}</text>
        <text class="chart-label" x="18" y="${height / 2}" transform="rotate(-90 18 ${height / 2})" text-anchor="middle">${config.yLabel}</text>
      `;
      const hitArea = svg.querySelector(".chart-hit-area");
      hitArea.addEventListener("mousemove", (event) => {
        if (panState) {
          return;
        }
        const bounds = svg.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width) * width;
        activeXValue = xFromPixel(x);
        renderSvg();
        updateTooltip(activeXValue, event.clientX, event.clientY);
      });
      hitArea.addEventListener("wheel", (event) => {
        event.preventDefault();
        const bounds = svg.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width) * width;
        const y = ((event.clientY - bounds.top) / bounds.height) * height;
        const anchorX = xFromPixel(x);
        const anchorY = yFromPixel(y);
        const factor = event.deltaY < 0 ? 0.88 : 1.14;
        const xSpan = viewXMax - viewXMin;
        const ySpan = viewYMax - viewYMin;
        const nextXSpan = Math.min(outerXMax - outerXMin, Math.max((baseXMax - baseXMin || 1) / 4000, xSpan * factor));
        const nextYSpan = Math.min(outerYMax - outerYMin, Math.max((baseYMax - baseYMin || 1) / 4000, ySpan * factor));
        const xRatio = xSpan === 0 ? 0.5 : (anchorX - viewXMin) / xSpan;
        const yRatio = ySpan === 0 ? 0.5 : (anchorY - viewYMin) / ySpan;
        viewXMin = anchorX - nextXSpan * xRatio;
        viewXMax = viewXMin + nextXSpan;
        viewYMin = anchorY - nextYSpan * yRatio;
        viewYMax = viewYMin + nextYSpan;
        if (viewXMin < outerXMin) {
          viewXMax += outerXMin - viewXMin;
          viewXMin = outerXMin;
        }
        if (viewXMax > outerXMax) {
          viewXMin -= viewXMax - outerXMax;
          viewXMax = outerXMax;
        }
        if (viewYMin < outerYMin) {
          viewYMax += outerYMin - viewYMin;
          viewYMin = outerYMin;
        }
        if (viewYMax > outerYMax) {
          viewYMin -= viewYMax - outerYMax;
          viewYMax = outerYMax;
        }
        activeXValue = anchorX;
        renderSvg();
        updateTooltip(activeXValue, event.clientX, event.clientY);
      }, { passive: false });
      hitArea.addEventListener("mousedown", (event) => {
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        panState = {
          x: event.clientX,
          y: event.clientY,
          xMin: viewXMin,
          xMax: viewXMax,
          yMin: viewYMin,
          yMax: viewYMax
        };
        tooltip.classList.add("hidden");
        const onMove = (moveEvent) => {
          if (!panState) {
            return;
          }
          const xShift = ((moveEvent.clientX - panState.x) / innerWidth) * (panState.xMax - panState.xMin);
          const yShift = ((moveEvent.clientY - panState.y) / innerHeight) * (panState.yMax - panState.yMin);
          viewXMin = panState.xMin - xShift;
          viewXMax = panState.xMax - xShift;
          viewYMin = panState.yMin + yShift;
          viewYMax = panState.yMax + yShift;
          if (viewXMin < outerXMin) {
            viewXMax += outerXMin - viewXMin;
            viewXMin = outerXMin;
          }
          if (viewXMax > outerXMax) {
            viewXMin -= viewXMax - outerXMax;
            viewXMax = outerXMax;
          }
          if (viewYMin < outerYMin) {
            viewYMax += outerYMin - viewYMin;
            viewYMin = outerYMin;
          }
          if (viewYMax > outerYMax) {
            viewYMin -= viewYMax - outerYMax;
            viewYMax = outerYMax;
          }
          renderSvg();
        };
        const onUp = () => {
          panState = null;
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
      hitArea.addEventListener("mouseleave", () => {
        if (!panState) {
          activeXValue = null;
          tooltip.classList.add("hidden");
          renderSvg();
        }
      });
      hitArea.addEventListener("dblclick", (event) => {
        event.preventDefault();
        resetView();
      });
    };

    if (resetButton) {
      resetButton.addEventListener("click", resetView);
    }
    if (showLegend) {
      buildLegend();
    }
    renderSvg();
  }

  function renderPotentialChart(container, plotData) {
    if (!plotData) {
      container.className = "chart-wrap empty-state";
      container.textContent = "The potential plot is not available for the selected case.";
      return;
    }
    const x = plotData.x.map((value) => Number(value));
    const y = plotData.potential.map((value) => Number(value));
    if (!x.every(Number.isFinite) || !y.every(Number.isFinite)) {
      container.className = "chart-wrap empty-state";
      container.textContent = "Could not build the potential plot because the data contain invalid numbers.";
      return;
    }
    renderLineChart(container, {
      x,
      series: [{ label: "V(r)", values: y, color: "#0e6670" }],
      xLabel: plotData.xLabel || "r",
      yLabel: plotData.yLabel || "V(r)",
      ariaLabel: "Effective potential plot"
    });
  }

  function renderMetricFunctionsChart(container, plotData) {
    if (!plotData || !plotData.cases || !plotData.cases.length) {
      container.className = "chart-wrap empty-state";
      container.textContent = "The metric-function plot is not available for the selected case.";
      return;
    }
    const series = plotData.cases.flatMap((item, index) => {
      const x = item.plot.x.map((value) => Number(value));
      const f = item.plot.f.map((value) => Number(value));
      const g = item.plot.g.map((value) => Number(value));
      if (!x.every(Number.isFinite) || !f.every(Number.isFinite) || !g.every(Number.isFinite)) {
        return [];
      }
      const fLabel = plotData.cases.length > 1 ? `${item.label}: f(r)` : "f(r)";
      if (plotData.sameMetric) {
        return [{ label: fLabel, xValues: x, values: f, color: palette(index) }];
      }
      const gLabel = plotData.cases.length > 1 ? `${item.label}: g(r)` : "g(r)";
      return [
        { label: fLabel, xValues: x, values: f, color: palette(index * 2) },
        { label: gLabel, xValues: x, values: g, color: palette(index * 2 + 1) }
      ];
    });
    if (!series.length) {
      container.className = "chart-wrap empty-state";
      container.textContent = "Could not build the metric-function plot because the data contain invalid numbers.";
      return;
    }
    renderLineChart(container, {
      series,
      xLabel: "r",
      yLabel: "Metric functions",
      ariaLabel: "Metric functions versus radius",
      robustRange: true,
      compact: true,
      initialYMin: -1,
      initialYMax: 2,
      outerRangeFactor: 12
    });
  }

  function renderPotentialProfilesChart(container, plotData) {
    if (!plotData || !plotData.cases || !plotData.cases.length) {
      container.className = "chart-wrap empty-state";
      container.textContent = "The potential plot is not available for the selected case.";
      return;
    }
    const series = plotData.cases
      .map((item, index) => {
        const x = item.plot.x.map((value) => Number(value));
        const values = item.plot.potential.map((value) => Number(value));
        if (!x.every(Number.isFinite) || !values.every(Number.isFinite)) {
          return null;
        }
        return {
          label: plotData.cases.length > 1 ? item.label : "V(r)",
          xValues: x,
          values,
          color: palette(index)
        };
      })
      .filter(Boolean);
    if (!series.length) {
      container.className = "chart-wrap empty-state";
      container.textContent = "Could not build the potential plot because the data contain invalid numbers.";
      return;
    }
    renderLineChart(container, {
      series,
      xLabel: "r",
      yLabel: "V(r)",
      ariaLabel: "Effective potential plot",
      robustRange: true,
      compact: true
    });
  }

  function renderModeScanChart(container, data) {
    if (!data || !data.x || data.x.length < 2 || !data.branches || !data.branches.length) {
      container.className = "chart-wrap empty-state";
      container.textContent = "The mode plot is not available.";
      return;
    }
    const sourceLabel = data.sourceLabel || "WKB";
    container.className = "chart-stack";
    container.innerHTML = `
      <div class="chart-stack-panel"></div>
      <div class="chart-stack-panel"></div>
    `;
    const panels = container.querySelectorAll(".chart-stack-panel");
      renderLineChart(panels[0], {
        x: data.x,
      series: data.branches.map((branch, index) => ({
        label: `n=${branch.n}`,
        values: branch.re,
        color: palette(index)
      })),
      xLabel: data.parameterName,
      yLabel: "Re omega",
      ariaLabel: `Real part of the ${sourceLabel} quasinormal modes versus the scanned parameter`
    });
      renderLineChart(panels[1], {
        x: data.x,
      series: data.branches.map((branch, index) => ({
        label: `n=${branch.n}`,
        values: branch.im,
        color: palette(index)
      })),
      xLabel: data.parameterName,
      yLabel: "Im omega",
      ariaLabel: `Imaginary part of the ${sourceLabel} quasinormal modes versus the scanned parameter`
    });
  }

  function renderOrderTrendChart(container, data) {
    if (!data || !data.orders || data.orders.length < 1) {
      container.className = "chart-wrap empty-state";
      container.textContent = "The WKB-order plot is not available.";
      return;
    }
    container.className = "chart-stack";
    container.innerHTML = `
      <div class="chart-stack-panel"></div>
      <div class="chart-stack-panel"></div>
    `;
    const panels = container.querySelectorAll(".chart-stack-panel");
      renderLineChart(panels[0], {
        x: data.orders,
      series: [{ label: "Re omega", values: data.re, color: "#0e6670" }],
      xLabel: "WKB order",
      yLabel: "Re omega",
      ariaLabel: "Real part of the quasinormal mode versus WKB order"
    });
      renderLineChart(panels[1], {
        x: data.orders,
      series: [{ label: "Im omega", values: data.im, color: "#c08b2c" }],
      xLabel: "WKB order",
      yLabel: "Im omega",
      ariaLabel: "Imaginary part of the quasinormal mode versus WKB order"
    });
  }

  function renderGreybodyChart(container, data) {
    if (!data || !data.x || !data.curves || !data.curves.length) {
      container.className = "chart-wrap empty-state";
      container.textContent = "Greybody curves are not available.";
      return;
    }
    const x = data.x.map((value) => Number(value));
    const series = data.curves
      .map((curve, index) => ({
        label: curve.label || (curve.ell === data.selectedEll ? `ell=${curve.ell} (selected)` : `ell=${curve.ell}`),
        values: curve.values.map((value) => Number(value)),
        color: curve.ell === data.selectedEll ? "#a33f2f" : palette(index)
      }))
      .filter((item) => item.values.every(Number.isFinite));
    if (!x.every(Number.isFinite) || !series.length) {
      container.className = "chart-wrap empty-state";
      container.textContent = "Greybody curves contain invalid numbers.";
      return;
    }
    renderLineChart(container, {
      title: "Greybody factors from the WKB transmission coefficient",
      x,
      series,
      xLabel: "omega",
      yLabel: "T_l(omega)",
      ariaLabel: "Greybody factors versus frequency"
    });
  }

  function renderHawkingSpectrumChart(container, data) {
    if (!data || !data.x || !data.total || !data.total.length) {
      container.className = "chart-wrap empty-state";
      container.textContent = "The Hawking spectrum is not available.";
      return;
    }
    const x = data.x.map((value) => Number(value));
    const series = [{
      label: "Total spectrum",
      values: data.total.map((value) => Number(value)),
      color: "#a33f2f"
    }].concat(
      (data.partials || []).map((curve, index) => ({
        label: `ell=${curve.ell}`,
        values: curve.values.map((value) => Number(value)),
        color: palette(index)
      }))
    ).filter((item) => item.values.every(Number.isFinite));
    if (!x.every(Number.isFinite) || !series.length) {
      container.className = "chart-wrap empty-state";
      container.textContent = "The Hawking spectrum contains invalid numbers.";
      return;
    }
    renderLineChart(container, {
      title: "Hawking energy emission spectrum",
      x,
      series,
      xLabel: "omega",
      yLabel: "dE / (dt d omega)",
      ariaLabel: "Hawking radiation spectrum versus frequency"
    });
  }

  App.Chart = {
    renderPotentialChart: renderPotentialProfilesChart,
    renderPotentialProfilesChart,
    renderMetricFunctionsChart,
    renderModeScanChart,
    renderOrderTrendChart,
    renderGreybodyChart,
    renderHawkingSpectrumChart
  };
})();
