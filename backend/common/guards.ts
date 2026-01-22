import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt'; // ADDED
import { ROLES_KEY } from './decorators';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {} // Inject JwtService

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      // In Production, strict check:
      if (process.env.NODE_ENV === 'production') {
         throw new UnauthorizedException('Missing Authorization Header');
      }
      return true; // Allow for dev simulation if needed
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid Token Format');
    }

    try {
      // 1. Verify Real JWT
      const payload = await this.jwtService.verifyAsync(token);
      
      // 2. Attach user to request object
      request.user = { 
        id: payload.sub, 
        roles: [payload.role] 
      };
      
      return true;
    } catch (error) {
       // Fallback for Admin Hardcoded Secret (For initial setup)
       if (token === process.env.ADMIN_SECRET || token === 'admin-secret') {
           request.user = { id: 'ADMIN', roles: ['ADMIN'] };
           return true;
       }
       
       throw new UnauthorizedException('Token Expired or Invalid');
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    
    if (!user) return false; // Strict check

    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}