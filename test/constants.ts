import { ServiceMethod } from 'graasp-plugin-file'
import { Actor, Item, Member, Task } from 'graasp';
export const ROOT_PATH = './test/files';

export const GET_ITEM_ID = 'dcd6aa46-a4f0-48b4-a872-f907cf646db0';
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
  id: 'actorid',
};


export const DEFAULT_S3_OPTIONS = {
  s3Region: 'string',
  s3Bucket: 'string',
  s3AccessKeyId: 'string',
  s3SecretAccessKey: 'string',
  s3UseAccelerateEndpoint: false,
};

export const buildLocalOptions = ({ pathPrefix = "/prefix/" } = {}) => ({
  serviceMethod: ServiceMethod.LOCAL,
  pathPrefix,
  serviceOptions: {
    local: {
      storageRootPath: "storageRootPath",
    },
  },
});

export const buildS3Options = ({ pathPrefix = "/prefix/", downloadPreHookTasks = undefined } = {}, s3 = DEFAULT_S3_OPTIONS) => ({
  serviceMethod: ServiceMethod.S3,
  pathPrefix,
  serviceOptions: {
    s3,
  },
  downloadPreHookTasks
});


export const buildFileServiceOptions = (service) => {
  if (service === ServiceMethod.LOCAL) {
    return buildLocalOptions();
  } else if (service === ServiceMethod.S3) {
    return buildS3Options();
  }
  throw new Error('Service is not defined');
};

export const FILE_SERVICES = [ServiceMethod.LOCAL, // ServiceMethod.S3
]

export const FIXTURE_THUMBNAIL_PATH = './files/image.jpeg'
export const FIXTURE_TXT_PATH = './files/1.txt'
