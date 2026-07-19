import {
  BadGatewayException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseAccountAuthService {
  private readonly authUrl: string;
  private readonly anonKey: string;
  private readonly admin: SupabaseClient;
  private readonly emailRedirectTo: string;

  constructor(config: ConfigService) {
    const supabaseUrl = config.getOrThrow<string>('SUPABASE_URL').replace(/\/$/, '');
    this.authUrl = `${supabaseUrl}/auth/v1`;
    this.anonKey = config.getOrThrow<string>('SUPABASE_ANON_KEY');
    this.admin = createClient(supabaseUrl, config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
    this.emailRedirectTo = `${config
      .getOrThrow<string>('WEB_ORIGIN')
      .replace(/\/$/, '')}/auth/callback?next=/settings/account`;
  }

  async requestReauthentication(accessToken: string): Promise<void> {
    await this.userRequest('/reauthenticate', accessToken, { method: 'GET' });
  }

  async updateEmail(accessToken: string, email: string, nonce: string): Promise<void> {
    await this.userRequest(
      `/user?redirect_to=${encodeURIComponent(this.emailRedirectTo)}`,
      accessToken,
      { method: 'PUT', body: { email, nonce } },
    );
  }

  async updatePassword(accessToken: string, password: string, nonce: string): Promise<void> {
    await this.userRequest('/user', accessToken, {
      method: 'PUT',
      body: { password, nonce },
    });
  }

  async assertRecentlyAuthenticated(userId: string, maximumAgeMs = 15 * 60 * 1000): Promise<void> {
    const { data, error } = await this.admin.auth.admin.getUserById(userId);
    const lastSignInAt = data.user?.last_sign_in_at ? Date.parse(data.user.last_sign_in_at) : 0;
    if (error) this.rethrow(error);
    if (!lastSignInAt || Date.now() - lastSignInAt > maximumAgeMs) {
      throw new UnauthorizedException({
        code: 'REAUTHENTICATION_REQUIRED',
        message: 'Reconnectez-vous avant de confirmer cette action sensible.',
      });
    }
  }

  async revokeAllSessions(accessToken: string): Promise<void> {
    const { error } = await this.admin.auth.admin.signOut(accessToken, 'global');
    if (error) this.rethrow(error);
  }

  async removeAvatars(userId: string): Promise<void> {
    const bucket = this.admin.storage.from('avatars');
    const { data, error } = await bucket.list(userId, { limit: 100 });
    if (error) this.rethrow(error);
    const paths = (data ?? []).map(({ name }) => `${userId}/${name}`);
    if (paths.length) {
      const { error: removeError } = await bucket.remove(paths);
      if (removeError) this.rethrow(removeError);
    }
  }

  async deleteAuthUser(userId: string): Promise<void> {
    const { error } = await this.admin.auth.admin.deleteUser(userId, false);
    if (error && error.status !== 404) this.rethrow(error);
  }

  private async userRequest(
    path: string,
    accessToken: string,
    input: { method: 'GET' | 'PUT'; body?: Record<string, unknown> },
  ): Promise<void> {
    if (!accessToken) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Authentification requise.',
      });
    }
    const response = await fetch(`${this.authUrl}${path}`, {
      method: input.method,
      headers: {
        apikey: this.anonKey,
        authorization: `Bearer ${accessToken}`,
        ...(input.body ? { 'content-type': 'application/json' } : {}),
      },
      ...(input.body ? { body: JSON.stringify(input.body) } : {}),
    });
    if (response.ok) return;
    const body = (await response.json().catch(() => ({}))) as {
      code?: string;
      error_code?: string;
      message?: string;
      msg?: string;
    };
    this.rethrow({
      code: body.code ?? body.error_code,
      message: body.message ?? body.msg ?? 'Supabase Auth request failed',
      status: response.status,
    });
  }

  private rethrow(error: { message: string; status?: number; code?: string }): never {
    const value = `${error.code ?? ''} ${error.message}`.toLowerCase();
    if (value.includes('reauth') || value.includes('nonce') || error.status === 401) {
      throw new UnauthorizedException({
        code: 'REAUTHENTICATION_REQUIRED',
        message: 'Le code de réauthentification est invalide ou expiré.',
      });
    }
    if (
      value.includes('already') ||
      value.includes('registered') ||
      value.includes('same_password')
    ) {
      throw new ConflictException({
        code: 'AUTH_UPDATE_CONFLICT',
        message: 'Supabase Authentication refuse cette modification car elle existe déjà.',
      });
    }
    throw new BadGatewayException({
      code: 'SUPABASE_AUTH_ERROR',
      message: "Supabase Authentication n'a pas pu appliquer cette action.",
    });
  }
}
