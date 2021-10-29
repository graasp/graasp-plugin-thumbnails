import fastify, { FastifyInstance } from 'fastify';
import { GraaspS3FileItemOptions } from 'graasp-plugin-s3-file-item';
import {
  ItemMembershipTaskManager,
  ItemTaskManager,
  TaskRunner,
} from 'graasp-test';
import plugin from '../src/index';
import { GRAASP_ACTOR, ROOT_PATH, S3_OPTIONS } from './constants';

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
  taskManager,
  membership,
  S3Options,
  options,
}: {
  runner: TaskRunner;
  taskManager: ItemTaskManager;
  membership: ItemMembershipTaskManager;
  S3Options?: GraaspS3FileItemOptions;
  options?: unknown;
}): Promise<FastifyInstance> => {
  const app = fastify();
  app.addSchema(schemas);

  app.decorateRequest('member', GRAASP_ACTOR);
  app.decorate('taskRunner', runner);
  app.decorate('items', {
    taskManager: taskManager,
  });
  app.decorate('itemMemberships', {
    taskManager: membership,
  });
  app.decorate('fileItemPluginOptions', {
    storageRootPath: ROOT_PATH,
  });
  app.decorate('s3FileItemPluginOptions', S3Options ?? S3_OPTIONS);

  await app.register(plugin, options ?? { enableS3FileItemPlugin: false });

  return app;
};
export default build;
