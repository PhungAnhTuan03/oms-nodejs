import { CanActivate, ExecutionContext, Injectable, RawBodyRequest, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { verifyShopifyHmac } from './shopify-hmac.js';

@Injectable()
export class ShopifyHmacGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const ok = verifyShopifyHmac(
      req.rawBody,
      req.header('x-shopify-hmac-sha256'),
      this.config.get<string>('SHOPIFY_WEBHOOK_SECRET') ?? '',
    );
    if (!ok) throw new UnauthorizedException('Chữ ký webhook không hợp lệ');
    return true;
  }
}
