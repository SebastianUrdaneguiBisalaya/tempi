import type { UserProfile } from '../domain/user-profile';
import type { CoreDeps } from './deps';

export const getProfile = (deps: Pick<CoreDeps, 'profile'>): Promise<UserProfile | null> => deps.profile.get();
