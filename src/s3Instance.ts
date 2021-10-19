import S3 from 'aws-sdk/clients/s3';
import { GraaspS3FileItemOptions } from 'graasp-plugin-s3-file-item';

export class s3Instance {
  private readonly options: GraaspS3FileItemOptions;
  private readonly s3Instance: S3;

  constructor(options: GraaspS3FileItemOptions) {
    this.options = options;

    const {
      s3Region: region,
      s3AccessKeyId: accessKeyId,
      s3SecretAccessKey: secretAccessKey,
      s3UseAccelerateEndpoint: useAccelerateEndpoint = false,
      s3Instance,
    } = options;

    this.s3Instance =
      s3Instance ??
      new S3({
        region,
        useAccelerateEndpoint,
        credentials: { accessKeyId, secretAccessKey },
      });
  }

  async getSignedUrl(
    key: string,
    metadata: { member: string; item: string },
  ): Promise<string> {
    const {
      s3Bucket: bucket,
      s3Expiration: expiration = 60, // 1 minute,
    } = this.options;

    const params = {
      Bucket: bucket,
      Key: key,
      Expires: expiration,
      Metadata: metadata,
      // currently does not work. more info here: https://github.com/aws/aws-sdk-js/issues/1703
      // the workaround is to do the upload (PUT) from the client with this request header.
      // ContentDisposition: `attachment; filename="<filename>"`
      // also does not work. should the client always send it when uploading the file?
      // CacheControl: 'no-cache'
    };

    // request s3 signed url to upload file
    try {
      const uploadUrl = await this.s3Instance.getSignedUrlPromise(
        'putObject',
        params,
      );
      return uploadUrl;
    } catch (error) {
      // log.error(error, 'graasp-s3-file-item: failed to get signed url for upload');
      throw error;
    }
  }
}