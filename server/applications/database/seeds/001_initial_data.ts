import type { Knex } from 'knex';

// Instalação nova vem zerada — sem mundo/usuários de demonstração. O usuário
// cria o primeiro mundo pelo Setup Hub. Mantido como seed vazio (em vez de
// apagar o arquivo) porque o número 001 já está reservado na sequência de
// migrations/seeds e outras seeds podem depender da ordem.
export async function seed(_knex: Knex): Promise<void> {}

export async function down(_knex: Knex): Promise<void> {}