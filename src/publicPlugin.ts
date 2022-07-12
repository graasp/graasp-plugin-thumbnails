import { FastifyPluginAsync } from 'fastify';

import { Item, Member } from '@graasp/sdk';
import {
  CannotEditPublicItem,
  CannotEditPublicMember,
} from 'graasp-plugin-public';

import { THUMBNAIL_MIMETYPE, buildFilePathWithPrefix } from '.';
import thumbnailsPlugin from './plugin';
import { GraaspPublicThumbnailsOptions } from './types';
import {
  AVATARS_ROUTE,
  ITEMS_ROUTE,
  MEMBERS_ROUTE,
  THUMBNAIL_ROUTE,
} from './utils/constants';

const plugin: FastifyPluginAsync<GraaspPublicThumbnailsOptions> = async (
  fastify,
  options,
) => {
  const {
    fileItemType,
    fileConfigurations,
    prefixes: { avatarsPrefix, thumbnailsPrefix },
  } = options;

  const {
    members: { taskManager: mTM },
    public: {
      graaspActor,
      items: { taskManager: pTM },
    },
  } = fastify;

  // items' thumbnails
  fastify.register(thumbnailsPlugin, {
    fileItemType,
    fileConfigurations,

    pathPrefix: thumbnailsPrefix,

    uploadPreHookTasks: async (payload) => {
      throw new CannotEditPublicItem(payload);
    },
    downloadPreHookTasks: async ({ itemId: id, filename }) => {
      const task = pTM.createGetPublicItemTask(graaspActor, { itemId: id });
      task.getResult = () => {
        if (task.result instanceof Error) return task.result;
        return {
          filepath: buildFilePathWithPrefix({
            itemId: (task.result as Item).id,
            pathPrefix: thumbnailsPrefix,
            filename,
          }),
          mimetype: THUMBNAIL_MIMETYPE,
        };
      };
      return [task];
    },

    prefix: `${ITEMS_ROUTE}${THUMBNAIL_ROUTE}`,
  });

  // members' avatars
  fastify.register(thumbnailsPlugin, {
    fileItemType,
    fileConfigurations,
    pathPrefix: avatarsPrefix,

    uploadPreHookTasks: async (payload) => {
      throw new CannotEditPublicMember(payload);
    },
    downloadPreHookTasks: async ({ itemId: id, filename }) => {
      const task = mTM.createGetTask(graaspActor, id);
      task.getResult = () => {
        if (task.result instanceof Error) return task.result;
        return {
          filepath: buildFilePathWithPrefix({
            itemId: (task.result as Member).id,
            pathPrefix: avatarsPrefix,
            filename,
          }),
          mimetype: THUMBNAIL_MIMETYPE,
        };
      };
      return [task];
    },
    prefix: `${MEMBERS_ROUTE}${AVATARS_ROUTE}`,
  });
};
export default plugin;
