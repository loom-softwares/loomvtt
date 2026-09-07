import 'express';
import type { JwtPayload } from '../applications/middleware/auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}
