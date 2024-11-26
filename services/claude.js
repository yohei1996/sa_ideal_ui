require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

// 環境変数からAPIキーを取得
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

module.exports = {
  analyze: async function(input,model) {
    try {
      let content = String(input.prompt);
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

      const message = await anthropic.messages.create({
        model: model,
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: content
          }
        ]
      });
      console.log("message",message.content);
      return message.content[0].text;
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }
};
