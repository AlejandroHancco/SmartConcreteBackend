import { Global, Module } from '@nestjs/common';
import { KronosGateway } from './kronos.gateway';

@Global()
@Module({
  providers: [KronosGateway],
  exports: [KronosGateway],
})
export class GatewayModule {}
