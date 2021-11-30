
import { UnknownExtra } from 'graasp';
import {
    DownloadPreHookTasksFunction,
    ServiceMethod,
    UploadPreHookTasksFunction,
    GraaspLocalFileItemOptions,
    GraaspS3FileItemOptions,
} from 'graasp-plugin-file';

export interface GraaspThumbnailsOptions {
    serviceMethod: ServiceMethod;

    pathPrefix: string;

    // TODO: use prehook in uploadPrehook.... for public
    uploadPreHookTasks?: UploadPreHookTasksFunction;
    downloadPreHookTasks: DownloadPreHookTasksFunction;

    enableItemsHooks?: boolean;
    enableAppsHooks?: {
        appsTemplateRoot: string; // apps/template
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

