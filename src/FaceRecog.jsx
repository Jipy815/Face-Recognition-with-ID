import React, { useState } from 'react';
import IDScanner from './components/IDScanner';
import FaceVerifier from './components/FaceVerifier';
import SuccessScreen from './components/SuccessScreen';
import FailureScreen from './components/FailureScreen';
import ProgressIndicator from './components/ProgressIndicator';
import useVerificationFlow from './hooks/useVerificationFlow';

const VerificationApp = () => {
  const {
    currentStep,
    studentId,
    studentData,
    verificationResult,
    handleIDDetected,
    handleFaceVerified,
    handleFaceFailed,
    reset
  } = useVerificationFlow();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center gap-8">
          <ProgressIndicator currentStep={currentStep} />
          
          <div className="flex-1 max-w-2xl">
            {currentStep === 'scanning_id' && (
              <IDScanner onIDDetected={handleIDDetected} />
            )}

            {currentStep === 'verifying_face' && studentData && (
              <FaceVerifier
                studentId={studentId}
                studentData={studentData}
                onVerified={handleFaceVerified}
                onFailed={handleFaceFailed}
              />
            )}

            {currentStep === 'success' && verificationResult && (
              <SuccessScreen
                studentData={studentData}
                verificationResult={verificationResult}
                onReset={reset}
              />
            )}

            {(currentStep === 'failed_id' || 
              currentStep === 'failed_face' || 
              currentStep === 'failed_mismatch') && (
              <FailureScreen
                failureType={currentStep}
                studentId={studentId}
                onRetry={reset}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerificationApp;
