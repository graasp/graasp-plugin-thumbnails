import fastify, { FastifyInstance } from 'fastify';
import { ItemTaskManager, TaskRunner } from 'graasp-test';
import plugin, { GraaspThumbnailsOptions } from '../src/index';
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

const build = async ({
  runner,
  itemTaskManager,
  options,
  getAppIdByUrl
}: {
  runner: TaskRunner;
  itemTaskManager: ItemTaskManager;
  options?: GraaspThumbnailsOptions;
  getAppIdByUrl?: Function
}): Promise<FastifyInstance> => {
  const app = fastify();
  app.addSchema(schemas);

  app.decorateRequest('member', GRAASP_ACTOR);
  app.decorate('taskRunner', runner);
  app.decorate('items', {
    taskManager: itemTaskManager,
  });
  app.decorate('appService', {
    getAppIdByUrl
  })
  app.decorate('db', { pool: null })

  await app.register(plugin, options);

  return app;
};
export default build;
