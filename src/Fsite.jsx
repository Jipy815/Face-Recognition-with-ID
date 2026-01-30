
import React, { useState, useRef, useEffect } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { CheckCircle2, Camera, User } from 'lucide-react';

const FaceRecognition = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const modelsLoaded = useRef(false);
  const detectionIntervalRef = useRef(null);
  const drawIntervalRef = useRef(null);
  const lastDetectionTimeRef = useRef(0);
  const startFaceDetectionRef = useRef(null);
  const referenceFacesRef = useRef([]);
  const hasVerifiedRef = useRef(false);
  const lastDetectionsRef = useRef(null);
  
  const [status, setStatus] = useState("Initializing face detection...");
  const [isPopupVisible, setPopupVisible] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [debugInfo, setDebugInfo] = useState("");
  const [referenceFiles, setReferenceFiles] = useState([]);
  const [referenceFaces, setReferenceFaces] = useState([]);
  const [similarityScore, setSimilarityScore] = useState(null);
  const [matchStatus, setMatchStatus] = useState('');
  const [bestMatchImage, setBestMatchImage] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [hasVerified, setHasVerified] = useState(false);

  // Sync refs with state to avoid stale closures
  useEffect(() => {
    referenceFacesRef.current = referenceFaces;
  }, [referenceFaces]);

  useEffect(() => {
    hasVerifiedRef.current = hasVerified;
  }, [hasVerified]);

  useEffect(() => {
    let isMounted = true;

    const loadModels = async () => {
      try {
        setStatus("Loading face detection models...");
        
        const modelPath = `${window.location.origin}/models`;
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
        await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
        await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);

        if (isMounted) {
          setStatus("Models loaded successfully");
          modelsLoaded.current = true;
        }
        return true;
      } catch (err) {
        console.error("Error loading models:", err);
        if (isMounted) {
          setStatus(`Error loading models: ${err.message}`);
          setDebugInfo(`Fatal error: ${err.message}`);
        }
        return false;
      }
    };

    const startVideo = async () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 320 },
            height: { ideal: 320 },
            frameRate: { ideal: 15 }
          }
        });
        
        if (videoRef.current && isMounted) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            if (isMounted) {
              setStatus("Camera ready - Please look at the camera");
            }
          };
        }
        setCameraError(false);
      } catch (err) {
        console.error("Error accessing camera:", err);
        if (isMounted) {
          setCameraError(true);
          setStatus("Camera access denied. Please enable camera permissions.");
        }
      }
    };

    const checkFaceQuality = (detection) => {
      if (!videoRef.current) return false;

      // Relaxed threshold for faster matching
      if (detection.detection.score < 0.5) {
        return false;
      }

      const faceBox = detection.detection.box;
      const videoCenter = videoRef.current.videoWidth / 2;
      const faceCenter = faceBox.x + (faceBox.width / 2);
      const maxOffset = videoRef.current.videoWidth * 0.35; // More lenient
      
      if (Math.abs(faceCenter - videoCenter) > maxOffset) {
        return false;
      }

      const minSize = videoRef.current.videoWidth * 0.15; // More lenient
      const maxSize = videoRef.current.videoWidth * 0.85;
      if (faceBox.width < minSize || faceBox.width > maxSize) {
        return false;
      }

      return true;
    };

    const cosineSimilarity = (a, b) => {
      if (!a || !b || !Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
        return 0;
      }
      
      let dot = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      const denom = Math.sqrt(normA) * Math.sqrt(normB);
      if (denom === 0) return 0;
      const similarity = dot / denom;
      
      // Convert cosine similarity to a more intuitive 0-1 scale
      return (similarity + 1) / 2;
    };

    const loadUploads = async () => {
      try {
        console.log("Loading uploads from /api/uploads...");
        const resp = await fetch('/api/uploads');
        
        if (!resp.ok) {
          console.error('Failed to fetch uploads:', resp.status);
          if (isMounted) setStatus("Failed to load reference images from server");
          return [];
        }
        
        const json = await resp.json();
        console.log("Uploads API response:", json);
        
        if (!Array.isArray(json.files)) {
          console.warn('Unexpected /api/uploads response format:', json);
          if (isMounted) setStatus("Invalid response format from server");
          return [];
        }

        if (isMounted) {
          setReferenceFiles(json.files);
        }

        const faces = [];
        
        for (const name of json.files) {
          try {
            const url = `/uploads/${encodeURIComponent(name)}`;
            
            const img = await new Promise((resolve, reject) => {
              const image = new Image();
              image.crossOrigin = 'anonymous';
              image.onload = () => resolve(image);
              image.onerror = () => reject(new Error(`Failed to load ${name}`));
              image.src = url + '?t=' + Date.now();
            });

            if (!modelsLoaded.current) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }

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

            if (detection) {
              console.log(`✅ Face detected in ${name}, score: ${detection.detection.score.toFixed(3)}`);
              faces.push({
                name,
                url,
                descriptor: Array.from(detection.descriptor),
              });
            } else {
              console.warn(`❌ No face detected in ${name}`);
            }
          } catch (e) {
            console.warn(`Failed processing upload ${name}:`, e.message);
          }
        }

        console.log(`Total reference faces loaded: ${faces.length}`);
        
        if (isMounted) {
          setReferenceFaces(faces);
          if (faces.length === 0) {
            setStatus("No faces detected in uploaded images. Upload clear face images.");
          } else {
            setStatus(`Loaded ${faces.length} reference face(s). Ready for recognition.`);
          }
        }
        
        return faces;
      } catch (err) {
        console.error('Failed to load uploads list:', err);
        if (isMounted) {
          setDebugInfo(`Upload loading error: ${err.message}`);
          setStatus("Failed to load reference images");
        }
        return [];
      }
    };

    const startFaceDetection = async () => {
      // Store function reference for external access
      startFaceDetectionRef.current = startFaceDetection;
      if (!videoRef.current || !canvasRef.current || !isMounted) return;
    
      const canvas = canvasRef.current;
      const displaySize = { 
        width: videoRef.current.videoWidth, 
        height: videoRef.current.videoHeight 
      };
      faceapi.matchDimensions(canvas, displaySize);
    
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      
      if (drawIntervalRef.current) {
        clearInterval(drawIntervalRef.current);
      }
      
      // Continuous drawing loop - runs fast to keep ROI visible
      drawIntervalRef.current = setInterval(() => {
        if (!isMounted || !canvasRef.current) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Redraw last detections if available
        if (lastDetectionsRef.current && lastDetectionsRef.current.length > 0) {
          const resized = faceapi.resizeResults(lastDetectionsRef.current, displaySize);
          faceapi.draw.drawDetections(canvas, resized);
        }
      }, 100);
    
      detectionIntervalRef.current = setInterval(async () => {
        if (!isMounted || isProcessing || !videoRef.current || !canvasRef.current) return;
        
        const now = Date.now();
        if (now - lastDetectionTimeRef.current < 4000) {
          return; // Skip if we just processed recently
        }
        
        lastDetectionTimeRef.current = now;

        try {
          setIsProcessing(true);
          
          const detectorOptions = new faceapi.TinyFaceDetectorOptions({
            inputSize: 160,
            scoreThreshold: 0.5
          });
    
          const detections = await faceapi
            .detectAllFaces(videoRef.current, detectorOptions)
            .withFaceLandmarks()
            .withFaceDescriptors();
    
          // Store detections for continuous drawing
          lastDetectionsRef.current = detections;
    
          if (detections.length > 0) {
            
            if (isMounted) {
              setFaceDetected(true);
            }
            
            if (detections.length === 1 && referenceFacesRef.current.length > 0) {
              const detection = detections[0];
              
              if (checkFaceQuality(detection)) {
                const currentDescriptor = Array.from(detection.descriptor);
                
                let bestSim = -1;
                let bestFace = null;

                for (const face of referenceFacesRef.current) {
                  const sim = cosineSimilarity(currentDescriptor, face.descriptor);
                  if (sim > bestSim) {
                    bestSim = sim;
                    bestFace = face;
                  }
                }
                if (bestFace && isMounted) {
                  setSimilarityScore(bestSim);
                  setBestMatchImage(bestFace.url);

                  console.log('Best match:', {
                    filename: bestFace.name,
                    similarity: bestSim.toFixed(3),
                    percentage: (bestSim * 100).toFixed(1) + '%'
                  });

                  const threshold = 0.5;
                  if (bestSim >= threshold && !hasVerifiedRef.current) {
                    console.log('MATCH FOUND!', {
                        score: bestSim.toFixed(3),
                        name: bestFace.name,
                        url: bestFace.url
                      });
                    setMatchStatus(`Match found! (${(bestSim * 100).toFixed(1)}%)`);
                    setPopupVisible(true);
                    setHasVerified(true);
                    
                    // Stop face detection after verification
                    if (detectionIntervalRef.current) {
                      clearInterval(detectionIntervalRef.current);
                      detectionIntervalRef.current = null;
                    }
                    
    
                  } else {
                    console.log('❌ No match - score too low:', bestSim.toFixed(3), 'threshold:', threshold);
                    setMatchStatus(`No match (${(bestSim * 100).toFixed(1)}% < ${(threshold * 100).toFixed(0)}%)`);
                  }
                }
              }
            } else if (detections.length > 1 && isMounted) {
              setStatus("Multiple faces detected. Please ensure only one person is in frame.");
            }
          } else if (isMounted) {
            setFaceDetected(false);
            setStatus("Please look at the camera.");
          }
        } catch (error) {
          console.error("Error in face detection:", error);
        } finally {
          if (isMounted) setIsProcessing(false);
        }
      }, 4000);
    };

    const init = async () => {
      console.log("Initializing face recognition...");
      
      const modelsSuccess = await loadModels();
      if (!modelsSuccess || !isMounted) return;
      
      console.log("Models loaded, now loading uploads...");
      await loadUploads();
      
      if (!isMounted) return;
      
      console.log("Starting camera...");
      await startVideo();
      
      setTimeout(() => {
        if (isMounted && videoRef.current && videoRef.current.readyState >= 2) {
          console.log("Starting face detection...");
          startFaceDetection();
        }
      }, 1000);
    };

    init();

    return () => {
      isMounted = false;
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      if (drawIntervalRef.current) {
        clearInterval(drawIntervalRef.current);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white shadow-md rounded-lg p-6 max-w-md w-full space-y-4">
        
        <div className="aspect-square w-full relative rounded-lg overflow-hidden border-4 border-gray-300">
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <canvas 
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
          
          {!faceDetected && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-white text-center p-4">
                <div className="w-32 h-32 mx-auto mb-4 border-4 border-white border-dashed rounded-full flex items-center justify-center">
                  <User size={64} className="text-white" strokeWidth={2} />
                </div>
                <p className="text-lg">Position your face here</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div className="text-center">
            <p className="text-gray-800 font-medium">{status}</p>
            {matchStatus && (
              <p className={`mt-2 font-semibold ${
                matchStatus.includes('Match') ? 'text-green-600' : 'text-red-600'
              }`}>
                {matchStatus}
              </p>
            )}
          </div>
          
          {debugInfo && (
            <p className="text-sm text-red-500 text-center">{debugInfo}</p>
          )}
          
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-center text-sm">
              <span className="font-semibold">Face Detected:</span> 
              <span className={`ml-2 px-2 py-1 rounded ${
                faceDetected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {faceDetected ? 'Yes' : 'No'}
              </span>
            </div>
            
            {referenceFiles.length > 0 && referenceFaces.length === 0 && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-xs text-yellow-700">
                  Images found but no faces detected. Please upload clear face images.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isPopupVisible && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
          <div className="bg-green-500 rounded-lg shadow-xl p-8 text-center text-white max-w-sm w-full mx-4 relative">
            <button
              onClick={() => {
                setPopupVisible(false);
                setHasVerified(false);
                setMatchStatus('');
                setStatus('Ready for face recognition');
                // Restart face detection
                if (videoRef.current && canvasRef.current && startFaceDetectionRef.current) {
                  startFaceDetectionRef.current();
                }
              }}
              className="absolute top-2 right-2 text-white hover:text-gray-200 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-green-600 transition"
              aria-label="Close"
            >
              ×
            </button>
            <div className="mb-4 flex justify-center">
              <CheckCircle2 size={80} className="text-white" strokeWidth={2} />
            </div>
            <p className="text-2xl font-bold mb-2">Verified</p>
            <p className="text-lg">Face recognition successful!</p>
          </div>
        </div>
      )}

      {cameraError && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 text-center max-w-sm w-full mx-4">
            <div className="mb-4 flex justify-center">
              <Camera size={64} className="text-red-500" strokeWidth={2} />
            </div>
            <p className="text-2xl font-bold mb-2">Camera Error</p>
            <p className="text-gray-600 mb-4">Please enable camera permissions to use face recognition.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FaceRecognition;