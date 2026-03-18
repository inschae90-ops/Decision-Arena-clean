import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static("public"));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/api/compare", async (req, res) => {
  try {
    const { context, optionA, optionB } = req.body;

    if (!context || !optionA || !optionB) {
      return res.status(400).json({ error: "모든 입력값을 채워주세요." });
    }

    const prompt = `
너는 의사결정 비교 분석기다.

사용자가 하나의 상황과 두 개의 선택지를 주면,
두 선택지를 현실적으로 비교하라.

규칙:
- 일반론 말고 실제 선택처럼 분석
- 감성적 위로 금지
- 장점과 리스크를 분리
- 마지막에는 둘 중 하나를 하나 고르기
- 반드시 아래 JSON 형식으로만 출력

출력 형식:
{
  "optionA": {
    "result": "문장 1개",
    "pros": ["장점1", "장점2"],
    "risks": ["리스크1", "리스크2"]
  },
  "optionB": {
    "result": "문장 1개",
    "pros": ["장점1", "장점2"],
    "risks": ["리스크1", "리스크2"]
  },
  "judgment": {
    "betterOption": "A 또는 B",
    "reasons": ["이유1", "이유2", "이유3"]
  }
}

상황: ${context}
선택 A: ${optionA}
선택 B: ${optionB}
`;

    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      input: prompt,
    });

    const text = response.output_text;

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({
        error: "모델 응답이 JSON 형식이 아니었습니다.",
        raw: text,
      });
    }

    res.json(parsed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
