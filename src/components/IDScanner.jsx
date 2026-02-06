import React, { useRef, useEffect, useState } from 'react';
import { Camera, Scan } from 'lucide-react';
import useIDScannerLogic from '../hooks/useIDScannerLogic';

const IDScanner = ({ onIDDetected }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const scanLineY = useRef(0);
  
  const {
    isReady,
    error,
    status,
    detections,
    scanProgress,
    startScanning
  } = useIDScannerLogic(videoRef, onIDDetected);

  useEffect(() => {
    if (isReady) {
      startScanning();
    }
  }, [isReady, startScanning]);

  // Draw ROI overlay on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video || !isReady) return;

    const drawROI = () => {
      const ctx = canvas.getContext('2d');
      const rect = video.getBoundingClientRect();
      
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const isScanning = scanProgress > 0 && scanProgress < 100;
      
      // Draw detection boxes if any
      if (detections && detections.length > 0) {
        const scaleX = rect.width / (video.videoWidth || 1);
        const scaleY = rect.height / (video.videoHeight || 1);
        
        detections.forEach((detection) => {
          const [x, y, width, height] = detection.bbox;
          const dx = x * scaleX;
          const dy = y * scaleY;
          const dw = width * scaleX;
          const dh = height * scaleY;
          
          // Draw box
          ctx.strokeStyle = '#00bcd4';
          ctx.lineWidth = 3;
          ctx.strokeRect(dx, dy, dw, dh);
          
          // Corner accents
          const cornerLen = 20;
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          
          // Top-left
          ctx.beginPath();
          ctx.moveTo(dx, dy + cornerLen);
          ctx.lineTo(dx, dy);
          ctx.lineTo(dx + cornerLen, dy);
          ctx.stroke();
          
          // Top-right
          ctx.beginPath();
          ctx.moveTo(dx + dw - cornerLen, dy);
          ctx.lineTo(dx + dw, dy);
          ctx.lineTo(dx + dw, dy + cornerLen);
          ctx.stroke();
          
          // Bottom-left
          ctx.beginPath();
          ctx.moveTo(dx, dy + dh - cornerLen);
          ctx.lineTo(dx, dy + dh);
          ctx.lineTo(dx + cornerLen, dy + dh);
          ctx.stroke();
          
          // Bottom-right
          ctx.beginPath();
          ctx.moveTo(dx + dw - cornerLen, dy + dh);
          ctx.lineTo(dx + dw, dy + dh);
          ctx.lineTo(dx + dw, dy + dh - cornerLen);
          ctx.stroke();
        });
      } else {
        // Draw guide box for landscape ID card
        const guideWidth = canvas.width * 0.85;
        const guideHeight = canvas.height * 0.40;
        const guideX = (canvas.width - guideWidth) / 2;
        const guideY = (canvas.height - guideHeight) / 2;
        
        // Dashed guide
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.strokeRect(guideX, guideY, guideWidth, guideHeight);
        ctx.setLineDash([]);
        
        // Corner brackets
        const cornerLen = 30;
        ctx.strokeStyle = isScanning ? '#00bcd4' : 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 3;
        
        // Top-left
        ctx.beginPath();
        ctx.moveTo(guideX, guideY + cornerLen);
        ctx.lineTo(guideX, guideY);
        ctx.lineTo(guideX + cornerLen, guideY);
        ctx.stroke();
        
        // Top-right
        ctx.beginPath();
        ctx.moveTo(guideX + guideWidth - cornerLen, guideY);
        ctx.lineTo(guideX + guideWidth, guideY);
        ctx.lineTo(guideX + guideWidth, guideY + cornerLen);
        ctx.stroke();
        
        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(guideX, guideY + guideHeight - cornerLen);
        ctx.lineTo(guideX, guideY + guideHeight);
        ctx.lineTo(guideX + cornerLen, guideY + guideHeight);
        ctx.stroke();
        
        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(guideX + guideWidth - cornerLen, guideY + guideHeight);
        ctx.lineTo(guideX + guideWidth, guideY + guideHeight);
        ctx.lineTo(guideX + guideWidth, guideY + guideHeight - cornerLen);
        ctx.stroke();
        
        // Scan line animation
        if (isScanning) {
          scanLineY.current = (scanLineY.current + 3) % guideHeight;
          
          const gradient = ctx.createLinearGradient(guideX, 0, guideX + guideWidth, 0);
          gradient.addColorStop(0, 'transparent');
          gradient.addColorStop(0.2, '#00bcd4');
          gradient.addColorStop(0.8, '#00bcd4');
          gradient.addColorStop(1, 'transparent');
          
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(guideX + 5, guideY + scanLineY.current);
          ctx.lineTo(guideX + guideWidth - 5, guideY + scanLineY.current);
          ctx.stroke();
        }
        
        // Text hint
        ctx.font = '16px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.fillText('Position your ID here', canvas.width / 2, guideY - 15);
      }
      
      if (isScanning) {
        animationRef.current = requestAnimationFrame(drawROI);
      }
    };
    
    drawROI();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isReady, detections, scanProgress]);

  return (
    <div className="bg-white rounded-xl shadow-2xl p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Scan className="text-blue-600" size={28} />
            Step 1: Scan Student ID
          </h2>
          <span className="text-sm text-gray-500">1/2</span>
        </div>
        <p className="text-gray-600">
          Position your student ID card in the camera view
        </p>
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

        {!isReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg">Starting camera...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-90">
            <div className="text-center text-white p-6">
              <Camera size={48} className="mx-auto mb-4" />
              <p className="text-lg font-semibold mb-2">Camera Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="absolute bottom-4 left-4 right-4">
          <div className="rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm font-medium drop-shadow-lg">{status}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-3">
          <div className="text-sm text-gray-700">
            <p className="font-semibold mb-1">Tips for best results:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Hold ID card steady in the frame</li>
              <li>Ensure good lighting on the card</li>
              <li>Keep the card steady and in focus</li>
              <li>Position the student number clearly visible</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IDScanner;
