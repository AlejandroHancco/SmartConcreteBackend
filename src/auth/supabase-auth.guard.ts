import { Injectable } from '@nestjs/common';
import { CombinedAuthGuard } from './combined-auth.guard';

@Injectable()
export class SupabaseAuthGuard extends CombinedAuthGuard {}
