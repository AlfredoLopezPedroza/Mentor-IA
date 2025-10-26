
// FIX: Define and export missing application types to resolve import errors.
export enum ConversationStep {
  ONBOARDING,
  TUTORING,
}

export interface StudentProfile {
  name: string;
  grade: string;
  interests: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'mentor';
  isFinal: boolean;
  imageUrl?: string;
  isGeneratingImage?: boolean;
}
