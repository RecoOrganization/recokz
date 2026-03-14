"use client";

import { OnboardingChoice } from "@/modules/auth/onboarding-choice";

export default function Onboarding() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <OnboardingChoice />
    </div>
  );
}
