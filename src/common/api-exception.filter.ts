import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body: any =
      exception instanceof HttpException ? exception.getResponse() : {};
    const messages = Array.isArray(body?.message) ? body.message : [];
    const message =
      messages[0] ||
      body?.message ||
      (exception instanceof Error
        ? exception.message
        : 'Internal server error');
    response.status(status).json({
      success: false,
      message: status === 500 ? 'Internal server error' : message,
      code: body?.code || this.codeFor(status, message),
      errors: messages,
    });
  }

  private codeFor(status: number, message: string) {
    if (/project not found/i.test(message)) return 'PROJECT_NOT_FOUND';
    const names = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'BUSINESS_VALIDATION_ERROR',
    };
    return names[status] || 'INTERNAL_ERROR';
  }
}
