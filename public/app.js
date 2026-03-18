const contextEl = document.getElementById("context");
const optionAEl = document.getElementById("optionA");
const optionBEl = document.getElementById("optionB");
const statusEl = document.getElementById("status");

const resultAEl = document.getElementById("resultA");
const resultBEl = document.getElementById("resultB");
const judgmentEl = document.getElementById("judgment");

const cardAEl = document.getElementById("cardA");
const cardBEl = document.getElementById("cardB");

document.getElementById("exampleJob").onclick = () => {
  contextEl.value = "현재 직장은 안정적이지만 만족도가 낮고, 창업 아이디어를 조금씩 준비 중이다.";
  optionAEl.value = "지금 바로 퇴사하고 창업에 집중한다";
  optionBEl.value = "1년 더 다니면서 준비한 뒤 창업한다";
};

document.getElementById("exampleBaby").onclick = () => {
  contextEl.value = "맞벌이 중이고 아기는 아직 어리다. 어린이집을 빨리 보낼지, 조금 더 집에서 돌볼지 고민 중이다.";
  optionAEl.value = "이번 시즌 안에 어린이집을 보낸다";
  optionBEl.value = "조금 더 집에서 돌본 뒤 보낸다";
};

document.getElementById("exampleMove").onclick = () => {
  contextEl.value = "출퇴근이 너무 길고 집은 좁다. 이사를 당장 할지, 1년 더 버틸지 고민 중이다.";
  optionAEl.value = "올해 안에 바로 이사한다";
  optionBEl.value = "1년 더 버티고 자금 모은 뒤 이사한다";
};

document.getElementById("btn").onclick = async () => {
  const context = contextEl.value.trim();
  const optionA = optionAEl.value.trim();
  const optionB = optionBEl.value.trim();

  if (!context || !optionA || !optionB) {
    statusEl.className = "status-error";
    statusEl.innerText = "모든 칸을 입력하세요.";
    return;
  }

  statusEl.className = "status-loading";
  statusEl.innerText = "분석 중...";
  resultAEl.innerHTML = "불러오는 중...";
  resultBEl.innerHTML = "불러오는 중...";
  judgmentEl.innerHTML = "불러오는 중...";
  cardAEl.classList.remove("highlight-card");
  cardBEl.classList.remove("highlight-card");

  try {
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ context, optionA, optionB })
    });

    const data = await res.json();

    if (!res.ok) {
      statusEl.className = "status-error";
      statusEl.innerText =
        `${data.error || "요청 실패"}${data.detail ? `\n${data.detail}` : ""}`;
      console.log("서버 에러 응답:", data);
      return;
    }

    resultAEl.innerHTML = `
      <p><b>결과</b><br>${data.optionA.result}</p>
      <div class="section-title">장점</div>
      <ul>${data.optionA.pros.map(p => `<li>${p}</li>`).join("")}</ul>
      <div class="section-title">리스크</div>
      <ul>${data.optionA.risks.map(r => `<li>${r}</li>`).join("")}</ul>
    `;

    resultBEl.innerHTML = `
      <p><b>결과</b><br>${data.optionB.result}</p>
      <div class="section-title">장점</div>
      <ul>${data.optionB.pros.map(p => `<li>${p}</li>`).join("")}</ul>
      <div class="section-title">리스크</div>
      <ul>${data.optionB.risks.map(r => `<li>${r}</li>`).join("")}</ul>
    `;

    const better = (data.judgment.betterOption || "").trim().toUpperCase();

    if (better === "A") {
      cardAEl.classList.add("highlight-card");
    } else if (better === "B") {
      cardBEl.classList.add("highlight-card");
    }

    judgmentEl.innerHTML = `
      <div class="winner-badge">추천 선택: ${data.judgment.betterOption}</div>
      <div class="section-title">이유</div>
      <ul>${data.judgment.reasons.map(r => `<li>${r}</li>`).join("")}</ul>
    `;

    statusEl.className = "status-success";
    statusEl.innerText = "분석 완료";
  } catch (error) {
    console.error(error);
    statusEl.className = "status-error";
    statusEl.innerText = "오류 발생: " + error.message;
  }
};