import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
    getAuthenticateOptions(context: ExecutionContext) {
        const req = context.switchToHttp().getRequest();
        // Pass 'userType' as state to Google
        return {
            state: req.query.type || 'PASSENGER',
        };
    }
}
