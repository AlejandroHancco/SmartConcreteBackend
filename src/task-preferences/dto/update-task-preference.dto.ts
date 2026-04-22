import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskPreferenceDto } from './create-task-preference.dto';

export class UpdateTaskPreferenceDto extends PartialType(CreateTaskPreferenceDto) {}
