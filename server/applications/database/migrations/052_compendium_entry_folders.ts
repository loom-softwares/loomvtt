import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Both tables are created lazily by the Document layer on first write, not by a
  // migration — on an install that never had a compendium pack (or a folder) yet,
  // neither table exists when this migration runs, and `alterTable` on a missing
  // table throws (crashed the server on every boot until this guard was added).
  if (await knex.schema.hasTable('compendium_entries')) {
    const hasFolderId = await knex.schema.hasColumn('compendium_entries', 'folderId');
    if (!hasFolderId) {
      await knex.schema.alterTable('compendium_entries', (t) => {
        t.string('folderId').notNullable().defaultTo('');
      });
    }
  }
  // `folders` already scopes by worldId+type for top-level document lists (actor/item/...
  // and the pre-existing 'compendium' type, which organizes the PACK list itself). Entries
  // INSIDE one pack need a narrower scope — the same folder name/color could otherwise
  // collide across two unrelated packs in the same world. `packId` is only read/written
  // when type === 'compendium-entry'; every other folder type leaves it ''.
  if (await knex.schema.hasTable('folders')) {
    const hasPackId = await knex.schema.hasColumn('folders', 'packId');
    if (!hasPackId) {
      await knex.schema.alterTable('folders', (t) => {
        t.string('packId').notNullable().defaultTo('');
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('compendium_entries')) {
    const hasFolderId = await knex.schema.hasColumn('compendium_entries', 'folderId');
    if (hasFolderId) {
      await knex.schema.alterTable('compendium_entries', (t) => t.dropColumn('folderId'));
    }
  }
  if (await knex.schema.hasTable('folders')) {
    const hasPackId = await knex.schema.hasColumn('folders', 'packId');
    if (hasPackId) {
      await knex.schema.alterTable('folders', (t) => t.dropColumn('packId'));
    }
  }
}
