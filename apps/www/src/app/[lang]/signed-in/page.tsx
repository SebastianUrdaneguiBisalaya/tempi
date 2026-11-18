import { SignInResult, signInMetadata } from '@/features/sign-in/components/sign-in-result';

export const generateMetadata = () => signInMetadata('done');

export default function SignedInPage() {
	return <SignInResult outcome='done' />;
}
