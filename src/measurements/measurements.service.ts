import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { UpdateMeasurementDto } from './dto/update-measurement.dto';

@Injectable()
export class MeasurementsService {
  constructor(private prisma: PrismaService) {}

  async create(createMeasurementDto: CreateMeasurementDto) {
    // Obtener snapshot de la preferencia activa
    const activePreference = await this.prisma.$queryRaw`
      SELECT * FROM platform.get_active_preference(${createMeasurementDto.taskId})
    ` as any[];

    if (activePreference.length > 0) {
      const pref = activePreference[0];
      createMeasurementDto.startFreq = Number(pref.start_freq);
      createMeasurementDto.stopFreq = Number(pref.stop_freq);
      createMeasurementDto.analyzerName = pref.analyzer_name;
      createMeasurementDto.analyzerIp = pref.analyzer_ip;
      createMeasurementDto.muxName = pref.mux_name;
      createMeasurementDto.muxIp = pref.mux_ip;
      createMeasurementDto.taskPreferenceId = pref.id;
    }

    return this.prisma.measurement.create({
      data: createMeasurementDto,
    });
  }

  async findAll() {
    return this.prisma.measurement.findMany();
  }

  async findByTask(taskId: number) {
    return this.prisma.measurement.findMany({
      where: { taskId },
      orderBy: { takenAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const measurement = await this.prisma.measurement.findUnique({
      where: { id },
    });

    if (!measurement) {
      return null;
    }

    return {
      ...measurement,
      startFreq: Number(measurement.startFreq),
      stopFreq: Number(measurement.stopFreq),
    };
  }

  async update(id: number, updateMeasurementDto: UpdateMeasurementDto) {
    return this.prisma.measurement.update({
      where: { id },
      data: updateMeasurementDto,
    });
  }

  async remove(id: number) {
    return this.prisma.measurement.delete({
      where: { id },
    });
  }
}
