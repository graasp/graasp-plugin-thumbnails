import {
  DatabaseTransactionHandler,
  FileItemType,
  LocalFileConfiguration,
  S3FileConfiguration,
  UnknownExtra,
} from '@graasp/sdk';
import {
  DownloadPostHookTasksFunction,
  DownloadPreHookTasksFunction,
  UploadPostHookTasksFunction,
  UploadPreHookTasksFunction,
} from 'graasp-plugin-file';

declare module 'fastify' {
  interface FastifyInstance {
    appService?: {
      getAppIdByUrl?: (
        url: string,
        db: DatabaseTransactionHandler,
      ) => { id: string };
    };
  }
}

export interface GraaspThumbnailsOptions {
  fileItemType: FileItemType;

  pathPrefix: string;

  uploadPreHookTasks?: UploadPreHookTasksFunction;
  uploadPostHookTasks?: UploadPostHookTasksFunction;
  downloadPreHookTasks: DownloadPreHookTasksFunction;
  downloadPostHookTasks?: DownloadPostHookTasksFunction;

  enableItemsHooks?: boolean;
  enableAppsHooks?: {
    appsTemplateRoot: string;
    itemsRoot: string;
  };

  fileConfigurations: {
    s3: S3FileConfiguration;
    local: LocalFileConfiguration;
  };
}

export type GraaspPublicThumbnailsOptions = {
  fileItemType: FileItemType;
  prefixes: { avatarsPrefix: string; thumbnailsPrefix: string };
  fileConfigurations: {
    s3: S3FileConfiguration;
    local: LocalFileConfiguration;
  };
};

export interface AppItemExtra extends UnknownExtra {
  app: {
    url: string;
    settings: UnknownExtra;
  };
}
