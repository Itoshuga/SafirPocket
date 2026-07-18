import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export const RequestId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<{ id?: string }>();
    return request.id ?? 'unknown';
  },
);
