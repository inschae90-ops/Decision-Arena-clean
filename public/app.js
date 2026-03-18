document.getElementById("btn").onclick = async () => {
  const context = document.getElementById("context").value.trim();
  const optionA = document.getElementById("optionA").value.trim();
  const optionB = document.getElementById("optionB").value.trim();
  const statusEl = document.getElementById("status");

  const resultAEl = document.getElementById("resultA");
  const resultBEl = document.getElementById("resultB");
  const judgmentEl = document.getElementById("judgment");

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
        `${data.error || "요청 실패"} ${data.detail ? `- ${data.detail}` : ""}`;
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

    judgmentEl.innerHTML = `
      <p><b>추천 선택:</b> ${data.judgment.betterOption}</p>
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