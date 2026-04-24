import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { TestConnectionDto } from './dto/test-connection.dto';
import * as net from 'net';
import axios from 'axios';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  async create(createDeviceDto: CreateDeviceDto) {
    return this.prisma.device.create({
      data: createDeviceDto,
    });
  }

  async findAll() {
    return this.prisma.device.findMany();
  }

  async findOne(id: string) {
    return this.prisma.device.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateDeviceDto: UpdateDeviceDto) {
    return this.prisma.device.update({
      where: { id },
      data: updateDeviceDto,
    });
  }

  async remove(id: string) {
    return this.prisma.device.delete({
      where: { id },
    });
  }

  async testConnection(dto: TestConnectionDto) {
    if (dto.type === 'analyzer') {
      return this.testAnalyzerConnection(dto.ip, dto.port ?? 3570);
    } else if (dto.type === 'mux') {
      return this.testMuxConnection(dto.ip);
    }
    throw new Error('Invalid device type');
  }

  private async testAnalyzerConnection(ip: string, port: number) {
    return new Promise<{ success: boolean; message: string }>((resolve) => {
      const socket = net.createConnection({ host: ip, port }, () => {
        socket.destroy();
        resolve({ success: true, message: 'Connection successful' });
      });

      socket.on('error', (err) => {
        resolve({ success: false, message: `Connection failed: ${err.message}` });
      });

      setTimeout(() => {
        socket.destroy();
        resolve({ success: false, message: 'Connection timeout' });
      }, 2000);
    });
  }

  private async testMuxConnection(ip: string) {
    try {
      await axios.get(`http://${ip}`, { timeout: 2000 });
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, message: `Connection failed: ${error.message}` };
    }
  }
}
