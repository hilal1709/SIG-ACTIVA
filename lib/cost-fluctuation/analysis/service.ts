import { createAnalysisService } from './orchestrator';
import { prismaAnalysisRepository } from './repository';

export const getCostFluctuationAnalysis = createAnalysisService(prismaAnalysisRepository);
