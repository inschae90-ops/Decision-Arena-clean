const compareForm = document.getElementById("compareForm");
const compareBtn = document.getElementById("compareBtn");
const shareBtn = document.getElementById("shareBtn");
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

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "비교 요청에 실패했습니다.");
    }

    state.latestResult = data;
    state.visibleOutcomes = { A: 1, B: 1 };

    renderResult();
    shareBtn.classList.remove("hidden");
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

  resultSection.innerHTML = `
    <div class="summary-card">
      <div class="winner-chip">종합 판단 · ${escapeHtml(winnerText)}</div>
      <h2>${escapeHtml(data.quick_verdict || "비교 결과")}</h2>
      <p>${escapeHtml(data.comparison_summary || "")}</p>
    </div>

    <div class="cards">
      ${renderOptionCard("A", data.options?.A)}
      ${renderOptionCard("B", data.options?.B)}
    </div>

    <div class="result-footer">
      공유 버튼을 누르면 현재 비교 결과를 텍스트로 복사하거나 공유합니다.
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

  return `
    <article class="option-card">
      <div class="option-top">
        <div>
          <div class="option-badge">선택 ${key}</div>
          <h3>${escapeHtml(safeOption.name || `선택 ${key}`)}</h3>
        </div>
        <p class="mini-note">${escapeHtml(safeOption.recommendation_note || "")}</p>
      </div>

      <div class="section-title">강점</div>
      ${renderStringList(safeOption.strengths)}

      <div class="section-title">약점</div>
      ${renderStringList(safeOption.weaknesses)}

      <div class="section-title">총 위험도</div>
      <div class="risk-box">
        <div class="risk-row">
          <div class="stars" aria-label="총 위험도 ${safeOption.risk_score || 0}점">
            ${renderStars(safeOption.risk_score || 0)}
          </div>
          <div class="risk-label">${escapeHtml(safeOption.risk_label || "")}</div>
          <div class="risk-score">${Number(safeOption.risk_score || 0)}/5</div>
        </div>
        ${renderStringList(safeOption.risk_reasons)}
      </div>

      <div class="section-title">예상 결과</div>
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

  const shareText = buildShareText(state.latestResult);

  try {
    if (navigator.share) {
      await navigator.share({
        title: "Decision Arena 비교 결과",
        text: shareText,
        url: window.location.href,
      });
      setStatus("공유 창을 열었습니다.");
      return;
    }

    await navigator.clipboard.writeText(`${shareText}\n\n${window.location.href}`);
    setStatus("결과를 클립보드에 복사했습니다.");
  } catch (error) {
    console.error(error);
    setStatus("공유 또는 복사에 실패했습니다.");
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