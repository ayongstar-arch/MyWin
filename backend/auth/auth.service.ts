import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as qs from 'querystring';
import * as bcrypt from 'bcrypt';

import { PassengerEntity } from '../entities/passenger.entity';
import { DriverEntity } from '../entities/driver.entity';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(PassengerEntity) private passengerRepo: Repository<PassengerEntity>,
        @InjectRepository(DriverEntity) private driverRepo: Repository<DriverEntity>,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) { }

    // --- GOOGLE HANDLER ---
    async validateGoogleLogin(userProfile: any, userType: 'PASSENGER' | 'DRIVER') {
        return this.findOrCreateSocialUser(
            'GOOGLE',
            userProfile.providerId,
            userProfile,
            userType
        );
    }

    // --- LINE HANDLER (Manual Implementation) ---
    async handleLineCallback(code: string, userType: 'PASSENGER' | 'DRIVER') {
        try {
            // 1. Exchange Code for Token
            const tokenRes = await axios.post(
                'https://api.line.me/oauth2/v2.1/token',
                qs.stringify({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: this.configService.get('LINE_CALLBACK_URL'),
                    client_id: this.configService.get('LINE_CHANNEL_ID'),
                    client_secret: this.configService.get('LINE_CHANNEL_SECRET'),
                }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );

            const { access_token, id_token } = tokenRes.data;

            // 2. Get User Profile
            const profileRes = await axios.get('https://api.line.me/v2/profile', {
                headers: { Authorization: `Bearer ${access_token}` },
            });

            const profile = profileRes.data; // { userId, displayName, pictureUrl, statusMessage }

            // 3. Find or Create
            return this.findOrCreateSocialUser(
                'LINE',
                profile.userId,
                {
                    email: null, // LINE doesn't always provide email
                    firstName: profile.displayName,
                    lastName: '',
                    picture: profile.pictureUrl,
                },
                userType
            );

        } catch (error) {
            console.error('LINE Login Error:', error.response?.data || error.message);
            throw new BadRequestException('LINE Login Failed');
        }
    }

    // --- UNIFORM LOGIC ---
    private async findOrCreateSocialUser(
        provider: string,
        providerId: string,
        profile: { email?: string; firstName: string; lastName?: string; picture?: string },
        userType: 'PASSENGER' | 'DRIVER'
    ) {
        if (userType === 'PASSENGER') {
            let passenger = await this.passengerRepo.findOne({
                where: [
                    { provider_id: providerId, auth_provider: provider },
                ]
            });

            if (!passenger) {
                // Register new passenger
                const newId = `P-${Math.floor(10000 + Math.random() * 90000)}`;
                passenger = this.passengerRepo.create({
                    id: newId,
                    name: profile.firstName + (profile.lastName ? ' ' + profile.lastName : ''),
                    phone: '', // Phone is unknown via Social
                    email: profile.email,
                    avatar_url: profile.picture,
                    auth_provider: provider,
                    provider_id: providerId,
                    points_balance: 0,
                    free_rides_remaining: 3
                });
                await this.passengerRepo.save(passenger);
            }

            // Generate Token
            const payload = { sub: passenger.id, role: 'PASSENGER', name: passenger.name };
            const token = this.jwtService.sign(payload);

            return {
                token,
                user: {
                    id: passenger.id,
                    name: passenger.name,
                    avatar: passenger.avatar_url,
                    points: passenger.points_balance
                }
            };

        } else {
            let driver = await this.driverRepo.findOne({
                where: { provider_id: providerId, auth_provider: provider }
            });

            if (!driver) {
                // Create Pending Driver
                const newId = `D-${Math.floor(Math.random() * 10000)}`;
                driver = this.driverRepo.create({
                    id: newId,
                    phone: '', // Unknown
                    name: profile.firstName,
                    plate: '', // Unknown
                    invite_code: 'SOCIAL', // Marker
                    winId: '', // Unknown
                    approval_status: 'PENDING',
                    auth_provider: provider,
                    provider_id: providerId,
                    email: profile.email,
                    profile_pic_url: profile.picture
                });
                await this.driverRepo.save(driver);
            }

            const payload = { sub: driver.id, role: 'DRIVER', name: driver.name };
            const token = this.jwtService.sign(payload);

            return {
                token,
                user: {
                    id: driver.id,
                    name: driver.name,
                    status: driver.approval_status
                }
            };
        }
    }

    // Generate LINE Login URL
    getLineLoginUrl(userType: 'PASSENGER' | 'DRIVER') {
        const params = qs.stringify({
            response_type: 'code',
            client_id: this.configService.get('LINE_CHANNEL_ID'),
            redirect_uri: this.configService.get('LINE_CALLBACK_URL'),
            state: userType, // Pass user type in state
            scope: 'profile openid',
        });
        return `https://access.line.me/oauth2/v2.1/authorize?${params}`;
    }

    // --- PIN MANAGEMENT ---
    async setPin(userId: string, pin: string, role: 'PASSENGER' | 'DRIVER') {
        if (!/^\d{6}$/.test(pin)) {
            throw new BadRequestException('PIN must be 6 digits');
        }
        const hash = await bcrypt.hash(pin, 10);

        if (role === 'PASSENGER') {
            await this.passengerRepo.update(userId, { pin_hash: hash });
        } else {
            await this.driverRepo.update(userId, { pin_hash: hash });
        }
        return { success: true };
    }

    async validatePinLogin(phoneNumber: string, pin: string, role: 'PASSENGER' | 'DRIVER') {
        let user;
        if (role === 'PASSENGER') {
            user = await this.passengerRepo.findOne({ where: { phone: phoneNumber } });
        } else {
            user = await this.driverRepo.findOne({ where: { phone: phoneNumber } });
        }

        if (!user) throw new UnauthorizedException('User not found');
        if (!user.pin_hash) throw new UnauthorizedException('PIN not set. Use OTP to login.');

        const isValid = await bcrypt.compare(pin, user.pin_hash);
        if (!isValid) throw new UnauthorizedException('Invalid PIN');

        // Generate Token
        const payload = { sub: user.id, role, phone: user.phone };
        const token = this.jwtService.sign(payload);

        return {
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone
            }
        };
    }

    async checkUserStatus(phoneNumber: string, role: 'PASSENGER' | 'DRIVER') {
        let user;
        if (role === 'PASSENGER') {
            user = await this.passengerRepo.findOne({ where: { phone: phoneNumber } });
        } else {
            user = await this.driverRepo.findOne({ where: { phone: phoneNumber } });
        }

        if (!user) return { exists: false };
        return { exists: true, hasPin: !!user.pin_hash };
    }
}
