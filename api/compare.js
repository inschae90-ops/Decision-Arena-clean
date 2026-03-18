import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { context, optionA, optionB } = req.body;

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const prompt = `
다음 상황에서 두 선택지를 비교 분석해라.

상황: ${context}

선택 A: ${optionA}
선택 B: ${optionB}

반드시 JSON 형식으로만 답해라.

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
      model: "gpt-5.3",
      input: prompt
    });

    const text = response.output[0].content[0].text;

    console.log("GPT RAW:", text);
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({
        error: "JSON 파싱 실패",
        raw: text
      });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "서버 오류",
      detail: String(error)
    });
  }
}