import { Server } from 'http';

import fastify, { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { DatabaseTransactionHandler, MemberTaskManager } from '@graasp/sdk';
import { ItemTaskManager, TaskRunner } from '@graasp/test';
import { PublicItemTaskManager } from 'graasp-plugin-public';

import { GRAASP_ACTOR } from './constants';

const schemas = {
  $id: 'http://graasp.org/',
  definitions: {
    uuid: {
      type: 'string',
      pattern:
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    },
    idParam: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { $ref: '#/definitions/uuid' },
      },
      additionalProperties: false,
    },
  },
};

async function build<E>({
  plugin,
  runner,
  itemTaskManager,
  options,
  memberTaskManager,
  getAppIdByUrl,
  publicItemTaskManager,
}: {
  plugin: FastifyPluginAsync<E, Server>;
  runner: TaskRunner;
  itemTaskManager: ItemTaskManager;
  memberTaskManager?: MemberTaskManager;
  options?: E;
  getAppIdByUrl?: (
    url: string,
    db: DatabaseTransactionHandler,
  ) => { id: string };
  publicItemTaskManager?: PublicItemTaskManager;
}): Promise<FastifyInstance> {
  const app = fastify();
  app.addSchema(schemas);

  app.decorateRequest('member', GRAASP_ACTOR);
  app.decorate('taskRunner', runner);
  app.decorate('items', {
    taskManager: itemTaskManager,
  });
  app.decorate('members', {
    taskManager: memberTaskManager ?? {},
  });
  app.decorate('appService', {
    getAppIdByUrl,
  });
  app.decorate('db', { pool: null });
  app.decorate('public', {
    graaspActor: GRAASP_ACTOR,
    items: { taskManager: publicItemTaskManager ?? {} },
  });

  await app.register(plugin, options);

  return app;
}

export default build;
