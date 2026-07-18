import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseAdminAuthService {
  private readonly client: SupabaseClient;
  private readonly passwordResetRedirectUrl: string;

  constructor(config: ConfigService) {
    this.client = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );
    this.passwordResetRedirectUrl = `${config
      .getOrThrow<string>('WEB_ORIGIN')
      .replace(/\/$/, '')}/auth/callback?next=/profile`;
  }

  async updateEmail(userId: string, email: string): Promise<void> {
    const { error } = await this.client.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
    });
    if (error) this.rethrow(error, 'email');
  }

  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: this.passwordResetRedirectUrl,
    });
    if (error) this.rethrow(error);
  }

  async setTemporaryPassword(userId: string, password: string): Promise<void> {
    const { error } = await this.client.auth.admin.updateUserById(userId, { password });
    if (error) this.rethrow(error);
  }

  private rethrow(
    error: { message: string; status?: number; code?: string },
    field?: 'email',
  ): never {
    const normalized = `${error.code ?? ''} ${error.message}`.toLowerCase();
    if (error.status === 404 || normalized.includes('user not found')) {
      throw new NotFoundException({
        code: 'AUTH_USER_NOT_FOUND',
        message: 'Le compte Supabase Authentication est introuvable.',
      });
    }
    if (
      field === 'email' &&
      (normalized.includes('already') || normalized.includes('registered') || error.status === 422)
    ) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'Cette adresse e-mail est déjà utilisée.',
        fieldErrors: { email: ['Cette adresse e-mail est déjà utilisée.'] },
      });
    }
    throw new BadGatewayException({
      code: 'SUPABASE_AUTH_ERROR',
      message: "Supabase Authentication n'a pas pu appliquer cette action.",
    });
  }
}
