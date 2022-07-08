import { v4 } from 'uuid';

import { Actor, Item } from '@graasp/sdk';
import { ServiceMethod } from 'graasp-plugin-file';

export const ROOT_PATH = './test/files';

export const GET_ITEM_ID = v4();
export const ITEM_S3_KEY =
  '35b6a6247b6a509e484bc0d91a9579d7d7ed9ddc5ee46f389ac562b2a1d9f1ec';

export const ITEM_FILE: Partial<Item> = {
  id: GET_ITEM_ID,
  name: 'item-file',
  type: 'file',
  extra: {
    s3File: {},
  },
};

export const GRAASP_ACTOR: Actor = {
  id: v4(),
};

export const DEFAULT_S3_OPTIONS = {
  s3Region: 'string',
  s3Bucket: 'string',
  s3AccessKeyId: 'string',
  s3SecretAccessKey: 'string',
  s3UseAccelerateEndpoint: false,
};

export const buildLocalOptions = ({ pathPrefix = '/prefix/' } = {}) => ({
  serviceMethod: ServiceMethod.LOCAL,
  pathPrefix,
  serviceOptions: {
    local: {
      storageRootPath: '/storageRootPath',
    },
  },
});

export const buildS3Options = ({ pathPrefix = '/prefix/' } = {}) => ({
  serviceMethod: ServiceMethod.S3,
  pathPrefix,
  serviceOptions: {
    s3: DEFAULT_S3_OPTIONS,
  },
});

export const buildPublicLocalOptions = () => ({
  serviceMethod: ServiceMethod.LOCAL,
  prefixes: {
    avatarsPrefix: 'avatars',
    thumbnailsPrefix: 'thumbnails',
  },
  serviceOptions: {
    local: {
      storageRootPath: '/storageRootPath',
    },
  },
});

export const buildPublicS3Options = () => ({
  serviceMethod: ServiceMethod.S3,
  prefixes: {
    avatarsPrefix: 'avatars',
    thumbnailsPrefix: 'thumbnails',
  },
  serviceOptions: {
    s3: DEFAULT_S3_OPTIONS,
  },
});

export const buildFileServiceOptions = (service: ServiceMethod) => {
  if (service === ServiceMethod.LOCAL) {
    return buildLocalOptions();
  } else if (service === ServiceMethod.S3) {
    return buildS3Options();
  }
  throw new Error('Service is not defined');
};

export const buildPublicFileServiceOptions = (service: ServiceMethod) => {
  if (service === ServiceMethod.LOCAL) {
    return buildPublicLocalOptions();
  } else if (service === ServiceMethod.S3) {
    return buildPublicS3Options();
  }
  throw new Error('Service is not defined');
};

export const FILE_SERVICES = [ServiceMethod.LOCAL, ServiceMethod.S3];

export const FIXTURE_THUMBNAIL_PATH = './files/image.jpeg';
export const FIXTURE_TXT_PATH = './files/1.txt';
