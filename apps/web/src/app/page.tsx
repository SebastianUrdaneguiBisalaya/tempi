import { OnboardingGate } from '@/features/onboarding/components/onboarding-gate';
import { AppShell } from '@/features/shell/components/app-shell';

export default function Home() {
	return (
		<OnboardingGate>
			<AppShell />
		</OnboardingGate>
	);
}
