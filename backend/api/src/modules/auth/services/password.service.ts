import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * argon2id password hashing. Parameters are deliberately explicit so a future tuning
 * change is a visible diff rather than a silent library default shift.
 */
@Injectable()
export class PasswordService {
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB — OWASP's recommended argon2id baseline
    timeCost: 2,
    parallelism: 1,
  };

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // A malformed or legacy hash must read as "wrong password", not as a 500.
      return false;
    }
  }

  /** True when the stored hash was produced with weaker parameters than the current policy. */
  needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, this.options);
    } catch {
      return true;
    }
  }
}
