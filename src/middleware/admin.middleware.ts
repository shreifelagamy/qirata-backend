import { NextFunction, Request, Response } from 'express';
import AppDataSource from '../config/database.config';
import { User } from '../entities/user.entity';
import { HttpError } from './error.middleware';

export const requireAdmin = async (
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user?.id) {
            throw new HttpError(401, 'Authentication required');
        }

        const user = await AppDataSource.getRepository(User).findOne({
            where: { id: req.user.id },
            select: ['id', 'role', 'banned', 'banExpires'],
        });

        if (!user || user.role !== 'admin') {
            throw new HttpError(403, 'Admin access required');
        }

        const banActive = user.banned && (!user.banExpires || user.banExpires > new Date());
        if (banActive) {
            throw new HttpError(403, 'Account is banned');
        }

        next();
    } catch (error) {
        next(error);
    }
};
