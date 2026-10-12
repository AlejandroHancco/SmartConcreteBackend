import { IsInt } from 'class-validator';
import { MeasureDto } from '../../tasks/dto/measure.dto';

/** Misma forma que MeasureDto + la tarea objetivo */
export class CheckAvailabilityDto extends MeasureDto {
  @IsInt()
  taskId: number;
}
