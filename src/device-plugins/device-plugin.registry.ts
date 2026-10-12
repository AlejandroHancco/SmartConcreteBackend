import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DeviceDriverPlugin } from './device-plugin.interface';
import { HiokiIm3570Plugin } from './plugins/hioki-im3570.plugin';

/**
 * Registro de plugins de dispositivo por `deviceType` (coincide con `device.type` en DB).
 * Agregar soporte para un dispositivo nuevo = crear su plugin e inyectarlo/registrarlo
 * acá; measurements.service.ts y el Kronos Watcher no cambian.
 */
@Injectable()
export class DevicePluginRegistry implements OnModuleInit {
  private readonly plugins = new Map<string, DeviceDriverPlugin>();

  constructor(private readonly hiokiPlugin: HiokiIm3570Plugin) {}

  onModuleInit() {
    this.register(this.hiokiPlugin);
    // El MUX del Hioki también lo resuelve el mismo plugin (actúa como actuator).
    this.plugins.set(HiokiIm3570Plugin.MUX_DEVICE_TYPE, this.hiokiPlugin);
  }

  register(plugin: DeviceDriverPlugin): void {
    this.plugins.set(plugin.describe().deviceType, plugin);
  }

  get(deviceType: string | null | undefined): DeviceDriverPlugin {
    const plugin = deviceType ? this.plugins.get(deviceType) : undefined;
    if (!plugin) {
      throw new NotFoundException(
        `No hay un device plugin registrado para el tipo "${deviceType}"`,
      );
    }
    return plugin;
  }

  has(deviceType: string | null | undefined): boolean {
    return !!deviceType && this.plugins.has(deviceType);
  }
}
