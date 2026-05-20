import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { transcriptData } from '../data/videotranscript';
import { parseTranscriptSegments } from '../utils/transcriptSegments';

const Transcript = ({ setTime, setTranscript }) => {
  const {
    transcript,
    interimTranscript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  const [videoSrc, setVideoSrc] = useState(null);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isLiveMeeting, setIsLiveMeeting] = useState(false);
  const [isManualEdit, setIsManualEdit] = useState(false);
  const [fullTranscriptOpen, setFullTranscriptOpen] = useState(false);
  const videoRef = useRef(null);
  const sentencesEndRef = useRef(null);

  const liveSpeechText = [transcript, interimTranscript].filter(Boolean).join(' ').trim();
  const displayTranscript = isManualEdit
    ? currentTranscript
    : isLiveMeeting
      ? liveSpeechText
      : currentTranscript;

  const { sentences, liveFragment } = parseTranscriptSegments(displayTranscript);

  const pushTranscriptToParent = (text) => {
    const value = text.trim();
    setCurrentTranscript(value);
    setTranscript(value);
  };

  const handleVideoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setVideoSrc(URL.createObjectURL(file));
    }
  };

  const startLiveTranscription = () => {
    setIsManualEdit(false);
    resetTranscript();
    pushTranscriptToParent('');
    setIsLiveMeeting(true);
    SpeechRecognition.startListening({
      continuous: true,
      language: 'en-US',
      interimResults: true,
    });
  };

  const stopLiveTranscription = () => {
    SpeechRecognition.stopListening();
    setIsLiveMeeting(false);
    const finalText = [transcript, interimTranscript].filter(Boolean).join(' ').trim();
    if (finalText) {
      pushTranscriptToParent(finalText);
    }
  };

  const clearTranscript = () => {
    setIsManualEdit(false);
    resetTranscript();
    pushTranscriptToParent('');
    setIsLiveMeeting(false);
    SpeechRecognition.stopListening();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || isLiveMeeting) return;

    const handleTimeUpdate = () => {
      const currentTime = Math.floor(video.currentTime);
      setTime(currentTime);
      if (transcriptData.length === 0 || isManualEdit) return;

      const visibleTranscript = transcriptData
        .filter((line) => line.time <= currentTime)
        .map((line) => line.text)
        .join(' ')
        .trim();
      pushTranscriptToParent(visibleTranscript);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [videoSrc, isLiveMeeting, isManualEdit, setTime, setTranscript]);

  useEffect(() => {
    if (!isLiveMeeting || isManualEdit) return;
    if (liveSpeechText) {
      pushTranscriptToParent(liveSpeechText);
    }
  }, [liveSpeechText, isLiveMeeting, isManualEdit, setTranscript]);

  useEffect(() => {
    sentencesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [sentences.length, liveFragment, displayTranscript]);

  useEffect(() => {
    return () => {
      SpeechRecognition.stopListening();
    };
  }, []);

  if (!browserSupportsSpeechRecognition) {
    return (
      <Typography sx={{ p: 2 }}>
        Speech-to-text needs Chrome or Edge on desktop, or Safari on macOS. Use HTTPS or
        localhost and allow microphone access.
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 280,
        height: '42vh',
        maxHeight: 480,
        flexShrink: 0,
        borderTop: '1px solid #ddd',
        backgroundColor: 'white',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          p: 1.5,
          gap: 1.5,
        }}
      >
        {/* Controls + optional video */}
        <Box
          sx={{
            width: { xs: '38%', sm: '32%' },
            minWidth: 140,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <Paper
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              p: 1.5,
              height: '100%',
              backgroundColor: 'rgb(162, 191, 242)',
              overflowY: 'auto',
            }}
          >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'center' }}>
              {!listening ? (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<MicIcon />}
                  onClick={startLiveTranscription}
                  sx={{
                    backgroundColor: 'rgb(175, 116, 239)',
                    color: 'white',
                    fontSize: '0.75rem',
                    '&:hover': { backgroundColor: 'rgb(133, 62, 208)' },
                  }}
                >
                  Start live
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="error"
                  size="small"
                  startIcon={<MicOffIcon />}
                  onClick={stopLiveTranscription}
                >
                  Stop
                </Button>
              )}
              <Button
                variant="outlined"
                size="small"
                onClick={clearTranscript}
                sx={{ bgcolor: 'white', fontSize: '0.75rem' }}
              >
                Clear
              </Button>
            </Box>

            {listening && (
              <Chip
                label="Listening…"
                color="success"
                size="small"
                sx={{ fontWeight: 600, fontSize: '0.7rem' }}
              />
            )}

            {!videoSrc && (
              <>
                <input
                  accept="video/*"
                  type="file"
                  id="upload-video"
                  onChange={handleVideoUpload}
                  style={{ display: 'none' }}
                />
                <label htmlFor="upload-video">
                  <Button variant="outlined" component="span" size="small" sx={{ bgcolor: 'white' }}>
                    Upload video
                  </Button>
                </label>
              </>
            )}

            {videoSrc && (
              <video
                ref={videoRef}
                controls
                width="100%"
                style={{ maxHeight: 100, objectFit: 'contain' }}
              >
                <source src={videoSrc} type="video/mp4" />
              </video>
            )}
          </Paper>
        </Box>

        {/* Main: sentence-by-sentence */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Paper
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              p: 2,
              backgroundColor: 'rgb(162, 191, 242)',
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{ color: 'white', textAlign: 'center', fontWeight: 700, mb: 1, flexShrink: 0 }}
            >
              Live transcript
            </Typography>

            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                backgroundColor: 'rgb(174, 204, 255)',
                borderRadius: 1,
                p: 2,
              }}
            >
              {sentences.length === 0 && !liveFragment && (
                <Typography sx={{ color: '#444', fontStyle: 'italic' }}>
                  Start live transcript or type in the full transcript panel below.
                </Typography>
              )}

              {sentences.map((sentence, index) => {
                const isLatest = index === sentences.length - 1 && !liveFragment;
                return (
                  <Typography
                    key={`${index}-${sentence.slice(0, 24)}`}
                    component="p"
                    sx={{
                      mb: 1.25,
                      lineHeight: 1.5,
                      color: '#111',
                      fontSize: isLatest ? '1.05rem' : '0.92rem',
                      fontWeight: isLatest ? 600 : 400,
                      opacity: isLatest ? 1 : 0.82,
                      borderLeft: isLatest ? '3px solid rgb(133, 62, 208)' : '3px solid transparent',
                      pl: 1.5,
                    }}
                  >
                    {sentence}
                  </Typography>
                );
              })}

              {liveFragment && (
                <Typography
                  component="p"
                  sx={{
                    mb: 0,
                    lineHeight: 1.5,
                    color: '#111',
                    fontSize: '1.05rem',
                    fontWeight: 600,
                    borderLeft: '3px solid rgb(175, 116, 239)',
                    pl: 1.5,
                    fontStyle: 'italic',
                  }}
                >
                  {liveFragment}
                </Typography>
              )}

              <div ref={sentencesEndRef} />
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Collapsible full transcript */}
      <Accordion
        expanded={fullTranscriptOpen}
        onChange={(_, expanded) => setFullTranscriptOpen(expanded)}
        disableGutters
        sx={{
          flexShrink: 0,
          '&:before': { display: 'none' },
          boxShadow: 'none',
          borderTop: '1px solid #ddd',
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            minHeight: 40,
            bgcolor: 'rgb(205, 190, 235)',
            '& .MuiAccordionSummary-content': { my: 0.5 },
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#333' }}>
            Full transcript
            {displayTranscript
              ? ` · ${sentences.length + (liveFragment ? 1 : 0)} segment(s)`
              : ' · empty'}
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 1.5, pt: 0, bgcolor: '#fafafa' }}>
          <Box
            component="textarea"
            value={displayTranscript}
            onChange={(e) => {
              setIsManualEdit(true);
              const value = e.target.value;
              setCurrentTranscript(value);
              setTranscript(value);
            }}
            placeholder="Edit the full meeting transcript here…"
            style={{
              width: '100%',
              minHeight: 72,
              maxHeight: 120,
              padding: 12,
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              borderRadius: 8,
              border: '1px solid #ccc',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default Transcript;
