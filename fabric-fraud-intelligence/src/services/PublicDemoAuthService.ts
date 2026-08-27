import type { AuthUser, IAuthService } from './IAuthService';

const PUBLIC_DEMO_USER: AuthUser = {
  id: 'public-demo',
  email: 'analyst@demo',
  name: 'Public demo',
};

export class PublicDemoAuthService implements IAuthService {
  readonly fabricAuthEnabled = false;

  async signIn(): Promise<AuthUser> {
    return PUBLIC_DEMO_USER;
  }

  async signOut(): Promise<void> {}

  async getCurrentUser(): Promise<AuthUser> {
    return PUBLIC_DEMO_USER;
  }

  async initEmbeddedAuth(): Promise<AuthUser> {
    return PUBLIC_DEMO_USER;
  }
}