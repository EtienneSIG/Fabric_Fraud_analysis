import { entity, authenticated, uuid, text, decimal } from '@microsoft/rayfin-core';

/** EntityRelationship — a weighted link used for collusion / network detection. */
@entity()
@authenticated('*')
export class EntityRelationship {
  @uuid() id!: string;
  @text({ max: 60 }) sourceEntityId!: string;
  @text({ max: 60 }) targetEntityId!: string;
  @text({ max: 40 }) relationshipType!: string;
  @decimal() weight!: number;
}
