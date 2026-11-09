import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BEARER_PREFIX } from '../auth.constants.js';
import type { AuthenticatedRequest, JwtPayload } from '../auth.interfaces.js';

/**
 * Protects dashboard routes: @UseGuards(JwtAuthGuard)
 *
 * Expects the header `Authorization: Bearer <token>`. If the token's signature
 * is valid (signed with our JWT_SECRET) and it hasn't expired, the user is
 * attached to the request. No database call needed — that's the point of JWTs.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [type, token] = req.headers.authorization?.split(' ') ?? [];

    if (type !== BEARER_PREFIX || !token) {
      throw new UnauthorizedException(
        'Missing Authorization: Bearer <token> header',
      );
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      req.user = {
        userId: payload.sub,
        tenantId: payload.tenantId,
        email: payload.email,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
