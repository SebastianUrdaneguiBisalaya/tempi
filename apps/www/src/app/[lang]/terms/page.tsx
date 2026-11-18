import { LegalPage, legalMetadata } from '@/features/legal/components/legal-page';

export const generateMetadata = () => legalMetadata('terms');

export default function TermsPage() {
	return <LegalPage page='terms' />;
}
