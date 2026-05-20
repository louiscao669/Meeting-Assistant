import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';
import { getOpenAIResponse } from './callLLM';

const PredictedOutput = ({ keywords, transcript, predict, setPredict }) => {
  const [prediction, setPrediction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!predict) return;

    if (keywords.length === 0) {
      setError('Add at least one keyword (press Enter after typing).');
      setPredict(false);
      return;
    }

    const transcriptText = (transcript || '').trim();
    const meetingContext = transcriptText
      ? transcriptText
      : '(No meeting transcript yet — use the keywords and general meeting context.)';

    const fetchPrediction = async () => {
      setLoading(true);
      setError(null);

      try {
        const prompt = `
            Assume you are a user currently in a meeting.
            <Meeting transcript>:
            ${meetingContext}

            You are to express your views based on the transcript above and the keywords provided.
            <Keywords>:
            ${keywords.join(', ')}

            Note:
            1. Use the FIRST PERSON to express your views.
            2. Limit your output within 2-3 sentences.
            3. Focus on more recent transcript lines when a transcript is available.
            4. Make sure your output is relevant to the keywords provided.
        `;
        const data = await getOpenAIResponse(prompt);
        setPrediction(data);
      } catch (err) {
        const message = err?.message || 'Error fetching the prediction';
        setError(message);
        console.error('OpenAI API Error:', err);
      } finally {
        setLoading(false);
        setPredict(false);
      }
    };

    fetchPrediction();
  }, [keywords, transcript, predict, setPredict]);

  useEffect(() => {
    console.log('Prediction:', prediction);
  }, [prediction]); // Log the prediction whenever it changes

//   useEffect(() => {
//     if (predict) {
//       // Reset 'predict' state after prediction is made
//       setPrediction('');
//     }
//   }, [predict]);

  // Function to speak the prediction text
  const handleSpeak = () => {
    if (prediction) {
      const speech = new SpeechSynthesisUtterance(prediction);
      speech.lang = 'en-US';
      speech.rate = 1; // 1 = normal; was 2 (too fast)
      window.speechSynthesis.speak(speech);
    }
  };

  return (
    <Box sx={{ padding: 0, marginTop: 2 }}>
      {loading && (
        <Typography sx={{ color: '#555', mt: 1 }}>Organizing your thoughts…</Typography>
      )}
      {error && (
        <Typography color="error" sx={{ mt: 1, fontSize: '0.875rem' }}>
          {error}
        </Typography>
      )}
      {prediction.trim() && (
        <Paper
            sx={{
            display: 'flex',
            flexDirection: 'column',
            //justifyContent: 'center', // Remove or adjust if not needed
            justifyContent: 'flex-start',
            alignItems: 'center',
            paddingX: 2,
            backgroundColor: 'rgb(205, 163, 250)',
            height: '50vh', // Keep the fixed height
            overflowY: 'auto', // Keep the overflow for scrolling
            textAlign: 'center',
            }}
        >
            <Button
                variant="contained"
                color="secondary"
                onClick={handleSpeak}
                sx={{
                    backgroundColor: 'rgb(175, 116, 239)',
                    color: 'white',
                    margin: 1,
                    flexShrink: 0, // Prevent button from shrinking
                    '&:hover': {
                    backgroundColor: 'rgb(133, 62, 208)',
                    },
                }}
            >
                Speak
            </Button>
            <Typography
            color="white"
            sx={{
                flexGrow: 1, // Allow text to grow
                overflowY: 'auto', // Enable scrolling for text
            }}
            >
            {prediction}
            </Typography>
        </Paper>
        )}
    </Box>
  );
};

export default PredictedOutput;
