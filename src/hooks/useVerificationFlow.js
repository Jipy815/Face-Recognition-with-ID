import { useState, useCallback } from 'react';
import { getStudentByID } from '../services/testDB';

const VERIFICATION_STATES = {
  SCANNING_ID: 'scanning_id',
  VERIFYING_FACE: 'verifying_face',
  SUCCESS: 'success',
  FAILED_ID: 'failed_id',
  FAILED_FACE: 'failed_face',
  FAILED_MISMATCH: 'failed_mismatch'
};

const useVerificationFlow = () => {
  const [currentStep, setCurrentStep] = useState(VERIFICATION_STATES.SCANNING_ID);
  const [studentId, setStudentId] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);

  const handleIDDetected = useCallback((detectedId) => {
    console.log('ID Detected:', detectedId);
    
    const student = getStudentByID(detectedId);
    
    if (!student) {
      console.error('Student not found in database');
      setCurrentStep(VERIFICATION_STATES.FAILED_ID);
      setStudentId(detectedId);
      return;
    }

    console.log('Student found:', student.name);
    setStudentId(detectedId);
    setStudentData(student);
    setCurrentStep(VERIFICATION_STATES.VERIFYING_FACE);
  }, []);

  const handleFaceVerified = useCallback((result) => {
    console.log('Face verified:', result);
    setVerificationResult({
      ...result,
      timestamp: new Date().toISOString(),
      studentId: studentId
    });
    setCurrentStep(VERIFICATION_STATES.SUCCESS);
  }, [studentId]);

  const handleFaceFailed = useCallback((reason) => {
    console.error('Face verification failed:', reason);
    setCurrentStep(VERIFICATION_STATES.FAILED_FACE);
  }, []);

  const reset = useCallback(() => {
    console.log('Resetting verification flow');
    setCurrentStep(VERIFICATION_STATES.SCANNING_ID);
    setStudentId(null);
    setStudentData(null);
    setVerificationResult(null);
  }, []);

  return {
    currentStep,
    studentId,
    studentData,
    verificationResult,
    handleIDDetected,
    handleFaceVerified,
    handleFaceFailed,
    reset
  };
};

export default useVerificationFlow;
