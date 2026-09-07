import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller(['finance', 'api/finance'])
export class FinanceController {
  constructor(private s: FinanceService) {}
  @Get('overview') overview(
    @Req() r,
    @Query('projectId') p?: string,
    @Query('period') x = 'month',
  ) {
    return this.s.overview(r.user, p ? Number(p) : undefined, x);
  }
  @Get('transactions') transactions(@Req() r, @Query() q: any) {
    return this.s.transactions(r.user, q);
  }
  @Post('transactions') createTransaction(@Req() r, @Body() b: any) {
    return this.s.createTransaction(r.user, b);
  }
  @Get('invoices') invoices(@Req() r, @Query() q: any) {
    return this.s.invoices(r.user, q);
  }
  @Post('invoices') createInvoice(@Req() r, @Body() b: any) {
    return this.s.createInvoice(r.user, b);
  }
  @Patch('invoices/:id') updateInvoice(
    @Req() r,
    @Param('id', ParseIntPipe) id: number,
    @Body() b: any,
  ) {
    return this.s.updateInvoice(r.user, id, b);
  }
  @Get('budgets') budgets(@Req() r, @Query() q: any) {
    return this.s.budgets(r.user, q);
  }
  @Post('budgets') createBudget(@Req() r, @Body() b: any) {
    return this.s.createBudget(r.user, b);
  }
  @Get('cash-flow') cashFlow(@Req() r, @Query() q: any) {
    return this.s.cashFlow(r.user, q);
  }
  @Get('reports') reports(@Req() r, @Query() q: any) {
    return this.s.financeReport(r.user, q);
  }
}
