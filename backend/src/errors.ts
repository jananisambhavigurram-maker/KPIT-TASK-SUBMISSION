import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const notFound = (entity: string) => new AppError(404, `${entity.toUpperCase()}_NOT_FOUND`, `${entity} not found`);
export const asyncHandler = (handler: RequestHandler): RequestHandler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', fields: error.flatten().fieldErrors } });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ error: { code: 'DUPLICATE_RESOURCE', message: 'A record with this unique value already exists' } });
  if (error instanceof AppError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  console.error(error);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
};
