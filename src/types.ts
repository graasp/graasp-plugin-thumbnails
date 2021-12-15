import { DatabaseTransactionHandler, UnknownExtra } from 'graasp';
import {
  DownloadPreHookTasksFunction,
  ServiceMethod,
  UploadPreHookTasksFunction,
  GraaspLocalFileItemOptions,
  GraaspS3FileItemOptions,
} from 'graasp-plugin-file';

declare module 'fastify' {
  interface FastifyInstance {
    appService?: {
      getAppIdByUrl?: (url: string, db: DatabaseTransactionHandler) => { id: string };
    };
  }
}

export interface GraaspThumbnailsOptions {
  serviceMethod: ServiceMethod;

  pathPrefix: string;

  uploadPreHookTasks?: UploadPreHookTasksFunction;
  downloadPreHookTasks: DownloadPreHookTasksFunction;

  enableItemsHooks?: boolean;
  enableAppsHooks?: {
    appsTemplateRoot: string;
    itemsRoot: string;
  };

  serviceOptions: {
    s3: GraaspS3FileItemOptions;
    local: GraaspLocalFileItemOptions;
  };
}

export interface AppItemExtra extends UnknownExtra {
  app: {
    url: string;
    settings: UnknownExtra;
  };
}
