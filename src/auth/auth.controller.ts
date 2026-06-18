import { Controller, Request, Post, Get, UseGuards, Body, Query, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (user) {
      return this.authService.login(user);
    }
    throw new Error('Invalid credentials');
  }

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(
      createUserDto.email,
      createUserDto.name,
      createUserDto.lastName,
      createUserDto.password,
    );
  }

  @Get('check-email')
  checkEmail(@Query('email') email: string) {
    if (!email) throw new BadRequestException('Email is required');
    return this.authService.checkEmail(email);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile')
  getProfile(@Request() req) {
    return req.user;
  }
}
