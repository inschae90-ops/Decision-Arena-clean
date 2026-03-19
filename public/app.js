const compareForm = document.getElementById("compareForm");
const compareBtn = document.getElementById("compareBtn");
const shareBtn = document.getElementById("shareBtn");
const imageBtn = document.getElementById("imageBtn");
const statusEl = document.getElementById("status");
const resultSection = document.getElementById("resultSection");

const scenarioInput = document.getElementById("scenario");
const optionAInput = document.getElementById("optionA");
const optionBInput = document.getElementById("optionB");

const state = {
  latestResult: null,
  visibleOutcomes: {
    A: 1,
    B: 1,
  },
};

compareForm.addEventListener("submit", onCompareSubmit);
shareBtn.addEventListener("click", onShareResult);
imageBtn.addEventListener("click", onSaveImage);

async function onCompareSubmit(event) {
  event.preventDefault();

  const scenario = scenarioInput.value.trim();
  const optionA = optionAInput.value.trim();
  const optionB = optionBInput.value.trim();

  if (!scenario || !optionA || !optionB) {
    setStatus("모든 입력칸을 채워주세요.");
    return;
  }

  setLoading(true);
  setStatus("비교 중입니다...");

  try {
    const response = await fetch("/api/compare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        scenario,
        optionA,
        optionB,
      }),
    });

    const rawText = await response.text();

    let data;
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      throw new Error(`서버가 JSON이 아닌 응답을 반환했습니다: ${rawText.slice(0, 200)}`);
    }

    if (!response.ok) {
      throw new Error(data?.error || "비교 요청에 실패했습니다.");
    }

    state.latestResult = data;
    state.visibleOutcomes = { A: 1, B: 1 };

    renderResult();
    shareBtn.classList.remove("hidden");
    imageBtn.classList.remove("hidden");
    setStatus("비교 완료");
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    setStatus(error.message || "오류가 발생했습니다.");
    resultSection.classList.add("hidden");
    resultSection.innerHTML = "";
  } finally {
    setLoading(false);
  }
}

function renderResult() {
  const data = state.latestResult;
  if (!data) return;

  const winnerText = getWinnerText(data.overall_winner);
  const a = data.options?.A || {};
  const b = data.options?.B || {};

  resultSection.innerHTML = `
    <div class="summary-card">
      <div class="summary-top">
        <div class="winner-chip">
          <span class="winner-dot"></span>
          <span>종합 판단 · ${escapeHtml(winnerText)}</span>
        </div>
      </div>

      <h2>${escapeHtml(data.quick_verdict || "비교 결과")}</h2>
      <p>${escapeHtml(data.comparison_summary || "")}</p>

      <div class="summary-meta">
        <div class="meta-chip">선택 A 위험도: ${toStars(a.risk_score)} (${Number(a.risk_score || 0)}/5)</div>
        <div class="meta-chip">선택 B 위험도: ${toStars(b.risk_score)} (${Number(b.risk_score || 0)}/5)</div>
        <div class="meta-chip">예상 결과는 1개 먼저, 버튼으로 추가 노출</div>
      </div>
    </div>

    <div class="cards">
      ${renderOptionCard("A", data.options?.A)}
      ${renderOptionCard("B", data.options?.B)}
    </div>

    <div class="result-footer">
      결과 공유는 텍스트 공유를 지원하고, 이미지 저장은 카드형 PNG 파일을 생성합니다.
    </div>
  `;

  attachOutcomeHandlers();
  resultSection.classList.remove("hidden");
}

function renderOptionCard(key, option) {
  const safeOption = option || {};
  const outcomes = Array.isArray(safeOption.predicted_outcomes)
    ? safeOption.predicted_outcomes
    : [];
  const visibleCount = Math.max(1, Math.min(state.visibleOutcomes[key] || 1, outcomes.length || 1));
  const riskScore = Number(safeOption.risk_score || 0);
  const riskPercent = Math.max(0, Math.min(100, (riskScore / 5) * 100));

  return `
    <article class="option-card">
      <div class="option-top">
        <div>
          <div class="option-badge">선택 ${key}</div>
          <h3>${escapeHtml(safeOption.name || `선택 ${key}`)}</h3>
        </div>
        <p class="mini-note">${escapeHtml(safeOption.recommendation_note || "")}</p>
      </div>

      <div class="card-grid">
        <div class="subcard">
          <div class="subcard-title">
            <span><span class="icon">✅</span> 강점</span>
          </div>
          ${renderStringList(safeOption.strengths)}
        </div>

        <div class="subcard">
          <div class="subcard-title">
            <span><span class="icon">⚠️</span> 약점</span>
          </div>
          ${renderStringList(safeOption.weaknesses)}
        </div>

        <div class="risk-box">
          <div class="subcard-title">
            <span><span class="icon">⭐</span> 총 위험도</span>
          </div>

          <div class="risk-row">
            <div class="risk-left">
              <div class="stars" aria-label="총 위험도 ${riskScore}점">
                ${renderStars(riskScore)}
              </div>
              <div class="risk-badge">${escapeHtml(safeOption.risk_label || "")}</div>
            </div>
            <div class="risk-score">${riskScore}/5</div>
          </div>

          <div class="risk-meter">
            <div class="risk-fill" style="width: ${riskPercent}%"></div>
          </div>

          ${renderStringList(safeOption.risk_reasons)}
        </div>

        <div class="subcard">
          <div class="subcard-title">
            <span><span class="icon">🔮</span> 예상 결과</span>
          </div>

          <div id="outcomes-${key}" class="outcome-list">
            ${renderOutcomeList(outcomes, visibleCount)}
          </div>

          ${
            outcomes.length > visibleCount
              ? `<button
                   type="button"
                   class="secondary-btn more-outcomes-btn"
                   data-key="${key}"
                 >예상 결과 1개 더 보기</button>`
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

function attachOutcomeHandlers() {
  const buttons = resultSection.querySelectorAll(".more-outcomes-btn");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.key;
      const option = state.latestResult?.options?.[key];
      const outcomes = Array.isArray(option?.predicted_outcomes)
        ? option.predicted_outcomes
        : [];

      if (!outcomes.length) return;

      state.visibleOutcomes[key] = Math.min(
        (state.visibleOutcomes[key] || 1) + 1,
        outcomes.length
      );

      renderResult();
    });
  });
}

function renderStars(score) {
  const safeScore = Math.max(0, Math.min(5, Number(score) || 0));
  let html = "";

  for (let i = 1; i <= 5; i += 1) {
    const filled = i <= safeScore;
    html += `<span class="star ${filled ? "filled" : "empty"}">★</span>`;
  }

  return html;
}

function renderStringList(items) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  if (!safeItems.length) {
    return `<ul><li>정보 없음</li></ul>`;
  }

  return `
    <ul>
      ${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function renderOutcomeList(items, visibleCount) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  if (!safeItems.length) {
    return `<ol><li>예상 결과 정보 없음</li></ol>`;
  }

  const visibleItems = safeItems.slice(0, visibleCount);

  return `
    <ol>
      ${visibleItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ol>
  `;
}

function getWinnerText(winner) {
  if (winner === "A") return "선택 A 우세";
  if (winner === "B") return "선택 B 우세";
  return "거의 비등";
}

function setLoading(isLoading) {
  compareBtn.disabled = isLoading;
  compareBtn.textContent = isLoading ? "비교 중..." : "비교하기";
}

function setStatus(message) {
  statusEl.textContent = message || "";
}

async function onShareResult() {
  if (!state.latestResult) return;

  setStatus("공유용 이미지를 준비 중입니다...");

  const shareText = buildShareText(state.latestResult);

  try {
    const imageBlob = await buildResultImageBlob(state.latestResult);
    const fileName = buildImageFileName();
    const imageFile = new File([imageBlob], fileName, { type: "image/png" });

    if (navigator.share && navigator.canShare?.({ files: [imageFile] })) {
      await navigator.share({
        title: "Decision Arena 비교 결과",
        text: shareText,
        files: [imageFile],
      });
      setStatus("이미지와 함께 공유 창을 열었습니다.");
      return;
    }

    if (navigator.share) {
      await navigator.share({
        title: "Decision Arena 비교 결과",
        text: shareText,
        url: window.location.href,
      });
      setStatus("공유 창을 열었습니다.");
      return;
    }

    if (navigator.clipboard?.write && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": imageBlob,
          }),
        ]);
        setStatus("결과 이미지를 클립보드에 복사했습니다.");
        return;
      } catch (clipboardImageError) {
        console.warn("Image clipboard copy failed:", clipboardImageError);
      }
    }

    await navigator.clipboard.writeText(`${shareText}\n\n${window.location.href}`);
    setStatus("결과 텍스트를 클립보드에 복사했습니다.");
  } catch (error) {
    console.error(error);
    setStatus("공유에 실패했습니다.");
  }
}

async function onSaveImage() {
  if (!state.latestResult) return;

  setStatus("이미지를 생성 중입니다...");

  try {
    const blob = await buildResultImageBlob(state.latestResult);
    downloadBlob(blob, buildImageFileName());
    setStatus("결과 이미지를 저장했습니다.");
  } catch (error) {
    console.error(error);
    setStatus("이미지 저장에 실패했습니다.");
  }
}

function buildShareText(data) {
  const a = data.options?.A || {};
  const b = data.options?.B || {};

  return [
    "[Decision Arena 비교 결과]",
    "",
    `상황: ${data.scenario || ""}`,
    `종합 판단: ${getWinnerText(data.overall_winner)}`,
    `한줄 요약: ${data.quick_verdict || ""}`,
    `설명: ${data.comparison_summary || ""}`,
    "",
    `- 선택 A: ${a.name || ""}`,
    `  총 위험도: ${toStars(a.risk_score)} (${a.risk_score || 0}/5, ${a.risk_label || ""})`,
    `  예상 결과 1: ${a.predicted_outcomes?.[0] || ""}`,
    `  예상 결과 2: ${a.predicted_outcomes?.[1] || ""}`,
    "",
    `- 선택 B: ${b.name || ""}`,
    `  총 위험도: ${toStars(b.risk_score)} (${b.risk_score || 0}/5, ${b.risk_label || ""})`,
    `  예상 결과 1: ${b.predicted_outcomes?.[0] || ""}`,
    `  예상 결과 2: ${b.predicted_outcomes?.[1] || ""}`,
  ].join("\n");
}

function buildImageFileName() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `decision-arena-${yyyy}${mm}${dd}-${hh}${mi}${ss}.png`;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function buildResultImageBlob(data) {
  const width = 1320;
  const outerPadding = 28;
  const panelPadding = 30;
  const gap = 24;
  const columnGap = 24;
  const columnWidth = (width - outerPadding * 2 - panelPadding * 2 - columnGap) / 2;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas를 사용할 수 없습니다.");
  }

  const headerHeight = 72;
  const summaryHeight = measureSummaryCardHeight(ctx, data, width - outerPadding * 2 - panelPadding * 2);
  const optionAHeight = measureOptionCardHeight(ctx, "A", data.options?.A, columnWidth);
  const optionBHeight = measureOptionCardHeight(ctx, "B", data.options?.B, columnWidth);
  const optionsHeight = Math.max(optionAHeight, optionBHeight);
  const footerHeight = 54;

  const contentHeight =
    outerPadding * 2 +
    panelPadding * 2 +
    headerHeight +
    18 +
    summaryHeight +
    20 +
    optionsHeight +
    20 +
    footerHeight;

  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(contentHeight * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${contentHeight}px`;
  ctx.scale(dpr, dpr);

  drawImageBackground(ctx, width, contentHeight);

  drawRoundedRect(ctx, outerPadding, outerPadding, width - outerPadding * 2, contentHeight - outerPadding * 2, 30);
  const panelGradient = ctx.createLinearGradient(0, outerPadding, 0, contentHeight - outerPadding);
  panelGradient.addColorStop(0, "rgba(7, 18, 34, 0.96)");
  panelGradient.addColorStop(1, "rgba(11, 20, 38, 0.96)");
  ctx.fillStyle = panelGradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const baseX = outerPadding + panelPadding;
  let cursorY = outerPadding + panelPadding;

  drawImageHeader(ctx, baseX, cursorY, width - outerPadding * 2 - panelPadding * 2, headerHeight, data);
  cursorY += headerHeight + 18;

  const summaryWidth = width - outerPadding * 2 - panelPadding * 2;
  renderSummaryCardToCanvas(ctx, data, baseX, cursorY, summaryWidth, true);
  cursorY += summaryHeight + 20;

  renderOptionCardToCanvas(ctx, "A", data.options?.A, baseX, cursorY, columnWidth, true);
  renderOptionCardToCanvas(ctx, "B", data.options?.B, baseX + columnWidth + columnGap, cursorY, columnWidth, true);

  drawFooter(ctx, baseX, contentHeight - outerPadding - panelPadding - 8, width - outerPadding * 2 - panelPadding * 2);

  return await canvasToBlob(canvas);
}

function drawImageBackground(ctx, width, height) {
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#06111f");
  bg.addColorStop(0.5, "#0b1527");
  bg.addColorStop(1, "#101b31");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow1 = ctx.createRadialGradient(120, 90, 20, 120, 90, 260);
  glow1.addColorStop(0, "rgba(56, 189, 248, 0.26)");
  glow1.addColorStop(1, "rgba(56, 189, 248, 0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(width - 80, 150, 20, width - 80, 150, 280);
  glow2.addColorStop(0, "rgba(129, 140, 248, 0.22)");
  glow2.addColorStop(1, "rgba(129, 140, 248, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);
}

function drawImageHeader(ctx, x, y, width, height, data) {
  drawRoundedRect(ctx, x, y, width, height, 22);
  const headerGradient = ctx.createLinearGradient(0, y, width, y + height);
  headerGradient.addColorStop(0, "rgba(14, 165, 233, 0.14)");
  headerGradient.addColorStop(1, "rgba(129, 140, 248, 0.10)");
  ctx.fillStyle = headerGradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(103, 232, 249, 0.18)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#67e8f9";
  ctx.beginPath();
  ctx.arc(x + 22, y + height / 2, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f8fbff";
  ctx.font = "800 28px Arial";
  ctx.fillText("Decision Arena", x + 40, y + 43);

  ctx.fillStyle = "#9fb4cc";
  ctx.font = "600 15px Arial";
  ctx.fillText("AI decision snapshot", x + 40, y + 64);

  ctx.textAlign = "right";
  ctx.fillStyle = "#dbeafe";
  ctx.font = "700 16px Arial";
  ctx.fillText(getWinnerText(data.overall_winner), x + width - 18, y + 34);

  ctx.fillStyle = "#8fa5be";
  ctx.font = "600 13px Arial";
  ctx.fillText(formatNow(), x + width - 18, y + 56);
  ctx.textAlign = "left";
}

function measureSummaryCardHeight(ctx, data, width) {
  return renderSummaryCardToCanvas(ctx, data, 0, 0, width, false);
}

function renderSummaryCardToCanvas(ctx, data, x, y, width, shouldDraw) {
  const padding = 24;
  const chipHeight = 34;
  const innerWidth = width - padding * 2;

  ctx.font = "700 15px Arial";
  const chipText = `종합 판단 · ${getWinnerText(data.overall_winner)}`;
  const titleLines = measureWrappedText(ctx, data.quick_verdict || "비교 결과", innerWidth, "800 38px Arial");
  const summaryLines = measureWrappedText(ctx, data.comparison_summary || "", innerWidth, "500 18px Arial");
  const scenarioLines = measureWrappedText(
    ctx,
    `상황: ${data.scenario || ""}`,
    innerWidth,
    "500 15px Arial"
  );

  const height =
    padding +
    chipHeight +
    18 +
    titleLines.length * 48 +
    8 +
    summaryLines.length * 28 +
    16 +
    scenarioLines.length * 22 +
    padding;

  if (shouldDraw) {
    drawRoundedRect(ctx, x, y, width, height, 26);
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, "rgba(56, 189, 248, 0.18)");
    gradient.addColorStop(1, "rgba(129, 140, 248, 0.12)");
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "rgba(103, 232, 249, 0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  let cursorY = y + padding;

  if (shouldDraw) {
    drawRoundedRect(ctx, x + padding, cursorY, 178, chipHeight, 999);
    ctx.fillStyle = "rgba(7, 18, 34, 0.72)";
    ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
    ctx.stroke();

    ctx.fillStyle = "#67e8f9";
    ctx.beginPath();
    ctx.arc(x + padding + 16, cursorY + chipHeight / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#dbeafe";
    ctx.font = "800 14px Arial";
    ctx.fillText(chipText, x + padding + 28, cursorY + 22);
  }

  cursorY += chipHeight + 18;

  if (shouldDraw) {
    drawWrappedText(ctx, data.quick_verdict || "비교 결과", x + padding, cursorY, innerWidth, {
      font: "800 38px Arial",
      color: "#f8fbff",
      lineHeight: 48,
    });
  }
  cursorY += titleLines.length * 48 + 8;

  if (shouldDraw) {
    drawWrappedText(ctx, data.comparison_summary || "", x + padding, cursorY, innerWidth, {
      font: "500 18px Arial",
      color: "#dbe7f7",
      lineHeight: 28,
    });
  }
  cursorY += summaryLines.length * 28 + 16;

  if (shouldDraw) {
    drawWrappedText(ctx, `상황: ${data.scenario || ""}`, x + padding, cursorY, innerWidth, {
      font: "500 15px Arial",
      color: "#9fb4cc",
      lineHeight: 22,
    });
  }

  return height;
}

function measureOptionCardHeight(ctx, key, option, width) {
  return renderOptionCardToCanvas(ctx, key, option, 0, 0, width, false);
}

function renderOptionCardToCanvas(ctx, key, option, x, y, width, shouldDraw) {
  const safeOption = option || {};
  const padding = 22;
  const innerWidth = width - padding * 2;

  const name = String(safeOption.name || `선택 ${key}`);
  const recommendation = String(safeOption.recommendation_note || "");
  const strengths = normalizeCanvasItems(safeOption.strengths, 3);
  const weaknesses = normalizeCanvasItems(safeOption.weaknesses, 3);
  const outcomes = normalizeCanvasItems(safeOption.predicted_outcomes, 2);
  const riskReasons = normalizeCanvasItems(safeOption.risk_reasons, 2);
  const riskScore = Math.max(0, Math.min(5, Number(safeOption.risk_score || 0)));
  const riskPercent = Math.max(0, Math.min(100, (riskScore / 5) * 100));

  const titleLines = measureWrappedText(ctx, name, innerWidth, "800 28px Arial");
  const noteLines = measureWrappedText(ctx, recommendation, innerWidth - 24, "600 14px Arial");
  const noteHeight = 18 + noteLines.length * 22 + 16;

  const riskReasonHeight = measureBulletListHeight(ctx, riskReasons, innerWidth - 24, {
    font: "500 15px Arial",
    lineHeight: 22,
    itemGap: 8,
  });

  const strengthsHeight = measureBulletListHeight(ctx, strengths, innerWidth - 8, {
    font: "500 15px Arial",
    lineHeight: 22,
    itemGap: 8,
  });

  const weaknessesHeight = measureBulletListHeight(ctx, weaknesses, innerWidth - 8, {
    font: "500 15px Arial",
    lineHeight: 22,
    itemGap: 8,
  });

  const outcomesHeight = measureNumberedListHeight(ctx, outcomes, innerWidth - 10, {
    font: "500 15px Arial",
    lineHeight: 22,
    itemGap: 10,
  });

  const riskBoxHeight = 18 + 20 + 16 + 20 + 12 + 10 + 14 + riskReasonHeight + 18;
  const height =
    padding +
    28 +
    10 +
    titleLines.length * 36 +
    16 +
    noteHeight +
    16 +
    24 +
    strengthsHeight +
    16 +
    24 +
    weaknessesHeight +
    16 +
    riskBoxHeight +
    16 +
    24 +
    outcomesHeight +
    padding;

  if (shouldDraw) {
    drawRoundedRect(ctx, x, y, width, height, 26);
    const cardGradient = ctx.createLinearGradient(x, y, x, y + height);
    cardGradient.addColorStop(0, "rgba(15, 23, 42, 0.98)");
    cardGradient.addColorStop(1, "rgba(15, 23, 42, 0.88)");
    ctx.fillStyle = cardGradient;
    ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
    ctx.lineWidth = 1;
    ctx.stroke();

    drawRoundedRect(ctx, x, y, width, 4, 26);
    const topBarGradient = ctx.createLinearGradient(x, y, x + width, y);
    topBarGradient.addColorStop(0, "#67e8f9");
    topBarGradient.addColorStop(1, "#818cf8");
    ctx.fillStyle = topBarGradient;
    ctx.fill();
  }

  let cursorY = y + padding;

  if (shouldDraw) {
    drawRoundedRect(ctx, x + padding, cursorY, 72, 28, 999);
    ctx.fillStyle = "rgba(56, 189, 248, 0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(103, 232, 249, 0.16)";
    ctx.stroke();

    ctx.fillStyle = "#bff7ff";
    ctx.font = "800 12px Arial";
    ctx.fillText(`선택 ${key}`, x + padding + 16, cursorY + 19);
  }

  cursorY += 38;

  if (shouldDraw) {
    drawWrappedText(ctx, name, x + padding, cursorY, innerWidth, {
      font: "800 28px Arial",
      color: "#f8fbff",
      lineHeight: 36,
    });
  }
  cursorY += titleLines.length * 36 + 16;

  if (shouldDraw) {
    drawRoundedRect(ctx, x + padding, cursorY, innerWidth, noteHeight, 16);
    ctx.fillStyle = "rgba(30, 41, 59, 0.56)";
    ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx.stroke();

    drawWrappedText(ctx, recommendation, x + padding + 12, cursorY + 18, innerWidth - 24, {
      font: "600 14px Arial",
      color: "#cbd5e1",
      lineHeight: 22,
    });
  }
  cursorY += noteHeight + 16;

  if (shouldDraw) {
    drawSectionLabel(ctx, "강점", x + padding, cursorY);
    drawBulletList(ctx, strengths, x + padding, cursorY + 24, innerWidth - 8, {
      font: "500 15px Arial",
      color: "#e5eefc",
      lineHeight: 22,
      itemGap: 8,
      bulletColor: "#67e8f9",
    });
  }
  cursorY += 24 + strengthsHeight + 16;

  if (shouldDraw) {
    drawSectionLabel(ctx, "약점", x + padding, cursorY);
    drawBulletList(ctx, weaknesses, x + padding, cursorY + 24, innerWidth - 8, {
      font: "500 15px Arial",
      color: "#e5eefc",
      lineHeight: 22,
      itemGap: 8,
      bulletColor: "#f59e0b",
    });
  }
  cursorY += 24 + weaknessesHeight + 16;

  if (shouldDraw) {
    drawRoundedRect(ctx, x + padding, cursorY, innerWidth, riskBoxHeight, 18);
    const riskGradient = ctx.createLinearGradient(x + padding, cursorY, x + padding, cursorY + riskBoxHeight);
    riskGradient.addColorStop(0, "rgba(30, 41, 59, 0.60)");
    riskGradient.addColorStop(1, "rgba(15, 23, 42, 0.58)");
    ctx.fillStyle = riskGradient;
    ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx.stroke();

    drawSectionLabel(ctx, "총 위험도", x + padding + 16, cursorY + 18);

    const starsX = x + padding + 16;
    const starsY = cursorY + 52;
    drawStarRow(ctx, starsX, starsY, riskScore);

    drawRoundedRect(ctx, x + padding + 140, cursorY + 36, 90, 28, 999);
    ctx.fillStyle = "rgba(15, 23, 42, 0.70)";
    ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.font = "800 12px Arial";
    ctx.fillText(String(safeOption.risk_label || ""), x + padding + 156, cursorY + 55);

    ctx.textAlign = "right";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "700 13px Arial";
    ctx.fillText(`${riskScore}/5`, x + padding + innerWidth - 16, cursorY + 54);
    ctx.textAlign = "left";

    drawRoundedRect(ctx, x + padding + 16, cursorY + 78, innerWidth - 32, 10, 999);
    ctx.fillStyle = "rgba(148, 163, 184, 0.14)";
    ctx.fill();

    drawRoundedRect(ctx, x + padding + 16, cursorY + 78, (innerWidth - 32) * (riskPercent / 100), 10, 999);
    const meterGradient = ctx.createLinearGradient(x + padding + 16, 0, x + padding + innerWidth - 16, 0);
    meterGradient.addColorStop(0, "#22c55e");
    meterGradient.addColorStop(0.55, "#f59e0b");
    meterGradient.addColorStop(1, "#ef4444");
    ctx.fillStyle = meterGradient;
    ctx.fill();

    drawBulletList(ctx, riskReasons, x + padding + 16, cursorY + 106, innerWidth - 24, {
      font: "500 15px Arial",
      color: "#e5eefc",
      lineHeight: 22,
      itemGap: 8,
      bulletColor: "#fbbf24",
    });
  }
  cursorY += riskBoxHeight + 16;

  if (shouldDraw) {
    drawSectionLabel(ctx, "예상 결과", x + padding, cursorY);
    drawNumberedList(ctx, outcomes, x + padding, cursorY + 24, innerWidth - 10, {
      font: "500 15px Arial",
      color: "#e5eefc",
      lineHeight: 22,
      itemGap: 10,
      numberColor: "#67e8f9",
    });
  }

  return height;
}

function drawFooter(ctx, x, y, width) {
  ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
  ctx.beginPath();
  ctx.moveTo(x, y - 18);
  ctx.lineTo(x + width, y - 18);
  ctx.stroke();

  ctx.fillStyle = "#9fb4cc";
  ctx.font = "600 14px Arial";
  ctx.fillText("Generated by Decision Arena", x, y + 4);

  ctx.textAlign = "right";
  ctx.fillStyle = "#7f93aa";
  ctx.font = "600 13px Arial";
  ctx.fillText(window.location.host || "decision-arena", x + width, y + 4);
  ctx.textAlign = "left";
}

function drawSectionLabel(ctx, text, x, y) {
  ctx.fillStyle = "#dbeafe";
  ctx.font = "800 13px Arial";
  ctx.fillText(text, x, y + 13);
}

function drawStarRow(ctx, x, y, score) {
  const safeScore = Math.max(0, Math.min(5, Number(score) || 0));
  const gap = 22;

  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < safeScore ? "#fbbf24" : "#475569";
    ctx.font = "800 20px Arial";
    ctx.fillText("★", x + i * gap, y);
  }
}

function drawBulletList(ctx, items, x, y, maxWidth, options) {
  const {
    font,
    color,
    lineHeight,
    itemGap,
    bulletColor,
  } = options;

  let cursorY = y;
  ctx.font = font;

  for (const item of items) {
    const lines = wrapText(ctx, item, maxWidth - 18);
    ctx.fillStyle = bulletColor;
    ctx.beginPath();
    ctx.arc(x + 5, cursorY + 8, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.font = font;

    lines.forEach((line, index) => {
      ctx.fillText(line, x + 16, cursorY + 12 + index * lineHeight);
    });

    cursorY += lines.length * lineHeight + itemGap;
  }

  return cursorY;
}

function drawNumberedList(ctx, items, x, y, maxWidth, options) {
  const {
    font,
    color,
    lineHeight,
    itemGap,
    numberColor,
  } = options;

  let cursorY = y;
  ctx.font = font;

  items.forEach((item, index) => {
    const badgeX = x;
    const badgeY = cursorY;
    drawRoundedRect(ctx, badgeX, badgeY, 22, 22, 999);
    ctx.fillStyle = "rgba(56, 189, 248, 0.14)";
    ctx.fill();
    ctx.strokeStyle = "rgba(103, 232, 249, 0.18)";
    ctx.stroke();

    ctx.fillStyle = numberColor;
    ctx.font = "800 12px Arial";
    ctx.fillText(String(index + 1), badgeX + 8, badgeY + 15);

    const lines = wrapText(ctx, item, maxWidth - 34);
    ctx.fillStyle = color;
    ctx.font = font;

    lines.forEach((line, lineIndex) => {
      ctx.fillText(line, x + 32, cursorY + 15 + lineIndex * lineHeight);
    });

    cursorY += lines.length * lineHeight + itemGap;
  });

  return cursorY;
}

function measureBulletListHeight(ctx, items, maxWidth, options) {
  const { font, lineHeight, itemGap } = options;
  ctx.font = font;
  let total = 0;

  for (const item of items) {
    const lines = wrapText(ctx, item, maxWidth - 18);
    total += lines.length * lineHeight + itemGap;
  }

  return total;
}

function measureNumberedListHeight(ctx, items, maxWidth, options) {
  const { font, lineHeight, itemGap } = options;
  ctx.font = font;
  let total = 0;

  for (const item of items) {
    const lines = wrapText(ctx, item, maxWidth - 34);
    total += lines.length * lineHeight + itemGap;
  }

  return total;
}

function measureWrappedText(ctx, text, maxWidth, font) {
  ctx.font = font;
  return wrapText(ctx, text, maxWidth);
}

function drawWrappedText(ctx, text, x, y, maxWidth, options) {
  const { font, color, lineHeight } = options;
  ctx.font = font;
  ctx.fillStyle = color;

  const lines = wrapText(ctx, text, maxWidth);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });

  return lines.length;
}

function wrapText(ctx, text, maxWidth) {
  const source = String(text || "");
  if (!source) return [""];

  const paragraphs = source.split("\n");
  const lines = [];

  for (let p = 0; p < paragraphs.length; p += 1) {
    const paragraph = paragraphs[p];

    if (!paragraph) {
      lines.push("");
      continue;
    }

    let current = "";

    for (const char of Array.from(paragraph)) {
      const next = current + char;
      if (current && ctx.measureText(next).width > maxWidth) {
        lines.push(current.trimEnd());
        current = char.trimStart();
      } else {
        current = next;
      }
    }

    if (current) {
      lines.push(current.trimEnd());
    }
  }

  return lines.length ? lines : [""];
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function normalizeCanvasItems(items, limit) {
  const safe = Array.isArray(items) ? items.filter(Boolean).map(String) : [];
  return safe.length ? safe.slice(0, limit) : ["정보 없음"];
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("이미지 변환에 실패했습니다."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

function formatNow() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

function toStars(score) {
  const safeScore = Math.max(0, Math.min(5, Number(score) || 0));
  return "★".repeat(safeScore) + "☆".repeat(5 - safeScore);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}