import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from 'src/common/decorators';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import { SettingResponse } from './dto/responses/setting.response';
import { UpdateSettingDto } from './dto/setting.dto';
import { SettingsService } from './settings.service';

/**
 * The tunable thresholds behind the decommission recommendation (`13`). Reads are gated the same
 * as writes: knowing where the company draws the "scrap it" line is a management fact, and there
 * is no screen outside the Director's settings page that needs it.
 */
@ApiTags('settings')
@ApiBearerAuth('access-token')
@Controller({ path: 'settings', version: '1' })
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @Permissions(Perm.SETTINGS_MANAGE)
  @ApiOperation({
    summary: 'List every tunable setting with its effective value',
    description: 'Fixed catalogue of settings keys, bounded by code. Not paginated.',
  })
  @ApiResponse({ status: 200, type: [SettingResponse] })
  findAll(): Promise<SettingResponse[]> {
    return this.settings.findAll();
  }

  @Get(':key')
  @Permissions(Perm.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Read one setting' })
  @ApiResponse({ status: 200, type: SettingResponse })
  @ApiResponse({ status: 404, description: 'SETTING_NOT_FOUND' })
  findOne(@Param('key') key: string): Promise<SettingResponse> {
    return this.settings.findOne(key);
  }

  @Put(':key')
  @Permissions(Perm.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Override one setting; the value is range-checked per key' })
  @ApiResponse({ status: 200, type: SettingResponse })
  @ApiResponse({ status: 400, description: 'VALIDATION_FAILED — outside the allowed range' })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser('id') actorId: string,
  ): Promise<SettingResponse> {
    return this.settings.set(key, dto.value, actorId);
  }
}
