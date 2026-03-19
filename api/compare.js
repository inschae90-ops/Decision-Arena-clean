const OPENAI_API_URL = "https://api.openai.com/v1/responses";

const SYSTEM_PROMPT = `
당신은 사용자의 두 선택지를 실용적으로 비교해주는 의사결정 분석가다.
반드시 한국어로 답하라.
감정적 위로보다 실제 판단에 도움이 되는 비교를 제공하라.

규칙:
1. 선택 A와 선택 B를 공정하게 비교한다.
2. overall_winner는 "A" / "B" / "tie" 중 하나만 넣는다.
3. quick_verdict는 1문장으로 매우 간결하게 쓴다.
4. comparison_summary는 2~3문장으로 실질적인 차이를 요약한다.
5. 각 선택지마다 strengths, weaknesses는 짧고 명확한 bullet용 문장으로 작성한다.
6. risk_score는 1~5 정수:
   - 1 = 매우 낮은 위험
   - 2 = 낮은 위험
   - 3 = 보통
   - 4 = 높은 위험
   - 5 = 매우 높은 위험
7. 총 위험도는 실패시 손실 크기, 불확실성, 되돌리기 어려움, 시간/비용 부담을 종합해 판단한다.
8. risk_label은 risk_score에 맞는 짧은 한국어 표현으로 작성한다.
9. predicted_outcomes는 각 선택지마다 정확히 2개 작성한다.
   - 1번째는 가장 먼저 체감되거나 비교적 가능성이 높은 결과
   - 2번째는 그 다음에 이어질 수 있는 또 다른 현실적 결과
10. recommendation_note는 그 선택지를 언제 택하면 좋은지 한 문장으로 작성한다.
11. 과장하지 말고, 모호한 말 대신 구체적으로 써라.
`.trim();

function buildOptionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      strengths: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 4,
      },
      weaknesses: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 4,
      },
      risk_score: {
        type: "integer",
        minimum: 1,
        maximum: 5,
      },
      risk_label: { type: "string" },
      risk_reasons: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 3,
      },
      predicted_outcomes: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 2,
      },
      recommendation_note: { type: "string" },
    },
    required: [
      "name",
      "strengths",
      "weaknesses",
      "risk_score",
      "risk_label",
      "risk_reasons",
      "predicted_outcomes",
      "recommendation_note",
    ],
  };
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    overall_winner: {
      type: "string",
      enum: ["A", "B", "tie"],
    },
    quick_verdict: { type: "string" },
    comparison_summary: { type: "string" },
    options: {
      type: "object",
      additionalProperties: false,
      properties: {
        A: buildOptionSchema(),
        B: buildOptionSchema(),
      },
      required: ["A", "B"],
    },
  },
  required: ["overall_winner", "quick_verdict", "comparison_summary", "options"],
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch (error) {
    return res.status(400).json({ error: "요청 본문 JSON 파싱에 실패했습니다." });
  }

  const scenario = String(body.scenario || "").trim();
  const optionA = String(body.optionA || "").trim();
  const optionB = String(body.optionB || "").trim();

  if (!scenario || !optionA || !optionB) {
    return res.status(400).json({
      error: "scenario, optionA, optionB는 모두 필수입니다.",
    });
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const userPrompt = `
상황:
${scenario}

선택 A:
${optionA}

선택 B:
${optionB}

위 상황에서 선택 A와 선택 B를 비교하라.
반드시 지정된 JSON 스키마만 출력하라.
`.trim();

  try {
    const openAiResponse = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 1200,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: SYSTEM_PROMPT,
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: userPrompt,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "decision_arena_comparison",
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
      }),
    });

    const raw = await openAiResponse.json();

    if (!openAiResponse.ok) {
      console.error("OpenAI API error:", raw);
      const apiMessage =
        raw?.error?.message ||
        raw?.error ||
        "OpenAI 호출에 실패했습니다.";
      return res.status(openAiResponse.status).json({ error: apiMessage });
    }

    const outputText = extractOutputText(raw);

    if (!outputText) {
      console.error("No output text:", raw);
      return res.status(500).json({
        error: "모델 응답에서 텍스트를 추출하지 못했습니다.",
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(outputText);
    } catch (error) {
      console.error("JSON parse failed:", outputText);
      return res.status(500).json({
        error: "모델 응답 JSON 파싱에 실패했습니다.",
        rawText: outputText,
      });
    }

    const normalized = normalizeResult({
      scenario,
      optionA,
      optionB,
      parsed,
    });

    return res.status(200).json(normalized);
  } catch (error) {
    console.error("compare error:", error);
    return res.status(500).json({
      error: error?.message || "서버 오류가 발생했습니다.",
    });
  }
}

function extractOutputText(responseJson) {
  if (
    typeof responseJson?.output_text === "string" &&
    responseJson.output_text.trim()
  ) {
    return responseJson.output_text;
  }

  const output = Array.isArray(responseJson?.output) ? responseJson.output : [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === "output_text" && typeof part?.text === "string") {
        return part.text;
      }
    }
  }

  return "";
}

function normalizeResult({ scenario, optionA, optionB, parsed }) {
  const safe = parsed || {};
  const safeOptions = safe.options || {};

  const normalizedA = normalizeOption("A", optionA, safeOptions.A);
  const normalizedB = normalizeOption("B", optionB, safeOptions.B);

  return {
    scenario,
    optionA,
    optionB,
    overall_winner: ["A", "B", "tie"].includes(safe.overall_winner)
      ? safe.overall_winner
      : "tie",
    quick_verdict: String(
      safe.quick_verdict || "두 선택지는 장단점이 뚜렷합니다."
    ),
    comparison_summary: String(
      safe.comparison_summary ||
        "상황의 우선순위에 따라 더 유리한 선택이 달라집니다."
    ),
    options: {
      A: normalizedA,
      B: normalizedB,
    },
  };
}

function normalizeOption(key, fallbackName, option) {
  const safe = option || {};
  const riskScore = clampRiskScore(safe.risk_score);

  return {
    key,
    name: String(safe.name || fallbackName || `선택 ${key}`),
    strengths: normalizeStringArray(safe.strengths, ["장점 정보 없음"]),
    weaknesses: normalizeStringArray(safe.weaknesses, ["약점 정보 없음"]),
    risk_score: riskScore,
    risk_label: String(safe.risk_label || getRiskLabel(riskScore)),
    risk_reasons: normalizeStringArray(safe.risk_reasons, ["불확실성 존재"]),
    predicted_outcomes: normalizePredictedOutcomes(safe.predicted_outcomes),
    recommendation_note: String(
      safe.recommendation_note || "이 선택지는 우선순위가 맞을 때 유효합니다."
    ),
  };
}

function normalizeStringArray(value, fallback) {
  const arr = Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  return arr.length ? arr : fallback;
}

function normalizePredictedOutcomes(value) {
  const arr = Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  if (arr.length >= 2) return arr.slice(0, 2);
  if (arr.length === 1) {
    return [arr[0], "추가 예상 결과 정보가 충분하지 않습니다."];
  }

  return [
    "초기에는 상황 변화가 체감될 수 있습니다.",
    "이후 결과는 실행 방식에 따라 달라질 수 있습니다.",
  ];
}

function clampRiskScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 3;
  return Math.max(1, Math.min(5, Math.round(num)));
}

function getRiskLabel(score) {
  if (score <= 1) return "매우 낮음";
  if (score === 2) return "낮음";
  if (score === 3) return "보통";
  if (score === 4) return "높음";
  return "매우 높음";
}