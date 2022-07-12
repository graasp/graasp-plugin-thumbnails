import { v4 } from 'uuid';

import { Actor, FileItemType, Item, ItemType } from '@graasp/sdk';

export const ROOT_PATH = './test/files';

export const GET_ITEM_ID = v4();
export const ITEM_S3_KEY =
  '35b6a6247b6a509e484bc0d91a9579d7d7ed9ddc5ee46f389ac562b2a1d9f1ec';

export const ITEM_FILE: Partial<Item> = {
  id: GET_ITEM_ID,
  name: 'item-file',
  type: ItemType.LOCAL_FILE,
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
  fileItemType: ItemType.LOCAL_FILE,
  pathPrefix,
  fileConfigurations: {
    local: {
      storageRootPath: '/storageRootPath',
    },
  },
});

export const buildS3Options = ({ pathPrefix = '/prefix/' } = {}) => ({
  fileItemType: ItemType.S3_FILE,
  pathPrefix,
  fileConfigurations: {
    s3: DEFAULT_S3_OPTIONS,
  },
});

export const buildPublicLocalOptions = () => ({
  fileItemType: ItemType.LOCAL_FILE,
  prefixes: {
    avatarsPrefix: 'avatars',
    thumbnailsPrefix: 'thumbnails',
  },
  fileConfigurations: {
    local: {
      storageRootPath: '/storageRootPath',
    },
  },
});

export const buildPublicS3Options = () => ({
  fileItemType: ItemType.S3_FILE,
  prefixes: {
    avatarsPrefix: 'avatars',
    thumbnailsPrefix: 'thumbnails',
  },
  fileConfigurations: {
    s3: DEFAULT_S3_OPTIONS,
  },
});

export const buildFileServiceOptions = (itemType: ItemType) => {
  if (itemType === ItemType.LOCAL_FILE) {
    return buildLocalOptions();
  } else if (itemType === ItemType.S3_FILE) {
    return buildS3Options();
  }
  throw new Error('Service is not defined');
};

export const buildPublicFileServiceOptions = (itemType: ItemType) => {
  if (itemType === ItemType.LOCAL_FILE) {
    return buildPublicLocalOptions();
  } else if (itemType === ItemType.S3_FILE) {
    return buildPublicS3Options();
  }
  throw new Error('Service is not defined');
};

export const FILE_SERVICES: FileItemType[] = [
  ItemType.LOCAL_FILE,
  ItemType.S3_FILE,
];

export const FIXTURE_THUMBNAIL_PATH = './files/image.jpeg';
export const FIXTURE_TXT_PATH = './files/1.txt';
