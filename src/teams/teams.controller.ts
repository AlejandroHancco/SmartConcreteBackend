import { Controller, Get, Param, Patch, Delete, Post, Body, UseGuards, Request } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { JoinTeamDto } from './dto/join-team.dto';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}
  /**
   * POST /teams/join - Unirse a un equipo con código
   */
  @UseGuards(CombinedAuthGuard)
  @Post('join')
  async joinTeam(@Body() body: JoinTeamDto, @Request() req: any) {
    return this.teamsService.joinTeam(body.code, req.user);
  }

  /**
   * GET /teams/my-status - Obtener estado del usuario en su equipo
   */
  @UseGuards(CombinedAuthGuard)
  @Get('my-status')
  async getMyStatus(@Request() req: any) {
    return this.teamsService.getMyStatus(req.user);
  }

  /**
   * GET /teams/requests - Obtener solicitudes pendientes (solo ADMIN)
   */
  @UseGuards(CombinedAuthGuard)
  @Get('requests')
  async getPendingRequests(@Request() req: any) {
    return this.teamsService.getPendingRequests(req.user);
  }

  /**
   * PATCH /teams/requests/:userId/approve - Aprobar solicitud (solo ADMIN)
   */
  @UseGuards(CombinedAuthGuard)
  @Patch('requests/:userId/approve')
  async approveMember(@Param('userId') userId: string, @Request() req: any) {
    return this.teamsService.approveMember(req.user.teamId, userId, req.user);
  }

  /**
   * PATCH /teams/requests/:userId/reject - Rechazar solicitud (solo ADMIN)
   */
  @UseGuards(CombinedAuthGuard)
  @Patch('requests/:userId/reject')
  async rejectMember(@Param('userId') userId: string, @Request() req: any) {
    return this.teamsService.rejectMember(req.user.teamId, userId, req.user);
  }

  @Get()
  async getMyTeam(@Request() req: any) {
    return this.teamsService.getMyTeam(req.user.id);
  }

  @Get(':id')
  async getTeam(@Param('id') id: string) {
    return this.teamsService.getTeam(id);
  }

  @Get(':id/members')
  async getMembers(@Param('id') id: string, @Request() req: any) {
    return this.teamsService.getMembers(id);
  }

  @Patch(':id/members/:userId/role')
  async updateMemberRole(@Param('id') id: string, @Param('userId') userId: string, @Body() body: UpdateMemberRoleDto, @Request() req: any) {
    return this.teamsService.updateMemberRole(id, userId, body.role);
  }

  @Delete(':id/members/:userId')
  async removeMember(@Param('id') id: string, @Param('userId') userId: string, @Request() req: any) {
    return this.teamsService.removeMember(id, userId);
  }


  @Get(':id/projects')
  async getTeamProjects(@Param('id') id: string, @Request() req: any) {
    return this.teamsService.getTeamProjects(id);
  }

  @Get(':id/activity')
  async getTeamActivity(@Param('id') id: string, @Request() req: any) {
    return this.teamsService.getTeamActivity(id);
  }
}

