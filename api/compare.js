import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { context, optionA, optionB } = req.body || {};

  if (!context || !optionA || !optionB) {
    return res.status(400).json({ error: "입력값 누락" });
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const prompt = `
다음 상황에서 두 선택지를 비교 분석해라.

상황: ${context}

선택 A: ${optionA}
선택 B: ${optionB}

반드시 아래 JSON 형식으로만 답해라. 다른 말 절대 하지 마라.

{
  "optionA": {
    "result": "...",
    "pros": ["..."],
    "risks": ["..."]
  },
  "optionB": {
    "result": "...",
    "pros": ["..."],
    "risks": ["..."]
  },
  "judgment": {
    "betterOption": "A or B",
    "reasons": ["..."]
  }
}
`;

  try {
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
      response_format: {
        type: "json_object"
      }
    });

    // 🔥 무조건 안전한 텍스트 추출
    const text = response.output_text;

    console.log("GPT RAW:", text);

    // 🔥 JSON 파싱
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({
        error: "JSON 파싱 실패",
        raw: text
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error("OpenAI 에러:", error);

    return res.status(500).json({
      error: "OpenAI 호출 실패",
      detail: String(error)
    });
  }
}