export interface NormalizedUser {
  id: string;
  email: string;
  role?: string;
  provider: 'jwt' | 'supabase';
}
