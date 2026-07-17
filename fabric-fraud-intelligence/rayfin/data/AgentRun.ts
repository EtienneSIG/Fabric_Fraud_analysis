import { entity, authenticated, uuid, text, date } from '@microsoft/rayfin-core';

/** AgentRun — an audited record of every AI agent interaction (grounded). */
@entity()
@authenticated('*')
export class AgentRun {
  @uuid() id!: string;
  @text({ max: 40 }) caseId!: string;
  @text({ max: 60 }) agentName!: string;
  @text({ max: 4000 }) prompt!: string;
  @text({ max: 4000 }) response!: string;
  @text({ max: 2000 }) groundingSources!: string;
  @date() createdAt!: Date;
  @text({ max: 80 }) userId!: string;
}
