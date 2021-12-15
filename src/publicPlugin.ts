import { Item, Member } from 'graasp';
import { buildFilePathWithPrefix, THUMBNAIL_MIMETYPE } from '.';
import thumbnailsPlugin from './plugin';
import { CannotEditPublicItem, CannotEditPublicMember, } from 'graasp-plugin-public';
import { FastifyPluginAsync } from 'fastify';
import { AVATARS_ROUTE, THUMBNAIL_ROUTE } from './utils/constants';

type GraaspPublicThumbnailsOptions = {
    serviceMethod,
    prefixes: { avatarsPrefix: string, thumbnailsPrefix: string },
}

const plugin: FastifyPluginAsync<GraaspPublicThumbnailsOptions> = async (
    fastify,
    options,
) => {
    const {
        serviceMethod,
        prefixes: { avatarsPrefix, thumbnailsPrefix },
    } = options;
    const {
        members: { taskManager: mTM },
        public: {
            graaspActor,
            items: { taskManager: pTM }
        },
    } = fastify;

    fastify.register(thumbnailsPlugin, {
        serviceMethod: serviceMethod,
        serviceOptions: {
            s3: fastify.s3FileItemPluginOptions,
            local: fastify.fileItemPluginOptions,
        },

        pathPrefix: thumbnailsPrefix,

        uploadPreHookTasks: async (id) => {
            throw new CannotEditPublicItem(id);
        },
        downloadPreHookTasks: async ({ itemId: id, filename }) => {
            const task = pTM.createGetPublicItemTask(graaspActor, { itemId: id });
            task.getResult = () => ({
                filepath: buildFilePathWithPrefix({ itemId: (task.result as Item).id, pathPrefix: thumbnailsPrefix, filename }),
                mimetype: THUMBNAIL_MIMETYPE,
            });
            return [task];
        },

        prefix: `/items${THUMBNAIL_ROUTE}`,
    });

    fastify.register(thumbnailsPlugin, {
        serviceMethod: serviceMethod,
        serviceOptions: {
            s3: fastify.s3FileItemPluginOptions,
            local: fastify.fileItemPluginOptions,
        },
        pathPrefix: avatarsPrefix,

        uploadPreHookTasks: async (id) => {
            throw new CannotEditPublicMember(id);
        },
        downloadPreHookTasks: async ({ itemId: id, filename }) => {
            const task = mTM.createGetTask(graaspActor, id);
            task.getResult = () => ({
                filepath: buildFilePathWithPrefix({ itemId: (task.result as Member).id, pathPrefix: avatarsPrefix, filename }),
                mimetype: THUMBNAIL_MIMETYPE,
            });
            return [task];
        },
        prefix: `/members${AVATARS_ROUTE}`,
    });

};
export default plugin;
