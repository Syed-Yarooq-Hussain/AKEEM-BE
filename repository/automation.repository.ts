import { Injectable } from '@nestjs/common'; import { InjectModel } from '@nestjs/sequelize';
import { AiAgent, AiAgentDelegation, AiAgentTeam, Automation } from '../models'; import { BaseRepository } from './base.repository';
@Injectable() export class AiAgentRepository extends BaseRepository<AiAgent> { constructor(@InjectModel(AiAgent) m: typeof AiAgent) { super(m); } }
@Injectable() export class AutomationRepository extends BaseRepository<Automation> { constructor(@InjectModel(Automation) m: typeof Automation) { super(m); } }
@Injectable() export class AiAgentTeamRepository extends BaseRepository<AiAgentTeam> { constructor(@InjectModel(AiAgentTeam) m: typeof AiAgentTeam) { super(m); } }
@Injectable() export class AiAgentDelegationRepository extends BaseRepository<AiAgentDelegation> {
  constructor(@InjectModel(AiAgentDelegation) m: typeof AiAgentDelegation) { super(m); }
  findPendingForAgent(agentId: number) { return this.model.findAll({ where: { toAgentId: agentId, status: 'pending' }, order: [['createdAt', 'ASC']] }); }
}
