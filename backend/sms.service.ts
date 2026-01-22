import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { Buffer } from 'buffer';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiKey = process.env.SMS_API_KEY;
  private readonly apiSecret = process.env.SMS_API_SECRET;
  private readonly senderId = process.env.SMS_SENDER_ID || 'MyWin'; // Must register with provider
  private readonly isProduction = process.env.NODE_ENV === 'production';

  async sendOtp(phoneNumber: string, otp: string): Promise<boolean> {
    // 1. In Development/Test, just log it (Save money)
    if (!this.isProduction || !this.apiKey) {
      this.logger.log(`[DEV-MODE] SMS to ${phoneNumber}: Your OTP is ${otp}`);
      return true;
    }

    // 2. In Production, call Real API (Example: ThaiBulkSMS)
    try {
      // Data format specific to ThaiBulkSMS API
      const payload = {
        msisdn: phoneNumber,
        message: `รหัส OTP ของคุณคือ ${otp} (ห้ามบอกใคร) - MyWin`,
        sender: this.senderId,
      };

      const auth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');

      await axios.post('https://api-v2.thaibulksms.com/sms', payload, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });

      this.logger.log(`SMS Sent to ${phoneNumber} successfully.`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error.message}`);
      // Fallback: Log it so Admin can help manually if system fails
      this.logger.warn(`[FALLBACK] OTP for ${phoneNumber} is ${otp}`);
      return false;
    }
  }
}