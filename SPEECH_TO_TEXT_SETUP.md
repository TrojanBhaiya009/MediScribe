# 🎤 Speech-to-Text Setup Guide

## Problem Fixed ✅

Your speech-to-text wasn't working because:
1. The `.env` file was missing
2. The `GROQ_API_KEY` environment variable wasn't configured

## Solution

I've created a `.env` file in `backend/.env` for you. Now you need to add your Groq API key.

---

## Quick Setup (5 minutes)

### Step 1: Get a FREE Groq API Key

1. Go to **https://console.groq.com**
2. Sign up for a free account (no credit card required)
3. Navigate to **API Keys** section
4. Click **"Create API Key"**
5. Copy the API key (starts with `gsk_...`)

### Step 2: Add API Key to .env File

1. Open `backend/.env` file
2. Find the line with `GROQ_API_KEY=""`
3. Paste your API key between the quotes:
   ```bash
   GROQ_API_KEY="gsk_your_actual_key_here"
   ```
4. Save the file

### Step 3: Restart Your Backend Server

```bash
cd MediScribe/backend
# If running: stop the server (Ctrl+C)
# Then restart:
uvicorn main:app --reload
```

### Step 4: Test It! 🎉

1. Open your frontend: http://localhost:3000
2. Go to the Scribe page
3. Click the microphone button
4. Start speaking!

---

## Why Groq?

- **FREE**: No credit card required
- **FAST**: 5-10x faster than OpenAI Whisper
- **ACCURATE**: Uses Whisper Large v3 Turbo model
- **GENEROUS LIMITS**: 20 requests/minute on free tier

---

## Troubleshooting

### Issue: "ASR not available" error
**Solution**: Make sure `GROQ_API_KEY` is set in `backend/.env` and restart the backend server.

### Issue: "401 Unauthorized" error
**Solution**: Your API key is invalid. Get a new one from console.groq.com

### Issue: "429 Rate limit" error
**Solution**: Free tier limit is 20 requests/minute. Wait 60 seconds and try again.

### Issue: WebSocket connection fails
**Solution**: Make sure backend is running on http://localhost:8000
```bash
cd backend
uvicorn main:app --reload
```

---

## Alternative: OpenAI Whisper (Paid)

If you prefer OpenAI instead of Groq:

1. Get OpenAI API key from https://platform.openai.com
2. Set `OPENAI_API_KEY` in `backend/.env`
3. Update `nvidia_transcription.py` to use OpenAI (see code comments)

---

## Technical Details

- **Frontend**: Uses WebSocket to stream audio chunks to backend
- **Backend**: Accumulates audio → sends to Groq Whisper API → returns transcription
- **Audio Format**: 16kHz, mono, 16-bit PCM
- **Model**: Whisper Large v3 Turbo
- **Language Support**: English, Hindi, Spanish, French, German, and 90+ more

---

## Need Help?

Check the backend logs for detailed error messages:
```bash
cd backend
tail -f error.log
```

Or run the test endpoint:
```bash
curl http://localhost:8000/nvidia-asr/test
```
