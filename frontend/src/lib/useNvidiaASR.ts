/**
 * NVIDIA Parakeet ASR Hook
 * ─────────────────────────
 * Custom hook for streaming audio transcription using NVIDIA Parakeet model.
 * Handles audio recording via MediaRecorder and WebSocket communication.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { nvidiaAsrApi } from './api';

export type ASRProvider = 'web-speech' | 'nvidia-parakeet';

interface NvidiaASROptions {
  language?: string;
  sampleRate?: number;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: 'idle' | 'connecting' | 'recording' | 'processing') => void;
}

interface NvidiaASRState {
  isAvailable: boolean;
  isRecording: boolean;
  status: 'idle' | 'connecting' | 'recording' | 'processing';
  error: string | null;
  interimTranscript: string;
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function useNvidiaASR(options: NvidiaASROptions = {}) {
  const {
    language = 'en-US',
    sampleRate = 16000,
    onTranscript,
    onError,
    onStatusChange,
  } = options;

  const [state, setState] = useState<NvidiaASRState>({
    isAvailable: false,
    isRecording: false,
    status: 'idle',
    error: null,
    interimTranscript: '',
  });

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);

  const checkAvailability = useCallback(async () => {
    try {
      const status = await nvidiaAsrApi.checkStatus();
      setState(prev => ({ ...prev, isAvailable: status.available }));
      return status.available;
    } catch {
      setState(prev => ({ ...prev, isAvailable: false }));
      return false;
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void checkAvailability();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [checkAvailability]);

  const updateStatus = useCallback((status: NvidiaASRState['status']) => {
    setState(prev => ({ ...prev, status }));
    onStatusChange?.(status);
  }, [onStatusChange]);

  const clearStopTimeout = useCallback(() => {
    if (stopTimeoutRef.current !== null) {
      window.clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
  }, []);

  const stopAudioCapture = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const closeWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    clearStopTimeout();
    stopAudioCapture();
    closeWebSocket();
  }, [clearStopTimeout, stopAudioCapture, closeWebSocket]);

  // ── startAudioCapture — defined BEFORE startRecording ──
  const startAudioCapture = useCallback((stream: MediaStream, ws: WebSocket) => {
    // Create AudioContext — use browser's default sample rate (usually 44100 or 48000)
    // We'll resample to target rate (16000) before sending
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const nativeSampleRate = audioContext.sampleRate;
    console.log(`[NVIDIA ASR] AudioContext created at native sample rate: ${nativeSampleRate}Hz, target: ${sampleRate}Hz`);

    const source = audioContext.createMediaStreamSource(stream);

    // Create script processor for raw audio capture - using 2048 for lower latency
    const processor = audioContext.createScriptProcessor(2048, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (event) => {
      if (ws.readyState === WebSocket.OPEN) {
        const inputData = event.inputBuffer.getChannelData(0);

        // Resample from native rate to target rate (16000Hz)
        let resampledData: Float32Array;
        if (nativeSampleRate !== sampleRate) {
          const ratio = nativeSampleRate / sampleRate;
          const newLength = Math.round(inputData.length / ratio);
          resampledData = new Float32Array(newLength);
          for (let i = 0; i < newLength; i++) {
            const srcIndex = i * ratio;
            const srcIndexFloor = Math.floor(srcIndex);
            const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1);
            const frac = srcIndex - srcIndexFloor;
            // Linear interpolation
            resampledData[i] = inputData[srcIndexFloor] * (1 - frac) + inputData[srcIndexCeil] * frac;
          }
        } else {
          resampledData = inputData;
        }

        // Convert Float32Array to Int16Array (PCM 16-bit)
        const pcmData = new Int16Array(resampledData.length);
        for (let i = 0; i < resampledData.length; i++) {
          const s = Math.max(-1, Math.min(1, resampledData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert to base64 and send
        const base64 = arrayBufferToBase64(pcmData.buffer);
        ws.send(JSON.stringify({
          type: 'audio',
          data: base64,
        }));
      }
    };

    source.connect(processor);
    // Connect to a silent destination to keep the processor running
    // but avoid audio feedback (don't play mic audio through speakers)
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    processor.connect(silentGain);
    silentGain.connect(audioContext.destination);
  }, [sampleRate]);

  // ── startRecording — uses cleanup and startAudioCapture ──
  const startRecording = useCallback(async () => {
    if (state.isRecording) return;

    setState(prev => ({ ...prev, error: null, interimTranscript: '' }));
    updateStatus('connecting');

    try {
      // Request microphone access — don't force sampleRate, let browser use native rate
      console.log('[NVIDIA ASR] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      console.log('[NVIDIA ASR] Microphone access granted');

      // Connect WebSocket
      const wsUrl = nvidiaAsrApi.getStreamUrl();
      console.log(`[NVIDIA ASR] Connecting WebSocket: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error('[NVIDIA ASR] WebSocket connection timeout');
          ws.close();
          const errorMsg = 'WebSocket connection timed out. Is the backend running on localhost:8000?';
          setState(prev => ({ ...prev, error: errorMsg, isRecording: false }));
          onError?.(errorMsg);
          updateStatus('idle');
          cleanup();
        }
      }, 10000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('[NVIDIA ASR] WebSocket connected, sending config...');
        // Send configuration
        ws.send(JSON.stringify({
          type: 'config',
          language: language,
          sampleRate: sampleRate,
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('[NVIDIA ASR] WS message:', data.type, data.text?.substring(0, 50) || data.message?.substring(0, 50) || '');

        switch (data.type) {
          case 'ready':
            updateStatus('recording');
            setState(prev => ({ ...prev, isRecording: true }));
            startAudioCapture(stream, ws);
            break;

          case 'transcript':
            if (data.is_final) {
              onTranscript?.(data.text, true);
              setState(prev => ({ ...prev, interimTranscript: '' }));
            } else {
              setState(prev => ({ ...prev, interimTranscript: data.text }));
              onTranscript?.(data.text, false);
            }
            break;

          case 'complete':
            clearStopTimeout();
            updateStatus('idle');
            setState(prev => ({ ...prev, isRecording: false }));
            cleanup();
            break;

          case 'error': {
            const errorMsg = data.message || 'Unknown error';
            setState(prev => ({ ...prev, error: errorMsg }));
            onError?.(errorMsg);
            // Don't stop recording on transient errors — let it retry
            if (errorMsg.includes('API key') || errorMsg.includes('not available')) {
              setState(prev => ({ ...prev, isRecording: false }));
              updateStatus('idle');
              cleanup();
            }
            break;
          }
        }
      };

      ws.onerror = (event) => {
        clearTimeout(connectionTimeout);
        clearStopTimeout();
        console.error('[NVIDIA ASR] WebSocket error:', event);
        const errorMsg = 'WebSocket connection failed. Ensure backend is running on localhost:8000';
        setState(prev => ({ ...prev, error: errorMsg, isRecording: false }));
        onError?.(errorMsg);
        updateStatus('idle');
        cleanup();
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        clearStopTimeout();
        console.log(`[NVIDIA ASR] WebSocket closed: code=${event.code} reason=${event.reason}`);
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        stopAudioCapture();
        updateStatus('idle');
        setState(prev => ({ ...prev, isRecording: false }));
      };

    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error('Failed to start recording');
      let errorMsg = errorObj.message || 'Failed to start recording';
      // Provide user-friendly messages for common errors
      if (errorObj.name === 'NotAllowedError' || errorObj.name === 'PermissionDeniedError') {
        errorMsg = 'Microphone access denied. Please allow microphone access in your browser settings.';
      } else if (errorObj.name === 'NotFoundError') {
        errorMsg = 'No microphone found. Please connect a microphone and try again.';
      } else if (errorObj.name === 'NotReadableError') {
        errorMsg = 'Microphone is in use by another application. Please close other apps using the mic.';
      }
      console.error('[NVIDIA ASR] Start recording error:', errorMsg);
      setState(prev => ({ ...prev, error: errorMsg }));
      onError?.(errorMsg);
      updateStatus('idle');
    }
  }, [state.isRecording, language, sampleRate, onTranscript, onError, updateStatus, startAudioCapture, cleanup, clearStopTimeout, stopAudioCapture]);

      const stopRecording = useCallback(() => {
    if (!state.isRecording) return;

    updateStatus('processing');
    stopAudioCapture();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
      clearStopTimeout();
      stopTimeoutRef.current = window.setTimeout(() => {
        closeWebSocket();
        updateStatus('idle');
        setState(prev => ({ ...prev, isRecording: false }));
      }, 5000);
    } else {
      cleanup();
      updateStatus('idle');
      setState(prev => ({ ...prev, isRecording: false }));
    }
  }, [state.isRecording, updateStatus, stopAudioCapture, clearStopTimeout, closeWebSocket, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    ...state,
    startRecording,
    stopRecording,
    checkAvailability,
  };
}

export default useNvidiaASR;
