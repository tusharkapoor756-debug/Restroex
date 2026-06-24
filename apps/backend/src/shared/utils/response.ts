import { Response } from 'express';

/**
 * Standardized success response utility.
 */
export const sendSuccess = (res: Response, data: any = {}, statusCode: number = 200, meta: any = {}) => {
  return res.status(statusCode).json({
    success: true,
    data,
    meta,
  });
};
