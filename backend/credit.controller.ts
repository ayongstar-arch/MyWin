import { Controller, Post, Get, Body, Query, UseGuards, Req, Logger, Headers } from '@nestjs/common';
import { CreditService } from './credit.service';
import { TopupDto } from './dtos';
import { AuthGuard } from './common/guards';

@Controller('credit')
export class CreditController {
  private readonly logger = new Logger(CreditController.name);

  constructor(private readonly creditService: CreditService) {}

  @Get('balance')
  @UseGuards(AuthGuard)
  async getBalance(@Query('passengerId') passengerId: string) {
    const balance = await this.creditService.getBalance(passengerId);
    return { passengerId, balance };
  }

  @Post('topup')
  @UseGuards(AuthGuard)
  async topup(@Body() body: TopupDto) {
    // This is the client-initiated request (generates QR/Intent)
    // In a real flow, this would return a paymentToken or redirect URL
    // For now, it performs the mock top-up directly.
    return this.creditService.topup(body);
  }

  /**
   * WEBHOOK: Receive callback from Payment Gateway (e.g., GBPrimePay, Omise)
   * URL: POST /api/credit/webhook
   * This logic is critical for Production.
   */
  @Post('webhook')
  async paymentWebhook(@Body() payload: any, @Headers('x-signature') signature: string) {
      // 1. Verify Signature (Security) - Mock implementation
      // const isValid = verifySignature(payload, signature, process.env.PAYMENT_SECRET);
      // if (!isValid) throw new UnauthorizedException('Invalid Signature');

      this.logger.log(`Received Payment Webhook: ${JSON.stringify(payload)}`);

      // 2. Extract Data (Example payload structure)
      const { referenceNo, amount, status, customerId } = payload;

      if (status === 'SUCCESS') {
          // 3. Call internal service to credit points
          await this.creditService.topup({
              passengerId: customerId || 'UNKNOWN',
              amount: parseFloat(amount),
              paymentMethod: 'WEBHOOK'
          });
          this.logger.log(`Webhook Processed: Added ${amount} to ${customerId}`);
      }

      return { status: 'OK' };
  }
}