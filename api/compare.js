import OpenAI from "openai";

export default async function handler(req, res) {
  // POST만 허용
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 입력값 받기
  const { context, optionA, optionB } = req.body || {};

  if (!context || !optionA || !optionB) {
    return res.status(400).json({
      error: "입력값 누락"
    });
  }

  // 🔥 환경변수 확인 로그
  console.log("API KEY 존재 여부:", !!process.env.OPENAI_API_KEY);

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const prompt = `
다음 상황에서 두 선택지를 비교 분석해라.

상황: ${context}

선택 A: ${optionA}
선택 B: ${optionB}

반드시 JSON 형식으로만 답해라. 다른 말 절대 하지 마라.

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
      input: prompt
    });

    // 🔥 응답 구조 안전하게 추출
    let text;

    try {
      text = response.output[0].content[0].text;
    } catch (e) {
      console.error("응답 구조 오류:", response);
      return res.status(500).json({
        error: "응답 구조 오류",
        raw: response
      });
    }

    console.log("GPT RAW:", text);

    // 🔥 JSON 파싱
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("JSON 파싱 실패:", text);
      return res.status(500).json({
        error: "JSON 파싱 실패",
        raw: text
      });
    }

    // 정상 응답
    return res.status(200).json(data);

  } catch (error) {
    console.error("OpenAI 호출 에러:", error);

    return res.status(500).json({
      error: "OpenAI 호출 실패",
      detail: String(error)
    });
  }
}