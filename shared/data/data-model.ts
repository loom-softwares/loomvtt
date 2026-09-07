import { SchemaDefinition, validateAgainstSchema } from './fields.js';

export class DataModel {
  schema?: SchemaDefinition;

  constructor(schema?: SchemaDefinition) {
    this.schema = schema;
  }

  validate(data: any): Record<string, string> | null {
    if (!this.schema) return null;
    return validateAgainstSchema(this.schema, data);
  }

  reset(): void {}
  prepareBaseData(): void {}
  prepareEmbeddedDocuments(): void {}
  prepareDerivedData(): void {}
  
  async prepareData(): Promise<void> {
    await this.reset();
    await this.prepareBaseData();
    await this.prepareEmbeddedDocuments();
    await this.prepareDerivedData();
  }

  async _preCreate(data: any, context: any, user: any): Promise<void> {}
  async _onUpdate(data: any, options: any, user: any): Promise<void> {}
  async _onCreate(data: any, options: any, user: any): Promise<void> {}
  async _onDelete(data: any, options: any, user: any): Promise<void> {}
}
