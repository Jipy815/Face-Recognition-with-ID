import React from 'react';
import { Scan, User, CheckCircle2 } from 'lucide-react';

const ProgressIndicator = ({ currentStep }) => {
  const steps = [
    { id: 'scanning_id', label: 'Scan ID', icon: Scan },
    { id: 'verifying_face', label: 'Verify Face', icon: User },
    { id: 'success', label: 'Complete', icon: CheckCircle2 }
  ];

  const getStepStatus = (stepId) => {
    const stepOrder = ['scanning_id', 'verifying_face', 'success'];
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(stepId);

    if (currentStep.startsWith('failed')) {
      return 'error';
    }

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="max-w-2xl mx-auto mb-8">
      <div className="flex items-center justify-between relative">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;
          
          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`
                    w-16 h-16 rounded-full flex items-center justify-center mb-2 transition-all duration-300
                    ${status === 'completed' ? 'bg-green-500 text-white' : ''}
                    ${status === 'active' ? 'bg-blue-600 text-white animate-pulse' : ''}
                    ${status === 'pending' ? 'bg-gray-200 text-gray-400' : ''}
                    ${status === 'error' ? 'bg-red-500 text-white' : ''}
                  `}
                >
                  <Icon size={28} strokeWidth={2.5} />
                </div>
                <span
                  className={`
                    text-sm font-semibold
                    ${status === 'completed' ? 'text-green-600' : ''}
                    ${status === 'active' ? 'text-blue-600' : ''}
                    ${status === 'pending' ? 'text-gray-400' : ''}
                    ${status === 'error' ? 'text-red-600' : ''}
                  `}
                >
                  {step.label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div className="flex-1 h-1 mx-4 relative" style={{ top: '-20px' }}>
                  <div className="absolute inset-0 bg-gray-200 rounded"></div>
                  <div
                    className={`
                      absolute inset-0 rounded transition-all duration-500
                      ${getStepStatus(steps[index + 1].id) === 'completed' || 
                        getStepStatus(steps[index + 1].id) === 'active' 
                        ? 'bg-green-500' 
                        : 'bg-gray-200'}
                    `}
                    style={{
                      width: getStepStatus(steps[index + 1].id) === 'active' ? '50%' : '100%'
                    }}
                  ></div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressIndicator;
