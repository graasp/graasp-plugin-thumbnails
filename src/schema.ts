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
    properties:{ 
      size:{
        enum: [
          'small',
          'medium',
          'large',
          'original'
        ],
      }
    },
    required: ['size'],
    additionalProperties: false,
  }
};

export { upload, download };
