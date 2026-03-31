(function () {
  const App = self.QNMApp;

  function toNumbers(values) {
    return values.map((value) => Number(value));
  }

  function extent(values) {
    let min = Infinity;
    let max = -Infinity;
    for (const value of values) {
      if (value < min) {
        min = value;
      }
      if (value > max) {
        max = value;
      }
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

  function renderPotentialChart(container, plotData) {
    if (!plotData) {
      container.classList.add("empty-state");
      container.textContent = "Для выбранного случая график недоступен.";
      return;
    }
    const xValues = toNumbers(plotData.x);
    const yValues = toNumbers(plotData.potential);
    if (!xValues.every(Number.isFinite) || !yValues.every(Number.isFinite)) {
      container.classList.add("empty-state");
      container.textContent = "Не удалось визуализировать график из-за некорректных чисел.";
      return;
    }
    const width = 940;
    const height = 360;
    const margin = { top: 24, right: 28, bottom: 42, left: 82 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const xExtent = extent(xValues);
    const yExtent = extent(yValues);
    const yPadding = (yExtent.max - yExtent.min || 1) * 0.08;
    const yMin = yExtent.min - yPadding;
    const yMax = yExtent.max + yPadding;
    const xScale = (value) => margin.left + ((value - xExtent.min) / (xExtent.max - xExtent.min || 1)) * innerWidth;
    const yScale = (value) => margin.top + innerHeight - ((value - yMin) / (yMax - yMin || 1)) * innerHeight;
    const path = xValues
      .map((value, index) => `${index === 0 ? "M" : "L"} ${xScale(value).toFixed(2)} ${yScale(yValues[index]).toFixed(2)}`)
      .join(" ");
    const peakIndex = yValues.reduce((best, value, index, list) => (value > list[best] ? index : best), 0);
    const xTicks = [xExtent.min, (xExtent.min + xExtent.max) / 2, xExtent.max];
    const yTicks = [yMin, (yMin + yMax) / 2, yMax];
    const xLabel = plotData.xLabel || "x";
    const yLabel = plotData.yLabel || "V";
    container.classList.remove("empty-state");
    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="График эффективного потенциала">
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
        <path class="chart-line" d="${path}"></path>
        <circle class="chart-point" cx="${xScale(xValues[peakIndex])}" cy="${yScale(yValues[peakIndex])}" r="5"></circle>
        <text class="chart-label" x="${width / 2}" y="${height - 4}" text-anchor="middle">${xLabel}</text>
        <text class="chart-label" x="18" y="${height / 2}" transform="rotate(-90 18 ${height / 2})" text-anchor="middle">${yLabel}</text>
      </svg>
    `;
  }

  App.Chart = {
    renderPotentialChart
  };
})();
