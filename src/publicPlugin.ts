/* eslint-disable semi */
import { Item, Member } from 'graasp';
import { buildFilePathWithPrefix, THUMBNAIL_MIMETYPE } from '.';
import thumbnailsPlugin from './plugin';
import {
    CannotEditPublicItem,
    CannotEditPublicMember,
} from 'graasp-plugin-public';
import { FastifyPluginAsync } from 'fastify';
import {
    AVATARS_ROUTE,
    ITEMS_ROUTE,
    MEMBERS_ROUTE,
    THUMBNAIL_ROUTE,
} from './utils/constants';
import { GraaspPublicThumbnailsOptions } from './types';

const plugin: FastifyPluginAsync<GraaspPublicThumbnailsOptions> = async (
    fastify,
    options,
) => {
    const {
        serviceMethod,
        serviceOptions,
        prefixes: { avatarsPrefix, thumbnailsPrefix },
    } = options;

    const {
        members: { taskManager: mTM },
        public: {
            graaspActor,
            items: { taskManager: pTM },
        },
    } = fastify;
    fastify.register(thumbnailsPlugin, {
        serviceMethod: serviceMethod,
        serviceOptions,

        pathPrefix: thumbnailsPrefix,

        uploadPreHookTasks: async (payload) => {
            throw new CannotEditPublicItem(payload);
        },
        downloadPreHookTasks: async ({ itemId: id, filename }) => {
            const task = pTM.createGetPublicItemTask(graaspActor, { itemId: id });
            task.getResult = () => {
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

    fastify.register(thumbnailsPlugin, {
        serviceMethod: serviceMethod,
        serviceOptions,
        pathPrefix: avatarsPrefix,

        uploadPreHookTasks: async (payload) => {
            throw new CannotEditPublicMember(payload);
        },
        downloadPreHookTasks: async ({ itemId: id, filename }) => {
            const task = mTM.createGetTask(graaspActor, id);
            task.getResult = () => ({
                filepath: buildFilePathWithPrefix({
                    itemId: (task.result as Member).id,
                    pathPrefix: avatarsPrefix,
                    filename,
                }),
                mimetype: THUMBNAIL_MIMETYPE,
            });
            return [task];
        },
        prefix: `${MEMBERS_ROUTE}${AVATARS_ROUTE}`,
    });
};
export default plugin;
