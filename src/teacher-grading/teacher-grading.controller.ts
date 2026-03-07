import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TeacherGradingService } from './teacher-grading.service';
import {
  SaveGradingDraftDto,
  SubmitGradingDto,
} from './dto/update-grading-request.dto';

interface DecodedFirebaseToken {
  uid: string;
}

@Controller('teacher/grading-requests')
@UseGuards(FirebaseAuthGuard)
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
