import { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { logger } from '../utils/logger';

export const validate = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const validated = await schema.parseAsync(req.body);
      req.body = validated; // Replace with validated/transformed data
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn(
          {
            errors: error.issues,
            body: req.body,
          },
          'Request validation failed'
        );

        res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid request data',
          details: error.issues.map((err: z.ZodIssue) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
      } else {
        logger.error({ error }, 'Unexpected validation error');
        res.status(500).json({
          error: 'Internal server error during validation',
        });
      }
    }
  };
};

export const validateQuery = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Query validation failed',
          details: error.issues,
        });
      } else {
        res.status(500).json({
          error: 'Internal server error during validation',
        });
      }
    }
  };
};

export const validateParams = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.params);
      req.params = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Parameter validation failed',
          details: error.issues,
        });
      } else {
        res.status(500).json({
          error: 'Internal server error during validation',
        });
      }
    }
  };
};
