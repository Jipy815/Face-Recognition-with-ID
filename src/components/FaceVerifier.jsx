import React, { useRef, useEffect } from 'react';
import { User, CheckCircle2, XCircle } from 'lucide-react';
import useFaceVerification from '../hooks/useFaceVerification';
import * as faceapi from '@vladmandic/face-api';

const FaceVerifier = ({ studentId, studentData, onVerified, onFailed }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const {
    isReady,
    error,
    status,
    faceDetected,
    similarityScore,
    isVerifying,
    detections
  } = useFaceVerification(videoRef, studentData.faceImage, onVerified, onFailed);

  // Use face-api's built-in drawing utilities for ROI visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video || !isReady) return;

    const drawDetections = () => {
      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      faceapi.matchDimensions(canvas, displaySize);

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (detections && detections.length > 0) {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        // Draw face detection boxes with face-api's built-in drawing
        faceapi.draw.drawDetections(canvas, resizedDetections);
      }

      requestAnimationFrame(drawDetections);
    };

    drawDetections();
  }, [isReady, detections]);

  return (
    <div className="bg-white rounded-xl shadow-2xl p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <User className="text-green-600" size={28} />
            Step 2: Verify Face
          </h2>
          <span className="text-sm text-gray-500">2/2</span>
        </div>
        <p className="text-gray-600">
          Look at the camera to verify your identity
        </p>
      </div>

      <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-600 mb-1">Student ID</p>
            <p className="text-lg font-bold text-gray-800">{studentId}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Name</p>
            <p className="text-lg font-bold text-gray-800">{studentData.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Department</p>
            <p className="text-sm text-gray-700">{studentData.department}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Year</p>
            <p className="text-sm text-gray-700">{studentData.year}</p>
          </div>
        </div>
      </div>

      <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {!faceDetected && isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-white text-center p-4">
              <div className="w-32 h-32 mx-auto mb-4 border-4 border-white border-dashed rounded-full flex items-center justify-center animate-pulse">
                <User size={64} className="text-white" strokeWidth={2} />
              </div>
              <p className="text-lg font-semibold">Position your face here</p>
            </div>
          </div>
        )}

        {!isReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg">Loading face recognition...</p>
            </div>
          </div>
        )}

        <div className="absolute bottom-4 left-4 right-4">
          <div className="rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm font-medium drop-shadow-lg">{status}</span>
              {similarityScore !== null && (
                <span className="text-white text-sm font-bold drop-shadow-lg">
                  {(similarityScore * 100).toFixed(1)}%
                </span>
              )}
            </div>
            
            {faceDetected && (
              <div className="mt-2 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-400 drop-shadow-lg" />
                <span className="text-green-400 text-xs drop-shadow-lg">Face detected</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center gap-2 text-red-700">
            <XCircle size={20} />
            <span className="text-sm font-semibold">{error}</span>
          </div>
        </div>
      )}

      <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-start gap-3">
          <div className="text-green-600 mt-1">💡</div>
          <div className="text-sm text-gray-700">
            <p className="font-semibold mb-1">Tips for best results:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Look directly at the camera</li>
              <li>Ensure your face is well-lit</li>
              <li>Remove glasses or masks if possible</li>
              <li>Keep your face centered in the frame</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaceVerifier;
