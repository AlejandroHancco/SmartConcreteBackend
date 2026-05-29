import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMeasurementChannelDto } from './dto/update-measurement-channel.dto';
import { MeasurementChannelResponse } from './measurement-channels.types';

@Injectable()
export class MeasurementChannelsService {
  constructor(private prisma: PrismaService) {}

  async getAllChannels(
    measurementId: number,
  ): Promise<MeasurementChannelResponse[]> {
    // Verificar que la medición exista
    const measurement = await this.prisma.measurement.findUnique({
      where: { id: measurementId },
    });

    if (!measurement) {
      throw new NotFoundException('Measurement not found');
    }

    // Obtener canales existentes
    const existingChannels = await this.prisma.measurementChannel.findMany({
      where: { measurementId },
    });

    const channelMap = new Map(
      existingChannels.map((c) => [c.channelNumber, c]),
    );

    // Retornar los 16 canales (con defaults si no existen)
    return Array.from({ length: 16 }, (_, i) => {
      const channelNumber = i + 1;
      const channel = channelMap.get(channelNumber);

      return {
        channelNumber,
        channelAlias: channel?.channelAlias ?? `Canal ${channelNumber}`,
        concreteMix: channel?.concreteMix ? Number(channel.concreteMix) : null,
        hasEmulsifier: channel?.hasEmulsifier ?? false,
        notes: channel?.notes ?? null,
        sampleAge: channel?.sampleAge ?? null,
        temperature: channel?.temperature
          ? Number(channel.temperature)
          : null,
        humidity: channel?.humidity ? Number(channel.humidity) : null,
      };
    });
  }

  async updateChannelMetadata(
    measurementId: number,
    channelNumber: number,
    dto: UpdateMeasurementChannelDto,
  ): Promise<MeasurementChannelResponse> {
    // Validar rango de canal
    if (channelNumber < 1 || channelNumber > 16) {
      throw new BadRequestException(
        'channelNumber must be between 1 and 16',
      );
    }

    // Verificar que la medición exista
    const measurement = await this.prisma.measurement.findUnique({
      where: { id: measurementId },
    });

    if (!measurement) {
      throw new NotFoundException('Measurement not found');
    }

    // Preparar datos para actualizar
    const updateData: Record<string, any> = {};

    if (dto.concreteMix !== undefined) {
      updateData.concreteMix = dto.concreteMix;
    }
    if (dto.hasEmulsifier !== undefined) {
      updateData.hasEmulsifier = dto.hasEmulsifier;
    }
    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }
    if (dto.sampleAge !== undefined) {
      updateData.sampleAge = dto.sampleAge;
    }
    if (dto.temperature !== undefined) {
      updateData.temperature = dto.temperature;
    }
    if (dto.humidity !== undefined) {
      updateData.humidity = dto.humidity;
    }

    // Upsert del canal de medición
    const result = await this.prisma.measurementChannel.upsert({
      where: {
        measurementId_channelNumber: { measurementId, channelNumber },
      },
      create: {
        measurementId,
        channelNumber,
        ...updateData,
      },
      update: updateData,
    });

    return {
      channelNumber: result.channelNumber,
      channelAlias: result.channelAlias,
      concreteMix: result.concreteMix ? Number(result.concreteMix) : null,
      hasEmulsifier: result.hasEmulsifier ?? false,
      notes: result.notes,
      sampleAge: result.sampleAge,
      temperature: result.temperature ? Number(result.temperature) : null,
      humidity: result.humidity ? Number(result.humidity) : null,
    };
  }
}






