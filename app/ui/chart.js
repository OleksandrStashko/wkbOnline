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

  function renderLineChart(container, config) {
    const width = 980;
    const height = 380;
    const margin = { top: 28, right: 28, bottom: 48, left: 84 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const xExtent = extent(config.x);
    const yExtent = extent(config.series.flatMap((item) => item.values));
    if (!xExtent || !yExtent) {
      container.className = "chart-wrap empty-state";
      container.textContent = config.emptyText || "Недостаточно данных для графика.";
      return;
    }
    const yPadding = (yExtent.max - yExtent.min || 1) * 0.08;
    const yMin = yExtent.min - yPadding;
    const yMax = yExtent.max + yPadding;
    const xScale = (value) => margin.left + ((value - xExtent.min) / (xExtent.max - xExtent.min || 1)) * innerWidth;
    const yScale = (value) => margin.top + innerHeight - ((value - yMin) / (yMax - yMin || 1)) * innerHeight;
    const xTicks = buildTicks(xExtent.min, xExtent.max, 5);
    const yTicks = buildTicks(yMin, yMax, 5);
    const paths = config.series
      .map((series, seriesIndex) => {
        const path = config.x
          .map((xValue, pointIndex) => {
            const yValue = series.values[pointIndex];
            return `${pointIndex === 0 ? "M" : "L"} ${xScale(xValue).toFixed(2)} ${yScale(yValue).toFixed(2)}`;
          })
          .join(" ");
        return `<path class="chart-line chart-line-${seriesIndex}" stroke="${series.color}" d="${path}"></path>`;
      })
      .join("");
    const legend = config.series
      .map(
        (series, seriesIndex) => `
          <div class="chart-legend-item">
            <span class="chart-legend-swatch" style="background:${series.color}"></span>
            <span>${series.label}</span>
          </div>
        `
      )
      .join("");
    const title = config.title ? `<div class="chart-title">${config.title}</div>` : "";
    container.className = "chart-wrap";
    container.innerHTML = `
      ${title}
      <div class="chart-legend">${legend}</div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${config.ariaLabel}">
        <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="rgba(255,255,255,0.42)"></rect>
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
        ${paths}
        <text class="chart-label" x="${width / 2}" y="${height - 4}" text-anchor="middle">${config.xLabel}</text>
        <text class="chart-label" x="18" y="${height / 2}" transform="rotate(-90 18 ${height / 2})" text-anchor="middle">${config.yLabel}</text>
      </svg>
    `;
  }

  function renderPotentialChart(container, plotData) {
    if (!plotData) {
      container.className = "chart-wrap empty-state";
      container.textContent = "Для выбранного случая график потенциала недоступен.";
      return;
    }
    const x = plotData.x.map((value) => Number(value));
    const y = plotData.potential.map((value) => Number(value));
    if (!x.every(Number.isFinite) || !y.every(Number.isFinite)) {
      container.className = "chart-wrap empty-state";
      container.textContent = "Не удалось построить график потенциала из-за некорректных чисел.";
      return;
    }
    renderLineChart(container, {
      x,
      series: [{ label: "V(r)", values: y, color: "#0e6670" }],
      xLabel: plotData.xLabel || "r",
      yLabel: plotData.yLabel || "V(r)",
      ariaLabel: "График эффективного потенциала"
    });
  }

  function renderModeScanChart(container, data) {
    if (!data || !data.x || data.x.length < 2 || !data.branches || !data.branches.length) {
      container.className = "chart-wrap empty-state";
      container.textContent = "График мод недоступен.";
      return;
    }
    container.className = "chart-stack";
    container.innerHTML = `
      <div class="chart-stack-panel"></div>
      <div class="chart-stack-panel"></div>
    `;
    const panels = container.querySelectorAll(".chart-stack-panel");
    renderLineChart(panels[0], {
      title: "Re ω для всех обертонов",
      x: data.x,
      series: data.branches.map((branch, index) => ({
        label: `n=${branch.n}`,
        values: branch.re,
        color: palette(index)
      })),
      xLabel: data.parameterName,
      yLabel: "Re ω",
      ariaLabel: "График действительной части мод по параметру"
    });
    renderLineChart(panels[1], {
      title: "Im ω для всех обертонов",
      x: data.x,
      series: data.branches.map((branch, index) => ({
        label: `n=${branch.n}`,
        values: branch.im,
        color: palette(index)
      })),
      xLabel: data.parameterName,
      yLabel: "Im ω",
      ariaLabel: "График мнимой части мод по параметру"
    });
  }

  function renderOrderTrendChart(container, data) {
    if (!data || !data.orders || data.orders.length < 1) {
      container.className = "chart-wrap empty-state";
      container.textContent = "График по порядкам недоступен.";
      return;
    }
    renderLineChart(container, {
      title: `Зависимость моды от порядка WKB для n=${data.overtone}`,
      x: data.orders,
      series: [
        { label: "Re ω", values: data.re, color: "#0e6670" },
        { label: "Im ω", values: data.im, color: "#c08b2c" }
      ],
      xLabel: "Порядок WKB",
      yLabel: "ω",
      ariaLabel: "График моды по порядкам метода"
    });
  }

  App.Chart = {
    renderPotentialChart,
    renderModeScanChart,
    renderOrderTrendChart
  };
})();
