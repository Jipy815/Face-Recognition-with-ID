import { useState, useEffect, useCallback, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';

const useFaceVerification = (videoRef, referenceFaceImage, onVerified, onFailed) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('Initializing...');
  const [faceDetected, setFaceDetected] = useState(false);
  const [similarityScore, setSimilarityScore] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const modelsLoadedRef = useRef(false);
  const detectionIntervalRef = useRef(null);
  const referenceDescriptorRef = useRef(null);
  const streamRef = useRef(null);
  const hasVerifiedRef = useRef(false);
  const lastDetectionTimeRef = useRef(0);

  const MATCH_THRESHOLD = 0.5;
  const DETECTION_INTERVAL = 300;
  const MATCHING_THROTTLE = 4000;

  const speakVerification = useCallback(() => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('Verification Successful');
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;
      speechSynthesis.speak(utterance);
    }
  }, []);

  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
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
      setError('Camera access denied');
      return false;
    }
  }, [videoRef]);

  const loadModels = useCallback(async () => {
    if (modelsLoadedRef.current) return true;

    try {
      setStatus('Loading face recognition models...');
      const modelPath = `${window.location.origin}/models`;
      
      await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
      await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
      await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);

      modelsLoadedRef.current = true;
      console.log('Face models loaded');
      return true;
    } catch (err) {
      console.error('Model loading error:', err);
      setError('Failed to load face recognition models');
      return false;
    }
  }, []);

  const loadReferenceDescriptor = useCallback(async () => {
    try {
      setStatus('Loading reference face...');
      
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load reference image'));
        image.src = referenceFaceImage + '?t=' + Date.now();
      });

      const detection = await faceapi
        .detectSingleFace(
          img,
          new faceapi.TinyFaceDetectorOptions({ 
            inputSize: 160, 
            scoreThreshold: 0.5
          })
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        throw new Error('No face found in reference image');
      }

      referenceDescriptorRef.current = Array.from(detection.descriptor);
      console.log('Reference face loaded');
      return true;
    } catch (err) {
      console.error('Reference loading error:', err);
      setError('Failed to load reference face image');
      return false;
    }
  }, [referenceFaceImage]);

  const cosineSimilarity = (a, b) => {
    if (!a || !b || a.length !== b.length) return 0;
    
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;
    
    return (dot / denom + 1) / 2;
  };

  const checkFaceQuality = (detection) => {
    if (!videoRef.current) return false;
    if (detection.detection.score < 0.5) return false;

    const faceBox = detection.detection.box;
    const videoCenter = videoRef.current.videoWidth / 2;
    const faceCenter = faceBox.x + (faceBox.width / 2);
    const maxOffset = videoRef.current.videoWidth * 0.35;
    
    if (Math.abs(faceCenter - videoCenter) > maxOffset) return false;

    const minSize = videoRef.current.videoWidth * 0.15;
    const maxSize = videoRef.current.videoWidth * 0.85;
    if (faceBox.width < minSize || faceBox.width > maxSize) return false;

    return true;
  };

  const startFaceDetection = useCallback(() => {
    if (!videoRef.current || !referenceDescriptorRef.current) return;

    setStatus('Looking for face...');
    hasVerifiedRef.current = false;

    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || hasVerifiedRef.current) return;

      try {
        const detections = await faceapi
          .detectAllFaces(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 160,
              scoreThreshold: 0.5
            })
          )
          .withFaceLandmarks()
          .withFaceDescriptors();

        const now = Date.now();
        const shouldMatch = (now - lastDetectionTimeRef.current >= MATCHING_THROTTLE);

        if (detections.length === 0) {
          setFaceDetected(false);
          setStatus('Please look at the camera');
          setSimilarityScore(null);
        } else if (detections.length === 1) {
          setFaceDetected(true);
          const detection = detections[0];

          if (checkFaceQuality(detection) && shouldMatch) {
            lastDetectionTimeRef.current = now;
            setIsVerifying(true);
            setStatus('Verifying face...');

            const currentDescriptor = Array.from(detection.descriptor);
            const similarity = cosineSimilarity(
              currentDescriptor,
              referenceDescriptorRef.current
            );

            setSimilarityScore(similarity);
            console.log('Match score:', (similarity * 100).toFixed(1) + '%');

            if (similarity >= MATCH_THRESHOLD && !hasVerifiedRef.current) {
              console.log('FACE VERIFIED!');
              hasVerifiedRef.current = true;
              speakVerification();
              
              if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
                detectionIntervalRef.current = null;
              }

              onVerified({
                similarity,
                confidence: detection.detection.score
              });
            } else if (similarity < MATCH_THRESHOLD) {
              setStatus(`No match (${(similarity * 100).toFixed(1)}%)`);
            }

            setIsVerifying(false);
          } else {
            setStatus('Position face in center');
          }
        } else {
          setFaceDetected(false);
          setStatus('Multiple faces detected. Only one person allowed.');
        }
      } catch (err) {
        console.error('Detection error:', err);
      }
    }, DETECTION_INTERVAL);
  }, [videoRef, onVerified]);

  const stopDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const cameraOk = await initCamera();
      if (!cameraOk || !isMounted) return;

      const modelsOk = await loadModels();
      if (!modelsOk || !isMounted) return;

      const refOk = await loadReferenceDescriptor();
      if (!refOk || !isMounted) return;

      setIsReady(true);
      setStatus('Ready - Look at camera');
      
      setTimeout(() => {
        if (isMounted) startFaceDetection();
      }, 500);
    };

    init();

    return () => {
      isMounted = false;
      stopDetection();
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [initCamera, loadModels, loadReferenceDescriptor, startFaceDetection, stopDetection]);

  return {
    isReady,
    error,
    status,
    faceDetected,
    similarityScore,
    isVerifying
  };
};

export default useFaceVerification;
