import { FAILURE_MESSAGES } from '@graasp/translations';
import { GraaspErrorDetails, GraaspError } from 'graasp';
import { StatusCodes } from 'http-status-codes';

export class GraaspBaseError implements GraaspError {
  name: string;
  code: string;
  message: string;
  statusCode?: number;
  data?: unknown;
  origin: 'plugin' | string;

  constructor(
    { code, statusCode, message }: GraaspErrorDetails,
    data?: unknown,
  ) {
    this.name = code;
    this.code = code;
    this.message = message;
    this.statusCode = statusCode;
    this.data = data;
    this.origin = 'plugin';
  }
}

export class UploadFileNotImageError extends GraaspBaseError {
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

export class UndefinedItemError extends GraaspBaseError {
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
