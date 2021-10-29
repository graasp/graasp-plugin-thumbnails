import { sizes_names } from './utils/constants';

const upload = {
  querystring: {
    type: 'object',
    properties: {
      parentId: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
};

const download = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  querystring: {
    type: 'object',
    properties: {
      size: {
        enum: sizes_names,
      },
    },
    required: ['size'],
    additionalProperties: false,
  },
};

export { upload, download };
