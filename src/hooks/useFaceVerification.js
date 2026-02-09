import { useState, useEffect, useCallback, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';

/**
 * usefaceverification hook
 * 
 * custom react hook that handles real-time face detection and verification
 * using the @vladmandic/face-api library (tinyfacedetector model).
 * 
 * flow:
 * 1. initialize front-facing camera (640x480)
 * 2. load face-api models (tinyfacedetector, facelandmark68, facerecognition)
 * 3. load reference face descriptor from the student's stored photo
 * 4. run periodic face detection on the live video feed
 * 5. compare detected face descriptor against reference using euclidean distance
 * 6. if similarity >= threshold, trigger onverified callback
 * 
 * @param {React.RefObject} videoRef - reference to the html video element
 * @param {string} referenceFaceImage - url path to the student's reference face image
 * @param {Function} onVerified - callback when face is successfully verified (receives {similarity, confidence})
 * @param {Function} onFailed - callback when face verification fails
 * @returns {Object} hook state: { isReady, error, status, faceDetected, similarityScore, isVerifying, detectionsRef }
 */
const useFaceVerification = (videoRef, referenceFaceImage, onVerified, onFailed) => {
  // --- ui state ---
  const [isReady, setIsReady] = useState(false);           // true when camera + models + reference are all loaded
  const [error, setError] = useState(null);                 // error message string if initialization fails
  const [status, setStatus] = useState('Initializing...');  // status text displayed to the user
  const [faceDetected, setFaceDetected] = useState(false);  // true when a single face is detected in frame
  const [similarityScore, setSimilarityScore] = useState(null); // latest similarity score (0-1)
  const [isVerifying, setIsVerifying] = useState(false);    // true during active face comparison
  const detectionsRef = useRef([]);                          // shared ref for face-api detection results (used by faceverifier canvas)

  // --- internal refs ---
  const modelsLoadedRef = useRef(false);              // prevents re-loading models on re-render
  const detectionIntervalRef = useRef(null);          // setinterval id for periodic face detection
  const referenceDescriptorRef = useRef(null);        // 128-dimensional face descriptor from reference photo
  const streamRef = useRef(null);                     // mediastream for camera cleanup
  const hasVerifiedRef = useRef(false);               // prevents duplicate verification callbacks
  const lastDetectionTimeRef = useRef(Date.now());    // timestamp of last match attempt (for throttling)

  // --- configuration ---
  const MATCH_THRESHOLD = 0.58;     // minimum similarity score to verify (0-1, higher = stricter)
  const DETECTION_INTERVAL = 1000;  // how often to run face detection (ms)
  const MATCHING_THROTTLE = 6000;   // minimum time between match attempts (ms) to avoid rapid re-checks

  /**
   * announces "verification successful" via web speech api
   * called once when face verification passes
   */
  const speakVerification = useCallback(() => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('Verification Successful');
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;
      speechSynthesis.speak(utterance);
    }
  }, []);

  /**
   * initializes the front-facing camera at 640x480 resolution
   * attaches the mediastream to the video element
   * @returns {boolean} true if camera initialized successfully
   */
  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',       // front-facing camera for face verification
          width: { ideal: 640 },    // 4:3 aspect ratio
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

  /**
   * loads face-api.js neural network models from /public/models/
   * models used:
   *   - tinyfacedetector: lightweight face detection (~190kb)
   *   - facelandmark68net: 68-point facial landmark detection
   *   - facerecognitionnet: generates 128-dimensional face descriptors
   * @returns {boolean} true if models loaded successfully
   */
  const loadModels = useCallback(async () => {
    if (modelsLoadedRef.current) return true; // skip if already loaded

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

  /**
   * loads the student's reference face image and extracts its 128-dimensional descriptor
   * the descriptor is stored in referencedescriptorref for comparison during live detection
   * cache-busting query param (?t=timestamp) ensures fresh image load
   * @returns {boolean} true if reference descriptor was extracted successfully
   */
  const loadReferenceDescriptor = useCallback(async () => {
    try {
      setStatus('Loading reference face...');
      
      // load reference image with cache-busting
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load reference image'));
        image.src = referenceFaceImage + '?t=' + Date.now();
      });

      // detect face in reference image and extract 128-dimensional descriptor
      const detection = await faceapi
        .detectSingleFace(
          img,
          new faceapi.TinyFaceDetectorOptions({ 
            inputSize: 160,         // input resolution for detector (smaller = faster)
            scoreThreshold: 0.5     // minimum confidence to consider a detection valid
          })
        )
        .withFaceLandmarks()        // detect 68 facial landmark points
        .withFaceDescriptor();      // generate 128-dimensional face descriptor vector

      if (!detection) {
        throw new Error('No face found in reference image');
      }

      // store descriptor as regular array for euclidean distance calculation
      referenceDescriptorRef.current = Array.from(detection.descriptor);
      console.log('Reference face loaded');
      return true;
    } catch (err) {
      console.error('Reference loading error:', err);
      setError('Failed to load reference face image');
      return false;
    }
  }, [referenceFaceImage]);

  /**
   * calculates face similarity using euclidean distance
   * 
   * formula: distance = sqrt( sum( (a[i] - b[i])^2 ) ) for all 128 dimensions
   * similarity = max(0, 1 - distance)
   * 
   * typical distance ranges for face-api descriptors:
   *   - same person:      0.2 - 0.4 (similarity 60-80%)
   *   - different person:  0.6 - 1.0+ (similarity 0-40%)
   * 
   * @param {number[]} a - 128-dimensional descriptor of face a
   * @param {number[]} b - 128-dimensional descriptor of face b
   * @returns {number} similarity score between 0 and 1
   */
  const faceSimilarity = (a, b) => {
    if (!a || !b || a.length !== b.length) return 0;
    
    // calculate euclidean distance between two 128-dimensional face descriptors
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    const distance = Math.sqrt(sum);
    
    // convert distance to similarity (0-1 range, higher = more similar)
    const similarity = Math.max(0, 1 - distance);
    
    console.log('Euclidean distance:', distance.toFixed(4), 'Similarity:', similarity.toFixed(4));
    return similarity;
  };

  /**
   * validates face detection quality before attempting a match
   * checks:
   *   1. detection confidence score >= 0.5
   *   2. face is horizontally centered (within 35% of video center)
   *   3. face size is between 15-85% of video width (not too far/close)
   * 
   * @param {Object} detection - face-api detection result with .detection.box and .detection.score
   * @returns {boolean} true if face quality is sufficient for matching
   */
  const checkFaceQuality = (detection) => {
    if (!videoRef.current) return false;
    if (detection.detection.score < 0.5) return false; // low confidence detection

    const faceBox = detection.detection.box;
    const videoCenter = videoRef.current.videoWidth / 2;
    const faceCenter = faceBox.x + (faceBox.width / 2);
    const maxOffset = videoRef.current.videoWidth * 0.35; // 35% tolerance from center
    
    if (Math.abs(faceCenter - videoCenter) > maxOffset) return false; // face too far off-center

    const minSize = videoRef.current.videoWidth * 0.15; // face too small (too far away)
    const maxSize = videoRef.current.videoWidth * 0.85; // face too large (too close)
    if (faceBox.width < minSize || faceBox.width > maxSize) return false;

    return true;
  };

  /**
   * starts the periodic face detection loop
   * runs every DETECTION_INTERVAL ms, detects faces in the video feed,
   * and compares against the reference descriptor when MATCHING_THROTTLE allows
   * 
   * detection results:
   *   - 0 faces: show "please look at the camera"
   *   - 1 face: attempt match if quality check passes and throttle allows
   *   - 2+ faces: show "multiple faces detected" error
   */
  const startFaceDetection = useCallback(() => {
    if (!videoRef.current || !referenceDescriptorRef.current) return;

    setStatus('Looking for face...');
    hasVerifiedRef.current = false;

    // run face detection at regular intervals
    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || hasVerifiedRef.current) return; // skip if unmounted or already verified

      try {
        // detect all faces in current video frame with landmarks and descriptors
        const detections = await faceapi
          .detectAllFaces(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 160,         // smaller = faster, larger = more accurate
              scoreThreshold: 0.5     // minimum detection confidence
            })
          )
          .withFaceLandmarks()        // 68-point facial landmarks
          .withFaceDescriptors();     // 128-dimensional face descriptor for each face


        const now = Date.now();
        // only attempt matching if enough time has passed since last attempt
        const shouldMatch = (now - lastDetectionTimeRef.current >= MATCHING_THROTTLE);

        if (detections.length === 0) {
          // no face found in frame
          setFaceDetected(false);
          setStatus('Please look at the camera');
          setSimilarityScore(null);
        } else if (detections.length === 1) {
          // single face detected - update roi ref for canvas drawing
          setFaceDetected(true);
          detectionsRef.current = detections; // shared with faceverifier component for roi visualization
          console.log('DETECTIONS SET:', detections.length, 'box:', detections[0].detection.box);
          const detection = detections[0];

          if (checkFaceQuality(detection) && shouldMatch) {
            lastDetectionTimeRef.current = now; // reset throttle timer
            setIsVerifying(true);
            setStatus('Verifying face...');

            // extract descriptor and compare with reference using euclidean distance
            const currentDescriptor = Array.from(detection.descriptor);
            const similarity = faceSimilarity(
              currentDescriptor,
              referenceDescriptorRef.current
            );

            setSimilarityScore(similarity);
            console.log('Match score:', (similarity * 100).toFixed(1) + '%');

            if (similarity >= MATCH_THRESHOLD && !hasVerifiedRef.current) {
              // match found - face verified successfully
              console.log('FACE VERIFIED!');
              hasVerifiedRef.current = true;  // prevent duplicate callbacks
              speakVerification();             // audio announcement
              
              // stop detection loop
              if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
                detectionIntervalRef.current = null;
              }

              // notify parent component with match results
              onVerified({
                similarity,
                confidence: detection.detection.score
              });
            } else if (similarity < MATCH_THRESHOLD) {
              // no match - face doesn't match reference
              setStatus(`No match (${(similarity * 100).toFixed(1)}%)`);
            }

            setIsVerifying(false);
          } else {
            setStatus('Position face in center');
          }
        } else {
          // multiple faces detected - security measure, only allow one person
          setFaceDetected(false);
          detectionsRef.current = [];
          setStatus('Multiple faces detected. Only one person allowed.');
        }
      } catch (err) {
        console.error('Detection error:', err);
      }
    }, DETECTION_INTERVAL);
  }, [videoRef, onVerified]);

  /** stops the face detection interval loop */
  const stopDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  }, []);

  /**
   * initialization effect - runs once on mount
   * sequential setup: camera -> models -> reference descriptor -> start detection
   * cleanup: stops detection interval and releases camera stream
   */
  useEffect(() => {
    let isMounted = true; // prevents state updates after unmount

    const init = async () => {
      // step 1: initialize camera
      const cameraOk = await initCamera();
      if (!cameraOk || !isMounted) return;

      // step 2: load face-api models
      const modelsOk = await loadModels();
      if (!modelsOk || !isMounted) return;

      // step 3: load reference face descriptor from student photo
      const refOk = await loadReferenceDescriptor();
      if (!refOk || !isMounted) return;

      // step 4: all ready - start face detection after brief delay
      setIsReady(true);
      setStatus('Ready - Look at camera');
      
      setTimeout(() => {
        if (isMounted) startFaceDetection();
      }, 500);
    };

    init();

    // cleanup on unmount
    return () => {
      isMounted = false;
      stopDetection();
      
      // release camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [initCamera, loadModels, loadReferenceDescriptor, startFaceDetection, stopDetection]);

  // expose state and refs to the consuming component (faceverifier)
  return {
    isReady,          // boolean: all systems initialized
    error,            // string: error message or null
    status,           // string: current status text for ui
    faceDetected,     // boolean: face currently visible in frame
    similarityScore,  // number: latest match score (0-1) or null
    isVerifying,      // boolean: currently running face comparison
    detectionsRef     // ref: face-api detection objects for roi canvas drawing
  };
};

export default useFaceVerification;
