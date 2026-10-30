import { Prisma } from '@prisma/client';
import multer from 'multer';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export const notFoundHandler = (_req, res) =>
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });

export const errorHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    return res
      .status(err.status)
      .json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooBig ? 413 : 400).json({
      error: {
        code: tooBig ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR',
        message: tooBig
          ? `File is too large. The maximum size is ${(env.MAX_FILE_BYTES / 1048576).toFixed(0)} MB.`
          : 'The file could not be uploaded.',
      },
    });
  }
  if (err?.type === 'entity.too.large') {
    return res
      .status(413)
      .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request is too large.' } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Malformed JSON body.' } });
  }
  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err?.code === 'ECONNREFUSED'
  ) {
    logger.error('database unavailable', { path: req.path });
    return res.status(503).json({
      error: { code: 'DB_UNAVAILABLE', message: 'The database is temporarily unavailable. Please try again shortly.' },
    });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
  }
  logger.error('unhandled error', { path: req.path, method: req.method, name: err?.name, msg: err?.message });
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' },
  });
};
