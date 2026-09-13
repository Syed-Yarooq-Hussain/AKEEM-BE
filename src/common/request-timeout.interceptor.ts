import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import {
  Observable,
  TimeoutError,
  catchError,
  throwError,
  timeout,
} from 'rxjs';

@Injectable()
export class RequestTimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const chat =
      request.method === 'POST' &&
      /\/(?:ai(?:\/[^/]+)?|ceo)\/chat\/?$/.test(
        request.path || request.url || '',
      );
    const timeoutMs = Number(
      chat
        ? process.env.AI_CHAT_TIMEOUT_MS || 600_000
        : process.env.REQUEST_TIMEOUT_MS || 120_000,
    );
    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((error) =>
        error instanceof TimeoutError
          ? throwError(
              () =>
                new RequestTimeoutException({
                  message: 'Request timed out',
                  code: 'REQUEST_TIMEOUT',
                }),
            )
          : throwError(() => error),
      ),
    );
  }
}
