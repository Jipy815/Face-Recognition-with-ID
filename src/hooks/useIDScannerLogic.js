import { useState, useEffect, useCallback, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import Tesseract from 'tesseract.js';
import { getAllValidStudentIDs } from '../services/testDB';

const useIDScannerLogic = (videoRef, onIDDetected) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('Initializing...');
  const [detections, setDetections] = useState([]);
  
  const modelRef = useRef(null);
  const ocrWorkerRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const isProcessingRef = useRef(false);
  const scanCountRef = useRef(0);
  const streamRef = useRef(null);

  const SCAN_INTERVAL = 1000;
  const MAX_ATTEMPTS = 60;

  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            resolve();
          };
        });
      }
      return true;
    } catch (err) {
      console.error('Camera error:', err);
      setError('Camera access denied. Please enable camera permissions.');
      return false;
    }
  }, [videoRef]);

  const initModels = useCallback(async () => {
    try {
      setStatus('Loading AI models...');
      
      await tf.ready();
      await tf.setBackend('webgl');
      modelRef.current = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      
      ocrWorkerRef.current = await Tesseract.createWorker('eng', 1, {
        logger: () => {}
      });
      
      await ocrWorkerRef.current.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: '0123456789',
      });

      console.log('Models loaded');
      return true;
    } catch (err) {
      console.error('Model loading error:', err);
      setError('Failed to load AI models');
      return false;
    }
  }, []);

  const cleanOcrText = (text) => {
    return text
      .replace(/[Oo]/g, '0')
      .replace(/[IlL|!]/g, '1')
      .replace(/[Ss\$]/g, '5')
      .replace(/[Zz]/g, '2')
      .replace(/[Bb]/g, '8')
      .replace(/[Gg&]/g, '9')
      .replace(/[Aa@]/g, '4')
      .replace(/[Tt\+]/g, '7')
      .replace(/[^0-9]/g, '');
  };

  const findValidStudentId = (text) => {
    const validIds = getAllValidStudentIDs();
    
    // Remove ALL whitespace, newlines, and non-digit characters
    const digitsOnly = text.replace(/\D/g, '');
    
    console.log('All digits found:', digitsOnly, `(${digitsOnly.length} digits)`);
    
    // First try: exact match in the digit string
    for (const validId of validIds) {
      if (digitsOnly.includes(validId)) {
        console.log('FOUND EXACT MATCH:', validId);
        return validId;
      }
    }
    
    // Second try: check if we have at least 7 consecutive digits
    if (digitsOnly.length >= 7) {
      // Try sliding window of 7 digits
      for (let i = 0; i <= digitsOnly.length - 7; i++) {
        const candidate = digitsOnly.substring(i, i + 7);
        if (validIds.includes(candidate)) {
          console.log('FOUND IN WINDOW:', candidate);
          return candidate;
        }
      }
      
      // If no exact match, try the first 7 digits
      const firstSeven = digitsOnly.substring(0, 7);
      console.log('Checking first 7 digits:', firstSeven);
      if (validIds.includes(firstSeven)) {
        console.log('MATCHED FIRST 7:', firstSeven);
        return firstSeven;
      }
    }
    
    console.log('No valid ID found in:', digitsOnly);
    return null;
  };

  const captureFullFrame = (video) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Apply aggressive preprocessing for better OCR
    preprocessImage(ctx, canvas.width, canvas.height);
    
    return canvas;
  };

  const preprocessImage = (ctx, width, height) => {
    try {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      // Convert to grayscale and apply high contrast
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        
        // High contrast + threshold (binary)
        const threshold = 128;
        const value = gray > threshold ? 255 : 0;
        
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
      }
      
      ctx.putImageData(imageData, 0, 0);
    } catch (e) {
      console.error('Preprocessing error:', e);
    }
  };

  const scanFrame = useCallback(async () => {
    if (isProcessingRef.current || !videoRef.current || !modelRef.current || !ocrWorkerRef.current) {
      return;
    }

    const video = videoRef.current;
    if (video.readyState < 2) return;

    isProcessingRef.current = true;
    setStatus('Scanning for ID card...');

    try {
      const predictions = await modelRef.current.detect(video, 10, 0.25);
      setDetections(predictions);

      const fullFrame = captureFullFrame(video);
      const { data } = await ocrWorkerRef.current.recognize(fullFrame);
      const rawText = data.text;

      console.log('═══════════════════════════════════');
      console.log('RAW OCR TEXT:');
      console.log(rawText);
      console.log('═══════════════════════════════════');

      const studentId = findValidStudentId(rawText);

      if (studentId) {
        console.log('Found student ID:', studentId);
        stopScanning();
        setStatus('ID detected!');
        onIDDetected(studentId);
        return;
      }

      scanCountRef.current++;
      setStatus(`Scanning... (${scanCountRef.current}/${MAX_ATTEMPTS})`);

      if (scanCountRef.current >= MAX_ATTEMPTS) {
        stopScanning();
        setError('Could not detect student ID. Please try again.');
        setStatus('Scan timeout');
      }

    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      isProcessingRef.current = false;
    }
  }, [videoRef, onIDDetected]);

  const startScanning = useCallback(() => {
    console.log('Starting ID scan...');
    setStatus('Scanning for student ID...');
    scanCountRef.current = 0;
    isProcessingRef.current = false;

    scanFrame();
    scanIntervalRef.current = setInterval(scanFrame, SCAN_INTERVAL);
  }, [scanFrame]);

  const stopScanning = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    isProcessingRef.current = false;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const cameraOk = await initCamera();
      if (!cameraOk || !isMounted) return;

      const modelsOk = await initModels();
      if (!modelsOk || !isMounted) return;

      setIsReady(true);
      setStatus('Ready to scan');
    };

    init();

    return () => {
      isMounted = false;
      stopScanning();
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (ocrWorkerRef.current) {
        ocrWorkerRef.current.terminate();
      }
      
      if (modelRef.current) {
        modelRef.current = null;
      }
    };
  }, [initCamera, initModels, stopScanning]);

  return {
    isReady,
    error,
    status,
    detections,
    startScanning,
    stopScanning
  };
};

export default useIDScannerLogic;
