const OpenAI = require("openai");
const { z } = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");
// const sharp = require('sharp');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY // 環境変数からAPIキーを取得
});

const AreaSchema = z.object({
  type: z.string().describe("エリアのタイプ（テキスト、画像など）"),
  content: z.string().describe("エリアの内容(10文字以内)"),
  coordinates: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number()
  })
});

const ScreenshotAnalysisSchema = z.object({
  areas: z.array(AreaSchema)
});

async function analyzeScreenshot(imgBase64) {
    // console.log(imgBase64)
//   const imageBuffer = Buffer.from(imgBase64, 'base64');
//   const metadata = await sharp(imageBuffer).metadata();
  const screenWidth = 2056;
  const screenHeight = 1329;
  const { width, height } = { width: screenWidth, height: screenHeight };

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `画面のスクショを見て、この画面のから画面の各エリアの文字のまとまりや画像情報ごとにエリアを提案してください。エリアは最大3つまで定義してください。また決して領域は被らないようにしてください。画面幅は${screenWidth}px、高さは${screenHeight}pxです。正確に行ってください。。`
          },
          {
            type: "image_url",
            image_url: {
                url: `data:image/png;base64,${imgBase64}`
            }
          }
        ]
      }
    ],
    // content: `あなたが1流の画像認識AIです。以下はスクリーンショットから抽出されたテキストと座標情報です。作業内容を理解して長文の文章が存在するメインコンテンツのエリアを定義してください。エリアは最大3つまで定義してください。また決して領域は被らないようにしてください。例として、コーディングエリア、記事閲覧エリア、ファイル参照エリアがあります。\n\n${JSON.stringify(areas)}`
    max_tokens: 1000,
    response_format: zodResponseFormat(ScreenshotAnalysisSchema, "output_areas")
  });
  return completion.choices[0].message.content;
}

async function analyzeInput(input,model) {
  try {
    let content = String(input.prompt);
    console.log("analyzeInput",input);
    if (input.type === "image") {
      content = [{
        type: "image_url",
        image_url: {
          url: input.image.toDataURL()
        }
      }, {
        type: "text",
        text: input.prompt
      }];
    }
    
      console.log(model);
        const completion = await openai.chat.completions.create({
            model: model,
            messages: [
              {
                role: "user",
                content: content
              }
            ],
            max_tokens: 300,
            stream: false
        });
        return completion.choices[0].message.content;
    } catch (error) {
        console.error('analyzeInput error:', error);
        throw error;
    }
}

async function rewriteContent({ content, instruction }) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "与えられたコンテンツを指示に従って書き換えてください。"
                },
                {
                    role: "user",
                    content: `以下のコンテンツを:\n${content}\n\n次の指示に従って書き換えてください:\n${instruction}`
                }
            ],
            max_tokens: 300,
            temperature: 0.7,
            stream: false
        });
        return completion.choices[0].message.content;
    } catch (error) {
        console.error('Content rewrite error:', error);
        throw error;
    }
}

module.exports = {
  analyzeScreenshot,
  analyzeInput,
  rewriteContent
}; 