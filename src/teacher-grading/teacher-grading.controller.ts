import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TeacherGradingService } from './teacher-grading.service';
import {
  SaveGradingDraftDto,
  SubmitGradingDto,
} from './dto/update-grading-request.dto';

interface DecodedFirebaseToken {
  uid: string;
}

@Controller('teacher/grading-requests')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER)
export class TeacherGradingController {
  constructor(private readonly teacherGradingService: TeacherGradingService) {}

  @Get()
  async list(@CurrentUser() decodedToken: DecodedFirebaseToken) {
    return this.teacherGradingService.listRequests(decodedToken.uid);
  }

  @Get(':id')
  async detail(
    @CurrentUser() decodedToken: DecodedFirebaseToken,
    @Param('id') id: string,
  ) {
    return this.teacherGradingService.getRequestDetail(decodedToken.uid, id);
  }

  @Patch(':id/draft')
  async saveDraft(
    @CurrentUser() decodedToken: DecodedFirebaseToken,
    @Param('id') id: string,
    @Body() dto: SaveGradingDraftDto,
  ) {
    return this.teacherGradingService.saveDraft(decodedToken.uid, id, dto);
  }

  @Post(':id/submit')
  async submit(
    @CurrentUser() decodedToken: DecodedFirebaseToken,
    @Param('id') id: string,
    @Body() dto: SubmitGradingDto,
  ) {
    return this.teacherGradingService.submit(decodedToken.uid, id, dto);
  }
}
