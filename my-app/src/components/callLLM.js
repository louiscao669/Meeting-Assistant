import axios from 'axios';

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

const openai = axios.create({
  baseURL: 'https://api.openai.com/v1',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
  },
});

export const getOpenAIResponse = async (prompt) => {
  if (!API_KEY) {
    throw new Error(
      'Missing VITE_OPENAI_API_KEY. Add it to Meeting_Assistant/.env and restart npm run dev.',
    );
  }

  try {
    const response = await openai.post('/chat/completions', {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    const detail =
      error.response?.data?.error?.message ??
      error.message ??
      'OpenAI request failed';
    console.error('OpenAI API Error:', detail, error.response?.status);
    throw new Error(detail);
  }
};