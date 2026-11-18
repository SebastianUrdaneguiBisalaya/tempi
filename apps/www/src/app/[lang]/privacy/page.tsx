import { LegalPage, legalMetadata } from '@/features/legal/components/legal-page';

export const generateMetadata = () => legalMetadata('privacy');

export default function PrivacyPage() {
	return <LegalPage page='privacy' />;
}
