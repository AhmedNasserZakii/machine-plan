import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BranchScoped, CurrentUser, Idempotent, Permissions, Scope } from 'src/common/decorators';
import { AuthUser, BranchScope } from 'src/common/types/request.types';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import { CollectSubscriptionDto, UpdateSubscriptionDto } from './dto/merchant.dto';
import { SubscriptionResponse } from './dto/responses/merchant.response';
import { toSubscriptionResponse } from './mappers/merchant.mapper';
import { MerchantsService } from './merchants.service';

/**
 * Subscriptions are addressed at the top level once they exist, per `08` — a collection is taken
 * against a plan, and the representative taking it has the plan id in front of him, not the
 * merchant's. Creating one still goes through `POST /merchants/:id/subscriptions`, because until
 * it exists the merchant is the only thing there is to hang it on.
 */
@ApiTags('merchants')
@ApiBearerAuth('access-token')
@Controller({ path: 'subscriptions', version: '1' })
export class SubscriptionsController {
  constructor(private readonly merchants: MerchantsService) {}

  @Patch(':id')
  @Permissions(Perm.MERCHANTS_UPDATE)
  @BranchScoped(Perm.MERCHANTS_READ_ALL)
  @ApiOperation({ summary: 'Change the amount, end the plan, or close it out' })
  @ApiResponse({ status: 200, type: SubscriptionResponse })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubscriptionDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
  ): Promise<SubscriptionResponse> {
    return toSubscriptionResponse(await this.merchants.updateSubscription(id, dto, scope, actor));
  }

  // Updates the plan it is posted to rather than creating anything, so 200.
  @Post(':id/collect')
  @HttpCode(200)
  @Idempotent()
  @Permissions(Perm.FINANCE_CREATE)
  @BranchScoped(Perm.MERCHANTS_READ_ALL)
  @ApiOperation({ summary: 'Record a payment and roll the due date forward' })
  @ApiResponse({ status: 200, type: SubscriptionResponse })
  @ApiResponse({ status: 422, description: 'The plan is ended, or is a NONE plan' })
  async collect(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CollectSubscriptionDto,
    @Scope() scope: BranchScope,
    @CurrentUser() actor: AuthUser,
  ): Promise<SubscriptionResponse> {
    return toSubscriptionResponse(await this.merchants.collectSubscription(id, dto, scope, actor));
  }
}
