import { prismaReadinessRepository } from './repository';
import { createReadinessService } from './service';

export const getCostFluctuationReadiness = createReadinessService(prismaReadinessRepository);
