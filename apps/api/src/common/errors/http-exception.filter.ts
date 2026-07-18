import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import type { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const structured = typeof body === 'object' && body !== null ? body : {};
    const code =
      'code' in structured && typeof structured.code === 'string'
        ? structured.code
        : status === 500
          ? 'INTERNAL_SERVER_ERROR'
          : 'HTTP_ERROR';
    const message =
      'message' in structured && typeof structured.message === 'string'
        ? structured.message
        : status === 500
          ? 'Une erreur interne est survenue.'
          : String(body ?? 'Requête impossible.');

    this.logger.error(
      { err: exception, requestId: request.id, method: request.method, path: request.url, status },
      'request failed',
    );
    response.status(status).json({
      code,
      message,
      requestId: request.id,
      ...('details' in structured ? { details: structured.details } : {}),
      ...('fieldErrors' in structured ? { fieldErrors: structured.fieldErrors } : {}),
    });
  }
}
