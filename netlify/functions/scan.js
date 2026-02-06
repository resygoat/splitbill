// Netlify Serverless Function for Receipt Scanning
// Place this file in: netlify/functions/scan.js

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { image } = JSON.parse(event.body);

    if (!image) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No image provided' })
      };
    }

    // OpenAI API key from environment variable (set in Netlify dashboard)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'OpenAI API key not configured' })
      };
    }

    // Call OpenAI Vision API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'You are a receipt parser. Extract merchant name, date, all items with name/quantity/price, subtotal, tax, tip, total. Respond ONLY with valid JSON: {"merchant": "string", "date": "string", "items": [{"name": "string", "quantity": number, "price": number}], "subtotal": number, "tax": number, "tip": number, "total": number}'
            },
            {
              type: 'image_url',
              image_url: { url: image }
            }
          ]
        }],
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'Failed to scan receipt' })
      };
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const clean = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(clean);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(parsed)
    };

  } catch (error) {
    console.error('Scan function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};