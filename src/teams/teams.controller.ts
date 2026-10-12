import { Controller, Get, Param, Patch, Delete, Post, Body, UseGuards, Request } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { JoinTeamDto } from './dto/join-team.dto';

@Controller('teams')
@UseGuards(CombinedAuthGuard, PermissionGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post('join')
  async joinTeam(@Body() body: JoinTeamDto, @Request() req: any) {
    return this.teamsService.joinTeam(body.code, req.user);
  }

  @Get('my-status')
  async getMyStatus(@Request() req: any) {
    return this.teamsService.getMyStatus(req.user);
  }

  @Get('requests')
  @RequirePermission('member:approve')
  async getPendingRequests(@Request() req: any) {
    return this.teamsService.getPendingRequests(req.user);
  }

  @Get()
  @RequirePermission('team:view')
  async getMyTeam(@Request() req: any) {
    return this.teamsService.getMyTeam(req.user.id);
  }

  @Patch('requests/:userId/approve')
  @RequirePermission('member:approve')
  async approveMember(@Param('userId') userId: string, @Request() req: any) {
    return this.teamsService.approveMember(req.user.teamId, userId, req.user);
  }

  @Patch('requests/:userId/reject')
  @RequirePermission('member:reject')
  async rejectMember(@Param('userId') userId: string, @Request() req: any) {
    return this.teamsService.rejectMember(req.user.teamId, userId, req.user);
  }

  @Get(':id')
  @RequirePermission('team:view')
  async getTeam(@Param('id') id: string, @Request() req: any) {
    return this.teamsService.getTeam(id, req.user.id);
  }

  @Get(':id/members')
  @RequirePermission('team:view')
  async getMembers(@Param('id') id: string, @Request() req: any) {
    return this.teamsService.getMembers(id, req.user.id);
  }

  @Patch(':id/members/:userId/role')
  @RequirePermission('member:role:edit')
  async updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: UpdateMemberRoleDto,
    @Request() req: any,
  ) {
    return this.teamsService.updateMemberRole(id, userId, body.role, req.user);
  }

  @Delete(':id/members/:userId')
  @RequirePermission('member:remove')
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req: any,
  ) {
    return this.teamsService.removeMember(id, userId, req.user);
  }

  @Get(':id/projects')
  @RequirePermission('team:view')
  async getTeamProjects(@Param('id') id: string, @Request() req: any) {
    return this.teamsService.getTeamProjects(id, req.user.id);
  }

  @Get(':id/activity')
  @RequirePermission('team:view')
  async getTeamActivity(@Param('id') id: string, @Request() req: any) {
    return this.teamsService.getTeamActivity(id, req.user.id);
  }
}
