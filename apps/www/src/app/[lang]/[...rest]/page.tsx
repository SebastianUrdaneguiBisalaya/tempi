import { notFound } from 'next/navigation';

// Any unknown path under a locale renders that locale's not-found page, inside the landing layout.
export default function UnknownPage() {
	notFound();
}
