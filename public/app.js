document.getElementById("btn").onclick = async () => {
  const context = document.getElementById("context").value.trim();
  const optionA = document.getElementById("optionA").value.trim();
  const optionB = document.getElementById("optionB").value.trim();
  const statusEl = document.getElementById("status");

  if (!context || !optionA || !optionB) {
    statusEl.innerText = "모든 칸을 입력하세요.";
    return;
  }

  statusEl.innerText = "분석 중...";

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
      statusEl.innerText = "오류: " + (data.error || "요청 실패");
      console.log(data);
      return;
    }

    document.getElementById("resultA").innerHTML = `
      <p><b>결과:</b> ${data.optionA.result}</p>
      <p><b>장점:</b></p>
      <ul>${data.optionA.pros.map(p => `<li>${p}</li>`).join("")}</ul>
      <p><b>리스크:</b></p>
      <ul>${data.optionA.risks.map(r => `<li>${r}</li>`).join("")}</ul>
    `;

    document.getElementById("resultB").innerHTML = `
      <p><b>결과:</b> ${data.optionB.result}</p>
      <p><b>장점:</b></p>
      <ul>${data.optionB.pros.map(p => `<li>${p}</li>`).join("")}</ul>
      <p><b>리스크:</b></p>
      <ul>${data.optionB.risks.map(r => `<li>${r}</li>`).join("")}</ul>
    `;

    document.getElementById("judgment").innerHTML = `
      <p><b>추천 선택:</b> ${data.judgment.betterOption}</p>
      <p><b>이유:</b></p>
      <ul>${data.judgment.reasons.map(r => `<li>${r}</li>`).join("")}</ul>
    `;

    statusEl.innerText = "완료";
  } catch (error) {
    console.error(error);
    statusEl.innerText = "오류 발생: " + error.message;
  }
};