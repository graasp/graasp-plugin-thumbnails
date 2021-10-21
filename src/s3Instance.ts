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

  async copyObject(
    originalKey: string,
    newKey: string,
    metadata: { member: string; item: string },
  ): Promise<void> {
    const { s3Bucket: bucket } = this.options;

    const params = {
      CopySource: `${bucket}/${originalKey}`,
      Bucket: bucket,
      Key: newKey,
      Metadata: metadata,
      MetadataDirective: 'REPLACE',
      ContentDisposition: `attachment; filename="tumb-${metadata.item}"`,
      ContentType: 'image/jpeg',
      CacheControl: 'no-cache', // TODO: improve?
    };

    // TODO: the Cache-Control policy metadata is lost. try to set a global policy for the bucket in aws.
    await this.s3Instance.copyObject(params).promise();
  }

  async deleteObject(key: string): Promise<void> {
    const { s3Bucket: bucket } = this.options;

    const params = { Bucket: bucket, Key: key };
    await this.s3Instance.deleteObject(params).promise();
  }

  async putObject(
    key: string,
    object: Buffer,
    metadata: { member: string; item: string },
  ): Promise<void> {
    const { s3Bucket: bucket } = this.options;

    const params = {
      Bucket: bucket,
      Key: key,
      Metadata: metadata,
      Body: object,
      ContentType: 'image/jpeg',
      CacheControl: 'no-cache', // TODO: improve?
    };

    await this.s3Instance.putObject(params).promise();
  }
}
