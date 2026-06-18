import { Injectable } from '@nestjs/common';
import { CombinedAuthGuard } from '../../auth/combined-auth.guard';

@Injectable()
export class JwtAuthGuard extends CombinedAuthGuard {}
