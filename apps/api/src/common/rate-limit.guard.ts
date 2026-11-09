import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.module.js';

const CAPACITY = 20; // sức chứa tối đa của xô
const REFILL_PER_SEC = 5; // số token nạp lại mỗi giây

// KEYS[1] = khoá của người dùng; ARGV = sức chứa, tốc độ nạp, thời điểm hiện tại (ms)
const TOKEN_BUCKET_LUA = `
local cap = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local data = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(data[1]) or cap
local ts = tonumber(data[2]) or now
tokens = math.min(cap, tokens + (now - ts) / 1000 * rate)
local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', KEYS[1], math.ceil(cap / rate * 1000))
return allowed
`;

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // Tắt khi chạy thử tải (script oversell, k6)
    if (this.config.get('RATE_LIMIT_DISABLED') === 'true') return true;

    const req = ctx.switchToHttp().getRequest();
    const who = req.user?.sub ? `user:${req.user.sub}` : `ip:${req.ip}`;
    const allowed = await this.redis.eval(
      TOKEN_BUCKET_LUA, 1, `ratelimit:${who}`, CAPACITY, REFILL_PER_SEC, Date.now(),
    );
    if (allowed !== 1) {
      throw new HttpException('Bạn gửi quá nhiều yêu cầu, vui lòng thử lại sau', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
