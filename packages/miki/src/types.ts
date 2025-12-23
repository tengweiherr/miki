export type InteractionType = 
  | "click" 
  | "hover" 
  | "grabStart" 
  | "grabRelease" 
  | "input" 
  | "display" 
  | "url";

export interface RecordedStep {
  id: number;
  interaction: InteractionType;
  tagName: string;
  className: string;
  textContent: string;
  url?: string;
  inputValue?: string;
  inputType?: string;
  testId?: string;
  elementId?: string;
  timestamp: Date;
}

export interface MikiProps {
  /**
   * API endpoint for test generation
   * @default "/api/generate-test"
   */
  apiEndpoint?: string;
  
  /**
   * Callback when steps are recorded
   */
  onStepsChange?: (steps: RecordedStep[]) => void;
  
  /**
   * Callback when test generation starts
   */
  onGenerateStart?: (steps: RecordedStep[]) => void;
  
  /**
   * Callback when test generation completes
   */
  onGenerateComplete?: (result: string) => void;
  
  /**
   * Custom hotkey configuration
   */
  hotkeys?: {
    display?: string;
    url?: string;
  };
  
  /**
   * Initial open state of the sidebar
   * @default true
   */
  defaultOpen?: boolean;
}

export interface HotkeyConfig {
  display: string;
  url: string;
}

