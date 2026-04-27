import { Check } from 'lucide-react'

interface Step {
  label: string
}

const steps: Step[] = [
  { label: '上传PI' },
  { label: '数据配置' },
  { label: '价格调整' },
  { label: '生成文档' },
]

interface StepperProps {
  currentStep: number // 1-based: 1=上传PI, 2=数据配置, 3=价格调整, 4=生成文档
}

export default function Stepper({ currentStep }: StepperProps) {
  return (
    <div className="w-full">
      <div className="flex items-start justify-between relative">
        {/* Connector lines background */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-[#E2E5E9] -z-0" />

        {/* Active connector lines */}
        <div
          className="absolute top-4 left-0 h-0.5 bg-[#2563EB] -z-0 transition-all duration-500"
          style={{
            width: currentStep > 1 ? `${((Math.min(currentStep - 1, steps.length - 1)) / (steps.length - 1)) * 100}%` : '0%',
          }}
        />

        {steps.map((step, index) => {
          const stepNum = index + 1
          const isCompleted = stepNum < currentStep
          const isActive = stepNum === currentStep
          return (
            <div key={step.label} className="flex flex-col items-center relative z-10">
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 text-sm font-semibold transition-all duration-300 bg-white',
                  isCompleted
                    ? 'border-[#16A34A] bg-[#16A34A] text-white'
                    : isActive
                      ? 'border-[#2563EB] bg-[#2563EB] text-white shadow-[0_0_0_4px_rgba(37,99,235,0.2)]'
                      : 'border-[#E2E5E9] text-[#8F96A3]',
                ].join(' ')}
              >
                {isCompleted ? (
                  <Check size={16} strokeWidth={2.5} />
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={[
                  'mt-2 text-[13px] font-medium transition-colors duration-200',
                  isActive ? 'text-[#2563EB] font-semibold' : isCompleted ? 'text-[#16A34A]' : 'text-[#8F96A3]',
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
