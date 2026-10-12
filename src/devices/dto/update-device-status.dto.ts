import { IsIn } from 'class-validator';

export class UpdateDeviceStatusDto {
  /** Solo "archived"/"unchecked": online/offline son manejados por el health check automático. */
  @IsIn(['archived', 'unchecked'])
  status: 'archived' | 'unchecked';
}
