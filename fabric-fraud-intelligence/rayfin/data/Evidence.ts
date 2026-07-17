import { entity, authenticated, uuid, text, decimal, date } from '@microsoft/rayfin-core';

/** Evidence — a grounded fact attached to a case (structured or narrative). */
@entity()
@authenticated('*')
export class Evidence {
  @uuid() id!: string;
  @text({ max: 40 }) caseId!: string;
  @text({ max: 40 }) evidenceType!: string;
  @text({ max: 160 }) title!: string;
  @text({ max: 4000 }) content!: string;
  @text({ max: 60 }) sourceSystem!: string;
  @decimal() confidence!: number;
  @date() createdAt!: Date;
}
