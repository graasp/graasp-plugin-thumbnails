import { StatusCodes } from 'http-status-codes';

import { BaseGraaspError } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

export class UploadFileNotImageError extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPTERR001',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.FILE_IS_NOT_IMAGE,
      },
      data,
    );
  }
}

export class UndefinedItemError extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPTERR002',
        statusCode: StatusCodes.METHOD_NOT_ALLOWED,
        message: FAILURE_MESSAGES.FILE_IS_NOT_IMAGE,
      },
      data,
    );
  }
}
