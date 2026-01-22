import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger, BadGatewayException } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError, retryWhen, scan, delay } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - now;
        // Audit Trail: Log every dispatch decision or status change
        this.logger.log(`${method} ${url} ${ms}ms - User:${request.user?.id || 'Anon'} - Body:${JSON.stringify(body)}`);
      }),
    );
  }
}

@Injectable()
export class ResilienceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      // Retry Logic for Network Failures
      retryWhen(errors =>
        errors.pipe(
            scan((retryCount, error) => {
                if (retryCount >= 3) {
                    throw error;
                }
                // Only retry on specific transient errors (e.g., Redis connection lost)
                if (error.code === 'ECONNREFUSED' || error.status === 502) {
                     return retryCount + 1;
                }
                throw error;
            }, 0),
            delay(500) // 500ms backoff
        )
      ),
      catchError(err => throwError(() => err))
    );
  }
}
