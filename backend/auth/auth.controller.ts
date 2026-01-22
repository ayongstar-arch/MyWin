import { Controller, Get, Post, Body, Req, Res, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private configService: ConfigService
    ) { }

    // --- GOOGLE ---
    @Get('google')
    @UseGuards(GoogleAuthGuard)
    async googleAuth(@Req() req) { }

    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    async googleAuthRedirect(@Req() req, @Res() res) {
        const userType = req.query.state as 'PASSENGER' | 'DRIVER';
        const result = await this.authService.validateGoogleLogin(req.user, userType);

        // Redirect to Frontend with Token (Hash Fragment for SPA)
        const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/#oauth_callback?token=${result.token}&type=${userType}`);
    }

    // --- LINE ---
    @Get('line')
    async lineAuth(@Res() res, @Query('type') type: 'PASSENGER' | 'DRIVER' = 'PASSENGER') {
        const url = this.authService.getLineLoginUrl(type);
        return res.redirect(url);
    }

    @Get('line/callback')
    async lineCallback(@Query('code') code: string, @Query('state') state: string, @Res() res) {
        if (!code) return res.redirect('/#login?error=no_code');

        const userType = (state as 'PASSENGER' | 'DRIVER') || 'PASSENGER';

        try {
            const result = await this.authService.handleLineCallback(code, userType);

            const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:5173';
            return res.redirect(`${frontendUrl}/#oauth_callback?token=${result.token}&type=${userType}`);
        } catch (err) {
            console.error(err);
            return res.redirect(`${this.configService.get('FRONTEND_URL')}/#${userType.toLowerCase()}?error=line_failed`);
        }
    }

    // --- PIN AUTHENTICATION ---

    @Post('check-status')
    async checkStatus(@Body() body: { phoneNumber: string, role: 'PASSENGER' | 'DRIVER' }) {
        return this.authService.checkUserStatus(body.phoneNumber, body.role);
    }

    @Post('login-pin')
    async loginWithPin(@Body() body: { phoneNumber: string, pin: string, role: 'PASSENGER' | 'DRIVER' }) {
        return this.authService.validatePinLogin(body.phoneNumber, body.pin, body.role);
    }

    @Post('set-pin')
    async setPin(@Body() body: { userId: string, pin: string, role: 'PASSENGER' | 'DRIVER' }) {
        // Allows setting pin passing userId directly for now
        // In production, this should be guarded with a temporary token from OTP login
        return this.authService.setPin(body.userId, body.pin, body.role);
    }
}
